/**
 * content/storage.js - Storage utilities
 *
 * Handles storing and retrieving job data from localStorage and browser storage.
 */

/**
 * Store job data in localStorage for web app to access
 *
 * @param {Object} data - Job data to store
 * @param {string} [key="pendingJobData"] - Storage key
 * @return {boolean} - Success status
 */
export function storeJobData(data, key = "pendingJobData") {
  try {
    // First clear any existing data to prevent issues with old data
    localStorage.removeItem(key);

    // Store new data
    localStorage.setItem(key, JSON.stringify(data));
    console.log(`Job data stored in localStorage with key ${key}:`, data);

    // Add timestamp to data to track when it was stored
    data._timestamp = Date.now();

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
    // Check if we already processed this data in this session
    const processedFlags =
      sessionStorage.getItem("pursuitpal_processed_data") || "[]";
    const processed = JSON.parse(processedFlags);

    // Get URL parameters
    const url = new URL(window.location.href);
    const jobDataId = url.searchParams.get("jobDataId");

    // If there's a jobDataId and we've already processed it, don't do it again
    if (jobDataId && processed.includes(jobDataId)) {
      return false;
    }

    // Check for job data
    const pendingJobData = localStorage.getItem("pendingJobData");
    if (pendingJobData) {
      console.log("Found job data in localStorage");

      try {
        // Parse data to make sure it's valid
        const parsedData = JSON.parse(pendingJobData);

        // Check if the data is fresh enough (less than 30 seconds old)
        const dataTimestamp = parsedData._timestamp || 0;
        const isDataFresh = Date.now() - dataTimestamp < 30000; // 30 seconds

        if (!isDataFresh) {
          console.log("Data is stale, clearing it");
          localStorage.removeItem("pendingJobData");
          return false;
        }

        // Notify application
        window.dispatchEvent(
          new CustomEvent("jobDataAvailable", {
            detail: { source: "firefoxExtension", data: parsedData },
          })
        );

        // Mark this data as processed
        if (jobDataId) {
          processed.push(jobDataId);
          sessionStorage.setItem(
            "pursuitpal_processed_data",
            JSON.stringify(processed)
          );
        }

        return true;
      } catch (e) {
        console.error("Error parsing pending job data:", e);
        localStorage.removeItem("pendingJobData");
        return false;
      }
    }
    return false;
  } catch (error) {
    console.error("Error checking for extension data:", error);
    return false;
  }
}

/**
 * Save job data to browser's local storage with a unique ID
 *
 * @param {Object} data - Job data to save
 * @return {Promise<string>} - Promise resolving to the storage key
 */
export async function saveToStorageWithId(data) {
  try {
    // Generate a unique ID
    const jobId = Date.now().toString();
    const key = `pendingJobData_${jobId}`;

    // Add timestamp
    const jobData = {
      ...data,
      timestamp: Date.now(),
      _id: jobId,
    };

    await browser.storage.local.set({ [key]: jobData });

    // Also save as the current job data
    await browser.storage.local.set({ currentJobData: jobData });

    return jobId;
  } catch (error) {
    console.error(`Error saving data:`, error);
    throw error;
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
 * Clear all cached job data from localStorage
 */
export function clearLocalJobData() {
  try {
    localStorage.removeItem("pendingJobData");
    console.log("Cleared pendingJobData from localStorage");
    return true;
  } catch (error) {
    console.error("Error clearing job data:", error);
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

/**
 * Check if the user is authenticated with PursuitPal web app
 *
 * @return {Promise<boolean>} - Promise resolving to authentication status
 */
export async function checkWebAppAuth() {
  try {
    const response = await fetch(
      "https://api.pursuitpal.app/api/v1/auth/check-session",
      {
        method: "GET",
        credentials: "include",
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data.isAuthenticated === true;
    }

    return false;
  } catch (error) {
    console.error("Error checking web app auth:", error);
    return false;
  }
}
