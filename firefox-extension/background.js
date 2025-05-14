// background.js
/**
 * background.js - Background Service Worker
 *
 * Handles communication between the extension and the PursuitPal web app.
 */

import { isJobBoardUrl } from "./utils/url-utils.js";
import { updateBadge } from "./utils/notification.js";

// Global configuration
const APP_URL = "https://pursuitpal.app";
const API_URL = "https://api.pursuitpal.app/api/v1";

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
      return checkPursuitPalAuth();

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

// Check PursuitPal authentication by querying its API
async function checkPursuitPalAuth() {
  try {
    // Create a tab to check auth status
    const authCheckResponse = await fetch(
      `${API_URL}/auth/check-extension-auth`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    if (authCheckResponse.ok) {
      const userData = await authCheckResponse.json();
      return { isAuthenticated: true, user: userData.user };
    } else {
      return { isAuthenticated: false };
    }
  } catch (error) {
    console.error("Error checking PursuitPal auth:", error);
    return { isAuthenticated: false, error: error.message };
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
    // Check if user is authenticated with PursuitPal
    const authStatus = await checkPursuitPalAuth();

    if (!authStatus.isAuthenticated) {
      // Open PursuitPal login page
      await browser.tabs.create({
        url: `${APP_URL}/login?redirect=jobs/new&extension=true`,
      });
      return { success: false, error: "Please log in to PursuitPal first" };
    }

    // Generate a unique ID for this job data
    const jobId = Date.now().toString();

    // Store the job data in localStorage for the web app to access
    await browser.storage.local.set({
      [`pendingJobData_${jobId}`]: JSON.stringify(data),
    });

    console.log(`Stored pendingJobData_${jobId} for web app:`, data);

    // Open the job form page
    await browser.tabs.create({
      url: `${APP_URL}/jobs/new?jobDataId=${jobId}`,
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
    // Get URL parameters to find the correct job data ID
    const tab = await browser.tabs.get(tabId);
    const url = new URL(tab.url);
    const jobDataId = url.searchParams.get("jobDataId");

    // If no jobDataId parameter, check for any recent job data
    if (!jobDataId) {
      const data = await browser.storage.local.get(["currentJobData"]);

      if (!data.currentJobData) {
        return { success: false, error: "No job data found" };
      }

      // Send the data to the content script
      await browser.tabs.sendMessage(tabId, {
        action: "fillJobForm",
        data: data.currentJobData,
      });

      return { success: true, data: data.currentJobData };
    }

    // Look for specific job data with the given ID
    const key = `pendingJobData_${jobDataId}`;
    const data = await browser.storage.local.get([key]);

    if (!data[key]) {
      return { success: false, error: "No job data found with ID" };
    }

    try {
      const jobData = JSON.parse(data[key]);

      // Send the data to the content script
      await browser.tabs.sendMessage(tabId, {
        action: "fillJobForm",
        data: jobData,
      });

      // Clean up after use - remove this specific job data
      await browser.storage.local.remove([key]);

      return { success: true };
    } catch (e) {
      console.error("Error parsing job data:", e);
      return { success: false, error: "Invalid job data format" };
    }
  } catch (error) {
    console.error("Error handling job form page:", error);
    return { success: false, error: error.message };
  }
}

// Listen for tab updates
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    // If we're on the PursuitPal new job form page, check for job data ID
    if (tab.url.includes(`${APP_URL}/jobs/new`)) {
      console.log("Detected job creation page");

      try {
        const url = new URL(tab.url);
        const jobDataId = url.searchParams.get("jobDataId");

        if (jobDataId) {
          console.log(`Found job data ID: ${jobDataId}`);

          // Wait a moment for the page to initialize
          setTimeout(() => {
            // Get the specific job data
            browser.storage.local
              .get([`pendingJobData_${jobDataId}`])
              .then((data) => {
                const key = `pendingJobData_${jobDataId}`;

                if (data[key]) {
                  // Inject the data into localStorage
                  browser.tabs
                    .executeScript(tabId, {
                      code: `
                    try {
                      localStorage.setItem('pendingJobData', '${data[
                        key
                      ].replace(/'/g, "\\'")}');
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
                        // Remove from extension storage after use
                        browser.storage.local.remove([key]);
                      }
                    })
                    .catch((err) => {
                      console.error("Error injecting data:", err);
                    });
                }
              });
          }, 1000);
        }
      } catch (e) {
        console.error("Error processing URL parameters:", e);
      }
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
