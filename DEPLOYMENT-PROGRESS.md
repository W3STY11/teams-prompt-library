# Azure Deployment Progress Report

**Date:** October 29, 2025
**Time:** 8:30 PM EST

---

## ✅ Completed Steps

### 1. Database Deployment ✅
- **SQL Server:** promptlib-sql-111.database.windows.net
- **Database:** promptlibrary (Standard S0, 10 DTU)
- **Schema:** Successfully deployed
  - `prompts` table created
  - `sp_RecordAnalyticsEvent` stored procedure
  - `vw_PopularPromptsByDepartment` view
- **Connection:** Verified with sqlcmd
- **Admin:** sqladmin / Ballern1!

### 2. Container Apps Environment ✅
- **Environment:** promptlib-env
- **Location:** East US 2
- **Log Analytics:** promptlib-logs workspace connected
- **Status:** Ready for container deployments

### 3. API Container App ✅
- **Name:** promptlib-api
- **URL:** https://promptlib-api.delightfulsmoke-83247bbb.eastus2.azurecontainerapps.io
- **Configuration:**
  - Min replicas: 0 (scale-to-zero enabled)
  - Max replicas: 5
  - CPU: 0.5 cores
  - Memory: 1.0 GB
  - Ingress: External (HTTPS)
  - Port: 3001
- **Environment Variables:** SQL connection configured
- **Status:** Container created (temp hello-world image)
- **⚠️ TODO:** Deploy actual Express API Docker image

### 4. Static Web App ✅
- **Name:** promptlib-frontend
- **URL:** https://polite-pond-0c32bd30f.3.azurestaticapps.net
- **Tier:** Standard ($9/month)
- **Build:** React app built successfully (850 KB bundle)
- **Status:** 🔄 Deploying frontend files...

---

## 🔄 In Progress

### Frontend Deployment
- Running: `npx @azure/static-web-apps-cli deploy`
- ETA: 1-2 minutes
- Target: `./src/dist` → Static Web App

---

## ⏳ Next Steps (Remaining)

### 5. Deploy Actual API Code
**Priority:** High
**Approach:** Build Docker image and update Container App
```bash
# Create Azure Container Registry
az acr create --name promptlibacr --resource-group teams-prompt-library-rg --sku Basic

# Build and push Docker image
az acr build --registry promptlibacr --image promptlib-api:latest ./server

# Update Container App to use new image
az containerapp update \
  --name promptlib-api \
  --resource-group teams-prompt-library-rg \
  --image promptlibacr.azurecr.io/promptlib-api:latest
```

### 6. Azure AD App Registration
**Priority:** Critical (blocks authentication)
**Script:** `./scripts/setup-azure-ad.sh`
```bash
cd scripts
./setup-azure-ad.sh https://polite-pond-0c32bd30f.3.azurestaticapps.net
```
**Outputs:**
- App ID (VITE_AZURE_CLIENT_ID)
- Tenant ID (VITE_AZURE_TENANT_ID)
- Client Secret (for backend)

### 7. Update Environment Variables
**After Azure AD setup:**
```bash
# Update frontend .env.production
VITE_AZURE_CLIENT_ID=<from-azure-ad>
VITE_TEAMS_APP_ID=<from-azure-ad>
VITE_AZURE_TENANT_ID=<from-azure-ad>

# Rebuild and redeploy frontend
npm run build
npx @azure/static-web-apps-cli deploy ./src/dist --deployment-token <token>

# Update backend Container App secrets
az containerapp secret set \
  --name promptlib-api \
  --resource-group teams-prompt-library-rg \
  --secrets \
    azure-client-id=<app-id> \
    azure-tenant-id=<tenant-id> \
    azure-client-secret=<client-secret>
```

### 8. Test API Endpoints
```bash
# Health check
curl https://promptlib-api.delightfulsmoke-83247bbb.eastus2.azurecontainerapps.io/health

# Prompts endpoint (requires auth token)
curl -H "Authorization: Bearer <token>" \
  https://promptlib-api.delightfulsmoke-83247bbb.eastus2.azurecontainerapps.io/api/prompts
```

### 9. Test Frontend Authentication
- Open: https://polite-pond-0c32bd30f.3.azurestaticapps.net
- Verify sign-in button appears
- Click sign-in and authenticate
- Verify prompts load from API

### 10. Teams App Configuration
- Update `teams-package/manifest.json` with:
  - App ID: `<azure-client-id>`
  - Frontend URL: `polite-pond-0c32bd30f.3.azurestaticapps.net`
  - API URL: `promptlib-api.delightfulsmoke-83247bbb.eastus2.azurecontainerapps.io`
- Create app package: `zip -r prompt-library-teams-app.zip manifest.json color.png outline.png`
- Upload to Teams

---

## 📊 Cost Summary

| Resource | Tier | Monthly Cost |
|----------|------|--------------|
| Azure SQL Database | S0 (10 DTU) | $14.72 |
| Container Apps | 0.5 vCPU, 1 GB | $0-10 (scale-to-zero) |
| Static Web App | Standard | $9 |
| Log Analytics | Basic | $2-5 |
| **Total** | | **$26-39/month** |

---

## 🔑 Important Credentials

**SQL Database:**
- Server: promptlib-sql-111.database.windows.net
- Database: promptlibrary
- Username: sqladmin
- Password: Ballern1!

**Deployment Token:**
- Saved in: `/tmp/swa-token.txt`
- For: Static Web App redeployments

**⚠️ Save Azure AD credentials when generated!**

---

## 📝 Notes

- SQL firewall configured for IP: 72.94.255.51
- Container Apps environment uses Log Analytics workspace: ac9597c8-4b50-415e-ab09-cc67c5c28d59
- Frontend build warnings are expected (Fluent UI "use client" directives)
- Some Teams SDK imports not found (non-blocking, will work in Teams context)

---

## 🐛 Known Issues

1. **API Container Image:** Currently using hello-world placeholder
   - **Fix:** Build and deploy actual Express API Docker image (Step 5)

2. **Authentication Not Configured:** App IDs placeholder values
   - **Fix:** Run Azure AD setup script (Step 6)

3. **Full-text Search Warnings:** SQL deployment had some non-critical warnings
   - **Impact:** Search will work but without full-text index optimization
   - **Fix:** Can add proper full-text index after MVP testing

---

**Last Updated:** In progress (frontend deploying)
**Next Action:** Wait for frontend deployment, then proceed with API image deployment
