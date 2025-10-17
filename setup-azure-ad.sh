#!/bin/bash
# Complete Azure AD Setup Script
# This script configures both redirect URIs and API permissions for your app

set -e

APP_ID="${1:-9795693b-67cd-4165-b8a0-793833081db6}"
PRODUCTION_URL="${2:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}==========================================${NC}"
echo -e "${CYAN}  Azure AD Complete Setup${NC}"
echo -e "${CYAN}==========================================${NC}"
echo ""
echo -e "${WHITE}This script will configure:${NC}"
echo -e "  ${GRAY}1. Redirect URIs (Reply URLs)${NC}"
echo -e "  ${GRAY}2. API Permissions${NC}"
echo ""
echo -e "${WHITE}App ID: ${APP_ID}${NC}"
echo ""

# Check if Azure CLI is available
if ! command -v az &> /dev/null; then
    echo -e "${RED}ERROR: Azure CLI is required but not found.${NC}"
    echo -e "${YELLOW}Please install from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli${NC}"
    exit 1
fi

# Check if logged in
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}Logging in to Azure...${NC}"
    az login
fi

echo -e "${GREEN}✓ Connected to Azure${NC}"
echo ""

# Step 1: Configure Redirect URIs
echo -e "${CYAN}==========================================${NC}"
echo -e "${CYAN}Step 1: Configuring Redirect URIs${NC}"
echo -e "${CYAN}==========================================${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REDIRECT_SCRIPT="${SCRIPT_DIR}/add-redirect-uris.sh"

if [ -f "$REDIRECT_SCRIPT" ]; then
    if [ -n "$PRODUCTION_URL" ]; then
        bash "$REDIRECT_SCRIPT" "$APP_ID" "$PRODUCTION_URL" || {
            echo -e "${YELLOW}⚠ Failed to configure redirect URIs${NC}"
            echo -e "${YELLOW}Please configure manually or run: ./add-redirect-uris.sh${NC}"
            echo ""
        }
    else
        bash "$REDIRECT_SCRIPT" "$APP_ID" || {
            echo -e "${YELLOW}⚠ Failed to configure redirect URIs${NC}"
            echo -e "${YELLOW}Please configure manually or run: ./add-redirect-uris.sh${NC}"
            echo ""
        }
    fi
else
    echo -e "${YELLOW}⚠ Redirect URI script not found: ${REDIRECT_SCRIPT}${NC}"
    echo -e "${YELLOW}Skipping redirect URI configuration${NC}"
    echo ""
fi

# Step 2: Configure API Permissions
echo -e "${CYAN}==========================================${NC}"
echo -e "${CYAN}Step 2: Configuring API Permissions${NC}"
echo -e "${CYAN}==========================================${NC}"
echo ""

PERMISSION_SCRIPT="${SCRIPT_DIR}/add-api-permissions.sh"

if [ -f "$PERMISSION_SCRIPT" ]; then
    bash "$PERMISSION_SCRIPT" --grant-consent || {
        echo -e "${YELLOW}⚠ Failed to configure API permissions${NC}"
        echo -e "${YELLOW}Please configure manually or run: ./add-api-permissions.sh${NC}"
        echo ""
    }
else
    echo -e "${YELLOW}⚠ API permission script not found: ${PERMISSION_SCRIPT}${NC}"
    echo -e "${YELLOW}Skipping API permission configuration${NC}"
    echo ""
fi

# Final Summary
echo ""
echo -e "${CYAN}==========================================${NC}"
echo -e "${CYAN}Setup Complete!${NC}"
echo -e "${CYAN}==========================================${NC}"
echo ""
echo -e "${WHITE}Next Steps:${NC}"
echo -e "${GRAY}1. Start your application:${NC}"
echo -e "   ${GRAY}node server.js${NC}"
echo ""
echo -e "${GRAY}2. Open in browser and test login${NC}"
echo -e "   ${GRAY}Enter your tenant ID when prompted${NC}"
echo ""
echo -e "${GRAY}3. Verify in Azure Portal:${NC}"
echo -e "   ${GRAY}https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/${APP_ID}${NC}"
echo ""
echo -e "${WHITE}Documentation:${NC}"
echo -e "  ${GRAY}- Quick Start: QUICK_START_GUIDE.md${NC}"
echo -e "  ${GRAY}- Redirect URIs: REDIRECT_URI_GUIDE.md${NC}"
echo -e "  ${GRAY}- Full Setup: AZURE_AD_SETUP.md${NC}"
echo ""
echo -e "${GREEN}✓ All done!${NC}"
echo ""
