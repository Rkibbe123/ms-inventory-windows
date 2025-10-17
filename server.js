// ...existing code...
// ...existing code...
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

function looksLikeSecretId(secret) {
  if (!secret || typeof secret !== 'string') return false;
  const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const trimmed = secret.trim();
  const looksLikeGuid = guidRegex.test(trimmed);
  const suspiciouslyShort = trimmed.length <= 36; // Secret values are typically longer than a GUID
  return looksLikeGuid || suspiciouslyShort;
}

function logSuspiciousSecretWarning(clientSecret) {
  if (looksLikeSecretId(clientSecret)) {
    console.warn('[WARN] AZURE_CLIENT_SECRET looks like a Secret ID (GUID) or is very short.');
    console.warn('       Use the client secret VALUE, not the Secret ID.');
    console.warn('       Azure Portal → App registrations → Your App → Certificates & secrets → copy the Value column.');
  }
}

function isInvalidClientSecretError(err) {
  const message = (err && (err.errorMessage || err.message || '')) || '';
  return /AADSTS7000215/i.test(message) || (/invalid_client/i.test(message) && /secret/i.test(message));
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInvalidClientSecretHelp(err) {
  const appId = process.env.AZURE_CLIENT_ID || 'your-app-id';
  const portalAuthLink = `https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Authentication/appId/${appId}`;
  const portalSecretsLink = `https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Credentials/appId/${appId}`;
  const details = (err && (err.errorMessage || err.message)) || '';
  return (
    '<!doctype html>' +
    '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Invalid client secret</title>' +
    '<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu;max-width:900px;margin:40px auto;padding:0 16px;color:#222} code,pre{background:#f6f8fa;padding:2px 6px;border-radius:4px} .card{border:1px solid #e5e7eb;border-radius:8px;padding:24px} .hint{background:#fff8f0;border:1px solid #fde3c5;padding:12px;border-radius:6px} a{color:#2563eb;text-decoration:none} a:hover{text-decoration:underline}</style>' +
    '</head><body>' +
    '<h1>Azure AD configuration error: Invalid client secret</h1>' +
    '<p>The client secret configured for this app is invalid. This commonly happens when the <strong>Secret ID</strong> (a GUID) is used instead of the <strong>secret value</strong>.</p>' +
    '<div class="card">' +
    '<h3>How to fix</h3>' +
    '<ol>' +
    '<li>Open Azure Portal → Azure Active Directory → App registrations → your app.</li>' +
    `<li>Go to <a target="_blank" rel="noopener" href="${portalSecretsLink}">Certificates & secrets</a> and create a new client secret if needed.</li>` +
    '<li>Copy the <strong>Value</strong> (not the Secret ID) of the secret.</li>' +
    '<li>Set environment variable <code>AZURE_CLIENT_SECRET</code> to that value and restart the app.</li>' +
    '</ol>' +
    `<p>Double‑check <a target="_blank" rel="noopener" href="${portalAuthLink}">Authentication settings</a> are correct as well.</p>` +
    '<div class="hint"><strong>Tip:</strong> Secret values are typically long strings and may contain <code>~</code>. Secret IDs look like GUIDs (e.g., <code>xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</code>).</div>' +
    (details ? `<h3 style="margin-top:24px">Original error</h3><pre>${escapeHtml(details)}</pre>` : '') +
    '<p style="margin-top:24px"><a href="/auth/login">Try again</a></p>' +
    '</div>' +
    '</body></html>'
  );
}

function getCca() {
  if (cca) return cca;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('AZURE_CLIENT_ID and AZURE_CLIENT_SECRET must be configured');
  }
  logSuspiciousSecretWarning(clientSecret);
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
    if (req.session && req.session.account) return req.session.account;
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
  // Debug: log session state
  console.log('[DEBUG] Session:', req.session);
  if (!req.session || !req.session.homeAccountId) {
    console.log('[DEBUG] Not authenticated, redirecting to login.');
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
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
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
    
    // Build CCA with specific tenant
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('AZURE_CLIENT_ID and AZURE_CLIENT_SECRET must be configured');
    }
    
    const tenantCca = new msal.ConfidentialClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        clientSecret
      },
      system: { loggerOptions: { loggerCallback: () => {} } }
    });
    
    const redirectUri = buildRedirectUri(req);
    const authCodeUrlParameters = {
      scopes: ['https://management.azure.com/.default', 'openid', 'profile', 'offline_access'],
      redirectUri,
      prompt: 'consent'
    };
    const authCodeUrl = await tenantCca.getAuthCodeUrl(authCodeUrlParameters);
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
    // Build CCA with the same tenant used for login
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    // ...existing code...
  } catch (err) {
    res.status(500).send(`Auth redirect error: ${err && err.message ? err.message : 'Unknown error'}`);
  }
});

// Jobs status endpoint
app.get('/api/jobs/:id/status', requireAuth, (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'job_not_found' });
  const files = fs.existsSync(job.outputDir)
    ? fs.readdirSync(job.outputDir).filter((name) => fs.statSync(path.join(job.outputDir, name)).isFile())
    : [];
  return res.json({ id: req.params.id, status: job.status || 'unknown', files });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (${NODE_ENV})`);
});
