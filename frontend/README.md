# Azure Resource Inventory (ARI) Web Frontend

A comprehensive web-based frontend for running [Azure Resource Inventory (ARI)](https://github.com/microsoft/ARI) with Azure AD authentication, tenant/subscription selection, and durable storage using Azure File Share.

## Features

- **Azure AD Authentication**: Secure login using Microsoft Identity Platform
- **Multi-Tenant Support**: Select from available Azure tenants
- **Subscription Selection**: Choose specific subscriptions or scan all subscriptions
- **Interactive UI**: Modern, responsive web interface built with Bootstrap 5
- **Durable Storage**: Reports automatically saved to Azure File Share
- **Report Management**: View, download, and manage generated reports
- **PowerShell Integration**: Seamlessly executes Invoke-ARI PowerShell module
- **Automated Deployment**: ARM templates for one-click Azure deployment

## Architecture

```
┌─────────────────┐
│  User Browser   │
└────────┬────────┘
         │
         ├─── Azure AD Authentication
         │
┌────────▼────────────┐
│   Flask Web App     │
│  (Azure App Service)│
│                     │
│  - Azure AD Login   │
│  - Tenant Selection │
│  - ARI Execution    │
└─────────┬───────────┘
          │
          ├──────────────────┐
          │                  │
┌─────────▼──────┐   ┌──────▼─────────────┐
│  PowerShell    │   │  Azure File Share  │
│  Invoke-ARI    │   │  (Report Storage)  │
└────────────────┘   └────────────────────┘
```

## Prerequisites

### For Azure Deployment

1. **Azure Subscription** with permissions to:
   - Create Resource Groups
   - Create App Services
   - Create Storage Accounts
   - Create Azure AD App Registrations

2. **Azure PowerShell Module**:
   ```powershell
   Install-Module -Name Az -Force -AllowClobber
   ```

3. **Azure AD App Registration**:
   - Create an App Registration in Azure AD
   - Note the Application (Client) ID
   - Create a Client Secret
   - Configure API Permissions:
     - Microsoft Graph: `User.Read`
     - Azure Service Management: `user_impersonation`

### For Local Development

1. **Python 3.9+**
2. **PowerShell 7.0+**
3. **Azure PowerShell Modules**:
   ```powershell
   Install-Module -Name Az.Accounts
   Install-Module -Name AzureResourceInventory
   ```

## Quick Start - Azure Deployment

### Step 1: Register Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com) > Azure Active Directory > App Registrations
2. Click "New registration"
3. Set a name (e.g., "ARI Web Frontend")
4. Select "Accounts in any organizational directory (Any Azure AD directory - Multitenant)"
5. Click "Register"
6. Note the **Application (Client) ID** and **Directory (Tenant) ID**
7. Go to "Certificates & secrets" > "New client secret"
8. Create a secret and **copy the value immediately**
9. Go to "API permissions":
   - Add "Microsoft Graph" > "Delegated" > "User.Read"
   - Add "Azure Service Management" > "Delegated" > "user_impersonation"
   - Grant admin consent if required

### Step 2: Deploy to Azure

Run the deployment script:

```powershell
.\deploy-azure.ps1 `
    -ResourceGroupName "rg-ari-frontend" `
    -WebAppName "ari-web-app-unique123" `
    -StorageAccountName "aristorage123" `
    -AzureClientId "YOUR_CLIENT_ID" `
    -AzureClientSecret "YOUR_CLIENT_SECRET" `
    -Location "eastus" `
    -Sku "B2"
```

**Parameters:**
- `ResourceGroupName`: Name for the resource group (will be created if it doesn't exist)
- `WebAppName`: Unique name for the web app (must be globally unique)
- `StorageAccountName`: Name for storage account (3-24 lowercase letters/numbers)
- `AzureClientId`: Application (Client) ID from Step 1
- `AzureClientSecret`: Client Secret from Step 1
- `Location`: Azure region (default: eastus)
- `Sku`: App Service plan SKU (default: B2)

### Step 3: Configure Redirect URI

After deployment, the script will provide a redirect URI. Add it to your Azure AD App Registration:

1. Go to Azure Portal > Azure AD > App Registrations > Your App
2. Go to "Authentication"
3. Click "Add a platform" > "Web"
4. Add the redirect URI: `https://YOUR_APP_NAME.azurewebsites.net/getAToken`
5. Check "ID tokens"
6. Click "Configure"

### Step 4: Access Your Application

Navigate to: `https://YOUR_APP_NAME.azurewebsites.net`

## Manual Deployment

### Option 1: Azure CLI

```bash
# Create resource group
az group create --name rg-ari-frontend --location eastus

# Deploy ARM template
az deployment group create \
  --resource-group rg-ari-frontend \
  --template-file azure-deploy.json \
  --parameters \
    webAppName=ari-web-app-unique123 \
    storageAccountName=aristorage123 \
    azureClientId=YOUR_CLIENT_ID \
    azureClientSecret=YOUR_CLIENT_SECRET

# Deploy code
az webapp up \
  --resource-group rg-ari-frontend \
  --name ari-web-app-unique123 \
  --runtime "PYTHON:3.9"
```

### Option 2: Azure Portal

1. Create a new Web App (Windows, Python 3.9)
2. Create a Storage Account with a File Share named "ari-reports"
3. Configure App Settings (see Environment Variables section)
4. Deploy code via:
   - FTP
   - GitHub Actions
   - Azure DevOps
   - VS Code Extension

## Local Development

### Setup

1. **Clone the repository**:
   ```bash
   cd frontend
   ```

2. **Create virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Install PowerShell modules**:
   ```powershell
   .\setup-dependencies.ps1
   ```

5. **Configure environment variables**:
   
   Create a `.env` file:
   ```
   AZURE_CLIENT_ID=your_client_id
   AZURE_CLIENT_SECRET=your_client_secret
   AZURE_TENANT_ID=common
   AZURE_STORAGE_ACCOUNT_NAME=your_storage_account
   AZURE_STORAGE_ACCOUNT_KEY=your_storage_key
   SECRET_KEY=your_random_secret_key
   ```

6. **Run the application**:
   ```bash
   python app.py
   ```

7. **Access locally**: `http://localhost:8000`

### Development Tips

- Use `FLASK_ENV=development` for auto-reload
- Set `FLASK_DEBUG=1` for detailed error pages
- Use Azure Storage Emulator for local storage testing
- Test with multiple tenants and subscriptions

## Environment Variables

Required environment variables for Azure App Service:

| Variable | Description | Example |
|----------|-------------|---------|
| `AZURE_CLIENT_ID` | Azure AD Application Client ID | `12345678-1234-1234-1234-123456789012` |
| `AZURE_CLIENT_SECRET` | Azure AD Application Client Secret | `your-secret-value` |
| `AZURE_TENANT_ID` | Azure AD Tenant ID (use "common" for multi-tenant) | `common` |
| `AZURE_STORAGE_ACCOUNT_NAME` | Storage Account name for reports | `aristorage123` |
| `AZURE_STORAGE_ACCOUNT_KEY` | Storage Account access key | `base64-encoded-key` |
| `AZURE_STORAGE_FILE_SHARE` | File Share name | `ari-reports` (default) |
| `SECRET_KEY` | Flask session secret key | `random-secret-key` |

## Usage

### 1. Login

Navigate to your deployed application and click "Sign in with Microsoft"

### 2. Select Tenant

After authentication, the dashboard will load available tenants. Select the tenant you want to inventory.

### 3. Select Subscription (Optional)

Choose a specific subscription or leave blank to scan all subscriptions in the tenant.

### 4. Configure Options

- **Include Tags**: Include resource tags in the report (increases report size)
- **Skip Diagram**: Skip network diagram generation for faster execution

### 5. Run Inventory

Click "Run Inventory" and wait for completion. Execution time varies based on:
- Number of resources
- Number of subscriptions
- Options selected
- Typical time: 5-30 minutes

### 6. Download Reports

Generated reports appear in the "Recent Reports" section. Click the download button to retrieve the Excel file.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Dashboard (requires auth) |
| `/login` | GET | Login page |
| `/logout` | GET | Logout |
| `/getAToken` | GET | OAuth callback |
| `/api/tenants` | GET | List available tenants |
| `/api/subscriptions/<tenant_id>` | GET | List subscriptions for tenant |
| `/api/run-ari` | POST | Execute Invoke-ARI |
| `/api/reports` | GET | List generated reports |
| `/api/download/<filename>` | GET | Download report |
| `/health` | GET | Health check |

## Troubleshooting

### Authentication Issues

**Problem**: "Not authenticated" error
- **Solution**: Ensure redirect URI is configured in Azure AD App Registration
- Verify Client ID and Secret are correct
- Check that API permissions are granted

### PowerShell Execution Errors

**Problem**: "PowerShell module not found"
- **Solution**: Run `setup-dependencies.ps1` on the App Service
- Ensure Azure App Service has PowerShell Core installed
- Verify modules are installed in correct scope

### Storage Issues

**Problem**: "Failed to upload to Azure Storage"
- **Solution**: Verify Storage Account credentials
- Check that File Share exists
- Ensure Storage Account allows access from App Service

### Performance Issues

**Problem**: Execution timeout
- **Solution**: 
  - Use `-SkipDiagram` option
  - Select specific subscriptions instead of all
  - Increase App Service tier (B2 or higher recommended)
  - Adjust timeout in `app.py` (default: 1800 seconds)

### Common Errors

**Error**: `MSAL authentication error`
- Check Client ID and Secret
- Verify tenant ID is correct or use "common"

**Error**: `PowerShell execution failed`
- Check PowerShell module installation
- Review execution logs in App Service
- Ensure Az.Accounts module is available

**Error**: `Storage connection failed`
- Verify storage credentials
- Check network connectivity
- Ensure File Share exists

## Security Considerations

1. **Never commit secrets**: Use Azure Key Vault or App Service Configuration
2. **Use HTTPS only**: Enforced by default in deployment
3. **Rotate secrets regularly**: Update Client Secrets periodically
4. **Principle of least privilege**: Grant minimum required permissions
5. **Monitor access**: Review App Service logs regularly
6. **Enable logging**: Configure Application Insights for monitoring

## Architecture Details

### Application Flow

1. **User Authentication**:
   - User clicks "Sign in with Microsoft"
   - MSAL redirects to Azure AD login
   - User authenticates and consents to permissions
   - Azure AD redirects back with authorization code
   - Application exchanges code for access token

2. **Tenant/Subscription Discovery**:
   - Application calls Azure Management API with access token
   - Retrieves list of tenants user has access to
   - Fetches subscriptions for selected tenant

3. **ARI Execution**:
   - Application constructs PowerShell command
   - Executes Invoke-ARI with selected parameters
   - Captures output and generated files

4. **Storage Management**:
   - Generated reports uploaded to Azure File Share
   - Files available for download via web interface
   - Persistent storage across app restarts

### Technology Stack

- **Backend**: Python Flask
- **Frontend**: Bootstrap 5, JavaScript
- **Authentication**: MSAL (Microsoft Authentication Library)
- **Storage**: Azure File Share
- **Runtime**: PowerShell Core 7+
- **Hosting**: Azure App Service (Windows)

## Cost Estimation

Estimated monthly costs (US East):

| Resource | SKU | Estimated Cost |
|----------|-----|----------------|
| App Service | B2 (2 cores, 3.5GB RAM) | ~$75/month |
| Storage Account | Standard LRS (100GB) | ~$2/month |
| **Total** | | **~$77/month** |

**Notes**:
- Costs vary by region
- B1 tier (~$13/month) can be used for testing
- S1/P1v2 tiers recommended for production
- Storage costs increase with report size/retention

## Limitations

1. **Windows App Service**: Designed for Windows to support PowerShell seamlessly
2. **Execution Time**: Large environments may require 30+ minutes
3. **Concurrent Users**: Single App Service can handle ~10-20 concurrent executions
4. **Storage**: File Share limited to configured quota (default: 100GB)
5. **Authentication**: Requires Azure AD; no other auth providers supported

## Roadmap

- [ ] Add Azure DevOps pipeline for CI/CD
- [ ] Implement job queue for long-running tasks
- [ ] Add email notifications on completion
- [ ] Support for scheduled/automated runs
- [ ] Enhanced report visualization in browser
- [ ] Multi-region deployment support
- [ ] Container-based deployment option

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License. See LICENSE file for details.

## Support

For issues and questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review [Azure Resource Inventory documentation](https://github.com/microsoft/ARI)
3. Open an issue on GitHub
4. Contact your Azure support team

## Acknowledgments

- **Azure Resource Inventory Team**: For the excellent ARI PowerShell module
- **Microsoft Identity Team**: For MSAL and authentication libraries
- **Flask Community**: For the robust web framework

## Related Projects

- [Azure Resource Inventory](https://github.com/microsoft/ARI) - Core PowerShell module
- [ARI Automation Guide](https://github.com/microsoft/ARI/blob/main/docs/advanced/automation.md) - Automation scenarios
- [Azure App Service Documentation](https://docs.microsoft.com/azure/app-service/) - App Service guides

---

**Built with ❤️ for Azure administrators and cloud engineers**
