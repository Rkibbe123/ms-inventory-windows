#!/usr/bin/env pwsh
# Test service principal authentication

param(
    [string]$TenantId = $env:TENANT_ID,
    [string]$AppId = $env:AZURE_CLIENT_ID,
    [string]$Secret = $env:AZURE_CLIENT_SECRET
)

Write-Host "Testing Service Principal Authentication..." -ForegroundColor Cyan
Write-Host "Tenant ID: $TenantId" -ForegroundColor Yellow
Write-Host "App ID: $AppId" -ForegroundColor Yellow
Write-Host "Secret: $($Secret.Substring(0, 5))..." -ForegroundColor Yellow
Write-Host ""

try {
    Write-Host "Attempting to connect..." -ForegroundColor Cyan
    $SecurePassword = ConvertTo-SecureString -String $Secret -AsPlainText -Force
    $Credential = New-Object -TypeName System.Management.Automation.PSCredential -ArgumentList $AppId, $SecurePassword
    
    $result = Connect-AzAccount -ServicePrincipal -TenantId $TenantId -Credential $Credential -ErrorAction Stop
    
    Write-Host "✓ Authentication successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Connected Account:" -ForegroundColor Cyan
    $result | Format-List
    
    Write-Host "Available Subscriptions:" -ForegroundColor Cyan
    Get-AzSubscription | Format-Table -Property Name, Id, State
    
} catch {
    Write-Host "✗ Authentication failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "1. Service principal doesn't exist in tenant: $TenantId"
    Write-Host "2. Client secret is expired or invalid"
    Write-Host "3. Service principal doesn't have proper permissions"
    Write-Host ""
    Write-Host "To verify your service principal:" -ForegroundColor Cyan
    Write-Host "  az ad sp show --id $AppId --query '{displayName:displayName,appId:appId,objectId:id}'"
    exit 1
}
