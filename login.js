/**
 * PursuitPal - Login Script
 *
 * This script handles user authentication:
 * - Form submission
 * - API communication for login and token refresh
 * - Secure token storage
 * - Redirection after successful login
 */

// Get configuration
const config = window.configLoader
  ? window.configLoader.getConfig()
  : window.appConfig;

// API Base URL from config
const API_BASE_URL = config
  ? config.apiBaseUrl
  : "https://api.pursuitpal.app/api/v1";

// DOM Elements
const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const rememberCheckbox = document.getElementById("remember");
const loginButton = document.getElementById("login-button");
const loginLoading = document.getElementById("login-loading");
const errorMessage = document.getElementById("error-message");
const signupLink = document.getElementById("signup-link");

// Check if user is already logged in
document.addEventListener("DOMContentLoaded", async () => {
  const authState = await checkAuthentication();

  if (authState.isAuthenticated) {
    // User is already logged in, redirect to popup.html
    window.location.href = "popup.html";
  }

  // Add form submission event listener
  loginForm.addEventListener("submit", handleLogin);

  // Add signup link event listener
  signupLink.addEventListener("click", (e) => {
    e.preventDefault();
    // Open signup page in a new tab using config for URL
    const signupUrl = config
      ? config.getAppUrl(config.routes.register)
      : "https://pursuitpal.app/register";
    chrome.tabs.create({ url: signupUrl });
  });

  // Fill in saved email if available
  chrome.storage.sync.get(["rememberedEmail"], (result) => {
    if (result.rememberedEmail) {
      emailInput.value = result.rememberedEmail;
      rememberCheckbox.checked = true;
    }
  });
});

/**
 * Handle login form submission
 */
async function handleLogin(e) {
  e.preventDefault();

  // Show loading state
  setLoadingState(true);

  // Hide any previous error
  showError("");

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  // Validate form
  if (!email || !password) {
    showError("Please enter both email and password");
    setLoadingState(false);
    return;
  }

  try {
    // Get login endpoint from config
    const loginEndpoint = config
      ? config.getApiUrl("auth/login")
      : `${API_BASE_URL}/auth/login`;

    // Call login API
    const response = await fetch(loginEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Invalid credentials");
    }

    // Handle successful login
    const { token, refreshToken, user } = data;

    // Save authentication data
    await saveAuthData(token, refreshToken, user);

    // Save email if "remember me" is checked
    if (rememberCheckbox.checked) {
      chrome.storage.sync.set({ rememberedEmail: email });
    } else {
      chrome.storage.sync.remove(["rememberedEmail"]);
    }

    // Redirect to main popup
    window.location.href = "popup.html";
  } catch (error) {
    console.error("Login error:", error);
    showError(error.message || "Failed to login. Please try again.");
    setLoadingState(false);
  }
}

/**
 * Save authentication data securely
 */
async function saveAuthData(token, refreshToken, user) {
  // Get token expiry from config or use default
  const tokenExpiryDuration =
    config && config.auth ? config.auth.tokenExpiry : 3600 * 1000;

  // Store tokens in Chrome's secure storage (encrypted)
  await chrome.storage.local.set({
    token: token,
    refreshToken: refreshToken,
    user: user,
    tokenExpiry: Date.now() + tokenExpiryDuration, // Token valid based on config
  });
}

/**
 * Check if user is authenticated and has valid tokens
 * Attempts to refresh token if needed
 */
async function checkAuthentication() {
  try {
    // Get current auth state
    const authData = await chrome.storage.local.get([
      "token",
      "refreshToken",
      "tokenExpiry",
      "user",
    ]);

    const { token, refreshToken, tokenExpiry, user } = authData;

    // If no tokens, user is not authenticated
    if (!token || !refreshToken) {
      return { isAuthenticated: false };
    }

    // If token is expired, try to refresh
    if (Date.now() >= tokenExpiry) {
      try {
        const newTokens = await refreshAccessToken(refreshToken);
        return { isAuthenticated: true, user };
      } catch (error) {
        // Token refresh failed
        await clearAuthData();
        return { isAuthenticated: false };
      }
    }

    // Token exists and is valid
    return { isAuthenticated: true, user };
  } catch (error) {
    console.error("Auth check error:", error);
    return { isAuthenticated: false };
  }
}

/**
 * Refresh the access token using refresh token
 */
async function refreshAccessToken(refreshToken) {
  // Get refresh token endpoint from config
  const refreshEndpoint = config
    ? config.getApiUrl("auth/refresh-token")
    : `${API_BASE_URL}/auth/refresh-token`;

  // Call refresh token API
  const response = await fetch(refreshEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error("Failed to refresh token");
  }

  // Get token expiry from config or use default
  const tokenExpiryDuration =
    config && config.auth ? config.auth.tokenExpiry : 3600 * 1000;

  // Save new tokens
  await chrome.storage.local.set({
    token: data.token,
    refreshToken: data.refreshToken,
    tokenExpiry: Date.now() + tokenExpiryDuration, // Token valid based on config
  });

  return { token: data.token, refreshToken: data.refreshToken };
}

/**
 * Clear all authentication data on logout or error
 */
async function clearAuthData() {
  await chrome.storage.local.remove([
    "token",
    "refreshToken",
    "tokenExpiry",
    "user",
  ]);
}

/**
 * Set loading state of the form
 */
function setLoadingState(isLoading) {
  if (isLoading) {
    loginButton.disabled = true;
    loginButton.textContent = "";
    loginButton.classList.add("opacity-75");
    loginLoading.classList.remove("hidden");
  } else {
    loginButton.disabled = false;
    loginButton.textContent = "Sign in";
    loginButton.classList.remove("opacity-75");
    loginLoading.classList.add("hidden");
  }
}

/**
 * Show error message to user
 */
function showError(message) {
  if (message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove("hidden");
  } else {
    errorMessage.textContent = "";
    errorMessage.classList.add("hidden");
  }
}
