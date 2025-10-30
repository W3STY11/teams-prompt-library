# Teams Prompt Library - Deployment Quickstart

**Estimated Time:** 1-2 hours for complete end-to-end deployment

This guide provides the fastest path to production deployment on Azure.

---

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] **Azure subscription** with Owner or Contributor access
- [ ] **Azure CLI** installed and updated (`az --version` should be 2.50+)
- [ ] **Node.js 18+** installed (`node --version`)
- [ ] **Microsoft 365 tenant** with Teams admin access
- [ ] **Git** installed
- [ ] **Terminal/Shell** access (bash, zsh, or WSL on Windows)

### Quick Prerequisites Check

```bash
# Check all prerequisites
az --version          # Should show Azure CLI 2.50+
node --version        # Should show v18+
npm --version         # Should show 9+
git --version         # Any recent version
```

---

## Phase 1: Azure Infrastructure (30-45 minutes)

### Step 1: Clone and Prepare

```bash
cd /home/aiwithnick/teams-prompt-library1

# Install dependencies
npm install

# Verify project structure
ls -la
```

### Step 2: Deploy Azure Resources

This single script provisions everything:
- Azure SQL Server + Database (S0 tier)
- Container Apps environment
- Express API deployment
- Static Web App
- Log Analytics workspace

```bash
cd scripts
./deploy-azure.sh
```

**What happens:**
1. Creates resource group
2. Provisions SQL Server with secure password
3. Creates SQL Database (S0 - $14.72/month)
4. Deploys database schema
5. Creates Container Apps environment
6. Builds and deploys API container (scale-to-zero enabled)
7. Creates Static Web App
8. Builds and deploys React frontend
9. Configures networking and firewall rules
10. Saves all credentials to `deployment-info.txt`

**Expected Duration:** 20-30 minutes

**Output:** You'll see green ✓ checkmarks for each step. At the end, you'll get:
- API URL: `https://promptlib-api-XXXXX.eastus.azurecontainer.io`
- Frontend URL: `https://promptlib-frontend.azurestaticapps.net`
- SQL credentials (save these!)

### Step 3: Verify Deployment

```bash
# Check API health
curl https://YOUR-API-URL/health

# Expected output: {"status":"healthy","database":"connected"}

# Check frontend
curl https://YOUR-FRONTEND-URL

# Expected: HTML content of your React app
```

---

## Phase 2: Azure AD Configuration (15-20 minutes)

### Step 4: Create Azure AD App Registration

This script configures authentication for Teams SSO:

```bash
cd scripts
./setup-azure-ad.sh https://YOUR-FRONTEND-URL
```

**Example:**
```bash
./setup-azure-ad.sh https://promptlib-frontend.azurestaticapps.net
```

**What happens:**
1. Creates multi-tenant Azure AD app
2. Configures redirect URIs
3. Adds Microsoft Graph permissions (User.Read, openid, profile, email)
4. Exposes API with `access_as_user` scope
5. Creates client secret (2-year expiry)
6. Saves configuration to `azure-ad-config.txt`

**CRITICAL:** The script outputs a **client secret** that cannot be retrieved later. Save it immediately!

**Output:**
```
Application ID:     12345678-1234-1234-1234-123456789012
Tenant ID:          87654321-4321-4321-4321-210987654321
Client Secret:      ABC123...XYZ (save this!)
```

### Step 5: Update Environment Variables

**Frontend (.env.production):**
```bash
cd /home/aiwithnick/teams-prompt-library1/src

cat > .env.production <<EOF
VITE_API_URL=https://YOUR-API-URL/api
VITE_AZURE_CLIENT_ID=YOUR-APP-ID
VITE_TEAMS_APP_ID=YOUR-APP-ID
VITE_AZURE_TENANT_ID=YOUR-TENANT-ID
EOF
```

**Backend (Container App secrets):**
```bash
az containerapp secret set \
  --name promptlib-api \
  --resource-group teams-prompt-library-rg \
  --secrets \
    azure-client-id="YOUR-APP-ID" \
    azure-tenant-id="YOUR-TENANT-ID" \
    azure-client-secret="YOUR-CLIENT-SECRET"

# Update environment variables to use secrets
az containerapp update \
  --name promptlib-api \
  --resource-group teams-prompt-library-rg \
  --set-env-vars \
    AZURE_CLIENT_ID="secretref:azure-client-id" \
    AZURE_TENANT_ID="secretref:azure-tenant-id" \
    AZURE_CLIENT_SECRET="secretref:azure-client-secret"
```

### Step 6: Rebuild and Redeploy Frontend

```bash
cd /home/aiwithnick/teams-prompt-library1/src

# Build with new environment variables
npm run build

# Get deployment token
DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
  --name promptlib-frontend \
  --resource-group teams-prompt-library-rg \
  --query properties.apiKey -o tsv)

# Deploy
npx @azure/static-web-apps-cli deploy ./dist \
  --deployment-token $DEPLOYMENT_TOKEN \
  --env production
```

---

## Phase 3: Teams App Configuration (10-15 minutes)

### Step 7: Update Teams Manifest

Edit `teams-package/manifest.json`:

```json
{
  "id": "YOUR-AZURE-CLIENT-ID",
  "version": "1.0.0",
  "manifestVersion": "1.17",
  "name": {
    "short": "Prompt Library",
    "full": "Teams Prompt Library - 2376+ AI Prompts"
  },
  "developer": {
    "name": "Your Organization",
    "websiteUrl": "https://YOUR-FRONTEND-URL",
    "privacyUrl": "https://YOUR-FRONTEND-URL/privacy",
    "termsOfUseUrl": "https://YOUR-FRONTEND-URL/terms"
  },
  "staticTabs": [
    {
      "entityId": "promptLibraryHome",
      "name": "Browse",
      "contentUrl": "https://YOUR-FRONTEND-URL/browse",
      "scopes": ["personal"]
    },
    {
      "entityId": "favorites",
      "name": "Favorites",
      "contentUrl": "https://YOUR-FRONTEND-URL/favorites",
      "scopes": ["personal"]
    }
  ],
  "webApplicationInfo": {
    "id": "YOUR-AZURE-CLIENT-ID",
    "resource": "api://YOUR-FRONTEND-URL/YOUR-AZURE-CLIENT-ID"
  },
  "validDomains": [
    "YOUR-FRONTEND-URL-WITHOUT-HTTPS",
    "YOUR-API-URL-WITHOUT-HTTPS",
    "login.microsoftonline.com"
  ]
}
```

**Example values:**
- `YOUR-AZURE-CLIENT-ID`: `12345678-1234-1234-1234-123456789012`
- `YOUR-FRONTEND-URL`: `promptlib-frontend.azurestaticapps.net` (no https://)
- `YOUR-API-URL`: `promptlib-api-xxx.eastus.azurecontainer.io` (no https://)

### Step 8: Create App Package

```bash
cd teams-package

# Create placeholder icons (if not already created)
# For now, use simple colored squares
convert -size 192x192 xc:blue color.png
convert -size 32x32 xc:blue outline.png

# Or download existing icons
# wget https://example.com/your-color-icon.png -O color.png
# wget https://example.com/your-outline-icon.png -O outline.png

# Package the app
zip -r ../prompt-library-teams-app.zip manifest.json color.png outline.png

cd ..
```

### Step 9: Upload to Teams

**Option A: For Testing (Personal Scope)**
1. Open Microsoft Teams
2. Click **Apps** in the sidebar
3. Click **Manage your apps** (bottom left)
4. Click **Upload an app** → **Upload a custom app**
5. Select `prompt-library-teams-app.zip`
6. Click **Add**

**Option B: Organization-Wide Deployment**
1. Go to [Teams Admin Center](https://admin.teams.microsoft.com)
2. Navigate to **Teams apps** → **Manage apps**
3. Click **Upload new app**
4. Upload `prompt-library-teams-app.zip`
5. Set app availability policies
6. Publish to your organization

---

## Phase 4: Verification & Testing (15-30 minutes)

### Step 10: Test API Endpoints

```bash
# Health check
curl https://YOUR-API-URL/health

# Departments (no auth required)
curl https://YOUR-API-URL/api/departments

# Get an access token (use Azure AD)
# For testing, use Postman or Azure Portal to get a token

# Test authenticated endpoint
curl -H "Authorization: Bearer YOUR-TOKEN" \
  https://YOUR-API-URL/api/prompts
```

### Step 11: Test Frontend in Browser

1. Open `https://YOUR-FRONTEND-URL` in browser
2. You should see the sign-in page
3. Click **Sign In with Microsoft**
4. Grant consent if prompted
5. Verify you can:
   - Browse prompts
   - Search and filter
   - View a prompt
   - Add to favorites
   - Copy prompt to clipboard

### Step 12: Test in Teams

1. Open Teams desktop or web client
2. Find your app in **Apps** → **Built for your org**
3. Click **Add**
4. Verify:
   - App loads without errors
   - Authentication succeeds automatically (SSO)
   - Browse page displays prompts
   - Search works
   - Can view individual prompts
   - Favorites sync across devices
   - Share to Teams works

### Step 13: Test SSO Flow

The most critical test:

1. **Open app in Teams** → Should authenticate automatically (no login prompt)
2. **Browse prompts** → Should load from API with your tenant's data
3. **Add a favorite** → Should save to SQL database
4. **Open in Teams web** → Favorites should be synced
5. **Share a prompt** → Should create Teams deep link

---

## Troubleshooting

### API Returns 401 Unauthorized

**Cause:** Token validation failing

**Fix:**
```bash
# Verify Azure AD configuration
az ad app show --id YOUR-APP-ID

# Check Container App environment variables
az containerapp show --name promptlib-api --resource-group teams-prompt-library-rg \
  --query properties.template.containers[0].env

# Restart Container App
az containerapp restart --name promptlib-api --resource-group teams-prompt-library-rg
```

### Database Connection Failed

**Cause:** SQL firewall rules or credentials

**Fix:**
```bash
# Check firewall rules
az sql server firewall-rule list \
  --server YOUR-SQL-SERVER \
  --resource-group teams-prompt-library-rg

# Add your IP if needed
MY_IP=$(curl -s https://api.ipify.org)
az sql server firewall-rule create \
  --server YOUR-SQL-SERVER \
  --resource-group teams-prompt-library-rg \
  --name "AllowMyIP" \
  --start-ip-address $MY_IP \
  --end-ip-address $MY_IP
```

### Frontend Shows "Network Error"

**Cause:** CORS or API URL misconfiguration

**Fix:**
```bash
# Verify API URL in frontend
cat src/.env.production

# Check CORS settings in Container App
# Should allow YOUR-FRONTEND-URL origin

# Rebuild and redeploy frontend
cd src && npm run build
npx @azure/static-web-apps-cli deploy ./dist --deployment-token $DEPLOYMENT_TOKEN
```

### Teams App Won't Load

**Cause:** Manifest configuration or valid domains

**Fix:**
1. Validate manifest at [Teams Developer Portal](https://dev.teams.microsoft.com/apps)
2. Ensure `validDomains` includes your frontend and API domains (without `https://`)
3. Verify `webApplicationInfo.resource` matches Azure AD exposed API URI
4. Check that all URLs use HTTPS (not HTTP)

---

## Monitoring & Maintenance

### View API Logs

```bash
# Live logs
az containerapp logs show \
  --name promptlib-api \
  --resource-group teams-prompt-library-rg \
  --follow

# Recent logs
az containerapp logs show \
  --name promptlib-api \
  --resource-group teams-prompt-library-rg \
  --tail 100
```

### Check Database Health

```bash
# Connect to SQL
sqlcmd -S YOUR-SQL-SERVER.database.windows.net \
       -d promptlibrary \
       -U sqladmin \
       -P YOUR-PASSWORD

# Check prompt count
SELECT COUNT(*) FROM prompts;

# Check favorites
SELECT COUNT(*) FROM favorites;

# Check audit log
SELECT TOP 10 * FROM audit_log ORDER BY timestamp DESC;
```

### Monitor Costs

```bash
# View cost analysis
az consumption usage list \
  --start-date $(date -d '30 days ago' +%Y-%m-%d) \
  --end-date $(date +%Y-%m-%d) \
  --query "[?contains(instanceName, 'promptlib')]"

# Expected monthly costs:
# - SQL S0: $14.72
# - Container Apps: $0-10 (scale-to-zero)
# - Static Web App: $9
# Total: ~$24-34/month
```

---

## Cleanup (If Needed)

To delete all resources and stop incurring costs:

```bash
# Delete entire resource group (WARNING: This is permanent!)
az group delete \
  --name teams-prompt-library-rg \
  --yes \
  --no-wait

# Also delete Azure AD app registration
az ad app delete --id YOUR-APP-ID
```

---

## Next Steps

Once deployment is successful:

1. **Populate Database** - Run the migration script to import 2,376+ prompts:
   ```bash
   node scripts/migrate-json-to-sql.js path/to/prompts_index.json
   ```

2. **Customize Branding** - Replace placeholder icons with your organization's branding

3. **Configure RBAC** - Assign user roles (User, Contributor, Admin) in the database

4. **Set up CI/CD** - Automate deployments with GitHub Actions or Azure DevOps

5. **Enable Monitoring** - Configure Application Insights for advanced telemetry

6. **Plan Scaling** - Monitor usage and upgrade Azure SQL tier if needed (S1 = $29.68/month)

---

## Support

For issues or questions:
- Review `deployment-info.txt` for your configuration
- Check `azure-ad-config.txt` for authentication details
- Consult `DEPLOYMENT.md` for detailed explanations
- Review Azure Portal for resource status

**Deployment Complete!** 🎉

Your Teams Prompt Library is now live and ready for users.
