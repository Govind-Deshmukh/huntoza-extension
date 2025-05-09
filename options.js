/**
 * PursuitPal - Options Script
 *
 * This script manages the options page functionality:
 * - Loads saved options
 * - Handles form submissions
 * - Updates UI based on user selections
 */

// DOM Elements
const apiUrlInput = document.getElementById("apiUrl");
const trackApplicationsInApp = document.getElementById(
  "trackApplicationsInApp"
);
const autoExtractOnPageLoad = document.getElementById("autoExtractOnPageLoad");
const aiEnhancementEnabled = document.getElementById("aiEnhancementEnabled");
const aiSettingsContainer = document.getElementById("aiSettingsContainer");
const aiCredits = document.getElementById("aiCredits");
const aiCreditsBar = document.getElementById("aiCreditsBar");
const buyCreditsBtn = document.getElementById("buyCreditsBtn");
const saveOptionsBtn = document.getElementById("saveOptions");
const statusMessage = document.getElementById("statusMessage");

// Default options
const defaultOptions = {
  apiUrl: "http://localhost:3000/api",
  trackApplicationsInApp: true,
  autoExtractOnPageLoad: true,
  aiEnhancementEnabled: false,
};

// Initialize the options page
document.addEventListener("DOMContentLoaded", () => {
  // Load saved options
  loadOptions();

  // Setup event listeners
  aiEnhancementEnabled.addEventListener("change", updateAISettingsVisibility);
  saveOptionsBtn.addEventListener("click", saveOptions);
  buyCreditsBtn.addEventListener("click", buyCredits);
});

// Load options from storage
function loadOptions() {
  chrome.storage.sync.get("options", (result) => {
    const options = result.options || defaultOptions;

    // Set form values
    apiUrlInput.value = options.apiUrl || defaultOptions.apiUrl;
    trackApplicationsInApp.checked = options.trackApplicationsInApp !== false;
    autoExtractOnPageLoad.checked = options.autoExtractOnPageLoad !== false;
    aiEnhancementEnabled.checked = options.aiEnhancementEnabled !== false;

    // Update UI based on loaded options
    updateAISettingsVisibility();

    // Load AI credits
    loadAICredits();
  });
}

// Update visibility of AI settings based on checkbox
function updateAISettingsVisibility() {
  if (aiEnhancementEnabled.checked) {
    aiSettingsContainer.classList.remove("hidden");
  } else {
    aiSettingsContainer.classList.add("hidden");
  }
}

// Load AI credits from the API or storage
function loadAICredits() {
  // In a real implementation, you would fetch this from your API
  // For demo, we'll just use mock data

  // Simulate API call delay
  setTimeout(() => {
    const credits = {
      available: 45,
      total: 100,
      percentUsed: 45,
    };

    // Update UI with credits info
    aiCredits.textContent = `${credits.available}/${credits.total}`;
    aiCreditsBar.style.width = `${credits.percentUsed}%`;
  }, 500);
}

// Save options to storage
function saveOptions() {
  const options = {
    apiUrl: apiUrlInput.value,
    trackApplicationsInApp: trackApplicationsInApp.checked,
    autoExtractOnPageLoad: autoExtractOnPageLoad.checked,
    aiEnhancementEnabled: aiEnhancementEnabled.checked,
  };

  chrome.storage.sync.set({ options }, () => {
    // Show success message
    showStatusMessage("Settings saved successfully!", "success");
  });
}

// Navigate to buy credits page
function buyCredits() {
  // In a real implementation, you would redirect to your payment page
  // For demo, we'll just open a mock URL
  chrome.tabs.create({ url: "http://localhost:3000/buy-credits" });
}

// Show status message
function showStatusMessage(message, type = "success") {
  statusMessage.textContent = message;
  statusMessage.classList.remove(
    "hidden",
    "bg-green-100",
    "text-green-800",
    "bg-red-100",
    "text-red-800"
  );

  if (type === "success") {
    statusMessage.classList.add("bg-green-100", "text-green-800");
  } else {
    statusMessage.classList.add("bg-red-100", "text-red-800");
  }

  // Hide message after a delay
  setTimeout(() => {
    statusMessage.classList.add("hidden");
  }, 3000);
}
