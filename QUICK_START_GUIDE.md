# Quick Start Guide - Fixed Authentication

## What Was Fixed

✅ **Tenant Selection on Login Page** - Users now enter their tenant ID before signing in  
✅ **Tenant-Specific Authentication** - Uses the correct Azure AD tenant authority  
✅ **Redirect URIs Configuration** - Scripts to add reply URLs
✅ **API Permissions Documentation** - Complete guide for setting up Azure AD app  
✅ **Helper Scripts** - Automated scripts to configure everything  

## What You Need to Do Now

### Option A: Complete Setup (Recommended - One Command!)

**Windows PowerShell:**
```powershell
.\setup-azure-ad.ps1
# Or for production:
.\setup-azure-ad.ps1 -ProductionUrl "https://your-app.azurewebsites.net"
```

**Linux/macOS:**
```bash
./setup-azure-ad.sh
# Or for production:
./setup-azure-ad.sh "" "https://your-app.azurewebsites.net"
```

This single command configures both redirect URIs and API permissions!

### Option B: Manual Step-by-Step

### Step 1: Add Redirect URIs (REQUIRED - Do This First!)

Your Azure AD app needs redirect URIs configured. Choose one method:

#### Option A: Automated Script (Recommended)

**Windows PowerShell:**
```powershell
.\add-redirect-uris.ps1
# Or for production:
.\add-redirect-uris.ps1 -BaseUrl "https://your-app.azurewebsites.net"
```

**Linux/macOS:**
```bash
./add-redirect-uris.sh
# Or for production:
./add-redirect-uris.sh "" "https://your-app.azurewebsites.net"
```

#### Option B: Manual (Azure Portal)

1. Go to https://portal.azure.com
2. Navigate to **Azure Active Directory** → **App registrations**
3. Search for App ID: `9795693b-67cd-4165-b8a0-793833081db6`
4. Click **Authentication** → **Add a platform** → **Web**
5. Add these redirect URIs:
   - `http://localhost:3000/auth/redirect` (Node.js dev)
   - `http://localhost:8000/getAToken` (Flask dev)
   - Your production URL + `/auth/redirect` (if deploying)
6. Click **Configure**

### Step 2: Add API Permissions (REQUIRED)

Your Azure AD app is missing the required API permission. Choose one method:

#### Option A: Automated Script (Recommended)

**Windows PowerShell:**
```powershell
.\add-api-permissions.ps1 -GrantAdminConsent
```

**Linux/macOS:**
```bash
./add-api-permissions.sh --grant-consent
```

#### Option B: Manual (Azure Portal)

1. Go to https://portal.azure.com
2. Navigate to **Azure Active Directory** → **App registrations**
3. Search for App ID: `9795693b-67cd-4165-b8a0-793833081db6`
4. Click **API permissions** → **Add a permission**
5. Select **Azure Service Management**
6. Check **user_impersonation** (Delegated)
7. Click **Add permissions**
8. Click **Grant admin consent for [Your Organization]**

### Step 3: Test the Login

1. Start the application:
   ```bash
   node server.js
   # OR
   cd frontend && python app.py
   ```

2. Open in browser and test:
   - Enter your tenant ID: `ed9aa516-5358-4016-a8b2-b6ccb99142d0`
   - Click "Sign in with Microsoft"
   - Complete authentication
   - Should work without errors!

## How to Find Your Tenant ID

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory**
3. Click **Overview**
4. Copy the **Tenant ID** (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

## What Changed

### Login Page
**Before:** Simple button → "Sign in with Microsoft"  
**After:** Tenant ID input field + validation → "Sign in with Microsoft"

### Authentication Flow
**Before:** Used `/common` authority (multi-tenant)  
**After:** Uses `/[tenant-id]` authority (tenant-specific)

### Required Permissions
**Before:** Not configured  
**After:** Requires **Azure Service Management** → **user_impersonation**

## Files Changed

### Application Files
- ✏️ `public/index.html` - Added tenant selection
- ✏️ `server.js` - Tenant-specific authentication
- ✏️ `frontend/app.py` - Flask tenant support
- ✏️ `frontend/templates/login.html` - Flask login page
- ✏️ `.env` - Updated comments

### New Documentation
- 📄 `AZURE_AD_SETUP.md` - Complete API permissions guide
- 📄 `README_AUTHENTICATION.md` - User authentication guide
- 📄 `CHANGES_SUMMARY.md` - Detailed change log
- 📄 `QUICK_START_GUIDE.md` - This file

### New Helper Scripts
- 🔧 `add-api-permissions.ps1` - PowerShell permission script
- 🔧 `add-api-permissions.sh` - Bash permission script

## Troubleshooting

### Getting AADSTS7000215 - Invalid client secret?
👉 You're using the **Client Secret ID** instead of the **Client Secret Value**.  
📖 **Detailed Fix Guide:** [FIX_AADSTS7000215_ERROR.md](./FIX_AADSTS7000215_ERROR.md)

**Quick Fix:**
1. Go to Azure Portal → App registrations → Certificates & secrets
2. Create a new client secret
3. Copy the **Value** column (not the Secret ID!)
4. Update `.env`: `AZURE_CLIENT_SECRET=your-secret-value-here`
5. Restart the application

### Getting AADSTS500113 - No reply address registered?
👉 Make sure you completed **Step 1** (Add Redirect URIs).  
📖 **Detailed Fix Guide:** [FIX_AADSTS500113_ERROR.md](./FIX_AADSTS500113_ERROR.md)

### Still Getting AADSTS650057?
👉 Make sure you completed **Step 2** (Add API Permissions) and granted admin consent.

### Can't Find Tenant ID?
👉 Azure Portal → Azure Active Directory → Overview → Tenant ID

### Invalid Tenant ID Format?
👉 Must be a GUID: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### Error: "User account does not exist"?
👉 Use your **home tenant ID** (where your account was created), not a guest tenant.

## Documentation

- **API Permissions Setup**: [`AZURE_AD_SETUP.md`](./AZURE_AD_SETUP.md)
- **Authentication Guide**: [`README_AUTHENTICATION.md`](./README_AUTHENTICATION.md)
- **Complete Changes**: [`CHANGES_SUMMARY.md`](./CHANGES_SUMMARY.md)
- **Service Principal**: [`verify-sp.md`](./verify-sp.md)

## Support

If you need help:
1. Check the [troubleshooting section](#troubleshooting) above
2. Review [`AZURE_AD_SETUP.md`](./AZURE_AD_SETUP.md) for detailed instructions
3. Check the error message and compare with [`README_AUTHENTICATION.md`](./README_AUTHENTICATION.md)

## Summary

The authentication issue has been fixed! You just need to:
1. ✅ Add the required API permission (use the script)
2. ✅ Test the login with your tenant ID
3. ✅ Enjoy the application!

🎉 That's it! The app now properly handles tenant-specific authentication.
