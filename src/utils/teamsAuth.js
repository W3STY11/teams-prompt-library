/**
 * Teams Authentication Utility
 * Implements Nested App Authentication (NAA) with MSAL.js
 * Modern, client-side authentication for Teams apps
 */

import * as msal from '@azure/msal-browser';
import * as microsoftTeams from '@microsoft/teams-js';

// MSAL Configuration for Nested App Authentication
const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || process.env.AZURE_CLIENT_ID,
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin,
    supportsNestedAppAuth: true  // Enable NAA
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false
  }
};

// Create MSAL instance
let msalInstance = null;
let initPromise = null;

/**
 * Initialize MSAL instance
 */
export async function initializeMSAL() {
  if (!msalInstance) {
    msalInstance = new msal.PublicClientApplication(msalConfig);
    initPromise = msalInstance.initialize();
  }

  if (initPromise) {
    await initPromise;
    initPromise = null;
  }

  return msalInstance;
}

/**
 * Get access token using Nested App Authentication
 * @param {Array<string>} scopes - Required scopes
 * @returns {Promise<string>} Access token
 */
export async function getAccessToken(scopes = ['User.Read']) {
  const msal = initializeMSAL();

  try {
    // Get account (should be available after initial login)
    const accounts = msal.getAllAccounts();
    const account = accounts[0];

    if (!account) {
      throw new Error('No account found. Please sign in.');
    }

    // Try silent token acquisition first
    const silentRequest = {
      scopes,
      account,
      forceRefresh: false
    };

    try {
      const response = await msal.acquireTokenSilent(silentRequest);
      console.log('✅ Token acquired silently (NAA)');
      return response.accessToken;

    } catch (silentError) {
      // Silent acquisition failed, try interactive
      console.log('⚠️ Silent token acquisition failed, trying interactive...');

      if (silentError instanceof msal.InteractionRequiredAuthError) {
        // Use popup for interactive auth
        const interactiveRequest = {
          scopes,
          loginHint: account?.username
        };

        const response = await msal.acquireTokenPopup(interactiveRequest);
        console.log('✅ Token acquired interactively (NAA)');
        return response.accessToken;
      }

      throw silentError;
    }

  } catch (error) {
    console.error('❌ Token acquisition failed:', error);
    throw error;
  }
}

/**
 * Sign in user using Nested App Authentication
 * @returns {Promise<object>} User account information
 */
export async function signIn() {
  const msal = initializeMSAL();

  try {
    // Check if already signed in
    const accounts = msal.getAllAccounts();
    if (accounts.length > 0) {
      console.log('✅ User already signed in');
      return accounts[0];
    }

    // Perform login
    const loginRequest = {
      scopes: ['User.Read', 'openid', 'profile', 'email']
    };

    const response = await msal.loginPopup(loginRequest);
    console.log('✅ User signed in successfully');

    return response.account;

  } catch (error) {
    console.error('❌ Sign in failed:', error);
    throw error;
  }
}

/**
 * Sign out user
 */
export async function signOut() {
  const msal = initializeMSAL();

  try {
    const accounts = msal.getAllAccounts();
    if (accounts.length === 0) {
      return;
    }

    const logoutRequest = {
      account: accounts[0],
      postLogoutRedirectUri: window.location.origin
    };

    await msal.logoutPopup(logoutRequest);
    console.log('✅ User signed out');

  } catch (error) {
    console.error('❌ Sign out failed:', error);
    throw error;
  }
}

/**
 * Get current user account
 * @returns {object|null} Current user account or null
 */
export function getCurrentAccount() {
  const msal = initializeMSAL();
  const accounts = msal.getAllAccounts();
  return accounts.length > 0 ? accounts[0] : null;
}

/**
 * Check if user is signed in
 * @returns {boolean}
 */
export function isSignedIn() {
  return getCurrentAccount() !== null;
}

/**
 * Handle authentication errors
 * @param {Error} error - Authentication error
 * @returns {object} Standardized error response
 */
export function handleAuthError(error) {
  if (error instanceof msal.InteractionRequiredAuthError) {
    return {
      type: 'interaction_required',
      message: 'Additional authentication required',
      action: 'sign_in'
    };
  }

  if (error instanceof msal.BrowserAuthError) {
    return {
      type: 'browser_error',
      message: error.errorMessage || 'Browser authentication error',
      action: 'retry'
    };
  }

  if (error.message?.includes('consent')) {
    return {
      type: 'consent_required',
      message: 'Admin consent required for additional permissions',
      action: 'contact_admin'
    };
  }

  return {
    type: 'unknown',
    message: error.message || 'Authentication failed',
    action: 'retry'
  };
}

/**
 * Make authenticated API call
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export async function authenticatedFetch(url, options = {}) {
  try {
    // Get access token
    const token = await getAccessToken();

    // Add authorization header
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Make request
    const response = await fetch(url, {
      ...options,
      headers
    });

    // Handle 401 (token expired) by retrying once
    if (response.status === 401) {
      console.log('⚠️ Token expired, refreshing...');

      // Force token refresh
      const newToken = await getAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;

      // Retry request
      return fetch(url, {
        ...options,
        headers
      });
    }

    return response;

  } catch (error) {
    console.error('❌ Authenticated fetch failed:', error);
    throw error;
  }
}

/**
 * Initialize authentication on app start
 * Automatically sign in if in Teams environment
 */
export async function initializeAuth() {
  try {
    const msal = initializeMSAL();

    // Handle redirect response (if any)
    await msal.handleRedirectPromise();

    // Check if running in Teams
    const isInTeams = window.parent !== window.self;

    if (isInTeams) {
      // In Teams, try to get token silently (NAA will handle it)
      const accounts = msal.getAllAccounts();

      if (accounts.length === 0) {
        // No account, trigger sign in
        console.log('🔐 No account found, triggering sign in...');
        await signIn();
      } else {
        console.log('✅ User already authenticated');
      }
    }

  } catch (error) {
    console.error('❌ Auth initialization failed:', error);
    // Don't throw - allow app to load and show sign in button
  }
}

export default {
  initializeMSAL,
  getAccessToken,
  signIn,
  signOut,
  getCurrentAccount,
  isSignedIn,
  handleAuthError,
  authenticatedFetch,
  initializeAuth
};
