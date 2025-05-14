/**
 * extractors/index.js - Extractor registry and common functions
 *
 * This module serves as the central registry for all job extractors
 * and provides common utilities for job data extraction.
 */

// Import all extractors
import { extractLinkedInJob } from "./linkedin.js";
import { extractIndeedJob } from "./indeed.js";
import { extractGlassdoorJob } from "./glassdoor.js";
import { extractNaukriJob } from "./naukri.js";
import { extractGenericJob } from "./generic.js";

/**
 * Detect which job platform we're on based on the URL
 *
 * @param {string} url - Page URL to analyze
 * @return {string} - Platform identifier (linkedin, indeed, glassdoor, naukri, or generic)
 */
export function detectJobPlatform(url) {
  if (!url) return "generic";

  if (url.includes("linkedin.com/jobs") || url.includes("linkedin.com/job/")) {
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
 * Registry of all available extractors mapped to their platform identifiers
 */
const extractors = {
  linkedin: extractLinkedInJob,
  indeed: extractIndeedJob,
  glassdoor: extractGlassdoorJob,
  naukri: extractNaukriJob,
  generic: extractGenericJob,
};

/**
 * Main function to extract job data from the current page
 *
 * @return {Object} - Extracted and normalized job data
 */
export function extractJobData() {
  console.log("Extraction function called");
  try {
    const url = window.location.href;
    console.log("Current URL:", url);

    // Detect which job platform we're on
    const platform = detectJobPlatform(url);
    console.log("Detected platform:", platform);

    // Use platform specific extractor function
    const extractor = extractors[platform] || extractGenericJob;
    const jobData = extractor();

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

// Export all extractors
export {
  extractLinkedInJob,
  extractIndeedJob,
  extractGlassdoorJob,
  extractNaukriJob,
  extractGenericJob,
};
