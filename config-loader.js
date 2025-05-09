/**
 * PursuitPal - YAML Configuration Loader
 *
 * This file loads and parses the YAML configuration.
 * You'll need to include the 'js-yaml' library in your project.
 * Install it with: npm install js-yaml
 */

// Note: For Chrome Extensions, you'll need to include js-yaml in your extension
// Since Chrome Extensions don't support npm directly, you can:
// 1. Download the js-yaml.min.js file and include it in your extension
// 2. Or use the CDN version and include it in your manifest.json as a web_accessible_resource

// Sample implementation using the js-yaml library
class ConfigLoader {
  constructor() {
    this.config = null;
    this.currentEnv = null;
  }

  /**
   * Load configuration from YAML file
   * @param {string} yamlContent - The content of the YAML file
   * @returns {Object} - The parsed configuration
   */
  loadFromYaml(yamlContent) {
    try {
      // Parse YAML content
      const parsedConfig = jsyaml.load(yamlContent);

      // Extract current environment
      this.currentEnv = parsedConfig.current_environment;

      // Get environment-specific configuration
      this.config = parsedConfig.environments[this.currentEnv];

      // Add helper methods
      this.addHelperMethods();

      return this.config;
    } catch (error) {
      console.error("Error loading configuration:", error);
      throw error;
    }
  }

  /**
   * Add helper methods to the configuration object
   */
  addHelperMethods() {
    // Add getApiUrl helper
    this.config.getApiUrl = (endpoint) => {
      return `${this.config.api.base_url}${
        endpoint.startsWith("/") ? endpoint : `/${endpoint}`
      }`;
    };

    // Add getAppUrl helper
    this.config.getAppUrl = (routePath) => {
      return `${this.config.app.base_url}${routePath}`;
    };

    // Add isFeatureEnabled helper
    this.config.isFeatureEnabled = (featureName) => {
      const formattedName = featureName
        .replace(/([A-Z])/g, "_$1")
        .toLowerCase();
      return this.config.features[formattedName] === true;
    };

    // Add current environment
    this.config.CURRENT_ENV = this.currentEnv;
  }

  /**
   * For Chrome Extension usage, load the embedded YAML content
   * This is a fallback method if loading from a file is not possible
   */
  loadEmbeddedConfig() {
    // Embed the YAML content directly if file loading is not an option
    const yamlContent = `
# PursuitPal Configuration
current_environment: development

environments:
  development:
    api:
      base_url: http://localhost:3000/api/v1
      base_path: /api/v1
      health_endpoint: /health
    
    app:
      base_url: http://localhost:3000
      routes:
        login: /login
        signup: /signup
        jobs:
          new: /jobs/new
          list: /jobs
        contacts:
          new: /contacts/new
          list: /contacts
        buy_credits: /buy-credits
    
    auth:
      token_expiry: 3600000
    
    features:
      ai_enhancement: true
      contact_extraction: false

  # Add staging and production environments as needed
    `;

    return this.loadFromYaml(yamlContent);
  }
}

// Create and export a singleton instance
const configLoader = new ConfigLoader();
export default configLoader;
