/**
 * utils/api.js - API client for PursuitPal backend
 *
 * Provides a consistent interface for making API requests to the PursuitPal backend.
 */

// Base URL for API requests
const API_BASE_URL = "https://api.pursuitpal.app/api/v1";

/**
 * Make an authenticated API request
 *
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {Object} options - Fetch options
 * @param {string} [authToken] - Authentication token
 * @return {Promise<Object>} - Promise resolving to API response
 */
export async function apiRequest(endpoint, options = {}, authToken = null) {
  try {
    // Get auth token from storage if not provided
    if (!authToken) {
      const data = await browser.storage.local.get("authToken");
      authToken = data.authToken;
    }

    // Prepare fetch options
    const fetchOptions = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(options.headers || {}),
      },
    };

    // Make request
    const response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);

    // Parse response
    const contentType = response.headers.get("content-type");
    let data;

    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Check for errors
    if (!response.ok) {
      const errorMessage = data.message || data.error || response.statusText;
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    console.error(`API request error (${endpoint}):`, error);
    throw error;
  }
}

/**
 * Validate authentication token
 *
 * @param {string} token - Authentication token to validate
 * @return {Promise<boolean>} - Promise resolving to token validity
 */
export async function validateToken(token) {
  try {
    const response = await apiRequest(
      "/auth/validate",
      {
        method: "POST",
      },
      token
    );

    return response.valid === true;
  } catch (error) {
    console.error("Error validating token:", error);
    return false;
  }
}

/**
 * Login to PursuitPal
 *
 * @param {Object} credentials - Login credentials
 * @param {string} credentials.email - User email
 * @param {string} credentials.password - User password
 * @return {Promise<Object>} - Promise resolving to login response
 */
export async function login(credentials) {
  try {
    return await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

/**
 * Logout from PursuitPal
 *
 * @param {string} [authToken] - Authentication token
 * @return {Promise<boolean>} - Promise resolving to logout success
 */
export async function logout(authToken = null) {
  try {
    await apiRequest(
      "/auth/logout",
      {
        method: "POST",
      },
      authToken
    );
    return true;
  } catch (error) {
    console.error("Logout error:", error);
    return false;
  }
}

/**
 * Send job data to API
 *
 * @param {Object} jobData - Job data to send
 * @param {string} [authToken] - Authentication token
 * @return {Promise<Object>} - Promise resolving to API response
 */
export async function sendJobData(jobData, authToken = null) {
  try {
    return await apiRequest(
      "/jobs",
      {
        method: "POST",
        body: JSON.stringify(jobData),
      },
      authToken
    );
  } catch (error) {
    console.error("Error sending job data:", error);
    throw error;
  }
}

/**
 * Update job data in API
 *
 * @param {string} jobId - ID of job to update
 * @param {Object} jobData - Updated job data
 * @param {string} [authToken] - Authentication token
 * @return {Promise<Object>} - Promise resolving to API response
 */
export async function updateJobData(jobId, jobData, authToken = null) {
  try {
    return await apiRequest(
      `/jobs/${jobId}`,
      {
        method: "PUT",
        body: JSON.stringify(jobData),
      },
      authToken
    );
  } catch (error) {
    console.error("Error updating job data:", error);
    throw error;
  }
}

/**
 * Get user profile
 *
 * @param {string} [authToken] - Authentication token
 * @return {Promise<Object>} - Promise resolving to user profile
 */
export async function getUserProfile(authToken = null) {
  try {
    return await apiRequest(
      "/user/profile",
      {
        method: "GET",
      },
      authToken
    );
  } catch (error) {
    console.error("Error getting user profile:", error);
    throw error;
  }
}

/**
 * Refresh authentication token
 *
 * @param {string} refreshToken - Refresh token
 * @return {Promise<Object>} - Promise resolving to refresh response
 */
export async function refreshAuthToken(refreshToken) {
  try {
    return await apiRequest("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  } catch (error) {
    console.error("Error refreshing auth token:", error);
    throw error;
  }
}

/**
 * Get job list
 *
 * @param {Object} [filters] - Optional filters
 * @param {number} [page=1] - Page number
 * @param {string} [authToken] - Authentication token
 * @return {Promise<Object>} - Promise resolving to jobs list
 */
export async function getJobs(filters = {}, page = 1, authToken = null) {
  try {
    // Build query string
    const queryParams = new URLSearchParams({
      page,
      ...filters,
    }).toString();

    return await apiRequest(
      `/jobs?${queryParams}`,
      {
        method: "GET",
      },
      authToken
    );
  } catch (error) {
    console.error("Error getting jobs:", error);
    throw error;
  }
}

/**
 * Get job by ID
 *
 * @param {string} jobId - Job ID
 * @param {string} [authToken] - Authentication token
 * @return {Promise<Object>} - Promise resolving to job data
 */
export async function getJobById(jobId, authToken = null) {
  try {
    return await apiRequest(
      `/jobs/${jobId}`,
      {
        method: "GET",
      },
      authToken
    );
  } catch (error) {
    console.error("Error getting job by ID:", error);
    throw error;
  }
}

/**
 * Delete job
 *
 * @param {string} jobId - Job ID
 * @param {string} [authToken] - Authentication token
 * @return {Promise<boolean>} - Promise resolving to delete success
 */
export async function deleteJob(jobId, authToken = null) {
  try {
    await apiRequest(
      `/jobs/${jobId}`,
      {
        method: "DELETE",
      },
      authToken
    );
    return true;
  } catch (error) {
    console.error("Error deleting job:", error);
    throw error;
  }
}
