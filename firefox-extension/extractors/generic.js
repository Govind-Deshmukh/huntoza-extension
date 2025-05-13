/**
 * extractors/generic.js - Generic job data extractor
 *
 * Extracts job details from any job posting page that doesn't have a specific extractor.
 * Uses a wide variety of selectors and heuristics to find job information.
 */

/**
 * Extract job data from generic job posting pages
 *
 * @return {Object} - Extracted job data
 */
export function extractGenericJob() {
  const jobData = {
    company: "",
    position: "",
    jobLocation: "",
    jobType: "",
    jobDescription: "",
    salary: { min: 0, max: 0, currency: "INR" },
    skills: [],
  };

  // Job Title - try various common selectors
  const titleSelectors = [
    "h1.job-title",
    "h1.posting-title",
    "h1.title",
    ".job-title h1",
    ".job-title",
    ".posting-headline h2",
    ".job-header h1",
    ".job-header-title",
    '[data-testid="job-title"]',
    '[data-automation="jobTitle"]',
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
    '[data-testid="company-name"]',
    '[data-automation="jobCompany"]',
    ".org-name",
    ".posting-company",
    ".job-company",
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
    '[data-testid="location"]',
    '[data-automation="jobLocation"]',
    ".company-location",
    ".posting-location",
    ".job-address",
    ".address",
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
    '[data-testid="job-description"]',
    '[data-automation="jobDescription"]',
    "#job-description",
    "#description",
    ".job-details",
    ".details",
    "#jobDescriptionText",
    ".content",
    ".job-content",
    '[role="presentation"]',
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

  // Try to extract skills based on common skill sections in job descriptions
  if (jobData.jobDescription) {
    const skillSectionPatterns = [
      /requirements:[\s\S]*?((?:\n[•\-*]\s*[^\n]+)+)/i,
      /qualifications:[\s\S]*?((?:\n[•\-*]\s*[^\n]+)+)/i,
      /skills:[\s\S]*?((?:\n[•\-*]\s*[^\n]+)+)/i,
      /what you'll need:[\s\S]*?((?:\n[•\-*]\s*[^\n]+)+)/i,
      /what you need:[\s\S]*?((?:\n[•\-*]\s*[^\n]+)+)/i,
    ];

    for (const pattern of skillSectionPatterns) {
      const match = jobData.jobDescription.match(pattern);
      if (match && match[1]) {
        const skillsText = match[1];
        const bullets = skillsText.match(/[•\-*]\s*([^\n]+)/g);

        if (bullets && bullets.length > 0) {
          jobData.skills = bullets
            .map((bullet) => bullet.replace(/^[•\-*]\s*/, "").trim())
            .filter((skill) => skill.length > 0);

          break;
        }
      }
    }
  }

  // If we didn't find skills through bullet points, try looking for skills directly
  if (jobData.skills.length === 0 && jobData.jobDescription) {
    // Common technical skills to look for
    const commonSkills = [
      "JavaScript",
      "Python",
      "Java",
      "C#",
      "C++",
      "Ruby",
      "PHP",
      "Swift",
      "React",
      "Angular",
      "Vue",
      "Node.js",
      "TypeScript",
      "HTML",
      "CSS",
      "SQL",
      "MongoDB",
      "AWS",
      "Azure",
      "Docker",
      "Kubernetes",
      "Git",
      "REST API",
      "GraphQL",
      "Linux",
      "Agile",
      "Scrum",
    ];

    const foundSkills = [];
    for (const skill of commonSkills) {
      const pattern = new RegExp(`\\b${skill}\\b`, "i");
      if (pattern.test(jobData.jobDescription)) {
        foundSkills.push(skill);
      }
    }

    if (foundSkills.length > 0) {
      jobData.skills = foundSkills;
    }
  }

  return jobData;
}
