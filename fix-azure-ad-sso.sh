#!/bin/bash

# ==============================================================================
# Azure AD Configuration Script for Teams SSO
# ==============================================================================
# This script configures Azure AD app registration for Microsoft Teams SSO
# with MSAL.js v2 (PublicClientApplication + NAA)
#
# Prerequisites:
# - Azure CLI installed and logged in with admin permissions
# - App ID: 68e9b7bd-1c92-407e-815b-30af21d30d09
# ==============================================================================

set -e

APP_ID="68e9b7bd-1c92-407e-815b-30af21d30d09"
APP_URI="api://polite-pond-0c32bd30f.3.azurestaticapps.net/$APP_ID"
FRONTEND_URL="https://polite-pond-0c32bd30f.3.azurestaticapps.net"

echo "=============================================================================="
echo "Configuring Azure AD for Teams SSO"
echo "=============================================================================="
echo ""
echo "App ID: $APP_ID"
echo "Frontend URL: $FRONTEND_URL"
echo ""

# Step 1: Add SPA Redirect URIs
echo "[1/5] Adding SPA redirect URIs for MSAL v2..."
az ad app update --id $APP_ID \
  --spa-redirect-uris "$FRONTEND_URL" "http://localhost:3000" \
  && echo "✓ SPA redirect URIs configured" || echo "✗ Failed to add SPA redirect URIs"

echo ""

# Step 2: Set Application ID URI
echo "[2/5] Setting Application ID URI..."
az ad app update --id $APP_ID \
  --identifier-uris "$APP_URI" \
  && echo "✓ Application ID URI set to: $APP_URI" || echo "✗ Failed to set Application ID URI"

echo ""

# Step 3: Add Microsoft Graph API permissions
echo "[3/5] Adding Microsoft Graph API permissions..."

# Microsoft Graph API ID
GRAPH_API_ID="00000003-0000-0000-c000-000000000000"

# Permission IDs from Microsoft Graph
USER_READ_ID="e1fe6dd8-ba31-4d61-89e7-88639da4683d"      # User.Read (Delegated)
OPENID_ID="37f7f235-527c-4136-accd-4a02d197296e"         # openid (Delegated)
PROFILE_ID="14dad69e-099b-42c9-810b-d002981feec1"        # profile (Delegated)
EMAIL_ID="64a6cdd6-aab1-4aaf-94b8-3cc8405e90d0"          # email (Delegated)

az ad app permission add --id $APP_ID \
  --api $GRAPH_API_ID \
  --api-permissions \
    "$USER_READ_ID=Scope" \
    "$OPENID_ID=Scope" \
    "$PROFILE_ID=Scope" \
    "$EMAIL_ID=Scope" \
  && echo "✓ Microsoft Graph permissions added" || echo "✗ Failed to add Graph permissions"

echo ""

# Step 4: Grant admin consent
echo "[4/5] Granting admin consent for API permissions..."
az ad app permission admin-consent --id $APP_ID \
  && echo "✓ Admin consent granted" || echo "✗ Failed to grant admin consent (may require Global Administrator role)"

echo ""

# Step 5: Add access_as_user scope to Expose an API
echo "[5/5] Adding access_as_user scope to Expose an API..."

# Generate a new GUID for the scope ID
SCOPE_ID=$(uuidgen)

# Create the scope configuration
SCOPE_JSON=$(cat <<EOF
{
  "oauth2PermissionScopes": [
    {
      "adminConsentDescription": "Allows Teams to access the Prompt Library on behalf of the signed-in user.",
      "adminConsentDisplayName": "Access Prompt Library as user",
      "id": "$SCOPE_ID",
      "isEnabled": true,
      "type": "User",
      "userConsentDescription": "Allows Teams to access your Prompt Library data.",
      "userConsentDisplayName": "Access your Prompt Library",
      "value": "access_as_user"
    }
  ]
}
EOF
)

# Update the app with the new scope
az ad app update --id $APP_ID \
  --set api="$SCOPE_JSON" \
  && echo "✓ access_as_user scope added" || echo "✗ Failed to add access_as_user scope"

echo ""
echo "=============================================================================="
echo "Azure AD Configuration Complete!"
echo "=============================================================================="
echo ""
echo "Configuration Summary:"
echo "  ✓ SPA Redirect URIs: $FRONTEND_URL, http://localhost:3000"
echo "  ✓ Application ID URI: $APP_URI"
echo "  ✓ Microsoft Graph Permissions: User.Read, openid, profile, email"
echo "  ✓ Admin Consent: Granted"
echo "  ✓ Exposed API Scope: access_as_user"
echo ""
echo "Next Steps:"
echo "  1. Wait for GitHub Actions to complete frontend deployment (~5 minutes)"
echo "  2. Verify deployment at: $FRONTEND_URL"
echo "  3. Test Teams app by uploading teams-package/PromptLibrary.zip"
echo ""
echo "=============================================================================="
