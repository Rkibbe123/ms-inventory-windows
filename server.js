require('dotenv').config();
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
const NODE_ENV = process.env.NODE_ENV || 'development';
const OUTPUTS_DIR = process.env.OUTPUTS_DIR ? path.resolve(process.env.OUTPUTS_DIR) : path.join(__dirname, 'outputs');
const AZURE_ENVIRONMENT = process.env.AZURE_ENVIRONMENT || 'AzureCloud';

if (!fs.existsSync(OUTPUTS_DIR)) {
  fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
}

// MSAL Configuration for OAuth
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
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}/auth/redirect`;
}

// Get account from session
async function getAccount(req) {
  if (!req.session || !req.session.homeAccountId) return null;
  return await getCca().getTokenCache().getAccountByHomeId(req.session.homeAccountId);
}

// Get ARM token for user
async function acquireArmTokenForTenant(req, tenantId) {
  const account = await getAccount(req);
  if (!account) throw new Error('No account in session');
  const authority = `https://login.microsoftonline.com/${tenantId}`;
  const scopes = ['https://management.azure.com/.default', 'offline_access'];
  try {
    const result = await getCca().acquireTokenSilent({ account, authority, scopes });
    return result.accessToken;
  } catch (err) {
    console.error('acquireTokenSilent failed:', err.message);
    throw err;
  }
}

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session || !req.session.homeAccountId) {
    return res.status(401).json({ error: 'not_authenticated' });
  }
  next();
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

// Express app setup
const app = express();
app.set('trust proxy', 1);
app.use(cookieParser());
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-insecure-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 }
  })
);

app.use('/outputs', express.static(OUTPUTS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/app', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// Azure AD OAuth endpoints
app.get('/auth/login', async (req, res) => {
  try {
    const tenantId = req.query.tenant;
    if (!tenantId) {
      return res.status(400).send('Tenant ID is required. Please go back and enter your tenant ID.');
    }
    
    // Store tenant in session for redirect
    req.session.loginTenant = tenantId;
    
    const redirectUri = buildRedirectUri(req);
    const authCodeUrlParameters = {
      scopes: ['https://management.azure.com/.default', 'openid', 'profile', 'offline_access'],
      redirectUri,
      prompt: 'select_account',
      authority: `https://login.microsoftonline.com/${tenantId}`
    };
    const authCodeUrl = await getCca().getAuthCodeUrl(authCodeUrlParameters);
    res.redirect(authCodeUrl);
  } catch (err) {
    res.status(500).send(`Login error: ${err.message}`);
  }
});

app.get('/auth/redirect', async (req, res) => {
  try {
    const tenantId = req.session.loginTenant;
    if (!tenantId) {
      return res.status(400).send('Session expired. Please login again.');
    }
    
    const redirectUri = buildRedirectUri(req);
    const tokenResponse = await getCca().acquireTokenByCode({
      code: req.query.code,
      scopes: ['https://management.azure.com/.default', 'openid', 'profile', 'email', 'offline_access'],
      redirectUri,
      authority: `https://login.microsoftonline.com/${tenantId}`
    });
    const account = tokenResponse.account;
    req.session.homeAccountId = account.homeAccountId;
    req.session.username = account.username;
    req.session.primaryTenant = tenantId;
    
    // Clear the temporary login tenant
    delete req.session.loginTenant;
    
    res.redirect('/app');
  } catch (err) {
    console.error('Auth redirect error:', err);
    res.status(500).send(`Auth redirect error: ${err.message}`);
  }
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// API endpoints
app.get('/api/me', requireAuth, async (req, res) => {
  res.json({ username: req.session.username, homeAccountId: req.session.homeAccountId });
});

app.get('/api/tenants', requireAuth, async (req, res) => {
  try {
    const account = await getAccount(req);
    if (!account) {
      return res.status(401).json({ error: 'reauth_required' });
    }
    const authority = `https://login.microsoftonline.com/${req.session.primaryTenant || 'common'}`;
    const result = await getCca().acquireTokenSilent({
      account,
      authority,
      scopes: ['https://management.azure.com/.default']
    });
    const token = result.accessToken;
    const { data } = await axios.get('https://management.azure.com/tenants?api-version=2020-01-01', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const tenants = (data.value || []).map((t) => ({ tenantId: t.tenantId, displayName: t.displayName || t.tenantId }));
    res.json({ tenants });
  } catch (err) {
    if (err && (err.name === 'InteractionRequiredAuthError' || err.errorCode === 'no_tokens_found')) {
      return res.status(401).json({ error: 'reauth_required' });
    }
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
    if (err && (err.name === 'InteractionRequiredAuthError' || err.errorCode === 'no_tokens_found')) {
      return res.status(401).json({ error: 'reauth_required' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/run', requireAuth, async (req, res) => {
  try {
    const { tenantId, subscriptionId } = req.body || {};
    if (!tenantId) return res.status(400).json({ error: 'tenantId_required' });
    
    const jobId = uuidv4();
    const jobDir = path.join(OUTPUTS_DIR, jobId);
    fs.mkdirSync(jobDir, { recursive: true });

    const logPath = path.join(jobDir, 'job.log');
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });

    const psExe = selectPowerShellExecutable();
    const scriptPath = path.join(__dirname, 'powershell', 'run-ari.ps1');

    const args = [
      '-File', scriptPath,
      '-TenantId', tenantId,
      '-SubscriptionId', subscriptionId || '',
      '-AppId', process.env.AZURE_CLIENT_ID,
      '-Secret', process.env.AZURE_CLIENT_SECRET,
      '-OutputDir', jobDir,
      '-ReportName', `AzureResourceInventory_Report_${new Date().toISOString().replace(/[:.]/g,'_')}.xlsx`,
      '-AzureEnvironment', AZURE_ENVIRONMENT
    ];

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

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
