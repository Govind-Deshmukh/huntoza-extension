/**
 * Job Hunt Assist - Popup Script (Updated for state passing)
 *
 * This script controls the popup UI and manages communication with
 * the content script and background script.
 */

// DOM Elements
const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const jobDataForm = document.getElementById("job-data-form");
const refreshBtn = document.getElementById("refresh-btn");
const createBtn = document.getElementById("create-btn");
const connectionStatus = document.getElementById("connection-status");

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

// Initialize the popup
document.addEventListener("DOMContentLoaded", async () => {
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
});

// Extract job data from the current page
async function extractJobDataFromPage(tab) {
  try {
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
  // For development, we'll always show connected status
  connectionStatus.innerHTML = `
    <span class="h-2 w-2 rounded-full bg-green-500 mr-1"></span>
    Connected to Job Hunt Tracker (localhost)
  `;
}

// Event Listeners

// Refresh button - Fetch job data again
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

// Create application button - Open job form in the app with prefilled data
createBtn.addEventListener("click", async () => {
  const jobData = getJobDataFromForm();

  // Change button to loading state
  createBtn.innerHTML = `
    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Sending to Job Tracker...
  `;

  try {
    // Create application with current data
    createApplication(jobData);
  } catch (error) {
    console.error("Error sending job data:", error);

    // Reset button
    createBtn.innerHTML = "Send to Job Tracker";

    // Show error notification
    errorState.classList.remove("hidden");
    errorState.textContent = "Failed to send job data. Please try again.";
  }
});

// Create application in the job tracker app by redirecting to the job form page with state
function createApplication(jobData) {
  // Save job data to storage (to be accessed by the background script)
  chrome.storage.local.set({ pendingJobApplication: jobData });

  // Construct the URL for the job form
  const appUrl = "http://localhost:3000/jobs/new";

  // We're going to use a content script to inject our state
  chrome.tabs.create({ url: appUrl }, (tab) => {
    // Wait for the new tab to load, then inject the content script to handle state transfer
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === tab.id && info.status === "complete") {
        // Remove this listener
        chrome.tabs.onUpdated.removeListener(listener);

        // Execute script to inject the state
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: injectStateToReactApp,
          args: [jobData],
        });
      }
    });
  });
}

// This function will be executed in the context of the job form page to inject state
function injectStateToReactApp(jobData) {
  // Store job data in localStorage so React can access it
  localStorage.setItem("pendingJobData", JSON.stringify(jobData));

  // Dispatch a custom event to notify React the data is available
  window.dispatchEvent(
    new CustomEvent("jobDataAvailable", {
      detail: { source: "chromeExtension" },
    })
  );

  console.log("Job data stored in localStorage for React app");
}
