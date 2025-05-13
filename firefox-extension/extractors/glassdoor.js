/**
 * extractors/glassdoor.js - Glassdoor specific job data extractor
 *
 * Extracts job details from Glassdoor job posting pages.
 */

/**
 * Extract job data from Glassdoor
 *
 * @return {Object} - Extracted Glassdoor job data
 */
export function extractGlassdoorJob() {
  const jobData = {
    company: "",
    position: "",
    jobLocation: "",
    jobType: "",
    jobDescription: "",
    salary: { min: 0, max: 0, currency: "INR" },
    skills: [],
  };

  // Job Title
  const titleElement =
    document.querySelector(".job-title-header") ||
    document.querySelector('h1[data-test="job-title"]');
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

  // Try another approach for job type
  if (!jobData.jobType) {
    const employmentTypeElements = document.querySelectorAll(".jobFacts li");
    for (const element of employmentTypeElements) {
      const text = element.textContent.toLowerCase().trim();
      if (text.includes("employment type:")) {
        const typeText = text.replace("employment type:", "").trim();
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
  }

  // If job type still not found, try to infer from description
  if (!jobData.jobType && jobData.jobDescription) {
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

  // Try to find salary in other locations
  if (jobData.salary.min === 0 && jobData.salary.max === 0) {
    const salaryEstimateElement = document.querySelector(".salaryEstimate");
    if (salaryEstimateElement) {
      const text = salaryEstimateElement.textContent.trim();
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
  }

  // Try to extract skills
  if (jobData.jobDescription) {
    // Common skill-related terms to help identify skill sections
    const skillSectionMarkers = [
      "skills required",
      "required skills",
      "qualifications",
      "requirements",
      "what you'll need",
      "what you need",
      "technical skills",
    ];

    // Look for these markers in the description
    let skillsSection = "";
    for (const marker of skillSectionMarkers) {
      const index = jobData.jobDescription.toLowerCase().indexOf(marker);
      if (index !== -1) {
        // Found a skills section, extract a chunk of text after it
        skillsSection = jobData.jobDescription.substring(index, index + 500);
        break;
      }
    }

    if (skillsSection) {
      // Extract bullet points from this section
      const bulletPoints = skillsSection.match(/[•\-\*]\s*([^\n•\-\*]+)/g);
      if (bulletPoints) {
        const skills = [];
        for (const point of bulletPoints) {
          const skill = point.replace(/[•\-\*]\s*/, "").trim();
          if (skill.length > 3) {
            skills.push(skill);
          }
        }
        jobData.skills = skills;
      }
    }
  }

  return jobData;
}
