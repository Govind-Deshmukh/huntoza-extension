/**
 * PursuitPal - Popup Script
 *
 * This script controls the popup UI and manages communication with
 * the content script and background script.
 */

// Constants
const API_BASE_URL = "https://api.pursuitpal.app/api/v1";
const APP_BASE_URL = "https://pursuitpal.app";

// DOM Elements
const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const jobDataForm = document.getElementById("job-data-form");
const refreshBtn = document.getElementById("refresh-btn");
const createBtn = document.getElementById("create-btn");
const settingsBtn = document.getElementById("settings-btn");
const logoutBtn = document.getElementById("logout-btn");
const userDisplay = document.getElementById("user-display");
const connectionStatus = document.getElementById("connection-status");

// Tab elements
const jobsTab = document.getElementById("jobs-tab");
const contactsTab = document.getElementById("contacts-tab");
const jobTabContent = document.getElementById("job-tab-content");
const contactsTabContent = document.getElementById("contacts-tab-content");

// Form fields
const companyInput = document.getElementById("company");
const positionInput = document.getElementById("position");
const jobLocationInput = document.getElementById("jobLocation");
const jobTypeSelect = document.getElementById("jobType");
const salaryCurrencySelect = document.getElementById("salaryCurrency");
const salaryMinInput = document.getElementById("salaryMin");
const salaryMaxInput = document.getElementById("salaryMax");
const jobDescriptionPreview = document.getElementById("jobDescriptionPreview");
const jobUrlInput = document.getElementById("jobUrl");
const prioritySelect = document.getElementById("priority");

// Current job data
let currentJobData = null;
// Current user data
let currentUser = null;

// Initialize the popup
document.addEventListener("DOMContentLoaded", async () => {
  // Check if auth service is available
  if (typeof authService === "undefined") {
    console.error("Auth service not found");
    window.location.href = "login.html";
    return;
  }

  // Check authentication first
  try {
    const isAuthenticated = await authService.isAuthenticated();

    if (!isAuthenticated) {
      // Not authenticated, redirect to login
      window.location.href = "login.html";
      return;
    }

    // Load and display user info
    await loadUserInfo();

    // Set up tab switching
    setupTabs();

    showLoadingState();

    try {
      // Check connection to the app
      checkAppConnection();

      // Get the current tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // Try to get cached job data first
      chrome.storage.local.get(["jobData"], async (result) => {
        if (result.jobData && result.jobData.jobUrl === tab.url) {
          // We have cached data for this URL
          updateUIWithJobData(result.jobData);
          hideLoadingState();
        } else {
          // No cached data, request extraction from content script
          try {
            await extractJobDataFromPage(tab);
          } catch (error) {
            console.error("Error extracting job data:", error);
            showErrorState();
          }
        }
      });
    } catch (error) {
      console.error("Error initializing popup:", error);
      showErrorState();
    }
  } catch (error) {
    console.error("Authentication error:", error);
    // Redirect to login on any auth error
    window.location.href = "login.html";
  }
});

// Load user information
async function loadUserInfo() {
  try {
    // Get user data from auth service
    currentUser = await authService.getCurrentUser();

    if (currentUser) {
      // Update UI with user info
      if (userDisplay) {
        userDisplay.textContent = currentUser.name || currentUser.email;
      }
    } else {
      // If no user data, try to get from storage as fallback
      const userData = await chrome.storage.local.get(["user"]);

      if (userData.user) {
        currentUser = userData.user;

        // Update UI with user info
        if (userDisplay) {
          userDisplay.textContent = userData.user.name || userData.user.email;
        }
      }
    }
  } catch (error) {
    console.error("Error loading user info:", error);
  }
}

// Handle logout
async function handleLogout() {
  try {
    // Show loading state
    document.body.classList.add("cursor-wait");
    if (logoutBtn) {
      logoutBtn.disabled = true;
    }

    // Call auth service to handle logout
    const result = await authService.logout();

    // Redirect to login page
    window.location.href = "login.html";
  } catch (error) {
    console.error("Logout error:", error);
    alert("Failed to logout. Please try again.");

    // Reset UI
    document.body.classList.remove("cursor-wait");
    if (logoutBtn) {
      logoutBtn.disabled = false;
    }
  }
}

// Set up tab switching functionality
function setupTabs() {
  if (!jobsTab || !contactsTab) {
    return; // Tabs not found
  }

  jobsTab.addEventListener("click", () => {
    // Update tab buttons
    jobsTab.classList.add("border-b-2", "border-primary", "text-primary");
    jobsTab.classList.remove("text-gray-500");
    contactsTab.classList.remove(
      "border-b-2",
      "border-primary",
      "text-primary"
    );
    contactsTab.classList.add("text-gray-500");

    // Show/hide content
    jobTabContent.classList.remove("hidden");
    contactsTabContent.classList.add("hidden");
  });

  contactsTab.addEventListener("click", () => {
    // Update tab buttons
    contactsTab.classList.add("border-b-2", "border-primary", "text-primary");
    contactsTab.classList.remove("text-gray-500");
    jobsTab.classList.remove("border-b-2", "border-primary", "text-primary");
    jobsTab.classList.add("text-gray-500");

    // Show/hide content
    contactsTabContent.classList.remove("hidden");
    jobTabContent.classList.add("hidden");
  });

  // Set up logout button
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }
}

// Extract job data from the current page
async function extractJobDataFromPage(tab) {
  try {
    // Ensure content script is injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
    } catch (e) {
      // Content script injection failed, possibly already injected
      console.log("Content script may already be injected:", e);
    }

    // Request content script to extract job data
    chrome.tabs.sendMessage(
      tab.id,
      { action: "extractJobData" },
      (response) => {
        if (chrome.runtime.lastError) {
          // Handle error (content script might not be loaded)
          console.error("Content script error:", chrome.runtime.lastError);
          showErrorState();
          return;
        }

        if (response && Object.keys(response).length > 0) {
          // Got job data, update the UI
          updateUIWithJobData(response);
          hideLoadingState();
        } else {
          // No job data found
          showErrorState();
        }
      }
    );
  } catch (error) {
    console.error("Error communicating with content script:", error);
    throw error;
  }
}

// Update UI with job data
function updateUIWithJobData(jobData) {
  // Save reference to current job data
  currentJobData = jobData;

  // Populate form fields
  companyInput.value = jobData.company || "";
  positionInput.value = jobData.position || "";
  jobLocationInput.value = jobData.jobLocation || "";
  jobTypeSelect.value = jobData.jobType || "full-time";

  // Salary information
  if (jobData.salary) {
    salaryCurrencySelect.value = jobData.salary.currency || "INR";
    salaryMinInput.value = jobData.salary.min || "";
    salaryMaxInput.value = jobData.salary.max || "";
  }

  // Job description preview (truncated)
  if (jobData.jobDescription) {
    const preview =
      jobData.jobDescription.substring(0, 200) +
      (jobData.jobDescription.length > 200 ? "..." : "");
    jobDescriptionPreview.innerHTML = `<p>${preview}</p>`;
  } else {
    jobDescriptionPreview.innerHTML =
      '<p class="text-gray-400 italic">No job description found</p>';
  }

  // Job URL
  jobUrlInput.value = jobData.jobUrl || "";
}

// Get current job data from form fields
function getJobDataFromForm() {
  return {
    company: companyInput.value,
    position: positionInput.value,
    jobLocation: jobLocationInput.value,
    jobType: jobTypeSelect.value,
    salary: {
      min: parseInt(salaryMinInput.value) || 0,
      max: parseInt(salaryMaxInput.value) || 0,
      currency: salaryCurrencySelect.value,
    },
    jobDescription: currentJobData?.jobDescription || "",
    jobUrl: jobUrlInput.value,
    priority: prioritySelect.value,
  };
}

// Show loading state
function showLoadingState() {
  loadingState.classList.remove("hidden");
  errorState.classList.add("hidden");
  jobDataForm.classList.add("hidden");
}

// Hide loading state
function hideLoadingState() {
  loadingState.classList.add("hidden");
  jobDataForm.classList.remove("hidden");
}

// Show error state
function showErrorState() {
  loadingState.classList.add("hidden");
  errorState.classList.remove("hidden");
  jobDataForm.classList.remove("hidden");
}

// Check connection to the job tracker app
function checkAppConnection() {
  // Check if we can connect to the application
  fetch(`https://api.pursuitpal.app/api/health`, {
    method: "GET",
    // Don't use no-cors mode as it doesn't allow checking the response
  })
    .then((response) => {
      if (response.ok) {
        // If response is OK (status in the 200-299 range)
        connectionStatus.innerHTML = `
          <span class="h-2 w-2 rounded-full bg-green-500 mr-1"></span>
          <span>Connected to PursuitPal Tracker</span>
        `;
      } else {
        // If response is not OK
        connectionStatus.innerHTML = `
          <span class="h-2 w-2 rounded-full bg-red-500 mr-1"></span>
          <span>Not connected to PursuitPal Tracker</span>
        `;
      }
    })
    .catch(() => {
      // If fetch fails (network error), we can't connect
      connectionStatus.innerHTML = `
        <span class="h-2 w-2 rounded-full bg-red-500 mr-1"></span>
        <span>Not connected to PursuitPal Tracker</span>
      `;
    });
}

// Settings button - Open options page
if (settingsBtn) {
  settingsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

// Refresh button - Fetch job data again
if (refreshBtn) {
  refreshBtn.addEventListener("click", async () => {
    showLoadingState();
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      await extractJobDataFromPage(tab);
    } catch (error) {
      console.error("Error refreshing job data:", error);
      showErrorState();
    }
  });
}

// Create application button - Open job form in the app with prefilled data
if (createBtn) {
  createBtn.addEventListener("click", async () => {
    const jobData = getJobDataFromForm();

    // Change button to loading state
    createBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Sending to PursuitPal...
    `;

    try {
      // Save job data to storage (to be accessed by the background script)
      chrome.storage.local.set({ pendingJobApplication: jobData });

      // Construct the URL for the job form
      const appUrl = `${APP_BASE_URL}/jobs/new`;

      // Create a new tab with the job form
      chrome.tabs.create({ url: appUrl }, (tab) => {
        // Background script will handle injecting the data after the new tab loads
      });
    } catch (error) {
      console.error("Error sending job data:", error);

      // Reset button
      createBtn.innerHTML = "Send to PursuitPal Tracker";

      // Show error notification
      errorState.classList.remove("hidden");
      errorState.textContent = "Failed to send job data. Please try again.";
    }
  });
}
