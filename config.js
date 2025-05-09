/**
 * PursuitPal - Configuration
 *
 * This file contains environment-specific configuration settings.
 * Edit this file to match your development, staging, or production environments.
 */

// Define environments
const ENV = {
  DEV: "development",
  STAGING: "staging",
  PROD: "production",
};

// Set the current environment
// Change this value manually for different environments
// or use build tools to replace it during the build process
const CURRENT_ENV = ENV.DEV;

// Environment-specific configuration
const config = {
  // Development environment (local)
  [ENV.DEV]: {
    // API endpoints
    apiBaseUrl: "http://localhost:3000/api/v1",
    apiBasePath: "/api/v1",

    // Web app URLs
    appBaseUrl: "http://localhost:3000",
    appRoutes: {
      login: "/login",
      signup: "/signup",
      jobs: {
        new: "/jobs/new",
        list: "/jobs",
        details: (id) => `/jobs/${id}`,
      },
      contacts: {
        new: "/contacts/new",
        list: "/contacts",
        details: (id) => `/contacts/${id}`,
      },
      buyCredits: "/buy-credits",
    },

    // Authentication settings
    authTokenExpiry: 3600 * 1000, // 1 hour in milliseconds

    // Feature flags
    features: {
      aiEnhancement: true,
      contactExtraction: false, // Feature in development
    },
  },

  // Staging environment
  [ENV.STAGING]: {
    apiBaseUrl: "https://staging-api.pursuitpal.com/api/v1",
    apiBasePath: "/api/v1",

    appBaseUrl: "https://staging.pursuitpal.com",
    appRoutes: {
      login: "/login",
      signup: "/signup",
      jobs: {
        new: "/jobs/new",
        list: "/jobs",
        details: (id) => `/jobs/${id}`,
      },
      contacts: {
        new: "/contacts/new",
        list: "/contacts",
        details: (id) => `/contacts/${id}`,
      },
      buyCredits: "/buy-credits",
    },

    authTokenExpiry: 3600 * 1000,

    features: {
      aiEnhancement: true,
      contactExtraction: false,
    },
  },

  // Production environment
  [ENV.PROD]: {
    apiBaseUrl: "https://api.pursuitpal.com/api/v1",
    apiBasePath: "/api/v1",

    appBaseUrl: "https://pursuitpal.com",
    appRoutes: {
      login: "/login",
      signup: "/signup",
      jobs: {
        new: "/jobs/new",
        list: "/jobs",
        details: (id) => `/jobs/${id}`,
      },
      contacts: {
        new: "/contacts/new",
        list: "/contacts",
        details: (id) => `/contacts/${id}`,
      },
      buyCredits: "/buy-credits",
    },

    authTokenExpiry: 3600 * 1000,

    features: {
      aiEnhancement: true,
      contactExtraction: true,
    },
  },
};

// Helper to get the full URL for a specific route
const getUrl = (routePath) => {
  const currentConfig = config[CURRENT_ENV];
  return `${currentConfig.appBaseUrl}${routePath}`;
};

// Export the configuration for the current environment
const currentConfig = config[CURRENT_ENV];

export default {
  ...currentConfig,

  // Helper methods
  getApiUrl: (endpoint) => {
    return `${currentConfig.apiBaseUrl}${
      endpoint.startsWith("/") ? endpoint : `/${endpoint}`
    }`;
  },

  getAppUrl: (route) => {
    return `${currentConfig.appBaseUrl}${route}`;
  },

  // Include the current environment and all environments enum
  ENV,
  CURRENT_ENV,

  // Utility function to check if a feature is enabled
  isFeatureEnabled: (featureName) => {
    return currentConfig.features[featureName] === true;
  },
};
