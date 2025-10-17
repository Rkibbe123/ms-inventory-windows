# Fix AADSTS500113 Error - No Reply Address Registered

## Error Message
```
Sorry, but we're having trouble signing you in.
AADSTS500113: No reply address is registered for the application.
```

## What This Means

Azure AD doesn't know where to send users after they authenticate. You need to register redirect URIs (reply URLs) in your Azure AD app registration.

## Quick Fix (One Command!)

### Windows PowerShell
```powershell
.\setup-azure-ad.ps1
```

### Linux/macOS
```bash
./setup-azure-ad.sh
```

This will automatically:
1. ✅ Add redirect URIs for development (localhost:3000, localhost:8000)
2. ✅ Add required API permissions
3. ✅ Grant admin consent

## Manual Fix (If Scripts Don't Work)

### Step 1: Go to Azure Portal
1. Open https://portal.azure.com
2. Navigate to **Azure Active Directory**
3. Click **App registrations**
4. Search for your app ID: `9795693b-67cd-4165-b8a0-793833081db6`

### Step 2: Add Redirect URIs
1. Click on the application
2. Click **Authentication** in the left menu
3. Under **Platform configurations**, click **Add a platform**
4. Select **Web**
5. Add these redirect URIs:
   - `http://localhost:3000/auth/redirect`
   - `http://localhost:8000/getAToken`
6. Click **Configure**

### Step 3: Verify
1. You should see the URIs listed under **Web** platform
2. Click **Save** if needed

## What Are Redirect URIs?

Redirect URIs are where Azure AD sends the user after successful authentication:

- **Node.js Express (server.js)**: Uses `/auth/redirect`
  - Development: `http://localhost:3000/auth/redirect`
  
- **Flask (frontend/app.py)**: Uses `/getAToken`
  - Development: `http://localhost:8000/getAToken`

## Production Deployment

If deploying to production, add your production URLs too:

```powershell
# PowerShell
.\setup-azure-ad.ps1 -ProductionUrl "https://your-app.azurewebsites.net"

# Bash
./setup-azure-ad.sh "" "https://your-app.azurewebsites.net"
```

Or manually add:
- `https://your-domain.com/auth/redirect`
- `https://your-domain.com/getAToken`

## Test the Fix

1. Run the setup script (see Quick Fix above)
2. Start your application:
   ```bash
   node server.js
   # OR
   cd frontend && python app.py
   ```
3. Open the app in your browser
4. Enter your tenant ID
5. Click "Sign in with Microsoft"
6. **You should no longer see the AADSTS500113 error!**

## Troubleshooting

### Still Getting the Error?

**Check redirect URIs match exactly:**
1. Look at the URL in your browser when the error occurs
2. The redirect URI in the URL must match what's registered
3. Make sure there are no trailing slashes or case differences

**Common mismatches:**
- ❌ `http://localhost:3000/auth/redirect/` (extra slash)
- ✅ `http://localhost:3000/auth/redirect` (correct)

### Script Fails?

If the automated script fails:
1. Make sure Azure CLI is installed: https://aka.ms/installazurecliwindows
2. Make sure you're logged in: `az login`
3. Use the manual method above

### Can't Access Azure Portal?

Ask your Azure AD administrator to:
1. Add the redirect URIs listed above
2. Share these instructions: [REDIRECT_URI_GUIDE.md](./REDIRECT_URI_GUIDE.md)

## Next Error You Might See

After fixing this error, you might encounter:
```
AADSTS650057: Invalid resource
```

**Don't worry!** The setup script already configured this too. If you still see it, run:
```powershell
.\add-api-permissions.ps1 -GrantAdminConsent
```

## Documentation

- 📖 **This error**: You're reading it!
- 📖 **Complete guide**: [QUICK_START_GUIDE.md](./QUICK_START_GUIDE.md)
- 📖 **Redirect URI details**: [REDIRECT_URI_GUIDE.md](./REDIRECT_URI_GUIDE.md)
- 📖 **Full setup**: [AZURE_AD_SETUP.md](./AZURE_AD_SETUP.md)

## Direct Links

- **Azure Portal - Your App**: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Authentication/appId/9795693b-67cd-4165-b8a0-793833081db6
- **Install Azure CLI**: https://aka.ms/installazurecliwindows

## Summary

🎯 **Run this command:**
```powershell
.\setup-azure-ad.ps1
```

✅ **Then test login** - Error should be gone!

That's it! The setup script handles everything automatically.
