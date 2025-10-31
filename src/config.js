/**
 * Teams Prompt Library - Configuration
 * API endpoint configuration for Azure Container App backend
 */

// Base API URL for Container App
const API_BASE_URL = 'https://promptlib-api.delightfulsmoke-83247bbb.eastus2.azurecontainerapps.io';

export const API_ENDPOINTS = {
  // Prompt endpoints
  PROMPTS: `${API_BASE_URL}/api/prompts`,
  PROMPT_BY_ID: (id) => `${API_BASE_URL}/api/prompts/${id}`,

  // Admin endpoints
  ADMIN_CREATE_PROMPT: `${API_BASE_URL}/api/prompts`,
  ADMIN_UPDATE_PROMPT: (id) => `${API_BASE_URL}/api/prompts/${id}`,
  ADMIN_DELETE_PROMPT: (id) => `${API_BASE_URL}/api/prompts/${id}`,
  ADMIN_BULK_DELETE: `${API_BASE_URL}/api/prompts/bulk-delete`,

  // Auth endpoints
  ADMIN_LOGIN: `${API_BASE_URL}/api/auth/login`,
  ADMIN_LOGOUT: `${API_BASE_URL}/api/auth/logout`,

  // Favorites endpoints
  FAVORITES: `${API_BASE_URL}/api/favorites`,
  FAVORITE_BY_ID: (id) => `${API_BASE_URL}/api/favorites/${id}`,
};
