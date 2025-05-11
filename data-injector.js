/**
 * PursuitPal - Data Injector Script
 *
 * This script is injected into the PursuitPal web app to transfer extracted data.
 * It allows the Chrome extension to communicate with the React application.
 */

(function () {
  // Keep track of whether we've already injected data
  let dataInjected = false;

  // Listen for DOM content loaded to ensure the page is ready
  document.addEventListener("DOMContentLoaded", () => {
    // Check if we're on a page where we should transfer data
    const currentUrl = window.location.href;

    // Determine which type of data we should attempt to inject
    if (currentUrl.includes("/jobs/new")) {
      injectJobData();
    } else if (currentUrl.includes("/contacts/new")) {
      injectContactData();
    }
  });

  // Inject job data
  function injectJobData() {
    if (dataInjected) return; // Prevent multiple injections

    // Look for data in chrome.storage
    chrome.storage.local.get(["pendingJobApplication"], (result) => {
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
      showNotification(
        "Job data successfully transferred from PursuitPal extension!"
      );

      // Set flag to prevent multiple injections
      dataInjected = true;

      // Clean up
      chrome.storage.local.remove("pendingJobApplication");
    });
  }

  // Inject contact data
  function injectContactData() {
    if (dataInjected) return; // Prevent multiple injections

    // Look for data in chrome.storage
    chrome.storage.local.get(["pendingContact"], (result) => {
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
      showNotification(
        "Contact data successfully transferred from PursuitPal extension!"
      );

      // Set flag to prevent multiple injections
      dataInjected = true;

      // Clean up
      chrome.storage.local.remove("pendingContact");
    });
  }

  // Function to show a notification to the user
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
})();
