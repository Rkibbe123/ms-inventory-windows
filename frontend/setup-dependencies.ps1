# PowerShell script to set up dependencies for Azure Resource Inventory Web Frontend
# This script should be run on the Windows Azure App Service

Write-Host "Setting up Azure Resource Inventory Web Frontend dependencies..." -ForegroundColor Green

# Set PowerShell Gallery as trusted
Write-Host "Configuring PowerShell Gallery..." -ForegroundColor Yellow
Set-PSRepository -Name PSGallery -InstallationPolicy Trusted

# Install required PowerShell modules
Write-Host "Installing Azure PowerShell modules..." -ForegroundColor Yellow

$modules = @(
    'Az.Accounts',
    'Az.Resources',
    'Az.Storage',
    'AzureResourceInventory'
)

foreach ($module in $modules) {
    Write-Host "Installing $module..." -ForegroundColor Cyan
    if (-not (Get-Module -ListAvailable -Name $module)) {
        Install-Module -Name $module -Force -AllowClobber -Scope CurrentUser
        Write-Host "$module installed successfully" -ForegroundColor Green
    } else {
        Write-Host "$module is already installed" -ForegroundColor Gray
        # Update to latest version
        Update-Module -Name $module -Force
        Write-Host "$module updated to latest version" -ForegroundColor Green
    }
}

# Verify installations
Write-Host "`nVerifying installations..." -ForegroundColor Yellow
foreach ($module in $modules) {
    $installedModule = Get-Module -ListAvailable -Name $module | Select-Object -First 1
    if ($installedModule) {
        Write-Host "$module version $($installedModule.Version) is installed" -ForegroundColor Green
    } else {
        Write-Host "WARNING: $module is not installed!" -ForegroundColor Red
    }
}

# Create necessary directories
Write-Host "`nCreating necessary directories..." -ForegroundColor Yellow
$directories = @(
    "$PSScriptRoot\flask_session",
    "$PSScriptRoot\temp_output",
    "$PSScriptRoot\temp_downloads",
    "$PSScriptRoot\logs"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "Created directory: $dir" -ForegroundColor Green
    } else {
        Write-Host "Directory already exists: $dir" -ForegroundColor Gray
    }
}

Write-Host "`nDependency setup completed!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Configure environment variables in Azure App Service:" -ForegroundColor White
Write-Host "   - AZURE_CLIENT_ID" -ForegroundColor Cyan
Write-Host "   - AZURE_CLIENT_SECRET" -ForegroundColor Cyan
Write-Host "   - AZURE_TENANT_ID" -ForegroundColor Cyan
Write-Host "   - AZURE_STORAGE_ACCOUNT_NAME" -ForegroundColor Cyan
Write-Host "   - AZURE_STORAGE_ACCOUNT_KEY" -ForegroundColor Cyan
Write-Host "   - SECRET_KEY (for Flask session)" -ForegroundColor Cyan
Write-Host "2. Deploy the application to Azure App Service" -ForegroundColor White
Write-Host "3. Configure the App Service redirect URI in Azure AD" -ForegroundColor White
