#!/bin/bash

###############################################################################
# Teams Prompt Library - Azure Deployment Script
# Automated deployment to Azure with error handling and validation
###############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="teams-prompt-library-rg"
LOCATION="eastus2"
SQL_SERVER_NAME="promptlib-sql-$(date +%s)"
SQL_DATABASE_NAME="promptlibrary"
SQL_ADMIN_USER="sqladmin"
CONTAINER_ENV_NAME="promptlib-env"
CONTAINER_APP_NAME="promptlib-api"
STATIC_WEB_APP_NAME="promptlib-frontend"
LOG_ANALYTICS_WORKSPACE="promptlib-logs"

# Generate secure password
SQL_ADMIN_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Teams Prompt Library - Azure Deployment                  ║${NC}"
echo -e "${BLUE}║  Multi-tenant Enterprise Prompt Management                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

###############################################################################
# Step 1: Verify Azure CLI and Login
###############################################################################

echo -e "${YELLOW}[1/10]${NC} Verifying Azure CLI..."

if ! command -v az &> /dev/null; then
    echo -e "${RED}✗ Azure CLI is not installed${NC}"
    echo "Install from: https://docs.microsoft.com/cli/azure/install-azure-cli"
    exit 1
fi

echo -e "${GREEN}✓ Azure CLI found ($(az version --query \"azure-cli\" -o tsv))${NC}"

echo ""
echo -e "${YELLOW}[2/10]${NC} Logging in to Azure..."

# Check if already logged in
if ! az account show &> /dev/null; then
    az login
fi

SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
echo -e "${GREEN}✓ Logged in to subscription: ${SUBSCRIPTION_NAME}${NC}"

###############################################################################
# Step 2: Create Resource Group
###############################################################################

echo ""
echo -e "${YELLOW}[3/10]${NC} Creating resource group..."

az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output none

echo -e "${GREEN}✓ Resource group '${RESOURCE_GROUP}' created in ${LOCATION}${NC}"

###############################################################################
# Step 3: Create Azure SQL Server and Database
###############################################################################

echo ""
echo -e "${YELLOW}[4/10]${NC} Creating Azure SQL Server..."

az sql server create \
  --name "$SQL_SERVER_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --admin-user "$SQL_ADMIN_USER" \
  --admin-password "$SQL_ADMIN_PASSWORD" \
  --output none

echo -e "${GREEN}✓ SQL Server '${SQL_SERVER_NAME}' created${NC}"

echo ""
echo -e "${YELLOW}[4/10]${NC} Configuring SQL Server firewall..."

# Allow Azure services
az sql server firewall-rule create \
  --resource-group "$RESOURCE_GROUP" \
  --server "$SQL_SERVER_NAME" \
  --name "AllowAzureServices" \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0 \
  --output none

# Allow your current IP
MY_IP=$(curl -s https://api.ipify.org)
az sql server firewall-rule create \
  --resource-group "$RESOURCE_GROUP" \
  --server "$SQL_SERVER_NAME" \
  --name "AllowMyIP" \
  --start-ip-address "$MY_IP" \
  --end-ip-address "$MY_IP" \
  --output none

echo -e "${GREEN}✓ Firewall rules configured (Azure services + your IP: ${MY_IP})${NC}"

echo ""
echo -e "${YELLOW}[4/10]${NC} Creating SQL Database (S0 tier)..."

az sql db create \
  --resource-group "$RESOURCE_GROUP" \
  --server "$SQL_SERVER_NAME" \
  --name "$SQL_DATABASE_NAME" \
  --edition Standard \
  --capacity 10 \
  --zone-redundant false \
  --output none

echo -e "${GREEN}✓ SQL Database '${SQL_DATABASE_NAME}' created (S0 tier - $14.72/month)${NC}"

###############################################################################
# Step 4: Deploy Database Schema
###############################################################################

echo ""
echo -e "${YELLOW}[5/10]${NC} Deploying database schema..."

# Save connection string
SQL_CONNECTION_STRING="Server=${SQL_SERVER_NAME}.database.windows.net;Database=${SQL_DATABASE_NAME};User Id=${SQL_ADMIN_USER};Password=${SQL_ADMIN_PASSWORD};Encrypt=true;"

# Deploy schema using sqlcmd (if available) or output instructions
if command -v sqlcmd &> /dev/null; then
    sqlcmd -S "${SQL_SERVER_NAME}.database.windows.net" \
           -d "$SQL_DATABASE_NAME" \
           -U "$SQL_ADMIN_USER" \
           -P "$SQL_ADMIN_PASSWORD" \
           -i "../infra/database-schema.sql" \
           -b
    echo -e "${GREEN}✓ Database schema deployed successfully${NC}"
else
    echo -e "${YELLOW}⚠ sqlcmd not found. Schema deployment skipped.${NC}"
    echo -e "Deploy manually: az sql db query --server ${SQL_SERVER_NAME} --database ${SQL_DATABASE_NAME} --admin-user ${SQL_ADMIN_USER} --admin-password '${SQL_ADMIN_PASSWORD}' --file infra/database-schema.sql"
fi

###############################################################################
# Step 5: Create Container Apps Environment
###############################################################################

echo ""
echo -e "${YELLOW}[6/10]${NC} Creating Container Apps environment..."

# Install Container Apps extension
az extension add --name containerapp --upgrade --only-show-errors

# Register provider
az provider register --namespace Microsoft.App --wait

# Create Log Analytics workspace
az monitor log-analytics workspace create \
  --resource-group "$RESOURCE_GROUP" \
  --workspace-name "$LOG_ANALYTICS_WORKSPACE" \
  --location "$LOCATION" \
  --output none

echo -e "${GREEN}✓ Log Analytics workspace created${NC}"

# Get workspace credentials
WORKSPACE_ID=$(az monitor log-analytics workspace show \
  --resource-group "$RESOURCE_GROUP" \
  --workspace-name "$LOG_ANALYTICS_WORKSPACE" \
  --query customerId -o tsv)

WORKSPACE_KEY=$(az monitor log-analytics workspace get-shared-keys \
  --resource-group "$RESOURCE_GROUP" \
  --workspace-name "$LOG_ANALYTICS_WORKSPACE" \
  --query primarySharedKey -o tsv)

# Create Container Apps environment
az containerapp env create \
  --name "$CONTAINER_ENV_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --logs-workspace-id "$WORKSPACE_ID" \
  --logs-workspace-key "$WORKSPACE_KEY" \
  --output none

echo -e "${GREEN}✓ Container Apps environment created${NC}"

###############################################################################
# Step 6: Build and Deploy API Container
###############################################################################

echo ""
echo -e "${YELLOW}[7/10]${NC} Building and deploying API container..."

# Create Dockerfile for API
cat > ../server/Dockerfile <<'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server/ ./server/
EXPOSE 3001
CMD ["node", "server/api.js"]
EOF

# Deploy using source code (Container Apps will build the image)
az containerapp create \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$CONTAINER_ENV_NAME" \
  --source ../server \
  --target-port 3001 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 5 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --env-vars \
    SQL_SERVER="${SQL_SERVER_NAME}.database.windows.net" \
    SQL_DATABASE="$SQL_DATABASE_NAME" \
    SQL_USER="$SQL_ADMIN_USER" \
    SQL_PASSWORD="secretref:sql-password" \
    SQL_ENCRYPT="true" \
    NODE_ENV="production" \
    API_PORT="3001" \
  --secrets sql-password="$SQL_ADMIN_PASSWORD" \
  --output none

# Get API URL
API_URL=$(az containerapp show \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query properties.configuration.ingress.fqdn \
  -o tsv)

echo -e "${GREEN}✓ API deployed to: https://${API_URL}${NC}"

###############################################################################
# Step 7: Create and Deploy Static Web App
###############################################################################

echo ""
echo -e "${YELLOW}[8/10]${NC} Creating Azure Static Web App..."

az staticwebapp create \
  --name "$STATIC_WEB_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku Standard \
  --output none

# Get deployment token
DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
  --name "$STATIC_WEB_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query properties.apiKey -o tsv)

echo -e "${GREEN}✓ Static Web App created${NC}"

echo ""
echo -e "${YELLOW}[8/10]${NC} Building and deploying frontend..."

# Create production environment file
cat > ../src/.env.production <<EOF
VITE_API_URL=https://${API_URL}/api
VITE_TEAMS_APP_ID=<AZURE_CLIENT_ID>
EOF

# Build frontend
cd ../src && npm run build

# Deploy using SWA CLI
npx @azure/static-web-apps-cli deploy ./dist \
  --deployment-token "$DEPLOYMENT_TOKEN" \
  --env production

FRONTEND_URL=$(az staticwebapp show \
  --name "$STATIC_WEB_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query defaultHostname -o tsv)

echo -e "${GREEN}✓ Frontend deployed to: https://${FRONTEND_URL}${NC}"

###############################################################################
# Step 8: Save Deployment Information
###############################################################################

echo ""
echo -e "${YELLOW}[9/10]${NC} Saving deployment configuration..."

cat > ../deployment-info.txt <<EOF
╔════════════════════════════════════════════════════════════╗
║  Teams Prompt Library - Deployment Information            ║
╚════════════════════════════════════════════════════════════╝

📅 Deployed: $(date)

🔷 Azure Resources:
   Resource Group:     ${RESOURCE_GROUP}
   Location:           ${LOCATION}

🗄️  SQL Database:
   Server:             ${SQL_SERVER_NAME}.database.windows.net
   Database:           ${SQL_DATABASE_NAME}
   Admin User:         ${SQL_ADMIN_USER}
   Admin Password:     ${SQL_ADMIN_PASSWORD}
   Connection String:  ${SQL_CONNECTION_STRING}

   ⚠️  IMPORTANT: Save this password securely! It cannot be retrieved later.

🌐 API:
   URL:                https://${API_URL}
   Health Check:       https://${API_URL}/health
   Scaling:            0-5 replicas (scale-to-zero enabled)

🌐 Frontend:
   URL:                https://${FRONTEND_URL}

💰 Estimated Monthly Cost:
   - SQL S0:           $14.72
   - Container Apps:   $0-10 (scale-to-zero)
   - Static Web App:   $9
   - Total:            ~$24-34/month

📋 Next Steps:
   1. Create Azure AD app registration
   2. Update VITE_TEAMS_APP_ID in .env.production
   3. Update Teams manifest with URLs
   4. Deploy database schema (if not done automatically)
   5. Test API health: curl https://${API_URL}/health
   6. Upload Teams app package

🔧 Management Commands:
   # View logs
   az containerapp logs show --name ${CONTAINER_APP_NAME} --resource-group ${RESOURCE_GROUP} --follow

   # Scale API
   az containerapp update --name ${CONTAINER_APP_NAME} --resource-group ${RESOURCE_GROUP} --min-replicas 1

   # Update frontend
   cd src && npm run build && npx @azure/static-web-apps-cli deploy ./dist --deployment-token ${DEPLOYMENT_TOKEN}

   # Delete all resources
   az group delete --name ${RESOURCE_GROUP} --yes --no-wait

EOF

echo -e "${GREEN}✓ Deployment info saved to deployment-info.txt${NC}"

###############################################################################
# Step 9: Verify Deployment
###############################################################################

echo ""
echo -e "${YELLOW}[10/10]${NC} Verifying deployment..."

# Test API health
if curl -sf "https://${API_URL}/health" > /dev/null; then
    echo -e "${GREEN}✓ API health check passed${NC}"
else
    echo -e "${RED}✗ API health check failed${NC}"
fi

# Test frontend
if curl -sf "https://${FRONTEND_URL}" > /dev/null; then
    echo -e "${GREEN}✓ Frontend is accessible${NC}"
else
    echo -e "${RED}✗ Frontend is not accessible${NC}"
fi

###############################################################################
# Deployment Complete
###############################################################################

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ Deployment Complete!                                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📊 Resources Created:${NC}"
echo -e "   • SQL Server: ${SQL_SERVER_NAME}.database.windows.net"
echo -e "   • SQL Database: ${SQL_DATABASE_NAME} (S0 tier)"
echo -e "   • API: https://${API_URL}"
echo -e "   • Frontend: https://${FRONTEND_URL}"
echo ""
echo -e "${YELLOW}⚠️  Save SQL password: ${SQL_ADMIN_PASSWORD}${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo -e "   1. Create Azure AD app registration"
echo -e "   2. Configure authentication (see DEPLOYMENT.md)"
echo -e "   3. Update Teams manifest with URLs"
echo -e "   4. Upload Teams app package"
echo ""
echo -e "${BLUE}📄 Full deployment details: deployment-info.txt${NC}"
echo ""
