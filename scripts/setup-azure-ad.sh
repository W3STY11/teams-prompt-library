#!/bin/bash

###############################################################################
# Teams Prompt Library - Azure AD App Registration Setup
# Configures Azure AD for Teams SSO with Nested App Authentication
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Azure AD App Registration Setup                          ║${NC}"
echo -e "${BLUE}║  Teams Prompt Library SSO Configuration                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if frontend URL is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Frontend URL required${NC}"
    echo "Usage: ./setup-azure-ad.sh <frontend-url>"
    echo "Example: ./setup-azure-ad.sh https://promptlib-frontend.azurestaticapps.net"
    exit 1
fi

FRONTEND_URL="$1"
APP_NAME="Teams Prompt Library"

echo -e "${YELLOW}[1/6]${NC} Creating Azure AD app registration..."

# Create app registration
APP_ID=$(az ad app create \
    --display-name "$APP_NAME" \
    --sign-in-audience AzureADMultipleOrgs \
    --web-redirect-uris "$FRONTEND_URL" "http://localhost:3000" \
    --enable-access-token-issuance true \
    --enable-id-token-issuance true \
    --query appId -o tsv)

echo -e "${GREEN}✓ App registered with ID: ${APP_ID}${NC}"

echo ""
echo -e "${YELLOW}[2/6]${NC} Configuring API permissions..."

# Add Microsoft Graph permissions
# User.Read - Read user profile
az ad app permission add \
    --id "$APP_ID" \
    --api 00000003-0000-0000-c000-000000000000 \
    --api-permissions e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope \
    --output none

# openid - Sign in
az ad app permission add \
    --id "$APP_ID" \
    --api 00000003-0000-0000-c000-000000000000 \
    --api-permissions 37f7f235-527c-4136-accd-4a02d197296e=Scope \
    --output none

# profile - Read user profile
az ad app permission add \
    --id "$APP_ID" \
    --api 00000003-0000-0000-c000-000000000000 \
    --api-permissions 14dad69e-099b-42c9-810b-d002981feec1=Scope \
    --output none

# email - Read user email
az ad app permission add \
    --id "$APP_ID" \
    --api 00000003-0000-0000-c000-000000000000 \
    --api-permissions 64a6cdd6-aab1-4aaf-94b8-3cc8405e90d0=Scope \
    --output none

echo -e "${GREEN}✓ API permissions configured${NC}"

echo ""
echo -e "${YELLOW}[3/6]${NC} Exposing API..."

# Generate unique scope ID
SCOPE_ID=$(uuidgen)

# Expose API scope for backend access
# Remove https:// prefix if present
FRONTEND_DOMAIN="${FRONTEND_URL#https://}"
az ad app update \
    --id "$APP_ID" \
    --identifier-uris "api://${FRONTEND_DOMAIN}/${APP_ID}" \
    --output none

# Add access_as_user scope
az rest --method POST \
    --uri "https://graph.microsoft.com/v1.0/applications/$(az ad app show --id $APP_ID --query id -o tsv)/api" \
    --headers 'Content-Type=application/json' \
    --body "{
        \"oauth2PermissionScopes\": [{
            \"adminConsentDescription\": \"Allows the app to access the prompt library on behalf of the signed-in user\",
            \"adminConsentDisplayName\": \"Access prompt library\",
            \"id\": \"${SCOPE_ID}\",
            \"isEnabled\": true,
            \"type\": \"User\",
            \"userConsentDescription\": \"Allows the app to access your prompts\",
            \"userConsentDisplayName\": \"Access your prompts\",
            \"value\": \"access_as_user\"
        }]
    }"

echo -e "${GREEN}✓ API exposed with access_as_user scope${NC}"

echo ""
echo -e "${YELLOW}[4/6]${NC} Creating client secret..."

# Create client secret (valid for 2 years)
SECRET_RESPONSE=$(az ad app credential reset \
    --id "$APP_ID" \
    --years 2 \
    --query password -o tsv)

echo -e "${GREEN}✓ Client secret created${NC}"
echo -e "${YELLOW}⚠️  IMPORTANT: Save this secret - it cannot be retrieved later!${NC}"

echo ""
echo -e "${YELLOW}[5/6]${NC} Configuring authentication..."

# Enable SPA flow
az ad app update \
    --id "$APP_ID" \
    --enable-access-token-issuance true \
    --enable-id-token-issuance true \
    --output none

# Set supported account types to multi-tenant
az ad app update \
    --id "$APP_ID" \
    --sign-in-audience AzureADMultipleOrgs \
    --output none

echo -e "${GREEN}✓ Authentication configured for multi-tenant SPA${NC}"

echo ""
echo -e "${YELLOW}[6/6]${NC} Getting tenant ID..."

TENANT_ID=$(az account show --query tenantId -o tsv)

echo -e "${GREEN}✓ Tenant ID retrieved${NC}"

###############################################################################
# Save Configuration
###############################################################################

echo ""
echo -e "${YELLOW}Saving configuration...${NC}"

cat > ../azure-ad-config.txt <<EOF
╔════════════════════════════════════════════════════════════╗
║  Azure AD App Registration - Configuration                ║
╚════════════════════════════════════════════════════════════╝

📅 Created: $(date)

🔑 Application Details:
   App Name:           ${APP_NAME}
   Application ID:     ${APP_ID}
   Tenant ID:          ${TENANT_ID}
   Client Secret:      ${SECRET_RESPONSE}

   ⚠️  CRITICAL: Save the client secret above! It cannot be retrieved later.

🌐 Redirect URIs:
   Production:         ${FRONTEND_URL}
   Development:        http://localhost:3000

🔐 API Permissions (Delegated):
   ✓ User.Read         - Read user profile
   ✓ openid            - Sign in users
   ✓ profile           - Read user profile info
   ✓ email             - Read user email address

🔧 Exposed API:
   URI:                api://${FRONTEND_URL}/${APP_ID}
   Scope:              access_as_user
   Description:        Access prompt library on behalf of user

📋 Environment Variables to Update:

   Frontend (.env.production):
   VITE_AZURE_CLIENT_ID=${APP_ID}
   VITE_TEAMS_APP_ID=${APP_ID}
   VITE_AZURE_TENANT_ID=${TENANT_ID}

   Backend (Container App secrets):
   AZURE_CLIENT_ID=${APP_ID}
   AZURE_TENANT_ID=${TENANT_ID}
   AZURE_CLIENT_SECRET=${SECRET_RESPONSE}

📱 Teams Manifest Updates Needed:

   {
     "id": "${APP_ID}",
     "webApplicationInfo": {
       "id": "${APP_ID}",
       "resource": "api://${FRONTEND_URL}/${APP_ID}"
     },
     "validDomains": [
       "${FRONTEND_URL#https://}",
       "login.microsoftonline.com"
     ]
   }

🔧 Next Steps:

   1. Grant admin consent (if required):
      https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/${APP_ID}

   2. Update frontend environment:
      cd src && echo "VITE_AZURE_CLIENT_ID=${APP_ID}" >> .env.production

   3. Update backend secrets:
      az containerapp secret set \\
        --name promptlib-api \\
        --resource-group teams-prompt-library-rg \\
        --secrets azure-client-secret="${SECRET_RESPONSE}"

   4. Update Teams manifest:
      Edit teams-package/manifest.json with the values above

   5. Test authentication:
      https://${FRONTEND_URL}

EOF

echo -e "${GREEN}✓ Configuration saved to azure-ad-config.txt${NC}"

###############################################################################
# Display Summary
###############################################################################

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ Azure AD Configuration Complete!                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📊 Application Created:${NC}"
echo -e "   App ID:        ${APP_ID}"
echo -e "   Tenant ID:     ${TENANT_ID}"
echo ""
echo -e "${YELLOW}⚠️  Client Secret: ${SECRET_RESPONSE}${NC}"
echo -e "   ${RED}Save this immediately! It cannot be retrieved later.${NC}"
echo ""
echo -e "${BLUE}🔧 Next Actions:${NC}"
echo -e "   1. Update frontend .env.production with VITE_AZURE_CLIENT_ID"
echo -e "   2. Update backend Container App secrets"
echo -e "   3. Update Teams manifest.json"
echo -e "   4. Rebuild and redeploy frontend"
echo ""
echo -e "${BLUE}📄 Full configuration: azure-ad-config.txt${NC}"
echo ""

# Optionally grant admin consent automatically (requires admin)
echo -e "${YELLOW}Would you like to grant admin consent now? (requires Global Admin) [y/N]${NC}"
read -r GRANT_CONSENT

if [[ "$GRANT_CONSENT" == "y" || "$GRANT_CONSENT" == "Y" ]]; then
    echo ""
    echo -e "${YELLOW}Granting admin consent...${NC}"

    az ad app permission admin-consent --id "$APP_ID" 2>/dev/null && \
        echo -e "${GREEN}✓ Admin consent granted${NC}" || \
        echo -e "${RED}✗ Failed to grant consent. Grant manually in Azure Portal${NC}"
fi

echo ""
echo -e "${GREEN}Setup complete! Review azure-ad-config.txt for next steps.${NC}"
