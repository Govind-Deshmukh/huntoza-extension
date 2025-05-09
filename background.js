/**
 * PursuitPal - Background Script with Authentication
 *
 * This script runs in the background and handles:
 * 1. Authentication checks and redirects
 * 2. Communication between popup and content scripts
 * 3. Facilitating state transfer to the React app
 */

// Import authentication service
importScripts("auth-service.js");

// Global state to track pending application data
let pendingApplicationData = null;
let pendingContactData = null;

// Listen for messages from popup or content scripts
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
        apiUrl: "http://localhost:3000/api",
        trackApplicationsInApp: true,
        autoExtractOnPageLoad: true,
        aiEnhancementEnabled: false,
      },
    });
  }
});

// Handle browser action click (icon click)
chrome.action.onClicked.addListener(() => {
  // This won't run if popup is specified in the manifest,
  // but it's here as a fallback
  chrome.windows.create({
    url: "login.html",
    type: "popup",
    width: 450,
    height: 600,
  });
});

// Handle tab updates, especially for state transfer
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only run when page load is complete
  if (changeInfo.status === "complete") {
    // Check if this is the jobs/new page loading
    if (
      tab.url.includes("localhost:3000/jobs/new") ||
      tab.url.includes("your-pursuitpal-app.com/jobs/new")
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
      tab.url.includes("localhost:3000/contacts/new") ||
      tab.url.includes("your-pursuitpal-app.com/contacts/new")
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
      backgroundColor: "#552dec",
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
