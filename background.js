/**
 * PursuitPal - Background Script
 *
 * Handles data processing and communication between the content script,
 * popup, and the PursuitPal web application.
 */

// Hardcoded URLs without config dependency
const APP_BASE_URL = "https://pursuitpal.app";

// Store extracted data temporarily
let pendingJobData = null;
let pendingContactData = null;

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received:", request.action);

  switch (request.action) {
    case "saveJobData":
      // Sanitize and store job data
      pendingJobData = sanitizeJobData(request.data);
      chrome.storage.local.set({
        jobData: pendingJobData,
        jobDataTimestamp: Date.now(),
      });
      sendResponse({ success: true });
      break;

    case "saveContactData":
      // Sanitize and store contact data
      pendingContactData = sanitizeContactData(request.data);
      chrome.storage.local.set({
        contactData: pendingContactData,
        contactDataTimestamp: Date.now(),
      });
      sendResponse({ success: true });
      break;

    case "getJobData":
      // Return stored job data to popup
      chrome.storage.local.get(["jobData"], (result) => {
        sendResponse({ data: result.jobData || null });
      });
      return true; // Keep connection open for async response

    case "getContactData":
      // Return stored contact data to popup
      chrome.storage.local.get(["contactData"], (result) => {
        sendResponse({ data: result.contactData || null });
      });
      return true; // Keep connection open for async response

    case "sendToPursuitPal":
      // Open PursuitPal in a new tab with data
      const dataType = request.dataType; // "job" or "contact"
      const data = request.data;

      if (dataType === "job") {
        openJobForm(data, sendResponse);
      } else if (dataType === "contact") {
        openContactForm(data, sendResponse);
      } else {
        sendResponse({ success: false, error: "Invalid data type" });
      }
      return true; // Keep connection open for async response

    case "extractFromCurrentTab":
      // Request content script to extract data from current tab
      extractFromCurrentTab(sendResponse);
      return true; // Keep connection open for async response
  }

  return true; // Keep channel open for async responses
});

// Sanitize job data before storing
function sanitizeJobData(data) {
  if (!data) return null;

  // Create a safe copy with only expected fields
  return {
    company: sanitizeString(data.company),
    position: sanitizeString(data.position),
    jobLocation: sanitizeString(data.jobLocation),
    jobType: sanitizeString(data.jobType),
    jobDescription: sanitizeString(data.jobDescription, 50000), // Allow longer descriptions
    jobUrl: sanitizeUrl(data.jobUrl),
    salary: {
      min: sanitizeNumber(data.salary?.min),
      max: sanitizeNumber(data.salary?.max),
      currency: sanitizeCurrency(data.salary?.currency),
    },
    dateExtracted: data.dateExtracted || new Date().toISOString(),
  };
}

// Sanitize contact data before storing
function sanitizeContactData(data) {
  if (!data) return null;

  // Create a safe copy with only expected fields
  return {
    name: sanitizeString(data.name),
    email: sanitizeString(data.email),
    phone: sanitizeString(data.phone),
    position: sanitizeString(data.position),
    company: sanitizeString(data.company),
    location: sanitizeString(data.location),
    profileUrl: sanitizeUrl(data.profileUrl),
    about: sanitizeString(data.about, 5000),
    connections: sanitizeString(data.connections),
    experience: Array.isArray(data.experience)
      ? data.experience
          .map((exp) => ({
            role: sanitizeString(exp.role || ""),
            company: sanitizeString(exp.company || ""),
            date: sanitizeString(exp.date || ""),
          }))
          .slice(0, 5)
      : [], // Limit to 5 experiences
    dateExtracted: data.dateExtracted || new Date().toISOString(),
  };
}

// String sanitization helper
function sanitizeString(str, maxLength = 1000) {
  if (typeof str !== "string") return "";
  return str.slice(0, maxLength); // Limit string length
}

// URL sanitization helper
function sanitizeUrl(url) {
  if (typeof url !== "string") return "";

  try {
    // Ensure URL is properly formed
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

// Open job form in PursuitPal with extracted data
function openJobForm(jobData, sendResponse) {
  try {
    // Store data with timestamp for the web app to pick up
    chrome.storage.local.set({
      pendingJobApplication: jobData,
      pendingJobTimestamp: Date.now(),
    });

    // Create a new tab with the job form URL
    chrome.tabs.create({ url: `${APP_BASE_URL}/jobs/new` }, (tab) => {
      // Execute script to inject the data after page load
      chrome.tabs.onUpdated.addListener(function listener(
        tabId,
        changeInfo,
        updatedTab
      ) {
        if (tabId === tab.id && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);

          // Inject script to transfer data to the web app
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: injectJobData,
          });
        }
      });

      sendResponse({ success: true });
    });
  } catch (error) {
    console.error("Error opening job form:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Open contact form in PursuitPal with extracted data
function openContactForm(contactData, sendResponse) {
  try {
    // Store data with timestamp for the web app to pick up
    chrome.storage.local.set({
      pendingContact: contactData,
      pendingContactTimestamp: Date.now(),
    });

    // Create a new tab with the contact form URL
    chrome.tabs.create({ url: `${APP_BASE_URL}/contacts/new` }, (tab) => {
      // Execute script to inject the data after page load
      chrome.tabs.onUpdated.addListener(function listener(
        tabId,
        changeInfo,
        updatedTab
      ) {
        if (tabId === tab.id && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);

          // Inject script to transfer data to the web app
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: injectContactData,
          });
        }
      });

      sendResponse({ success: true });
    });
  } catch (error) {
    console.error("Error opening contact form:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Extract data from current tab
function extractFromCurrentTab(sendResponse) {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (!tabs || tabs.length === 0) {
      sendResponse({ success: false, error: "No active tab found" });
      return;
    }

    const activeTab = tabs[0];

    try {
      // Inject content script if needed
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ["content.js"],
      });

      // Request content script to extract data
      chrome.tabs.sendMessage(
        activeTab.id,
        { action: "extract" },
        (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({
              success: false,
              error: chrome.runtime.lastError.message,
            });
            return;
          }

          if (response && response.data) {
            sendResponse({ success: true, data: response.data });
          } else {
            sendResponse({
              success: false,
              error: "No data could be extracted from this page",
            });
          }
        }
      );
    } catch (error) {
      console.error("Extraction error:", error);
      sendResponse({ success: false, error: error.message });
    }
  });
}

// Function to inject job data into the web app (runs in page context)
function injectJobData() {
  chrome.storage.local.get(["pendingJobApplication"], function (result) {
    const jobData = result.pendingJobApplication;

    if (!jobData) {
      console.log("No pending job data found");
      return;
    }

    // Store the data for the React app to use
    localStorage.setItem("pendingJobData", JSON.stringify(jobData));

    // Dispatch an event to notify the app
    window.dispatchEvent(
      new CustomEvent("jobDataAvailable", {
        detail: { source: "chromeExtension", timestamp: Date.now() },
      })
    );

    // Show a success notification
    showNotification("Job data successfully transferred!");

    // Clean up
    chrome.storage.local.remove("pendingJobApplication");
  });
}

// Function to inject contact data into the web app (runs in page context)
function injectContactData() {
  chrome.storage.local.get(["pendingContact"], function (result) {
    const contactData = result.pendingContact;

    if (!contactData) {
      console.log("No pending contact data found");
      return;
    }

    // Store the data for the React app to use
    localStorage.setItem("pendingContactData", JSON.stringify(contactData));

    // Dispatch an event to notify the app
    window.dispatchEvent(
      new CustomEvent("contactDataAvailable", {
        detail: { source: "chromeExtension", timestamp: Date.now() },
      })
    );

    // Show a success notification
    showNotification("Contact data successfully transferred!");

    // Clean up
    chrome.storage.local.remove("pendingContact");
  });
}

// Function to show notification (runs in page context)
function showNotification(message, type = "success") {
  // Primary color from the app
  const primaryColor = "#552dec";
  const errorColor = "#ef4444";
  const bgColor = type === "success" ? primaryColor : errorColor;

  // Create notification element
  const notification = document.createElement("div");

  // Style the notification
  Object.assign(notification.style, {
    position: "fixed",
    top: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    backgroundColor: bgColor,
    color: "white",
    padding: "12px 24px",
    borderRadius: "8px",
    boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
    zIndex: 10000,
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "14px",
    transition: "opacity 0.3s",
  });

  // Add content
  notification.textContent = message;

  // Add to the page
  document.body.appendChild(notification);

  // Remove after 5 seconds
  setTimeout(() => {
    notification.style.opacity = "0";
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 5000);
}

// Initialize extension when installed
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("PursuitPal extension installed");
    // Initialize default options
    chrome.storage.sync.set({
      options: {
        autoExtract: true,
      },
    });
  }
});

// Listen for tab updates to inject content script
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only run when page is done loading
  if (changeInfo.status !== "complete") return;

  const url = tab.url.toLowerCase();

  // Check if this is a job posting page or LinkedIn profile
  if (isJobPostingPage(url) || isLinkedInProfilePage(url)) {
    // Get user options
    chrome.storage.sync.get("options", (result) => {
      const options = result.options || { autoExtract: true };

      // If auto-extract is enabled, inject the content script
      if (options.autoExtract) {
        chrome.scripting
          .executeScript({
            target: { tabId: tabId },
            files: ["content.js"],
          })
          .catch((err) => console.log("Content script injection error:", err));
      }
    });
  }
});

// Check if a URL is a job posting page
function isJobPostingPage(url) {
  const jobPatterns = [
    /linkedin\.com\/jobs/i,
    /indeed\.com\/viewjob/i,
    /glassdoor\.com\/job/i,
    /monster\.com\/job/i,
    /naukri\.com/i,
    /ziprecruiter\.com\/jobs/i,
    /careers\./i,
    /jobs\./i,
    /\/jobs?\//i,
    /\/careers?\//i,
    /\/job\-details/i,
    /lever\.co\/[^\/]+\/jobs/i,
    /greenhouse\.io\/jobs/i,
  ];

  return jobPatterns.some((pattern) => pattern.test(url));
}

// Check if a URL is a LinkedIn profile page
function isLinkedInProfilePage(url) {
  return /linkedin\.com\/in\//i.test(url);
}
