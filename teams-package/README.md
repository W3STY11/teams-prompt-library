# Teams App Package

This directory contains the Microsoft Teams app manifest and icons.

## Files

- `manifest.json` - Teams app configuration
- `color.png` - 192x192px app icon (full color)
- `outline.png` - 32x32px app icon (outline/monochrome)

## Creating App Package

```bash
# Create the app package (.zip file)
cd teams-package
zip -r ../prompt-library-teams-app.zip manifest.json color.png outline.png
```

## Installing in Teams

1. Go to Teams → Apps → Manage your apps
2. Click "Upload an app" → "Upload a custom app"
3. Select the `prompt-library-teams-app.zip` file
4. Click "Add" to install for yourself or "Add to a team"

## Icon Requirements

### Color Icon (color.png)
- Size: 192x192 pixels
- Format: PNG
- Purpose: Displayed in Teams app listing
- Guidelines: Use your brand colors, ensure good visibility

### Outline Icon (outline.png)
- Size: 32x32 pixels
- Format: PNG with transparency
- Purpose: Displayed in Teams left rail when pinned
- Guidelines: Monochrome white icon on transparent background

## Manifest Tokens

Before packaging, replace these tokens in manifest.json:

- `{{TEAMS_APP_ID}}` - Generate a new GUID (use `uuidgen` or online tool)
- `{{TAB_DOMAIN}}` - Your Azure Static Web Apps domain (e.g., `myapp.azurestaticapps.net`)
- `{{AZURE_CLIENT_ID}}` - Your Azure AD app registration client ID

Example:
```json
{
  "id": "12345678-1234-1234-1234-123456789012",
  "webApplicationInfo": {
    "id": "87654321-4321-4321-4321-210987654321",
    "resource": "api://myapp.azurestaticapps.net/87654321-4321-4321-4321-210987654321"
  }
}
```

## Validation

Use Microsoft Teams Developer Portal to validate your manifest:
https://dev.teams.microsoft.com/apps

Upload your manifest.json to check for errors before packaging.
