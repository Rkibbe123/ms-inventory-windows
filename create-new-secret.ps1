#!/usr/bin/env pwsh
# Create a new client secret for the service principal

$appId = "9795693b-67cd-4165-b8a0-793833081db6"
$tenantId = "ed9aa516-5358-4016-a8b2-b6ccb99142d0"

Write-Host "Creating new client secret for service principal..." -ForegroundColor Cyan
Write-Host "App ID: $appId" -ForegroundColor Yellow
Write-Host "Tenant: $tenantId" -ForegroundColor Yellow
Write-Host ""

# Create a new secret that expires in 1 year
$endDate = (Get-Date).AddYears(1).ToString("yyyy-MM-dd")

Write-Host "Running: az ad sp credential reset..." -ForegroundColor Cyan
$result = az ad sp credential reset --id $appId --end-date $endDate --display-name "ARI-Secret-$(Get-Date -Format 'yyyyMMdd')" --output json | ConvertFrom-Json

if ($result) {
    Write-Host ""
    Write-Host "✓ New client secret created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Update your .env file with these values:" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "AZURE_CLIENT_ID=$($result.appId)" -ForegroundColor Yellow
    Write-Host "AZURE_CLIENT_SECRET=$($result.password)" -ForegroundColor Yellow
    Write-Host "TENANT_ID=$($result.tenant)" -ForegroundColor Yellow
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Secret expires on: $endDate" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Copy the AZURE_CLIENT_SECRET value now!" -ForegroundColor Red
    Write-Host "   You won't be able to see it again." -ForegroundColor Red
} else {
    Write-Host "✗ Failed to create secret" -ForegroundColor Red
    Write-Host "Make sure you have permission to manage this service principal" -ForegroundColor Yellow
}
