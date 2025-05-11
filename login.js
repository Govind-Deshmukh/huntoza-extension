/**
 * PursuitPal - Enhanced Login Script
 *
 * This script handles user authentication with improved security:
 * - Form validation
 * - API communication for login and token refresh
 * - Secure token storage
 * - Redirection after successful login
 * - Protection against brute force attacks
 * - Input sanitization
 */

// DOM Elements
const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const rememberCheckbox = document.getElementById("remember");
const loginButton = document.getElementById("login-button");
const loginLoading = document.getElementById("login-loading");
const errorMessage = document.getElementById("error-message");
const signupLink = document.getElementById("signup-link");

// Constants
const APP_BASE_URL = "https://pursuitpal.app";

// Security-related variables
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds
let loginAttempts = 0;
let loginLockoutUntil = 0;

// Initialize the page
document.addEventListener("DOMContentLoaded", async () => {
  // Check for login lockout
  await checkLoginLockout();

  // Check if user is already logged in
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
    // Open signup page in a new tab
    const signupUrl = `${APP_BASE_URL}/register`;
    chrome.tabs.create({ url: signupUrl });
  });

  // Implement password field show/hide toggle
  setupPasswordToggle();

  // Fill in saved email if available and check Remember Me
  chrome.storage.sync.get(["rememberedEmail"], (result) => {
    if (result.rememberedEmail) {
      emailInput.value = result.rememberedEmail;
      rememberCheckbox.checked = true;
    }
  });

  // Add input validation
  emailInput.addEventListener("blur", validateEmail);

  // Add enhanced security features
  applySecurityFeatures();
});

/**
 * Check if login is locked out due to too many attempts
 */
async function checkLoginLockout() {
  const lockoutData = await chrome.storage.local.get([
    "loginAttempts",
    "loginLockoutUntil",
  ]);

  if (lockoutData.loginAttempts) {
    loginAttempts = lockoutData.loginAttempts;
  }

  if (
    lockoutData.loginLockoutUntil &&
    lockoutData.loginLockoutUntil > Date.now()
  ) {
    loginLockoutUntil = lockoutData.loginLockoutUntil;

    // Display lockout message and disable form
    showError(
      `Too many failed login attempts. Please wait ${formatLockoutTime(
        loginLockoutUntil - Date.now()
      )} before trying again.`
    );
    disableLoginForm();

    // Set timer to re-enable form when lockout expires
    const waitTime = loginLockoutUntil - Date.now();
    if (waitTime > 0) {
      setTimeout(() => {
        enableLoginForm();
        hideError();
      }, waitTime);
    }
  }
}

/**
 * Format lockout time in minutes and seconds
 */
function formatLockoutTime(milliseconds) {
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""} and ${seconds} second${
      seconds !== 1 ? "s" : ""
    }`;
  } else {
    return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  }
}

/**
 * Enable login form
 */
function enableLoginForm() {
  loginButton.disabled = false;
  emailInput.disabled = false;
  passwordInput.disabled = false;
  rememberCheckbox.disabled = false;
}

/**
 * Disable login form
 */
function disableLoginForm() {
  loginButton.disabled = true;
  emailInput.disabled = true;
  passwordInput.disabled = true;
  rememberCheckbox.disabled = true;
}

/**
 * Setup password toggle visibility
 */
function setupPasswordToggle() {
  const passwordContainer = passwordInput.parentElement;

  // Create toggle button
  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className =
    "absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none";
  toggleButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  `;

  // Add event listener
  toggleButton.addEventListener("click", () => {
    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      toggleButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      `;
    } else {
      passwordInput.type = "password";
      toggleButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      `;
    }
  });

  // Position the container relatively
  passwordContainer.style.position = "relative";

  // Add button to container
  passwordContainer.appendChild(toggleButton);
}

/**
 * Apply security features to the login page
 */
function applySecurityFeatures() {
  // Add password strength meter
  addPasswordStrengthMeter();

  // Implement throttling on form submission
  let lastSubmitTime = 0;
  const THROTTLE_DELAY = 1000; // 1 second

  const originalSubmit = loginForm.submit;
  loginForm.submit = function () {
    const now = Date.now();
    if (now - lastSubmitTime < THROTTLE_DELAY) {
      console.log("Form submission throttled");
      return false;
    }

    lastSubmitTime = now;
    return originalSubmit.apply(this, arguments);
  };

  // Add autocomplete attributes for better security
  emailInput.setAttribute("autocomplete", "username");
  passwordInput.setAttribute("autocomplete", "current-password");
}

/**
 * Add password strength meter
 */
function addPasswordStrengthMeter() {
  const passwordContainer = passwordInput.parentElement;

  // Create strength meter
  const strengthMeter = document.createElement("div");
  strengthMeter.className =
    "w-full h-1 mt-1 bg-gray-200 rounded-full overflow-hidden hidden";

  const strengthBar = document.createElement("div");
  strengthBar.className = "h-full transition-all duration-300 ease-in-out";
  strengthMeter.appendChild(strengthBar);

  // Create strength text
  const strengthText = document.createElement("div");
  strengthText.className = "text-xs mt-1 hidden";

  // Add elements to container
  passwordContainer.appendChild(strengthMeter);
  passwordContainer.appendChild(strengthText);

  // Add event listener to password input
  passwordInput.addEventListener("input", () => {
    const password = passwordInput.value;
    if (password.length > 0) {
      strengthMeter.classList.remove("hidden");
      strengthText.classList.remove("hidden");

      const strength = checkPasswordStrength(password);
      updatePasswordStrengthUI(strength, strengthBar, strengthText);
    } else {
      strengthMeter.classList.add("hidden");
      strengthText.classList.add("hidden");
    }
  });
}

/**
 * Check password strength
 * @param {string} password Password to check
 * @returns {number} Strength score (0-4)
 */
function checkPasswordStrength(password) {
  let score = 0;

  // Length check
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;

  // Character variety checks
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  // Normalize score to 0-4
  return Math.min(4, Math.floor(score / 1.5));
}

/**
 * Update password strength UI
 */
function updatePasswordStrengthUI(strength, bar, text) {
  // Update bar color and width
  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-green-400",
    "bg-green-500",
  ];
  const widths = ["w-1/4", "w-2/4", "w-3/4", "w-full", "w-full"];
  const messages = ["Very weak", "Weak", "Medium", "Strong", "Very strong"];

  // Remove all possible classes
  bar.className = "h-full transition-all duration-300 ease-in-out";

  // Add appropriate classes
  bar.classList.add(colors[strength]);
  bar.classList.add(widths[strength]);

  // Update text
  text.textContent = messages[strength];
  text.className = `text-xs mt-1 ${colors[strength].replace("bg-", "text-")}`;
}

/**
 * Validate email format
 */
function validateEmail() {
  const email = emailInput.value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (email && !emailRegex.test(email)) {
    showInlineError(emailInput, "Please enter a valid email address");
    return false;
  } else {
    hideInlineError(emailInput);
    return true;
  }
}

/**
 * Show inline error message for an input
 */
function showInlineError(input, message) {
  const container = input.parentElement;

  // Remove any existing error message
  const existingError = container.querySelector(".error-message");
  if (existingError) existingError.remove();

  // Add error class to input
  input.classList.add("border-red-500");

  // Create and add error message
  const errorElement = document.createElement("p");
  errorElement.className = "text-red-500 text-xs mt-1 error-message";
  errorElement.textContent = message;
  container.appendChild(errorElement);
}

/**
 * Hide inline error message for an input
 */
function hideInlineError(input) {
  const container = input.parentElement;

  // Remove error class from input
  input.classList.remove("border-red-500");

  // Remove error message
  const existingError = container.querySelector(".error-message");
  if (existingError) existingError.remove();
}

/**
 * Handle login form submission with enhanced security
 */
async function handleLogin(e) {
  e.preventDefault();

  // Check for lockout
  if (loginLockoutUntil > Date.now()) {
    showError(
      `Too many failed login attempts. Please wait ${formatLockoutTime(
        loginLockoutUntil - Date.now()
      )} before trying again.`
    );
    return;
  }

  // Validate form
  if (!validateForm()) {
    return;
  }

  // Show loading state
  setLoadingState(true);

  // Hide any previous error
  hideError();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    // Use the enhanced AuthService for login
    const result = await authService.login(email, password);

    // Handle successful login
    if (result.success) {
      // Reset login attempts
      await resetLoginAttempts();

      // Save email if "remember me" is checked
      if (rememberCheckbox.checked) {
        await chrome.storage.sync.set({ rememberedEmail: email });
      } else {
        await chrome.storage.sync.remove(["rememberedEmail"]);
      }

      // Show success message briefly before redirecting
      showSuccessMessage("Login successful. Redirecting...");

      // Redirect to main popup after short delay
      setTimeout(() => {
        window.location.href = "popup.html";
      }, 1000);
    }
  } catch (error) {
    console.error("Login error:", error);

    // Increment failed login attempts
    await incrementLoginAttempts();

    // Show appropriate error message
    showError(error.message || "Failed to login. Please try again.");
    setLoadingState(false);
  }
}

/**
 * Validate the login form
 * @returns {boolean} True if form is valid
 */
function validateForm() {
  let isValid = true;

  // Validate email
  const email = emailInput.value.trim();
  if (!email) {
    showInlineError(emailInput, "Email is required");
    isValid = false;
  } else if (!validateEmail()) {
    isValid = false;
  }

  // Validate password
  const password = passwordInput.value;
  if (!password) {
    showInlineError(passwordInput, "Password is required");
    isValid = false;
  } else {
    hideInlineError(passwordInput);
  }

  return isValid;
}

/**
 * Increment failed login attempts
 */
async function incrementLoginAttempts() {
  loginAttempts++;

  // Save to storage
  await chrome.storage.local.set({ loginAttempts });

  // Check if we need to implement lockout
  if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
    loginLockoutUntil = Date.now() + LOGIN_LOCKOUT_TIME;
    await chrome.storage.local.set({ loginLockoutUntil });

    // Disable form during lockout
    disableLoginForm();

    // Show lockout message
    showError(
      `Too many failed login attempts. Account locked for ${formatLockoutTime(
        LOGIN_LOCKOUT_TIME
      )}.`
    );

    // Set timer to re-enable form
    setTimeout(() => {
      enableLoginForm();
      hideError();
    }, LOGIN_LOCKOUT_TIME);
  }
}

/**
 * Reset login attempts counter
 */
async function resetLoginAttempts() {
  loginAttempts = 0;
  loginLockoutUntil = 0;
  await chrome.storage.local.remove(["loginAttempts", "loginLockoutUntil"]);
}

/**
 * Check if user is authenticated and has valid tokens
 * Uses the enhanced AuthService
 */
async function checkAuthentication() {
  try {
    const isAuthenticated = await authService.isAuthenticated();
    return { isAuthenticated };
  } catch (error) {
    console.error("Auth check error:", error);
    return { isAuthenticated: false };
  }
}

/**
 * Set loading state of the form
 */
function setLoadingState(isLoading) {
  if (isLoading) {
    loginButton.disabled = true;
    loginButton.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Signing in...
    `;
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
 * Show error message to user with enhanced styling
 */
function showError(message) {
  if (message) {
    errorMessage.innerHTML = `
      <div class="flex items-center">
        <svg class="h-4 w-4 text-red-500 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <span>${sanitizeHTML(message)}</span>
      </div>
    `;
    errorMessage.classList.remove("hidden");
  } else {
    hideError();
  }
}

/**
 * Hide error message
 */
function hideError() {
  errorMessage.textContent = "";
  errorMessage.classList.add("hidden");
}

/**
 * Show success message
 */
function showSuccessMessage(message) {
  errorMessage.innerHTML = `
    <div class="flex items-center bg-green-50 p-3 text-green-700 border border-green-200 rounded-md">
      <svg class="h-4 w-4 text-green-500 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>
      <span>${sanitizeHTML(message)}</span>
    </div>
  `;
  errorMessage.classList.remove("hidden");
}

/**
 * Sanitize HTML to prevent XSS
 */
function sanitizeHTML(text) {
  const element = document.createElement("div");
  element.textContent = text;
  return element.innerHTML;
}
