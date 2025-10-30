/**
 * Teams Prompt Library - Main Entry Point
 * Initializes Microsoft Teams SDK before rendering React app
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import * as microsoftTeams from '@microsoft/teams-js';
import {
  FluentProvider,
  teamsDarkTheme,
  teamsLightTheme,
  teamsHighContrastTheme
} from '@fluentui/react-components';
import App from './App';
import './index.css';

/**
 * Initialize Teams SDK and render app
 */
async function initializeAndRender() {
  try {
    // Check if running in Teams environment
    const isInTeams = window.parent !== window.self;

    if (isInTeams) {
      // Initialize Teams SDK
      await microsoftTeams.app.initialize();
      console.log('✅ Teams SDK initialized');

      // Get Teams context
      const context = await microsoftTeams.app.getContext();
      console.log('✅ Teams context received:', {
        theme: context.app.theme,
        locale: context.app.locale,
        tenantId: context.user.tenant.id
      });

      // Determine theme based on Teams context
      const theme = getThemeFromContext(context);

      // Notify Teams that app is ready
      microsoftTeams.app.notifyAppLoaded();
      microsoftTeams.app.notifySuccess();

      // Render app with Teams context
      renderApp(theme, context, isInTeams);

    } else {
      // Running standalone (development)
      console.log('⚠️ Running outside Teams environment (standalone mode)');
      renderApp(teamsLightTheme, null, false);
    }

  } catch (error) {
    console.error('❌ Failed to initialize Teams SDK:', error);
    // Fallback to standalone mode
    renderApp(teamsLightTheme, null, false);
  }
}

/**
 * Get Fluent UI theme based on Teams context
 */
function getThemeFromContext(context) {
  switch (context?.app?.theme) {
    case 'dark':
      return teamsDarkTheme;
    case 'contrast':
      return teamsHighContrastTheme;
    default:
      return teamsLightTheme;
  }
}

/**
 * Render React app
 */
function renderApp(theme, teamsContext, isInTeams) {
  const root = ReactDOM.createRoot(document.getElementById('root'));

  root.render(
    <React.StrictMode>
      <FluentProvider theme={theme}>
        <App
          teamsContext={teamsContext}
          isInTeams={isInTeams}
          initialTheme={theme}
        />
      </FluentProvider>
    </React.StrictMode>
  );
}

// Start initialization
initializeAndRender();

// Listen for theme changes in Teams
if (window.parent !== window.self) {
  microsoftTeams.app.initialize().then(() => {
    microsoftTeams.app.registerOnThemeChangeHandler((theme) => {
      console.log('🎨 Theme changed to:', theme);
      // Re-render with new theme
      const newTheme = theme === 'dark' ? teamsDarkTheme
                     : theme === 'contrast' ? teamsHighContrastTheme
                     : teamsLightTheme;

      const root = document.getElementById('root');
      if (root) {
        initializeAndRender();
      }
    });
  });
}
