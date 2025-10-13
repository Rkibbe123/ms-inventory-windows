param(
  [Parameter(Mandatory = $true)][string]$TenantId,
  [string]$SubscriptionId,
  [Parameter(Mandatory = $true)][string]$AccessToken,
  [Parameter(Mandatory = $true)][string]$AccountId,
  [Parameter(Mandatory = $true)][string]$OutputDir,
  [string]$AzureEnvironment = 'AzureCloud'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Write-Log($msg) { $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'; Write-Host "[$timestamp] $msg" }

Write-Log "PowerShell version: $($PSVersionTable.PSVersion)"
Write-Log "Ensuring output directory exists: $OutputDir"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

Write-Log 'Trusting PSGallery'
try { Set-PSRepository -Name 'PSGallery' -InstallationPolicy Trusted -ErrorAction SilentlyContinue } catch { }

function Ensure-Module([string]$Name) {
  if (-not (Get-Module -ListAvailable -Name $Name)) {
    Write-Log "Installing PowerShell module: $Name"
    Install-Module -Name $Name -Force -Scope CurrentUser -AllowClobber
  } else {
    Write-Log "Module already available: $Name"
  }
}

Ensure-Module -Name 'Az.Accounts'
Ensure-Module -Name 'Az'
Ensure-Module -Name 'AzureResourceInventory'

Write-Log 'Importing AzureResourceInventory'
Import-Module AzureResourceInventory -Force

Write-Log "Connecting to Azure tenant $TenantId as $AccountId using access token"
Connect-AzAccount -AccessToken $AccessToken -TenantId $TenantId -AccountId $AccountId -Environment $AzureEnvironment | Out-Null

if ($SubscriptionId) {
  Write-Log "Setting context to subscription $SubscriptionId"
  Set-AzContext -Tenant $TenantId -SubscriptionId $SubscriptionId | Out-Null
}

$invokeParams = @{ TenantID = $TenantId; ReportDir = $OutputDir; NoAutoUpdate = $true }
if ($SubscriptionId) { $invokeParams['SubscriptionID'] = $SubscriptionId }

Write-Log 'Starting Invoke-ARI'
Invoke-ARI @invokeParams
Write-Log 'Invoke-ARI completed'

$files = Get-ChildItem -Path $OutputDir -File | Select-Object Name, FullName, Length, LastWriteTime | Sort-Object LastWriteTime -Descending
$summary = @{ files = $files; tenantId = $TenantId; subscriptionId = $SubscriptionId; outputDir = $OutputDir }
$summary | ConvertTo-Json -Depth 6 | Write-Output
