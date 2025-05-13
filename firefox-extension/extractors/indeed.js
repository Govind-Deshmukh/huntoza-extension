/**
 * extractors/indeed.js - Indeed specific job data extractor
 *
 * Extracts job details from Indeed job posting pages.
 */

/**
 * Extract job data from Indeed
 *
 * @return {Object} - Extracted Indeed job data
 */
export function extractIndeedJob() {
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

  // Look for skills and requirements
  if (jobData.jobDescription) {
    // Extract skills mentioned in requirements sections
    const skillsSection = jobData.jobDescription.match(
      /requirements:|qualifications:|skills:|what you('ll| will) need:/i
    );

    if (skillsSection) {
      // Get the position of the match
      const startPos = jobData.jobDescription.indexOf(skillsSection[0]);
      if (startPos !== -1) {
        // Extract a chunk of text after this header
        const chunk = jobData.jobDescription.substring(
          startPos,
          startPos + 500
        );

        // Extract skills from bullet points if any
        const skills = [];
        const bulletPoints = chunk.match(/[•\-\*]\s*([^\n•\-\*]+)/g);

        if (bulletPoints) {
          bulletPoints.forEach((point) => {
            const skill = point.replace(/[•\-\*]\s*/, "").trim();
            if (skill.length > 3) {
              skills.push(skill);
            }
          });

          // Add skills to jobData
          jobData.skills = skills;
        }
      }
    }
  }

  return jobData;
}
