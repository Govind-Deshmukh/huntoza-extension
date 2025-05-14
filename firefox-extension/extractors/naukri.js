/**
 * extractors/naukri.js - Naukri specific job data extractor
 *
 * Extracts job details from Naukri.com job posting pages.
 */

/**
 * Extract job data from Naukri.com
 *
 * @return {Object} - Extracted Naukri job data
 */
export function extractNaukriJob() {
  const jobData = {
    company: "",
    position: "",
    jobLocation: "",
    jobType: "",
    jobDescription: "",
    salary: { min: 0, max: 0, currency: "INR" },
    skills: [],
    notes: "",
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
    // Since Naukri doesn't directly expose employment type in a uniform way, we'll check several places

    // Try to find the employment type in the job description
    if (jobData.jobDescription) {
      if (/full[- ]time|permanent/i.test(jobData.jobDescription)) {
        jobData.jobType = "full-time";
      } else if (/part[- ]time/i.test(jobData.jobDescription)) {
        jobData.jobType = "part-time";
      } else if (/contract|temporary/i.test(jobData.jobDescription)) {
        jobData.jobType = "contract";
      } else if (/internship|intern/i.test(jobData.jobDescription)) {
        jobData.jobType = "internship";
      } else if (/remote|work from home|wfh/i.test(jobData.jobDescription)) {
        jobData.jobType = "remote";
      }
    }

    // Try to find job type in other sections
    const detailSections = document.querySelectorAll(
      ".styles_details__Y424J, .detail-box"
    );
    for (const section of detailSections) {
      const label = section.querySelector("label");
      if (label && label.textContent.includes("Employment Type")) {
        const valueElement = section.querySelector("span");
        if (valueElement) {
          const typeText = valueElement.textContent.toLowerCase().trim();

          if (
            typeText.includes("full time") ||
            typeText.includes("permanent")
          ) {
            jobData.jobType = "full-time";
          } else if (typeText.includes("part time")) {
            jobData.jobType = "part-time";
          } else if (
            typeText.includes("contract") ||
            typeText.includes("temporary")
          ) {
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

    // Role Category
    const roleElement = document.querySelector(
      'label:contains("Role Category"), .role-category'
    );
    if (roleElement) {
      const roleParent = roleElement.closest(
        ".styles_details__Y424J, .detail-box"
      );
      if (roleParent) {
        const roleValue = roleParent.querySelector("span");
        if (roleValue) {
          jobData.roleCategory = roleValue.textContent.trim();
        }
      }
    }

    // If we have a role category, add it to notes
    if (jobData.roleCategory && jobData.notes) {
      jobData.notes += "\nRole Category: " + jobData.roleCategory;
    } else if (jobData.roleCategory) {
      jobData.notes = "Role Category: " + jobData.roleCategory;
    }

    console.log("Extracted Naukri job data:", jobData);
    return jobData;
  } catch (error) {
    console.error("Error extracting Naukri job data:", error);
    return jobData;
  }
}
