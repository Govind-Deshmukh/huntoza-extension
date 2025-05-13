/**
 * content/storage.js - Storage utilities
 *
 * Handles storing and retrieving job data from localStorage and browser storage.
 */

/**
 * Store job data in localStorage for web app to access
 *
 * @param {Object} data - Job data to store
 * @return {boolean} - Success status
 */
export function storeJobData(data) {
  try {
    localStorage.setItem("pendingJobData", JSON.stringify(data));
    console.log("Job data stored in localStorage:", data);
    return true;
  } catch (error) {
    console.error("Error storing job data:", error);
    return false;
  }
}

/**
 * Check if there's pending job data in localStorage
 * and dispatch an event if found
 *
 * @return {boolean} - True if data was found
 */
export function checkForExtensionData() {
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

/**
 * Save job data to browser's local storage
 *
 * @param {Object} data - Job data to save
 * @param {string} key - Storage key, defaults to 'currentJobData'
 * @return {Promise<boolean>} - Promise resolving to success status
 */
export async function saveToStorage(data, key = "currentJobData") {
  try {
    // Add timestamp
    const jobData = {
      ...data,
      timestamp: Date.now(),
    };

    await browser.storage.local.set({ [key]: jobData });
    return true;
  } catch (error) {
    console.error(`Error saving data to ${key}:`, error);
    return false;
  }
}

/**
 * Retrieve job data from browser's local storage
 *
 * @param {string} key - Storage key to retrieve
 * @return {Promise<Object|null>} - Promise resolving to job data or null
 */
export async function getFromStorage(key) {
  try {
    const data = await browser.storage.local.get(key);
    return data[key] || null;
  } catch (error) {
    console.error(`Error retrieving data from ${key}:`, error);
    return null;
  }
}

/**
 * Remove job data from browser's local storage
 *
 * @param {string} key - Storage key to remove
 * @return {Promise<boolean>} - Promise resolving to success status
 */
export async function removeFromStorage(key) {
  try {
    await browser.storage.local.remove(key);
    return true;
  } catch (error) {
    console.error(`Error removing data from ${key}:`, error);
    return false;
  }
}

/**
 * Get extension options from sync storage
 *
 * @return {Promise<Object>} - Promise resolving to options object
 */
export async function getExtensionOptions() {
  try {
    const data = await browser.storage.sync.get("options");
    return (
      data.options || {
        autoExtract: true,
        showBadge: true,
        defaultPriority: "medium",
        defaultCurrency: "INR",
      }
    );
  } catch (error) {
    console.error("Error getting extension options:", error);
    // Return defaults
    return {
      autoExtract: true,
      showBadge: true,
      defaultPriority: "medium",
      defaultCurrency: "INR",
    };
  }
}
