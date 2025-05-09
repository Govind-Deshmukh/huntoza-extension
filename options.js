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
  aiEnhancementEnabled: config
    ? config.isFeatureEnabled("aiEnhancement")
    : false,
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
  buyCreditsBtn.addEventListener("click", buyCredits);
  logoutBtn.addEventListener("click", handleLogout);
  retryProfileBtn.addEventListener("click", loadUserProfile);
  loginRedirectBtn.addEventListener("click", redirectToLogin);
});

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
    if (user.accountType) {
      accountType.textContent = user.accountType;
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
