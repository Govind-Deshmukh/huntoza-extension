/**
 * PursuitPal - Enhanced Background Script
 *
 * Improved version with better security, memory management, and error handling
 */

// Import scripts must be at the top and use the full paths
// This is critical for service workers to load correctly
importScripts("auth-service.js");

// Constants
const APP_BASE_URL = "https://pursuitpal.app";
const API_BASE_URL = "https://api.pursuitpal.app/api/v1";

// Global state
let pendingApplicationData = null;
let pendingContactData = null;
let currentTabId = null;
let lastActiveTab = null;

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

          // Inject the data transfer script with security enhancements
          chrome.scripting
            .executeScript({
              target: { tabId: tabId },
              func: injectStateToReactApp,
              args: [result.pendingJobApplication, "job"],
            })
            .then(() => {
              console.log("Successfully injected job data script");
              // Clear the pending data after successful injection
              chrome.storage.local.remove("pendingJobApplication");
            })
            .catch((err) => {
              console.error("Error injecting state script:", err);
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

      // Inject the data transfer script
      chrome.scripting
        .executeScript({
          target: { tabId: tabId },
          func: injectStateToReactApp,
          args: [result.pendingContact, "contact"],
        })
        .then(() => {
          console.log("Successfully injected contact data script");
          // Clear the pending data after successful injection
          chrome.storage.local.remove("pendingContact");
        })
        .catch((err) => {
          console.error("Error injecting state script:", err);
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

// Function to inject state into the React app - Executed in page context
function injectStateToReactApp(data, type = "job") {
  console.log(`Injecting ${type} data into React app`);

  try {
    // Security check - validate data before injecting
    if (!data || typeof data !== "object") {
      console.error("Invalid data format");
      return;
    }

    // Store the data in localStorage so the React app can access it
    if (type === "job") {
      localStorage.setItem("pendingJobData", JSON.stringify(data));
      // Dispatch a custom event to notify the React app the data is ready
      window.dispatchEvent(
        new CustomEvent("jobDataAvailable", {
          detail: { source: "chromeExtension", timestamp: Date.now() },
        })
      );
    } else if (type === "contact") {
      localStorage.setItem("pendingContactData", JSON.stringify(data));
      // Dispatch a custom event to notify the React app the data is ready
      window.dispatchEvent(
        new CustomEvent("contactDataAvailable", {
          detail: { source: "chromeExtension", timestamp: Date.now() },
        })
      );
    }

    // Add visual feedback to let the user know the data was transferred
    showNotification(
      `${
        type.charAt(0).toUpperCase() + type.slice(1)
      } data transferred successfully!`
    );
  } catch (error) {
    console.error("Error injecting state:", error);
    showNotification(
      `Error transferring ${type} data. Please try again.`,
      "error"
    );
  }
}

// Function to show a notification to the user - Executed in page context
function showNotification(message, type = "success") {
  // Hardcoded primary color
  const primaryColor = "#4f46e5"; // Updated to match new design
  const errorColor = "#ef4444";
  const backgroundColor = type === "success" ? primaryColor : errorColor;

  // Check if notification already exists
  let notification = document.getElementById("extension-notification");

  if (!notification) {
    // Create notification element
    notification = document.createElement("div");
    notification.id = "extension-notification";

    // Style the notification
    Object.assign(notification.style, {
      position: "fixed",
      top: "20px",
      left: "50%",
      transform: "translateX(-50%) translateY(-100px)",
      backgroundColor: backgroundColor,
      color: "white",
      padding: "12px 24px",
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      zIndex: "10000",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "14px",
      fontWeight: "500",
      opacity: "0",
      transition: "transform 0.3s ease-out, opacity 0.3s ease-out",
    });

    // Set the message with icon
    notification.innerHTML = `
      <div style="display: flex; align-items: center;">
        <span style="margin-right: 8px;">
          ${
            type === "success"
              ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
              : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
          }
        </span>
        ${message}
      </div>
    `;

    // Add to the page
    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => {
      notification.style.transform = "translateX(-50%) translateY(0)";
      notification.style.opacity = "1";
    }, 10);

    // Remove after 5 seconds
    setTimeout(() => {
      notification.style.transform = "translateX(-50%) translateY(-100px)";
      notification.style.opacity = "0";
      setTimeout(() => {
        if (notification && notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }
}
