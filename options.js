/**
 * PursuitPal - Options Script
 *
 * This script manages the options page functionality:
 * - Loads saved options
 * - Handles form submissions
 * - Updates UI based on user selections
 * - Manages user profile and logout functionality
 */

// Hardcoded URLs
const API_BASE_URL = "https://api.pursuitpal.app/api/v1";
const APP_BASE_URL = "https://pursuitpal.app";

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
