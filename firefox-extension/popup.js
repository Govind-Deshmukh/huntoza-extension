// popup.js
/**
 * popup.js - Popup UI Script
 *
 * Handles the extension popup UI and user interactions:
 * - Job data extraction
 * - Saving data to PursuitPal app
 */

import { openPursuitPalLogin } from "./utils/auth.js";
import { formatJobType, formatSalary, getInitials } from "./utils/format.js";
import { isJobBoardUrl } from "./utils/url-utils.js";

// DOM Elements - Views
const mainView = document.getElementById("mainView");
const authRequiredView = document.getElementById("authRequiredView");

// DOM Elements - Main View
const userProfileToggle = document.getElementById("userProfileToggle");
const userInitials = document.getElementById("userInitials");

// DOM Elements - Extraction Section
const extractionSection = document.getElementById("extractionSection");
const notJobPageView = document.getElementById("notJobPageView");
const loadingView = document.getElementById("loadingView");
const errorView = document.getElementById("errorView");
const jobDataView = document.getElementById("jobDataView");
const errorMessage = document.getElementById("errorMessage");
const retryButton = document.getElementById("retryButton");
const openLoginButton = document.getElementById("openLoginButton");

// DOM Elements - Job Data
const jobTitle = document.getElementById("jobTitle");
const companyName = document.getElementById("companyName");
const jobLocation = document.getElementById("jobLocation");
const jobType = document.getElementById("jobType");
const jobSalary = document.getElementById("jobSalary");
// popup.js (continued)
const saveJobButton = document.getElementById("saveJobButton");
const refreshJobButton = document.getElementById("refreshJobButton");

// Current job data
let currentJobData = null;
let currentUser = null;

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  console.log("PursuitPal popup initialized");

  // Set up event listeners
  setupEventListeners();

  // Check authentication status
  await checkAuth();

  // If authenticated, check if current page is a job posting
  if (currentUser) {
    await checkCurrentPage();
  } else {
    // Show auth required view
    showAuthRequiredView();
  }
});

// Set up event listeners
function setupEventListeners() {
  // Open Login button
  if (openLoginButton) {
    openLoginButton.addEventListener("click", handleOpenLogin);
  }

  // Retry button
  if (retryButton) {
    retryButton.addEventListener("click", handleRetry);
  }

  // Refresh job data button
  if (refreshJobButton) {
    refreshJobButton.addEventListener("click", handleRefreshJobData);
  }

  // Save job button
  if (saveJobButton) {
    saveJobButton.addEventListener("click", handleSaveJob);
  }
}

// Check authentication status
async function checkAuth() {
  try {
    // Check auth status with background script
    const response = await sendMessage({ action: "checkAuth" });

    if (response && response.isAuthenticated && response.user) {
      // User is authenticated
      currentUser = response.user;
      showAuthenticatedUI(response.user);
      return true;
    } else {
      // User is not authenticated
      showAuthRequiredView();
      return false;
    }
  } catch (error) {
    console.error("Auth check error:", error);
    showAuthRequiredView();
    return false;
  }
}

// Handle open login button click
function handleOpenLogin() {
  // Open PursuitPal login page and close popup
  browser.tabs.create({
    url: "https://pursuitpal.app/login?extension=true",
  });
  window.close();
}

// Handle retry button click
async function handleRetry() {
  // Check current page again
  await checkCurrentPage();
}

// Handle refresh job data button click
async function handleRefreshJobData() {
  // Extract job data again
  await extractJobData();
}

// Handle save job button click
async function handleSaveJob() {
  // Show loading state
  showView("loadingView");

  try {
    // Send job data to background script
    const response = await sendMessage({
      action: "sendToApp",
      data: currentJobData,
    });

    if (response && response.success) {
      // Job data saved successfully
      // Close popup - background script will open PursuitPal app
      window.close();
    } else {
      // Error saving job data
      setErrorMessage(
        (response && response.error) || "Failed to save job data"
      );
      showView("errorView");
    }
  } catch (error) {
    console.error("Save job error:", error);
    setErrorMessage("An error occurred. Please try again.");
    showView("errorView");
  }
}

// Check if current page is a job posting
async function checkCurrentPage() {
  // Show loading state
  showView("loadingView");

  try {
    // Get current tab info
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tabs || tabs.length === 0) {
      throw new Error("No active tab found");
    }

    const tab = tabs[0];

    // Check if URL is a job board
    if (isJobBoardUrl(tab.url)) {
      // Extract job data
      await extractJobData();
    } else {
      // Not a job posting page
      showView("notJobPageView");
    }
  } catch (error) {
    console.error("Check current page error:", error);
    setErrorMessage(
      "Failed to check current page: " + (error.message || "Unknown error")
    );
    showView("errorView");
  }
}

// Extract job data from current page
async function extractJobData() {
  // Show loading state
  showView("loadingView");

  try {
    console.log("Sending extractJobData message from popup");

    // Send extract request to background script
    const response = await sendMessage({ action: "extractJobData" });

    if (
      response &&
      response.error &&
      response.error.includes("Authentication required")
    ) {
      // Authentication issue
      showAuthRequiredView();
      return;
    }

    if (!response || !response.success || !response.data) {
      throw new Error(
        response && response.error
          ? response.error
          : "Failed to extract job data"
      );
    }

    const jobData = response.data;
    console.log("Job data extracted successfully:", jobData);

    // Store the extracted data
    currentJobData = jobData;

    // Save job data
    await sendMessage({
      action: "saveJobData",
      data: currentJobData,
    });

    // Update job data view
    updateJobDataView(currentJobData);

    // Show job data view
    showView("jobDataView");
  } catch (error) {
    console.error("Extract job data error:", error);
    setErrorMessage(
      "An error occurred while extracting data: " +
        (error.message || "Unknown error")
    );
    showView("errorView");
  }
}

// Update job data view with extracted data
function updateJobDataView(data) {
  // Set job title
  jobTitle.textContent = data.position || "Untitled Position";

  // Set company name
  companyName.textContent = data.company || "Unknown Company";

  // Set job location
  jobLocation.textContent = data.jobLocation || "Location not specified";

  // Set job type
  jobType.textContent = formatJobType(data.jobType) || "Not specified";

  // Set salary
  jobSalary.textContent = formatSalary(data.salary) || "Not specified";
}

// Show authenticated UI
function showAuthenticatedUI(user) {
  // Hide auth required view
  authRequiredView.classList.add("hidden");

  // Show main view
  mainView.classList.remove("hidden");

  // Update user profile
  userProfileToggle.classList.remove("hidden");

  // Set user initials (handle email or name)
  const initials = getInitials(user.name || user.email || "User");
  userInitials.textContent = initials;
}

// Show auth required view
function showAuthRequiredView() {
  // Hide main view
  mainView.classList.add("hidden");

  // Show auth required view
  authRequiredView.classList.remove("hidden");
}

// Show specific view in extraction section
function showView(viewId) {
  // Hide all views
  notJobPageView.classList.add("hidden");
  loadingView.classList.add("hidden");
  errorView.classList.add("hidden");
  jobDataView.classList.add("hidden");

  // Show requested view
  document.getElementById(viewId).classList.remove("hidden");
}

// Set error message
function setErrorMessage(message = "") {
  errorMessage.textContent = message;
}

// Send message to background script
function sendMessage(message) {
  return browser.runtime.sendMessage(message).catch((error) => {
    console.error("Send message error:", error);
    throw error;
  });
}
