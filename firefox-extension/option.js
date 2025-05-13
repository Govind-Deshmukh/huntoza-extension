/**
 * option.js - Options Page Script
 *
 * Handles loading and saving extension options
 */

// DOM Elements
const optionsForm = document.getElementById("optionsForm");
const autoExtractCheckbox = document.getElementById("autoExtract");
const showBadgeCheckbox = document.getElementById("showBadge");
const defaultPrioritySelect = document.getElementById("defaultPriority");
const defaultCurrencySelect = document.getElementById("defaultCurrency");
const statusMessage = document.getElementById("statusMessage");

// Default options
const defaultOptions = {
  autoExtract: true,
  showBadge: true,
  defaultPriority: "medium",
  defaultCurrency: "INR",
};

// Initialize the options page
document.addEventListener("DOMContentLoaded", () => {
  console.log("Options page initialized");

  // Load saved options
  loadOptions();

  // Set up form submission
  optionsForm.addEventListener("submit", saveOptions);
});

// Load saved options from storage
function loadOptions() {
  browser.storage.sync
    .get("options")
    .then((result) => {
      const options = result.options || defaultOptions;

      console.log("Loaded options:", options);

      // Update UI to match saved options
      autoExtractCheckbox.checked = options.autoExtract;
      showBadgeCheckbox.checked = options.showBadge;
      defaultPrioritySelect.value = options.defaultPriority;
      defaultCurrencySelect.value = options.defaultCurrency;
    })
    .catch((error) => {
      console.error("Error loading options:", error);
      showStatus("Error loading options. Using defaults.", "error");

      // Apply defaults
      autoExtractCheckbox.checked = defaultOptions.autoExtract;
      showBadgeCheckbox.checked = defaultOptions.showBadge;
      defaultPrioritySelect.value = defaultOptions.defaultPriority;
      defaultCurrencySelect.value = defaultOptions.defaultCurrency;
    });
}

// Save options to storage
function saveOptions(e) {
  e.preventDefault();

  const options = {
    autoExtract: autoExtractCheckbox.checked,
    showBadge: showBadgeCheckbox.checked,
    defaultPriority: defaultPrioritySelect.value,
    defaultCurrency: defaultCurrencySelect.value,
  };

  // Save to browser storage
  browser.storage.sync
    .set({ options })
    .then(() => {
      // Show success message
      showStatus("Settings saved successfully!", "success");

      // Hide message after 3 seconds
      setTimeout(() => {
        hideStatus();
      }, 3000);
    })
    .catch((error) => {
      console.error("Error saving options:", error);
      showStatus("Error saving settings. Please try again.", "error");
    });
}

// Show status message
function showStatus(message, type = "success") {
  statusMessage.textContent = message;
  statusMessage.classList.remove("hidden");

  if (type === "success") {
    statusMessage.classList.add("bg-green-100", "text-green-800");
    statusMessage.classList.remove("bg-red-100", "text-red-800");
  } else {
    statusMessage.classList.add("bg-red-100", "text-red-800");
    statusMessage.classList.remove("bg-green-100", "text-green-800");
  }
}

// Hide status message
function hideStatus() {
  statusMessage.classList.add("hidden");
}
