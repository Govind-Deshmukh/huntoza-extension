/**
 * PursuitPal - Popup Script
 *
 * Handles the extension popup UI and user interactions:
 * - User authentication
 * - Job data extraction
 * - Saving data to PursuitPal app
 */

// DOM Elements - Views
const loginView = document.getElementById("loginView");
const mainView = document.getElementById("mainView");

// DOM Elements - Login
const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginLoading = document.getElementById("loginLoading");
const loginError = document.getElementById("loginError");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

// DOM Elements - Main View
const userProfileToggle = document.getElementById("userProfileToggle");
const userInitials = document.getElementById("userInitials");
const logoutButton = document.getElementById("logoutButton");

// DOM Elements - Extraction Section
const extractionSection = document.getElementById("extractionSection");
const notJobPageView = document.getElementById("notJobPageView");
const loadingView = document.getElementById("loadingView");
const errorView = document.getElementById("errorView");
const jobDataView = document.getElementById("jobDataView");
const errorMessage = document.getElementById("errorMessage");
const retryButton = document.getElementById("retryButton");

// DOM Elements - Job Data
const jobTitle = document.getElementById("jobTitle");
const companyName = document.getElementById("companyName");
const jobLocation = document.getElementById("jobLocation");
const jobType = document.getElementById("jobType");
const jobSalary = document.getElementById("jobSalary");
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
  }
});

// Set up event listeners
function setupEventListeners() {
  // Login form submission
  loginForm.addEventListener("submit", handleLogin);

  // Logout button
  logoutButton.addEventListener("click", handleLogout);

  // Retry button
  retryButton.addEventListener("click", handleRetry);

  // Refresh job data button
  refreshJobButton.addEventListener("click", handleRefreshJobData);

  // Save job button
  saveJobButton.addEventListener("click", handleSaveJob);
}

// Check authentication status
async function checkAuth() {
  // Show loading state
  setLoginLoading(true);

  try {
    // Check auth status with background script
    const response = await sendMessage({ action: "checkAuth" });

    if (response && response.isAuthenticated && response.user) {
      // User is authenticated
      currentUser = response.user;
      showAuthenticatedUI(response.user);
    } else {
      // User is not authenticated
      showLoginUI();
    }
  } catch (error) {
    console.error("Auth check error:", error);
    showLoginUI();
  }
}

// Handle login form submission
async function handleLogin(e) {
  e.preventDefault();

  // Reset error message
  setLoginError();

  // Show loading state
  setLoginLoading(true);

  // Get credentials
  const credentials = {
    email: emailInput.value.trim(),
    password: passwordInput.value,
  };

  // Validate input
  if (!credentials.email || !credentials.password) {
    setLoginError("Please enter both email and password");
    setLoginLoading(false);
    return;
  }

  try {
    // Send login request to background script
    const response = await sendMessage({
      action: "login",
      credentials: credentials,
    });

    console.log("Login response:", response);

    if (response && response.success && response.user) {
      // Login successful
      currentUser = response.user;
      showAuthenticatedUI(response.user);

      // Check if current page is a job posting
      await checkCurrentPage();
    } else {
      // Login failed
      setLoginError(
        (response && response.error) ||
          "Login failed. Please check your credentials."
      );
      setLoginLoading(false);
    }
  } catch (error) {
    console.error("Login error:", error);
    setLoginError("An error occurred. Please try again.");
    setLoginLoading(false);
  }
}

// Handle logout button click
async function handleLogout() {
  try {
    // Send logout request to background script
    await sendMessage({ action: "logout" });

    // Reset state
    currentUser = null;
    currentJobData = null;

    // Show login UI
    showLoginUI();
  } catch (error) {
    console.error("Logout error:", error);
  }
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
    if (isJobPostingURL(tab.url)) {
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
    console.log("Extract response:", response);

    if (response && response.success && response.data) {
      console.log("Job data extracted successfully:", response.data);
      // Job data extracted successfully
      currentJobData = response.data;

      // Save job data
      await sendMessage({
        action: "saveJobData",
        data: currentJobData,
      });

      // Update job data view
      updateJobDataView(currentJobData);

      // Show job data view
      showView("jobDataView");
    } else {
      // Error extracting job data
      console.error("Extract job data error details:", response);
      setErrorMessage(
        (response && response.error) ||
          "Failed to extract job data from this page"
      );
      showView("errorView");
    }
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

// Helper: Format job type for display
function formatJobType(type) {
  if (!type) return "Not specified";

  // Replace hyphens with spaces and capitalize words
  return type.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

// Helper: Format salary for display
function formatSalary(salary) {
  if (!salary || (!salary.min && !salary.max)) {
    return "Not specified";
  }

  const currency = getCurrencySymbol(salary.currency);

  if (salary.min > 0 && salary.max > 0) {
    return `${currency}${formatNumber(salary.min)} - ${currency}${formatNumber(
      salary.max
    )}`;
  } else if (salary.min > 0) {
    return `${currency}${formatNumber(salary.min)}+`;
  } else if (salary.max > 0) {
    return `Up to ${currency}${formatNumber(salary.max)}`;
  }

  return "Not specified";
}

// Helper: Format number with commas
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Helper: Get currency symbol
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

// Show authenticated UI
function showAuthenticatedUI(user) {
  // Hide login view
  loginView.classList.add("hidden");

  // Show main view
  mainView.classList.remove("hidden");

  // Update user profile
  userProfileToggle.classList.remove("hidden");

  // Set user initials (handle email or name)
  const initials = getInitials(user.name || user.email || "User");
  userInitials.textContent = initials;
}

// Show login UI
function showLoginUI() {
  // Hide main view
  mainView.classList.add("hidden");

  // Show login view
  loginView.classList.remove("hidden");

  // Reset login form
  loginForm.reset();

  // Hide loading state
  setLoginLoading(false);
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

// Set login loading state
function setLoginLoading(isLoading) {
  if (isLoading) {
    loginButton.classList.add("opacity-75");
    loginButton.disabled = true;
    loginLoading.classList.remove("hidden");
  } else {
    loginButton.classList.remove("opacity-75");
    loginButton.disabled = false;
    loginLoading.classList.add("hidden");
  }
}

// Set login error message
function setLoginError(message = "") {
  if (message) {
    loginError.textContent = message;
    loginError.classList.remove("hidden");
  } else {
    loginError.textContent = "";
    loginError.classList.add("hidden");
  }
}

// Set error message
function setErrorMessage(message = "") {
  errorMessage.textContent = message;
}

// Helper: Get user initials from name or email
function getInitials(str) {
  if (!str) return "--";

  // If email, use first character
  if (str.includes("@")) {
    return str.charAt(0).toUpperCase();
  }

  // If name, use first character of first and last name
  const parts = str.split(" ");
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Check if URL is a job posting
function isJobPostingURL(url) {
  if (!url) return false;

  const jobPostingPatterns = [
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

  return jobPostingPatterns.some((pattern) => pattern.test(url));
}

// Send message to background script
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      browser.runtime.sendMessage(message).then(
        (response) => {
          console.log("Message response:", response);
          resolve(response || {});
        },
        (error) => {
          console.error("Send message error:", error);
          reject(error);
        }
      );
    } catch (error) {
      console.error("Send message exception:", error);
      reject(error);
    }
  });
}

// Extract Indeed Jobs
function extractIndeedJob() {
  const jobData = {
    company: "",
    position: "",
    jobLocation: "",
    jobType: "",
    jobDescription: "",
    salary: { min: 0, max: 0, currency: "INR" },
  };

  // Job Title
  const titleElement = document.querySelector(".jobsearch-JobInfoHeader-title");
  if (titleElement) {
    jobData.position = titleElement.textContent.trim();
  }

  // Company Name
  const companyElement =
    document.querySelector('[data-company-name="true"]') ||
    document.querySelector(".jobsearch-InlineCompanyRating-companyHeader") ||
    document.querySelector(".jobsearch-InlineCompanyRating div");
  if (companyElement) {
    jobData.company = companyElement.textContent.trim();
  }

  // Location
  const locationElement =
    document.querySelector('[data-testid="job-location"]') ||
    document.querySelector(
      ".jobsearch-JobInfoHeader-subtitle .jobsearch-JobInfoHeader-locationText"
    );
  if (locationElement) {
    jobData.jobLocation = locationElement.textContent.trim();
  }

  // Job Description
  const descriptionElement = document.getElementById("jobDescriptionText");
  if (descriptionElement) {
    jobData.jobDescription = descriptionElement.textContent.trim();
  }

  // Job Type
  const jobTypeElements = document.querySelectorAll(
    '[data-testid="attribute_snippet_testid"]'
  );
  for (const element of jobTypeElements) {
    const text = element.textContent.toLowerCase().trim();
    if (text.includes("full-time")) {
      jobData.jobType = "full-time";
      break;
    } else if (text.includes("part-time")) {
      jobData.jobType = "part-time";
      break;
    } else if (text.includes("contract")) {
      jobData.jobType = "contract";
      break;
    } else if (text.includes("internship")) {
      jobData.jobType = "internship";
      break;
    } else if (text.includes("remote")) {
      jobData.jobType = "remote";
      break;
    }
  }

  // Salary
  const salaryElements = document.querySelectorAll(
    '[data-testid="attribute_snippet_testid"]'
  );
  for (const element of salaryElements) {
    const text = element.textContent.trim();
    // Look for salary patterns like "$50,000 - $70,000 a year"
    if (text.includes("$") || text.includes("₹")) {
      const salaryMatch = text.match(
        /(?:[$₹€£¥])\s*(\d[\d,.]+)(?:k)?(?:\s*-\s*|\s*to\s*)(?:[$₹€£¥])?\s*(\d[\d,.]+)(?:k)?/i
      );

      if (salaryMatch && salaryMatch[1] && salaryMatch[2]) {
        let min = parseFloat(salaryMatch[1].replace(/[,]/g, ""));
        let max = parseFloat(salaryMatch[2].replace(/[,]/g, ""));

        if (text.toLowerCase().includes("k")) {
          min *= 1000;
          max *= 1000;
        }

        let currency = "INR";
        if (text.includes("$")) {
          currency = "USD";
        } else if (text.includes("₹")) {
          currency = "INR";
        } else if (text.includes("€")) {
          currency = "EUR";
        } else if (text.includes("£")) {
          currency = "GBP";
        }

        jobData.salary = { min, max, currency };
        break;
      }
    }
  }

  return jobData;
}

// Extract Glassdoor Jobs
function extractGlassdoorJob() {
  const jobData = {
    company: "",
    position: "",
    jobLocation: "",
    jobType: "",
    jobDescription: "",
    salary: { min: 0, max: 0, currency: "INR" },
  };

  // Job Title
  const titleElement =
    document.querySelector(".job-title-header") ||
    document.querySelector("h1[data-test='job-title']");
  if (titleElement) {
    jobData.position = titleElement.textContent.trim();
  }

  // Company Name
  const companyElement = document.querySelector(".employer-name");
  if (companyElement) {
    jobData.company = companyElement.textContent.trim();
  }

  // Location
  const locationElement = document.querySelector(".location");
  if (locationElement) {
    jobData.jobLocation = locationElement.textContent.trim();
  }

  // Job Description
  const descriptionElement = document.getElementById("JobDescriptionContainer");
  if (descriptionElement) {
    jobData.jobDescription = descriptionElement.textContent.trim();
  }

  // Extract job type and salary from description
  if (jobData.jobDescription) {
    // Job Type extraction
    if (/full[- ]time|ft\b/i.test(jobData.jobDescription)) {
      jobData.jobType = "full-time";
    } else if (/part[- ]time|pt\b/i.test(jobData.jobDescription)) {
      jobData.jobType = "part-time";
    } else if (/\bcontract\b|\bcontractor\b/i.test(jobData.jobDescription)) {
      jobData.jobType = "contract";
    } else if (/\binternship\b|\bintern\b/i.test(jobData.jobDescription)) {
      jobData.jobType = "internship";
    } else if (
      /\bremote\b|\bwork from home\b|\bwfh\b/i.test(jobData.jobDescription)
    ) {
      jobData.jobType = "remote";
    }

    // Salary extraction
    const salaryMatch = jobData.jobDescription.match(
      /(?:[$₹€£¥])\s*(\d[\d,.]+)(?:k)?(?:\s*-\s*|\s*to\s*)(?:[$₹€£¥])?\s*(\d[\d,.]+)(?:k)?/i
    );

    if (salaryMatch && salaryMatch[1] && salaryMatch[2]) {
      let min = parseFloat(salaryMatch[1].replace(/[,]/g, ""));
      let max = parseFloat(salaryMatch[2].replace(/[,]/g, ""));

      if (salaryMatch[0].toLowerCase().includes("k")) {
        min *= 1000;
        max *= 1000;
      }

      let currency = "INR";
      if (salaryMatch[0].includes("$")) {
        currency = "USD";
      } else if (salaryMatch[0].includes("₹")) {
        currency = "INR";
      } else if (salaryMatch[0].includes("€")) {
        currency = "EUR";
      } else if (salaryMatch[0].includes("£")) {
        currency = "GBP";
      }

      jobData.salary = { min, max, currency };
    }
  }

  return jobData;
}

// Extract Naukri Jobs
function extractNaukriJob() {
  const jobData = {
    company: "",
    position: "",
    jobLocation: "",
    jobType: "",
    jobDescription: "",
    salary: { min: 0, max: 0, currency: "INR" },
  };

  // Job Title
  const titleElement =
    document.querySelector(".jd-header-title") ||
    document.querySelector(".jobTitle");
  if (titleElement) {
    jobData.position = titleElement.textContent.trim();
  }

  // Company Name
  const companyElement =
    document.querySelector(".jd-header-comp-name") ||
    document.querySelector(".comp-name");
  if (companyElement) {
    jobData.company = companyElement.textContent.trim();
  }

  // Location
  const locationElement =
    document.querySelector(".jd-location") || document.querySelector(".loc");
  if (locationElement) {
    jobData.jobLocation = locationElement.textContent.trim();
  }

  // Job Description
  const descriptionElement =
    document.querySelector(".jd-desc") || document.querySelector(".job-desc");
  if (descriptionElement) {
    jobData.jobDescription = descriptionElement.textContent.trim();
  }

  // Salary
  const salaryElement =
    document.querySelector(".salary-wrap") ||
    document.querySelector(".sal-wrap") ||
    document.querySelector(".salary-estimate-text");

  if (salaryElement) {
    const salaryText = salaryElement.textContent.trim();
    // Naukri usually shows salary like "₹ 8-12 Lacs PA" or "₹ 8-12 LPA"
    const salaryMatch = salaryText.match(
      /(\d+)(?:\s*-\s*|\s*to\s*)(\d+)(?:\s*lacs|\s*lpa)/i
    );

    if (salaryMatch && salaryMatch[1] && salaryMatch[2]) {
      const min = parseFloat(salaryMatch[1]) * 100000; // Convert lacs to INR
      const max = parseFloat(salaryMatch[2]) * 100000;
      jobData.salary = { min, max, currency: "INR" };
    }
  }

  return jobData;
}
