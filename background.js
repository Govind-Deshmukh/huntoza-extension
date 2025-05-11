/**
 * PursuitPal - Background Script
 *
 * Modified to support sidebar functionality
 */

// Import authentication service
importScripts("auth-service.js");

// Constants
const APP_BASE_URL = "https://pursuitpal.app";

// Global state to track pending application data
let pendingApplicationData = null;
let pendingContactData = null;
let currentTabId = null;

// Listen for messages from sidebar or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveJobData") {
    // Save job data to storage
    chrome.storage.local.set({ jobData: request.data });
    // Send response that data was saved
    sendResponse({ success: true });
  } else if (request.action === "saveContactData") {
    // Save contact data to storage
    chrome.storage.local.set({ contactData: request.data });
    // Send response that data was saved
    sendResponse({ success: true });
  } else if (request.action === "getPendingApplicationData") {
    // Return any pending application data when requested
    sendResponse({ data: pendingApplicationData });
    // Clear after sending
    pendingApplicationData = null;
  } else if (request.action === "getPendingContactData") {
    // Return any pending contact data when requested
    sendResponse({ data: pendingContactData });
    // Clear after sending
    pendingContactData = null;
  } else if (request.action === "checkAuth") {
    // Check authentication status
    authService
      .isAuthenticated()
      .then((isAuthenticated) => {
        sendResponse({ isAuthenticated });
      })
      .catch((error) => {
        console.error("Auth check error:", error);
        sendResponse({ isAuthenticated: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  } else if (request.action === "logout") {
    // Handle logout request
    authService
      .logout()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Logout error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  } else if (request.action === "getCurrentUser") {
    // Return current user data
    authService
      .getCurrentUser()
      .then((user) => {
        sendResponse({ success: true, user });
      })
      .catch((error) => {
        console.error("Error getting user data:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  } else if (request.action === "getParentTabId") {
    // Return the current tab ID for the sidebar to know its parent
    sendResponse({ tabId: currentTabId });
  } else if (request.action === "openLoginPage") {
    // Open login page
    chrome.tabs.create({ url: "login.html" });
    sendResponse({ success: true });
  } else if (request.action === "getJobDataForCurrentTab") {
    // Return job data for the current tab if available
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        sendResponse({ success: false });
        return;
      }

      const currentTab = tabs[0];
      chrome.storage.local.get(["jobData"], (result) => {
        if (result.jobData && result.jobData.jobUrl === currentTab.url) {
          // We have cached data for this URL
          sendResponse({ success: true, jobData: result.jobData });
        } else {
          sendResponse({ success: false });
        }
      });
    });
    return true; // Keep message channel open for async
  } else if (request.action === "extractJobDataFromCurrentTab") {
    // Extract job data from the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        sendResponse({ success: false });
        return;
      }

      const currentTab = tabs[0];

      // Inject content script if needed
      chrome.scripting
        .executeScript({
          target: { tabId: currentTab.id },
          files: ["content.js"],
        })
        .then(() => {
          // Now ask content script to extract data
          chrome.tabs.sendMessage(
            currentTab.id,
            { action: "extractJobData" },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error(
                  "Content script error:",
                  chrome.runtime.lastError
                );
                sendResponse({
                  success: false,
                  error: chrome.runtime.lastError.message,
                });
                return;
              }

              if (response && Object.keys(response).length > 0) {
                // Store the job data
                chrome.storage.local.set({ jobData: response });
                sendResponse({ success: true, jobData: response });
              } else {
                sendResponse({ success: false });
              }
            }
          );
        })
        .catch((error) => {
          console.error("Script injection error:", error);
          sendResponse({ success: false, error: error.message });
        });
    });
    return true; // Keep message channel open for async
  } else if (request.action === "openJobForm") {
    // Open job form in a new tab with the job data
    chrome.storage.local.set({ pendingJobApplication: request.jobData });
    chrome.tabs.create({ url: `${APP_BASE_URL}/jobs/new` });
    sendResponse({ success: true });
  }
  return true; // Keep the message channel open for async response
});

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
  }
});

// Handle browser action click (icon click)
chrome.action.onClicked.addListener(async (tab) => {
  // Save the current tab ID for reference
  currentTabId = tab.id;

  // Check if user is authenticated
  const isAuthenticated = await authService.isAuthenticated();

  // If not authenticated, show login page
  if (!isAuthenticated) {
    chrome.tabs.create({ url: "login.html" });
    return;
  }

  // If authenticated, inject the sidebar
  chrome.scripting
    .executeScript({
      target: { tabId: tab.id },
      files: ["sidebar-injector.js"],
    })
    .catch((error) => {
      console.error("Failed to inject sidebar:", error);
      // Fallback to opening in a popup
      chrome.windows.create({
        url: "sidebar.html",
        type: "popup",
        width: 450,
        height: 600,
      });
    });
});

// Handle tab updates, especially for state transfer
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only run when page load is complete
  if (changeInfo.status === "complete") {
    // Define URLs for job and contact forms
    const jobFormUrl = `${APP_BASE_URL}/jobs/new`;
    const contactFormUrl = `${APP_BASE_URL}/contacts/new`;

    // Check if this is the jobs/new page loading
    if (
      tab.url.includes(jobFormUrl) ||
      tab.url.includes("pursuitpal.app/jobs/new")
    ) {
      // Check authentication first
      authService.isAuthenticated().then((isAuthenticated) => {
        if (!isAuthenticated) {
          // Not authenticated, don't proceed
          console.log("Not authenticated, can't transfer job data");
          return;
        }

        // Retrieve pending job application data
        chrome.storage.local.get(["pendingJobApplication"], (result) => {
          if (result.pendingJobApplication) {
            console.log("Found pending job application data for tab:", tabId);

            // Inject the data transfer script
            chrome.scripting
              .executeScript({
                target: { tabId: tabId },
                function: injectStateToReactApp,
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
      });
    }

    // Check if this is the contacts/new page loading
    if (
      tab.url.includes(contactFormUrl) ||
      tab.url.includes("pursuitpal.app/contacts/new")
    ) {
      // Check authentication first
      authService.isAuthenticated().then((isAuthenticated) => {
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
                function: injectStateToReactApp,
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
      });
    }

    // If auto-extract is enabled, inject content script on job posting pages or LinkedIn profile pages
    if (isJobPostingPage(tab.url) || isLinkedInProfilePage(tab.url)) {
      // Check authentication first
      authService.isAuthenticated().then((isAuthenticated) => {
        if (!isAuthenticated) {
          // Not authenticated, don't proceed
          console.log("Not authenticated, can't extract data");
          return;
        }

        chrome.storage.sync.get("options", (result) => {
          const options = result.options || {};
          if (options.autoExtractOnPageLoad) {
            chrome.scripting
              .executeScript({
                target: { tabId: tabId },
                files: ["content.js"],
              })
              .then(() => {
                console.log("Auto-injected content script on page");
              })
              .catch((err) => {
                console.log("Failed to inject content script:", err);
              });
          }
        });
      });
    }
  }
});

// Function to determine if a URL is likely a job posting
function isJobPostingPage(url) {
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
  ];

  return jobBoardPatterns.some((pattern) => pattern.test(url));
}

// Function to determine if a URL is a LinkedIn profile page
function isLinkedInProfilePage(url) {
  return /linkedin\.com\/in\//i.test(url);
}

// Function to inject state into the React app
function injectStateToReactApp(data, type = "job") {
  console.log(`Injecting ${type} data into React app:`, data);

  // Store the data in localStorage so the React app can access it
  if (type === "job") {
    localStorage.setItem("pendingJobData", JSON.stringify(data));
    // Dispatch a custom event to notify the React app the data is ready
    window.dispatchEvent(
      new CustomEvent("jobDataAvailable", {
        detail: { source: "chromeExtension" },
      })
    );
  } else if (type === "contact") {
    localStorage.setItem("pendingContactData", JSON.stringify(data));
    // Dispatch a custom event to notify the React app the data is ready
    window.dispatchEvent(
      new CustomEvent("contactDataAvailable", {
        detail: { source: "chromeExtension" },
      })
    );
  }

  // Add visual feedback to let the user know the data was transferred
  showNotification(
    `${
      type.charAt(0).toUpperCase() + type.slice(1)
    } data transferred successfully!`
  );
}

// Function to show a notification to the user
function showNotification(message) {
  // Hardcoded primary color
  const primaryColor = "#552dec";

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
      transform: "translateX(-50%)",
      backgroundColor: primaryColor,
      color: "white",
      padding: "12px 24px",
      borderRadius: "4px",
      boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
      zIndex: "10000",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontWeight: "bold",
      opacity: "0",
      transition: "opacity 0.3s ease-in-out",
    });

    // Set the message
    notification.textContent = message;

    // Add to the page
    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => {
      notification.style.opacity = "1";
    }, 10);

    // Remove after 5 seconds
    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        if (notification && notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }
}
