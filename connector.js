/**
 * PursuitPal - Connector Script
 *
 * This script is loaded when the extension icon is clicked.
 * It will check the current page and connect to the content script.
 */

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extract") {
    // Call the main extraction function
    const extractedData = extractData();
    sendResponse({ data: extractedData });
  }
  return true; // Keep channel open for async response
});

// Trigger data extraction
function extractData() {
  // Determine the current page type
  const url = window.location.href.toLowerCase();

  if (isJobPostingPage(url)) {
    // For job pages
    return extractJobData();
  } else if (isLinkedInProfilePage(url)) {
    // For LinkedIn profiles
    return extractLinkedInProfile();
  }

  return null;
}

// Check if the current page is a job posting
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

// Check if the current page is a LinkedIn profile
function isLinkedInProfilePage(url) {
  return /linkedin\.com\/in\//i.test(url);
}
