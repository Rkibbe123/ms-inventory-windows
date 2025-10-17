# Azure AD App Registration Setup for ARI

This document explains how to configure the Azure AD App Registration to fix the authentication error:

```
AADSTS650057: Invalid resource. The client has requested access to a resource which is not listed 
in the requested permissions in the client's application registration.
```

## Problem

The error occurs because the Azure AD app registration (App ID: `9795693b-67cd-4165-b8a0-793833081db6`) does not have the required API permissions to access Azure Resource Manager (`https://management.azure.com`).

## Solution

You need to add the **Azure Service Management API** permission to your Azure AD app registration.

### Step-by-Step Instructions

#### Option 1: Using Azure Portal

1. **Navigate to Azure Portal**
   - Go to https://portal.azure.com
   - Sign in with an account that has permissions to manage the app registration

2. **Open App Registrations**
   - Search for "App registrations" in the top search bar
   - Click on "App registrations"

3. **Find Your Application**
   - Search for your app: `ari-app-sp-20251015`
   - Or search by App ID: `9795693b-67cd-4165-b8a0-793833081db6`
   - Click on the application name

4. **Add API Permissions**
   - In the left menu, click **"API permissions"**
   - Click **"+ Add a permission"**
   - Select **"Azure Service Management"**
   - Select **"Delegated permissions"**
   - Check the box for **"user_impersonation"**
   - Click **"Add permissions"**

5. **Grant Admin Consent (if required)**
   - If your organization requires admin consent, click **"Grant admin consent for [Your Organization]"**
   - Click **"Yes"** to confirm

#### Option 2: Using Azure CLI

```bash
# Set variables
APP_ID="9795693b-67cd-4165-b8a0-793833081db6"
ARM_API_APP_ID="797f4846-ba00-4fd7-ba43-dac1f8f63013"  # Azure Service Management API ID
ARM_SCOPE_ID="41094075-9dad-400e-a0bd-54e686782033"    # user_impersonation scope

# Add the required permission
az ad app permission add \
  --id $APP_ID \
  --api $ARM_API_APP_ID \
  --api-permissions ${ARM_SCOPE_ID}=Scope

# Grant admin consent (if you have permission)
az ad app permission grant \
  --id $APP_ID \
  --api $ARM_API_APP_ID \
  --scope user_impersonation

# If you're a Global Admin, you can also run:
az ad app permission admin-consent --id $APP_ID
```

#### Option 3: Using PowerShell

```powershell
# Install the Microsoft Graph PowerShell module if not already installed
# Install-Module Microsoft.Graph -Scope CurrentUser

# Connect to Microsoft Graph
Connect-MgGraph -Scopes "Application.ReadWrite.All"

# Set variables
$appId = "9795693b-67cd-4165-b8a0-793833081db6"
$armApiId = "797f4846-ba00-4fd7-ba43-dac1f8f63013"  # Azure Service Management
$scopeId = "41094075-9dad-400e-a0bd-54e686782033"    # user_impersonation

# Get the application
$app = Get-MgApplication -Filter "appId eq '$appId'"

# Add the required permission
$requiredResourceAccess = @{
    ResourceAppId = $armApiId
    ResourceAccess = @(
        @{
            Id = $scopeId
            Type = "Scope"
        }
    )
}

# Update the application with the new permission
Update-MgApplication -ApplicationId $app.Id -RequiredResourceAccess $requiredResourceAccess

Write-Host "Permission added successfully. You may need to grant admin consent in the Azure Portal."
```

## Verification

After adding the permissions, verify they are correctly configured:

### In Azure Portal

1. Go to your app registration
2. Click **"API permissions"**
3. You should see:
   - **Azure Service Management** (or **user_impersonation**)
   - Status: Granted for [Your Organization] (if admin consent was granted)

### Expected Permissions

Your app should have at least these permissions:

| API / Permissions name | Type | Admin consent required | Status |
|------------------------|------|------------------------|--------|
| Azure Service Management / user_impersonation | Delegated | No | Granted |
| Microsoft Graph / User.Read | Delegated | No | Granted |

## Testing

After configuring the permissions:

1. Clear your browser cache and cookies
2. Navigate to your application URL
3. Enter your Tenant ID on the login page
4. Click "Sign in with Microsoft"
5. You should now be able to authenticate successfully

## Troubleshooting

### Still Getting AADSTS650057 Error?

1. **Wait a few minutes**: Permission changes can take up to 5 minutes to propagate
2. **Clear token cache**: Sign out and clear browser cookies
3. **Check admin consent**: Some organizations require admin consent for Azure Management API
4. **Verify the correct app**: Ensure you're modifying the correct app registration (ID: `9795693b-67cd-4165-b8a0-793833081db6`)

### Cannot Add Permissions?

You need one of these roles to add API permissions:
- Application Administrator
- Cloud Application Administrator
- Global Administrator

### Need Admin Consent?

If you see "Admin consent required" but cannot grant it yourself:
1. Contact your Azure AD administrator
2. Provide them with this documentation
3. They need to grant consent via Azure Portal or PowerShell

## Additional Resources

- [Microsoft Documentation: API permissions](https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-configure-app-access-web-apis)
- [Azure Service Management API Reference](https://learn.microsoft.com/en-us/rest/api/azure/)
- [Troubleshoot permission errors](https://learn.microsoft.com/en-us/azure/active-directory/develop/reference-aad-error-codes)

## Changes Made to Application Code

The following changes were made to support tenant-specific authentication:

1. **Updated `public/index.html`**:
   - Added tenant ID input field on login page
   - Users can now specify their tenant ID before authentication
   - Defaults to "common" for multi-tenant scenarios

2. **Updated `server.js`**:
   - Modified authentication flow to use tenant-specific authority
   - Changed scopes from `https://management.azure.com/.default` to `https://management.azure.com/user_impersonation`
   - Caches MSAL Confidential Client Application instances per tenant

These changes ensure that:
- Authentication requests include the correct tenant context
- The proper delegated permissions are requested
- Token acquisition is scoped correctly for Azure Resource Manager access
