/**
 * PursuitPal - Content Script
 *
 * This script is injected into web pages to extract job posting data
 * and facilitate communication with the PursuitPal extension.
 */

console.log("PursuitPal content script loaded");

// Set up message listener for the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

// When the page loads, check if it's the job form page
document.addEventListener("DOMContentLoaded", () => {
  // Check if we're on the job form page
  if (
    window.location.href.includes("pursuitpal.app/jobs/new") ||
    window.location.href.includes("pursuitpal.app/jobs/edit")
  ) {
    // Tell background script we're on the form page and ready for data
    setTimeout(() => {
      chrome.runtime.sendMessage({ action: "pageIsJobForm" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error sending pageIsJobForm message:",
            chrome.runtime.lastError
          );
          return;
        }

        if (response && response.data) {
          injectJobData(response.data);
        }
      });
    }, 1000); // Small delay to ensure page is fully loaded
  }
});

// Make extraction function available globally
window._pursuitPalExtractData = extractJobData;

// Notify page that extraction function is available
document.dispatchEvent(new CustomEvent("pursuitpal_extension_loaded"));

/**
 * Extract job data from Naukri.com
 * This function extracts job details from Naukri.com job pages
 */
function extractNaukriJob() {
  const jobData = {
    company: "",
    position: "",
    jobLocation: "",
    jobType: "",
    jobDescription: "",
    salary: { min: 0, max: 0, currency: "INR" },
    skills: [],
  };

  try {
    // Job Title
    const titleElement = document.querySelector(
      ".styles_jd-header-title__rZwM1, .jd-header-title"
    );
    if (titleElement) {
      jobData.position = titleElement.textContent.trim();
    }

    // Company Name
    const companyElement = document.querySelector(
      ".styles_jd-header-comp-name__MvqAI a, .jd-header-comp-name a, .company-name"
    );
    if (companyElement) {
      jobData.company = companyElement.textContent.trim();
    }

    // Location
    const locationElement = document.querySelector(
      ".styles_jhc__location__W_pVs a, .loc a, .location"
    );
    if (locationElement) {
      jobData.jobLocation = locationElement.textContent.trim();
    }

    // Experience
    const experienceElement = document.querySelector(
      ".styles_jhc__exp__k_giM span, .exp span"
    );
    if (experienceElement) {
      jobData.experience = experienceElement.textContent.trim();
    }

    // Salary
    const salaryElement = document.querySelector(
      ".styles_jhc__salary__jdfEC span, .salary-estimate-text, .salary"
    );
    if (salaryElement) {
      const salaryText = salaryElement.textContent.trim();

      // Try to parse salary if it's not "Not Disclosed"
      if (salaryText !== "Not Disclosed") {
        // Example pattern: "₹5-10 Lacs PA"
        const salaryMatch = salaryText.match(
          /₹(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\s+Lacs/i
        );
        if (salaryMatch && salaryMatch[1] && salaryMatch[2]) {
          const min = parseFloat(salaryMatch[1]) * 100000; // Convert lacs to rupees
          const max = parseFloat(salaryMatch[2]) * 100000;
          jobData.salary = { min, max, currency: "INR" };
        }
      }
    }

    // Job Description
    const descriptionElement = document.querySelector(
      ".styles_JDC__dang-inner-html__h0K4t, .job-desc, .jobDescriptionContent"
    );
    if (descriptionElement) {
      jobData.jobDescription = descriptionElement.textContent.trim();
    }

    // Job Type
    const employmentTypeElement = document.querySelector(
      ".styles_details__Y424J:has(label:contains('Employment Type')) span, .job-type"
    );
    if (employmentTypeElement) {
      const jobTypeText = employmentTypeElement.textContent
        .toLowerCase()
        .trim();

      if (jobTypeText.includes("full time")) {
        jobData.jobType = "full-time";
      } else if (jobTypeText.includes("part time")) {
        jobData.jobType = "part-time";
      } else if (jobTypeText.includes("contract")) {
        jobData.jobType = "contract";
      } else if (jobTypeText.includes("internship")) {
        jobData.jobType = "internship";
      }
    }

    // If job type not found, look in the employment type section
    if (!jobData.jobType) {
      const employmentTypes = document.querySelectorAll(
        ".styles_other-details__oEN4O .styles_details__Y424J, .employment-type"
      );
      for (const element of employmentTypes) {
        const label = element.querySelector("label");
        if (label && label.textContent.includes("Employment Type")) {
          const typeText = element
            .querySelector("span")
            .textContent.toLowerCase()
            .trim();

          if (typeText.includes("full time")) {
            jobData.jobType = "full-time";
          } else if (typeText.includes("part time")) {
            jobData.jobType = "part-time";
          } else if (typeText.includes("contract")) {
            jobData.jobType = "contract";
          } else if (typeText.includes("internship")) {
            jobData.jobType = "internship";
          }
          break;
        }
      }
    }

    // Skills
    const skillElements = document.querySelectorAll(
      ".styles_key-skill__GIPn_ .styles_chip__7YCfG, .key-skill .chip"
    );
    const skills = [];
    for (const element of skillElements) {
      skills.push(element.textContent.trim());
    }
    jobData.skills = skills;

    // Add the skills to the notes section as well
    if (skills.length > 0) {
      jobData.notes = "Key Skills: " + skills.join(", ");
    }

    // Posted Date
    const postedElement = document.querySelector(
      ".styles_jhc__stat__PgY67 span, .post-date"
    );
    if (postedElement) {
      jobData.posted = postedElement.textContent.trim();
    }

    console.log("Extracted Naukri job data:", jobData);
    return jobData;
  } catch (error) {
    console.error("Error extracting Naukri job data:", error);
    return jobData;
  }
}

/**
 * Extract job data from LinkedIn
 * This function extracts job details from LinkedIn job pages
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
    ".t-24.t-bold.inline",
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
    ".job-details-jobs-unified-top-card__company-name",
    ".tvm__text.tvm__text--neutral.mt2",
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
    ".job-details-jobs-unified-top-card__primary-description-container .t-black--light span:first-of-type",
    ".job-details-jobs-unified-top-card__subtitle-primary-grouping .topcard__flavor--bullet",
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

  // If location still not found, try another approach for new LinkedIn UI
  if (!jobData.jobLocation) {
    const locationText = document.querySelector(".t-black--light .tvm__text");
    if (locationText) {
      jobData.jobLocation = locationText.textContent.trim();
    }
  }

  // Job Description
  const descriptionSelectors = [
    ".jobs-description-content__text",
    ".description__text",
    ".jobs-box__html-content",
    ".jobs-description__content .jobs-description-content",
    "#job-details",
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

  // Check for on-site, remote, hybrid labels in the new LinkedIn UI
  const workplaceTypes = document.querySelectorAll(
    ".job-details-fit-level-preferences button"
  );
  for (const button of workplaceTypes) {
    const text = button.textContent.toLowerCase();
    if (text.includes("on-site")) {
      jobData.workplaceType = "on-site";
    } else if (text.includes("remote")) {
      jobData.workplaceType = "remote";
      // Also set job type if not already set
      if (!jobData.jobType) {
        jobData.jobType = "remote";
      }
    } else if (text.includes("hybrid")) {
      jobData.workplaceType = "hybrid";
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
 * Extract job data from Glassdoor
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
  const descriptionElement =
    document.querySelector(".jobDescriptionContent") ||
    document.querySelector(".jobDescription") ||
    document.getElementById("JobDescriptionContainer");
  if (descriptionElement) {
    jobData.jobDescription = descriptionElement.textContent.trim();
  }

  // Job Type
  const jobTypeElement = document.querySelector(".job-type");
  if (jobTypeElement) {
    const text = jobTypeElement.textContent.toLowerCase().trim();
    if (text.includes("full-time")) {
      jobData.jobType = "full-time";
    } else if (text.includes("part-time")) {
      jobData.jobType = "part-time";
    } else if (text.includes("contract")) {
      jobData.jobType = "contract";
    } else if (text.includes("internship")) {
      jobData.jobType = "internship";
    } else if (text.includes("remote")) {
      jobData.jobType = "remote";
    }
  }

  // Salary
  const salaryElement = document.querySelector(".salary");

  if (salaryElement) {
    const text = salaryElement.textContent.trim();
    // Look for salary patterns like "$50,000 - $70,000 a year"
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
      notes: jobData.notes || "",
      source: platform,
      extractedWith: "pursuitpal-extension",
    };

    // If skills were extracted, add them to notes if not already there
    if (
      jobData.skills &&
      jobData.skills.length > 0 &&
      !normalizedData.notes.includes("Key Skills")
    ) {
      if (normalizedData.notes) {
        normalizedData.notes += "\n\nKey Skills: " + jobData.skills.join(", ");
      } else {
        normalizedData.notes = "Key Skills: " + jobData.skills.join(", ");
      }
    }

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
  if (!url) return "generic";

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

// Update the window listener to check on load
if (window.location.href.includes(`${APP_URL}/jobs/new`)) {
  console.log("PursuitPal job form page detected");

  // Run checks at different times to ensure we catch the data
  setTimeout(checkForExtensionData, 500);
  setTimeout(checkForExtensionData, 1000);
  setTimeout(checkForExtensionData, 2000);
}
