## Azure App Service frontend for Invoke-ARI (Windows)

This adds a minimal Node.js + MSAL frontend that:

- Signs in users with Microsoft Entra ID (authorization code flow)
- Lists tenants and subscriptions via ARM
- Runs `Invoke-ARI` under PowerShell on Windows App Service
- Stores outputs under `outputs/` and optionally uploads to Azure Blob Storage

### Project layout

```
package.json
server.js
public/index.html
powershell/run-ari.ps1
web.config
```

### App registration (Azure AD)

1) Create a Web app registration.
- Redirect URI: `https://<yourapp>.azurewebsites.net/auth/redirect`
- Implicit disabled; use standard Authorization Code Flow with PKCE.
- Expose no custom API scopes (not needed).

2) Grant ARM delegated permissions (default `.default` is used).

3) Create a client secret and capture its value.

### Configure App Service (Windows)

Set the following Application settings:
- `AZURE_CLIENT_ID`: your app registration client ID
- `AZURE_CLIENT_SECRET`: your client secret
- `AZURE_AUTHORITY`: optional, e.g. `https://login.microsoftonline.com/organizations` or a specific tenant ID
- `REDIRECT_URI`: optional override; default is `https://<host>/auth/redirect`
- `SESSION_SECRET`: random secret value
- `AZURE_STORAGE_CONNECTION_STRING` (optional): if set, outputs upload to the container below
- `OUTPUTS_CONTAINER` (optional): defaults to `ari-outputs`

General settings:
- Stack: Node 18+ (or latest)
- Platform: 64-bit
- Always On: On

### Deployment

Deploy the files at the repo root: `package.json`, `server.js`, `web.config`, `public/`, `powershell/`.

### Usage

1) Browse to the site and sign in.
2) Pick a tenant and optional subscription.
3) Run. The job log is streamed to `/api/jobs/<id>/log` and outputs appear under `/outputs/<id>/`.
4) If `AZURE_STORAGE_CONNECTION_STRING` is set, files are also uploaded to `https://<account>.blob.core.windows.net/<container>/<jobId>/`.

### Notes

- The PowerShell script uses `Connect-AzAccount -AccessToken` to reuse the delegated ARM token.
- `Invoke-ARI` receives `-TenantID` and optional `-SubscriptionID` and writes into the provided `-ReportDir`.
- Ensure App Service can reach `psgallery` and `nuget.org` to install modules on first run.
