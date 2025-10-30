# Teams Prompt Library - Deployment Guide

Complete step-by-step guide to deploy the Teams Prompt Library to Azure.

## Prerequisites

- Azure subscription with Owner or Contributor permissions
- Microsoft 365 tenant with Teams admin access
- Azure CLI installed ([Install Azure CLI](https://docs.microsoft.com/cli/azure/install-azure-cli))
- Node.js 18+ installed
- Git installed

---

## Phase 1: Azure Resources Setup (30-45 minutes)

### Step 1: Log in to Azure

```bash
# Log in to Azure
az login

# Set your subscription (if you have multiple)
az account set --subscription "Your Subscription Name"

# Verify
az account show
```

### Step 2: Create Resource Group

```bash
# Create resource group
az group create \
  --name teams-prompt-library-rg \
  --location eastus

# Or choose another region: westus, westeurope, etc.
```

### Step 3: Create Azure SQL Database

**Option A: Using Azure CLI**

```bash
# Create SQL Server
az sql server create \
  --name prompt-library-sql \
  --resource-group teams-prompt-library-rg \
  --location eastus \
  --admin-user sqladmin \
  --admin-password "YourStrongPassword123!"

# Configure firewall (allow Azure services)
az sql server firewall-rule create \
  --resource-group teams-prompt-library-rg \
  --server prompt-library-sql \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Create database (S0 tier = $14.72/month)
az sql db create \
  --resource-group teams-prompt-library-rg \
  --server prompt-library-sql \
  --name promptlibrary \
  --edition Standard \
  --capacity 10 \
  --zone-redundant false

# Get connection string
az sql db show-connection-string \
  --client ado.net \
  --name promptlibrary \
  --server prompt-library-sql
```

**Option B: Using Azure Portal**

1. Go to [Azure Portal](https://portal.azure.com)
2. Create New Resource → SQL Database
3. Configure:
   - Database name: `promptlibrary`
   - Server: Create new `prompt-library-sql`
   - Compute tier: Standard S0 (10 DTUs)
   - Backup storage: Zone-redundant backup (optional)
4. Networking: Allow Azure services
5. Create

**Save these values:**
- Server name: `prompt-library-sql.database.windows.net`
- Admin username: `sqladmin`
- Admin password: (your password)

### Step 4: Deploy Database Schema

```bash
# Clone repository
git clone <your-repo-url>
cd teams-prompt-library1

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Edit .env with your SQL connection details
nano .env

# Run schema deployment
az sql db query \
  --server prompt-library-sql \
  --database promptlibrary \
  --admin-user sqladmin \
  --admin-password "YourPassword" \
  --file infra/database-schema.sql
```

**Or using SQL Server Management Studio (SSMS):**
1. Connect to `prompt-library-sql.database.windows.net`
2. Open `infra/database-schema.sql`
3. Execute script

### Step 5: Migrate Data (if coming from existing SPARK AI)

```bash
# Ensure .env is configured with SQL connection
npm run db:migrate -- path/to/prompts_index.json

# Or directly
node scripts/migrate-json-to-sql.js ./public/prompts_index.json
```

### Step 6: Create Azure Container Apps Environment

```bash
# Install Container Apps extension
az extension add --name containerapp --upgrade

# Register provider
az provider register --namespace Microsoft.App

# Create Log Analytics workspace
az monitor log-analytics workspace create \
  --resource-group teams-prompt-library-rg \
  --workspace-name prompt-library-logs \
  --location eastus

# Get workspace ID and key
WORKSPACE_ID=$(az monitor log-analytics workspace show \
  --resource-group teams-prompt-library-rg \
  --workspace-name prompt-library-logs \
  --query customerId -o tsv)

WORKSPACE_KEY=$(az monitor log-analytics workspace get-shared-keys \
  --resource-group teams-prompt-library-rg \
  --workspace-name prompt-library-logs \
  --query primarySharedKey -o tsv)

# Create Container Apps environment
az containerapp env create \
  --name prompt-library-env \
  --resource-group teams-prompt-library-rg \
  --location eastus \
  --logs-workspace-id $WORKSPACE_ID \
  --logs-workspace-key $WORKSPACE_KEY
```

### Step 7: Deploy API to Container Apps

```bash
# Build container image (using Docker)
# Note: You need Docker installed locally or use Azure Container Registry build

# Option A: Local build + push
docker build -t prompt-library-api:latest -f Dockerfile.api .
docker tag prompt-library-api:latest <your-acr>.azurecr.io/prompt-library-api:latest
docker push <your-acr>.azurecr.io/prompt-library-api:latest

# Option B: Azure Container Registry build
az acr create \
  --resource-group teams-prompt-library-rg \
  --name promptlibraryacr \
  --sku Basic

az acr build \
  --registry promptlibraryacr \
  --image prompt-library-api:latest \
  --file Dockerfile.api \
  .

# Create Container App
az containerapp create \
  --name prompt-library-api \
  --resource-group teams-prompt-library-rg \
  --environment prompt-library-env \
  --image promptlibraryacr.azurecr.io/prompt-library-api:latest \
  --target-port 3001 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 5 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --env-vars \
    SQL_SERVER="prompt-library-sql.database.windows.net" \
    SQL_DATABASE="promptlibrary" \
    SQL_USER="sqladmin" \
    SQL_PASSWORD="secretref:sql-password" \
    NODE_ENV="production"

# Set secrets
az containerapp secret set \
  --name prompt-library-api \
  --resource-group teams-prompt-library-rg \
  --secrets sql-password="YourPassword"

# Get API URL
az containerapp show \
  --name prompt-library-api \
  --resource-group teams-prompt-library-rg \
  --query properties.configuration.ingress.fqdn \
  -o tsv
```

**Save API URL:** `https://prompt-library-api.xxx.azurecontainerapps.io`

### Step 8: Create Azure Static Web App (Frontend)

```bash
# Create Static Web App
az staticwebapp create \
  --name prompt-library-frontend \
  --resource-group teams-prompt-library-rg \
  --location eastus2 \
  --sku Standard \
  --branch main \
  --app-location "/" \
  --output-location "dist" \
  --login-with-github

# Or deploy manually without GitHub integration
az staticwebapp create \
  --name prompt-library-frontend \
  --resource-group teams-prompt-library-rg \
  --location eastus2

# Build frontend locally
npm run build

# Get deployment token
DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
  --name prompt-library-frontend \
  --resource-group teams-prompt-library-rg \
  --query properties.apiKey -o tsv)

# Deploy using SWA CLI
npm install -g @azure/static-web-apps-cli
swa deploy ./dist \
  --deployment-token $DEPLOYMENT_TOKEN \
  --env production

# Get frontend URL
az staticwebapp show \
  --name prompt-library-frontend \
  --resource-group teams-prompt-library-rg \
  --query defaultHostname -o tsv
```

**Save Frontend URL:** `https://prompt-library-frontend.azurestaticapps.net`

---

## Phase 2: Azure AD App Registration (15-20 minutes)

### Step 1: Create Azure AD App Registration

**Via Azure Portal:**

1. Go to [Azure Portal](https://portal.azure.com) → Azure Active Directory → App registrations
2. Click "New registration"
3. Configure:
   - Name: `Teams Prompt Library`
   - Supported account types: `Accounts in any organizational directory (Any Azure AD directory - Multitenant)`
   - Redirect URI: `Single-page application (SPA)` → `https://prompt-library-frontend.azurestaticapps.net`
4. Click "Register"

**Save these values:**
- Application (client) ID: `12345678-1234-1234-1234-123456789012`
- Directory (tenant) ID: `87654321-4321-4321-4321-210987654321`

### Step 2: Configure API Permissions

1. In your app registration → API permissions
2. Click "Add a permission"
3. Microsoft Graph → Delegated permissions
4. Add:
   - `User.Read` (read user profile)
   - `openid` (sign in)
   - `profile` (basic profile)
   - `email` (email address)
5. Click "Grant admin consent" (requires admin)

### Step 3: Configure Authentication

1. App registration → Authentication
2. Platform configurations → Single-page application
   - Redirect URIs:
     - `https://prompt-library-frontend.azurestaticapps.net`
     - `http://localhost:3000` (for development)
3. Implicit grant and hybrid flows: ✅ Enable
4. Advanced settings:
   - Allow public client flows: No
   - Enable mobile and desktop flows: No
5. Save

### Step 4: Expose API (for backend)

1. App registration → Expose an API
2. Click "Add a scope"
3. Application ID URI: `api://prompt-library-frontend.azurestaticapps.net/12345678-1234-1234-1234-123456789012`
4. Add scope:
   - Scope name: `access_as_user`
   - Who can consent: Admins and users
   - Display name: `Access prompt library`
   - Description: `Allows the app to access the prompt library on behalf of the signed-in user`
5. Save

### Step 5: Create Client Secret (for backend)

1. App registration → Certificates & secrets
2. Click "New client secret"
3. Description: `Backend API Secret`
4. Expires: 24 months (or custom)
5. Click "Add"
6. **Copy the secret value immediately** (won't show again)

**Save:** Client Secret: `abc123...xyz`

---

## Phase 3: Teams App Configuration (10-15 minutes)

### Step 1: Update Teams App Manifest

Edit `teams-package/manifest.json`:

```json
{
  "id": "12345678-1234-1234-1234-123456789012",
  "webApplicationInfo": {
    "id": "12345678-1234-1234-1234-123456789012",
    "resource": "api://prompt-library-frontend.azurestaticapps.net/12345678-1234-1234-1234-123456789012"
  },
  "validDomains": [
    "prompt-library-frontend.azurestaticapps.net",
    "prompt-library-api.xxx.azurecontainerapps.io",
    "login.microsoftonline.com"
  ]
}
```

Replace:
- `{{TEAMS_APP_ID}}` → Your Azure AD App Client ID
- `{{TAB_DOMAIN}}` → Your Static Web App domain
- `{{AZURE_CLIENT_ID}}` → Your Azure AD App Client ID

### Step 2: Create App Package

```bash
cd teams-package
zip -r ../prompt-library-teams-app.zip manifest.json color.png outline.png
```

### Step 3: Upload to Teams

1. Go to Teams → Apps → Manage your apps
2. Click "Upload an app" → "Upload a custom app"
3. Select `prompt-library-teams-app.zip`
4. Click "Add"

**For Organization-wide deployment:**
1. Teams Admin Center → Teams apps → Manage apps
2. Upload custom app
3. Set permissions policy
4. Approve for organization

---

## Phase 4: Environment Configuration

### Frontend Environment Variables

Create `src/.env.production`:

```env
VITE_AZURE_CLIENT_ID=12345678-1234-1234-1234-123456789012
VITE_TEAMS_APP_ID=12345678-1234-1234-1234-123456789012
VITE_API_URL=https://prompt-library-api.xxx.azurecontainerapps.io
```

### Backend Environment Variables

Set in Container App:

```bash
az containerapp update \
  --name prompt-library-api \
  --resource-group teams-prompt-library-rg \
  --set-env-vars \
    AZURE_CLIENT_ID="12345678-1234-1234-1234-123456789012" \
    AZURE_TENANT_ID="common" \
    AZURE_CLIENT_SECRET="secretref:azure-client-secret" \
    SQL_SERVER="prompt-library-sql.database.windows.net" \
    SQL_DATABASE="promptlibrary" \
    SQL_USER="sqladmin" \
    SQL_PASSWORD="secretref:sql-password" \
    SQL_ENCRYPT="true" \
    NODE_ENV="production" \
    API_PORT="3001"
```

---

## Phase 5: Testing & Verification

### 1. Test API Health

```bash
curl https://prompt-library-api.xxx.azurecontainerapps.io/health
```

Expected: `{"status":"healthy"}`

### 2. Test Frontend

Open in browser:
```
https://prompt-library-frontend.azurestaticapps.net
```

Should show "Sign In with Microsoft" button.

### 3. Test in Teams

1. Open Teams desktop or web
2. Go to Apps → Your organization
3. Find "Teams Prompt Library"
4. Click "Add"
5. Verify:
   - App loads without errors
   - Authentication succeeds
   - Can browse prompts
   - Can favorite prompts

---

## Cost Summary

| Resource | Tier | Monthly Cost |
|----------|------|--------------|
| Azure SQL S0 | Standard 10 DTU | $14.72 |
| Container Apps | 0.5 vCPU, 1 GB | $0-10 (scale to zero) |
| Static Web App | Standard | $9 |
| Log Analytics | Basic | $2-5 |
| **Total** | | **~$26-39/month** |

**Cost Optimization Tips:**
- Container Apps scale to zero saves ~$60/month vs App Service
- SQL S0 sufficient for 2,376 items + 1,000 users
- Upgrade to SQL S1 ($30) if DTU usage >80%
- Monitor with Azure Cost Management

---

## Troubleshooting

### Issue: "Database connection failed"

**Solution:**
1. Check firewall rules allow Azure services
2. Verify SQL credentials in Container App environment variables
3. Test connection: `az sql db show-connection-string`

### Issue: "Token validation failed"

**Solution:**
1. Verify Azure AD App ID matches in manifest and frontend
2. Check `webApplicationInfo.resource` format correct
3. Grant admin consent for API permissions

### Issue: "App won't load in Teams"

**Solution:**
1. Verify `validDomains` includes all your domains
2. Check browser console for errors
3. Ensure HTTPS (not HTTP) for all URLs

### Issue: "Scale to zero not working"

**Solution:**
```bash
az containerapp update \
  --name prompt-library-api \
  --resource-group teams-prompt-library-rg \
  --min-replicas 0 \
  --max-replicas 5 \
  --scale-rule-name http-rule \
  --scale-rule-http-concurrency 10
```

---

## Maintenance

### Update Application

```bash
# Frontend
npm run build
swa deploy ./dist --deployment-token $DEPLOYMENT_TOKEN

# Backend
az containerapp update \
  --name prompt-library-api \
  --resource-group teams-prompt-library-rg \
  --image promptlibraryacr.azurecr.io/prompt-library-api:latest
```

### Database Backup

```bash
# Manual backup
az sql db export \
  --server prompt-library-sql \
  --name promptlibrary \
  --admin-user sqladmin \
  --admin-password "YourPassword" \
  --storage-key-type StorageAccessKey \
  --storage-key "your-storage-account-key" \
  --storage-uri "https://yourstorageaccount.blob.core.windows.net/backups/promptlibrary.bacpac"
```

---

## Next Steps

1. ✅ Complete Phase 1: Azure Resources
2. ✅ Complete Phase 2: Azure AD Setup
3. ✅ Complete Phase 3: Teams App Upload
4. ⏭️ Monitor with Application Insights
5. ⏭️ Set up CI/CD (GitHub Actions or Azure DevOps)
6. ⏭️ Complete Publisher Attestation for enterprise trust

**Support:** For issues, contact your IT admin or Azure support.
