/**
 * content/content.js - Main content script entry point
 *
 * This script is injected into web pages to extract job posting data
 * and facilitate communication with the PursuitPal extension.
 */

import { extractJobData } from "../extractors/index.js";
import { injectJobData } from "./form-handlers.js";
import { showNotification } from "../utils/notification.js";
import { checkForExtensionData } from "./storage.js";

console.log("PursuitPal content script loaded");

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

// When the page loads, check if it's the job form page
document.addEventListener("DOMContentLoaded", () => {
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
});

// Make extraction function available globally
window._pursuitPalExtractData = extractJobData;

// Notify page that extraction function is available
document.dispatchEvent(new CustomEvent("pursuitpal_extension_loaded"));

// Check if we're on a job form page that might need data
if (window.location.href.includes("pursuitpal.app/jobs/new")) {
  console.log("PursuitPal job form page detected");

  // Run checks at different times to ensure we catch the data
  setTimeout(checkForExtensionData, 500);
  setTimeout(checkForExtensionData, 1000);
  setTimeout(checkForExtensionData, 2000);
}

// Add auto-extraction feature for job pages (if enabled in settings)
browser.storage.sync
  .get("options")
  .then((data) => {
    const options = data.options || { autoExtract: false };

    // If auto-extract is enabled, show a badge when on a job page
    if (options.autoExtract) {
      // Check if current page is a job posting
      const jobPlatform = window._pursuitPalExtractData
        ? window._pursuitPalExtractData().source
        : null;

      if (jobPlatform && jobPlatform !== "generic") {
        // Show a non-intrusive badge to indicate job data can be extracted
        showNotification(
          "Job details detected. Click the PursuitPal icon to save this job.",
          "info",
          3000
        );
      }
    }
  })
  .catch((error) => {
    console.error("Error loading extension options:", error);
  });
