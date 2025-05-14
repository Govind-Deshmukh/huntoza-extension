// utils/auth.js
/**
 * utils/auth.js - Authentication utilities
 *
 * Handles authentication with PursuitPal web app.
 */

/**
 * Check if user is authenticated with PursuitPal web app
 *
 * @return {Promise<Object>} - Promise resolving to authentication status and user data
 */
export async function checkPursuitPalAuth() {
  try {
    const response = await fetch(
      "https://api.pursuitpal.app/api/v1/auth/check-extension-auth",
      {
        method: "GET",
        credentials: "include",
      }
    );

    if (response.ok) {
      const data = await response.json();
      return { isAuthenticated: true, user: data.user };
    } else {
      return { isAuthenticated: false };
    }
  } catch (error) {
    console.error("Error checking PursuitPal auth:", error);
    return { isAuthenticated: false, error: error.message };
  }
}

/**
 * Open PursuitPal login page
 *
 * @param {string} [returnPath="/dashboard"] - Path to return to after login
 * @return {Promise<Object>} - Promise resolving to tab data
 */
export async function openPursuitPalLogin(returnPath = "/dashboard") {
  try {
    const encodedPath = encodeURIComponent(returnPath);
    const loginUrl = `https://pursuitpal.app/login?redirect=${encodedPath}&extension=true`;

    // Create a new tab with the login URL
    const tab = await browser.tabs.create({ url: loginUrl });
    return { success: true, tab };
  } catch (error) {
    console.error("Error opening PursuitPal login:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if user is logged in to PursuitPal web app from content script
 *
 * @return {Promise<boolean>} - Promise resolving to authentication status
 */
export function checkAuthFromContent() {
  return new Promise((resolve) => {
    // Send message to background script to check auth
    browser.runtime
      .sendMessage({ action: "checkAuth" })
      .then((response) => {
        resolve(response.isAuthenticated === true);
      })
      .catch((error) => {
        console.error("Error checking auth from content:", error);
        resolve(false);
      });
  });
}
