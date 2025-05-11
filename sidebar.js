/**
 * PursuitPal - Sidebar Script
 *
 * Modified from popup.js to work as a sidebar
 * Controls the sidebar UI and manages communication with
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
const closeSidebarBtn = document.getElementById("close-sidebar-btn");
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
// Tab ID of the parent
let parentTabId = null;

// Initialize the sidebar
document.addEventListener("DOMContentLoaded", async () => {
  // Check if auth service is available
  if (typeof authService === "undefined") {
    console.error("Auth service not found");
    showErrorWithMessage(
      "Authentication service not available. Please try again."
    );
    return;
  }

  // Check authentication first
  try {
    const isAuthenticated = await authService.isAuthenticated();

    if (!isAuthenticated) {
      // Not authenticated, show error with login button
      showErrorWithMessage("Please log in to use PursuitPal", true);
      return;
    }

    // Get the parent tab ID
    chrome.runtime.sendMessage({ action: "getParentTabId" }, (response) => {
      if (response && response.tabId) {
        parentTabId = response.tabId;
      }
    });

    // Load and display user info
    await loadUserInfo();

    // Set up tab switching
    setupTabs();

    // Set up close button
    setupCloseButton();

    showLoadingState();

    try {
      // Check connection to the app
      checkAppConnection();

      // Request job data from the current page
      chrome.runtime.sendMessage(
        { action: "getJobDataForCurrentTab" },
        (response) => {
          if (response && response.jobData) {
            // We have data for this tab
            updateUIWithJobData(response.jobData);
            hideLoadingState();
          } else {
            // No data, try to extract from page
            extractJobDataFromPage();
          }
        }
      );
    } catch (error) {
      console.error("Error initializing sidebar:", error);
      showErrorState();
    }
  } catch (error) {
    console.error("Authentication error:", error);
    showErrorWithMessage(
      "Authentication failed. Please try logging in again.",
      true
    );
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
      chrome.storage.local.get(["user"], (userData) => {
        if (userData.user) {
          currentUser = userData.user;

          // Update UI with user info
          if (userDisplay) {
            userDisplay.textContent = userData.user.name || userData.user.email;
          }
        }
      });
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
    await authService.logout();

    // Show logged out message
    showErrorWithMessage(
      "You have been logged out. Please log in again.",
      true
    );
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

// Set up close button
function setupCloseButton() {
  if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener("click", () => {
      // Send message to parent window to close the sidebar
      window.parent.postMessage(
        { source: "pursuitpal-sidebar", action: "closeSidebar" },
        "*"
      );
    });
  }
}

// Extract job data from the current page
async function extractJobDataFromPage() {
  try {
    // Send message to extract job data
    chrome.runtime.sendMessage(
      { action: "extractJobDataFromCurrentTab" },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Content script error:", chrome.runtime.lastError);
          showErrorState();
          return;
        }

        if (response && response.jobData) {
          // Got job data, update the UI
          updateUIWithJobData(response.jobData);
          hideLoadingState();
        } else {
          // No job data found
          showErrorState();
        }
      }
    );
  } catch (error) {
    console.error("Error communicating with background script:", error);
    showErrorState();
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
      jobData.jobDescription.substring(0, 500) +
      (jobData.jobDescription.length > 500 ? "..." : "");
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
    // Add timestamp
    createdAt: new Date().toISOString(),
  };
}

// Show loading state
function showLoadingState() {
  if (loadingState) {
    loadingState.classList.remove("hidden");
  }
  if (errorState) {
    errorState.classList.add("hidden");
  }
  if (jobDataForm) {
    jobDataForm.classList.add("hidden");
  }
}

// Hide loading state
function hideLoadingState() {
  if (loadingState) {
    loadingState.classList.add("hidden");
  }
  if (jobDataForm) {
    jobDataForm.classList.remove("hidden");
  }
}

// Show error state
function showErrorState() {
  if (loadingState) {
    loadingState.classList.add("hidden");
  }
  if (errorState) {
    errorState.classList.remove("hidden");
  }
  if (jobDataForm) {
    jobDataForm.classList.remove("hidden");
  }
}

// Show error with custom message
function showErrorWithMessage(message, showLoginButton = false) {
  if (loadingState) {
    loadingState.classList.add("hidden");
  }

  if (errorState) {
    errorState.classList.remove("hidden");
    errorState.innerHTML = `<p>${message}</p>`;

    if (showLoginButton) {
      errorState.innerHTML += `
        <div class="mt-4 flex justify-center">
          <button id="login-btn" class="px-4 py-2 bg-primary text-white rounded hover:bg-primary-light">
            Log in
          </button>
        </div>
      `;

      setTimeout(() => {
        const loginBtn = document.getElementById("login-btn");
        if (loginBtn) {
          loginBtn.addEventListener("click", () => {
            chrome.runtime.sendMessage({ action: "openLoginPage" });
            // Send message to parent to close sidebar
            window.parent.postMessage(
              { source: "pursuitpal-sidebar", action: "closeSidebar" },
              "*"
            );
          });
        }
      }, 0);
    }
  }

  if (jobDataForm) {
    jobDataForm.classList.add("hidden");
  }
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
  refreshBtn.addEventListener("click", () => {
    showLoadingState();
    extractJobDataFromPage();
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
      chrome.runtime.sendMessage(
        { action: "openJobForm", jobData: jobData },
        () => {
          // Success message
          createBtn.innerHTML = `
            <svg class="h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
            Sent successfully!
          `;

          // Reset button after delay
          setTimeout(() => {
            createBtn.innerText = "Send to Job Tracker";

            // Optionally close sidebar
            window.parent.postMessage(
              { source: "pursuitpal-sidebar", action: "closeSidebar" },
              "*"
            );
          }, 2000);
        }
      );
    } catch (error) {
      console.error("Error sending job data:", error);

      // Reset button
      createBtn.innerHTML = "Send to Job Tracker";

      // Show error notification
      errorState.classList.remove("hidden");
      errorState.innerHTML =
        "<p>Failed to send job data. Please try again.</p>";
    }
  });
}
