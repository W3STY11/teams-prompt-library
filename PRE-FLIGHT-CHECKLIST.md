# Pre-Flight Deployment Checklist

Complete this checklist before running deployment scripts.

## ✅ System Requirements

- [ ] **Azure CLI installed** (`az --version` shows 2.50+)
- [ ] **Node.js 18+ installed** (`node --version` shows v18+)
- [ ] **Git installed** (any recent version)
- [ ] **Bash shell available** (Linux/Mac/WSL)
- [ ] **Internet connection** (stable, no VPN issues)

## ✅ Azure Prerequisites

- [ ] **Azure subscription** with active billing
- [ ] **Owner or Contributor role** on subscription
- [ ] **Logged in to Azure CLI** (`az account show` works)
- [ ] **Correct subscription selected** (`az account set --subscription "name"`)

## ✅ Microsoft 365 Prerequisites

- [ ] **Microsoft 365 tenant** (work or school account)
- [ ] **Teams enabled** for your organization
- [ ] **Teams admin access** (to upload custom apps)
- [ ] **Global Admin or Application Administrator** role (for Azure AD app creation)

## ✅ Project Files Ready

- [ ] **All files present** (`ls -la` shows complete directory structure)
- [ ] **Dependencies installed** (`npm install` completed successfully)
- [ ] **Scripts executable** (`chmod +x scripts/*.sh` if needed)
- [ ] **Database schema exists** (`infra/database-schema.sql` present)

## ✅ Network & Security

- [ ] **Firewall allows outbound HTTPS** (ports 443, 1433)
- [ ] **No corporate proxy blocking Azure endpoints**
- [ ] **SSH/Git credentials configured** (if using private repos)

## ✅ Cost Approval

- [ ] **Budget approved** (~$24-34/month for Azure resources)
- [ ] **Billing account active** (credit card or invoice)
- [ ] **Resource quotas available** (check subscription limits)

## ✅ Documentation Review

- [ ] **Read DEPLOYMENT-QUICKSTART.md** (understand the process)
- [ ] **Read DEPLOYMENT.md** (detailed reference)
- [ ] **Noted time estimates** (1-2 hours total)
- [ ] **Identified point person** (who can access Azure Portal if needed)

## ✅ Data Preparation (Optional)

- [ ] **Prompts data ready** (if migrating from existing system)
- [ ] **JSON file available** (for `migrate-json-to-sql.js`)
- [ ] **Backup of existing data** (if applicable)

## ✅ Communication Plan

- [ ] **Stakeholders notified** (planned deployment time)
- [ ] **Maintenance window scheduled** (if replacing existing system)
- [ ] **Rollback plan documented** (how to revert if issues arise)

---

## Quick System Check

Run these commands to verify your system is ready:

```bash
# 1. Check Azure CLI
az --version

# 2. Check Azure login
az account show

# 3. Check Node.js
node --version
npm --version

# 4. Check project structure
cd /home/aiwithnick/teams-prompt-library1
ls -la

# 5. Check scripts are executable
ls -la scripts/*.sh

# 6. Verify dependencies
npm list --depth=0

# 7. Check database schema
head -20 infra/database-schema.sql
```

**Expected Output:**
- Azure CLI version 2.50+
- Active Azure subscription shown
- Node v18+, npm 9+
- All project files present
- Scripts with execute permissions
- No missing dependencies

---

## Estimated Timeline

| Phase | Task | Duration | Notes |
|-------|------|----------|-------|
| **Phase 1** | Azure Infrastructure | 30-45 min | Automated script |
| **Phase 2** | Azure AD Setup | 15-20 min | Automated script |
| **Phase 3** | Teams Configuration | 10-15 min | Manual edits |
| **Phase 4** | Testing & Verification | 15-30 min | Manual testing |
| **TOTAL** | | **1-2 hours** | First-time deployment |

---

## Ready to Deploy?

If all items are checked ✅, you're ready to proceed:

```bash
cd /home/aiwithnick/teams-prompt-library1/scripts

# Step 1: Deploy Azure infrastructure (30-45 min)
./deploy-azure.sh

# Step 2: Configure Azure AD (15-20 min)
./setup-azure-ad.sh https://YOUR-FRONTEND-URL

# Step 3: Follow DEPLOYMENT-QUICKSTART.md for remaining steps
```

---

## Emergency Contacts

**Before starting, note these resources:**

- **Azure Support:** https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade
- **Teams Admin Center:** https://admin.teams.microsoft.com
- **Azure Portal:** https://portal.azure.com
- **Azure AD Portal:** https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade

---

## Post-Deployment Checklist

After deployment completes:

- [ ] **Saved SQL credentials** (from `deployment-info.txt`)
- [ ] **Saved Azure AD client secret** (from `azure-ad-config.txt`)
- [ ] **Updated environment variables** (frontend and backend)
- [ ] **Tested API health endpoint** (`curl https://API-URL/health`)
- [ ] **Tested frontend** (opens in browser)
- [ ] **Uploaded Teams app** (manifest.json + icons)
- [ ] **Tested SSO in Teams** (automatic sign-in works)
- [ ] **Created first user** (verified RBAC)
- [ ] **Documented URLs** (saved for team reference)
- [ ] **Set up monitoring** (enabled Application Insights - optional)

---

## Common Pre-Flight Issues

### Issue: "az: command not found"

**Solution:**
```bash
# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Or on Mac
brew install azure-cli
```

### Issue: "Permission denied: ./deploy-azure.sh"

**Solution:**
```bash
chmod +x scripts/deploy-azure.sh
chmod +x scripts/setup-azure-ad.sh
```

### Issue: "npm: command not found"

**Solution:**
```bash
# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Or use nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### Issue: "Subscription not found"

**Solution:**
```bash
# List subscriptions
az account list --output table

# Set correct subscription
az account set --subscription "Subscription Name"

# Verify
az account show
```

### Issue: "Resource quota exceeded"

**Solution:**
- Check subscription limits in Azure Portal
- Request quota increase if needed
- Or choose different region with capacity

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Cost overrun | Low | Medium | Scale-to-zero enabled, monitoring set up |
| Deployment failure | Low | Medium | Automated scripts with error handling |
| Auth misconfiguration | Medium | High | Detailed guides, validation steps |
| Data loss | Very Low | Very High | No existing data at risk (new deployment) |
| Downtime | N/A | N/A | New deployment, no existing service |

---

## Final Approval

**Deployment Lead:** _____________________
**Date:** _____________________
**Time:** _____________________

**I confirm that:**
- [ ] All checklist items are complete
- [ ] Team is aware of deployment
- [ ] Budget is approved
- [ ] Emergency contacts are available
- [ ] Rollback plan is understood

**Signature:** _____________________

---

**You are now ready to deploy!** 🚀

Proceed to `DEPLOYMENT-QUICKSTART.md` for step-by-step instructions.
