/**
 * PursuitPal - Sidebar Script
 *
 * Enhanced version with improved UI feedback and interaction
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
// Store extraction attempts to prevent endless retries
let extractionAttempts = 0;
const MAX_EXTRACTION_ATTEMPTS = 3;
// Store form change status
let formHasChanges = false;

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

  // Set up form change tracking
  setupFormChangeTracking();

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
          if (response && response.success && response.jobData) {
            // We have data for this tab
            updateUIWithJobData(response.jobData);
            hideLoadingState();
            showSuccessToast("Job details extracted successfully!");
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

// Track form changes
function setupFormChangeTracking() {
  const formInputs = [
    companyInput,
    positionInput,
    jobLocationInput,
    jobTypeSelect,
    salaryCurrencySelect,
    salaryMinInput,
    salaryMaxInput,
    prioritySelect,
  ];

  formInputs.forEach((input) => {
    if (input) {
      input.addEventListener("change", () => {
        formHasChanges = true;
      });
      input.addEventListener("input", () => {
        formHasChanges = true;
      });
    }
  });
}

// Load user information with improved UI feedback
async function loadUserInfo() {
  try {
    // Get user data from auth service
    currentUser = await authService.getCurrentUser();

    if (currentUser) {
      // Update UI with user info
      if (userDisplay) {
        // Create user avatar element
        const userInitial = currentUser.name
          ? currentUser.name.charAt(0).toUpperCase()
          : currentUser.email
          ? currentUser.email.charAt(0).toUpperCase()
          : "U";

        userDisplay.innerHTML = `
          <span class="inline-flex items-center">
            <span class="h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-medium mr-2">
              ${userInitial}
            </span>
            <span>${currentUser.name || currentUser.email}</span>
          </span>
        `;
      }
    } else {
      // If no user data, try to get from storage as fallback
      chrome.storage.local.get(["user"], (userData) => {
        if (userData.user) {
          currentUser = userData.user;

          // Update UI with user info
          if (userDisplay) {
            const userInitial = userData.user.name
              ? userData.user.name.charAt(0).toUpperCase()
              : userData.user.email
              ? userData.user.email.charAt(0).toUpperCase()
              : "U";

            userDisplay.innerHTML = `
              <span class="inline-flex items-center">
                <span class="h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-medium mr-2">
                  ${userInitial}
                </span>
                <span>${userData.user.name || userData.user.email}</span>
              </span>
            `;
          }
        }
      });
    }
  } catch (error) {
    console.error("Error loading user info:", error);
    if (userDisplay) {
      userDisplay.innerHTML = `
        <span class="inline-flex items-center text-red-500">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          Sign in error
        </span>
      `;
    }
  }
}

// Handle logout with improved user feedback
async function handleLogout() {
  try {
    // Show loading state
    document.body.classList.add("cursor-wait");
    if (logoutBtn) {
      logoutBtn.disabled = true;
      logoutBtn.innerHTML = `
        <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      `;
    }

    // Call auth service to handle logout
    await authService.logout();

    // Show logged out message
    showSuccessToast("Successfully logged out");
    setTimeout(() => {
      showErrorWithMessage(
        "You have been logged out. Please log in again.",
        true
      );
    }, 1000);
  } catch (error) {
    console.error("Logout error:", error);
    showErrorToast("Failed to logout. Please try again.");

    // Reset UI
    document.body.classList.remove("cursor-wait");
    if (logoutBtn) {
      logoutBtn.disabled = false;
      logoutBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm11 3a1 1 0 00-1-1H7a1 1 0 00-1 1v10a1 1 0 001 1h6a1 1 0 001-1V6z" clip-rule="evenodd" />
          <path d="M10 9a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm0-4a1 1 0 100 2 1 1 0 000-2z" />
        </svg>
      `;
    }
  }
}

// Set up tab switching functionality with improved animation
function setupTabs() {
  if (!jobsTab || !contactsTab) {
    return; // Tabs not found
  }

  jobsTab.addEventListener("click", () => {
    // Update tab buttons
    jobsTab.classList.add("text-primary");
    jobsTab.classList.remove("text-gray-500");
    contactsTab.classList.remove("text-primary");
    contactsTab.classList.add("text-gray-500");

    // Show indicator
    const indicator = jobsTab.querySelector(".tab-indicator");
    if (indicator) {
      indicator.classList.remove("opacity-0");
    }

    // Hide indicator on other tab
    const otherIndicator = contactsTab.querySelector(".tab-indicator");
    if (otherIndicator) {
      otherIndicator.classList.add("opacity-0");
    } else {
      // If no indicator on contacts tab yet, add one (invisible)
      const newIndicator = document.createElement("div");
      newIndicator.className =
        "tab-indicator absolute bottom-0 left-0 w-full h-0.5 bg-primary opacity-0";
      contactsTab.appendChild(newIndicator);
    }

    // Show/hide content with animation
    jobTabContent.classList.remove("hidden");
    contactsTabContent.classList.add("hidden");
  });

  contactsTab.addEventListener("click", () => {
    // Update tab buttons
    contactsTab.classList.add("text-primary");
    contactsTab.classList.remove("text-gray-500");
    jobsTab.classList.remove("text-primary");
    jobsTab.classList.add("text-gray-500");

    // Show indicator
    const indicator = contactsTab.querySelector(".tab-indicator");
    if (indicator) {
      indicator.classList.remove("opacity-0");
    } else {
      // If no indicator, add one
      const newIndicator = document.createElement("div");
      newIndicator.className =
        "tab-indicator absolute bottom-0 left-0 w-full h-0.5 bg-primary";
      contactsTab.appendChild(newIndicator);
    }

    // Hide indicator on other tab
    const otherIndicator = jobsTab.querySelector(".tab-indicator");
    if (otherIndicator) {
      otherIndicator.classList.add("opacity-0");
    }

    // Show/hide content with animation
    contactsTabContent.classList.remove("hidden");
    jobTabContent.classList.add("hidden");
  });

  // Set up logout button
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }
}

// Set up close button with confirmation if form has changes
function setupCloseButton() {
  if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener("click", () => {
      if (formHasChanges) {
        if (
          confirm("You have unsaved changes. Are you sure you want to close?")
        ) {
          closeSidebar();
        }
      } else {
        closeSidebar();
      }
    });
  }
}

function closeSidebar() {
  // Send message to parent window to close the sidebar
  window.parent.postMessage(
    { source: "pursuitpal-sidebar", action: "closeSidebar" },
    "*"
  );
}

// Extract job data from the current page with improved error handling
async function extractJobDataFromPage() {
  try {
    // Increment extraction attempts
    extractionAttempts++;

    // Show a more specific loading message
    if (loadingState) {
      loadingState.innerHTML = `
        <div class="spinner mb-4"></div>
        <p class="text-gray-600 font-medium">Scanning page for job details...</p>
        <p class="text-gray-500 text-sm mt-2">Attempt ${extractionAttempts} of ${MAX_EXTRACTION_ATTEMPTS}</p>
      `;
    }

    // Send message to extract job data
    chrome.runtime.sendMessage(
      { action: "extractJobDataFromCurrentTab" },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Content script error:", chrome.runtime.lastError);

          // Check if we've reached max attempts
          if (extractionAttempts >= MAX_EXTRACTION_ATTEMPTS) {
            showErrorState();
            showErrorToast(
              "Failed to extract job details after multiple attempts"
            );
          } else {
            // Try again after a delay
            setTimeout(() => extractJobDataFromPage(), 1000);
          }
          return;
        }

        if (response && response.success && response.jobData) {
          // Got job data, update the UI
          updateUIWithJobData(response.jobData);
          hideLoadingState();
          showSuccessToast("Job details extracted successfully!");
        } else {
          // Check if we've reached max attempts
          if (extractionAttempts >= MAX_EXTRACTION_ATTEMPTS) {
            showErrorState();
            showErrorToast("Could not find job details on this page");
          } else {
            // Try again after a delay
            setTimeout(() => extractJobDataFromPage(), 1000);
          }
        }
      }
    );
  } catch (error) {
    console.error("Error communicating with background script:", error);

    if (extractionAttempts >= MAX_EXTRACTION_ATTEMPTS) {
      showErrorState();
      showErrorToast("An error occurred while extracting job details");
    } else {
      // Try again after a delay
      setTimeout(() => extractJobDataFromPage(), 1000);
    }
  }
}

// Update UI with job data - enhanced with input validation
function updateUIWithJobData(jobData) {
  // Save reference to current job data
  currentJobData = jobData;
  formHasChanges = false;

  // Sanitize and populate form fields
  companyInput.value = sanitizeInput(jobData.company || "");
  positionInput.value = sanitizeInput(jobData.position || "");
  jobLocationInput.value = sanitizeInput(jobData.jobLocation || "");

  // Make sure jobType is valid option
  const validJobTypes = [
    "full-time",
    "part-time",
    "contract",
    "internship",
    "remote",
    "hybrid",
    "other",
  ];
  jobTypeSelect.value = validJobTypes.includes(jobData.jobType)
    ? jobData.jobType
    : "full-time";

  // Salary information with validation
  if (jobData.salary) {
    // Validate currency
    const validCurrencies = ["INR", "USD", "EUR", "GBP", "JPY"];
    salaryCurrencySelect.value = validCurrencies.includes(
      jobData.salary.currency
    )
      ? jobData.salary.currency
      : "INR";

    // Validate salary values
    salaryMinInput.value = isValidNumber(jobData.salary.min)
      ? jobData.salary.min
      : "";
    salaryMaxInput.value = isValidNumber(jobData.salary.max)
      ? jobData.salary.max
      : "";

    // If max less than min, swap them
    if (
      parseInt(salaryMinInput.value) > parseInt(salaryMaxInput.value) &&
      salaryMaxInput.value
    ) {
      const temp = salaryMinInput.value;
      salaryMinInput.value = salaryMaxInput.value;
      salaryMaxInput.value = temp;
    }
  }

  // Job description preview with enhanced formatting and safety
  if (jobData.jobDescription) {
    try {
      // Sanitize and format the description
      const sanitizedDescription = sanitizeHTML(jobData.jobDescription);
      const formattedDescription = formatJobDescription(sanitizedDescription);

      // Create preview with length indication
      const textLength = jobData.jobDescription.length;
      const preview =
        sanitizedDescription.substring(0, 500) +
        (textLength > 500 ? "..." : "");

      // Set content with character count
      jobDescriptionPreview.innerHTML = `
        <div class="mb-2">${preview}</div>
        <div class="text-xs text-gray-500 text-right">
          ${textLength} characters
        </div>
      `;
    } catch (error) {
      console.error("Error formatting job description:", error);
      jobDescriptionPreview.innerHTML = `
        <p class="text-gray-600">A job description was found (${jobData.jobDescription.length} characters).</p>
      `;
    }
  } else {
    jobDescriptionPreview.innerHTML = `
      <p class="text-gray-400 italic">No job description found</p>
    `;
  }

  // Job URL - sanitized for security
  jobUrlInput.value = sanitizeInput(jobData.jobUrl || "");
}

// Sanitize HTML content
function sanitizeHTML(html) {
  const temp = document.createElement("div");
  temp.textContent = html;
  return temp.innerHTML;
}

// Format job description for better readability
function formatJobDescription(text) {
  if (!text) return "";

  // Split by new lines and filter empty lines
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  return lines.join("\n");
}

// Sanitize user input to prevent XSS
function sanitizeInput(input) {
  if (!input) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Validate number
function isValidNumber(value) {
  return !isNaN(parseFloat(value)) && isFinite(value) && value >= 0;
}

// Get current job data from form fields with validation
function getJobDataFromForm() {
  // Validate salary values
  const salaryMin = parseInt(salaryMinInput.value) || 0;
  const salaryMax = parseInt(salaryMaxInput.value) || 0;

  return {
    company: companyInput.value.trim(),
    position: positionInput.value.trim(),
    jobLocation: jobLocationInput.value.trim(),
    jobType: jobTypeSelect.value,
    salary: {
      min: Math.max(0, salaryMin),
      max: Math.max(0, salaryMax),
      currency: salaryCurrencySelect.value,
    },
    jobDescription: currentJobData?.jobDescription || "",
    jobUrl: jobUrlInput.value,
    priority: prioritySelect.value,
    // Add timestamp
    createdAt: new Date().toISOString(),
  };
}

// Show loading state with customizable message
function showLoadingState(message = "Scanning page for details...") {
  if (loadingState) {
    loadingState.innerHTML = `
      <div class="spinner mb-4"></div>
      <p class="text-gray-600 font-medium">${sanitizeInput(message)}</p>
      <p class="text-gray-500 text-sm mt-2">This may take a few seconds</p>
    `;
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

// Show error state with better visual feedback
function showErrorState() {
  if (loadingState) {
    loadingState.classList.add("hidden");
  }
  if (errorState) {
    errorState.innerHTML = `
      <div class="flex items-start">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm">
            Could not extract details from this page. Please try refreshing or
            manually enter information.
          </p>
          <button id="retry-extract-btn" class="mt-2 text-xs font-medium text-primary hover:text-primary-light">
            Try again
          </button>
        </div>
      </div>
    `;
    errorState.classList.remove("hidden");

    // Add event listener to retry button
    setTimeout(() => {
      const retryBtn = document.getElementById("retry-extract-btn");
      if (retryBtn) {
        retryBtn.addEventListener("click", () => {
          extractionAttempts = 0;
          showLoadingState();
          extractJobDataFromPage();
        });
      }
    }, 0);
  }
  if (jobDataForm) {
    jobDataForm.classList.remove("hidden");
  }
}

// Show error with custom message and optional login button
function showErrorWithMessage(message, showLoginButton = false) {
  if (loadingState) {
    loadingState.classList.add("hidden");
  }

  if (errorState) {
    errorState.classList.remove("hidden");
    errorState.innerHTML = `
      <div class="flex items-start">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm">${sanitizeInput(message)}</p>
        </div>
      </div>
      ${
        showLoginButton
          ? `
        <div class="mt-4 flex justify-center">
          <button id="login-btn" class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light transition-colors">
            Log in
          </button>
        </div>
      `
          : ""
      }
    `;

    if (showLoginButton) {
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

// Show toast notifications
function showToast(message, type = "success") {
  // Remove any existing toast
  const existingToast = document.getElementById("pursuitpal-toast");
  if (existingToast) {
    existingToast.remove();
  }

  // Create toast container
  const toast = document.createElement("div");
  toast.id = "pursuitpal-toast";
  toast.style.cssText = `
    position: fixed;
    top: 16px;
    right: 16px;
    max-width: 90%;
    z-index: 9999;
    padding: 12px 16px;
    border-radius: 6px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    transform: translateY(-20px);
    opacity: 0;
  `;

  // Set color based on type
  if (type === "success") {
    toast.style.backgroundColor = "#ecfdf5";
    toast.style.color = "#10b981";
    toast.style.border = "1px solid #d1fae5";
    toast.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>
    `;
  } else if (type === "error") {
    toast.style.backgroundColor = "#fff1f2";
    toast.style.color = "#ef4444";
    toast.style.border = "1px solid #fee2e2";
    toast.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
      </svg>
    `;
  } else if (type === "warning") {
    toast.style.backgroundColor = "#fffbeb";
    toast.style.color = "#f59e0b";
    toast.style.border = "1px solid #fef3c7";
    toast.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
    `;
  }

  // Add message
  toast.innerHTML += `<span>${sanitizeInput(message)}</span>`;

  // Add to document
  document.body.appendChild(toast);

  // Animate in
  setTimeout(() => {
    toast.style.transform = "translateY(0)";
    toast.style.opacity = "1";
  }, 10);

  // Auto remove after delay
  setTimeout(() => {
    toast.style.transform = "translateY(-20px)";
    toast.style.opacity = "0";
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

// Shorthand helper functions
function showSuccessToast(message) {
  showToast(message, "success");
}

function showErrorToast(message) {
  showToast(message, "error");
}

function showWarningToast(message) {
  showToast(message, "warning");
}

// Check connection to the job tracker app with improved visual feedback
function checkAppConnection() {
  // Update connection status UI to "Checking..."
  if (connectionStatus) {
    connectionStatus.innerHTML = `
      <span class="h-2 w-2 rounded-full bg-yellow-500 mr-1 animate-pulse"></span>
      <span>Checking connection...</span>
    `;
  }

  // Check if we can connect to the application
  fetch(`https://api.pursuitpal.app/api/health`, {
    method: "GET",
    // Add timeout to prevent long waits
    signal: AbortSignal.timeout(5000), // 5 second timeout
  })
    .then((response) => {
      if (response.ok) {
        // If response is OK (status in the 200-299 range)
        if (connectionStatus) {
          connectionStatus.innerHTML = `
            <span class="h-2 w-2 rounded-full bg-green-500 mr-1"></span>
            <span>Connected to PursuitPal Tracker</span>
          `;
        }
      } else {
        // If response is not OK
        if (connectionStatus) {
          connectionStatus.innerHTML = `
            <span class="h-2 w-2 rounded-full bg-red-500 mr-1"></span>
            <span>Not connected to PursuitPal Tracker</span>
          `;
        }
        showWarningToast("Unable to connect to PursuitPal Tracker");
      }
    })
    .catch(() => {
      // If fetch fails (network error), we can't connect
      if (connectionStatus) {
        connectionStatus.innerHTML = `
          <span class="h-2 w-2 rounded-full bg-red-500 mr-1"></span>
          <span>Not connected to PursuitPal Tracker</span>
        `;
      }
      showWarningToast("Unable to connect to PursuitPal Tracker");
    });
}

// Set up event listeners once DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  // Settings button - Open options page
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
  }

  // Refresh button - Fetch job data again with improved feedback
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      // Reset extraction attempts
      extractionAttempts = 0;

      // Check if form has unsaved changes
      if (formHasChanges) {
        if (
          confirm("You have unsaved changes. Are you sure you want to refresh?")
        ) {
          showLoadingState("Refreshing job details...");
          extractJobDataFromPage();
        }
      } else {
        showLoadingState("Refreshing job details...");
        extractJobDataFromPage();
      }
    });
  }

  // Create application button - Open job form in the app with prefilled data and improved feedback
  if (createBtn) {
    createBtn.addEventListener("click", async () => {
      // Validate form data before submission
      const jobData = getJobDataFromForm();
      if (!validateJobData(jobData)) {
        return;
      }

      // Change button to loading state
      const originalButtonContent = createBtn.innerHTML;
      createBtn.disabled = true;
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
          (response) => {
            if (response && response.success) {
              // Success message
              createBtn.classList.remove("bg-primary");
              createBtn.classList.add("bg-green-500");
              createBtn.innerHTML = `
                <svg class="h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                Sent successfully!
              `;

              // Form is now clean (no unsaved changes)
              formHasChanges = false;

              // Reset button after delay
              setTimeout(() => {
                createBtn.classList.remove("bg-green-500");
                createBtn.classList.add("bg-primary");
                createBtn.disabled = false;
                createBtn.innerHTML = originalButtonContent;

                // Optionally close sidebar
                if (
                  confirm(
                    "Job sent successfully! Would you like to close this sidebar?"
                  )
                ) {
                  window.parent.postMessage(
                    { source: "pursuitpal-sidebar", action: "closeSidebar" },
                    "*"
                  );
                }
              }, 2000);
            } else {
              // Error state
              handleSubmissionError();
            }
          }
        );
      } catch (error) {
        console.error("Error sending job data:", error);
        handleSubmissionError();
      }

      function handleSubmissionError() {
        // Reset button
        createBtn.disabled = false;
        createBtn.innerHTML = originalButtonContent;

        // Show error notification
        showErrorToast("Failed to send job data. Please try again.");
      }
    });
  }
});

// Validate job data before submission
function validateJobData(jobData) {
  // Require company name
  if (!jobData.company.trim()) {
    showErrorToast("Please enter a company name");
    companyInput.focus();
    return false;
  }

  // Require position
  if (!jobData.position.trim()) {
    showErrorToast("Please enter a job position");
    positionInput.focus();
    return false;
  }

  // Make sure salary max is greater than min if both provided
  if (
    jobData.salary.min > 0 &&
    jobData.salary.max > 0 &&
    jobData.salary.min > jobData.salary.max
  ) {
    showWarningToast("Minimum salary cannot be greater than maximum salary");
    salaryMinInput.focus();
    return false;
  }

  // If we got here, validation passed
  return true;
}
