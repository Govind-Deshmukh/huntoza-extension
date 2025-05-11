/**
 * PursuitPal - Options Script
 *
 * Handles loading and saving extension options
 */

// DOM Elements
const autoExtractCheckbox = document.getElementById("autoExtract");
const saveButton = document.getElementById("saveOptions");
const statusMessage = document.getElementById("statusMessage");

// Default options
const defaultOptions = {
  autoExtract: true,
};

// Initialize the options page
document.addEventListener("DOMContentLoaded", () => {
  // Load saved options
  loadOptions();

  // Set up event listeners
  saveButton.addEventListener("click", saveOptions);
});

// Load saved options from storage
function loadOptions() {
  chrome.storage.sync.get("options", (result) => {
    const options = result.options || defaultOptions;

    // Update UI to match saved options
    autoExtractCheckbox.checked = options.autoExtract;
  });
}

// Save options to storage
function saveOptions() {
  const options = {
    autoExtract: autoExtractCheckbox.checked,
  };

  // Save to Chrome storage
  chrome.storage.sync.set({ options }, () => {
    // Show success message
    showStatusMessage("Settings saved successfully!", "success");

    // Hide message after 3 seconds
    setTimeout(() => {
      hideStatusMessage();
    }, 3000);
  });
}

// Show status message
function showStatusMessage(message, type = "success") {
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
function hideStatusMessage() {
  statusMessage.classList.add("hidden");
}
