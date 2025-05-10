/**
 * PursuitPal - Configuration Loader
 *
 * This file loads the configuration from config.js and makes it
 * available throughout the extension.
 */

class ConfigLoader {
  constructor() {
    this.config = null;
    this.loadConfig();
  }

  /**
   * Load configuration from config.js
   */
  loadConfig() {
    try {
      // In Chrome extension context, we import from the pre-defined config
      // We assume config.js is loaded before this file
      if (typeof window !== "undefined" && window.appConfig) {
        this.config = window.appConfig;
        console.log("Configuration loaded from global appConfig");
        return this.config;
      }

      // For module environment or if global config not available
      try {
        // Try to import from config.js
        this.config = require("./config.js");
        console.log("Configuration loaded from config.js module");
        return this.config;
      } catch (importError) {
        console.warn("Could not import config.js as module:", importError);
        // Fall back to embedded config
        return this.loadEmbeddedConfig();
      }
    } catch (error) {
      console.error("Error loading configuration:", error);
      // Fall back to embedded config
      return this.loadEmbeddedConfig();
    }
  }

  /**
   * Get the current configuration
   */
  getConfig() {
    if (!this.config) {
      this.loadConfig();
    }
    return this.config;
  }

  /**
   * Get a specific configuration value
   * @param {string} key - Configuration key (dot notation supported, e.g., 'features.aiEnhancement')
   * @param {any} defaultValue - Default value if key not found
   */
  get(key, defaultValue = null) {
    if (!this.config) {
      this.loadConfig();
    }

    // Support dot notation for nested properties
    const parts = key.split(".");
    let value = this.config;

    for (const part of parts) {
      if (value && typeof value === "object" && part in value) {
        value = value[part];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  /**
   * Check if a feature is enabled
   * @param {string} featureName - Name of the feature
   */
  isFeatureEnabled(featureName) {
    return this.get(`features.${featureName}`) === true;
  }

  /**
   * Get API URL with endpoint
   * @param {string} endpoint - API endpoint
   */
  getApiUrl(endpoint) {
    const baseUrl = this.get("apiBaseUrl");
    return `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  }

  /**
   * Get app URL with route
   * @param {string} route - Route path
   */
  getAppUrl(route) {
    const baseUrl = this.get("appBaseUrl");
    return `${baseUrl}${route}`;
  }

  /**
   * Fallback embedded configuration
   * This is used if loading from config.js fails
   */
  loadEmbeddedConfig() {
    console.warn("Using embedded configuration as fallback");

    this.config = {
      // API endpoints
      apiBaseUrl: "https://api.pursuitpal.app/api/v1",

      // Web app URLs
      appBaseUrl: "https://pursuitpal.app/",

      // Routes
      routes: {
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
      auth: {
        tokenExpiry: 3600 * 1000, // 1 hour in milliseconds
      },

      // Feature flags
      features: {
        aiEnhancement: true,
        contactExtraction: false,
      },
    };

    // Add helper methods
    this.config.getApiUrl = this.getApiUrl.bind(this);
    this.config.getAppUrl = this.getAppUrl.bind(this);
    this.config.isFeatureEnabled = this.isFeatureEnabled.bind(this);

    return this.config;
  }
}

// Create and export a singleton instance
const configLoader = new ConfigLoader();

// Make it available globally for non-module scripts
if (typeof window !== "undefined") {
  window.configLoader = configLoader;
}

// Export for module usage
if (typeof module !== "undefined" && module.exports) {
  module.exports = configLoader;
}
