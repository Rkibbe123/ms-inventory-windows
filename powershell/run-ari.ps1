param(
  [Parameter(Mandatory = $true)][string]$TenantId,
  [string]$SubscriptionId,
  [string]$AccessToken,
  [string]$AccountId,
  [string]$AppId,
  [string]$Secret,
  [Parameter(Mandatory = $true)][string]$OutputDir,
  [string]$AzureEnvironment = 'AzureCloud',
  [string]$ReportName = 'AzureResourceInventory'
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

# Support both service principal (AppId/Secret) and user delegation (AccessToken) authentication
if ($AppId -and $Secret) {
  Write-Log "Connecting to Azure tenant $TenantId using service principal $AppId"
  $SecurePassword = ConvertTo-SecureString -String $Secret -AsPlainText -Force
  $Credential = New-Object -TypeName System.Management.Automation.PSCredential -ArgumentList $AppId, $SecurePassword
  Connect-AzAccount -ServicePrincipal -TenantId $TenantId -Credential $Credential -Environment $AzureEnvironment | Out-Null
} elseif ($AccessToken -and $AccountId) {
  Write-Log "Connecting to Azure tenant $TenantId as $AccountId using access token"
  Connect-AzAccount -AccessToken $AccessToken -TenantId $TenantId -AccountId $AccountId -Environment $AzureEnvironment | Out-Null
} else {
  Write-Error "Must provide either (AppId + Secret) or (AccessToken + AccountId) for authentication"
  exit 1
}

if ($SubscriptionId) {
  Write-Log "Setting context to subscription $SubscriptionId"
  Set-AzContext -Tenant $TenantId -SubscriptionId $SubscriptionId | Out-Null
}

$invokeParams = @{ TenantID = $TenantId; ReportDir = $OutputDir; NoAutoUpdate = $true }
if ($SubscriptionId) { $invokeParams['SubscriptionID'] = $SubscriptionId }
if ($ReportName) { $invokeParams['ReportName'] = $ReportName }

Write-Log 'Starting Invoke-ARI'
Invoke-ARI @invokeParams
Write-Log 'Invoke-ARI completed'

$files = Get-ChildItem -Path $OutputDir -File | Select-Object Name, FullName, Length, LastWriteTime | Sort-Object LastWriteTime -Descending
$summary = @{ files = $files; tenantId = $TenantId; subscriptionId = $SubscriptionId; outputDir = $OutputDir }
$summary | ConvertTo-Json -Depth 6 | Write-Output
