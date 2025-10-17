# Complete Azure AD Setup Script
# This script configures both redirect URIs and API permissions for your app

param(
    [Parameter(Mandatory=$false)]
    [string]$AppId = "9795693b-67cd-4165-b8a0-793833081db6",
    
    [Parameter(Mandatory=$false)]
    [string]$ProductionUrl = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipRedirectUris = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipApiPermissions = $false
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Azure AD Complete Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will configure:" -ForegroundColor White
Write-Host "  1. Redirect URIs (Reply URLs)" -ForegroundColor Gray
Write-Host "  2. API Permissions" -ForegroundColor Gray
Write-Host ""
Write-Host "App ID: $AppId" -ForegroundColor White
Write-Host ""

# Check if Azure CLI is available
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Azure CLI is required but not found." -ForegroundColor Red
    Write-Host "Please install from: https://aka.ms/installazurecliwindows" -ForegroundColor Yellow
    exit 1
}

# Check if logged in
$context = az account show 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Logging in to Azure..." -ForegroundColor Yellow
    az login
}

Write-Host "✓ Connected to Azure" -ForegroundColor Green
Write-Host ""

# Step 1: Configure Redirect URIs
if (-not $SkipRedirectUris) {
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "Step 1: Configuring Redirect URIs" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    
    $redirectScript = Join-Path $PSScriptRoot "add-redirect-uris.ps1"
    
    if (Test-Path $redirectScript) {
        if ($ProductionUrl) {
            & $redirectScript -AppId $AppId -BaseUrl $ProductionUrl
        } else {
            & $redirectScript -AppId $AppId
        }
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "⚠ Failed to configure redirect URIs" -ForegroundColor Yellow
            Write-Host "Please configure manually or run: .\add-redirect-uris.ps1" -ForegroundColor Yellow
            Write-Host ""
        }
    } else {
        Write-Host "⚠ Redirect URI script not found: $redirectScript" -ForegroundColor Yellow
        Write-Host "Skipping redirect URI configuration" -ForegroundColor Yellow
        Write-Host ""
    }
} else {
    Write-Host "Skipping redirect URI configuration (use -SkipRedirectUris:$false to enable)" -ForegroundColor Gray
    Write-Host ""
}

# Step 2: Configure API Permissions
if (-not $SkipApiPermissions) {
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "Step 2: Configuring API Permissions" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    
    $permissionScript = Join-Path $PSScriptRoot "add-api-permissions.ps1"
    
    if (Test-Path $permissionScript) {
        & $permissionScript -AppId $AppId -GrantAdminConsent
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "⚠ Failed to configure API permissions" -ForegroundColor Yellow
            Write-Host "Please configure manually or run: .\add-api-permissions.ps1" -ForegroundColor Yellow
            Write-Host ""
        }
    } else {
        Write-Host "⚠ API permission script not found: $permissionScript" -ForegroundColor Yellow
        Write-Host "Skipping API permission configuration" -ForegroundColor Yellow
        Write-Host ""
    }
} else {
    Write-Host "Skipping API permission configuration (use -SkipApiPermissions:$false to enable)" -ForegroundColor Gray
    Write-Host ""
}

# Final Summary
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor White
Write-Host "1. Start your application:" -ForegroundColor Gray
Write-Host "   node server.js" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Open in browser and test login" -ForegroundColor Gray
Write-Host "   Enter your tenant ID when prompted" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Verify in Azure Portal:" -ForegroundColor Gray
Write-Host "   https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/$AppId" -ForegroundColor Gray
Write-Host ""
Write-Host "Documentation:" -ForegroundColor White
Write-Host "  - Quick Start: QUICK_START_GUIDE.md" -ForegroundColor Gray
Write-Host "  - Redirect URIs: REDIRECT_URI_GUIDE.md" -ForegroundColor Gray
Write-Host "  - Full Setup: AZURE_AD_SETUP.md" -ForegroundColor Gray
Write-Host ""
Write-Host "✓ All done!" -ForegroundColor Green
Write-Host ""
