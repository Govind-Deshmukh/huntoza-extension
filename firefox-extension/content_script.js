/**
 * content_script.js - Content Script for PursuitPal
 *
 * This script is injected into web pages to extract job details
 * and communicate with the PursuitPal extension.
 */

console.log("PursuitPal content script loaded");

// Make extraction function available globally
window._pursuitPalExtractData = extractJobData;

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

// Notify page that extraction function is available
document.dispatchEvent(new CustomEvent("pursuitpal_extension_loaded"));

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

/**
 * Main function to extract job data from the current page
 */
function extractJobData() {
  console.log("Extraction function called");
  try {
    const url = window.location.href;
    console.log("Current URL:", url);

    // Detect which job platform we're on
    const platform = detectJobPlatform(url);
    console.log("Detected platform:", platform);

    let jobData = extractGenericJob();

    console.log("Extracted raw job data:", jobData);

    // Ensure all required fields are present with defaults
    const normalizedData = {
      company: jobData.company || "",
      position: jobData.position || "",
      jobLocation: jobData.jobLocation || "",
      jobType: jobData.jobType || "full-time",
      jobDescription: jobData.jobDescription || "",
      jobUrl: url,
      salary: {
        min: jobData.salary?.min || 0,
        max: jobData.salary?.max || 0,
        currency: jobData.salary?.currency || "INR",
      },
      applicationDate: new Date().toISOString().slice(0, 10),
      status: "saved", // Default status for newly extracted jobs
      priority: "medium",
      favorite: false,
      notes: "",
      source: platform,
      extractedWith: "pursuitpal-extension",
    };

    console.log("Normalized job data:", normalizedData);
    return normalizedData;
  } catch (error) {
    console.error("Error in extractJobData:", error);
    // Return empty data with basic URL info to avoid failure
    return {
      company: "",
      position: document.title || "Job Position",
      jobLocation: "",
      jobType: "full-time",
      jobDescription: "",
      jobUrl: window.location.href,
      salary: {
        min: 0,
        max: 0,
        currency: "INR",
      },
      applicationDate: new Date().toISOString().slice(0, 10),
      status: "saved",
      priority: "medium",
      favorite: false,
      notes: "Error extracting data: " + error.message,
      source: "unknown",
      extractedWith: "pursuitpal-extension",
    };
  }
}

/**
 * Detect which job platform we're on
 */
function detectJobPlatform(url) {
  if (url.includes("linkedin.com")) {
    return "linkedin";
  } else if (url.includes("indeed.com")) {
    return "indeed";
  } else if (url.includes("glassdoor.com")) {
    return "glassdoor";
  } else if (url.includes("naukri.com")) {
    return "naukri";
  } else if (url.includes("monster.com")) {
    return "monster";
  } else if (url.includes("ziprecruiter.com")) {
    return "ziprecruiter";
  }
  return "generic";
}

/**
 * Generic Job Extractor
 * Used when no specific platform extractor is available
 */
function extractGenericJob() {
  const jobData = {
    company: "",
    position: "",
    jobLocation: "",
    jobType: "",
    jobDescription: "",
    salary: { min: 0, max: 0, currency: "INR" },
  };

  // Job Title - try various common selectors
  const titleSelectors = [
    "h1.job-title",
    "h1.posting-title",
    "h1.title",
    ".job-title h1",
    ".job-title",
    ".posting-headline h2",
    "h1", // Last resort
  ];

  for (const selector of titleSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      jobData.position = element.textContent.trim();
      break;
    }
  }

  // Company Name
  const companySelectors = [
    ".company-name",
    ".employer-name",
    ".company",
    "[data-testid='company-name']",
    ".org-name",
  ];

  for (const selector of companySelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      jobData.company = element.textContent.trim();
      break;
    }
  }

  // If company not found in selectors, try meta tags
  if (!jobData.company) {
    const metaCompany = document.querySelector('meta[property="og:site_name"]');
    if (metaCompany) {
      jobData.company = metaCompany.getAttribute("content");
    }
  }

  // Location
  const locationSelectors = [
    ".job-location",
    ".location",
    "[data-testid='location']",
    ".company-location",
    ".posting-location",
  ];

  for (const selector of locationSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      jobData.jobLocation = element.textContent.trim();
      break;
    }
  }

  // Job Description
  const descriptionSelectors = [
    ".job-description",
    ".description",
    "[data-testid='job-description']",
    "#job-description",
    "#description",
    ".job-details",
    ".details",
    "#jobDescriptionText",
    ".content",
  ];

  for (const selector of descriptionSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      jobData.jobDescription = element.textContent.trim();
      break;
    }
  }

  // If description not found via selectors, look for largest text block in page
  if (!jobData.jobDescription) {
    let largestTextBlock = "";
    const contentDivs = document.querySelectorAll("div, section, article");

    for (const div of contentDivs) {
      const text = div.textContent.trim();
      if (text.length > largestTextBlock.length && text.length > 200) {
        largestTextBlock = text;
      }
    }

    if (largestTextBlock) {
      jobData.jobDescription = largestTextBlock;
    }
  }

  // Extract job type and salary from page text
  const pageText = document.body.textContent;

  // Job Type
  if (/full[- ]time|ft\b/i.test(pageText)) {
    jobData.jobType = "full-time";
  } else if (/part[- ]time|pt\b/i.test(pageText)) {
    jobData.jobType = "part-time";
  } else if (/\bcontract\b|\bcontractor\b/i.test(pageText)) {
    jobData.jobType = "contract";
  } else if (/\binternship\b|\bintern\b/i.test(pageText)) {
    jobData.jobType = "internship";
  } else if (/\bremote\b|\bwork from home\b|\bwfh\b/i.test(pageText)) {
    jobData.jobType = "remote";
  }

  // Salary - look for common salary patterns in the page text
  const salaryPattern =
    /(?:[$₹€£¥])\s*(\d[\d,.]+)(?:k)?(?:\s*-\s*|\s*to\s*)(?:[$₹€£¥])?\s*(\d[\d,.]+)(?:k)?/i;
  const salaryMatch = pageText.match(salaryPattern);

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

  return jobData;
}

/**
 * Inject job data into the PursuitPal form
 * Called when users want to auto-fill the job form
 */
function injectJobData(data) {
  // Check if we're on the PursuitPal job form page
  if (
    !window.location.href.includes("pursuitpal.app/jobs/new") &&
    !window.location.href.includes("pursuitpal.app/jobs/edit")
  ) {
    console.log("Not on PursuitPal job form page, cannot inject data");
    return false;
  }

  console.log("Attempting to inject job data into PursuitPal form", data);

  // Function to retry injection until the form is ready
  const attemptInjection = (retryCount = 0, maxRetries = 10) => {
    // If we've tried too many times, give up
    if (retryCount >= maxRetries) {
      console.error("Failed to inject job data after max retries");
      return false;
    }

    // Check if the form is loaded
    const formElements =
      document.querySelector("input[name='company']") ||
      document.querySelector("form") ||
      document.querySelector(".job-form");

    if (!formElements) {
      console.log(
        `Form not ready yet, retry ${retryCount + 1} of ${maxRetries}`
      );
      // Wait longer between retries as we go
      setTimeout(
        () => attemptInjection(retryCount + 1, maxRetries),
        500 * Math.pow(1.5, retryCount)
      ); // Exponential backoff
      return;
    }

    console.log("Form found, attempting to fill in data");

    // Wait a bit more to make sure React has fully initialized
    setTimeout(() => {
      try {
        // Basic job information
        fillInputField("company", data.company);
        fillInputField("position", data.position);
        fillInputField("jobLocation", data.jobLocation);
        fillSelectField("jobType", data.jobType);

        // Salary information
        fillInputField("salary.min", data.salary.min);
        fillInputField("salary.max", data.salary.max);
        fillSelectField("salary.currency", data.salary.currency);

        // Additional fields
        fillInputField("jobUrl", data.jobUrl);
        fillTextareaField("jobDescription", data.jobDescription);
        fillSelectField("priority", data.priority);
        fillCheckboxField("favorite", data.favorite);

        // Set application date if provided
        if (data.applicationDate) {
          fillInputField("applicationDate", data.applicationDate);
        }

        // Add notes if provided
        if (data.notes) {
          fillTextareaField("notes", data.notes);
        }

        console.log("Form auto-filled successfully");

        // Notify user that form has been filled
        showNotification("Form auto-filled successfully!");

        return true;
      } catch (error) {
        console.error("Error filling form:", error);
        showNotification("Error filling form: " + error.message, "error");
        return false;
      }
    }, 500);
  };

  // Start the injection process
  attemptInjection();
  return true;
}

// Helper: Fill input field
function fillInputField(name, value) {
  if (value === undefined || value === null) return;

  const field = document.querySelector(`input[name="${name}"]`);
  if (field) {
    field.value = value;
    triggerInputEvent(field);
    console.log(`Filled input field ${name} with value ${value}`);
  } else {
    console.warn(`Could not find input field ${name}`);
  }
}

// Helper: Fill textarea field
function fillTextareaField(name, value) {
  if (value === undefined || value === null) return;

  const field = document.querySelector(`textarea[name="${name}"]`);
  if (field) {
    field.value = value;
    triggerInputEvent(field);
    console.log(`Filled textarea field ${name}`);
  } else {
    console.warn(`Could not find textarea field ${name}`);
  }
}

// Helper: Fill select field
function fillSelectField(name, value) {
  if (value === undefined || value === null) return;

  const field = document.querySelector(`select[name="${name}"]`);
  if (field) {
    field.value = value;
    triggerInputEvent(field);
    console.log(`Filled select field ${name} with value ${value}`);
  } else {
    console.warn(`Could not find select field ${name}`);
  }
}

// Helper: Fill checkbox field
function fillCheckboxField(name, checked) {
  const field = document.querySelector(
    `input[name="${name}"][type="checkbox"]`
  );
  if (field) {
    field.checked = checked;
    triggerInputEvent(field);
    console.log(`Set checkbox field ${name} to ${checked}`);
  } else {
    console.warn(`Could not find checkbox field ${name}`);
  }
}

// Helper: Trigger input event to notify React of value change
function triggerInputEvent(element) {
  // Create and dispatch input event
  const inputEvent = new Event("input", { bubbles: true });
  element.dispatchEvent(inputEvent);

  // Create and dispatch change event
  const changeEvent = new Event("change", { bubbles: true });
  element.dispatchEvent(changeEvent);

  // For React controlled inputs, we need to manually set the value property
  // and then trigger the events
  const oldValue = element.value;

  // Try to access the React internal properties (this is hacky but often works)
  if (element._valueTracker) {
    element._valueTracker.setValue("");
  }

  // Reset the value and dispatch events
  if (element.type === "checkbox" || element.type === "radio") {
    const mouseEvent = new MouseEvent("click", { bubbles: true });
    element.dispatchEvent(mouseEvent);
  } else {
    element.value = oldValue;
    element.dispatchEvent(inputEvent);
    element.dispatchEvent(changeEvent);
  }
}

// Helper: Show notification message
function showNotification(message, type = "success") {
  // Primary color from PursuitPal
  const primaryColor = "#552dec";
  const errorColor = "#ef4444";
  const bgColor = type === "success" ? primaryColor : errorColor;

  // Create notification element
  const notification = document.createElement("div");

  // Style the notification
  notification.style.position = "fixed";
  notification.style.top = "20px";
  notification.style.left = "50%";
  notification.style.transform = "translateX(-50%)";
  notification.style.backgroundColor = bgColor;
  notification.style.color = "white";
  notification.style.padding = "12px 24px";
  notification.style.borderRadius = "8px";
  notification.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
  notification.style.zIndex = "10000";
  notification.style.fontFamily = "system-ui, -apple-system, sans-serif";
  notification.style.fontSize = "14px";
  notification.style.transition = "opacity 0.3s";

  // Add content
  notification.textContent = message;

  // Add to the page
  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.opacity = "0";
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Check for pending job data on form page
if (window.location.href.includes("pursuitpal.app/jobs/new")) {
  function checkForExtensionData() {
    try {
      const pendingJobData = localStorage.getItem("pendingJobData");
      if (pendingJobData) {
        console.log("Found job data in localStorage");

        // Parse data to make sure it's valid
        JSON.parse(pendingJobData);

        // Notify application
        window.dispatchEvent(
          new CustomEvent("jobDataAvailable", {
            detail: { source: "chromeExtension" },
          })
        );

        return true;
      }
      return false;
    } catch (error) {
      console.error("Error checking for extension data:", error);
      return false;
    }
  }

  // Run checks at different times to ensure we catch the data
  setTimeout(checkForExtensionData, 500);
  setTimeout(checkForExtensionData, 1000);
  setTimeout(checkForExtensionData, 2000);
}
