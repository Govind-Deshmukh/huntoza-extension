/**
 * PursuitPal - Authentication Service
 *
 * A central service to handle authentication across the extension:
 * - Token management (access and refresh tokens)
 * - Authenticated API requests
 * - Authentication status checking
 * - Secure logout
 */

class AuthService {
  constructor() {
    // Define default API URL without reliance on window/config
    this.API_BASE_URL = "https://api.pursuitpal.app/api/v1";

    // Try to get config if available (will only work in UI contexts, not in service worker)
    try {
      if (
        typeof window !== "undefined" &&
        (window.configLoader || window.appConfig)
      ) {
        const config = window.configLoader
          ? window.configLoader.getConfig()
          : window.appConfig;
        if (config && config.apiBaseUrl) {
          this.API_BASE_URL = config.apiBaseUrl;
        }
      }
    } catch (error) {
      console.error("Config loading error in AuthService:", error);
      // Continue with default API_BASE_URL
    }

    this.isRefreshingToken = false;
    this.tokenRefreshPromise = null;
    this.pendingRequests = [];
  }

  /**
   * Check if the user is currently authenticated
   * @returns {Promise<boolean>} True if authenticated
   */
  async isAuthenticated() {
    try {
      const authData = await this.getAuthData();
      if (!authData.token || !authData.refreshToken) {
        return false;
      }

      // Check token expiry
      if (Date.now() >= authData.tokenExpiry) {
        // Try to refresh the token
        try {
          await this.refreshToken();
          return true;
        } catch (error) {
          console.error("Token refresh failed:", error);
          await this.logout();
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error("Auth check error:", error);
      return false;
    }
  }

  /**
   * Get the current user data
   * @returns {Promise<Object|null>} User data or null if not authenticated
   */
  async getCurrentUser() {
    try {
      // First check if we have a cached user
      const authData = await this.getAuthData();

      if (authData.user) {
        return authData.user;
      }

      // If no cached user but we have a token, fetch from API
      if (authData.token) {
        // Fetch current user data from the API
        const response = await fetch(`${this.API_BASE_URL}/auth/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${authData.token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            // Update stored user data
            await chrome.storage.local.set({ user: data.user });
            return data.user;
          }
        }

        // If API call fails, attempt token refresh and try again
        if (response.status === 401) {
          try {
            await this.refreshToken();
            return this.getCurrentUser(); // Recursive call with new token
          } catch (refreshError) {
            console.error("Failed to refresh token:", refreshError);
            await this.logout();
            return null;
          }
        }
      }

      return null;
    } catch (error) {
      console.error("Error getting user data:", error);
      return null;
    }
  }

  /**
   * Make an authenticated API request
   * @param {string} endpoint - API endpoint (without base URL)
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Response data
   */
  async fetchWithAuth(endpoint, options = {}) {
    try {
      // Check authentication first
      const isAuth = await this.isAuthenticated();
      if (!isAuth) {
        throw new Error("Not authenticated");
      }

      // Get current auth data
      const authData = await this.getAuthData();

      // Set up request headers
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authData.token}`,
        ...options.headers,
      };

      // Make the API request
      // Build the URL based on whether endpoint starts with /
      const requestUrl = endpoint.startsWith("/")
        ? `${this.API_BASE_URL}${endpoint}`
        : `${this.API_BASE_URL}/${endpoint}`;

      const response = await fetch(requestUrl, {
        ...options,
        headers,
      });

      // If unauthorized, try to refresh token and retry
      if (response.status === 401) {
        try {
          await this.refreshToken();
          // Retry the request with new token
          return this.fetchWithAuth(endpoint, options);
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
          await this.logout();
          throw new Error("Session expired. Please log in again.");
        }
      }

      // Parse response
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "API request failed");
      }

      return data;
    } catch (error) {
      console.error("API request error:", error);
      throw error;
    }
  }

  /**
   * Refresh the access token
   * @returns {Promise<Object>} New tokens
   */
  async refreshToken() {
    // Only allow one refresh at a time
    if (this.isRefreshingToken) {
      return this.tokenRefreshPromise;
    }

    try {
      this.isRefreshingToken = true;

      // Create the refresh promise
      this.tokenRefreshPromise = new Promise(async (resolve, reject) => {
        try {
          const authData = await this.getAuthData();

          if (!authData.refreshToken) {
            throw new Error("No refresh token available");
          }

          // Build refresh token endpoint
          const refreshUrl = `${this.API_BASE_URL}/auth/refresh-token`;

          // Call refresh token API
          const response = await fetch(refreshUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ refreshToken: authData.refreshToken }),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.message || "Failed to refresh token");
          }

          // Default token expiry of 1 hour if not specified
          const tokenExpiryDuration = 3600 * 1000;

          // Save new tokens
          await chrome.storage.local.set({
            token: data.token,
            refreshToken: data.refreshToken,
            tokenExpiry: Date.now() + tokenExpiryDuration, // Token valid based on config
          });

          resolve({ token: data.token, refreshToken: data.refreshToken });
        } catch (error) {
          console.error("Token refresh error:", error);
          // Clear auth data on failure
          await this.logout();
          reject(error);
        }
      });

      return await this.tokenRefreshPromise;
    } finally {
      this.isRefreshingToken = false;
      this.tokenRefreshPromise = null;
    }
  }

  /**
   * Get stored authentication data
   * @returns {Promise<Object>} Auth data
   */
  async getAuthData() {
    return await chrome.storage.local.get([
      "token",
      "refreshToken",
      "tokenExpiry",
      "user",
    ]);
  }

  /**
   * Log the user out
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      // Call logout API if available
      const authData = await this.getAuthData();
      if (authData.token) {
        try {
          // Logout endpoint
          const logoutUrl = `${this.API_BASE_URL}/auth/logout`;

          await fetch(logoutUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authData.token}`,
            },
            body: JSON.stringify({ refreshToken: authData.refreshToken }),
          });
        } catch (error) {
          console.error("Logout API error:", error);
          // Continue with local logout even if API call fails
        }
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Always clear local auth data regardless of API success
      await chrome.storage.local.remove([
        "token",
        "refreshToken",
        "tokenExpiry",
        "user",
      ]);

      // Return success to indicate logout completed
      return { success: true };
    }
  }
}

// Export as singleton
const authService = new AuthService();

// Make it available globally for non-module scripts
if (typeof self !== "undefined") {
  self.authService = authService;
}

// Also make available in window context if it exists
if (typeof window !== "undefined") {
  window.authService = authService;
}
