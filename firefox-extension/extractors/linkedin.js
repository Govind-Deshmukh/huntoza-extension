/**
 * extractors/linkedin.js - LinkedIn specific job data extractor
 *
 * Extracts job details from LinkedIn job posting pages.
 */

/**
 * Extract job data from LinkedIn
 *
 * @return {Object} - Extracted LinkedIn job data
 */
export function extractLinkedInJob() {
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
    ".jobs-unified-top-card__job-title-heading",
    ".job-view-layout h1",
    "h1.job-title",
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
    'a[data-tracking-control-name="public_jobs_topcard-org-name"]',
    ".job-details-jobs-unified-top-card__company-name",
    ".tvm__text.tvm__text--neutral.mt2",
    ".jobs-unified-top-card__company-name a",
    ".job-view-layout .company-name",
    ".jobs-details-top-card__company-url",
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
    ".jobs-unified-top-card__metadata-container .location",
    ".jobs-unified-top-card__subtitle-primary-grouping span.jobs-unified-top-card__bullet",
    ".job-view-layout .location",
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

  // Try the newer LinkedIn UI location
  if (!jobData.jobLocation) {
    const locationContainer = document.querySelector(
      ".jobs-unified-top-card__primary-description"
    );
    if (locationContainer) {
      const locationSpans = locationContainer.querySelectorAll("span");
      for (const span of locationSpans) {
        const text = span.textContent.trim();
        if (text && !text.includes("ago") && text.length > 2) {
          jobData.jobLocation = text;
          break;
        }
      }
    }
  }

  // Job Description
  const descriptionSelectors = [
    ".jobs-description-content__text",
    ".description__text",
    ".jobs-box__html-content",
    ".jobs-description__content .jobs-description-content",
    "#job-details",
    ".jobs-description",
    ".jobs-description-content",
    ".job-view-layout .description",
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

  // Check for employment type in the job criteria section
  const criteriaItems = document.querySelectorAll(
    ".jobs-description-details__list-item"
  );
  for (const item of criteriaItems) {
    const label = item.querySelector(
      ".jobs-description-details__list-item-label"
    );
    const value = item.querySelector(
      ".jobs-description-details__list-item-value"
    );

    if (
      label &&
      value &&
      label.textContent.trim().toLowerCase().includes("employment type")
    ) {
      const typeText = value.textContent.toLowerCase().trim();

      if (typeText.includes("full-time")) {
        jobData.jobType = "full-time";
      } else if (typeText.includes("part-time")) {
        jobData.jobType = "part-time";
      } else if (typeText.includes("contract")) {
        jobData.jobType = "contract";
      } else if (typeText.includes("internship")) {
        jobData.jobType = "internship";
      }
      break;
    }
  }

  // Check for on-site, remote, hybrid labels in the new LinkedIn UI
  const workplaceTypes = document.querySelectorAll(
    ".job-details-fit-level-preferences button, .job-details-jobs-unified-top-card__workplace-type"
  );
  for (const button of workplaceTypes) {
    const text = button.textContent.toLowerCase();
    if (text.includes("on-site") || text.includes("onsite")) {
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

  // Try to get workplace type from meta description (newer way LinkedIn shows this info)
  if (!jobData.workplaceType) {
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      const content = metaDescription.getAttribute("content");
      if (content) {
        if (content.toLowerCase().includes("remote")) {
          jobData.workplaceType = "remote";
          if (!jobData.jobType) {
            jobData.jobType = "remote";
          }
        } else if (content.toLowerCase().includes("hybrid")) {
          jobData.workplaceType = "hybrid";
        } else if (
          content.toLowerCase().includes("on-site") ||
          content.toLowerCase().includes("onsite")
        ) {
          jobData.workplaceType = "on-site";
        }
      }
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

  // Check for salary insights
  const salaryInsights = document.querySelector(
    ".salary-main-rail .data-text, .compensation-section, .job-details-jobs-unified-top-card__salary-info"
  );
  if (salaryInsights) {
    const text = salaryInsights.textContent.trim();
    const salaryMatch = text.match(
      /(?:[$₹€£¥])\s*(\d[\d,.]+)(?:k)?(?:\s*-\s*|\s*to\s*)(?:[$₹€£¥])?\s*(\d[\d,.]+)(?:k)?/i
    );

    if (salaryMatch && salaryMatch[1] && salaryMatch[2]) {
      let min = parseFloat(salaryMatch[1].replace(/[,]/g, ""));
      let max = parseFloat(salaryMatch[2].replace(/[,]/g, ""));

      // Handle if salary is in thousands (k)
      if (text.toLowerCase().includes("k")) {
        min *= 1000;
        max *= 1000;
      }

      // Determine currency
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
