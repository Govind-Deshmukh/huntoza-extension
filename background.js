/**
 * Job Hunt Assist - Background Script (Updated for state passing)
 *
 * This script runs in the background and handles:
 * 1. Communication between popup and content scripts
 * 2. Facilitating state transfer to the React app
 */

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveJobData") {
    // Save job data to storage
    chrome.storage.local.set({ jobData: request.data });
  }
});

// On extension installation, set up initial storage
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("Job Hunt Assist extension installed");
    // Any initial setup code can go here
  }
});

// Handle tab updates, especially for state transfer
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if this is the jobs/new page loading
  if (
    changeInfo.status === "complete" &&
    tab.url.includes("localhost:3000/jobs/new")
  ) {
    // Get pending job application data
    chrome.storage.local.get(["pendingJobApplication"], (result) => {
      if (result.pendingJobApplication) {
        // If we have pending job data, inject content script to handle state
        chrome.scripting
          .executeScript({
            target: { tabId: tabId },
            function: injectStateToReactApp,
            args: [result.pendingJobApplication],
          })
          .then(() => {
            // Clear pending job data after state is injected
            chrome.storage.local.remove("pendingJobApplication");
          })
          .catch((err) => {
            console.error("Error injecting script:", err);
          });
      }
    });
  }
});

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
  showNotification("Job data transferred to form successfully!");
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
