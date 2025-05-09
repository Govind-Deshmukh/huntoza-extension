/**
 * PursuitPal - Enhanced Content Script
 *
 * This script runs on any web page and attempts to extract job posting details.
 * It has specialized extractors for common job platforms like LinkedIn, Indeed, etc.
 */

// Main function to extract job data from the page
function extractJobData() {
  // Determine which job platform we're on
  const platform = detectJobPlatform();

  let jobData;

  // Use platform-specific extractors when available
  if (platform === "linkedin") {
    jobData = extractLinkedInJobData();
  } else if (platform === "indeed") {
    jobData = extractIndeedJobData();
  } else if (platform === "glassdoor") {
    jobData = extractGlassdoorJobData();
  } else {
    // Fall back to generic extraction for other sites
    jobData = extractGenericJobData();
  }

  // Ensure all fields are present (even if empty)
  jobData = {
    company: jobData.company || "",
    position: jobData.position || "",
    jobLocation: jobData.jobLocation || "",
    jobType: jobData.jobType || "full-time",
    salary: {
      min: jobData.salary?.min || 0,
      max: jobData.salary?.max || 0,
      currency: jobData.salary?.currency || "INR",
    },
    jobDescription: jobData.jobDescription || "",
    jobUrl: window.location.href,
  };

  // Save data to extension storage
  chrome.runtime.sendMessage({
    action: "saveJobData",
    data: jobData,
  });

  return jobData;
}

// Detect the job platform based on URL and page structure
function detectJobPlatform() {
  const url = window.location.href.toLowerCase();

  if (url.includes("linkedin.com/jobs")) {
    return "linkedin";
  } else if (url.includes("indeed.com")) {
    return "indeed";
  } else if (url.includes("glassdoor.com")) {
    return "glassdoor";
  } else if (url.includes("greenhouse.io")) {
    return "greenhouse";
  } else if (url.includes("lever.co")) {
    return "lever";
  }

  return "generic";
}

// LinkedIn-specific extraction
function extractLinkedInJobData() {
  const jobData = {
    company: "",
    position: "",
    jobLocation: "",
    jobType: "",
    salary: {
      min: 0,
      max: 0,
      currency: "INR",
    },
    jobDescription: "",
  };

  // Job Title - using the updated LinkedIn selectors
  // First, try the new structure
  const jobTitleElement = document.querySelector("h1.t-24.t-bold.inline");
  if (jobTitleElement) {
    // Check if there's a link inside the h1
    const titleLink = jobTitleElement.querySelector("a");
    jobData.position = titleLink
      ? titleLink.textContent.trim()
      : jobTitleElement.textContent.trim();
  }

  // Fallbacks for other LinkedIn title structures
  if (!jobData.position) {
    const altTitleSelectors = [
      ".job-details-jobs-unified-top-card__job-title h1",
      ".topcard__title",
      ".jobs-unified-top-card__job-title",
      ".jobs-details-top-card__job-title",
    ];

    for (const selector of altTitleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        jobData.position = element.textContent.trim();
        break;
      }
    }
  }

  // Company Name - updated selectors for LinkedIn
  const companySelectors = [
    ".jobs-unified-top-card__company-name a",
    "a[href*='/company/']",
    ".jobs-unified-top-card__company-name",
    ".topcard__org-name-link",
    ".jobs-details-top-card__company-url",
  ];

  for (const selector of companySelectors) {
    const element = document.querySelector(selector);
    if (element) {
      jobData.company = element.textContent.trim();
      break;
    }
  }

  // Job Location - updated selectors with new class paths
  const locationSelectors = [
    ".tvm__text:first-of-type",
    "span.topcard__flavor--bullet",
    ".jobs-unified-top-card__bullet",
    ".jobs-unified-top-card__workplace-type",
    ".job-details-jobs-unified-top-card__primary-description-container .tvm__text",
  ];

  for (const selector of locationSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      const text = element.textContent.trim();
      // Check if text contains location patterns and doesn't contain timing information
      if (text && !text.match(/ago|week|day|hour|minute|second|apply/i)) {
        jobData.jobLocation = text.split("·")[0].trim();
        break;
      }
    }
    if (jobData.jobLocation) break;
  }

  // Job Description - using the specific LinkedIn class
  const descriptionSelectors = [
    ".jobs-description__content .jobs-description-content__text--stretch",
    "#job-details",
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

  // Job Type - extract from description text
  if (jobData.jobDescription) {
    if (jobData.jobDescription.match(/full[- ]time|ft\b/i)) {
      jobData.jobType = "full-time";
    } else if (jobData.jobDescription.match(/part[- ]time|pt\b/i)) {
      jobData.jobType = "part-time";
    } else if (jobData.jobDescription.match(/\bcontract\b|\bcontractor\b/i)) {
      jobData.jobType = "contract";
    } else if (jobData.jobDescription.match(/\binternship\b|\bintern\b/i)) {
      jobData.jobType = "internship";
    } else if (
      jobData.jobDescription.match(/\bremote\b|\bwork from home\b|\bwfh\b/i)
    ) {
      jobData.jobType = "remote";
    } else if (jobData.jobDescription.match(/\bhybrid\b/i)) {
      jobData.jobType = "hybrid";
    }
  }

  // Salary - check if it's in the description
  if (jobData.jobDescription) {
    const salaryMatch = jobData.jobDescription.match(
      /(?:[$₹€£¥])\s*(\d[\d,.]+)(?:k)?(?:\s*-\s*|\s*to\s*)(?:[$₹€£¥])?\s*(\d[\d,.]+)(?:k)?/i
    );

    if (salaryMatch && salaryMatch[1] && salaryMatch[2]) {
      // Extract and clean up the numbers
      let min = salaryMatch[1].replace(/[,]/g, "");
      let max = salaryMatch[2].replace(/[,]/g, "");

      // Convert to numbers
      min = parseFloat(min);
      max = parseFloat(max);

      // Check for 'k' suffix in the match
      const isThousands = salaryMatch[0].toLowerCase().includes("k");
      if (isThousands) {
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
      } else if (salaryMatch[0].includes("¥")) {
        currency = "JPY";
      }

      jobData.salary = {
        min,
        max,
        currency,
      };
    }
  }

  return jobData;
}

// Indeed-specific extraction
function extractIndeedJobData() {
  const jobData = {
    company: "",
    position: "",
    jobLocation: "",
    jobType: "",
    salary: {
      min: 0,
      max: 0,
      currency: "INR",
    },
    jobDescription: "",
  };

  // Job Title
  const jobTitleElement = document.querySelector(
    ".jobsearch-JobInfoHeader-title"
  );
  if (jobTitleElement) {
    jobData.position = jobTitleElement.textContent.trim();
  }

  // Company Name
  const companyElement = document.querySelector(
    ".jobsearch-InlineCompanyRating div"
  );
  if (companyElement) {
    jobData.company = companyElement.textContent.trim();
  }

  // Job Location
  const locationElement = document.querySelector(
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

  // Extract job type from description
  if (jobData.jobDescription) {
    if (jobData.jobDescription.match(/full[- ]time|ft\b/i)) {
      jobData.jobType = "full-time";
    } else if (jobData.jobDescription.match(/part[- ]time|pt\b/i)) {
      jobData.jobType = "part-time";
    } else if (jobData.jobDescription.match(/\bcontract\b|\bcontractor\b/i)) {
      jobData.jobType = "contract";
    } else if (jobData.jobDescription.match(/\binternship\b|\bintern\b/i)) {
      jobData.jobType = "internship";
    } else if (
      jobData.jobDescription.match(/\bremote\b|\bwork from home\b|\bwfh\b/i)
    ) {
      jobData.jobType = "remote";
    }
  }

  // Attempt to extract salary information
  const salaryText = document.querySelector(
    '[data-testid="attribute_snippet_testid"]'
  );
  if (
    (salaryText && salaryText.textContent.includes("$")) ||
    salaryText.textContent.includes("₹")
  ) {
    const salaryStr = salaryText.textContent;
    // Extract min and max values
    const salaryMatch = salaryStr.match(
      /(?:[$₹€£¥])\s*(\d[\d,.]+)(?:k)?(?:\s*-\s*|\s*to\s*|\s*a\s*)(?:[$₹€£¥])?\s*(\d[\d,.]+)(?:k)?/i
    );

    if (salaryMatch && salaryMatch[1] && salaryMatch[2]) {
      let min = salaryMatch[1].replace(/[,]/g, "");
      let max = salaryMatch[2].replace(/[,]/g, "");

      min = parseFloat(min);
      max = parseFloat(max);

      const isThousands = salaryMatch[0].toLowerCase().includes("k");
      if (isThousands) {
        min *= 1000;
        max *= 1000;
      }

      let currency = "INR";
      if (salaryStr.includes("$")) {
        currency = "USD";
      } else if (salaryStr.includes("₹")) {
        currency = "INR";
      } else if (salaryStr.includes("€")) {
        currency = "EUR";
      } else if (salaryStr.includes("£")) {
        currency = "GBP";
      }

      jobData.salary = {
        min,
        max,
        currency,
      };
    }
  }

  return jobData;
}

// Glassdoor-specific extraction
function extractGlassdoorJobData() {
  const jobData = {
    company: "",
    position: "",
    jobLocation: "",
    jobType: "",
    salary: {
      min: 0,
      max: 0,
      currency: "INR",
    },
    jobDescription: "",
  };

  // Job Title
  const jobTitleElement = document.querySelector(".job-title-header");
  if (jobTitleElement) {
    jobData.position = jobTitleElement.textContent.trim();
  }

  // Company Name
  const companyElement = document.querySelector(".jobs-company");
  if (companyElement) {
    jobData.company = companyElement.textContent.trim();
  }

  // Job Location
  const locationElement = document.querySelector(".location");
  if (locationElement) {
    jobData.jobLocation = locationElement.textContent.trim();
  }

  // Job Description
  const descriptionElement = document.getElementById("JobDescriptionContainer");
  if (descriptionElement) {
    jobData.jobDescription = descriptionElement.textContent.trim();
  }

  // Extract job type and salary from metadata or description
  if (jobData.jobDescription) {
    // Job Type extraction
    if (jobData.jobDescription.match(/full[- ]time|ft\b/i)) {
      jobData.jobType = "full-time";
    } else if (jobData.jobDescription.match(/part[- ]time|pt\b/i)) {
      jobData.jobType = "part-time";
    } else if (jobData.jobDescription.match(/\bcontract\b|\bcontractor\b/i)) {
      jobData.jobType = "contract";
    } else if (jobData.jobDescription.match(/\binternship\b|\bintern\b/i)) {
      jobData.jobType = "internship";
    } else if (
      jobData.jobDescription.match(/\bremote\b|\bwork from home\b|\bwfh\b/i)
    ) {
      jobData.jobType = "remote";
    }

    // Salary extraction
    const salaryMatch = jobData.jobDescription.match(
      /(?:[$₹€£¥])\s*(\d[\d,.]+)(?:k)?(?:\s*-\s*|\s*to\s*)(?:[$₹€£¥])?\s*(\d[\d,.]+)(?:k)?/i
    );

    if (salaryMatch && salaryMatch[1] && salaryMatch[2]) {
      let min = salaryMatch[1].replace(/[,]/g, "");
      let max = salaryMatch[2].replace(/[,]/g, "");

      min = parseFloat(min);
      max = parseFloat(max);

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
      } else if (salaryMatch[0].includes("¥")) {
        currency = "JPY";
      }

      jobData.salary = {
        min,
        max,
        currency,
      };
    }
  }

  return jobData;
}

// Generic function for other job sites
function extractGenericJobData() {
  // Various selectors and strategies to find company name
  const possibleCompanySelectors = [
    ".company-name",
    ".employer-name",
    '[data-testid="company-name"]',
    ".jobs-unified-top-card__company-name",
    ".jobsearch-InlineCompanyRating div",
    ".jobs-company",
    ".at-section-text-company",
    ".css-1saic7f",
    ".content-header__company-name",
    ".employer-name",
  ];

  // Try to find company name using common selectors
  let company = "";
  for (const selector of possibleCompanySelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      company = element.textContent.trim();
      break;
    }
  }

  // Fallback: Look for company name in metadata
  if (!company) {
    const metaCompany = document.querySelector('meta[property="og:site_name"]');
    if (metaCompany) {
      company = metaCompany.getAttribute("content");
    }
  }

  // Fallback: Try to extract from page title
  if (!company) {
    const title = document.title;
    if (title.includes(" at ")) {
      company = title.split(" at ")[1].split(" - ")[0].trim();
    }
  }

  // Various selectors for job title
  const possibleTitleSelectors = [
    ".job-title",
    ".position-title",
    "h1.title",
    '[data-testid="job-title"]',
    ".jobs-unified-top-card__job-title h1",
    ".jobsearch-JobInfoHeader-title",
    ".job-title-header",
    ".at-jobs-header-title",
    ".app-title",
    ".posting-headline h2",
    "h1", // General fallback
  ];

  // Try to find job title using common selectors
  let position = "";
  for (const selector of possibleTitleSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      position = element.textContent.trim();
      break;
    }
  }

  // Fallback: Look for job title in metadata
  if (!position) {
    const metaTitle = document.querySelector('meta[property="og:title"]');
    if (metaTitle) {
      const title = metaTitle.getAttribute("content");
      // Try to clean up the title if it contains company info
      if (title.includes(" at ")) {
        position = title.split(" at ")[0].trim();
      } else {
        position = title;
      }
    }
  }

  // Fallback: Use the page title
  if (!position) {
    const title = document.title;
    if (title.includes(" at ")) {
      position = title.split(" at ")[0].trim();
    }
  }

  // Various selectors for job location
  const possibleLocationSelectors = [
    ".job-location",
    ".location",
    '[data-testid="location"]',
    ".jobs-unified-top-card__workplace-type",
    ".job-details-jobs-unified-top-card__primary-description-container .tvm__text",
    ".jobsearch-JobInfoHeader-subtitle .jobsearch-JobInfoHeader-locationText",
    ".location",
    ".at-location",
    ".location",
    ".posting-categories .location",
  ];

  // Try to find location using common selectors
  let jobLocation = "";
  for (const selector of possibleLocationSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      jobLocation = element.textContent.trim();
      break;
    }
  }

  // Fallback: Try to look for common location patterns in the page text
  if (!jobLocation) {
    const pageText = document.body.innerText;
    // Look for location patterns like "Location: New York" or "Location: Remote"
    const locationPattern = /location:?\s*([^,\n\r]+)/i;
    const locationMatch = pageText.match(locationPattern);
    if (locationMatch && locationMatch[1]) {
      jobLocation = locationMatch[1].trim();
    } else if (pageText.match(/remote|work from home|wfh/i)) {
      jobLocation = "Remote";
    }
  }

  // Various selectors for job description
  const possibleDescriptionSelectors = [
    ".job-description",
    ".description",
    '[data-testid="job-description"]',
    ".jobs-unified-description__content",
    ".jobs-description-content__text--stretch",
    "#jobDescriptionText",
    "#JobDescriptionContainer",
    ".jobDescriptionSection",
    ".posting-page",
    ".posting-detail-body",
  ];

  // Try to find description using common selectors
  let jobDescription = "";
  for (const selector of possibleDescriptionSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      jobDescription = element.textContent.trim();
      break;
    }
  }

  // Fallback: Try to find any large text block that might be a job description
  if (!jobDescription) {
    const paragraphs = document.querySelectorAll("p");
    if (paragraphs.length > 3) {
      // Concatenate several paragraphs that might be the job description
      jobDescription = Array.from(paragraphs)
        .slice(0, Math.min(10, paragraphs.length)) // Take up to 10 paragraphs
        .map((p) => p.textContent.trim())
        .filter((text) => text.length > 100) // Only consider substantial paragraphs
        .join("\n\n");
    }
  }

  // Try to find job type text on the page
  const pageText = document.body.innerText;

  // Common job type patterns
  let jobType = "full-time"; // Default
  if (pageText.match(/full[- ]time|ft\b/i)) jobType = "full-time";
  else if (pageText.match(/part[- ]time|pt\b/i)) jobType = "part-time";
  else if (pageText.match(/\bcontract\b|\bcontractor\b/i)) jobType = "contract";
  else if (pageText.match(/\binternship\b|\bintern\b/i)) jobType = "internship";
  else if (pageText.match(/\bremote\b|\bwork from home\b|\bwfh\b/i))
    jobType = "remote";

  // Initialize salary object
  const salary = {
    min: 0,
    max: 0,
    currency: "INR", // Default currency
  };

  // Common salary patterns
  // Match patterns like "$50,000-$70,000" or "₹5,00,000 - ₹7,00,000" or "50k-70k"
  const salaryRangePattern =
    /(?:[$₹€£¥])\s*(\d[\d,.]+)(?:k)?(?:\s*-\s*|\s*to\s*)(?:[$₹€£¥])?\s*(\d[\d,.]+)(?:k)?/i;
  const salaryMatch = pageText.match(salaryRangePattern);

  if (salaryMatch && salaryMatch[1] && salaryMatch[2]) {
    // Extract min and max values
    let min = salaryMatch[1].replace(/[,]/g, "");
    let max = salaryMatch[2].replace(/[,]/g, "");

    // Convert to numbers
    min = parseFloat(min);
    max = parseFloat(max);

    // Check if values have 'k' suffix and multiply
    if (salaryMatch[0].toLowerCase().includes("k")) {
      min *= 1000;
      max *= 1000;
    }

    // Detect currency
    if (salaryMatch[0].includes("$")) salary.currency = "USD";
    else if (salaryMatch[0].includes("₹")) salary.currency = "INR";
    else if (salaryMatch[0].includes("€")) salary.currency = "EUR";
    else if (salaryMatch[0].includes("£")) salary.currency = "GBP";
    else if (salaryMatch[0].includes("¥")) salary.currency = "JPY";

    // Update salary object
    salary.min = min;
    salary.max = max;
  }

  return {
    company,
    position,
    jobLocation,
    jobType,
    salary,
    jobDescription,
  };
}

// Extract job data when the page is fully loaded
window.addEventListener("load", () => {
  // Wait a bit longer for LinkedIn and similar sites that load content dynamically
  setTimeout(() => {
    extractJobData();
  }, 2000);
});

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractJobData") {
    const jobData = extractJobData();
    sendResponse(jobData);
  } else if (request.action === "extractContactData") {
    // Future support for LinkedIn contact extraction
    // This is a placeholder for future functionality
    const contactData = { name: "Not implemented yet" };
    sendResponse(contactData);
  }
  return true; // Keep the message channel open for async response
});
