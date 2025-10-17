#!/bin/bash
# Add Redirect URIs to Azure AD Application
# This script adds the required redirect URIs (reply URLs) to your app registration

set -e

APP_ID="${1:-9795693b-67cd-4165-b8a0-793833081db6}"
BASE_URL="${2:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}Azure AD Redirect URI Configuration${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}ERROR: Azure CLI is not installed.${NC}"
    echo -e "${YELLOW}Please install it from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli${NC}"
    echo ""
    echo -e "${YELLOW}Or add redirect URIs manually in Azure Portal:${NC}"
    echo -e "1. Go to https://portal.azure.com"
    echo -e "2. Navigate to ${WHITE}Azure Active Directory > App registrations${NC}"
    echo -e "3. Find your app (ID: ${WHITE}${APP_ID}${NC})"
    echo -e "4. Go to ${WHITE}Authentication > Add a platform > Web${NC}"
    echo -e "5. Add redirect URIs:"
    echo -e "   - ${GRAY}http://localhost:3000/auth/redirect${NC}"
    echo -e "   - ${GRAY}http://localhost:8000/getAToken${NC}"
    echo -e "   - ${GRAY}Your production URL/auth/redirect${NC}"
    exit 1
fi

# Check if user is logged in
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}Not logged in to Azure. Logging in...${NC}"
    az login
fi

TENANT=$(az account show --query tenantId -o tsv)
ACCOUNT=$(az account show --query user.name -o tsv)

echo -e "${GREEN}Connected to Azure:${NC}"
echo -e "  Tenant: ${WHITE}${TENANT}${NC}"
echo -e "  Account: ${WHITE}${ACCOUNT}${NC}"
echo ""

# Define redirect URIs to add
REDIRECT_URIS=()

# Add common development URLs
echo -e "${CYAN}Adding common development redirect URIs...${NC}"
REDIRECT_URIS+=("http://localhost:3000/auth/redirect")
REDIRECT_URIS+=("http://localhost:8000/getAToken")
REDIRECT_URIS+=("http://localhost:5000/auth/redirect")
REDIRECT_URIS+=("http://localhost:5000/getAToken")

# Add custom base URL if provided
if [ -n "$BASE_URL" ]; then
    echo -e "${CYAN}Adding custom redirect URIs for: ${BASE_URL}${NC}"
    REDIRECT_URIS+=("${BASE_URL}/auth/redirect")
    REDIRECT_URIS+=("${BASE_URL}/getAToken")
fi

echo ""
echo -e "${WHITE}Redirect URIs to add:${NC}"
for uri in "${REDIRECT_URIS[@]}"; do
    echo -e "  - ${GRAY}${uri}${NC}"
done
echo ""

# Get current redirect URIs
echo -e "${CYAN}Fetching current redirect URIs...${NC}"
CURRENT_URIS=$(az ad app show --id "$APP_ID" --query "web.redirectUris" -o json 2>/dev/null || echo "[]")

echo -e "${GREEN}Current redirect URIs:${NC}"
if [ "$CURRENT_URIS" = "[]" ] || [ "$CURRENT_URIS" = "null" ]; then
    echo -e "  ${GRAY}(none)${NC}"
else
    echo "$CURRENT_URIS" | jq -r '.[]' | while read -r uri; do
        echo -e "  - ${GRAY}${uri}${NC}"
    done
fi
echo ""

# Merge URIs (avoid duplicates)
ALL_URIS=$(echo "$CURRENT_URIS" | jq -r '.[]'; printf '%s\n' "${REDIRECT_URIS[@]}" | sort -u)
UNIQUE_URIS=$(echo "$ALL_URIS" | sort -u | jq -R . | jq -s .)

echo -e "${CYAN}Updating redirect URIs...${NC}"

# Update the app
if az ad app update --id "$APP_ID" --web-redirect-uris $(echo "$UNIQUE_URIS" | jq -r '.[]'); then
    echo -e "${GREEN}✓ Redirect URIs updated successfully!${NC}"
    echo ""
    echo -e "${GREEN}New redirect URIs:${NC}"
    echo "$UNIQUE_URIS" | jq -r '.[]' | while read -r uri; do
        echo -e "  - ${GRAY}${uri}${NC}"
    done
else
    echo -e "${RED}ERROR: Failed to update redirect URIs${NC}"
    echo ""
    echo -e "${YELLOW}Please add redirect URIs manually:${NC}"
    echo -e "1. Go to https://portal.azure.com"
    echo -e "2. Navigate to ${WHITE}Azure Active Directory > App registrations${NC}"
    echo -e "3. Find your app (ID: ${WHITE}${APP_ID}${NC})"
    echo -e "4. Go to ${WHITE}Authentication${NC}"
    echo -e "5. Under 'Web' platform, add redirect URIs:"
    for uri in "${REDIRECT_URIS[@]}"; do
        echo -e "   - ${GRAY}${uri}${NC}"
    done
    exit 1
fi

echo ""
echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}Important Configuration${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""
echo -e "${WHITE}Make sure your .env file has the correct redirect URI:${NC}"
echo ""
if [ -n "$BASE_URL" ]; then
    echo -e "${GRAY}REDIRECT_URI=${BASE_URL}/auth/redirect${NC}"
else
    echo -e "${GRAY}# For development, the app will auto-detect the redirect URI${NC}"
    echo -e "${GRAY}# For production, set:${NC}"
    echo -e "${GRAY}REDIRECT_URI=https://your-app.azurewebsites.net/auth/redirect${NC}"
fi
echo ""
echo -e "${WHITE}Verification URL:${NC}"
echo -e "${GRAY}https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Authentication/appId/${APP_ID}${NC}"
echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
