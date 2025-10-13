# Azure Resource Inventory Web Frontend - Deployment Checklist

Use this checklist to ensure a smooth deployment to Azure.

## Pre-Deployment

### Azure AD App Registration
- [ ] Created App Registration in Azure AD
- [ ] Noted Application (Client) ID
- [ ] Created Client Secret and copied the value
- [ ] Noted Directory (Tenant) ID
- [ ] Added API Permissions:
  - [ ] Microsoft Graph → User.Read
  - [ ] Azure Service Management → user_impersonation
- [ ] Granted admin consent for permissions
- [ ] Selected "Accounts in any organizational directory" for multi-tenant support

### Azure Prerequisites
- [ ] Have Azure Subscription with required permissions
- [ ] Installed Azure PowerShell module (`Install-Module -Name Az`)
- [ ] Logged into Azure (`Connect-AzAccount`)
- [ ] Selected correct subscription (`Set-AzContext`)
- [ ] Decided on Azure region (e.g., eastus, westus2)
- [ ] Decided on resource naming convention

### Local Setup
- [ ] Cloned or downloaded the repository
- [ ] Reviewed and customized deployment parameters
- [ ] Have PowerShell 7.0+ installed
- [ ] Have appropriate Azure permissions (Contributor or Owner)

## Deployment

### Resource Naming
- [ ] Web App Name: ________________ (must be globally unique)
- [ ] Storage Account Name: ________________ (3-24 chars, lowercase, no special chars)
- [ ] Resource Group Name: ________________
- [ ] Location: ________________
- [ ] SKU: ________________ (B1/B2/S1/P1v2)

### Execute Deployment
- [ ] Created deployment variables file or noted parameters
- [ ] Ran `deploy-azure.ps1` script
- [ ] Deployment completed successfully
- [ ] Noted Web App URL from output
- [ ] Noted Redirect URI from output
- [ ] Noted Storage Account name

### Verify Deployment
- [ ] Resource Group created in Azure Portal
- [ ] App Service exists and is running
- [ ] Storage Account created
- [ ] File Share "ari-reports" exists
- [ ] App Service has correct environment variables:
  - [ ] AZURE_CLIENT_ID
  - [ ] AZURE_CLIENT_SECRET
  - [ ] AZURE_TENANT_ID
  - [ ] AZURE_STORAGE_ACCOUNT_NAME
  - [ ] AZURE_STORAGE_ACCOUNT_KEY
  - [ ] SECRET_KEY

## Post-Deployment

### Azure AD Configuration
- [ ] Added Redirect URI to App Registration
  - URI: https://YOUR-APP.azurewebsites.net/getAToken
- [ ] Enabled ID tokens in Authentication settings
- [ ] Verified API permissions are still granted
- [ ] (Optional) Configured custom branding

### App Service Configuration
- [ ] Verified Python version is 3.9
- [ ] Confirmed HTTPS Only is enabled
- [ ] Reviewed App Service Plan tier (scale up if needed)
- [ ] (Optional) Configured custom domain
- [ ] (Optional) Enabled Application Insights
- [ ] (Optional) Configured deployment slots
- [ ] (Optional) Set up auto-scaling rules

### Storage Configuration
- [ ] File Share quota is sufficient (default: 100GB)
- [ ] Verified storage account access
- [ ] (Optional) Configured backup/retention policies
- [ ] (Optional) Set up lifecycle management

### Security Hardening
- [ ] Reviewed and minimized API permissions
- [ ] Enabled managed identity (optional but recommended)
- [ ] Configured firewall rules if needed
- [ ] Set up Key Vault for secrets (recommended for production)
- [ ] Enabled diagnostic logging
- [ ] Configured access restrictions
- [ ] Reviewed authentication settings

### PowerShell Setup
- [ ] Connected to App Service via SSH/Kudu
- [ ] Verified PowerShell Core is installed (`pwsh --version`)
- [ ] Ran `setup-dependencies.ps1` or manually installed modules:
  - [ ] Az.Accounts
  - [ ] Az.Resources
  - [ ] Az.Storage
  - [ ] AzureResourceInventory
- [ ] Verified module installations

## Testing

### Initial Testing
- [ ] Accessed Web App URL
- [ ] Login page loads correctly
- [ ] Clicked "Sign in with Microsoft"
- [ ] Successfully authenticated
- [ ] Dashboard loads without errors
- [ ] Tenants list populates
- [ ] Selected a tenant
- [ ] Subscriptions load for selected tenant
- [ ] Configured test options
- [ ] Ran test inventory (small subscription recommended)
- [ ] Execution completed successfully
- [ ] Report generated and uploaded to storage
- [ ] Report appears in "Recent Reports" list
- [ ] Successfully downloaded report
- [ ] Opened Excel file and verified contents

### Error Testing
- [ ] Tested with invalid credentials
- [ ] Tested with no permissions
- [ ] Tested logout functionality
- [ ] Verified error messages are user-friendly
- [ ] Checked application logs for errors

### Performance Testing
- [ ] Tested with large environment
- [ ] Verified timeout settings are adequate
- [ ] Monitored resource usage during execution
- [ ] Confirmed storage upload works for large files
- [ ] (Optional) Tested concurrent executions

## Monitoring & Operations

### Monitoring Setup
- [ ] Enabled Application Insights
- [ ] Configured alerts for:
  - [ ] Application errors
  - [ ] High CPU usage
  - [ ] High memory usage
  - [ ] Failed authentications
- [ ] Set up availability tests
- [ ] Configured log analytics workspace
- [ ] Created dashboard for monitoring

### Backup & Recovery
- [ ] Documented backup procedures
- [ ] Tested restore from backup
- [ ] Configured storage redundancy
- [ ] (Optional) Set up geo-redundancy

### Documentation
- [ ] Documented Web App URL
- [ ] Documented all resource names
- [ ] Created runbook for common tasks
- [ ] Documented troubleshooting steps
- [ ] Shared access instructions with team
- [ ] Created user guide

## Production Readiness

### Performance
- [ ] Reviewed and optimized App Service Plan tier
- [ ] Configured auto-scaling if needed
- [ ] Optimized timeout settings
- [ ] Reviewed storage performance tier

### Security
- [ ] Rotated all secrets
- [ ] Set up secret rotation schedule (90 days)
- [ ] Reviewed role assignments
- [ ] Enabled MFA for admin accounts
- [ ] Configured conditional access policies
- [ ] Reviewed and minimized permissions
- [ ] Set up audit logging

### Compliance
- [ ] Reviewed compliance requirements
- [ ] Enabled required compliance features
- [ ] Documented data retention policies
- [ ] (If applicable) Configured GDPR compliance

### High Availability
- [ ] (Optional) Deployed to multiple regions
- [ ] (Optional) Set up Traffic Manager
- [ ] (Optional) Configured disaster recovery
- [ ] Documented RTO and RPO

### Cost Optimization
- [ ] Reviewed resource costs
- [ ] Set up cost alerts
- [ ] Configured budget thresholds
- [ ] (Optional) Reserved instances for savings
- [ ] Reviewed and optimized storage tiers

## Ongoing Maintenance

### Regular Tasks
- [ ] Monitor application health (daily)
- [ ] Review error logs (weekly)
- [ ] Check storage usage (weekly)
- [ ] Review and download reports (as needed)
- [ ] Update secrets (every 90 days)
- [ ] Update PowerShell modules (monthly)
- [ ] Review access logs (monthly)
- [ ] Update Python dependencies (monthly)
- [ ] Review and optimize costs (monthly)
- [ ] Test disaster recovery (quarterly)
- [ ] Security review (quarterly)

### Updates & Upgrades
- [ ] Subscribe to Azure updates
- [ ] Monitor ARI module updates
- [ ] Test updates in non-production environment
- [ ] Plan maintenance windows
- [ ] Document change procedures

## Troubleshooting Reference

### Common Issues

**Authentication fails**
- Check redirect URI matches exactly
- Verify client ID and secret
- Ensure API permissions granted
- Review Azure AD logs

**PowerShell execution fails**
- Verify modules installed
- Check PowerShell version
- Review execution logs
- Ensure sufficient permissions

**Storage upload fails**
- Verify storage credentials
- Check file share exists
- Review network connectivity
- Ensure sufficient quota

**Performance issues**
- Review App Service Plan tier
- Check concurrent executions
- Monitor resource usage
- Consider scaling up

### Support Resources
- App Service logs: https://YOUR-APP.scm.azurewebsites.net
- Azure Support: Azure Portal → Help + support
- ARI Documentation: https://github.com/microsoft/ARI
- Application Insights: Azure Portal → Application Insights

## Sign-Off

### Deployment Team
- [ ] Developer: ________________ Date: ________
- [ ] Security: ________________ Date: ________
- [ ] Operations: ________________ Date: ________

### Approval
- [ ] Manager: ________________ Date: ________
- [ ] Product Owner: ________________ Date: ________

### Go-Live
- [ ] Production deployment approved
- [ ] Users notified
- [ ] Support team trained
- [ ] Monitoring confirmed
- [ ] Go-live date: ________________

---

**Notes:**
