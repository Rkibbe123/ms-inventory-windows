#!/bin/bash

# Startup script for Azure App Service (Linux)
echo "Starting Azure Resource Inventory Web Application..."

# Ensure PowerShell is installed
if ! command -v pwsh &> /dev/null; then
    echo "PowerShell not found. Installing PowerShell..."
    # Install PowerShell dependencies
    apt-get update
    apt-get install -y wget apt-transport-https software-properties-common
    wget -q https://packages.microsoft.com/config/ubuntu/20.04/packages-microsoft-prod.deb
    dpkg -i packages-microsoft-prod.deb
    apt-get update
    apt-get install -y powershell
fi

# Install Azure PowerShell modules
echo "Installing Azure PowerShell modules..."
pwsh -Command "
    Set-PSRepository -Name PSGallery -InstallationPolicy Trusted
    if (-not (Get-Module -ListAvailable -Name Az.Accounts)) {
        Install-Module -Name Az.Accounts -Force -AllowClobber
    }
    if (-not (Get-Module -ListAvailable -Name AzureResourceInventory)) {
        Install-Module -Name AzureResourceInventory -Force -AllowClobber
    }
"

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Create necessary directories
mkdir -p flask_session
mkdir -p temp_output
mkdir -p temp_downloads

# Start Gunicorn
echo "Starting Gunicorn..."
gunicorn --bind=0.0.0.0:8000 --timeout 600 --workers 2 app:app
