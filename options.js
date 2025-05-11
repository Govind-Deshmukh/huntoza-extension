/**
 * PursuitPal - Options Script
 *
 * This script manages the options page functionality:
 * - Loads saved options
 * - Handles form submissions
 * - Updates UI based on user selections
 * - Manages user profile and logout functionality
 */

// Get configuration
const config = window.configLoader
  ? window.configLoader.getConfig()
  : window.appConfig;

// DOM Elements - Settings
const autoExtractOnPageLoad = document.getElementById("autoExtractOnPageLoad");
const aiEnhancementEnabled = document.getElementById("aiEnhancementEnabled");
const aiSettingsContainer = document.getElementById("aiSettingsContainer");
const aiCredits = document.getElementById("aiCredits");
const aiCreditsBar = document.getElementById("aiCreditsBar");
const buyCreditsBtn = document.getElementById("buyCreditsBtn");
const saveOptionsBtn = document.getElementById("saveOptions");
const statusMessage = document.getElementById("statusMessage");

// DOM Elements - Tabs
const settingsTabBtn = document.getElementById("settings-tab-btn");
const profileTabBtn = document.getElementById("profile-tab-btn");
const settingsTab = document.getElementById("settings-tab");
const profileTab = document.getElementById("profile-tab");

// DOM Elements - Profile
const userProfileContainer = document.getElementById("user-profile-container");
const userName = document.getElementById("user-name");
const userEmail = document.getElementById("user-email");
const userInitial = document.getElementById("user-initial");
const profileLoading = document.getElementById("profile-loading");
const profileContent = document.getElementById("profile-content");
const profileError = document.getElementById("profile-error");
const profileUnauthorized = document.getElementById("profile-unauthorized");
const profileName = document.getElementById("profile-name");
const profileEmail = document.getElementById("profile-email");
const profileInitial = document.getElementById("profile-initial");
const accountType = document.getElementById("account-type");
const lastLogin = document.getElementById("last-login");
const logoutBtn = document.getElementById("logout-btn");
const retryProfileBtn = document.getElementById("retry-profile-btn");
const loginRedirectBtn = document.getElementById("login-redirect-btn");

// Default options
const defaultOptions = {
  autoExtractOnPageLoad: true,
  aiEnhancementEnabled: false,
};

// Initialize the options page
document.addEventListener("DOMContentLoaded", async () => {
  // Setup tab switching
  setupTabs();

  // Check authentication and load user info
  await checkAuthAndLoadUserInfo();

  // Load saved options
  loadOptions();

  // Setup event listeners
  aiEnhancementEnabled.addEventListener("change", updateAISettingsVisibility);
  saveOptionsBtn.addEventListener("click", saveOptions);
  logoutBtn.addEventListener("click", handleLogout);
  retryProfileBtn.addEventListener("click", loadUserProfile);
  loginRedirectBtn.addEventListener("click", redirectToLogin);

  // Show AI enhancement as coming soon
  setupAIEnhancementComingSoon();
});

/**
 * Setup AI Enhancement as coming soon
 */
function setupAIEnhancementComingSoon() {
  // Find the parent container of AI Enhancement
  const aiEnhancementContainer = document.querySelector(
    ".bg-white.rounded-lg.shadow-md.p-6.mb-6:nth-child(2)"
  );

  if (aiEnhancementContainer) {
    // Create coming soon element
    const comingSoonDiv = document.createElement("div");
    comingSoonDiv.className =
      "flex items-center justify-center py-4 bg-gray-50 rounded-md border border-dashed border-gray-300 mt-2";
    comingSoonDiv.innerHTML = `
      <span class="bg-primary bg-opacity-20 text-primary text-xs font-semibold px-2.5 py-0.5 rounded-full mr-2">Soon</span>
      <span class="text-gray-600 text-sm">AI Enhancement is coming soon!</span>
    `;

    // Replace the AI settings with coming soon message
    if (aiSettingsContainer) {
      aiSettingsContainer.innerHTML = "";
      aiSettingsContainer.appendChild(comingSoonDiv);
    }

    // Disable the AI enhancement checkbox
    if (aiEnhancementEnabled) {
      aiEnhancementEnabled.disabled = true;
      aiEnhancementEnabled.checked = false;

      // Add a tooltip or disabled style to parent
      const aiEnhancementLabel = aiEnhancementEnabled.closest("label");
      if (aiEnhancementLabel) {
        aiEnhancementLabel.classList.add("text-gray-400");
      }
    }
  }
}

// Setup tab switching functionality
function setupTabs() {
  settingsTabBtn.addEventListener("click", () => {
    // Show settings tab, hide profile tab
    settingsTabBtn.classList.add("text-primary", "border-primary");
    settingsTabBtn.classList.remove("text-gray-500", "border-transparent");
    profileTabBtn.classList.add("text-gray-500", "border-transparent");
    profileTabBtn.classList.remove("text-primary", "border-primary");

    settingsTab.classList.remove("hidden");
    profileTab.classList.add("hidden");
  });

  profileTabBtn.addEventListener("click", () => {
    // Show profile tab, hide settings tab
    profileTabBtn.classList.add("text-primary", "border-primary");
    profileTabBtn.classList.remove("text-gray-500", "border-transparent");
    settingsTabBtn.classList.add("text-gray-500", "border-transparent");
    settingsTabBtn.classList.remove("text-primary", "border-primary");

    profileTab.classList.remove("hidden");
    settingsTab.classList.add("hidden");

    // Make sure profile is loaded
    loadUserProfile();
  });
}

// Check authentication and load user info
async function checkAuthAndLoadUserInfo() {
  // Check if the auth service is available
  if (typeof authService === "undefined") {
    console.error("Auth service not found");
    return;
  }

  try {
    const isAuthenticated = await authService.isAuthenticated();

    if (!isAuthenticated) {
      // If not authenticated, show the unauthorized state in the profile tab
      profileUnauthorized.classList.remove("hidden");
      profileLoading.classList.add("hidden");
      return;
    }

    // Load user info for the header
    const user = await authService.getCurrentUser();

    if (user) {
      updateUIWithUserInfo(user);
    }
  } catch (error) {
    console.error("Error checking authentication:", error);
  }
}

// Update UI with user info
function updateUIWithUserInfo(user) {
  // Update header user info
  if (userProfileContainer) {
    userProfileContainer.classList.remove("hidden");
    userName.textContent = user.name || "User";
    userEmail.textContent = user.email || "";
    userInitial.textContent = getUserInitial(user.name || user.email || "U");
  }
}

/**
 * Get user's initial for avatar
 * @param {string} nameOrEmail - User's name or email
 * @returns {string} - User's initial (single character)
 */
function getUserInitial(nameOrEmail) {
  if (!nameOrEmail) return "U";

  // If it's an email, use the first character of the local part
  if (nameOrEmail.includes("@")) {
    return nameOrEmail.split("@")[0].charAt(0).toUpperCase();
  }

  // If it's a name, use the first character
  return nameOrEmail.charAt(0).toUpperCase();
}

// Load user profile for the profile tab
async function loadUserProfile() {
  // Reset UI states
  profileLoading.classList.remove("hidden");
  profileContent.classList.add("hidden");
  profileError.classList.add("hidden");
  profileUnauthorized.classList.add("hidden");

  try {
    const isAuthenticated = await authService.isAuthenticated();

    if (!isAuthenticated) {
      profileUnauthorized.classList.remove("hidden");
      profileLoading.classList.add("hidden");
      return;
    }

    // Load user profile from API
    const user = await authService.getCurrentUser();

    if (!user) {
      throw new Error("Failed to load user profile");
    }

    // Update profile UI with user data
    profileName.textContent = user.name || "User";
    profileEmail.textContent = user.email || "";
    profileInitial.textContent = getUserInitial(user.name || user.email || "U");

    // Additional profile data (if available)
    if (user.currentPlan) {
      accountType.textContent = "Standard"; // Hardcoded for now
    }

    if (user.lastLogin) {
      const lastLoginDate = new Date(user.lastLogin);
      lastLogin.textContent = lastLoginDate.toLocaleString();
    }

    // Show profile content
    profileContent.classList.remove("hidden");
    profileLoading.classList.add("hidden");
  } catch (error) {
    console.error("Error loading user profile:", error);
    profileError.classList.remove("hidden");
    profileLoading.classList.add("hidden");
  }
}

/**
 * Load saved options from storage
 */
function loadOptions() {
  chrome.storage.sync.get("options", (result) => {
    const options = result.options || defaultOptions;

    // Update checkboxes to reflect saved options
    autoExtractOnPageLoad.checked = options.autoExtractOnPageLoad !== false;

    // AI Enhancement is disabled since it's coming soon
    if (aiEnhancementEnabled) {
      aiEnhancementEnabled.checked = false;
      aiEnhancementEnabled.disabled = true;
    }

    // Always show AI settings container for "Coming Soon" message
    if (aiSettingsContainer) {
      aiSettingsContainer.classList.remove("hidden");
    }
  });
}

/**
 * Update AI settings container visibility based on checkbox
 */
function updateAISettingsVisibility() {
  // Always visible for coming soon message
  if (aiSettingsContainer) {
    aiSettingsContainer.classList.remove("hidden");
  }
}

/**
 * Save options to storage
 */
function saveOptions() {
  const options = {
    autoExtractOnPageLoad: autoExtractOnPageLoad.checked,
    aiEnhancementEnabled: false, // Always false for now
  };

  chrome.storage.sync.set({ options }, () => {
    // Show success message
    showStatusMessage("Settings saved successfully!", "success");
  });
}

/**
 * Show status message
 * @param {string} message - Message to display
 * @param {string} type - Message type (success, error)
 */
function showStatusMessage(message, type = "success") {
  if (!statusMessage) return;

  // Set message classes based on type
  statusMessage.className = "mt-4 p-4 rounded-md";

  if (type === "success") {
    statusMessage.classList.add("bg-green-100", "text-green-800");
  } else if (type === "error") {
    statusMessage.classList.add("bg-red-100", "text-red-800");
  }

  // Set message text
  statusMessage.textContent = message;

  // Show message
  statusMessage.classList.remove("hidden");

  // Hide message after delay
  setTimeout(() => {
    statusMessage.classList.add("hidden");
  }, 3000);
}

/**
 * Handle logout
 */
async function handleLogout() {
  try {
    // Show loading state
    document.body.classList.add("cursor-wait");
    logoutBtn.disabled = true;

    // Call auth service to logout
    await authService.logout();

    // Redirect to login page
    redirectToLogin();
  } catch (error) {
    console.error("Logout error:", error);
    showStatusMessage("Failed to logout. Please try again.", "error");

    // Reset UI
    document.body.classList.remove("cursor-wait");
    logoutBtn.disabled = false;
  }
}

/**
 * Redirect to login page
 */
function redirectToLogin() {
  window.location.href = "login.html";
}
