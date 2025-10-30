# Development Setup Guide

Quick start guide for local development of the Teams Prompt Library.

## Prerequisites

- Node.js 18+ LTS ([Download](https://nodejs.org/))
- Azure SQL Database or SQL Server (local or cloud)
- Azure AD app registration (see DEPLOYMENT.md)
- Microsoft Teams account for testing
- Git

---

## Quick Start (5 minutes)

### 1. Clone and Install

```bash
# Clone repository
git clone <your-repo-url>
cd teams-prompt-library1

# Install dependencies
npm install
```

### 2. Configure Environment

```bash
# Create .env file from template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

**Required environment variables:**

```env
# Azure AD / Entra ID
AZURE_CLIENT_ID=your-azure-ad-app-id
AZURE_TENANT_ID=common
AZURE_CLIENT_SECRET=your-client-secret

# Azure SQL Database
SQL_SERVER=your-server.database.windows.net
SQL_DATABASE=promptlibrary
SQL_USER=sqladmin
SQL_PASSWORD=your-password
SQL_ENCRYPT=true

# Application
NODE_ENV=development
API_PORT=3001
FRONTEND_URL=http://localhost:3000
```

### 3. Set up Database

**Option A: Use existing Azure SQL Database**
```bash
# Deploy schema to Azure SQL
az sql db query \
  --server your-server \
  --database promptlibrary \
  --admin-user sqladmin \
  --admin-password "YourPassword" \
  --file infra/database-schema.sql
```

**Option B: Local SQL Server (Windows/Mac with Docker)**
```bash
# Run SQL Server in Docker
docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=YourStrong@Password" \
  -p 1433:1433 --name sql-server \
  -d mcr.microsoft.com/mssql/server:2022-latest

# Update .env
SQL_SERVER=localhost
SQL_DATABASE=promptlibrary
SQL_USER=sa
SQL_PASSWORD=YourStrong@Password

# Create database
docker exec -it sql-server /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P "YourStrong@Password" \
  -Q "CREATE DATABASE promptlibrary"

# Deploy schema
docker exec -it sql-server /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P "YourStrong@Password" \
  -d promptlibrary -i /infra/database-schema.sql
```

### 4. Migrate Data (Optional)

If you have existing prompts from SPARK AI:

```bash
# Migrate from JSON file
npm run db:migrate path/to/prompts_index.json

# Or directly
node scripts/migrate-json-to-sql.js ./public/prompts_index.json
```

### 5. Start Development Servers

```bash
# Start both frontend and API
npm run dev

# Or start separately:
npm run dev:frontend  # Port 3000
npm run dev:api      # Port 3001
```

**Access:**
- Frontend: http://localhost:3000
- API: http://localhost:3001
- API Health: http://localhost:3001/health

---

## Project Structure

```
teams-prompt-library1/
├── src/                      # React frontend
│   ├── components/           # UI components
│   ├── utils/                # Utilities (auth, teams SDK)
│   ├── App.jsx               # Main app component
│   ├── main.jsx              # Entry point
│   └── index.html            # HTML template
├── server/                   # Express API
│   ├── api.js                # Main API server
│   ├── db/                   # Database layer
│   │   └── sqlClient.js      # SQL connection
│   └── middleware/           # API middleware
│       ├── auth.js           # Token validation
│       └── rbac.js           # Role-based access
├── teams-package/            # Teams app manifest
│   └── manifest.json         # App configuration
├── infra/                    # Infrastructure
│   └── database-schema.sql   # Database schema
├── scripts/                  # Utility scripts
│   └── migrate-json-to-sql.js
├── package.json              # Dependencies
├── vite.config.js            # Vite configuration
└── .env                      # Environment variables
```

---

## Development Workflow

### Adding a New Feature

1. **Create a new component** in `src/components/`
2. **Add route** in `src/App.jsx`
3. **Create API endpoint** in `server/api.js`
4. **Test locally** with `npm run dev`
5. **Commit and push** to Git

### Testing in Teams

1. **Update manifest** in `teams-package/manifest.json`
   - Set `contentUrl` to `https://localhost:3000`
   - Add `localhost:3000` to `validDomains`

2. **Enable HTTPS for localhost:**
   ```bash
   # Install mkcert (one-time)
   # Mac
   brew install mkcert
   mkcert -install

   # Windows
   choco install mkcert
   mkcert -install

   # Create certificates
   mkcert localhost

   # Update vite.config.js
   server: {
     https: {
       key: './localhost-key.pem',
       cert: './localhost.pem'
     }
   }
   ```

3. **Package and upload to Teams:**
   ```bash
   cd teams-package
   zip -r ../prompt-library-teams-app.zip manifest.json color.png outline.png
   ```

4. **Upload to Teams:**
   - Teams → Apps → Manage your apps
   - Upload a custom app → Select zip file
   - Add

### Common Development Tasks

#### Add new API endpoint

```javascript
// server/api.js
app.get('/api/new-endpoint', validateToken, extractTenant, async (req, res) => {
  try {
    // Your logic here
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### Create new React component

```javascript
// src/components/NewComponent.jsx
import React from 'react';
import { makeStyles, Text } from '@fluentui/react-components';

const useStyles = makeStyles({
  container: {
    padding: '20px'
  }
});

export function NewComponent() {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      <Text as="h1">New Component</Text>
    </div>
  );
}
```

#### Add to routing

```javascript
// src/App.jsx
import { NewComponent } from './components/NewComponent';

<Routes>
  <Route path="/new" element={<NewComponent />} />
</Routes>
```

---

## Testing

### Manual Testing Checklist

- [ ] API health endpoint responds
- [ ] Authentication works (sign in/sign out)
- [ ] Can browse prompts
- [ ] Search works (full-text)
- [ ] Favorites can be added/removed
- [ ] Prompts can be created (Contributor role)
- [ ] Prompts can be edited (Admin role)
- [ ] Audit logging records actions
- [ ] Works in Teams desktop client
- [ ] Works in Teams web client
- [ ] Works on mobile (Teams mobile app)

### API Testing with curl

```bash
# Get authentication token first (use Azure AD portal or Postman)
TOKEN="your-access-token"

# Test endpoints
curl http://localhost:3001/health
curl http://localhost:3001/api/departments

# With authentication
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/prompts

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/favorites
```

### Database Queries

```sql
-- Check prompt count
SELECT COUNT(*) FROM prompts;

-- Check by department
SELECT department, COUNT(*) as count
FROM prompts
GROUP BY department;

-- Check favorites
SELECT u.email, p.title
FROM favorites f
JOIN prompts p ON f.prompt_id = p.id
LEFT JOIN users u ON f.user_id = u.id;

-- Check audit log
SELECT TOP 10 *
FROM audit_log
ORDER BY timestamp DESC;
```

---

## Debugging

### Frontend Debugging

**Browser DevTools:**
- F12 or Right-click → Inspect
- Console tab for errors/logs
- Network tab for API calls
- Application tab for localStorage

**Common Issues:**

**Issue: "Teams SDK not initialized"**
```
Solution: Check console for Teams initialization errors
- Ensure running in Teams or set isInTeams = false
- Check manifest.json contentUrl is correct
```

**Issue: "Token validation failed"**
```
Solution: Check Azure AD app configuration
- Verify client ID matches in .env and manifest
- Ensure user has granted consent
- Check token expiration
```

### Backend Debugging

**Node.js Debugging:**
```bash
# Start with debugging enabled
node --inspect server/api.js

# Or with nodemon
nodemon --inspect server/api.js
```

**In VS Code:**
```json
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug API",
  "program": "${workspaceFolder}/server/api.js",
  "envFile": "${workspaceFolder}/.env"
}
```

**Common Issues:**

**Issue: "Database connection failed"**
```
Solution: Check SQL credentials in .env
- Test connection: SELECT 1 as test
- Check firewall rules (Azure SQL)
- Verify SQL Server is running (local)
```

**Issue: "CORS errors"**
```
Solution: Check CORS configuration in server/api.js
- Add your origin to allowed origins
- Check credentials: true setting
```

---

## Performance Optimization

### Frontend

```bash
# Analyze bundle size
npm run build
npm run preview

# Check bundle analyzer
npm install -D rollup-plugin-visualizer
# Add to vite.config.js visualizer plugin
```

### Backend

```sql
-- Check slow queries
SELECT TOP 10
  qs.execution_count,
  qs.total_elapsed_time / 1000000 AS total_elapsed_time_sec,
  qt.text AS query_text
FROM sys.dm_exec_query_stats AS qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) AS qt
ORDER BY qs.total_elapsed_time DESC;

-- Add indexes if needed
CREATE INDEX IX_prompts_search
ON prompts(department, tenant_id)
INCLUDE (title, description);
```

---

## Environment-Specific Configuration

### Development

```env
NODE_ENV=development
API_PORT=3001
FRONTEND_URL=http://localhost:3000
SQL_SERVER=localhost
```

### Staging

```env
NODE_ENV=staging
API_PORT=3001
FRONTEND_URL=https://staging.azurestaticapps.net
SQL_SERVER=staging-sql.database.windows.net
```

### Production

```env
NODE_ENV=production
API_PORT=3001
FRONTEND_URL=https://prod.azurestaticapps.net
SQL_SERVER=prod-sql.database.windows.net
```

---

## Git Workflow

### Branch Strategy

```
main          # Production-ready code
├── develop   # Integration branch
├── feature/* # New features
└── hotfix/*  # Critical fixes
```

### Commit Convention

```bash
# Format: type(scope): message

git commit -m "feat(api): add search endpoint"
git commit -m "fix(auth): resolve token expiration"
git commit -m "docs(readme): update setup instructions"
git commit -m "refactor(components): extract PromptCard"
```

**Types:** feat, fix, docs, style, refactor, perf, test, chore

---

## Useful Commands

```bash
# Development
npm run dev              # Start both servers
npm run dev:frontend     # Frontend only
npm run dev:api          # API only

# Build
npm run build            # Build frontend
npm run build:api        # Check API (no build needed)

# Database
npm run db:migrate       # Migrate JSON to SQL

# Testing (future)
npm test                 # Run tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report

# Deployment
npm run deploy:frontend  # Deploy frontend
npm run deploy:api       # Deploy API
```

---

## Troubleshooting Common Issues

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000
# Or on Windows
netstat -ano | findstr :3000

# Kill process
kill -9 <PID>
```

### Node Modules Issues

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Teams Manifest Errors

```bash
# Validate manifest
# Use Teams Developer Portal: https://dev.teams.microsoft.com/apps
# Upload manifest.json to check for errors
```

---

## Additional Resources

- [Microsoft Teams Platform Docs](https://learn.microsoft.com/microsoftteams/platform/)
- [Fluent UI React Components](https://react.fluentui.dev/)
- [Azure SQL Documentation](https://learn.microsoft.com/azure/azure-sql/)
- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js)

---

## Getting Help

**For development issues:**
1. Check browser/node console for errors
2. Review this guide's troubleshooting section
3. Check GitHub issues
4. Ask in team chat

**For Azure/Teams admin issues:**
1. Check Azure Portal for resource status
2. Review Teams Admin Center settings
3. Contact IT administrator
4. Open Azure support ticket

---

Happy coding! 🚀
