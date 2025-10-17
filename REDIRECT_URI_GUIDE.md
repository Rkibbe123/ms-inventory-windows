# Redirect URI Configuration Guide

## What is a Redirect URI?

A Redirect URI (also called Reply URL) is where Azure AD sends the user after successful authentication. It must be registered in your Azure AD app registration.

## Error: AADSTS500113

If you see this error:
```
AADSTS500113: No reply address is registered for the application.
```

It means your app's redirect URI is not registered in Azure AD.

## Quick Fix

### Automated Script (Recommended)

**Windows PowerShell:**
```powershell
.\add-redirect-uris.ps1
```

**Linux/macOS:**
```bash
./add-redirect-uris.sh
```

### Manual Configuration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Find app: `9795693b-67cd-4165-b8a0-793833081db6`
4. Click **Authentication**
5. Under **Platform configurations** → **Web**, add:
   - `http://localhost:3000/auth/redirect`
   - `http://localhost:8000/getAToken`
6. Click **Save**

## Redirect URIs by Application Type

### Node.js Express Server (server.js)
- **Development:** `http://localhost:3000/auth/redirect`
- **Production:** `https://your-domain.com/auth/redirect`

### Flask Server (frontend/app.py)
- **Development:** `http://localhost:8000/getAToken`
- **Production:** `https://your-domain.com/getAToken`

## How the Redirect URI is Determined

### Node.js (server.js)
The application auto-detects the redirect URI:
```javascript
function buildRedirectUri(req) {
  const configured = process.env.REDIRECT_URI;
  if (configured) return configured;
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}/auth/redirect`;
}
```

**To override:** Set `REDIRECT_URI` in `.env`:
```env
REDIRECT_URI=https://your-domain.com/auth/redirect
```

### Flask (frontend/app.py)
Uses Flask's `url_for()` to generate the URI:
```python
redirect_uri=url_for("authorized", _external=True)
```

This automatically generates the correct URI based on the request.

## Common Redirect URIs to Add

### Development
```
http://localhost:3000/auth/redirect
http://localhost:5000/auth/redirect
http://localhost:8000/getAToken
http://127.0.0.1:3000/auth/redirect
```

### Production (Azure App Service)
```
https://your-app.azurewebsites.net/auth/redirect
https://your-app.azurewebsites.net/getAToken
```

### Production (Custom Domain)
```
https://your-domain.com/auth/redirect
https://your-domain.com/getAToken
```

## Adding Redirect URIs

### Method 1: Using the Provided Script

**PowerShell:**
```powershell
# Add common development URIs
.\add-redirect-uris.ps1

# Add production URI
.\add-redirect-uris.ps1 -BaseUrl "https://myapp.azurewebsites.net"
```

**Bash:**
```bash
# Add common development URIs
./add-redirect-uris.sh

# Add production URI
./add-redirect-uris.sh "" "https://myapp.azurewebsites.net"
```

### Method 2: Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. **Azure Active Directory** → **App registrations**
3. Find your app: `9795693b-67cd-4165-b8a0-793833081db6`
4. Click **Authentication**
5. Under **Web** platform:
   - Click **Add URI**
   - Enter the redirect URI
   - Click **Save**
6. Repeat for each URI you need

### Method 3: Azure CLI

```bash
APP_ID="9795693b-67cd-4165-b8a0-793833081db6"

# Set multiple redirect URIs
az ad app update --id $APP_ID --web-redirect-uris \
  "http://localhost:3000/auth/redirect" \
  "http://localhost:8000/getAToken" \
  "https://myapp.azurewebsites.net/auth/redirect"
```

### Method 4: PowerShell with AzureAD Module

```powershell
# Connect to Azure AD
Connect-AzureAD

$AppId = "9795693b-67cd-4165-b8a0-793833081db6"
$App = Get-AzureADApplication -Filter "appId eq '$AppId'"

# Get current redirect URIs
$replyUrls = $App.ReplyUrls

# Add new URI
$replyUrls += "http://localhost:3000/auth/redirect"
$replyUrls += "http://localhost:8000/getAToken"

# Update application
Set-AzureADApplication -ObjectId $App.ObjectId -ReplyUrls $replyUrls
```

## Wildcard URIs (Not Recommended)

Azure AD does **NOT** support wildcard redirect URIs like:
- ❌ `http://*.localhost:3000/auth/redirect`
- ❌ `https://*.azurewebsites.net/auth/redirect`

You must register each exact URI.

## Security Considerations

### Use HTTPS in Production
Always use HTTPS for production redirect URIs:
- ✅ `https://your-app.com/auth/redirect`
- ❌ `http://your-app.com/auth/redirect`

### Localhost for Development Only
Only use `http://localhost` URIs for local development:
- ✅ `http://localhost:3000/auth/redirect` (dev only)
- ❌ `http://192.168.1.100:3000/auth/redirect` (not allowed)

### Single Page Applications (SPA)
If you're building a SPA, use the **Single-page application** platform type instead of **Web**.

## Troubleshooting

### Error: "The reply URL specified in the request does not match"

**Problem:** The redirect URI in your code doesn't match what's registered.

**Solution:**
1. Check what URI your app is using (look at the error details)
2. Add that exact URI to your app registration
3. Make sure there are no trailing slashes or case mismatches

### Can't Add Redirect URI

**Problem:** Azure Portal doesn't let you add the URI.

**Possible Causes:**
- The URI format is invalid
- You don't have permission to modify the app registration
- The URI is a wildcard (not supported)

**Solution:**
- Verify URI format: `http://host:port/path` or `https://host/path`
- Ask an Azure AD administrator to add it
- Use exact URIs, not wildcards

### Wrong Redirect URI Being Used

**Problem:** App is using a different URI than expected.

**Solution for Node.js:**
Set `REDIRECT_URI` in `.env`:
```env
REDIRECT_URI=http://localhost:3000/auth/redirect
```

**Solution for Flask:**
Make sure `SERVER_NAME` is not set incorrectly, or set the environment to properly detect the host.

## Verification

After adding redirect URIs, verify:

### Via Azure Portal
1. Go to your app registration
2. Click **Authentication**
3. Check that your URIs are listed under **Web** platform

### Via Azure CLI
```bash
az ad app show --id 9795693b-67cd-4165-b8a0-793833081db6 --query "web.redirectUris"
```

### Test Authentication
1. Start your application
2. Try to log in
3. Should no longer see AADSTS500113 error

## Reference

- App ID: `9795693b-67cd-4165-b8a0-793833081db6`
- Direct link to Authentication settings: `https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Authentication/appId/9795693b-67cd-4165-b8a0-793833081db6`

## Summary

✅ **Add redirect URIs to your Azure AD app registration**
✅ **Use the provided scripts for quick setup**
✅ **Add both development and production URIs**
✅ **Always use HTTPS for production**
✅ **Verify URIs match exactly (no trailing slashes)**

After configuring redirect URIs, proceed with [API permissions setup](./AZURE_AD_SETUP.md).
