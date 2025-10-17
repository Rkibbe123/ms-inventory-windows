# Changes Summary - Tenant Selection at Login

## Overview

Fixed the Azure AD authentication error (AADSTS650057) and implemented tenant selection on the login page. Users now provide their tenant ID before authentication, allowing for proper tenant-specific authentication flow.

## Problem Statement

**Errors Encountered:**

1. **AADSTS500113: No reply address is registered**
```
AADSTS500113: No reply address is registered for the application.
```

2. **AADSTS650057: Invalid resource**
```
AADSTS650057: Invalid resource. The client has requested access to a resource which is not listed 
in the requested permissions in the client's application registration.
Client app ID: 9795693b-67cd-4165-b8a0-793833081db6
Resource value from request: https://management.azure.com
```

**Root Causes:**
1. Redirect URIs (reply URLs) not registered in Azure AD app
2. Azure AD app registration missing API permissions for Azure Resource Manager
3. Authentication flow using "common" authority instead of specific tenant
4. Tenant selection happening after authentication instead of before

## Changes Made

### 1. Updated Login Page (`public/index.html`)
**Before:**
- Simple "Sign in with Microsoft" button
- No tenant selection
- Used common authority

**After:**
- Added tenant ID input field with validation
- GUID format validation
- Saves tenant ID in localStorage for convenience
- Redirects to `/auth/login?tenant={tenantId}`

**Key Features:**
- Client-side GUID validation
- Auto-populate from localStorage
- Error messages for invalid input
- Enter key support

### 2. Modified Authentication Flow (`server.js`)

#### `/auth/login` Endpoint
**Before:**
```javascript
// Used common authority
authority: 'https://login.microsoftonline.com/common'
```

**After:**
```javascript
// Uses tenant-specific authority
const tenantId = req.query.tenant;
authority: `https://login.microsoftonline.com/${tenantId}`
```

**Changes:**
- Requires `tenant` query parameter
- Stores tenant in session
- Creates tenant-specific MSAL client
- Builds authorization URL with tenant authority

#### `/auth/redirect` Endpoint
**Before:**
- Used global CCA instance with common authority

**After:**
- Retrieves tenant from session
- Creates tenant-specific MSAL client
- Stores `primaryTenant` in session
- Cleans up temporary session data

### 3. Flask Frontend Updates (`frontend/app.py`, `frontend/templates/login.html`)

**Similar changes applied to Flask frontend:**
- Login page now includes tenant selection
- `/login` route handles tenant parameter
- OAuth callback uses tenant-specific authority
- Session stores primary tenant

### 4. Environment Configuration (`.env`)
- Added comments explaining tenant selection
- Documented required API permissions
- Clarified that TENANT_ID is now optional (users specify at login)

### 5. Documentation Created

#### `AZURE_AD_SETUP.md`
Comprehensive guide for configuring Azure AD app registration:
- Step-by-step permission setup
- Azure Portal instructions
- Azure CLI commands
- PowerShell scripts
- Troubleshooting guide

#### `README_AUTHENTICATION.md`
User-facing authentication documentation:
- How the authentication flow works
- User instructions
- Admin consent procedures
- Multi-tenant scenarios
- Security considerations
- Troubleshooting common errors

#### `CHANGES_SUMMARY.md` (this file)
Summary of all changes made

### 6. Helper Scripts

#### `setup-azure-ad.ps1` / `setup-azure-ad.sh`
**Complete setup script (recommended):**
- Configures both redirect URIs and API permissions
- One command to set up everything
- PowerShell and Bash versions

#### `add-redirect-uris.ps1` / `add-redirect-uris.sh`
Automated script to add redirect URIs:
- Adds common development URIs (localhost:3000, localhost:8000)
- Optional production URL support
- Uses Azure CLI
- Verification steps

#### `add-api-permissions.ps1` / `add-api-permissions.sh`
Automated script to add required API permissions:
- Uses Azure CLI
- Adds Azure Service Management permission
- Optional admin consent grant
- Verification steps

## Required Configuration

### 1. Redirect URIs (Reply URLs)

Your Azure AD app registration MUST have these redirect URIs configured:

**Development:**
- `http://localhost:3000/auth/redirect` (Node.js Express)
- `http://localhost:8000/getAToken` (Flask)

**Production:**
- `https://your-domain.com/auth/redirect`
- `https://your-domain.com/getAToken`

### 2. API Permissions

Your Azure AD app registration MUST have:

**API:** Azure Service Management
- **Resource ID:** `797f4846-ba00-4fd7-ba43-dac1f8f63013`
- **Permission:** `user_impersonation` (Delegated)
- **Permission ID:** `41094075-9dad-400e-a0bd-54e686782033`

## How to Configure Azure AD App

### Complete Setup - One Command! (Recommended)

**PowerShell (Windows):**
```powershell
.\setup-azure-ad.ps1
# Or for production:
.\setup-azure-ad.ps1 -ProductionUrl "https://your-app.azurewebsites.net"
```

**Bash (Linux/macOS):**
```bash
./setup-azure-ad.sh
# Or for production:
./setup-azure-ad.sh "" "https://your-app.azurewebsites.net"
```

This configures both redirect URIs and API permissions!

### Manual Configuration

#### Step 1: Add Redirect URIs
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Search for App ID: `9795693b-67cd-4165-b8a0-793833081db6`
4. Click on **Authentication**
5. Add these redirect URIs under **Web** platform:
   - `http://localhost:3000/auth/redirect`
   - `http://localhost:8000/getAToken`
6. Click **Save**

#### Step 2: Add API Permissions
1. In the same app registration, click **API permissions**
2. Click **+ Add a permission**
3. Select **Azure Service Management**
4. Check **user_impersonation** under Delegated permissions
5. Click **Add permissions**
6. Click **Grant admin consent for [Your Organization]**

See `AZURE_AD_SETUP.md` and `REDIRECT_URI_GUIDE.md` for detailed instructions.

## Testing the Changes

### 1. Add API Permissions
Run the permission script or add permissions manually (see above).

### 2. Restart the Application
```bash
# Node.js version
node server.js

# OR Flask version
cd frontend
python app.py
```

### 3. Test Authentication Flow

1. Navigate to the application URL
2. You should see the updated login page with tenant ID field
3. Enter your tenant ID (e.g., `ed9aa516-5358-4016-a8b2-b6ccb99142d0`)
4. Click "Sign in with Microsoft"
5. Complete authentication in the Azure AD login page
6. You should be redirected back successfully

### 4. Verify Tenant Selection
After login, check that:
- You can see the tenant selection dropdown
- Subscriptions load correctly for the selected tenant
- You can run ARI reports

## Multi-Tenant Support

The application now properly supports multiple tenants:

### Home Tenant Authentication
Users authenticate with their home tenant ID (where their account was created).

### Cross-Tenant Access
After authentication:
1. Users can select any tenant they have access to
2. The application acquires tenant-specific tokens as needed
3. Works for both member and guest accounts

### Guest User Scenario
- Guest users must use their **home tenant ID** for login
- After login, they can access resources in tenants where they're guests
- Example: User from Tenant A authenticates with Tenant A, then accesses Tenant B resources

## Backward Compatibility

### Breaking Changes
⚠️ **Users must now provide tenant ID at login** - This is intentional and required for proper authentication.

### Configuration Changes
- `.env` file updated with comments
- `AZURE_AUTHORITY` is now optional (built dynamically)
- `TENANT_ID` serves as default/fallback only

## Security Improvements

1. **Tenant-Specific Authentication**: More secure than "common" authority
2. **Session Management**: Tenant ID stored in session
3. **Token Scoping**: Tokens properly scoped to specific tenants
4. **Input Validation**: Client-side GUID validation prevents errors

## Files Modified

### Core Application Files
- `public/index.html` - Login page with tenant selection
- `server.js` - Authentication flow with tenant support
- `frontend/app.py` - Flask authentication updates
- `frontend/templates/login.html` - Flask login page
- `.env` - Configuration updates

### Documentation Files (New)
- `AZURE_AD_SETUP.md` - Complete setup guide (redirect URIs + API permissions)
- `REDIRECT_URI_GUIDE.md` - Redirect URI configuration guide
- `README_AUTHENTICATION.md` - User authentication guide
- `CHANGES_SUMMARY.md` - This file
- `QUICK_START_GUIDE.md` - Quick reference guide

### Helper Scripts (New)
- `setup-azure-ad.ps1` / `setup-azure-ad.sh` - **Complete setup (recommended)**
- `add-redirect-uris.ps1` / `add-redirect-uris.sh` - Redirect URI configuration
- `add-api-permissions.ps1` / `add-api-permissions.sh` - API permissions configuration

## Next Steps

### For Administrators

1. ✅ **Configure Azure AD App** (Required)
   ```powershell
   # Complete setup (recommended)
   .\setup-azure-ad.ps1
   
   # Or configure separately:
   .\add-redirect-uris.ps1
   .\add-api-permissions.ps1 -GrantAdminConsent
   ```

2. ✅ **Verify Permissions**
   - Check Azure Portal → App registrations → API permissions
   - Confirm "Azure Service Management" is listed
   - Confirm status shows "Granted"

3. ✅ **Test Authentication**
   - Test with your tenant ID
   - Verify successful login
   - Check token acquisition works

4. 📋 **Communicate to Users**
   - Share the application URL
   - Provide instructions on finding tenant ID
   - Share `README_AUTHENTICATION.md` for reference

### For Users

1. 📝 **Find Your Tenant ID**
   - Azure Portal → Azure Active Directory → Overview
   - Copy the "Tenant ID" value

2. 🔐 **Login**
   - Go to the application
   - Enter your tenant ID
   - Click "Sign in with Microsoft"
   - Complete authentication

3. ▶️ **Use the Application**
   - Select tenant and subscription
   - Run ARI reports
   - Download results

## Troubleshooting

### Error: AADSTS500113 - No reply address registered
**Solution:** Add redirect URIs to your app registration. Run `.\setup-azure-ad.ps1` or `.\add-redirect-uris.ps1`

### Error: AADSTS650057 - Invalid resource
**Solution:** Make sure API permissions are added and admin consent is granted. Run `.\setup-azure-ad.ps1` or `.\add-api-permissions.ps1 -GrantAdminConsent`

### Error: "Tenant ID is required"
**Solution:** The login page now requires tenant ID. Enter it before clicking sign in.

### Error: "Invalid Tenant ID format"
**Solution:** Ensure tenant ID is in GUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### Login works but can't access tenants/subscriptions
**Solution:** Verify the user has appropriate permissions in Azure (Reader role or higher).

## Support Resources

- **Quick Start**: See `QUICK_START_GUIDE.md`
- **Redirect URIs**: See `REDIRECT_URI_GUIDE.md`
- **Complete Setup**: See `AZURE_AD_SETUP.md`
- **Authentication Guide**: See `README_AUTHENTICATION.md`
- **Service Principal Verification**: See `verify-sp.md`
- **Microsoft Documentation**: [Azure AD App Registration](https://learn.microsoft.com/en-us/azure/active-directory/develop/)

## Summary

✅ **Fixed AADSTS500113 error** by providing scripts to add redirect URIs
✅ **Fixed AADSTS650057 error** by implementing proper API permissions
✅ **Added tenant selection** on login page before authentication  
✅ **Implemented tenant-specific authentication** using proper authority
✅ **Created comprehensive documentation** for setup and troubleshooting
✅ **Provided automated scripts** for complete Azure AD configuration
✅ **Updated both frontends** (Node.js and Flask) with consistent behavior
✅ **Improved security** with tenant-specific token scoping

The application now properly handles multi-tenant authentication with correct redirect URIs and API permissions!
