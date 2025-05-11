/**
 * PursuitPal - Content Script
 *
 * This script is injected into web pages to extract job posting data
 * and facilitate communication with the PursuitPal extension.
 */

console.log("PursuitPal content script loaded");

// Set up message listener for the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "extractJobData") {
    const jobData = extractJobData();
    sendResponse(jobData);
  } else if (message.action === "injectJobData") {
    injectJobData(message.data);
    sendResponse({ success: true });
  }
  return true; // Keep channel open for async response
});

// Make extraction function available globally
window._pursuitPalExtractData = extractJobData;

/**
 * Main function to extract job data from the current page
 */
function extractJobData() {
  const url = window.location.href;

  // Detect which job platform we're on
  const platform = detectJobPlatform(url);

  let jobData;

  // Use platform specific extractors when available
  switch (platform) {
    case "linkedin":
      jobData = extractLinkedInJob();
      break;
    case "indeed":
      jobData = extractIndeedJob();
      break;
    case "glassdoor":
      jobData = extractGlassdoorJob();
      break;
    case "naukri":
      jobData = extractNaukriJob();
      break;
    default:
      // Generic extractor for other job sites
      jobData = extractGenericJob();
  }

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

  return normalizedData;
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
 * LinkedIn Jobs Extractor
 */
function extractLinkedInJob() {
  const jobData = {
    company: "",
    position: "",
    jobLocation: "",
    jobType: "",
    jobDescription: "",
    salary: { min: 0, max: 0, currency: "INR" },
  };

  // Job Title
  const titleSelectors = [
    ".job-details-jobs-unified-top-card__job-title",
    ".jobs-unified-top-card__job-title",
    "h1.t-24",
    "h1.topcard__title",
  ];

  for (const selector of titleSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      jobData.position = element.textContent.trim();
      break;
    }
  }

  // Company Name
  const companySelectors = [
    ".jobs-unified-top-card__company-name",
    "a.topcard__org-name-link",
    "a[data-tracking-control-name='public_jobs_topcard-org-name']",
  ];

  for (const selector of companySelectors) {
    const element = document.querySelector(selector);
    if (element) {
      jobData.company = element.textContent.trim();
      break;
    }
  }

  // Location
  const locationSelectors = [
    ".jobs-unified-top-card__bullet",
    ".jobs-unified-top-card__workplace-type",
    ".topcard__flavor--bullet",
  ];

  for (const selector of locationSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      const text = element.textContent.trim();
      if (text && !text.match(/ago|apply/i)) {
        jobData.jobLocation = text;
        break;
      }
    }
    if (jobData.jobLocation) break;
  }

  // Job Description
  const descriptionSelectors = [
    ".jobs-description-content__text",
    ".description__text",
    ".jobs-box__html-content",
  ];

  for (const selector of descriptionSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      jobData.jobDescription = element.textContent.trim();
      break;
    }
  }

  // Job Type - extract from description or job details
  if (jobData.jobDescription) {
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
  }

  // Salary - look for salary information in the description
  if (jobData.jobDescription) {
    const salaryMatch = jobData.jobDescription.match(
      /(?:[$₹€£¥])\s*(\d[\d,.]+)(?:k)?(?:\s*-\s*|\s*to\s*)(?:[$₹€£¥])?\s*(\d[\d,.]+)(?:k)?/i
    );

    if (salaryMatch && salaryMatch[1] && salaryMatch[2]) {
      let min = parseFloat(salaryMatch[1].replace(/[,]/g, ""));
      let max = parseFloat(salaryMatch[2].replace(/[,]/g, ""));

      // Handle if salary is in thousands (k)
      if (salaryMatch[0].toLowerCase().includes("k")) {
        min *= 1000;
        max *= 1000;
      }

      // Determine currency
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

  console.log("Injecting job data into PursuitPal form");

  // Wait for the form to load
  waitForElement("input[name='company']")
    .then(() => {
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

      // Notify user that form has been filled
      showNotification("Form auto-filled successfully!");
    })
    .catch((error) => {
      console.error("Failed to auto-fill form:", error);
      return false;
    });

  return true;
}

// Helper: Wait for element to exist in DOM
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Reject if element doesn't appear within timeout
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element not found: ${selector}`));
    }, timeout);
  });
}

// Helper: Fill input field
function fillInputField(name, value) {
  if (value === undefined || value === null) return;

  const field = document.querySelector(`input[name="${name}"]`);
  if (field) {
    field.value = value;
    triggerInputEvent(field);
  }
}

// Helper: Fill textarea field
function fillTextareaField(name, value) {
  if (value === undefined || value === null) return;

  const field = document.querySelector(`textarea[name="${name}"]`);
  if (field) {
    field.value = value;
    triggerInputEvent(field);
  }
}

// Helper: Fill select field
function fillSelectField(name, value) {
  if (value === undefined || value === null) return;

  const field = document.querySelector(`select[name="${name}"]`);
  if (field) {
    field.value = value;
    triggerInputEvent(field);
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

/**
 * Indeed Jobs Extractor
 */
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

/**
 * Glassdoor Jobs Extractor
 */
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

/**
 * Naukri Jobs Extractor
 */
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
