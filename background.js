/**
 * PursuitPal - Background Script
 *
 * Handles data processing and communication between the content script,
 * popup, and the PursuitPal web application.
 */

console.log("PursuitPal background script loaded");

// Hardcoded URLs without config dependency
const APP_BASE_URL = "https://pursuitpal.app";

// Store extracted data temporarily
let pendingJobData = null;
let pendingContactData = null;

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background script received message:", request.action);

  switch (request.action) {
    case "saveJobData":
      // Sanitize and store job data
      pendingJobData = sanitizeJobData(request.data);
      chrome.storage.local.set(
        {
          jobData: pendingJobData,
          jobDataTimestamp: Date.now(),
        },
        () => {
          console.log("Job data saved to storage:", pendingJobData);
          sendResponse({ success: true });
        }
      );
      return true; // Keep connection open for async response

    case "saveContactData":
      // Sanitize and store contact data
      pendingContactData = sanitizeContactData(request.data);
      chrome.storage.local.set(
        {
          contactData: pendingContactData,
          contactDataTimestamp: Date.now(),
        },
        () => {
          console.log("Contact data saved to storage:", pendingContactData);
          sendResponse({ success: true });
        }
      );
      return true; // Keep connection open for async response

    case "getJobData":
      // Return stored job data to popup
      chrome.storage.local.get(["jobData"], (result) => {
        console.log("Returning job data to popup:", result.jobData);
        sendResponse({ data: result.jobData || null });
      });
      return true; // Keep connection open for async response

    case "getContactData":
      // Return stored contact data to popup
      chrome.storage.local.get(["contactData"], (result) => {
        console.log("Returning contact data to popup:", result.contactData);
        sendResponse({ data: result.contactData || null });
      });
      return true; // Keep connection open for async response

    case "sendToPursuitPal":
      // Open PursuitPal in a new tab with data
      const dataType = request.dataType; // "job" or "contact"
      const data = request.data;
      console.log(`Sending ${dataType} data to PursuitPal:`, data);

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
      console.log("Extract from current tab requested");
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
    console.log("Opening job form with data:", jobData);

    // Store data with timestamp for the web app to pick up
    chrome.storage.local.set(
      {
        pendingJobApplication: jobData,
        pendingJobTimestamp: Date.now(),
      },
      () => {
        console.log("Stored pending job application in local storage");
      }
    );

    // Create a new tab with the job form URL
    chrome.tabs.create({ url: `${APP_BASE_URL}/jobs/new` }, (tab) => {
      console.log("Created new tab for job form:", tab.id);

      // Execute script to inject the data after page load
      chrome.tabs.onUpdated.addListener(function listener(
        tabId,
        changeInfo,
        updatedTab
      ) {
        if (tabId === tab.id && changeInfo.status === "complete") {
          console.log("Tab fully loaded, injecting script");
          chrome.tabs.onUpdated.removeListener(listener);

          // Inject script to transfer data to the web app
          chrome.scripting
            .executeScript({
              target: { tabId: tab.id },
              function: injectJobData,
            })
            .then(() => {
              console.log("Job data injection script executed");
            })
            .catch((err) => {
              console.error("Error executing job data injection script:", err);
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
    console.log("Opening contact form with data:", contactData);

    // Store data with timestamp for the web app to pick up
    chrome.storage.local.set(
      {
        pendingContact: contactData,
        pendingContactTimestamp: Date.now(),
      },
      () => {
        console.log("Stored pending contact in local storage");
      }
    );

    // Create a new tab with the contact form URL
    chrome.tabs.create({ url: `${APP_BASE_URL}/contacts/new` }, (tab) => {
      console.log("Created new tab for contact form:", tab.id);

      // Execute script to inject the data after page load
      chrome.tabs.onUpdated.addListener(function listener(
        tabId,
        changeInfo,
        updatedTab
      ) {
        if (tabId === tab.id && changeInfo.status === "complete") {
          console.log("Tab fully loaded, injecting script");
          chrome.tabs.onUpdated.removeListener(listener);

          // Inject script to transfer data to the web app
          chrome.scripting
            .executeScript({
              target: { tabId: tab.id },
              function: injectContactData,
            })
            .then(() => {
              console.log("Contact data injection script executed");
            })
            .catch((err) => {
              console.error(
                "Error executing contact data injection script:",
                err
              );
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
      console.error("No active tab found");
      sendResponse({ success: false, error: "No active tab found" });
      return;
    }

    const activeTab = tabs[0];
    console.log(
      "Extracting data from active tab:",
      activeTab.id,
      activeTab.url
    );

    try {
      // Check if content script is already injected
      try {
        // First try sending a message - if it succeeds, content script is already injected
        chrome.tabs.sendMessage(
          activeTab.id,
          { action: "ping" },
          function (response) {
            if (chrome.runtime.lastError) {
              // Content script not yet injected, inject it
              console.log("Content script not yet injected, injecting now");
              injectContentScript(activeTab.id, sendResponse);
            } else {
              // Content script already injected, send extract message
              console.log(
                "Content script already injected, sending extract message"
              );
              sendExtractMessage(activeTab.id, sendResponse);
            }
          }
        );
      } catch (error) {
        // Error occurred, inject content script
        console.log("Error checking content script, will inject:", error);
        injectContentScript(activeTab.id, sendResponse);
      }
    } catch (error) {
      console.error("Extraction error:", error);
      sendResponse({ success: false, error: error.message });
    }
  });
}

// Inject content script into tab
function injectContentScript(tabId, sendResponse) {
  chrome.scripting
    .executeScript({
      target: { tabId: tabId },
      files: ["content.js"],
    })
    .then(() => {
      console.log("Content script injected");
      // Wait a moment for script to initialize
      setTimeout(() => {
        sendExtractMessage(tabId, sendResponse);
      }, 500);
    })
    .catch((error) => {
      console.error("Error injecting content script:", error);
      sendResponse({
        success: false,
        error: "Failed to inject content script: " + error.message,
      });
    });
}

// Send extract message to content script
function sendExtractMessage(tabId, sendResponse) {
  chrome.tabs.sendMessage(tabId, { action: "extract" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending extract message:", chrome.runtime.lastError);
      sendResponse({
        success: false,
        error: chrome.runtime.lastError.message,
      });
      return;
    }

    if (response && response.data) {
      console.log("Extract successful, received data:", response.data);
      sendResponse({ success: true, data: response.data });
    } else {
      console.log("No data extracted");
      sendResponse({
        success: false,
        error: "No data could be extracted from this page",
      });
    }
  });
}

// Function to inject job data into the web app (runs in page context)
function injectJobData() {
  console.log("Injecting job data to web app");
  chrome.storage.local.get(["pendingJobApplication"], function (result) {
    const jobData = result.pendingJobApplication;

    if (!jobData) {
      console.log("No pending job data found");
      return;
    }

    console.log("Found pending job data:", jobData);

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
  console.log("Injecting contact data to web app");
  chrome.storage.local.get(["pendingContact"], function (result) {
    const contactData = result.pendingContact;

    if (!contactData) {
      console.log("No pending contact data found");
      return;
    }

    console.log("Found pending contact data:", contactData);

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
  if (changeInfo.status !== "complete" || !tab.url) return;

  // Only process http/https pages
  if (!tab.url.startsWith("http://") && !tab.url.startsWith("https://")) return;

  const url = tab.url.toLowerCase();

  // Check if this is a job posting page or LinkedIn profile
  if (isJobPostingPage(url) || isLinkedInProfilePage(url)) {
    console.log(`Tab updated with supported page: ${url}`);
    // Get user options
    chrome.storage.sync.get("options", (result) => {
      const options = result.options || { autoExtract: true };

      // If auto-extract is enabled, inject the content script
      if (options.autoExtract) {
        console.log(
          `Auto-extract enabled, injecting content script to tab ${tabId}`
        );
        chrome.scripting
          .executeScript({
            target: { tabId: tabId },
            files: ["content.js"],
          })
          .then(() => {
            console.log(`Content script injected into tab ${tabId}`);
          })
          .catch((err) =>
            console.error("Content script injection error:", err)
          );
      } else {
        console.log("Auto-extract disabled");
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
