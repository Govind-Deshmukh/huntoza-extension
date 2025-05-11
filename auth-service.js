/**
 * PursuitPal - Enhanced Authentication Service
 *
 * A central service to handle authentication across the extension:
 * - Token management (access and refresh tokens)
 * - Authenticated API requests with improved security
 * - Authentication status checking
 * - Secure logout
 * - CSRF protection
 * - Improved error handling
 */

class AuthService {
  constructor() {
    // Hardcoded API URL
    this.API_BASE_URL = "https://api.pursuitpal.app/api/v1";
    this.isRefreshingToken = false;
    this.tokenRefreshPromise = null;
    this.pendingRequests = [];

    // Default token expiration time (1 hour in milliseconds)
    this.TOKEN_EXPIRY_DURATION = 3600 * 1000;

    // Initialize CSRF protection
    this.csrfToken = null;
    this.initCsrfProtection();
  }

  /**
   * Initialize CSRF protection by getting a token from the server
   * This helps prevent cross-site request forgery attacks
   */
  async initCsrfProtection() {
    try {
      // Try to get a CSRF token from storage first
      const storedToken = await this.getStoredCsrfToken();
      if (storedToken) {
        this.csrfToken = storedToken;
        return;
      }

      // If no stored token, request a new one
      const response = await fetch(`${this.API_BASE_URL}/auth/csrf-token`, {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.csrfToken) {
          this.csrfToken = data.csrfToken;
          await this.storeCsrfToken(data.csrfToken);
        }
      }
    } catch (error) {
      console.warn("CSRF token initialization failed:", error);
      // Non-blocking error - the app can still work without CSRF protection
    }
  }

  /**
   * Get stored CSRF token
   */
  async getStoredCsrfToken() {
    const result = await chrome.storage.local.get([
      "csrfToken",
      "csrfTokenExpiry",
    ]);
    if (
      result.csrfToken &&
      result.csrfTokenExpiry &&
      Date.now() < result.csrfTokenExpiry
    ) {
      return result.csrfToken;
    }
    return null;
  }

  /**
   * Store CSRF token with expiration
   */
  async storeCsrfToken(token) {
    await chrome.storage.local.set({
      csrfToken: token,
      csrfTokenExpiry: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });
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
   * Get the current user data with enhanced security
   * @returns {Promise<Object|null>} User data or null if not authenticated
   */
  async getCurrentUser() {
    try {
      // First check if we have a cached user and it's not expired
      const authData = await this.getAuthData();
      const userDataExpiry = await this.getUserDataExpiry();

      // Check if user data is still valid (not older than 15 minutes)
      const USER_DATA_MAX_AGE = 15 * 60 * 1000; // 15 minutes

      if (authData.user && userDataExpiry && Date.now() < userDataExpiry) {
        return authData.user;
      }

      // If no cached user but we have a token, fetch from API
      if (authData.token) {
        // Fetch current user data from the API
        const response = await fetch(`${this.API_BASE_URL}/auth/me`, {
          method: "GET",
          headers: this.getSecureHeaders(authData.token),
          credentials: "include", // Include cookies if available
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            // Update stored user data with expiration
            await chrome.storage.local.set({
              user: data.user,
              userDataExpiry: Date.now() + USER_DATA_MAX_AGE,
            });
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
   * Get user data expiry timestamp from storage
   */
  async getUserDataExpiry() {
    const result = await chrome.storage.local.get(["userDataExpiry"]);
    return result.userDataExpiry;
  }

  /**
   * Make an authenticated API request with improved security and error handling
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

      // Set up request headers with CSRF protection
      const headers = {
        ...this.getSecureHeaders(authData.token),
        ...options.headers,
      };

      // Make the API request
      const requestUrl = `${this.API_BASE_URL}${endpoint}`;
      const response = await fetch(requestUrl, {
        ...options,
        headers,
        credentials: "include", // Include cookies if available
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

      // Handle CSRF token errors
      if (response.status === 403) {
        const data = await response.json();
        if (data.error && data.error.includes("CSRF")) {
          // Get a new CSRF token
          await this.initCsrfProtection();
          // Retry the request
          return this.fetchWithAuth(endpoint, options);
        }
      }

      // Parse response
      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error("Invalid response from server");
      }

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
   * Refresh the access token with enhanced security
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

          // Get refresh token endpoint
          const refreshUrl = `${this.API_BASE_URL}/auth/refresh-token`;

          // Call refresh token API with CSRF protection
          const response = await fetch(refreshUrl, {
            method: "POST",
            headers: this.getSecureHeaders(),
            credentials: "include", // Include cookies if available
            body: JSON.stringify({ refreshToken: authData.refreshToken }),
          });

          let data;
          try {
            data = await response.json();
          } catch (e) {
            throw new Error(
              "Invalid response from server during token refresh"
            );
          }

          if (!response.ok || !data.success) {
            throw new Error(data.message || "Failed to refresh token");
          }

          // Save new tokens securely
          await chrome.storage.local.set({
            token: data.token,
            refreshToken: data.refreshToken,
            tokenExpiry: Date.now() + this.TOKEN_EXPIRY_DURATION,
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
   * Get secure headers for API requests
   * @param {string} token - Optional auth token
   * @returns {Object} Headers object
   */
  getSecureHeaders(token = null) {
    const headers = {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest", // Helps prevent CSRF
    };

    // Add auth token if provided
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Add CSRF token if available
    if (this.csrfToken) {
      headers["X-CSRF-Token"] = this.csrfToken;
    }

    return headers;
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
   * Log the user out with improved security
   * @returns {Promise<Object>} Success status
   */
  async logout() {
    try {
      // Call logout API if available
      const authData = await this.getAuthData();
      if (authData.token) {
        try {
          const logoutUrl = `${this.API_BASE_URL}/auth/logout`;

          // Use CSRF protection for logout
          await fetch(logoutUrl, {
            method: "POST",
            headers: this.getSecureHeaders(authData.token),
            credentials: "include", // Include cookies
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
      // Always clear all local auth data regardless of API success
      await chrome.storage.local.remove([
        "token",
        "refreshToken",
        "tokenExpiry",
        "user",
        "userDataExpiry",
        "csrfToken",
        "csrfTokenExpiry",
      ]);

      // Return success to indicate logout completed
      return { success: true };
    }
  }

  /**
   * Login with username and password - enhanced with security features
   * @param {string} email User email
   * @param {string} password User password
   * @returns {Promise<Object>} Auth response
   */
  async login(email, password) {
    try {
      // Validate inputs
      if (!email || !password) {
        throw new Error("Email and password are required");
      }

      // Initialize CSRF protection if needed
      if (!this.csrfToken) {
        await this.initCsrfProtection();
      }

      // Login endpoint
      const loginEndpoint = `${this.API_BASE_URL}/auth/login`;

      // Call login API with CSRF protection
      const response = await fetch(loginEndpoint, {
        method: "POST",
        headers: this.getSecureHeaders(),
        credentials: "include", // Include cookies
        body: JSON.stringify({ email, password }),
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error("Invalid response from server during login");
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Invalid credentials");
      }

      // Handle successful login
      const { token, refreshToken, user } = data;

      // Save authentication data securely
      await this.saveAuthData(token, refreshToken, user);

      return {
        success: true,
        user,
      };
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  /**
   * Save authentication data securely
   * @param {string} token Access token
   * @param {string} refreshToken Refresh token
   * @param {Object} user User data
   */
  async saveAuthData(token, refreshToken, user) {
    // Set token expiry
    const tokenExpiry = Date.now() + this.TOKEN_EXPIRY_DURATION;

    // Set user data expiry (15 minutes)
    const userDataExpiry = Date.now() + 15 * 60 * 1000;

    // Store tokens in Chrome's secure storage (encrypted)
    await chrome.storage.local.set({
      token,
      refreshToken,
      user,
      tokenExpiry,
      userDataExpiry,
    });
  }

  /**
   * Validate a token's format (simple validation, not cryptographic)
   * @param {string} token The token to validate
   * @returns {boolean} Whether the token format is valid
   */
  isValidTokenFormat(token) {
    // JWT tokens are typically 3 base64url-encoded segments separated by dots
    if (!token || typeof token !== "string") return false;

    // Check basic format
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    // Check that each part is base64url encoded
    for (const part of parts) {
      if (!/^[A-Za-z0-9_-]+$/i.test(part)) return false;
    }

    return true;
  }
}

// Create a new instance of AuthService
const authService = new AuthService();

// Check if we're in a browser context (where window exists)
if (typeof self !== "undefined" && typeof self.window !== "undefined") {
  // Make authService available globally in browser contexts only
  self.window.authService = authService;
}

// Export for use in ESM modules or CommonJS
if (typeof module !== "undefined" && module.exports) {
  module.exports = { authService };
}
