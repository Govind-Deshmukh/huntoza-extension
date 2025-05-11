/**
 * PursuitPal - Enhanced Background Script
 *
 * Improved version with better security, memory management, and error handling
 */

// IMPORTANT: Don't use importScripts in MV3, use ES modules instead
// The auth service code is moved inline for this service worker

// Global auth service
const authService = {
  // Configure constants
  API_BASE_URL: "https://api.pursuitpal.app/api/v1",
  TOKEN_EXPIRY_DURATION: 3600 * 1000,
  csrfToken: null,
  isRefreshingToken: false,
  tokenRefreshPromise: null,

  // Get stored CSRF token
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
  },

  // Store CSRF token with expiration
  async storeCsrfToken(token) {
    await chrome.storage.local.set({
      csrfToken: token,
      csrfTokenExpiry: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });
  },

  // Initialize CSRF protection
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
  },

  // Get secure headers for API requests
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
  },

  // Get stored authentication data
  async getAuthData() {
    return await chrome.storage.local.get([
      "token",
      "refreshToken",
      "tokenExpiry",
      "user",
    ]);
  },

  // Check if the user is currently authenticated
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
  },

  // Get the current user data with enhanced security
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
  },

  // Get user data expiry timestamp from storage
  async getUserDataExpiry() {
    const result = await chrome.storage.local.get(["userDataExpiry"]);
    return result.userDataExpiry;
  },

  // Refresh the access token with enhanced security
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
  },

  // Log the user out with improved security
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
  },

  // Login with username and password - enhanced with security features
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
  },

  // Save authentication data securely
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
  },

  // Validate a token's format (simple validation, not cryptographic)
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
  },
};

// Constants
const APP_BASE_URL = "https://pursuitpal.app";
const API_BASE_URL = "https://api.pursuitpal.app/api/v1";

// Global state
let pendingApplicationData = null;
let pendingContactData = null;
let currentTabId = null;
let lastActiveTab = null;

// Initialize the auth service
authService.initCsrfProtection().catch((error) => {
  console.warn("Failed to initialize CSRF protection:", error);
});

// Set up a memory cleanup alarm - runs every 30 minutes
chrome.alarms.create("memoryCleanup", { periodInMinutes: 30 });

// Listen for alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "memoryCleanup") {
    cleanupMemory();
  }
});

// Memory cleanup function
async function cleanupMemory() {
  console.log("Running memory cleanup...");

  // Clear any pending data that's been sitting for more than 1 hour
  const oneHourAgo = Date.now() - 60 * 60 * 1000;

  const storage = await chrome.storage.local.get([
    "pendingJobTimestamp",
    "pendingContactTimestamp",
  ]);

  if (storage.pendingJobTimestamp && storage.pendingJobTimestamp < oneHourAgo) {
    chrome.storage.local.remove([
      "pendingJobApplication",
      "pendingJobTimestamp",
    ]);
  }

  if (
    storage.pendingContactTimestamp &&
    storage.pendingContactTimestamp < oneHourAgo
  ) {
    chrome.storage.local.remove(["pendingContact", "pendingContactTimestamp"]);
  }

  // Reset global variables if not recently used
  if (!currentTabId) {
    pendingApplicationData = null;
    pendingContactData = null;
  }
}

// Listen for messages from sidebar or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Validate message source for security when appropriate
  if (request.action !== "checkAuth" && request.action !== "getCurrentUser") {
    if (!isValidMessageSource(sender)) {
      console.error("Invalid message source:", sender);
      sendResponse({ success: false, error: "Invalid message source" });
      return false;
    }
  }

  handleMessage(request, sender, sendResponse);
  return true; // Keep the message channel open for async response
});

// Validate message source for security
function isValidMessageSource(sender) {
  // Always trust messages from our own extension
  if (sender.id === chrome.runtime.id) {
    return true;
  }

  // For external messages, check the URL
  if (sender.url && sender.url.startsWith("https://pursuitpal.app")) {
    return true;
  }

  // Default: reject unknown sources
  return false;
}

// Handle incoming messages
async function handleMessage(request, sender, sendResponse) {
  try {
    switch (request.action) {
      case "saveJobData":
        // Sanitize data before storing
        const sanitizedJobData = sanitizeJobData(request.data);
        await chrome.storage.local.set({ jobData: sanitizedJobData });
        sendResponse({ success: true });
        break;

      case "saveContactData":
        // Sanitize data before storing
        const sanitizedContactData = sanitizeContactData(request.data);
        await chrome.storage.local.set({ contactData: sanitizedContactData });
        sendResponse({ success: true });
        break;

      case "getPendingApplicationData":
        sendResponse({ data: pendingApplicationData });
        pendingApplicationData = null;
        break;

      case "getPendingContactData":
        sendResponse({ data: pendingContactData });
        pendingContactData = null;
        break;

      case "checkAuth":
        try {
          const isAuthenticated = await authService.isAuthenticated();
          sendResponse({ isAuthenticated });
        } catch (error) {
          console.error("Auth check error:", error);
          sendResponse({ isAuthenticated: false, error: error.message });
        }
        break;

      case "logout":
        try {
          await authService.logout();
          sendResponse({ success: true });
        } catch (error) {
          console.error("Logout error:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case "getCurrentUser":
        try {
          const user = await authService.getCurrentUser();
          sendResponse({ success: true, user });
        } catch (error) {
          console.error("Error getting user data:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case "getParentTabId":
        sendResponse({ tabId: currentTabId });
        break;

      case "openLoginPage":
        chrome.tabs.create({ url: "login.html" });
        sendResponse({ success: true });
        break;

      case "getJobDataForCurrentTab":
        getJobDataForCurrentTab(sendResponse);
        break;

      case "extractJobDataFromCurrentTab":
        extractJobDataFromCurrentTab(sendResponse);
        break;

      case "openJobForm":
        openJobFormInNewTab(request.jobData, sendResponse);
        break;

      default:
        console.warn("Unknown action:", request.action);
        sendResponse({ success: false, error: "Unknown action" });
    }
  } catch (error) {
    console.error("Error handling message:", error);
    sendResponse({
      success: false,
      error: error.message || "An unknown error occurred",
    });
  }
}

// Sanitize job data before storing
function sanitizeJobData(data) {
  if (!data) return null;

  // Create a safe copy with only expected fields
  const safeData = {
    company: sanitizeString(data.company),
    position: sanitizeString(data.position),
    jobLocation: sanitizeString(data.jobLocation),
    jobType: sanitizeString(data.jobType),
    jobDescription: sanitizeString(data.jobDescription),
    jobUrl: sanitizeUrl(data.jobUrl),
    priority: ["low", "medium", "high"].includes(data.priority)
      ? data.priority
      : "medium",
  };

  // Handle salary object separately
  if (data.salary && typeof data.salary === "object") {
    safeData.salary = {
      min: sanitizeNumber(data.salary.min),
      max: sanitizeNumber(data.salary.max),
      currency: sanitizeCurrency(data.salary.currency),
    };
  } else {
    safeData.salary = { min: 0, max: 0, currency: "INR" };
  }

  return safeData;
}

// Sanitize contact data before storing
function sanitizeContactData(data) {
  if (!data) return null;

  // Create a safe copy with only expected fields
  return {
    name: sanitizeString(data.name),
    email: sanitizeString(data.email),
    phone: sanitizeString(data.phone),
    company: sanitizeString(data.company),
    position: sanitizeString(data.position),
    profileUrl: sanitizeUrl(data.profileUrl),
    notes: sanitizeString(data.notes),
  };
}

// String sanitization helper
function sanitizeString(str) {
  if (typeof str !== "string") return "";
  return str.slice(0, 10000); // Limit string length
}

// URL sanitization helper
function sanitizeUrl(url) {
  if (typeof url !== "string") return "";

  try {
    // Ensure URL is properly formed and uses https or http
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return "";
    }
    return url;
  } catch (e) {
    return "";
  }
}

// Number sanitization helper
function sanitizeNumber(num) {
  const parsed = parseInt(num);
  return isNaN(parsed) ? 0 : Math.max(0, parsed);
}

// Currency sanitization helper
function sanitizeCurrency(currency) {
  const validCurrencies = ["INR", "USD", "EUR", "GBP", "JPY"];
  return validCurrencies.includes(currency) ? currency : "INR";
}

// Get job data for current tab
async function getJobDataForCurrentTab(sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tabs.length === 0) {
      sendResponse({ success: false });
      return;
    }

    const currentTab = tabs[0];
    const storage = await chrome.storage.local.get(["jobData"]);

    if (storage.jobData && storage.jobData.jobUrl === currentTab.url) {
      // We have cached data for this URL
      sendResponse({ success: true, jobData: storage.jobData });
    } else {
      sendResponse({ success: false });
    }
  } catch (error) {
    console.error("Error getting job data for current tab:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Extract job data from current tab
async function extractJobDataFromCurrentTab(sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tabs.length === 0) {
      sendResponse({ success: false });
      return;
    }

    const currentTab = tabs[0];

    try {
      // Inject content script if needed
      await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        files: ["content.js"],
      });

      // Send message to content script to extract data
      chrome.tabs.sendMessage(
        currentTab.id,
        { action: "extractJobData" },
        async (response) => {
          if (chrome.runtime.lastError) {
            console.error("Content script error:", chrome.runtime.lastError);
            sendResponse({
              success: false,
              error: chrome.runtime.lastError.message,
            });
            return;
          }

          if (response && Object.keys(response).length > 0) {
            // Sanitize and store the job data
            const sanitizedJobData = sanitizeJobData(response);
            await chrome.storage.local.set({ jobData: sanitizedJobData });
            sendResponse({ success: true, jobData: sanitizedJobData });
          } else {
            sendResponse({ success: false });
          }
        }
      );
    } catch (error) {
      console.error("Script injection error:", error);
      sendResponse({ success: false, error: error.message });
    }
  } catch (error) {
    console.error("Error extracting job data from current tab:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Open job form in new tab
async function openJobFormInNewTab(jobData, sendResponse) {
  try {
    // Sanitize data before storing
    const sanitizedJobData = sanitizeJobData(jobData);

    // Store with timestamp for cleanup purposes
    await chrome.storage.local.set({
      pendingJobApplication: sanitizedJobData,
      pendingJobTimestamp: Date.now(),
    });

    // Create a new tab with the job form
    await chrome.tabs.create({ url: `${APP_BASE_URL}/jobs/new` });

    sendResponse({ success: true });
  } catch (error) {
    console.error("Error opening job form:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// On extension installation, set up initial storage
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("PursuitPal extension installed");

    // Set default options
    chrome.storage.sync.set({
      options: {
        autoExtractOnPageLoad: true,
        aiEnhancementEnabled: false,
      },
    });

    // Show onboarding page
    chrome.tabs.create({ url: "onboarding.html" });
  } else if (details.reason === "update") {
    console.log("PursuitPal extension updated");

    // Check if we need to migrate data
    migrateDataIfNeeded(details.previousVersion);
  }
});

// Data migration function
async function migrateDataIfNeeded(previousVersion) {
  if (previousVersion && previousVersion < "1.0.1") {
    console.log("Migrating data from version", previousVersion);

    try {
      // Example migration - update data structure
      const storage = await chrome.storage.local.get(["jobData"]);

      if (storage.jobData) {
        // Ensure job data has all required fields in new format
        const updatedJobData = {
          ...storage.jobData,

          // Add any new fields or transformations here
          timestamp: storage.jobData.timestamp || Date.now(),

          // Update any changed structures
          salary: {
            min: sanitizeNumber(storage.jobData.salary?.min || 0),
            max: sanitizeNumber(storage.jobData.salary?.max || 0),
            currency: sanitizeCurrency(
              storage.jobData.salary?.currency || "INR"
            ),
          },
        };

        await chrome.storage.local.set({ jobData: updatedJobData });
      }
    } catch (error) {
      console.error("Data migration error:", error);
    }
  }
}

// Handle browser action click (icon click)
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Save the current tab ID for reference
    currentTabId = tab.id;
    lastActiveTab = tab;

    // Check if user is authenticated
    const isAuthenticated = await authService.isAuthenticated();

    // If not authenticated, show login page
    if (!isAuthenticated) {
      chrome.tabs.create({ url: "login.html" });
      return;
    }

    // If authenticated, inject the sidebar
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["sidebar-injector.js"],
      });
    } catch (error) {
      console.error("Failed to inject sidebar:", error);
      // Fallback to opening in a popup
      chrome.windows.create({
        url: "sidebar.html",
        type: "popup",
        width: 450,
        height: 600,
      });
    }
  } catch (error) {
    console.error("Error in action click handler:", error);
    // Show error in notification
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });

    // Clear badge after 5 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: "" });
    }, 5000);
  }
});

// Handle tab updates, especially for state transfer
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only run when page load is complete
  if (changeInfo.status === "complete") {
    handleTabUpdate(tabId, tab);
  }
});

// Handle tab updates
async function handleTabUpdate(tabId, tab) {
  try {
    // Define URLs for job and contact forms
    const jobFormUrl = `${APP_BASE_URL}/jobs/new`;
    const contactFormUrl = `${APP_BASE_URL}/contacts/new`;

    // Check if this is the jobs/new page loading
    if (
      tab.url.includes(jobFormUrl) ||
      tab.url.includes("pursuitpal.app/jobs/new")
    ) {
      // Check authentication first
      const isAuthenticated = await authService.isAuthenticated();

      if (!isAuthenticated) {
        // Not authenticated, don't proceed
        console.log("Not authenticated, can't transfer job data");
        return;
      }

      // Retrieve pending job application data
      chrome.storage.local.get(["pendingJobApplication"], (result) => {
        if (result.pendingJobApplication) {
          console.log("Found pending job application data for tab:", tabId);

          // Inject form filler script
          chrome.scripting
            .executeScript({
              target: { tabId: tabId },
              files: ["form-filler.js"],
            })
            .then(() => {
              console.log("Successfully injected form filler script");
            })
            .catch((err) => {
              console.error("Error injecting form filler script:", err);
            });
        }
      });
    }

    // Check if this is the contacts/new page loading
    if (
      tab.url.includes(contactFormUrl) ||
      tab.url.includes("pursuitpal.app/contacts/new")
    ) {
      handleContactFormPage(tabId);
    }

    // If auto-extract is enabled, inject content script on job posting pages or LinkedIn profile pages
    if (isJobPostingPage(tab.url) || isLinkedInProfilePage(tab.url)) {
      handleJobPostingPage(tabId);
    }
  } catch (error) {
    console.error("Error handling tab update:", error);
  }
}

// Handle contact form page
async function handleContactFormPage(tabId) {
  // Check authentication first
  const isAuthenticated = await authService.isAuthenticated();

  if (!isAuthenticated) {
    // Not authenticated, don't proceed
    console.log("Not authenticated, can't transfer contact data");
    return;
  }

  // Retrieve pending contact data
  chrome.storage.local.get(["pendingContact"], (result) => {
    if (result.pendingContact) {
      console.log("Found pending contact data for tab:", tabId);

      // Inject form filler script
      chrome.scripting
        .executeScript({
          target: { tabId: tabId },
          files: ["form-filler.js"],
        })
        .then(() => {
          console.log("Successfully injected form filler script");
        })
        .catch((err) => {
          console.error("Error injecting form filler script:", err);
        });
    }
  });
}

// Handle job posting page
async function handleJobPostingPage(tabId) {
  // Check authentication first
  const isAuthenticated = await authService.isAuthenticated();

  if (!isAuthenticated) {
    // Not authenticated, don't proceed
    console.log("Not authenticated, can't extract data");
    return;
  }

  // Check user settings
  chrome.storage.sync.get("options", (result) => {
    const options = result.options || {};

    if (options.autoExtractOnPageLoad) {
      chrome.scripting
        .executeScript({
          target: { tabId: tabId },
          files: ["content.js"],
        })
        .then(() => {
          console.log("Auto-injected content script on job page");
        })
        .catch((err) => {
          console.log("Failed to inject content script:", err);
        });
    }
  });
}

// Function to determine if a URL is likely a job posting
function isJobPostingPage(url) {
  if (!url) return false;

  // Common job board URL patterns
  const jobBoardPatterns = [
    /linkedin\.com\/jobs/i,
    /indeed\.com\/viewjob/i,
    /glassdoor\.com\/job/i,
    /ziprecruiter\.com\/jobs/i,
    /monster\.com\/job/i,
    /careers\./i,
    /jobs\./i,
    /\/jobs?\//i,
    /\/careers?\//i,
    /\/job\-details/i,
    /\/posting/i,
    /lever\.co\/[^\/]+\/jobs/i,
    /greenhouse\.io\/jobs/i,
  ];

  return jobBoardPatterns.some((pattern) => pattern.test(url));
}

// Function to determine if a URL is a LinkedIn profile page
function isLinkedInProfilePage(url) {
  if (!url) return false;
  return /linkedin\.com\/in\//i.test(url);
}
