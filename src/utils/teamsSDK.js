/**
 * Microsoft Teams SDK Utility Functions
 * Helper functions for Teams-specific operations
 */

import * as microsoftTeams from '@microsoft/teams-js';

/**
 * Get current Teams context
 * @returns {Promise<object>} Teams context
 */
export async function getTeamsContext() {
  try {
    const context = await microsoftTeams.app.getContext();
    return {
      userId: context.user.id,
      userName: context.user.displayName || context.user.userPrincipalName,
      userEmail: context.user.userPrincipalName,
      tenantId: context.user.tenant.id,
      teamId: context.team?.groupId,
      channelId: context.channel?.id,
      locale: context.app.locale,
      theme: context.app.theme,
      hostClientType: context.app.host.clientType,  // 'desktop', 'web', 'android', 'ios'
      isFullScreen: context.page.isFullScreen
    };
  } catch (error) {
    console.error('Failed to get Teams context:', error);
    return null;
  }
}

/**
 * Share prompt to Teams chat or channel
 * @param {object} prompt - Prompt object
 */
export async function sharePromptToTeams(prompt) {
  try {
    const shareUrl = `${window.location.origin}/view?id=${prompt.id}`;

    await microsoftTeams.sharing.shareWebContent({
      content: [{
        type: 'URL',
        url: shareUrl,
        message: `Check out this prompt: ${prompt.title}\n\n${prompt.description || ''}`,
        preview: true
      }]
    });

    console.log('✅ Prompt shared to Teams');
    return true;

  } catch (error) {
    console.error('Failed to share prompt:', error);
    return false;
  }
}

/**
 * Create deep link to specific prompt
 * @param {string} promptId - Prompt ID
 * @returns {string} Deep link URL
 */
export function createPromptDeepLink(promptId) {
  const appId = import.meta.env.VITE_TEAMS_APP_ID;
  const context = encodeURIComponent(JSON.stringify({
    subEntityId: promptId
  }));

  return `https://teams.microsoft.com/l/entity/${appId}/promptLibraryHome?context=${context}`;
}

/**
 * Navigate to prompt within Teams app
 * @param {string} promptId - Prompt ID
 */
export async function navigateToPrompt(promptId) {
  try {
    if (microsoftTeams.pages.isSupported()) {
      await microsoftTeams.pages.navigateTo({
        appId: import.meta.env.VITE_TEAMS_APP_ID,
        pageId: 'promptLibraryHome',
        subPageId: promptId
      });
      return true;
    } else {
      // Fallback to React Router navigation
      window.location.hash = `/view/${promptId}`;
      return true;
    }
  } catch (error) {
    console.error('Navigation failed:', error);
    return false;
  }
}

/**
 * Open prompt in dialog/modal
 * @param {string} promptId - Prompt ID
 * @param {object} options - Dialog options
 */
export async function openPromptDialog(promptId, options = {}) {
  try {
    if (microsoftTeams.dialog.isSupported()) {
      const dialogUrl = `${window.location.origin}/modal?id=${promptId}`;

      await microsoftTeams.dialog.open({
        title: options.title || 'Prompt Details',
        url: dialogUrl,
        size: {
          height: options.height || 600,
          width: options.width || 800
        },
        fallbackUrl: `${window.location.origin}/view?id=${promptId}`
      });

      return true;
    }
    return false;

  } catch (error) {
    console.error('Failed to open dialog:', error);
    return false;
  }
}

/**
 * Copy text to clipboard (Teams-aware)
 * @param {string} text - Text to copy
 */
export async function copyToClipboard(text) {
  try {
    // Try Teams clipboard API first
    if (microsoftTeams.clipboard && microsoftTeams.clipboard.isSupported()) {
      await microsoftTeams.clipboard.write(text);
      return true;
    }

    // Fallback to native clipboard API
    await navigator.clipboard.writeText(text);
    return true;

  } catch (error) {
    console.error('Failed to copy to clipboard:', error);

    // Final fallback: create temporary textarea
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (execError) {
      document.body.removeChild(textarea);
      return false;
    }
  }
}

/**
 * Show notification/toast message
 * @param {string} message - Message to display
 * @param {string} type - Message type ('success', 'error', 'info')
 */
export function showNotification(message, type = 'success') {
  try {
    if (type === 'success') {
      microsoftTeams.app.notifySuccess();
    } else if (type === 'error') {
      microsoftTeams.app.notifyFailure({
        reason: microsoftTeams.app.FailedReason.Other,
        message
      });
    }

    console.log(`📢 Notification: [${type}] ${message}`);
    return true;

  } catch (error) {
    console.error('Failed to show notification:', error);
    return false;
  }
}

/**
 * Listen for theme changes
 * @param {function} callback - Callback function (theme) => void
 */
export function onThemeChange(callback) {
  try {
    microsoftTeams.app.registerOnThemeChangeHandler((theme) => {
      console.log('🎨 Theme changed:', theme);
      callback(theme);
    });
  } catch (error) {
    console.error('Failed to register theme change handler:', error);
  }
}

/**
 * Get user's settings/preferences from Teams
 * @returns {Promise<object>} User settings
 */
export async function getUserSettings() {
  try {
    const context = await microsoftTeams.app.getContext();

    return {
      locale: context.app.locale,
      theme: context.app.theme,
      hostClientType: context.app.host.clientType,
      timezone: context.user.timezone || 'UTC'
    };

  } catch (error) {
    console.error('Failed to get user settings:', error);
    return {
      locale: 'en-US',
      theme: 'default',
      hostClientType: 'web',
      timezone: 'UTC'
    };
  }
}

/**
 * Check if specific Teams capability is supported
 * @param {string} capability - Capability namespace (e.g., 'dialog', 'sharing')
 * @returns {boolean}
 */
export function isCapabilitySupported(capability) {
  try {
    const capabilityMap = {
      'dialog': microsoftTeams.dialog,
      'sharing': microsoftTeams.sharing,
      'clipboard': microsoftTeams.clipboard,
      'pages': microsoftTeams.pages,
      'call': microsoftTeams.call,
      'chat': microsoftTeams.chat,
      'people': microsoftTeams.people,
      'meeting': microsoftTeams.meeting
    };

    const cap = capabilityMap[capability];
    return cap && cap.isSupported && cap.isSupported();

  } catch (error) {
    console.error(`Failed to check capability ${capability}:`, error);
    return false;
  }
}

/**
 * Enable full screen mode
 */
export async function enterFullScreen() {
  try {
    if (microsoftTeams.pages.isSupported()) {
      await microsoftTeams.pages.fullScreen.enter();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to enter fullscreen:', error);
    return false;
  }
}

/**
 * Exit full screen mode
 */
export async function exitFullScreen() {
  try {
    if (microsoftTeams.pages.isSupported()) {
      await microsoftTeams.pages.fullScreen.exit();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to exit fullscreen:', error);
    return false;
  }
}

export default {
  getTeamsContext,
  sharePromptToTeams,
  createPromptDeepLink,
  navigateToPrompt,
  openPromptDialog,
  copyToClipboard,
  showNotification,
  onThemeChange,
  getUserSettings,
  isCapabilitySupported,
  enterFullScreen,
  exitFullScreen
};
