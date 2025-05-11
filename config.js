/**
 * PursuitPal - Configuration
 *
 * This file contains the configuration settings for the PursuitPal extension.
 * Edit these values to match your environment setup.
 */

const config = {
  // API endpoints
  apiBaseUrl: "https://api.pursuitpal.app/api/v1",

  // Web app URLs
  appBaseUrl: "https://pursuitpal.app",
  // Routes
  routes: {
    // Auth routes
    login: "/login",
    register: "/register",

    jobs: {
      new: "/jobs/new",
      list: "/jobs",
      details: (id) => `/jobs/${id}`,
    },

    // Contact routes
    contacts: {
      new: "/contacts/new",
      list: "/contacts",
      details: (id) => `/contacts/${id}`,
    },

    // Other routes
    buyCredits: "/buy-credits",
  },

  // Authentication settings
  auth: {
    tokenExpiry: 3600 * 7000,
  },

  // Feature flags
  features: {
    aiEnhancement: true,
    contactExtraction: false, // Feature in development
  },

  // Helper methods
  getApiUrl: function (endpoint) {
    return `${this.apiBaseUrl}${
      endpoint.startsWith("/") ? endpoint : `/${endpoint}`
    }`;
  },

  getAppUrl: function (route) {
    return `${this.appBaseUrl}${route}`;
  },

  isFeatureEnabled: function (featureName) {
    return this.features[featureName] === true;
  },
};

// Make the config object available globally
window.appConfig = config;

// Export for module usage
if (typeof module !== "undefined" && module.exports) {
  module.exports = config;
}
