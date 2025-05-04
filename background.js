/**
 * Job Hunt Assist - Improved Background Script
 *
 * This script runs in the background and handles:
 * 1. Communication between popup and content scripts
 * 2. Facilitating state transfer to the React app
 * 3. Handling job data persistence between extension sessions
 */

// Global state to track pending application data
let pendingApplicationData = null;

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveJobData") {
    // Save job data to storage
    chrome.storage.local.set({ jobData: request.data });
    // Send response that data was saved
    sendResponse({ success: true });
  } else if (request.action === "getPendingApplicationData") {
    // Return any pending application data when requested
    sendResponse({ data: pendingApplicationData });
    // Clear after sending
    pendingApplicationData = null;
  }
  return true; // Keep the message channel open for async response
});

// On extension installation, set up initial storage
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("Job Hunt Assist extension installed");
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

// Handle tab updates, especially for state transfer
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only run when page load is complete
  if (changeInfo.status === "complete") {
    // Check if this is the jobs/new page loading
    if (
      tab.url.includes("localhost:3000/jobs/new") ||
      tab.url.includes("your-job-tracker-app.com/jobs/new")
    ) {
      // Retrieve pending job application data
      chrome.storage.local.get(["pendingJobApplication"], (result) => {
        if (result.pendingJobApplication) {
          console.log("Found pending job application data for tab:", tabId);

          // Inject the data transfer script
          chrome.scripting
            .executeScript({
              target: { tabId: tabId },
              function: injectStateToReactApp,
              args: [result.pendingJobApplication],
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

    // If auto-extract is enabled, inject content script on job posting pages
    if (isJobPostingPage(tab.url)) {
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

// Function to inject state into the React app
function injectStateToReactApp(jobData) {
  console.log("Injecting job data into React app:", jobData);

  // Store the job data in localStorage so the React app can access it
  localStorage.setItem("pendingJobData", JSON.stringify(jobData));

  // Dispatch a custom event to notify the React app the data is ready
  window.dispatchEvent(
    new CustomEvent("jobDataAvailable", {
      detail: { source: "chromeExtension" },
    })
  );

  // Add visual feedback to let the user know the data was transferred
  showNotification("Job data transferred successfully!");
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
      backgroundColor: "#4CAF50",
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
