/**
 * PursuitPal - Options Script
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
