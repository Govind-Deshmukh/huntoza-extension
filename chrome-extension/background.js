/**
 * PursuitPal - Background Service Worker
 *
 * Handles authentication, data extraction requests, and communication
 * between the extension and the PursuitPal web app.
 */

// Global configuration
const API_BASE_URL = "https://api.pursuitpal.app/api/v1";
const APP_URL = "https://pursuitpal.app";

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log("PursuitPal extension installed");

  // Set default options
  chrome.storage.sync.set({
    options: {
      autoExtract: true,
      showBadge: true,
      defaultPriority: "medium",
      defaultCurrency: "INR",
    },
  });
});

// Set up message listeners
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "checkAuth":
      checkAuthStatus().then(sendResponse);
      return true; // Keep the message channel open for async response

    case "login":
      handleLogin(message.credentials).then(sendResponse);
      return true;

    case "logout":
      handleLogout().then(sendResponse);
      return true;

    case "extractJobData":
      if (sender.tab) {
        extractJobData(sender.tab.id).then(sendResponse);
      } else {
        // If called from popup without tab info, get active tab
        chrome.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            if (tabs && tabs.length > 0) {
              extractJobData(tabs[0].id).then(sendResponse);
            } else {
              sendResponse({ success: false, error: "No active tab found" });
            }
          }
        );
      }
      return true;

    case "saveJobData":
      saveJobData(message.data).then(sendResponse);
      return true;

    case "sendToApp":
      sendDataToApp(message.data).then(sendResponse);
      return true;

    case "pageIsJobForm":
      handleJobFormPage(sender.tab.id).then(sendResponse);
      return true;
  }
});

// Check extension authentication status
async function checkAuthStatus() {
  try {
    const data = await chrome.storage.local.get([
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
        await chrome.storage.local.remove([
          "authToken",
          "lastAuthenticated",
          "user",
        ]);
        return { isAuthenticated: false };
      }

      // Update last authenticated time
      await chrome.storage.local.set({ lastAuthenticated: Date.now() });
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

// Validate token with backend
async function validateToken(token) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.valid === true;
  } catch (error) {
    console.error("Error validating token:", error);
    return false;
  }
}

// Handle login
async function handleLogin(credentials) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.message || "Login failed" };
    }

    const data = await response.json();

    // Save auth data
    await chrome.storage.local.set({
      authToken: data.token,
      refreshToken: data.refreshToken,
      user: data.user,
      lastAuthenticated: Date.now(),
    });

    return { success: true, user: data.user };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: error.message };
  }
}

// Handle logout
async function handleLogout() {
  try {
    const { authToken } = await chrome.storage.local.get(["authToken"]);

    if (authToken) {
      // Call logout API
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        });
      } catch (error) {
        console.error("Error calling logout API:", error);
      }
    }

    // Clear stored data regardless of API call success
    await chrome.storage.local.remove([
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
    // Execute content script to extract data
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      function: () => {
        // This code runs in the content script context
        if (window._pursuitPalExtractData) {
          return window._pursuitPalExtractData();
        } else {
          return { error: "Extraction function not available" };
        }
      },
    });

    if (!results || !results[0] || results[0].result.error) {
      // If extraction failed or function not available, inject content script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });

      // Wait for content script to initialize
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Try extraction again
      const retryResults = await chrome.scripting.executeScript({
        target: { tabId },
        function: () => {
          if (window._pursuitPalExtractData) {
            return window._pursuitPalExtractData();
          } else {
            return { error: "Extraction function still not available" };
          }
        },
      });

      if (!retryResults || !retryResults[0] || retryResults[0].result.error) {
        return { success: false, error: "Failed to extract job data" };
      }

      return { success: true, data: retryResults[0].result };
    }

    return { success: true, data: results[0].result };
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

    await chrome.storage.local.set({ currentJobData: jobData });
    return { success: true };
  } catch (error) {
    console.error("Error saving job data:", error);
    return { success: false, error: error.message };
  }
}

async function sendDataToApp(data) {
  try {
    const { authToken } = await chrome.storage.local.get(["authToken"]);

    if (!authToken) {
      return { success: false, error: "Not authenticated" };
    }

    // FIRST, store the current job data regardless of API status
    await chrome.storage.local.set({
      pendingJobData: JSON.stringify(data),
    });

    console.log("Stored pendingJobData for web app:", data);

    // Create a tab to view the job form
    const newTab = await chrome.tabs.create({ url: `${APP_URL}/jobs/new` });

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
    const data = await chrome.storage.local.get([
      "lastCreatedJobData",
      "currentJobData",
    ]);
    const jobData = data.lastCreatedJobData || data.currentJobData;

    if (!jobData) {
      return { success: false, error: "No job data found" };
    }

    // Send the data to the content script to fill the form
    await chrome.tabs.sendMessage(tabId, {
      action: "fillJobForm",
      data: jobData,
    });

    return { success: true };
  } catch (error) {
    console.error("Error handling job form page:", error);
    return { success: false, error: error.message };
  }
}

// Listen for tab updates to detect job boards
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    // Check if the tab is a job board
    const isJobBoard = isJobBoardUrl(tab.url);

    if (isJobBoard) {
      // Update the extension icon to indicate this is a job board
      chrome.action.setBadgeText({
        tabId,
        text: "JOB",
      });

      chrome.action.setBadgeBackgroundColor({
        tabId,
        color: "#552dec",
      });
    } else {
      // Clear the badge
      chrome.action.setBadgeText({
        tabId,
        text: "",
      });
    }

    // If we're on the PursuitPal new job form page, check if we need to inject data
    if (
      tab.url.includes(`${APP_URL}/jobs/new`) ||
      tab.url.includes(`${APP_URL}/jobs/edit`)
    ) {
      // Wait a bit for the page to fully load and React to initialize
      setTimeout(() => {
        chrome.tabs.sendMessage(
          tabId,
          { action: "checkForJobData" },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "Error checking for job data:",
                chrome.runtime.lastError
              );
              return;
            }

            if (response && response.ready) {
              handleJobFormPage(tabId);
            }
          }
        );
      }, 1000);
    }
  }
});

// Check if URL is a job board
function isJobBoardUrl(url) {
  const jobBoardPatterns = [
    /linkedin\.com\/jobs/i,
    /indeed\.com\/viewjob/i,
    /glassdoor\.com\/job/i,
    /monster\.com\/job/i,
    /naukri\.com/i,
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
