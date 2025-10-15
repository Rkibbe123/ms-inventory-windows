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

// Express app setup
const app = express();

// Global error logging middleware (logs all errors to console and returns 500)
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.stack || err);
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








// (API endpoints for tenants, subscriptions, run, jobs, etc. should be re-implemented to use only Easy Auth and Service Principal as needed)

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
