# Service Principal Verification Steps

## 1. Test Authentication
Run the test script:
```powershell
pwsh C:\git-personal\ms-inventory-windows\test-auth.ps1
```

## 2. Verify Service Principal Exists
Check if the service principal exists in your tenant:
```powershell
az ad sp show --id 9795693b-67cd-4165-b8a0-793833081db6
```

## 3. Check Tenant Access
Verify you can access the tenant:
```powershell
az account tenant list --query "[].{Name:displayName, TenantId:tenantId}"
```

## 4. Verify Current Azure CLI Context
```powershell
az account show
```

## 5. If Service Principal is in a Different Tenant
If your service principal is registered in a different tenant, you need to:

### Option A: Update the tenant ID in `.env`
Find the correct tenant where your service principal exists:
```powershell
az login
az account tenant list
```

Then update `.env` with the correct tenant ID.

### Option B: Create a new service principal in the current tenant
```powershell
# Set the tenant
az account set --tenant ed9aa516-5358-4016-a8b2-b6ccb99142d0

# Create new service principal
az ad sp create-for-rbac --name "ari-inventory-sp" --role Reader --scopes /subscriptions/d5736eb1-f851-4ec3-a2c5-ac8d84d029e2
```

This will output:
```json
{
  "appId": "xxx",          # Use as AZURE_CLIENT_ID
  "password": "xxx",       # Use as AZURE_CLIENT_SECRET
  "tenant": "xxx"          # Verify matches TENANT_ID
}
```

## 6. Test the Connection Directly
```powershell
$TenantId = "ed9aa516-5358-4016-a8b2-b6ccb99142d0"
$AppId = "9795693b-67cd-4165-b8a0-793833081db6"
$Secret = "6sX8Q~pAgeSpU4~OTHn_YNn-W2YalkWYOTrSdaJ"

$SecurePassword = ConvertTo-SecureString -String $Secret -AsPlainText -Force
$Credential = New-Object System.Management.Automation.PSCredential($AppId, $SecurePassword)
Connect-AzAccount -ServicePrincipal -TenantId $TenantId -Credential $Credential
```

## Common Issues

### Issue: "Could not find tenant id for provided tenant domain"
- **Cause**: Service principal doesn't exist in the specified tenant
- **Solution**: Verify the service principal exists in tenant `ed9aa516-5358-4016-a8b2-b6ccb99142d0`

### Issue: "Client secret has expired"
- **Cause**: The secret in `.env` is expired
- **Solution**: Generate a new secret in Azure Portal → App Registrations → Your App → Certificates & secrets

### Issue: "Insufficient privileges"
- **Cause**: Service principal lacks permissions
- **Solution**: Grant Reader or Contributor role at subscription level
