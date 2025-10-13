# Quick Start Guide

Get your Azure Resource Inventory Web Frontend up and running in 15 minutes!

## Prerequisites Checklist

- [ ] Azure Subscription with Owner/Contributor access
- [ ] PowerShell 7.0+ installed
- [ ] Azure PowerShell module installed (`Install-Module -Name Az`)
- [ ] Logged into Azure (`Connect-AzAccount`)

## 5-Step Deployment

### Step 1: Create Azure AD App Registration (5 minutes)

1. Open [Azure Portal](https://portal.azure.com)
2. Navigate to: **Azure Active Directory** → **App registrations** → **New registration**
3. Fill in:
   - **Name**: `ARI-Web-Frontend`
   - **Supported account types**: `Accounts in any organizational directory (Any Azure AD directory - Multitenant)`
   - **Redirect URI**: Leave blank (we'll add it later)
4. Click **Register**
5. Copy the **Application (client) ID** - you'll need this!
6. Copy the **Directory (tenant) ID**
7. Go to **Certificates & secrets** → **New client secret**
   - Description: `ARI Frontend Secret`
   - Expires: Choose duration
   - Click **Add**
   - **IMPORTANT**: Copy the secret **VALUE** immediately (you won't see it again!)
8. Go to **API permissions** → **Add a permission**
   - Add **Microsoft Graph** → **Delegated** → `User.Read`
   - Add **Azure Service Management** → **Delegated** → `user_impersonation`
   - Click **Grant admin consent for [Your Org]**

✅ **You now have**:
- Application (Client) ID
- Client Secret
- Tenant ID

### Step 2: Prepare Deployment Variables (2 minutes)

Create a file called `deploy-vars.ps1`:

```powershell
# Your unique values
$ClientId = "YOUR_CLIENT_ID_HERE"
$ClientSecret = "YOUR_CLIENT_SECRET_HERE"

# Choose unique names (must be globally unique)
$WebAppName = "ari-web-$(Get-Random -Maximum 9999)"
$StorageAccountName = "aristorage$(Get-Random -Maximum 9999)"
$ResourceGroupName = "rg-ari-frontend"

# Azure settings
$Location = "eastus"  # or your preferred region
$Sku = "B2"  # or B1 for testing, S1/P1v2 for production
```

### Step 3: Run Deployment (5 minutes)

```powershell
# Load variables
. .\deploy-vars.ps1

# Run deployment
.\deploy-azure.ps1 `
    -ResourceGroupName $ResourceGroupName `
    -WebAppName $WebAppName `
    -StorageAccountName $StorageAccountName `
    -AzureClientId $ClientId `
    -AzureClientSecret $ClientSecret `
    -Location $Location `
    -Sku $Sku

# Save the output! The script will show:
# - Web App URL: https://YOUR-APP.azurewebsites.net
# - Redirect URI to configure
```

### Step 4: Configure Redirect URI (2 minutes)

After deployment completes, you'll see a redirect URI like:
```
https://ari-web-1234.azurewebsites.net/getAToken
```

1. Go back to Azure Portal → **Azure AD** → **App registrations** → Your app
2. Click **Authentication** → **Add a platform** → **Web**
3. Enter the redirect URI from the deployment output
4. Check **ID tokens** (under Implicit grant)
5. Click **Configure**

### Step 5: Test Your Application (1 minute)

1. Open your web app URL: `https://YOUR-APP.azurewebsites.net`
2. Click **Sign in with Microsoft**
3. Log in with your Azure credentials
4. Select a tenant and optionally a subscription
5. Click **Run Inventory**
6. Wait for completion (5-30 minutes depending on environment size)
7. Download your report!

## Troubleshooting

### "Unable to login" or "Redirect URI mismatch"
→ Double-check the redirect URI in Azure AD matches the one from deployment

### "PowerShell module not found"
→ SSH into the App Service and run: `pwsh -Command "Install-Module AzureResourceInventory -Force"`

### "Storage connection failed"
→ Verify storage account credentials in App Service Configuration

### "Execution timeout"
→ Increase timeout in app.py or use smaller scope (single subscription)

## What's Next?

### Configure for Production
1. **Enable Application Insights**: Monitor performance and errors
2. **Set up SSL Certificate**: Use a custom domain
3. **Configure Auto-scaling**: Handle more concurrent users
4. **Set up Alerts**: Get notified of failures
5. **Review Security**: Rotate secrets, enable MFA

### Customize
1. **Branding**: Update templates with your logo/colors
2. **Options**: Add more ARI parameters to the UI
3. **Scheduling**: Add automated runs
4. **Notifications**: Send email when reports are ready

### Scale
1. **Multiple Regions**: Deploy to additional regions
2. **Queue System**: Handle long-running jobs better
3. **Database**: Store report metadata
4. **CDN**: Serve static assets faster

## Architecture Overview

```
┌──────────────┐
│  Azure AD    │  ← Handles authentication
└──────┬───────┘
       │
┌──────▼────────────────┐
│  App Service (Python) │  ← Your web app
│  - Flask              │
│  - PowerShell Core    │
│  - ARI Module         │
└──────┬────────────────┘
       │
┌──────▼────────────────┐
│  Storage Account      │  ← Stores reports
│  - File Share         │
└───────────────────────┘
```

## Cost Breakdown

| Component | Size | Monthly Cost (USD) |
|-----------|------|-------------------|
| App Service B2 | 2 cores, 3.5GB | ~$75 |
| Storage (100GB) | Standard LRS | ~$2 |
| **Total** | | **~$77** |

💡 **Tip**: Use B1 ($13/month) for testing/development

## Security Best Practices

✅ **Always do**:
- Store secrets in Azure Key Vault
- Use HTTPS only (enabled by default)
- Enable Application Insights logging
- Rotate secrets every 90 days
- Use managed identities where possible

❌ **Never do**:
- Commit secrets to Git
- Use the same app registration for multiple environments
- Give broader permissions than needed
- Disable HTTPS
- Share credentials

## Getting Help

1. **Check logs**: App Service → Log stream
2. **Review docs**: See full README.md
3. **ARI issues**: https://github.com/microsoft/ARI/issues
4. **Azure support**: Portal → Help + support

## Example Use Cases

### Daily Environment Snapshots
Schedule daily runs to track changes in your Azure environment over time.

### Cost Analysis Baseline
Use reports to understand resource distribution and optimize costs.

### Compliance Reporting
Generate inventory reports for audit and compliance purposes.

### Migration Planning
Document current state before cloud migrations.

### Multi-Tenant Management
MSPs can generate reports for multiple customer tenants.

---

**🎉 Congratulations!** You now have a fully functional Azure Resource Inventory web frontend!

**Need help?** Review the full [README.md](README.md) for detailed documentation.
