#!/bin/bash
# Add API Permissions to Azure AD Application
# This script adds the required Azure Service Management API permission to your app registration

set -e

APP_ID="${1:-9795693b-67cd-4165-b8a0-793833081db6}"
GRANT_CONSENT="${2:-false}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}Azure AD API Permissions Setup${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}ERROR: Azure CLI is not installed.${NC}"
    echo -e "${YELLOW}Please install it from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli${NC}"
    exit 1
fi

# Check if user is logged in
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}Not logged in to Azure. Attempting to login...${NC}"
    az login
fi

TENANT=$(az account show --query tenantId -o tsv)
ACCOUNT=$(az account show --query user.name -o tsv)

echo -e "${GREEN}Connected to Azure:${NC}"
echo -e "  Tenant: ${WHITE}${TENANT}${NC}"
echo -e "  Account: ${WHITE}${ACCOUNT}${NC}"
echo ""

# Azure Service Management API details
ARM_API_ID="797f4846-ba00-4fd7-ba43-dac1f8f63013"  # Azure Service Management
PERMISSION_ID="41094075-9dad-400e-a0bd-54e686782033"  # user_impersonation

echo -e "${CYAN}Adding API Permission:${NC}"
echo -e "  App ID: ${WHITE}${APP_ID}${NC}"
echo -e "  API: ${WHITE}Azure Service Management${NC}"
echo -e "  Permission: ${WHITE}user_impersonation (Delegated)${NC}"
echo ""

# Add the permission
if az ad app permission add \
    --id "$APP_ID" \
    --api "$ARM_API_ID" \
    --api-permissions "${PERMISSION_ID}=Scope"; then
    
    echo -e "${GREEN}✓ API permission added successfully!${NC}"
    echo ""
    
    if [ "$GRANT_CONSENT" = "true" ] || [ "$GRANT_CONSENT" = "--grant-consent" ]; then
        echo -e "${CYAN}Granting admin consent...${NC}"
        if az ad app permission admin-consent --id "$APP_ID"; then
            echo -e "${GREEN}✓ Admin consent granted successfully!${NC}"
        else
            echo -e "${YELLOW}⚠ Failed to grant admin consent automatically.${NC}"
            echo -e "  ${YELLOW}Please grant consent manually in Azure Portal.${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ Admin consent not granted automatically.${NC}"
        echo -e "  ${YELLOW}To grant admin consent, run this script with --grant-consent flag${NC}"
        echo -e "  ${YELLOW}OR grant it manually in Azure Portal.${NC}"
    fi
else
    echo -e "${RED}ERROR: Failed to add permission${NC}"
    echo ""
    echo -e "${YELLOW}Please add the permission manually using Azure Portal:${NC}"
    echo -e "1. Go to https://portal.azure.com"
    echo -e "2. Navigate to ${WHITE}Azure Active Directory > App registrations${NC}"
    echo -e "3. Find your app (ID: ${WHITE}${APP_ID}${NC})"
    echo -e "4. Go to ${WHITE}API permissions > Add a permission${NC}"
    echo -e "5. Select ${WHITE}'Azure Service Management'${NC}"
    echo -e "6. Select ${WHITE}'Delegated permissions'${NC}"
    echo -e "7. Check ${WHITE}'user_impersonation'${NC}"
    echo -e "8. Click ${WHITE}'Add permissions'${NC}"
    echo -e "9. Click ${WHITE}'Grant admin consent for [Your Organization]'${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}Verification${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""
echo -e "${WHITE}To verify the permissions were added:${NC}"
echo -e "  ${WHITE}az ad app permission list --id ${APP_ID}${NC}"
echo ""
echo -e "${WHITE}Or check in Azure Portal:${NC}"
echo -e "  ${WHITE}https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/${APP_ID}${NC}"
echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
