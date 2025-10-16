#!/usr/bin/env pwsh
# Test Azure connectivity and SSL

Write-Host "Testing Azure Connectivity..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Basic network connectivity
Write-Host "1. Testing DNS resolution..." -ForegroundColor Yellow
try {
    $dns = Resolve-DnsName -Name "login.microsoftonline.com" -ErrorAction Stop
    Write-Host "   ✓ DNS resolution successful" -ForegroundColor Green
    Write-Host "   IP: $($dns[0].IPAddress)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ DNS resolution failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: HTTPS connectivity
Write-Host "2. Testing HTTPS connectivity to Azure..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://login.microsoftonline.com" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    Write-Host "   ✓ HTTPS connection successful" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ HTTPS connection failed: $_" -ForegroundColor Red
    if ($_.Exception.Message -match "SSL") {
        Write-Host "   → This is an SSL/TLS error" -ForegroundColor Yellow
    }
}
Write-Host ""

# Test 3: Check TLS settings
Write-Host "3. Checking TLS settings..." -ForegroundColor Yellow
Write-Host "   SecurityProtocol: $([Net.ServicePointManager]::SecurityProtocol)" -ForegroundColor Gray
Write-Host ""

# Test 4: Check proxy settings
Write-Host "4. Checking proxy settings..." -ForegroundColor Yellow
$proxy = [System.Net.WebRequest]::GetSystemWebProxy()
$proxyUri = $proxy.GetProxy("https://login.microsoftonline.com")
if ($proxyUri.AbsoluteUri -ne "https://login.microsoftonline.com/") {
    Write-Host "   Proxy detected: $($proxyUri.AbsoluteUri)" -ForegroundColor Yellow
} else {
    Write-Host "   No proxy detected" -ForegroundColor Gray
}
Write-Host ""

# Test 5: Test with TLS 1.2 enabled
Write-Host "5. Testing with TLS 1.2 explicitly enabled..." -ForegroundColor Yellow
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $response = Invoke-WebRequest -Uri "https://management.azure.com" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    Write-Host "   ✓ Connection successful with TLS 1.2" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Connection failed: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "Recommendations:" -ForegroundColor Cyan
Write-Host "- If SSL errors persist, you may be behind a corporate proxy with SSL inspection" -ForegroundColor Yellow
Write-Host "- Try connecting from a different network (home/mobile hotspot)" -ForegroundColor Yellow
Write-Host "- Contact your IT department about Azure connectivity requirements" -ForegroundColor Yellow
