/**
 * PursuitPal - Content Script
 *
 * This script extracts job details from job boards and contact info from LinkedIn profiles.
 * It runs on any page and determines what type of data to extract based on the URL.
 */

// Main function to extract data from the current page
function extractData() {
  const url = window.location.href.toLowerCase();

  // Determine if we're on a job page or a LinkedIn profile
  if (isJobPostingPage(url)) {
    return extractJobData();
  } else if (isLinkedInProfilePage(url)) {
    return extractLinkedInProfile();
  }

  return null;
}

// Detect if the current page is a job posting
function isJobPostingPage(url) {
  const jobPatterns = [
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
    /\/posting/i,
    /lever\.co\/[^\/]+\/jobs/i,
    /greenhouse\.io\/jobs/i,
  ];

  return jobPatterns.some((pattern) => pattern.test(url));
}

// Detect if the current page is a LinkedIn profile
function isLinkedInProfilePage(url) {
  return /linkedin\.com\/in\//i.test(url);
}

// Extract job data from various job boards
function extractJobData() {
  // Determine which job platform we're on
  const platform = detectJobPlatform();

  let jobData;

  // Use platform-specific extractors
  if (platform === "linkedin") {
    jobData = extractLinkedInJobData();
  } else if (platform === "indeed") {
    jobData = extractIndeedJobData();
  } else if (platform === "glassdoor") {
    jobData = extractGlassdoorJobData();
  } else if (platform === "naukri") {
    jobData = extractNaukriJobData();
  } else {
    // Fall back to generic extraction for other sites
    jobData = extractGenericJobData();
  }

  // Ensure all fields are present
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
    dateExtracted: new Date().toISOString(),
  };

  // Send message to background script
  chrome.runtime.sendMessage({
    action: "saveJobData",
    data: jobData,
  });

  return jobData;
}

// Detect the job platform based on URL
function detectJobPlatform() {
  const url = window.location.href.toLowerCase();

  if (url.includes("linkedin.com/jobs")) {
    return "linkedin";
  } else if (url.includes("indeed.com")) {
    return "indeed";
  } else if (url.includes("glassdoor.com")) {
    return "glassdoor";
  } else if (url.includes("naukri.com")) {
    return "naukri";
  } else if (url.includes("monster.com")) {
    return "monster";
  }

  return "generic";
}

// LinkedIn-specific job extraction
function extractLinkedInJobData() {
  const jobData = {
    company: "",
    position: "",
    jobLocation: "",
    jobType: "",
    salary: { min: 0, max: 0, currency: "INR" },
    jobDescription: "",
  };

  // Job Title - using the LinkedIn selectors
  const jobTitleElement =
    document.querySelector("h1.t-24.t-bold.inline") ||
    document.querySelector(
      ".job-details-jobs-unified-top-card__job-title h1"
    ) ||
    document.querySelector(".topcard__title") ||
    document.querySelector(".jobs-unified-top-card__job-title");

  if (jobTitleElement) {
    const titleLink = jobTitleElement.querySelector("a");
    jobData.position = titleLink
      ? titleLink.textContent.trim()
      : jobTitleElement.textContent.trim();
  }

  // Company Name
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

  // Job Location
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
      if (text && !text.match(/ago|week|day|hour|minute|second|apply/i)) {
        jobData.jobLocation = text.split("·")[0].trim();
        break;
      }
    }
    if (jobData.jobLocation) break;
  }

  // Job Description
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

  // Job Type - extract from description
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

      jobData.salary = { min, max, currency };
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
    salary: { min: 0, max: 0, currency: "INR" },
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

  // Job Type from description
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

  // Salary information
  const salaryText = document.querySelector(
    '[data-testid="attribute_snippet_testid"]'
  );
  if (
    salaryText &&
    (salaryText.textContent.includes("$") ||
      salaryText.textContent.includes("₹"))
  ) {
    const salaryStr = salaryText.textContent;
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

      jobData.salary = { min, max, currency };
    }
  }

  return jobData;
}

// Naukri-specific extraction (Added new)
function extractNaukriJobData() {
  const jobData = {
    company: "",
    position: "",
    jobLocation: "",
    jobType: "",
    salary: { min: 0, max: 0, currency: "INR" },
    jobDescription: "",
  };

  // Job Title
  const jobTitleElement =
    document.querySelector(".jd-header-title") ||
    document.querySelector(".jd-top h1") ||
    document.querySelector(".jobTitle");
  if (jobTitleElement) {
    jobData.position = jobTitleElement.textContent.trim();
  }

  // Company Name
  const companyElement =
    document.querySelector(".jd-header-comp-name") ||
    document.querySelector(".jd-comp-name") ||
    document.querySelector(".comp-name");
  if (companyElement) {
    jobData.company = companyElement.textContent.trim();
  }

  // Job Location
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

  // Salary extraction
  const salaryElement =
    document.querySelector(".salary-estimate-text") ||
    document.querySelector(".sal-range");
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

// Glassdoor-specific extraction
function extractGlassdoorJobData() {
  const jobData = {
    company: "",
    position: "",
    jobLocation: "",
    jobType: "",
    salary: { min: 0, max: 0, currency: "INR" },
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

  // Extract job type and salary from description
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

      jobData.salary = { min, max, currency };
    }
  }

  return jobData;
}

// Generic function for other job sites
function extractGenericJobData() {
  // Various selectors to find company name
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

  // Try to find company name
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

  // Try to find job title
  let position = "";
  for (const selector of possibleTitleSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      position = element.textContent.trim();
      break;
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
    ".posting-categories .location",
  ];

  // Try to find location
  let jobLocation = "";
  for (const selector of possibleLocationSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      jobLocation = element.textContent.trim();
      break;
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

  // Try to find description
  let jobDescription = "";
  for (const selector of possibleDescriptionSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      jobDescription = element.textContent.trim();
      break;
    }
  }

  // Try to find job type
  const pageText = document.body.innerText;
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

  // Try to extract salary information
  const salaryRangePattern =
    /(?:[$₹€£¥])\s*(\d[\d,.]+)(?:k)?(?:\s*-\s*|\s*to\s*)(?:[$₹€£¥])?\s*(\d[\d,.]+)(?:k)?/i;
  const salaryMatch = pageText.match(salaryRangePattern);

  if (salaryMatch && salaryMatch[1] && salaryMatch[2]) {
    let min = salaryMatch[1].replace(/[,]/g, "");
    let max = salaryMatch[2].replace(/[,]/g, "");

    min = parseFloat(min);
    max = parseFloat(max);

    if (salaryMatch[0].toLowerCase().includes("k")) {
      min *= 1000;
      max *= 1000;
    }

    if (salaryMatch[0].includes("$")) salary.currency = "USD";
    else if (salaryMatch[0].includes("₹")) salary.currency = "INR";
    else if (salaryMatch[0].includes("€")) salary.currency = "EUR";
    else if (salaryMatch[0].includes("£")) salary.currency = "GBP";
    else if (salaryMatch[0].includes("¥")) salary.currency = "JPY";

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

// Extract LinkedIn profile data
function extractLinkedInProfile() {
  const contactData = {
    name: "",
    email: "",
    phone: "",
    position: "",
    company: "",
    location: "",
    profileUrl: window.location.href,
    connections: "",
    about: "",
    experience: [],
  };

  // Name extraction
  const nameElement =
    document.querySelector(".text-heading-xlarge") ||
    document.querySelector(".pv-top-card-section__name") ||
    document.querySelector("h1.artdeco-entity-lockup__title");
  if (nameElement) {
    contactData.name = nameElement.textContent.trim();
  }

  // Position & Company
  const titleElement =
    document.querySelector(".text-body-medium.break-words") ||
    document.querySelector(".pv-top-card-section__headline") ||
    document.querySelector(".artdeco-entity-lockup__subtitle");
  if (titleElement) {
    const titleText = titleElement.textContent.trim();
    // Try to parse out position and company if format is "Position at Company"
    const positionMatch = titleText.match(/(.+?)(?:\s+at\s+(.+))?$/i);
    if (positionMatch) {
      contactData.position = positionMatch[1]?.trim() || "";
      contactData.company = positionMatch[2]?.trim() || "";
    } else {
      contactData.position = titleText;
    }
  }

  // Location
  const locationElement =
    document.querySelector(
      ".text-body-small.inline.t-black--light.break-words"
    ) ||
    document.querySelector(".pv-top-card-section__location") ||
    document.querySelector(".artdeco-entity-lockup__caption");
  if (locationElement) {
    contactData.location = locationElement.textContent.trim();
  }

  // About section
  const aboutElement = document.querySelector(
    "#about ~ .display-flex .pv-shared-text-with-see-more"
  );
  if (aboutElement) {
    contactData.about = aboutElement.textContent.trim();
  }

  // Connections
  const connectionsElement =
    document.querySelector(
      ".pv-top-card--list.inline-flex li:first-child .text-body-small"
    ) || document.querySelector(".pv-top-card-section__connections");
  if (connectionsElement) {
    contactData.connections = connectionsElement.textContent.trim();
  }

  // Experience - Try to get current job
  const experienceSections = document.querySelectorAll(
    "#experience ~ .pvs-list__outer-container .pvs-entity"
  );
  if (experienceSections.length > 0) {
    contactData.experience = Array.from(experienceSections)
      .slice(0, 3)
      .map((section) => {
        const roleElement = section.querySelector(".t-bold span");
        const companyElement = section.querySelector(
          ".t-normal.t-black--light span"
        );
        const dateElement = section.querySelector(
          ".t-normal.t-black--light .pvs-entity__caption-wrapper"
        );

        return {
          role: roleElement ? roleElement.textContent.trim() : "",
          company: companyElement ? companyElement.textContent.trim() : "",
          date: dateElement ? dateElement.textContent.trim() : "",
        };
      });
  }

  // Try to find email in the page content
  // This is difficult as LinkedIn hides contact info, but we can try
  const pageText = document.body.innerText;
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emailMatches = pageText.match(emailRegex);

  if (emailMatches && emailMatches.length > 0) {
    // Filter out common LinkedIn emails that might be in the page
    const filteredEmails = emailMatches.filter(
      (email) => !email.includes("linkedin.com")
    );
    if (filteredEmails.length > 0) {
      contactData.email = filteredEmails[0]; // Use the first email found
    }
  }

  // Try to find phone in the page content
  const phoneRegex =
    /(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const phoneMatches = pageText.match(phoneRegex);

  if (phoneMatches && phoneMatches.length > 0) {
    contactData.phone = phoneMatches[0]; // Use the first phone number found
  }

  // Send message to background script
  chrome.runtime.sendMessage({
    action: "saveContactData",
    data: contactData,
  });

  return contactData;
}
