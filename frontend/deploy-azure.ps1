# PowerShell script to deploy the ARI Web Frontend to Azure

param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName,
    
    [Parameter(Mandatory=$true)]
    [string]$WebAppName,
    
    [Parameter(Mandatory=$true)]
    [string]$StorageAccountName,
    
    [Parameter(Mandatory=$true)]
    [string]$AzureClientId,
    
    [Parameter(Mandatory=$true)]
    [string]$AzureClientSecret,
    
    [Parameter(Mandatory=$false)]
    [string]$AzureTenantId = "common",
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "eastus",
    
    [Parameter(Mandatory=$false)]
    [string]$Sku = "B2"
)

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Azure Resource Inventory Web Frontend Deployment" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# Check if logged in to Azure
Write-Host "`nChecking Azure authentication..." -ForegroundColor Yellow
$context = Get-AzContext
if (-not $context) {
    Write-Host "Not logged in to Azure. Please login..." -ForegroundColor Red
    Connect-AzAccount
    $context = Get-AzContext
}

Write-Host "Logged in as: $($context.Account.Id)" -ForegroundColor Green
Write-Host "Subscription: $($context.Subscription.Name)" -ForegroundColor Green

# Create resource group if it doesn't exist
Write-Host "`nChecking resource group..." -ForegroundColor Yellow
$rg = Get-AzResourceGroup -Name $ResourceGroupName -ErrorAction SilentlyContinue
if (-not $rg) {
    Write-Host "Creating resource group: $ResourceGroupName" -ForegroundColor Cyan
    New-AzResourceGroup -Name $ResourceGroupName -Location $Location
    Write-Host "Resource group created successfully" -ForegroundColor Green
} else {
    Write-Host "Resource group already exists" -ForegroundColor Gray
}

# Deploy ARM template
Write-Host "`nDeploying Azure resources..." -ForegroundColor Yellow
$deployment = New-AzResourceGroupDeployment `
    -ResourceGroupName $ResourceGroupName `
    -TemplateFile "$PSScriptRoot\azure-deploy.json" `
    -webAppName $WebAppName `
    -location $Location `
    -sku $Sku `
    -storageAccountName $StorageAccountName `
    -azureClientId $AzureClientId `
    -azureClientSecret (ConvertTo-SecureString -String $AzureClientSecret -AsPlainText -Force) `
    -azureTenantId $AzureTenantId `
    -Verbose

if ($deployment.ProvisioningState -eq "Succeeded") {
    Write-Host "`nAzure resources deployed successfully!" -ForegroundColor Green
    Write-Host "Web App URL: $($deployment.Outputs.webAppUrl.Value)" -ForegroundColor Cyan
} else {
    Write-Host "`nDeployment failed!" -ForegroundColor Red
    exit 1
}

# Create ZIP package for deployment
Write-Host "`nCreating deployment package..." -ForegroundColor Yellow
$zipPath = "$PSScriptRoot\deploy.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

$filesToInclude = @(
    "app.py",
    "requirements.txt",
    "web.config",
    "setup-dependencies.ps1",
    ".deployment",
    "templates"
)

# Create temporary directory for packaging
$tempDir = "$PSScriptRoot\temp_deploy"
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Copy files to temp directory
foreach ($file in $filesToInclude) {
    $sourcePath = Join-Path $PSScriptRoot $file
    $destPath = Join-Path $tempDir $file
    
    if (Test-Path $sourcePath) {
        if (Test-Path $sourcePath -PathType Container) {
            Copy-Item -Path $sourcePath -Destination $destPath -Recurse
        } else {
            Copy-Item -Path $sourcePath -Destination $destPath
        }
    }
}

# Create ZIP file
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -Force
Remove-Item $tempDir -Recurse -Force

Write-Host "Deployment package created: $zipPath" -ForegroundColor Green

# Deploy to App Service
Write-Host "`nDeploying application to App Service..." -ForegroundColor Yellow
Publish-AzWebApp `
    -ResourceGroupName $ResourceGroupName `
    -Name $WebAppName `
    -ArchivePath $zipPath `
    -Force

Write-Host "`nApplication deployed successfully!" -ForegroundColor Green

# Configure redirect URI
$webAppUrl = $deployment.Outputs.webAppUrl.Value
$redirectUri = "$webAppUrl/getAToken"

Write-Host "`n====================================" -ForegroundColor Cyan
Write-Host "Deployment completed!" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "`nWeb App URL: $webAppUrl" -ForegroundColor Cyan
Write-Host "`nIMPORTANT: Configure Azure AD App Registration:" -ForegroundColor Yellow
Write-Host "1. Go to Azure Portal > Azure AD > App Registrations" -ForegroundColor White
Write-Host "2. Select your application (Client ID: $AzureClientId)" -ForegroundColor White
Write-Host "3. Go to 'Authentication' section" -ForegroundColor White
Write-Host "4. Add the following redirect URI:" -ForegroundColor White
Write-Host "   $redirectUri" -ForegroundColor Cyan
Write-Host "5. Enable 'ID tokens' under Implicit grant" -ForegroundColor White
Write-Host "`nStorage Account: $($deployment.Outputs.storageAccountName.Value)" -ForegroundColor Cyan
Write-Host "`nYour application is ready to use!" -ForegroundColor Green
