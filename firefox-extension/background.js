/**
 * background.js - Background Service Worker
 *
 * Handles authentication, data extraction requests, and communication
 * between the extension and the PursuitPal web app.
 */

import { validateToken, login, logout, apiRequest } from "./utils/api.js";
import { showNotification, updateBadge } from "./utils/notification.js";

// Global configuration
const APP_URL = "https://pursuitpal.app";

// Initialize extension
browser.runtime.onInstalled.addListener(() => {
  console.log("PursuitPal extension installed");

  // Set default options
  browser.storage.sync.set({
    options: {
      autoExtract: true,
      showBadge: true,
      defaultPriority: "medium",
      defaultCurrency: "INR",
    },
  });

  // Show welcome page
  browser.tabs.create({
    url: "welcome.html",
  });
});

// Set up message listeners
browser.runtime.onMessage.addListener((message, sender) => {
  console.log("Message received in background:", message);

  switch (message.action) {
    case "checkAuth":
      return checkAuthStatus();

    case "login":
      return handleLogin(message.credentials);

    case "logout":
      return handleLogout();

    case "extractJobData":
      let tabId;

      if (sender.tab) {
        tabId = sender.tab.id;
        return extractJobData(tabId);
      } else {
        // If called from popup without tab info, get active tab
        return browser.tabs
          .query({ active: true, currentWindow: true })
          .then((tabs) => {
            if (tabs && tabs.length > 0) {
              return extractJobData(tabs[0].id);
            } else {
              return Promise.resolve({
                success: false,
                error: "No active tab found",
              });
            }
          });
      }

    case "saveJobData":
      return saveJobData(message.data);

    case "sendToApp":
      return sendDataToApp(message.data);

    case "pageIsJobForm":
      if (sender.tab) {
        return handleJobFormPage(sender.tab.id);
      }
      return Promise.resolve({ success: false, error: "No tab info provided" });
  }

  return Promise.resolve({ success: false, error: "Unknown action" });
});

// Check extension authentication status
async function checkAuthStatus() {
  try {
    const data = await browser.storage.local.get([
      "authToken",
      "lastAuthenticated",
      "user",
    ]);

    if (!data.authToken) {
      return { isAuthenticated: false };
    }

    // Check if token is still valid (less than 24 hours old or validate with backend)
    const tokenAge = Date.now() - (data.lastAuthenticated || 0);
    const isValid = tokenAge < 24 * 60 * 60 * 1000; // 24 hours

    if (!isValid) {
      // Validate token with backend
      const stillValid = await validateToken(data.authToken);

      if (!stillValid) {
        // Token is invalid, clear it
        await browser.storage.local.remove([
          "authToken",
          "lastAuthenticated",
          "user",
        ]);
        return { isAuthenticated: false };
      }

      // Update last authenticated time
      await browser.storage.local.set({ lastAuthenticated: Date.now() });
    }

    return {
      isAuthenticated: true,
      user: data.user,
    };
  } catch (error) {
    console.error("Error checking auth status:", error);
    return { isAuthenticated: false, error: error.message };
  }
}

// Handle login
async function handleLogin(credentials) {
  try {
    const response = await login(credentials);

    // Save auth data
    await browser.storage.local.set({
      authToken: response.token,
      refreshToken: response.refreshToken,
      user: response.user,
      lastAuthenticated: Date.now(),
    });

    return { success: true, user: response.user };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: error.message };
  }
}

// Handle logout
async function handleLogout() {
  try {
    const data = await browser.storage.local.get(["authToken"]);
    const authToken = data.authToken;

    if (authToken) {
      // Call logout API
      try {
        await logout(authToken);
      } catch (error) {
        console.error("Error calling logout API:", error);
      }
    }

    // Clear stored data regardless of API call success
    await browser.storage.local.remove([
      "authToken",
      "refreshToken",
      "user",
      "lastAuthenticated",
    ]);

    return { success: true };
  } catch (error) {
    console.error("Logout error:", error);
    return { success: false, error: error.message };
  }
}

// Extract job data from active tab
async function extractJobData(tabId) {
  try {
    console.log("Extracting data from tab:", tabId);

    // First ensure the content script is injected
    try {
      await browser.tabs.executeScript(tabId, {
        file: "content_script.js",
      });
      // Wait for content script to initialize
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.log("Content script may already be injected:", err);
    }

    // Execute extraction code
    const results = await browser.tabs.executeScript(tabId, {
      code: `
        if (typeof window._pursuitPalExtractData === 'function') {
          window._pursuitPalExtractData();
        } else {
          ({ error: "Extraction function not available" });
        }
      `,
    });

    if (!results || results.length === 0 || !results[0] || results[0].error) {
      console.error("Extraction failed:", results);
      const errorMessage =
        results && results[0] && results[0].error
          ? results[0].error
          : "Failed to extract job data";
      return { success: false, error: errorMessage };
    }

    return { success: true, data: results[0] };
  } catch (error) {
    console.error("Error extracting job data:", error);
    return { success: false, error: error.message };
  }
}

// Save job data to local storage
async function saveJobData(data) {
  try {
    // Add timestamp
    const jobData = {
      ...data,
      timestamp: Date.now(),
    };

    await browser.storage.local.set({ currentJobData: jobData });
    return { success: true };
  } catch (error) {
    console.error("Error saving job data:", error);
    return { success: false, error: error.message };
  }
}

async function sendDataToApp(data) {
  try {
    const storedData = await browser.storage.local.get(["authToken"]);
    const authToken = storedData.authToken;

    if (!authToken) {
      return { success: false, error: "Not authenticated" };
    }

    // Store the job data in localStorage for the web app to access
    await browser.storage.local.set({
      pendingJobData: JSON.stringify(data),
    });

    console.log("Stored pendingJobData for web app:", data);

    // Open the job form page
    await browser.tabs.create({
      url: `${APP_URL}/jobs/new`,
    });

    return { success: true, message: "Form opened with data" };
  } catch (error) {
    console.error("Error sending data to app:", error);
    return { success: false, error: error.message };
  }
}

// Handle a page that's ready to receive job form data
async function handleJobFormPage(tabId) {
  try {
    // Get the stored job data
    const data = await browser.storage.local.get([
      "lastCreatedJobData",
      "currentJobData",
      "pendingJobData",
    ]);

    // Try to get data from pendingJobData first, then fall back to other sources
    let jobData;

    if (data.pendingJobData) {
      try {
        jobData = JSON.parse(data.pendingJobData);
      } catch (e) {
        console.error("Error parsing pendingJobData:", e);
      }
    }

    if (!jobData) {
      jobData = data.lastCreatedJobData || data.currentJobData;
    }

    if (!jobData) {
      return { success: false, error: "No job data found" };
    }

    // Send the data to the content script to fill the form
    await browser.tabs.sendMessage(tabId, {
      action: "fillJobForm",
      data: jobData,
    });

    return { success: true, data: jobData };
  } catch (error) {
    console.error("Error handling job form page:", error);
    return { success: false, error: error.message };
  }
}

// Listen for tab updates
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    // If we're on the PursuitPal new job form page, inject the pending job data
    if (tab.url.includes(`pursuitpal.app/jobs/new`)) {
      console.log("Detected job creation page");

      // Get stored job data
      browser.storage.local.get(["pendingJobData"]).then((data) => {
        if (data.pendingJobData) {
          console.log("Found pending job data to inject:", data.pendingJobData);

          // Wait a moment for the page to initialize
          setTimeout(() => {
            // Inject the data into localStorage
            browser.tabs
              .executeScript(tabId, {
                code: `
                try {
                  localStorage.setItem('pendingJobData', '${data.pendingJobData.replace(
                    /'/g,
                    "\\'"
                  )}');
                  console.log("Successfully injected job data to localStorage");
                  
                  // Notify the app that data is available
                  window.dispatchEvent(new CustomEvent('jobDataAvailable', {
                    detail: { source: 'firefoxExtension' }
                  }));
                  
                  true;
                } catch (e) {
                  console.error("Failed to inject job data:", e);
                  false;
                }
              `,
              })
              .then((result) => {
                if (result && result[0]) {
                  // Remove from extension storage to prevent duplicates
                  browser.storage.local.remove(["pendingJobData"]);
                }
              })
              .catch((err) => {
                console.error("Error injecting data:", err);
              });
          }, 1000);
        }
      });
    }

    // Update badge for job boards
    updateBadgeForJobSite(tab);
  }
});

/**
 * Update badge for job sites
 *
 * @param {browser.tabs.Tab} tab - Tab object
 */
function updateBadgeForJobSite(tab) {
  // Check if the tab is a job board
  if (isJobBoardUrl(tab.url)) {
    // Get options to see if badges are enabled
    browser.storage.sync.get("options").then((data) => {
      const options = data.options || { showBadge: true };

      if (options.showBadge) {
        // Update the extension icon to indicate this is a job board
        updateBadge("JOB", "#552dec");
      }
    });
  } else {
    // Clear the badge
    updateBadge("");
  }
}

/**
 * Check if URL is a job board
 *
 * @param {string} url - URL to check
 * @return {boolean} - True if URL is a job board
 */
function isJobBoardUrl(url) {
  const jobBoardPatterns = [
    /linkedin\.com\/jobs/i,
    /indeed\.com\/viewjob/i,
    /glassdoor\.com\/job/i,
    /monster\.com\/job/i,
    /naukri\.com\/job-listings/i,
    /naukri\.com\/.+-jobs/i,
    /ziprecruiter\.com\/jobs/i,
    /lever\.co\/[^\/]+\/jobs/i,
    /greenhouse\.io\/jobs/i,
    /careers\./i,
    /jobs\./i,
    /\/jobs?\//i,
    /\/careers?\//i,
    /\/job\-details/i,
  ];

  return jobBoardPatterns.some((pattern) => pattern.test(url));
}
