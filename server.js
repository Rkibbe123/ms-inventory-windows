require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

// Log process exit and uncaught exceptions for debugging
const logPath = path.join(__dirname, 'log.txt');
process.on('exit', (code) => {
  const msg = `[${new Date().toISOString()}] Process exit with code ${code}`;
  try { fs.appendFileSync(logPath, msg + '\n'); } catch (e) {}
  console.log(msg);
});
process.on('uncaughtException', (err) => {
  const msg = `[${new Date().toISOString()}] Uncaught exception: ${err.stack || err}`;
  try { fs.appendFileSync(logPath, msg + '\n'); } catch (e) {}
  console.error(msg);
  process.exit(1);
});
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
  if (process.env.NODE_ENV !== 'production') {
    // Local/dev: inject fake user
    req.user = req.user || {
      claims: [
        { typ: 'name', val: 'Local Dev User' },
        { typ: 'preferred_username', val: 'local@localhost' },
        { typ: 'email', val: 'local@localhost' }
      ]
    };
    return next();
  }
  if (req.user) return next();
  // Not authenticated
  return res.redirect('/.auth/login/aad');
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


// Startup log to log.txt in app root
try {
  const logPath = path.join(__dirname, 'log.txt');
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] App startup\n`);
} catch (e) {
  // ignore
}

// Global uncaught exception handler
process.on('uncaughtException', (err) => {
  try {
    const logPath = path.join(__dirname, 'log.txt');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] Uncaught Exception: ${err.stack || err}\n`);
  } catch (e) {}
  process.exit(1);
});

const app = express();

// Global error logging middleware (logs all errors to console, log.txt, and returns 500)
app.use((err, req, res, next) => {
  const logPath = path.join(__dirname, 'log.txt');
  const msg = `[${new Date().toISOString()}] Global error handler: ${err.stack || err}`;
  try { fs.appendFileSync(logPath, msg + '\n'); } catch (e) {}
  console.error(msg);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});
app.set('trust proxy', 1);
app.use(cookieParser());
app.use(bodyParser.json());

// Easy Auth trust middleware: parse X-MS-CLIENT-PRINCIPAL and set req.user
app.use((req, res, next) => {
  const hdr = req.headers['x-ms-client-principal'];
  if (hdr) {
    const buf = Buffer.from(hdr, 'base64');
    try { req.user = JSON.parse(buf.toString('utf8')); } catch {}
  }
  next();
});

app.use('/outputs', express.static(OUTPUTS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// Logout endpoint (no session logic)
app.post('/auth/logout', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  if (req.user) {
    let name = null;
    if (Array.isArray(req.user.claims)) {
      const nameClaim = req.user.claims.find(c => c.typ === 'name');
      const usernameClaim = req.user.claims.find(c => c.typ === 'preferred_username');
      const emailClaim = req.user.claims.find(c => c.typ === 'email');
      name = nameClaim?.val || usernameClaim?.val || emailClaim?.val || null;
    }
    res.json({ ...req.user, name });
    return;
  }
  res.status(401).json({ error: 'Not authenticated' });
});









// Utility: log to log.txt in app root
function logIISNode(msg) {
  try {
    const logPath = path.join(__dirname, 'log.txt');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {
    // ignore
  }
}

// Service Principal ARM token acquisition
async function getServicePrincipalToken(tenantId) {
  const cca = getCca();
  const authority = `https://login.microsoftonline.com/${tenantId}`;
  const scopes = ['https://management.azure.com/.default'];
  const result = await cca.acquireTokenByClientCredential({ authority, scopes });
  return result.accessToken;
}

// GET /api/tenants - list tenants visible to the Service Principal
app.get('/api/tenants', requireAuth, async (req, res) => {
  logIISNode('GET /api/tenants called');
  try {
    // Use the "common" endpoint to list tenants
    const token = await getServicePrincipalToken('common');
    const { data } = await axios.get('https://management.azure.com/tenants?api-version=2020-01-01', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const tenants = (data.value || []).map((t) => ({ tenantId: t.tenantId, displayName: t.displayName || t.tenantId }));
    res.json({ tenants });
  } catch (err) {
    logIISNode('Error in /api/tenants: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/subscriptions?tenantId=... - list subscriptions for a tenant
app.get('/api/subscriptions', requireAuth, async (req, res) => {
  logIISNode('GET /api/subscriptions called');
  try {
    const { tenantId } = req.query;
    if (!tenantId) return res.status(400).json({ error: 'tenantId_required' });
    const token = await getServicePrincipalToken(tenantId);
    const { data } = await axios.get('https://management.azure.com/subscriptions?api-version=2021-01-01', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const subs = (data.value || []).map((s) => ({ subscriptionId: s.subscriptionId, displayName: s.displayName, state: s.state }));
    res.json({ subscriptions: subs });
  } catch (err) {
    logIISNode('Error in /api/subscriptions: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/run - start backend job (launch PowerShell, create job dir, log output)
app.post('/api/run', requireAuth, async (req, res) => {
  logIISNode('POST /api/run called');
  const { tenantId, subscriptionId } = req.body;
  // Log received arguments for debugging
  const argsLogPath = path.join(OUTPUTS_DIR, 'run-args.log');
  fs.appendFileSync(argsLogPath, `[${new Date().toISOString()}] Received tenantId: ${tenantId}, subscriptionId: ${subscriptionId}\n`);


  // Build PowerShell command and args for Invoke-ARI (declare scriptPath only once)
  const scriptPath = path.join(__dirname, 'powershell', 'run-ari.ps1');
  // jobDir is not available until after validation and creation

  // Validate arguments
  if (!tenantId || typeof tenantId !== 'string' || !tenantId.trim()) {
    logIISNode('ERROR: Missing or empty tenantId in /api/run');
    return res.status(400).json({ error: 'Missing or empty tenantId' });
  }
  if (!subscriptionId || typeof subscriptionId !== 'string' || !subscriptionId.trim()) {
    logIISNode('ERROR: Missing or empty subscriptionId in /api/run');
    return res.status(400).json({ error: 'Missing or empty subscriptionId' });
  }
  const jobId = uuidv4();
  const jobDir = path.join(OUTPUTS_DIR, jobId);
  try {
    fs.mkdirSync(jobDir, { recursive: true });
  } catch (err) {
    const logPath = path.join(jobDir, 'job.log');
    fs.appendFileSync(logPath, `[ERROR] Failed to create output directory: ${jobDir}\n${err.stack}\n`);
    return res.status(500).json({ error: `Failed to create output directory: ${jobDir}` });
  }
  // Now that jobDir is available, build args
  const args = [
    '-File', scriptPath,
    '-TenantId', tenantId,
    '-SubscriptionId', subscriptionId,
    '-AppId', process.env.AZURE_CLIENT_ID,
    '-Secret', process.env.AZURE_CLIENT_SECRET,
    '-OutputDir', jobDir,
    '-ReportName', `AzureResourceInventory_Report_${new Date().toISOString().replace(/[:.]/g,'_')}.xlsx`,
    '-AzureEnvironment', AZURE_ENVIRONMENT
  ];
  // Debug: log the PowerShell args array and values (after args is defined)
  const debugArgsLog = [
    `[DEBUG] About to spawn PowerShell with the following arguments:`,
    `args: ${JSON.stringify(args)}`,
    `tenantId: ${tenantId}`,
    `subscriptionId: ${subscriptionId}`
  ].join('\n');
  fs.appendFileSync(argsLogPath, debugArgsLog + '\n');
  const logPath = path.join(jobDir, 'job.log');
  const psExe = selectPowerShellExecutable();
  // Always use service principal credentials from .env
  const env = Object.assign({}, process.env, {
    AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
    AZURE_TENANT_ID: tenantId,
    AZURE_SUBSCRIPTION_ID: subscriptionId,
    OUTPUTS_DIR: jobDir
  });
  // Use previously defined scriptPath and args
  // Write job start and PowerShell command to job.log (after args is defined)
  fs.appendFileSync(logPath, `[INFO] Job started for jobId ${jobId} at ${new Date().toISOString()}\n`);
  fs.appendFileSync(logPath, `[INFO] PowerShell command: ${psExe} ${args.join(' ')}\n`);
  // Log environment variables (redact secrets)
  const redactedEnv = Object.assign({}, env, {
    AZURE_CLIENT_SECRET: env.AZURE_CLIENT_SECRET ? '***REDACTED***' : undefined
  });
  fs.appendFileSync(logPath, `[INFO] PowerShell ENV: ${JSON.stringify(redactedEnv, null, 2)}\n`);
  // Log before launching PowerShell
  fs.appendFileSync(logPath, `[INFO] Launching PowerShell process...\n`);
  let child;
  try {
    child = require('child_process').spawn(psExe, args, {
      env,
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (spawnErr) {
    fs.appendFileSync(logPath, `[ERROR] Failed to spawn PowerShell process: ${spawnErr.stack || spawnErr}\n`);
    return res.status(500).json({ error: 'Failed to launch PowerShell process', details: spawnErr.message });
  }
  jobs.set(jobId, { status: 'running', startedAt: new Date(), endedAt: null, logPath, child });
  // Stream output to log file
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);
  // Log errors from spawn (e.g., ENOENT, permission)
  child.on('error', (err) => {
    fs.appendFileSync(logPath, `[ERROR] PowerShell process error: ${err.stack || err}\n`);
  });
  child.on('exit', (code) => {
    const job = jobs.get(jobId);
    if (job) {
      job.status = code === 0 ? 'completed' : 'failed';
      job.endedAt = new Date();
    }
    logStream.write(`\n[INFO] PowerShell process exited with code ${code}\n`);
    // Log the expected Excel file path for debugging
    const expectedExcelFile = path.join(jobDir, `AzureResourceInventory_Report_${new Date().toISOString().replace(/[:.]/g,'_')}.xlsx`);
    logStream.write(`\n[INFO] Expected Excel file path: ${expectedExcelFile}\n`);
    logStream.end();
  });
  fs.appendFileSync(logPath, `[INFO] PowerShell process launched. Waiting for output...\n`);
  res.json({ jobId, status: 'running', outputsUrl: `/outputs/${jobId}/`, logUrl: `/api/jobs/${jobId}/log` });
});

// GET /api/jobs/:jobId/status - return job status
app.get('/api/jobs/:jobId/status', requireAuth, (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'job_not_found' });
  res.json({
    jobId,
    status: job.status,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    logPath: job.logPath,
    files: fs.existsSync(path.join(OUTPUTS_DIR, jobId)) ? fs.readdirSync(path.join(OUTPUTS_DIR, jobId)) : []
  });
});

// GET /api/jobs/:jobId/log - return job log
app.get('/api/jobs/:jobId/log', requireAuth, (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job || !fs.existsSync(job.logPath)) return res.status(404).send('Log not found');
  res.sendFile(job.logPath);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  const logPath = path.join(__dirname, 'log.txt');
  const msg = `[${new Date().toISOString()}] Server listening on port ${PORT}`;
  try { fs.appendFileSync(logPath, msg + '\n'); } catch (e) {}
  console.log(msg);
});
