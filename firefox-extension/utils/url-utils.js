// utils/url-utils.js
/**
 * url-utils.js - URL utility functions
 */

/**
 * Check if URL is a job board
 *
 * @param {string} url - URL to check
 * @return {boolean} - True if URL is a job board
 */
export function isJobBoardUrl(url) {
  const jobBoardPatterns = [
    /linkedin\.com\/jobs/i,
    /indeed\.com\/viewjob/i,
    /glassdoor\.com\/job/i,
    /monster\.com\/job/i,
    /naukri\.com\/job-listings/i,
    /naukri\.com\/.+-jobs/i,
    /ziprecruiter\.com\/jobs/i,
    /lever\.co\/[^\/]+\/jobs/i,
    /greenhouse\.io\/jobs/i,
    /careers\./i,
    /jobs\./i,
    /\/jobs?\//i,
    /\/careers?\//i,
    /\/job\-details/i,
  ];

  return jobBoardPatterns.some((pattern) => pattern.test(url));
}

/**
 * Extract parameters from URL
 *
 * @param {string} url - URL to extract parameters from
 * @return {Object} - Object containing URL parameters
 */
export function getUrlParameters(url) {
  try {
    const urlObj = new URL(url);
    const params = {};

    for (const [key, value] of urlObj.searchParams.entries()) {
      params[key] = value;
    }

    return params;
  } catch (e) {
    console.error("Error extracting URL parameters:", e);
    return {};
  }
}
