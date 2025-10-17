# Add Redirect URIs to Azure AD Application
# This script adds the required redirect URIs (reply URLs) to your app registration

param(
    [Parameter(Mandatory=$false)]
    [string]$AppId = "9795693b-67cd-4165-b8a0-793833081db6",
    
    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$AddCommonUrls = $true
)

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Azure AD Redirect URI Configuration" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if Azure CLI is available
$azCliAvailable = Get-Command az -ErrorAction SilentlyContinue

if (-not $azCliAvailable) {
    Write-Host "ERROR: Azure CLI not found." -ForegroundColor Red
    Write-Host "Please install Azure CLI: https://aka.ms/installazurecliwindows" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or add redirect URIs manually in Azure Portal:" -ForegroundColor Yellow
    Write-Host "1. Go to https://portal.azure.com" -ForegroundColor White
    Write-Host "2. Navigate to Azure Active Directory > App registrations" -ForegroundColor White
    Write-Host "3. Find your app (ID: $AppId)" -ForegroundColor White
    Write-Host "4. Go to Authentication > Add a platform > Web" -ForegroundColor White
    Write-Host "5. Add redirect URIs:" -ForegroundColor White
    Write-Host "   - http://localhost:3000/auth/redirect" -ForegroundColor Gray
    Write-Host "   - http://localhost:8000/getAToken" -ForegroundColor Gray
    Write-Host "   - Your production URL/auth/redirect" -ForegroundColor Gray
    exit 1
}

# Check if user is logged in
$context = az account show 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in to Azure. Logging in..." -ForegroundColor Yellow
    az login
    $context = az account show 2>&1
}

$contextObj = $context | ConvertFrom-Json
Write-Host "Connected to Azure:" -ForegroundColor Green
Write-Host "  Tenant: $($contextObj.tenantId)" -ForegroundColor White
Write-Host "  Account: $($contextObj.user.name)" -ForegroundColor White
Write-Host ""

# Define redirect URIs to add
$redirectUris = @()

if ($AddCommonUrls) {
    Write-Host "Adding common development redirect URIs..." -ForegroundColor Cyan
    # Node.js Express server (port 3000)
    $redirectUris += "http://localhost:3000/auth/redirect"
    # Flask server (port 8000)
    $redirectUris += "http://localhost:8000/getAToken"
    # Alternative ports
    $redirectUris += "http://localhost:5000/auth/redirect"
    $redirectUris += "http://localhost:5000/getAToken"
}

if ($BaseUrl) {
    Write-Host "Adding custom redirect URIs for: $BaseUrl" -ForegroundColor Cyan
    $redirectUris += "$BaseUrl/auth/redirect"
    $redirectUris += "$BaseUrl/getAToken"
}

if ($redirectUris.Count -eq 0) {
    Write-Host "ERROR: No redirect URIs to add." -ForegroundColor Red
    Write-Host "Usage: .\add-redirect-uris.ps1 [-BaseUrl 'https://your-app.azurewebsites.net']" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Redirect URIs to add:" -ForegroundColor White
foreach ($uri in $redirectUris) {
    Write-Host "  - $uri" -ForegroundColor Gray
}
Write-Host ""

# Get current redirect URIs
Write-Host "Fetching current redirect URIs..." -ForegroundColor Cyan
$appDetails = az ad app show --id $AppId 2>&1 | ConvertFrom-Json

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to fetch app details." -ForegroundColor Red
    exit 1
}

$existingUris = @()
if ($appDetails.web -and $appDetails.web.redirectUris) {
    $existingUris = $appDetails.web.redirectUris
}

Write-Host "Current redirect URIs:" -ForegroundColor Green
if ($existingUris.Count -eq 0) {
    Write-Host "  (none)" -ForegroundColor Gray
} else {
    foreach ($uri in $existingUris) {
        Write-Host "  - $uri" -ForegroundColor Gray
    }
}
Write-Host ""

# Merge URIs (avoid duplicates)
$allUris = $existingUris + $redirectUris | Select-Object -Unique

Write-Host "Updating redirect URIs..." -ForegroundColor Cyan
try {
    # Build the JSON for redirect URIs
    $urisJson = $allUris | ConvertTo-Json -Compress
    
    # Update the app
    $result = az ad app update --id $AppId --web-redirect-uris $allUris 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Redirect URIs updated successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "New redirect URIs:" -ForegroundColor Green
        foreach ($uri in $allUris) {
            Write-Host "  - $uri" -ForegroundColor Gray
        }
    } else {
        throw "Failed to update: $result"
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please add redirect URIs manually:" -ForegroundColor Yellow
    Write-Host "1. Go to https://portal.azure.com" -ForegroundColor White
    Write-Host "2. Navigate to Azure Active Directory > App registrations" -ForegroundColor White
    Write-Host "3. Find your app (ID: $AppId)" -ForegroundColor White
    Write-Host "4. Go to Authentication" -ForegroundColor White
    Write-Host "5. Under 'Web' platform, add redirect URIs:" -ForegroundColor White
    foreach ($uri in $redirectUris) {
        Write-Host "   - $uri" -ForegroundColor Gray
    }
    exit 1
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Important Configuration" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Make sure your .env file has the correct redirect URI:" -ForegroundColor White
Write-Host ""
if ($BaseUrl) {
    Write-Host "REDIRECT_URI=$BaseUrl/auth/redirect" -ForegroundColor Gray
} else {
    Write-Host "# For development, the app will auto-detect the redirect URI" -ForegroundColor Gray
    Write-Host "# For production, set:" -ForegroundColor Gray
    Write-Host "REDIRECT_URI=https://your-app.azurewebsites.net/auth/redirect" -ForegroundColor Gray
}
Write-Host ""
Write-Host "Verification URL:" -ForegroundColor White
Write-Host "https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Authentication/appId/$AppId" -ForegroundColor Gray
Write-Host ""
Write-Host "✓ Setup complete!" -ForegroundColor Green
Write-Host ""
