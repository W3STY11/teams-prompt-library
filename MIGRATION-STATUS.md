# Notion HTML Import - Migration Status

## 🎯 Goal
Re-import ALL 2,000+ prompts from Notion HTML files with COMPLETE metadata that was lost during the initial SQL migration.

## ✅ Completed Work

### 1. HTML Structure Analysis ✅
- Analyzed complete Notion HTML structure
- Identified ALL missing fields:
  - Tips (💡 Tips section)
  - Additional Tips (💡 Additional Tips section)
  - What It Does (⚙️ What This Mega-Prompt Does)
  - How To Use (❓ How To Use The Prompt)
  - Example Input (📥 Example Input)
  - Example Output (📤 Example Output + image filenames)
  - Tags (extracted from HTML attributes)

### 2. SQL Migration Script ✅
- Created: `/home/aiwithnick/teams-prompt-library1/server/db/add-missing-fields.sql`
- Adds 3 new columns to `prompts` table:
  - `additional_tips` NVARCHAR(MAX) NULL
  - `example_output` NVARCHAR(MAX) NULL
  - `what_it_does` NVARCHAR(MAX) NULL

### 3. Migration Runner Script ✅
- Created: `/home/aiwithnick/teams-prompt-library1/server/db/run-migration.mjs`
- Node.js script to execute SQL migration
- Usage: `SQL_PASSWORD="..." node run-migration.mjs`

### 4. Comprehensive HTML Import Script ✅
- Created: `/home/aiwithnick/teams-prompt-library1/server/db/import-from-html.mjs`
- **Features**:
  - Parses ALL Notion HTML sections using Cheerio
  - Extracts complete metadata from 9 department folders
  - UPSERT logic (UPDATE existing + INSERT new)
  - Processes 2,000+ files automatically
  - Real-time progress logging
  - Error handling & summary stats

- **What it extracts**:
  - ✅ Title, department, subcategory
  - ✅ Description (from 💡 callout)
  - ✅ Tips (from 💡 Tips section)
  - ✅ Additional Tips (from 💡 Additional Tips)
  - ✅ What It Does (from ⚙️ section)
  - ✅ How To Use (from ❓ section)
  - ✅ Example Input (from 📥 section)
  - ✅ Example Output (from 📤 section + images)
  - ✅ Tags (from HTML attributes)
  - ✅ Prompt content (from code blocks)
  - ✅ Word count (auto-calculated)
  - ✅ Complexity (auto-assigned)
  - ✅ Icon (auto-assigned per department)

## 🔄 Next Steps

### Step 1: Get SQL Password & Run Migration
**You need to provide the SQL password to complete the migration.**

The password is stored in Azure Container App secrets. You can:

**Option A: Get password from Azure**
```bash
# List existing connections to find the SQL connection
az containerapp connection list --resource-group teams-prompt-library-rg --name promptlib-api

# Get connection details (password should be in the output)
az containerapp connection show --name <connection-name> --resource-group teams-prompt-library-rg --container-app promptlib-api
```

**Option B: Reset SQL password (if needed)**
```bash
# Reset the SQL admin password
az sql server update --name promptlib-sql-111 --resource-group teams-prompt-library-rg --admin-password "YourNewPassword123!"

# Update Container App secret
az containerapp secret set --name promptlib-api --resource-group teams-prompt-library-rg --secrets sql-password="YourNewPassword123!"
```

**Then run the migration:**
```bash
cd /home/aiwithnick/teams-prompt-library1/server/db
SQL_PASSWORD="your-password-here" node run-migration.mjs
```

### Step 2: Run HTML Import
```bash
cd /home/aiwithnick/teams-prompt-library1/server/db
SQL_PASSWORD="your-password-here" node import-from-html.mjs
```

This will:
- Process all 9 department folders
- Extract complete metadata from 2,000+ HTML files
- UPSERT into SQL database
- Show real-time progress
- Report final stats (inserted/updated/failed)

### Step 3: Update Backend API
Edit `/home/aiwithnick/teams-prompt-library1/server/api.js`:

```javascript
// In GET /api/prompts endpoint (line ~87)
// In GET /api/prompts/:id endpoint (line ~121)
// Make sure to SELECT the new columns:
SELECT
  *,
  additional_tips,
  example_output,
  what_it_does
FROM prompts
WHERE ...
```

Also update CREATE/UPDATE endpoints to handle the new fields.

### Step 4: Update Frontend CreatePromptModal
Edit `/home/aiwithnick/spark-ai-prompt-library/src/components/CreatePromptModal.jsx`:

Add new form fields (already has whatItDoes, howToUse, exampleInput):
- **Additional Tips** (textarea) - one per line
- **Example Output** (textarea) - text or image filename

These are currently in the `metadata` object but should be top-level fields.

### Step 5: Deploy Backend
```bash
cd /home/aiwithnick/teams-prompt-library1
docker build -t promptlib-api:latest -f server/Dockerfile .
docker tag promptlib-api:latest promptlib1761784556.azurecr.io/promptlib-api:latest
az acr login --name promptlib1761784556
docker push promptlib1761784556.azurecr.io/promptlib-api:latest
az containerapp update --name promptlib-api --resource-group teams-prompt-library-rg --image promptlib1761784556.azurecr.io/promptlib-api:latest
```

### Step 6: Build & Deploy Frontend
```bash
cd /home/aiwithnick/spark-ai-prompt-library
npm run build
npx @azure/static-web-apps-cli deploy ./dist --deployment-token "..." --env production
```

### Step 7: Verify Complete System
1. Open browse page - pick any prompt
2. Verify ALL fields are populated:
   - ✅ Tips
   - ✅ Additional Tips
   - ✅ What It Does
   - ✅ How To Use
   - ✅ Example Input
   - ✅ Example Output
   - ✅ Tags
3. Open admin dashboard
4. Click "Create Prompt"
5. Verify ALL fields are in the form
6. Create a test prompt with ALL fields filled
7. Verify it appears with complete data

## 📊 Current Database State

- **Server**: promptlib-sql-111.database.windows.net
- **Database**: promptlibrary
- **User**: sqladmin
- **Current prompt count**: ~2,423
- **Status**: Missing complete metadata (tips, examples, instructions, etc.)

## 🚨 Critical Issues to Fix

1. **Inconsistent Data**: Some prompts have metadata, most don't
2. **Missing Fields**:
   - Tips section empty/missing
   - Additional Tips missing
   - What It Does missing
   - How To Use missing
   - Example Input missing
   - Example Output missing
   - Tags missing/empty
3. **Root Cause**: Original import script only extracted basic fields (title, description, content)

## 📁 File Locations

- **Source HTML Files**: `/home/aiwithnick/spark-ai-prompt-library/Prompts/`
- **SQL Migration**: `/home/aiwithnick/teams-prompt-library1/server/db/add-missing-fields.sql`
- **Migration Runner**: `/home/aiwithnick/teams-prompt-library1/server/db/run-migration.mjs`
- **Import Script**: `/home/aiwithnick/teams-prompt-library1/server/db/import-from-html.mjs`
- **Backend API**: `/home/aiwithnick/teams-prompt-library1/server/api.js`
- **Create Form**: `/home/aiwithnick/spark-ai-prompt-library/src/components/CreatePromptModal.jsx`

## 🎯 Success Criteria

- [x] SQL migration script created
- [x] Import script built with complete parsing
- [ ] SQL migration executed (needs password)
- [ ] Import script executed (all 2000+ prompts)
- [ ] Backend API updated to handle new fields
- [ ] Frontend form updated with all fields
- [ ] All prompts have complete metadata
- [ ] New prompts can be created with all fields
- [ ] System tested end-to-end

## ⏰ Estimated Timeline

- Step 1: 5 min (get password + run migration)
- Step 2: 10-15 min (import 2000+ HTML files)
- Step 3: 10 min (update backend API)
- Step 4: 5 min (update frontend form)
- Step 5: 5 min (deploy backend)
- Step 6: 5 min (deploy frontend)
- Step 7: 10 min (test complete system)

**Total**: ~50-60 minutes to complete full migration
