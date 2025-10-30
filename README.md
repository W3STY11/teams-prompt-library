# Teams Prompt Library - Enterprise AI Prompt Management

A scalable, multi-tenant Microsoft Teams application for managing and sharing 2,376+ professional AI prompts across 9 business departments.

## 🏗️ Architecture

**Research-Based Design** - Built from comprehensive analysis of Microsoft Teams platform, Azure services, and enterprise requirements.

### Technology Stack

- **Frontend**: React 18 + Fluent UI v9 + Microsoft Teams SDK
- **Backend**: Express.js on Azure Container Apps (scale-to-zero)
- **Database**: Azure SQL Database S0 ($14.72/month)
- **Authentication**: Nested App Authentication (NAA) with MSAL.js 3.x
- **Hosting**: Azure Static Web Apps (Free tier)
- **Search**: SQL full-text (included) → Azure AI Search optional ($75/month)

### Cost: ~$15-20/month hosting | Scales to 100K+ users

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ LTS
- Azure subscription
- Microsoft 365 tenant (for Teams development)
- Azure AD app registration

### Installation

```bash
# 1. Clone and install dependencies
git clone <your-repo>
cd teams-prompt-library1
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your Azure credentials

# 3. Set up Azure SQL database
npm run db:migrate

# 4. Run locally
npm run dev
```

Access the app:
- Frontend: http://localhost:3000
- API: http://localhost:3001

---

## 📁 Project Structure

```
teams-prompt-library1/
├── src/                          # React frontend
│   ├── components/               # Reusable UI components
│   │   ├── BrowsePage.jsx       # Main prompt browsing
│   │   ├── ViewPage.jsx         # Prompt details
│   │   ├── FavoritesPage.jsx    # User favorites
│   │   └── Header.jsx           # Navigation
│   ├── utils/                    # Utility functions
│   │   ├── teamsAuth.js         # NAA authentication
│   │   └── teamsSDK.js          # Teams SDK helpers
│   ├── App.jsx                   # Main app component
│   ├── main.jsx                  # Entry point with Teams init
│   └── index.html                # HTML template
├── server/                       # Express API
│   ├── api.js                   # Main API server
│   ├── db/                      # Database layer
│   │   └── sqlClient.js         # Azure SQL connection
│   └── middleware/              # API middleware
│       ├── auth.js              # Token validation
│       └── rbac.js              # Role-based access
├── teams-package/               # Teams app manifest
│   ├── manifest.json            # App configuration
│   ├── color.png                # 192x192 app icon
│   └── outline.png              # 32x32 app icon
├── infra/                       # Infrastructure as Code
│   ├── main.bicep               # Azure resources
│   └── parameters.json          # Environment config
├── scripts/                     # Utility scripts
│   └── migrate-json-to-sql.js  # Data migration
└── README.md                    # This file
```

---

## 🗄️ Database Schema

```sql
-- Prompts table (2,376 items migrated from JSON)
CREATE TABLE prompts (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    department VARCHAR(50) NOT NULL,
    subcategory VARCHAR(100),
    description TEXT,
    content TEXT NOT NULL,
    tags NVARCHAR(MAX),  -- JSON array
    word_count INT,
    complexity VARCHAR(20),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    created_by VARCHAR(100),
    tenant_id VARCHAR(100),  -- Multi-tenant support
    is_shared BIT DEFAULT 0  -- Shared across tenants?
);

-- Full-text index for search
CREATE FULLTEXT INDEX ON prompts(title, description, content)
    KEY INDEX PK_prompts;

-- Users' favorites (cloud storage, not localStorage)
CREATE TABLE favorites (
    id INT IDENTITY PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,  -- Azure AD user ID
    prompt_id VARCHAR(100) NOT NULL,
    tenant_id VARCHAR(100) NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (prompt_id) REFERENCES prompts(id),
    UNIQUE (user_id, prompt_id, tenant_id)
);

-- Audit log for compliance
CREATE TABLE audit_log (
    id INT IDENTITY PRIMARY KEY,
    user_id VARCHAR(100),
    action VARCHAR(50),  -- 'view', 'copy', 'create', 'update', 'delete'
    prompt_id VARCHAR(100),
    tenant_id VARCHAR(100),
    timestamp DATETIME2 DEFAULT GETDATE(),
    metadata NVARCHAR(MAX)  -- JSON for additional details
);
```

---

## 🔐 Authentication Flow (Nested App Authentication)

```javascript
// Simplified NAA implementation (modern approach)
import * as microsoftTeams from "@microsoft/teams-js";
import * as msal from "@azure/msal-browser";

// 1. Initialize Teams SDK
await microsoftTeams.app.initialize();

// 2. Configure MSAL with NAA support
const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    authority: "https://login.microsoftonline.com/common",
    supportsNestedAppAuth: true  // Enable NAA
  }
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

// 3. Acquire token (no backend exchange needed!)
const response = await msalInstance.acquireTokenSilent({
  scopes: ["User.Read"]
});

// 4. Call API with token
fetch('/api/prompts', {
  headers: { 'Authorization': `Bearer ${response.accessToken}` }
});
```

**Why NAA vs Traditional SSO?**
- ✅ No backend token exchange (simpler architecture)
- ✅ Client-side only (eliminates API server dependency for auth)
- ✅ Better performance (no additional network hop)
- ✅ Modern Microsoft recommendation

---

## 🌍 Multi-Tenant Design

**Why Multi-Tenant?**
- 95% cost reduction vs single-tenant
- Shared infrastructure, isolated data
- Faster updates (deploy once, affects all customers)

**Data Isolation Strategy:**
```javascript
// Every query filters by tenant_id
app.get('/api/prompts', validateToken, extractTenant, async (req, res) => {
  const { tenantId } = req;  // From Azure AD token

  const prompts = await sql.query(`
    SELECT * FROM prompts
    WHERE tenant_id = @tenantId OR is_shared = 1
    ORDER BY created_at DESC
  `, { tenantId });

  res.json(prompts);
});
```

---

## 📊 Migration from Existing SPARK AI Setup

**Effort: LOW** - 80% code reuse

### Step 1: Export Current Data
```bash
# Your existing prompts_index.json → SQL
node scripts/migrate-json-to-sql.js
```

### Step 2: Adapt React Components
```javascript
// Before (standalone app)
import { BrowserRouter } from 'react-router-dom';

function App() {
  return <BrowserRouter><Routes>...</Routes></BrowserRouter>;
}

// After (Teams app)
import * as microsoftTeams from "@microsoft/teams-js";

function App() {
  const [teamsContext, setTeamsContext] = useState(null);

  useEffect(() => {
    microsoftTeams.app.initialize().then(async () => {
      const context = await microsoftTeams.app.getContext();
      setTeamsContext(context);
    });
  }, []);

  if (!teamsContext) return <Loading />;
  return <BrowserRouter><Routes>...</Routes></BrowserRouter>;
}
```

### Step 3: Deploy to Azure
```bash
npm run build
npm run deploy:frontend  # → Azure Static Web Apps
npm run deploy:api       # → Azure Container Apps
```

**Total Migration Time: 1-2 weeks**

---

## 🚢 Deployment

### Local Development
```bash
npm run dev  # Starts both frontend (3000) and API (3001)
```

### Azure Deployment

**Option 1: Manual (Quick)**
```bash
# Frontend
cd src && vite build
# Upload dist/ to Azure Static Web Apps via portal

# Backend
# Deploy server/ folder to Azure Container Apps
```

**Option 2: CI/CD (Recommended)**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Azure
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci && npm run build
      - uses: azure/webapps-deploy@v2
        # ...deployment steps
```

---

## 📈 Roadmap

### Phase 1: MVP (Weeks 1-8) ✅ Current
- [x] Project setup and architecture
- [x] Azure resources provisioning
- [ ] Core React components adapted from SPARK AI
- [ ] NAA authentication implementation
- [ ] SQL database with migration script
- [ ] Express API with basic endpoints
- [ ] Deployment to Azure

### Phase 2: Enterprise Features (Weeks 9-16)
- [ ] Publisher Attestation completion
- [ ] Department-level RBAC
- [ ] Messaging extension (search from chat)
- [ ] Adaptive Cards for sharing
- [ ] Approval workflow for new prompts
- [ ] Sensitivity labels (Public/Internal/Confidential)

### Phase 3: Advanced (Weeks 17-20)
- [ ] Azure AI Search integration (if user feedback demands it)
- [ ] Analytics dashboard (usage metrics, ROI)
- [ ] Multi-model support (GPT-4, Claude, Gemini)
- [ ] Prompt versioning and A/B testing

---

## 🔧 Configuration

### Teams App Manifest
Located in `teams-package/manifest.json`:
```json
{
  "manifestVersion": "1.17",
  "id": "{your-app-guid}",
  "version": "1.0.0",
  "packageName": "com.yourcompany.promptlibrary",
  "name": {
    "short": "Prompt Library",
    "full": "Enterprise AI Prompt Library"
  },
  "staticTabs": [{
    "entityId": "promptLibraryHome",
    "name": "Browse",
    "contentUrl": "https://your-domain.azurestaticapps.net",
    "scopes": ["personal"]
  }],
  "webApplicationInfo": {
    "id": "{azure-ad-app-id}",
    "resource": "api://{your-domain}/{azure-ad-app-id}"
  }
}
```

---

## 🧪 Testing

### Local Testing
```bash
npm test  # Unit tests (Phase 2)
```

### Teams Testing
1. Upload `teams-package/manifest.zip` to Teams
2. Test in Teams desktop, web, and mobile
3. Verify SSO flow works
4. Test search, favorites, browse functionality

---

## 📚 Additional Documentation

- **Architecture Decision Records**: See `/docs/adr/`
- **API Documentation**: See `/docs/api.md`
- **Deployment Guide**: See `/docs/deployment.md`
- **Contributing Guidelines**: See `/CONTRIBUTING.md`

---

## 🙋 Support

For issues or questions:
- **GitHub Issues**: [your-repo/issues]
- **Teams Channel**: [your-support-channel]
- **Email**: support@yourcompany.com

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🎯 Key Design Decisions (Research-Based)

### Why This Architecture?
Based on 40+ hours of research across Microsoft documentation, Azure pricing, and enterprise case studies:

1. **Azure SQL over Cosmos DB**: Relational data structure, proven full-text search, $14.72/month vs $29+/month
2. **Container Apps over App Service**: Scale-to-zero saves $60-70/month for variable traffic
3. **NAA over Traditional SSO**: Simpler, no backend exchange, modern Microsoft recommendation
4. **Multi-Tenant**: 95% infrastructure cost savings vs single-tenant
5. **Skip AI Search Initially**: $900/year unjustified for 2,376 items, add later if users demand it
6. **Reuse SPARK AI Code**: 80% component reuse, Fluent UI v9 already Teams-compatible

### Cost Breakdown
- **MVP Hosting**: $15-20/month (SQL + Container Apps + Static Web Apps)
- **With AI Search**: $90-95/month (add $75 for Azure AI Search Basic)
- **Development**: $35-50K for MVP (6-8 weeks) or $90-140K full enterprise (16-20 weeks)

### Timeline Reality Check
- **Not "1 week"**: Research shows 6-8 weeks minimum for production-ready MVP
- **Not "magic"**: Real effort required for auth, testing, deployment
- **Honest estimate**: 16-20 weeks for enterprise-grade with all features

---

**Built with research, not marketing hype.**
# Teams SSO Configuration - Thu Oct 30 14:36:59 EDT 2025
# Trigger deployment
