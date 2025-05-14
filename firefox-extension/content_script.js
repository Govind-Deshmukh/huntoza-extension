/**
 * content_script.js - Content Script for PursuitPal
 *
 * This script is injected into web pages to extract job details
 * and communicate with the PursuitPal extension.
 */

// Import the modular extractors
import { extractJobData, detectJobPlatform } from "./extractors/index.js";
import { showNotification } from "./utils/notification.js";
import { storeJobData, checkForExtensionData } from "./content/storage.js";
import { injectJobData, waitForElement } from "./content/form-handlers.js";

console.log("PursuitPal content script loaded");

// Make extraction function available globally
window._pursuitPalExtractData = extractJobData;

// Set up message listener for the popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in content script:", message);

  if (message.action === "extractJobData") {
    console.log("Extracting job data from content script");
    const jobData = extractJobData();
    console.log("Job data extracted:", jobData);
    sendResponse(jobData);
    return true;
  } else if (message.action === "injectJobData") {
    injectJobData(message.data);
    sendResponse({ success: true });
    return true;
  } else if (message.action === "checkForJobData") {
    // Check if we're on the job form page
    if (
      window.location.href.includes("pursuitpal.app/jobs/new") ||
      window.location.href.includes("pursuitpal.app/jobs/edit")
    ) {
      sendResponse({ ready: true });
    } else {
      sendResponse({ ready: false });
    }
    return true;
  } else if (message.action === "fillJobForm") {
    // Fill the form with job data
    injectJobData(message.data);
    sendResponse({ success: true });
    return true;
  }
  return true; // Keep channel open for async response
});

// Notify page that extraction function is available
document.dispatchEvent(new CustomEvent("pursuitpal_extension_loaded"));

// When the page loads, check if it's the job form page
document.addEventListener("DOMContentLoaded", async () => {
  // Check if we're on the job form page
  if (
    window.location.href.includes("pursuitpal.app/jobs/new") ||
    window.location.href.includes("pursuitpal.app/jobs/edit")
  ) {
    // Tell background script we're on the form page and ready for data
    setTimeout(() => {
      browser.runtime.sendMessage({ action: "pageIsJobForm" }).then(
        (response) => {
          if (response && response.data) {
            injectJobData(response.data);
          }
        },
        (error) => {
          console.error("Error sending pageIsJobForm message:", error);
        }
      );
    }, 1000); // Small delay to ensure page is fully loaded
  }

  // Check for job board pages and show notification if auto-extract is enabled
  try {
    const url = window.location.href;
    const platform = detectJobPlatform(url);

    if (platform !== "generic") {
      // Check if auto-extract is enabled
      const options = await browser.storage.sync
        .get("options")
        .then((data) => data.options || { autoExtract: false });

      if (options.autoExtract) {
        // Show a notification to let the user know they can extract job data
        showNotification(
          "Job detected! Click the PursuitPal icon to save this job.",
          "info",
          5000
        );
      }
    }
  } catch (error) {
    console.error("Error checking job page:", error);
  }
});

// Check for pending job data on form page
if (window.location.href.includes("pursuitpal.app/jobs/new")) {
  console.log("PursuitPal job form page detected");

  // Run checks at different times to ensure we catch the data
  setTimeout(checkForExtensionData, 500);
  setTimeout(checkForExtensionData, 1000);
  setTimeout(checkForExtensionData, 2000);
}
