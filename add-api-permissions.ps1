# Add API Permissions to Azure AD Application
# This script adds the required Azure Service Management API permission to your app registration

param(
    [Parameter(Mandatory=$false)]
    [string]$AppId = "9795693b-67cd-4165-b8a0-793833081db6",
    
    [Parameter(Mandatory=$false)]
    [switch]$GrantAdminConsent = $false
)

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Azure AD API Permissions Setup" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if Az module is installed
if (-not (Get-Module -ListAvailable -Name Az.Resources)) {
    Write-Host "ERROR: Az.Resources module is not installed." -ForegroundColor Red
    Write-Host "Please install it with: Install-Module -Name Az -AllowClobber -Scope CurrentUser" -ForegroundColor Yellow
    exit 1
}

# Import required modules
Import-Module Az.Resources -ErrorAction SilentlyContinue

# Check if user is logged in
$context = Get-AzContext
if (-not $context) {
    Write-Host "Not logged in to Azure. Attempting to login..." -ForegroundColor Yellow
    Connect-AzAccount
    $context = Get-AzContext
}

Write-Host "Connected to Azure:" -ForegroundColor Green
Write-Host "  Tenant: $($context.Tenant.Id)" -ForegroundColor White
Write-Host "  Account: $($context.Account.Id)" -ForegroundColor White
Write-Host ""

# Azure Service Management API details
$ArmApiId = "797f4846-ba00-4fd7-ba43-dac1f8f63013"  # Azure Service Management
$PermissionId = "41094075-9dad-400e-a0bd-54e686782033"  # user_impersonation

Write-Host "Adding API Permission:" -ForegroundColor Cyan
Write-Host "  App ID: $AppId" -ForegroundColor White
Write-Host "  API: Azure Service Management" -ForegroundColor White
Write-Host "  Permission: user_impersonation (Delegated)" -ForegroundColor White
Write-Host ""

try {
    # Try using Azure CLI if available (more reliable)
    $azCliAvailable = Get-Command az -ErrorAction SilentlyContinue
    
    if ($azCliAvailable) {
        Write-Host "Using Azure CLI..." -ForegroundColor Green
        
        # Add the permission
        $addResult = az ad app permission add `
            --id $AppId `
            --api $ArmApiId `
            --api-permissions "$PermissionId=Scope" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ API permission added successfully!" -ForegroundColor Green
            Write-Host ""
            
            if ($GrantAdminConsent) {
                Write-Host "Granting admin consent..." -ForegroundColor Cyan
                $consentResult = az ad app permission admin-consent --id $AppId 2>&1
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "✓ Admin consent granted successfully!" -ForegroundColor Green
                } else {
                    Write-Host "⚠ Failed to grant admin consent automatically." -ForegroundColor Yellow
                    Write-Host "  Please grant consent manually in Azure Portal." -ForegroundColor Yellow
                }
            } else {
                Write-Host "⚠ Admin consent not granted automatically." -ForegroundColor Yellow
                Write-Host "  To grant admin consent, run this script with -GrantAdminConsent flag" -ForegroundColor Yellow
                Write-Host "  OR grant it manually in Azure Portal." -ForegroundColor Yellow
            }
        } else {
            throw "Failed to add permission: $addResult"
        }
    } else {
        Write-Host "Azure CLI not found. Please install Azure CLI and try again." -ForegroundColor Red
        Write-Host "Download from: https://aka.ms/installazurecliwindows" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Alternatively, add the permission manually:" -ForegroundColor Yellow
        Write-Host "1. Go to https://portal.azure.com" -ForegroundColor White
        Write-Host "2. Navigate to Azure Active Directory > App registrations" -ForegroundColor White
        Write-Host "3. Find your app (ID: $AppId)" -ForegroundColor White
        Write-Host "4. Go to API permissions > Add a permission" -ForegroundColor White
        Write-Host "5. Select 'Azure Service Management'" -ForegroundColor White
        Write-Host "6. Select 'Delegated permissions'" -ForegroundColor White
        Write-Host "7. Check 'user_impersonation'" -ForegroundColor White
        Write-Host "8. Click 'Add permissions'" -ForegroundColor White
        Write-Host "9. Click 'Grant admin consent for [Your Organization]'" -ForegroundColor White
        exit 1
    }
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please add the permission manually using Azure Portal:" -ForegroundColor Yellow
    Write-Host "1. Go to https://portal.azure.com" -ForegroundColor White
    Write-Host "2. Navigate to Azure Active Directory > App registrations" -ForegroundColor White
    Write-Host "3. Find your app (ID: $AppId)" -ForegroundColor White
    Write-Host "4. Go to API permissions > Add a permission" -ForegroundColor White
    Write-Host "5. Select 'Azure Service Management'" -ForegroundColor White
    Write-Host "6. Select 'Delegated permissions'" -ForegroundColor White
    Write-Host "7. Check 'user_impersonation'" -ForegroundColor White
    Write-Host "8. Click 'Add permissions'" -ForegroundColor White
    Write-Host "9. Click 'Grant admin consent for [Your Organization]'" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Verification" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To verify the permissions were added:" -ForegroundColor White
Write-Host "  az ad app permission list --id $AppId" -ForegroundColor Gray
Write-Host ""
Write-Host "Or check in Azure Portal:" -ForegroundColor White
Write-Host "  https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/$AppId" -ForegroundColor Gray
Write-Host ""
Write-Host "✓ Setup complete!" -ForegroundColor Green
Write-Host ""
