/*
Environment configuration (set in App Service Configuration):
- AZURE_CLIENT_ID: App registration (Web) application (client) ID
- AZURE_CLIENT_SECRET: Client secret for the app registration
- AZURE_AUTHORITY: Optional. e.g. https://login.microsoftonline.com/organizations or specific tenant ID
- REDIRECT_URI: Optional. e.g. https://<yourapp>.azurewebsites.net/auth/redirect
- SESSION_SECRET: Session crypto secret
- AZURE_STORAGE_CONNECTION_STRING: Optional. Blob storage connection string for uploads
- OUTPUTS_CONTAINER: Optional. Blob container name (default 'ari-outputs')

Notes:
- Outputs are also written to the App Service mounted Azure Files share under `outputs/` for durability.
- The app uses delegated user tokens to call ARM and passes a tenant-scoped ARM token to PowerShell.
*/
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const msal = require('@azure/msal-node');
const { BlobServiceClient } = require('@azure/storage-blob');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'production';
const OUTPUTS_DIR = process.env.OUTPUTS_DIR ? path.resolve(process.env.OUTPUTS_DIR) : path.join(__dirname, 'outputs');
const AZURE_ENVIRONMENT = process.env.AZURE_ENVIRONMENT || 'AzureCloud';

if (!fs.existsSync(OUTPUTS_DIR)) {
  fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
}

// Basic env validation
['AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET'].forEach((name) => {
  if (!process.env[name]) {
    console.warn(`[warning] Missing ${name}; configure App Service settings before deploying`);
  }
});

let cca = null;
function getCca() {
  if (cca) return cca;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('AZURE_CLIENT_ID and AZURE_CLIENT_SECRET must be configured');
  }
  const msalConfig = {
    auth: {
      clientId,
      authority: process.env.AZURE_AUTHORITY || 'https://login.microsoftonline.com/common',
      clientSecret
    },
    system: { loggerOptions: { loggerCallback: () => {} } }
  };
  cca = new msal.ConfidentialClientApplication(msalConfig);
  return cca;
}

function buildRedirectUri(req) {
  const configured = process.env.REDIRECT_URI;
  if (configured) return configured;
  const proto = (req.headers['x-forwarded-proto'] || 'https');
  const host = (req.headers['x-forwarded-host'] || req.headers.host);
  return `${proto}://${host}/auth/redirect`;
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.homeAccountId) {
    return res.status(401).json({ error: 'not_authenticated' });
  }
  next();
}

async function getAccount(req) {
  if (!req.session || !req.session.homeAccountId) return null;
  return await getCca().getTokenCache().getAccountByHomeId(req.session.homeAccountId);
}

async function acquireArmTokenForTenant(req, tenantId) {
  const account = await getAccount(req);
  if (!account) throw new Error('No account in session');
  const authority = `https://login.microsoftonline.com/${tenantId}`;
  const scopes = ['https://management.azure.com/.default', 'offline_access'];
  try {
    const result = await getCca().acquireTokenSilent({ account, authority, scopes });
    return result.accessToken;
  } catch (err) {
    // If silent fails due to authority/tenant change, try by code-refresh using the common authority as a fallback
    console.error('acquireTokenSilent failed:', err.message);
    throw err;
  }
}

function selectPowerShellExecutable() {
  const candidates = [
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    'pwsh',
    'powershell.exe'
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch (_) {}
  }
  return process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
}

const jobs = new Map();

async function uploadOutputsToBlob(jobId) {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.OUTPUTS_CONTAINER || 'ari-outputs';
  if (!connectionString) return { uploaded: false };
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists({ access: 'blob' });
  const dirPath = path.join(OUTPUTS_DIR, jobId);
  const fileNames = fs.readdirSync(dirPath).filter((n) => fs.statSync(path.join(dirPath, n)).isFile());
  const uploads = [];
  for (const name of fileNames) {
    const filePath = path.join(dirPath, name);
    const blockBlobClient = containerClient.getBlockBlobClient(`${jobId}/${name}`);
    const data = fs.readFileSync(filePath);
    await blockBlobClient.upload(data, data.length, { blobHTTPHeaders: { blobContentType: guessContentType(name) } });
    uploads.push(blockBlobClient.url);
  }
  return { uploaded: true, urls: uploads };
}

function guessContentType(name) {
  if (name.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (name.endsWith('.xml')) return 'application/xml';
  if (name.endsWith('.json')) return 'application/json';
  if (name.endsWith('.log') || name.endsWith('.txt')) return 'text/plain';
  return 'application/octet-stream';
}

const app = express();
app.set('trust proxy', 1);
app.use(cookieParser());
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-insecure-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: NODE_ENV === 'production' }
  })
);

app.use('/outputs', express.static(OUTPUTS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/auth/login', async (req, res) => {
  try {
    const redirectUri = buildRedirectUri(req);
    const authCodeUrlParameters = {
      scopes: ['https://management.azure.com/.default', 'openid', 'profile', 'offline_access'],
      redirectUri,
      prompt: 'select_account'
    };
    const authCodeUrl = await getCca().getAuthCodeUrl(authCodeUrlParameters);
    res.redirect(authCodeUrl);
  } catch (err) {
    res.status(500).send(`Login error: ${err.message}`);
  }
});

app.get('/auth/redirect', async (req, res) => {
  try {
    const redirectUri = buildRedirectUri(req);
    const tokenResponse = await getCca().acquireTokenByCode({
      code: req.query.code,
      scopes: ['https://management.azure.com/.default', 'openid', 'profile', 'email', 'offline_access'],
      redirectUri
    });
    const account = tokenResponse.account;
    req.session.homeAccountId = account.homeAccountId;
    req.session.username = account.username;
    res.redirect('/');
  } catch (err) {
    res.status(500).send(`Auth redirect error: ${err.message}`);
  }
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});


function getUser(req) {
  const header = req.headers['x-ms-client-principal'];
  if (!header) return null;
  const decoded = Buffer.from(header, 'base64').toString('utf8');
  return JSON.parse(decoded);
}

app.get('/api/me', (req, res) => {
  // Log headers for debugging
  console.log('Request headers:', req.headers);
  const user = getUser(req);
  if (!user) return res.status(401).send('Not authenticated');
  res.json(user);
});

app.get('/api/tenants', requireAuth, async (req, res) => {
  try {
    // Use common authority token to list tenants
    const account = await getAccount(req);
    const result = await getCca().acquireTokenSilent({ account, authority: 'https://login.microsoftonline.com/common', scopes: ['https://management.azure.com/.default'] });
    const token = result.accessToken;
    const { data } = await axios.get('https://management.azure.com/tenants?api-version=2020-01-01', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const tenants = (data.value || []).map((t) => ({ tenantId: t.tenantId, displayName: t.displayName || t.tenantId }));
    res.json({ tenants });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/subscriptions', requireAuth, async (req, res) => {
  try {
    const { tenantId } = req.query;
    if (!tenantId) return res.status(400).json({ error: 'tenantId_required' });
    const token = await acquireArmTokenForTenant(req, tenantId);
    const { data } = await axios.get('https://management.azure.com/subscriptions?api-version=2021-01-01', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const subs = (data.value || []).map((s) => ({ subscriptionId: s.subscriptionId, displayName: s.displayName, state: s.state }));
    res.json({ subscriptions: subs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/run', requireAuth, async (req, res) => {
  try {
    const { tenantId, subscriptionId } = req.body || {};
    if (!tenantId) return res.status(400).json({ error: 'tenantId_required' });
    const accessToken = await acquireArmTokenForTenant(req, tenantId);
    const accountId = req.session.username;
    const jobId = uuidv4();
    const jobDir = path.join(OUTPUTS_DIR, jobId);
    fs.mkdirSync(jobDir, { recursive: true });

    const logPath = path.join(jobDir, 'run.log');
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });

    const psExe = selectPowerShellExecutable();
    const scriptPath = path.join(__dirname, 'powershell', 'run-ari.ps1');

    const args = [];
    if (psExe.toLowerCase().includes('pwsh')) {
      args.push('-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File');
    } else {
      args.push('-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File');
    }
    args.push(scriptPath);
    args.push('-TenantId', tenantId);
    if (subscriptionId) { args.push('-SubscriptionId', subscriptionId); }
    args.push('-AccessToken', accessToken);
    args.push('-AccountId', accountId);
    args.push('-OutputDir', jobDir);
    args.push('-AzureEnvironment', AZURE_ENVIRONMENT);

    const { spawn } = require('child_process');
    const child = spawn(psExe, args, { windowsHide: true });

    const jobInfo = { id: jobId, status: 'running', startedAt: new Date().toISOString(), logPath, outputDir: jobDir, processId: child.pid };
    jobs.set(jobId, jobInfo);

    child.stdout.on('data', (d) => logStream.write(d));
    child.stderr.on('data', (d) => logStream.write(d));

    child.on('exit', async (code) => {
      logStream.end();
      jobInfo.endedAt = new Date().toISOString();
      jobInfo.exitCode = code;
      jobInfo.status = code === 0 ? 'succeeded' : 'failed';
      try {
        const upload = await uploadOutputsToBlob(jobId);
        jobInfo.upload = upload;
      } catch (e) {
        jobInfo.uploadError = e.message;
      }
      jobs.set(jobId, jobInfo);
    });

    res.json({ jobId, status: 'running', outputsUrl: `/outputs/${jobId}/`, logUrl: `/api/jobs/${jobId}/log` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/jobs/:id/status', requireAuth, (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'job_not_found' });
  const files = fs.existsSync(job.outputDir)
    ? fs.readdirSync(job.outputDir).filter((n) => fs.statSync(path.join(job.outputDir, n)).isFile())
    : [];
  res.json({ ...job, files });
});

app.get('/api/jobs/:id/log', requireAuth, (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).send('Not found');
  if (!fs.existsSync(job.logPath)) return res.status(404).send('Log not found');
  res.setHeader('Content-Type', 'text/plain');
  fs.createReadStream(job.logPath).pipe(res);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
