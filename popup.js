/**
 * Job Hunt Assist - Popup Script
 *
 * This script controls the popup UI and manages communication with
 * the content script and background script.
 */

// DOM Elements
const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const jobDataForm = document.getElementById("job-data-form");
const refreshBtn = document.getElementById("refresh-btn");
const settingsBtn = document.getElementById("settings-btn");
const copyBtn = document.getElementById("copy-btn");
const createBtn = document.getElementById("create-btn");
const enhanceWithAI = document.getElementById("enhanceWithAI");
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
  // For now, we'll just fake a successful connection
  // In a real implementation, you would make an API call to your backend
  // to verify that the user is authenticated

  // Simulating a successful connection
  connectionStatus.innerHTML = `
    <span class="h-2 w-2 rounded-full bg-green-500 mr-1"></span>
    Connected to Job Hunt Tracker
  `;

  // You could implement real connection checking here:
  /*
  fetch('https://your-job-tracker-app.com/api/auth/check', {
    method: 'GET',
    credentials: 'include'
  })
  .then(response => {
    if (response.ok) {
      // User is authenticated
      connectionStatus.innerHTML = `
        <span class="h-2 w-2 rounded-full bg-green-500 mr-1"></span>
        Connected to Job Hunt Tracker
      `;
    } else {
      // User is not authenticated
      connectionStatus.innerHTML = `
        <span class="h-2 w-2 rounded-full bg-red-500 mr-1"></span>
        Not connected - <a href="https://your-job-tracker-app.com/login" target="_blank" class="text-blue-600 hover:underline">Login</a>
      `;
    }
  })
  .catch(error => {
    // Connection error
    connectionStatus.innerHTML = `
      <span class="h-2 w-2 rounded-full bg-red-500 mr-1"></span>
      Connection error - Check your network
    `;
  });
  */
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

// Settings button - Open settings page
settingsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// Copy button - Copy job data to clipboard
copyBtn.addEventListener("click", () => {
  const jobData = getJobDataFromForm();

  // Format the data for clipboard
  const textToCopy = `
    Company: ${jobData.company}
    Position: ${jobData.position}
    Location: ${jobData.jobLocation}
    Job Type: ${jobData.jobType}
    Salary: ${jobData.salary.min}-${jobData.salary.max} ${jobData.salary.currency}
    URL: ${jobData.jobUrl}
  `.trim();

  // Copy to clipboard
  navigator.clipboard
    .writeText(textToCopy)
    .then(() => {
      // Show success message
      copyBtn.innerText = "Copied!";
      setTimeout(() => {
        copyBtn.innerText = "Copy Details";
      }, 2000);
    })
    .catch((err) => {
      console.error("Failed to copy: ", err);
    });
});

// Create application button - Open job form in the app with prefilled data
createBtn.addEventListener("click", async () => {
  const jobData = getJobDataFromForm();

  // If AI enhancement is requested
  if (enhanceWithAI.checked) {
    // Show loading state
    createBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Enhancing with AI...
    `;

    try {
      // Send job data to background script for AI enhancement
      chrome.runtime.sendMessage(
        { action: "enhanceWithAI", data: jobData },
        (enhancedData) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error enhancing job data:",
              chrome.runtime.lastError
            );
            createApplication(jobData);
          } else {
            createApplication(enhancedData || jobData);
          }
        }
      );
    } catch (error) {
      console.error("Error enhancing job data:", error);
      createApplication(jobData);
    }
  } else {
    // Create application with current data
    createApplication(jobData);
  }
});

// Create application in the job tracker app
function createApplication(jobData) {
  // Save job data to storage (to be accessed by background script)
  chrome.storage.local.set({ pendingJobApplication: jobData });

  // Construct the URL with query parameters for the job form
  const appUrl = new URL("https://your-job-tracker-app.com/jobs/new");

  // Add job data as query parameters
  appUrl.searchParams.append("company", jobData.company);
  appUrl.searchParams.append("position", jobData.position);
  appUrl.searchParams.append("jobLocation", jobData.jobLocation);
  appUrl.searchParams.append("jobType", jobData.jobType);
  appUrl.searchParams.append("salaryMin", jobData.salary.min);
  appUrl.searchParams.append("salaryMax", jobData.salary.max);
  appUrl.searchParams.append("salaryCurrency", jobData.salary.currency);
  appUrl.searchParams.append("jobUrl", jobData.jobUrl);

  // Open the job form in a new tab
  chrome.tabs.create({ url: appUrl.toString() });
}

// Listen for form input changes to update stored job data
document.querySelectorAll("input, select").forEach((element) => {
  element.addEventListener("change", () => {
    // Update stored job data with form values
    const updatedJobData = getJobDataFromForm();
    chrome.storage.local.set({ jobData: updatedJobData });
  });
});
