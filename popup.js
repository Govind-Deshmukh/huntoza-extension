/**
 * PursuitPal - Popup Script
 *
 * Handles the popup UI and user interactions:
 * - Displays extracted job and contact data
 * - Manages tab switching
 * - Handles data extraction and sending to PursuitPal app
 */

// DOM Elements - Main UI
const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const settingsBtn = document.getElementById("settings-btn");

// DOM Elements - Tabs
const jobsTab = document.getElementById("jobs-tab");
const contactsTab = document.getElementById("contacts-tab");
const jobTabContent = document.getElementById("job-tab-content");
const contactsTabContent = document.getElementById("contacts-tab-content");

// DOM Elements - Job Data
const noJobData = document.getElementById("no-job-data");
const jobDataPreview = document.getElementById("job-data-preview");
const extractJobBtn = document.getElementById("extract-job-btn");
const refreshJobBtn = document.getElementById("refresh-job-btn");
const sendJobBtn = document.getElementById("send-job-btn");

// DOM Elements - Job Data Fields
const jobPosition = document.getElementById("job-position");
const jobCompany = document.getElementById("job-company");
const jobLocation = document.getElementById("job-location");
const jobType = document.getElementById("job-type");
const jobSalary = document.getElementById("job-salary");
const jobDescription = document.getElementById("job-description");
const jobUrl = document.getElementById("job-url");

// DOM Elements - Contact Data
const noContactData = document.getElementById("no-contact-data");
const contactDataPreview = document.getElementById("contact-data-preview");
const extractContactBtn = document.getElementById("extract-contact-btn");
const refreshContactBtn = document.getElementById("refresh-contact-btn");
const sendContactBtn = document.getElementById("send-contact-btn");

// DOM Elements - Contact Data Fields
const contactInitials = document.getElementById("contact-initials");
const contactName = document.getElementById("contact-name");
const contactPosition = document.getElementById("contact-position");
const contactCompany = document.getElementById("contact-company");
const contactEmail = document.getElementById("contact-email");
const contactPhone = document.getElementById("contact-phone");
const contactLocation = document.getElementById("contact-location");
const contactConnections = document.getElementById("contact-connections");
const contactAbout = document.getElementById("contact-about");
const contactUrl = document.getElementById("contact-url");

// Current data
let currentJobData = null;
let currentContactData = null;

// Initialize the popup
document.addEventListener("DOMContentLoaded", async () => {
  // Setup tab switching
  setupTabs();

  // Setup button listeners
  setupButtonListeners();

  // Load and display data
  await loadData();
});

// Setup tab switching
function setupTabs() {
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
}

// Setup button event listeners
function setupButtonListeners() {
  // Settings button - Open options page
  settingsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // Extract job data button
  extractJobBtn.addEventListener("click", async () => {
    showLoadingState();
    try {
      await extractData("job");
    } catch (error) {
      console.error("Error extracting job data:", error);
      showErrorState();
    }
  });

  // Refresh job data button
  refreshJobBtn.addEventListener("click", async () => {
    showLoadingState();
    try {
      await extractData("job");
    } catch (error) {
      console.error("Error refreshing job data:", error);
      showErrorState();
    }
  });

  // Send job data button
  sendJobBtn.addEventListener("click", async () => {
    if (!currentJobData) return;

    // Disable button to prevent multiple clicks
    sendJobBtn.disabled = true;
    sendJobBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Sending...
    `;

    try {
      // Send message to background script
      chrome.runtime.sendMessage(
        {
          action: "sendToPursuitPal",
          dataType: "job",
          data: currentJobData,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error sending job data:", chrome.runtime.lastError);
            // Reset button
            sendJobBtn.disabled = false;
            sendJobBtn.textContent = "Send to PursuitPal";
            return;
          }

          if (response && response.success) {
            // Close popup after successful send
            window.close();
          } else {
            console.error("Failed to send job data:", response?.error);
            // Reset button
            sendJobBtn.disabled = false;
            sendJobBtn.textContent = "Send to PursuitPal";
          }
        }
      );
    } catch (error) {
      console.error("Error sending job data:", error);
      // Reset button
      sendJobBtn.disabled = false;
      sendJobBtn.textContent = "Send to PursuitPal";
    }
  });

  // Extract contact data button
  extractContactBtn.addEventListener("click", async () => {
    showLoadingState();
    try {
      await extractData("contact");
    } catch (error) {
      console.error("Error extracting contact data:", error);
      showErrorState();
    }
  });

  // Refresh contact data button
  refreshContactBtn.addEventListener("click", async () => {
    showLoadingState();
    try {
      await extractData("contact");
    } catch (error) {
      console.error("Error refreshing contact data:", error);
      showErrorState();
    }
  });

  // Send contact data button
  sendContactBtn.addEventListener("click", async () => {
    if (!currentContactData) return;

    // Disable button to prevent multiple clicks
    sendContactBtn.disabled = true;
    sendContactBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Sending...
    `;

    try {
      // Send message to background script
      chrome.runtime.sendMessage(
        {
          action: "sendToPursuitPal",
          dataType: "contact",
          data: currentContactData,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error sending contact data:",
              chrome.runtime.lastError
            );
            // Reset button
            sendContactBtn.disabled = false;
            sendContactBtn.textContent = "Send to PursuitPal";
            return;
          }

          if (response && response.success) {
            // Close popup after successful send
            window.close();
          } else {
            console.error("Failed to send contact data:", response?.error);
            // Reset button
            sendContactBtn.disabled = false;
            sendContactBtn.textContent = "Send to PursuitPal";
          }
        }
      );
    } catch (error) {
      console.error("Error sending contact data:", error);
      // Reset button
      sendContactBtn.disabled = false;
      sendContactBtn.textContent = "Send to PursuitPal";
    }
  });
}

// Load and display data
async function loadData() {
  try {
    // Load job data
    chrome.runtime.sendMessage({ action: "getJobData" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error loading job data:", chrome.runtime.lastError);
        return;
      }

      if (response && response.data) {
        currentJobData = response.data;
        updateJobUI(currentJobData);
      } else {
        showNoJobData();
      }
    });

    // Load contact data
    chrome.runtime.sendMessage({ action: "getContactData" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error loading contact data:", chrome.runtime.lastError);
        return;
      }

      if (response && response.data) {
        currentContactData = response.data;
        updateContactUI(currentContactData);
      } else {
        showNoContactData();
      }
    });
  } catch (error) {
    console.error("Error loading data:", error);
    showErrorState();
  }
}

// Extract data from current page
async function extractData(type) {
  try {
    // Send message to background script to extract data
    chrome.runtime.sendMessage(
      {
        action: "extractFromCurrentTab",
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error extracting data:", chrome.runtime.lastError);
          showErrorState();
          return;
        }

        if (response && response.success && response.data) {
          if (type === "job" && response.data.company) {
            // Job data
            currentJobData = response.data;
            updateJobUI(currentJobData);
            hideLoadingState();
          } else if (type === "contact" && response.data.name) {
            // Contact data
            currentContactData = response.data;
            updateContactUI(currentContactData);
            hideLoadingState();
          } else {
            // Wrong data type or incomplete data
            showErrorState();
          }
        } else {
          // No data extracted
          showErrorState();
        }
      }
    );
  } catch (error) {
    console.error("Error extracting data:", error);
    throw error;
  }
}

// Update job UI with data
function updateJobUI(jobData) {
  // Set text content for all job data fields
  jobPosition.textContent = jobData.position || "Untitled Position";
  jobCompany.textContent = jobData.company || "Unknown Company";
  jobLocation.textContent = jobData.jobLocation || "Location not specified";
  jobType.textContent = formatJobType(jobData.jobType) || "Not specified";

  // Format salary if available
  if (jobData.salary && (jobData.salary.min > 0 || jobData.salary.max > 0)) {
    const currency = getCurrencySymbol(jobData.salary.currency);

    if (jobData.salary.min > 0 && jobData.salary.max > 0) {
      jobSalary.textContent = `${currency}${formatNumber(
        jobData.salary.min
      )} - ${currency}${formatNumber(jobData.salary.max)}`;
    } else if (jobData.salary.min > 0) {
      jobSalary.textContent = `${currency}${formatNumber(jobData.salary.min)}+`;
    } else if (jobData.salary.max > 0) {
      jobSalary.textContent = `Up to ${currency}${formatNumber(
        jobData.salary.max
      )}`;
    }
  } else {
    jobSalary.textContent = "Not specified";
  }

  // Truncate description for preview
  const descriptionPreview = jobData.jobDescription
    ? truncateText(jobData.jobDescription, 300)
    : "No description available";
  jobDescription.textContent = descriptionPreview;

  // Set URL link
  if (jobData.jobUrl) {
    jobUrl.textContent = formatUrl(jobData.jobUrl);
    jobUrl.href = jobData.jobUrl;
  } else {
    jobUrl.textContent = "No URL available";
    jobUrl.href = "#";
  }

  // Show job data preview
  showJobData();
}

// Update contact UI with data
function updateContactUI(contactData) {
  // Set contact initials
  contactInitials.textContent = getInitials(contactData.name);

  // Set text content for all contact data fields
  contactName.textContent = contactData.name || "Unknown Name";
  contactPosition.textContent = contactData.position || "Position unknown";
  contactCompany.textContent = contactData.company || "Company unknown";
  contactEmail.textContent = contactData.email || "Not available";
  contactPhone.textContent = contactData.phone || "Not available";
  contactLocation.textContent = contactData.location || "Location unknown";
  contactConnections.textContent = contactData.connections || "Not available";

  // Truncate about text for preview
  const aboutPreview = contactData.about
    ? truncateText(contactData.about, 150)
    : "No information available";
  contactAbout.textContent = aboutPreview;

  // Set URL link
  if (contactData.profileUrl) {
    contactUrl.textContent = formatUrl(contactData.profileUrl);
    contactUrl.href = contactData.profileUrl;
  } else {
    contactUrl.textContent = "No URL available";
    contactUrl.href = "#";
  }

  // Show contact data preview
  showContactData();
}

// Show job data view
function showJobData() {
  noJobData.classList.add("hidden");
  jobDataPreview.classList.remove("hidden");
  hideLoadingState();
}

// Show contact data view
function showContactData() {
  noContactData.classList.add("hidden");
  contactDataPreview.classList.remove("hidden");
  hideLoadingState();
}

// Show no job data state
function showNoJobData() {
  noJobData.classList.remove("hidden");
  jobDataPreview.classList.add("hidden");
}

// Show no contact data state
function showNoContactData() {
  noContactData.classList.remove("hidden");
  contactDataPreview.classList.add("hidden");
}

// Show loading state
function showLoadingState() {
  loadingState.classList.remove("hidden");
  errorState.classList.add("hidden");
}

// Hide loading state
function hideLoadingState() {
  loadingState.classList.add("hidden");
}

// Show error state
function showErrorState() {
  loadingState.classList.add("hidden");
  errorState.classList.remove("hidden");

  // Hide after 3 seconds
  setTimeout(() => {
    errorState.classList.add("hidden");
  }, 3000);
}

// Helper: Format job type for display
function formatJobType(type) {
  if (!type) return "";

  // Capitalize and format job type
  const formatted = type
    .replace(/-/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
  return formatted;
}

// Helper: Format currency symbol
function getCurrencySymbol(currency) {
  switch (currency) {
    case "USD":
      return "$";
    case "INR":
      return "₹";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "JPY":
      return "¥";
    default:
      return "$";
  }
}

// Helper: Format number with commas
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Helper: Truncate text and add ellipsis
function truncateText(text, maxLength) {
  if (!text) return "";
  if (text.length <= maxLength) return text;

  return text.substring(0, maxLength) + "...";
}

// Helper: Format URL for display
function formatUrl(url) {
  try {
    const urlObj = new URL(url);
    let displayUrl = urlObj.hostname;

    // Add path but truncate if too long
    if (urlObj.pathname && urlObj.pathname !== "/") {
      const pathname =
        urlObj.pathname.length > 20
          ? urlObj.pathname.substring(0, 20) + "..."
          : urlObj.pathname;
      displayUrl += pathname;
    }

    return displayUrl;
  } catch (e) {
    return url;
  }
}

// Helper: Get initials from name
function getInitials(name) {
  if (!name) return "?";

  const parts = name.split(" ");
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
