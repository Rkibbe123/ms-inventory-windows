# Azure AD Application Setup Guide

## Error: AADSTS650057 - Invalid Resource

If you're encountering this error:
```
AADSTS650057: Invalid resource. The client has requested access to a resource which is not listed 
in the requested permissions in the client's application registration.
Resource value from request: https://management.azure.com
```

This means your Azure AD application registration needs to be configured with the proper API permissions.

## Required API Permissions

Your Azure AD application (App ID: `9795693b-67cd-4165-b8a0-793833081db6`) needs the following API permissions:

### 1. Azure Resource Manager (management.azure.com)
- **API**: Azure Service Management
- **Permission**: user_impersonation (Delegated)
- **Description**: Access Azure Service Management as organization users

## Steps to Add API Permissions

### Option 1: Using Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Find your application by searching for App ID: `9795693b-67cd-4165-b8a0-793833081db6`
4. Click on the application name
5. In the left menu, click **API permissions**
6. Click **+ Add a permission**
7. Select **Azure Service Management**
8. Select **Delegated permissions**
9. Check **user_impersonation**
10. Click **Add permissions**
11. Click **Grant admin consent for [Your Organization]** (if you have admin rights)

### Option 2: Using Azure CLI

```bash
# Login to Azure
az login

# Set the app ID
APP_ID="9795693b-67cd-4165-b8a0-793833081db6"

# Azure Service Management API App ID (this is constant)
ARM_API_ID="797f4846-ba00-4fd7-ba43-dac1f8f63013"

# user_impersonation permission ID for Azure Service Management
PERMISSION_ID="41094075-9dad-400e-a0bd-54e686782033"

# Add the required API permission
az ad app permission add \
  --id $APP_ID \
  --api $ARM_API_ID \
  --api-permissions $PERMISSION_ID=Scope

# Grant admin consent (requires admin privileges)
az ad app permission admin-consent --id $APP_ID
```

### Option 3: Using PowerShell

```powershell
# Connect to Azure AD
Connect-AzureAD

# Set variables
$AppId = "9795693b-67cd-4165-b8a0-793833081db6"
$ArmApiId = "797f4846-ba00-4fd7-ba43-dac1f8f63013"  # Azure Service Management
$PermissionId = "41094075-9dad-400e-a0bd-54e686782033"  # user_impersonation

# Get the service principal
$sp = Get-AzureADServicePrincipal -Filter "appId eq '$AppId'"

# Get ARM service principal
$armSp = Get-AzureADServicePrincipal -Filter "appId eq '$ArmApiId'"

# Add required resource access
$resourceAccess = New-Object Microsoft.Open.AzureAD.Model.RequiredResourceAccess
$resourceAccess.ResourceAppId = $ArmApiId
$resourceAccess.ResourceAccess = New-Object System.Collections.Generic.List[Microsoft.Open.AzureAD.Model.ResourceAccess]

$permission = New-Object Microsoft.Open.AzureAD.Model.ResourceAccess
$permission.Id = $PermissionId
$permission.Type = "Scope"  # Delegated permission
$resourceAccess.ResourceAccess.Add($permission)

# Update application
Set-AzureADApplication -ObjectId $sp.ObjectId -RequiredResourceAccess $resourceAccess
```

## Verification

After adding the permissions, verify they were added correctly:

### Using Azure Portal
1. Go to your app registration
2. Click **API permissions**
3. You should see:
   - **Azure Service Management** with **user_impersonation** permission
   - Status should show "Granted for [Your Organization]"

### Using Azure CLI
```bash
az ad app permission list --id 9795693b-67cd-4165-b8a0-793833081db6
```

## Multi-Tenant Considerations

If your application needs to access resources across multiple tenants:

1. The user must have appropriate permissions in each tenant
2. The user will authenticate with their home tenant ID
3. After authentication, the application can request tokens for other tenants the user has access to
4. Each tenant administrator may need to consent to the application permissions

## Testing Authentication

After configuring the permissions, test the authentication:

1. Clear your browser cache and cookies
2. Go to the application login page
3. Enter your tenant ID (e.g., `ed9aa516-5358-4016-a8b2-b6ccb99142d0`)
4. Click "Sign in with Microsoft"
5. Complete the authentication flow
6. If prompted, grant consent to the permissions

## Common Issues

### Issue: "Admin consent required"
**Solution**: An administrator needs to grant admin consent for the API permissions in the Azure Portal.

### Issue: "AADSTS65001: The user or administrator has not consented"
**Solution**: Either grant admin consent, or have each user consent during their first login.

### Issue: "AADSTS50020: User account from identity provider does not exist in tenant"
**Solution**: Make sure you're using the correct tenant ID for the user's home tenant.

## Environment Configuration

Make sure your `.env` file is configured correctly:

```env
AZURE_CLIENT_ID=9795693b-67cd-4165-b8a0-793833081db6
AZURE_CLIENT_SECRET=<your-client-secret>
TENANT_ID=<your-primary-tenant-id>
```

Note: The application now accepts tenant ID at login, so users can authenticate with different tenants.

## Additional Resources

- [Azure AD App Registration Documentation](https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
- [Azure Service Management API](https://learn.microsoft.com/en-us/rest/api/azure/)
- [Delegated Permissions (Scopes)](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-permissions-and-consent)
- [Multi-tenant Applications](https://learn.microsoft.com/en-us/azure/active-directory/develop/howto-convert-app-to-be-multi-tenant)
