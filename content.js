/**
 * Job Hunt Assist - Content Script
 *
 * This script runs on any web page and attempts to extract job posting details.
 * It uses various heuristics and patterns to identify job information.
 */

// Main function to extract job data from the page
function extractJobData() {
  const jobData = {
    company: extractCompany(),
    position: extractPosition(),
    jobLocation: extractLocation(),
    jobType: extractJobType(),
    salary: extractSalary(),
    jobDescription: extractDescription(),
    jobUrl: window.location.href,
  };

  // Save data to extension storage
  chrome.runtime.sendMessage({
    action: "saveJobData",
    data: jobData,
  });

  return jobData;
}

// Helper functions to extract specific job details
function extractCompany() {
  // Various selectors and strategies to find company name
  const possibleSelectors = [
    // Common job board selectors
    ".company-name",
    ".employer-name",
    '[data-testid="company-name"]',
    ".jobs-unified-top-card__company-name", // LinkedIn
    ".jobsearch-InlineCompanyRating div", // Indeed
    ".jobs-company", // Glassdoor
    ".at-section-text-company", // ZipRecruiter
    ".css-1saic7f", // Greenhouse
    ".content-header__company-name", // Lever
    ".employer-name", // Monster
  ];

  // Try to find company name using common selectors
  for (const selector of possibleSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      return element.textContent.trim();
    }
  }

  // Fallback: Look for company name in metadata
  const metaCompany = document.querySelector('meta[property="og:site_name"]');
  if (metaCompany) {
    return metaCompany.getAttribute("content");
  }

  // Fallback: Try to extract from page title
  const title = document.title;
  if (title.includes(" at ")) {
    return title.split(" at ")[1].split(" - ")[0].trim();
  }

  return "";
}

function extractPosition() {
  // Various selectors for job title
  const possibleSelectors = [
    // Common job board selectors
    ".job-title",
    ".position-title",
    "h1.title",
    '[data-testid="job-title"]',
    ".jobs-unified-top-card__job-title", // LinkedIn
    ".jobsearch-JobInfoHeader-title", // Indeed
    ".job-title-header", // Glassdoor
    ".at-jobs-header-title", // ZipRecruiter
    ".app-title", // Greenhouse
    ".posting-headline h2", // Lever
    "h1", // General fallback
  ];

  // Try to find job title using common selectors
  for (const selector of possibleSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      return element.textContent.trim();
    }
  }

  // Fallback: Look for job title in metadata
  const metaTitle = document.querySelector('meta[property="og:title"]');
  if (metaTitle) {
    const title = metaTitle.getAttribute("content");
    // Try to clean up the title if it contains company info
    if (title.includes(" at ")) {
      return title.split(" at ")[0].trim();
    }
    return title;
  }

  // Fallback: Use the page title
  const title = document.title;
  if (title.includes(" at ")) {
    return title.split(" at ")[0].trim();
  }

  return "";
}

function extractLocation() {
  // Various selectors for job location
  const possibleSelectors = [
    // Common job board selectors
    ".job-location",
    ".location",
    '[data-testid="location"]',
    ".jobs-unified-top-card__workplace-type", // LinkedIn
    ".jobsearch-JobInfoHeader-subtitle .jobsearch-JobInfoHeader-locationText", // Indeed
    ".location", // Glassdoor
    ".at-location", // ZipRecruiter
    ".location", // Greenhouse
    ".posting-categories .location", // Lever
  ];

  // Try to find location using common selectors
  for (const selector of possibleSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      return element.textContent.trim();
    }
  }

  // Fallback: Try to look for common location patterns in the page text
  const pageText = document.body.innerText;

  // Look for location patterns like "Location: New York" or "Location: Remote"
  const locationPattern = /location:?\s*([^,\n\r]+)/i;
  const locationMatch = pageText.match(locationPattern);
  if (locationMatch && locationMatch[1]) {
    return locationMatch[1].trim();
  }

  // Look for remote work indicators
  if (pageText.match(/remote|work from home|wfh/i)) {
    return "Remote";
  }

  return "";
}

function extractJobType() {
  // Try to find job type text on the page
  const pageText = document.body.innerText;

  // Common job type patterns
  const fullTimePattern = /full[- ]time|ft\b/i;
  const partTimePattern = /part[- ]time|pt\b/i;
  const contractPattern = /\bcontract\b|\bcontractor\b/i;
  const internshipPattern = /\binternship\b|\bintern\b/i;
  const remotePattern = /\bremote\b|\bwork from home\b|\bwfh\b/i;

  // Check for matches
  if (fullTimePattern.test(pageText)) return "full-time";
  if (partTimePattern.test(pageText)) return "part-time";
  if (contractPattern.test(pageText)) return "contract";
  if (internshipPattern.test(pageText)) return "internship";
  if (remotePattern.test(pageText)) return "remote";

  return "full-time"; // Default to full-time
}

function extractSalary() {
  // Initialize salary object
  const salary = {
    min: 0,
    max: 0,
    currency: "INR", // Default currency for your app
  };

  // Try to find salary information on the page
  const pageText = document.body.innerText;

  // Common salary patterns
  // Match patterns like "$50,000-$70,000" or "₹5,00,000 - ₹7,00,000" or "50k-70k"
  const salaryRangePattern =
    /(?:[$₹€£¥])([\d,.]+)(?:k)?[^\d,.]*(?:to|-|–)(?:[$₹€£¥])?([\d,.]+)(?:k)?/i;
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

  return salary;
}

function extractDescription() {
  // Various selectors for job description
  const possibleSelectors = [
    // Common job board selectors
    ".job-description",
    ".description",
    '[data-testid="job-description"]',
    ".jobs-unified-description__content", // LinkedIn
    "#jobDescriptionText", // Indeed
    "#JobDescriptionContainer", // Glassdoor
    ".jobDescriptionSection", // ZipRecruiter
    ".posting-page", // Greenhouse
    ".posting-detail-body", // Lever
  ];

  // Try to find description using common selectors
  for (const selector of possibleSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      return element.textContent.trim();
    }
  }

  // Fallback: Try to find any large text block that might be a job description
  const paragraphs = document.querySelectorAll("p");
  if (paragraphs.length > 3) {
    // Concatenate several paragraphs that might be the job description
    return Array.from(paragraphs)
      .slice(0, Math.min(10, paragraphs.length)) // Take up to 10 paragraphs
      .map((p) => p.textContent.trim())
      .filter((text) => text.length > 100) // Only consider substantial paragraphs
      .join("\n\n");
  }

  return "";
}

// Extract job data when the page is fully loaded
window.addEventListener("load", () => {
  // Wait a bit to make sure dynamic content is loaded
  setTimeout(() => {
    extractJobData();
  }, 1500);
});

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractJobData") {
    const jobData = extractJobData();
    sendResponse(jobData);
  }
  return true; // Keep the message channel open for async response
});
