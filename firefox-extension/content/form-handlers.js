// content/form-handlers.js
/**
 * content/form-handlers.js - Form handling utilities
 *
 * Handles injecting job data into forms on the PursuitPal web app.
 */

import { showNotification } from "../utils/notification.js";
import { clearLocalJobData, clearSessionData } from "./storage.js";

/**
 * Inject job data into the PursuitPal form
 * Called when users want to auto-fill the job form
 *
 * @param {Object} data - Job data to inject into form
 * @return {boolean} - Success status
 */
export function injectJobData(data) {
  // Check if we're on the PursuitPal job form page
  if (
    !window.location.href.includes("pursuitpal.app/jobs/new") &&
    !window.location.href.includes("pursuitpal.app/jobs/edit")
  ) {
    console.log("Not on PursuitPal job form page, cannot inject data");
    return false;
  }

  console.log("Attempting to inject job data into PursuitPal form", data);

  // Generate a unique ID for this injection to prevent conflicts
  const injectionId = `injection_${Date.now()}`;

  // Function to retry injection until the form is ready
  const attemptInjection = (retryCount = 0, maxRetries = 10) => {
    // If we've tried too many times, give up
    if (retryCount >= maxRetries) {
      console.error("Failed to inject job data after max retries");
      return false;
    }

    // Check if the form is loaded
    const formElements =
      document.querySelector('input[name="company"]') ||
      document.querySelector("form") ||
      document.querySelector(".job-form");

    if (!formElements) {
      console.log(
        `Form not ready yet, retry ${retryCount + 1} of ${maxRetries}`
      );
      // Wait longer between retries as we go
      setTimeout(
        () => attemptInjection(retryCount + 1, maxRetries),
        500 * Math.pow(1.5, retryCount)
      ); // Exponential backoff
      return;
    }

    console.log("Form found, attempting to fill in data");

    // Wait a bit more to make sure React has fully initialized
    setTimeout(() => {
      try {
        // CRITICAL: Clear any existing form data first
        clearFormFields();

        // Clear local storage data from previous injections
        clearLocalJobData();

        // Clear session data related to injections
        clearSessionData();

        // Basic job information
        fillInputField("company", data.company);
        fillInputField("position", data.position);
        fillInputField("jobLocation", data.jobLocation);
        fillSelectField("jobType", data.jobType);

        // Salary information
        fillInputField("salary.min", data.salary.min);
        fillInputField("salary.max", data.salary.max);
        fillSelectField("salary.currency", data.salary.currency);

        // Additional fields
        fillInputField("jobUrl", data.jobUrl);
        fillTextareaField("jobDescription", data.jobDescription);
        fillSelectField("priority", data.priority);
        fillCheckboxField("favorite", data.favorite);

        // Set application date if provided
        if (data.applicationDate) {
          fillInputField("applicationDate", data.applicationDate);
        }

        // Add notes if provided
        if (data.notes) {
          fillTextareaField("notes", data.notes);
        }

        console.log("Form auto-filled successfully");

        // Notify user that form has been filled
        showNotification("Form auto-filled successfully!");

        return true;
      } catch (error) {
        console.error("Error filling form:", error);
        showNotification("Error filling form: " + error.message, "error");
        return false;
      }
    }, 500);
  };

  // Start the injection process
  attemptInjection();
  return true;
}

/**
 * Clear all form fields before injection
 * This prevents data from previous injections persisting
 */
function clearFormFields() {
  // Find all form input elements
  const inputFields = document.querySelectorAll(
    'input:not([type="submit"]), textarea, select'
  );

  for (const field of inputFields) {
    if (field.type === "checkbox" || field.type === "radio") {
      field.checked = false;
    } else {
      field.value = "";
    }

    // Trigger events to notify React
    triggerInputEvent(field);
  }

  console.log("Form fields cleared");
}

/**
 * Fill input field with value and trigger change events
 *
 * @param {string} name - Input field name
 * @param {*} value - Value to fill
 */
export function fillInputField(name, value) {
  if (value === undefined || value === null) return;

  const field = document.querySelector(`input[name="${name}"]`);
  if (field) {
    field.value = value;
    triggerInputEvent(field);
    console.log(`Filled input field ${name} with value ${value}`);
  } else {
    console.warn(`Could not find input field ${name}`);
  }
}

/**
 * Fill textarea field with value and trigger change events
 *
 * @param {string} name - Textarea field name
 * @param {string} value - Value to fill
 */
export function fillTextareaField(name, value) {
  if (value === undefined || value === null) return;

  const field = document.querySelector(`textarea[name="${name}"]`);
  if (field) {
    field.value = value;
    triggerInputEvent(field);
    console.log(`Filled textarea field ${name}`);
  } else {
    console.warn(`Could not find textarea field ${name}`);
  }
}

/**
 * Fill select field with value and trigger change events
 *
 * @param {string} name - Select field name
 * @param {string} value - Value to select
 */
export function fillSelectField(name, value) {
  if (value === undefined || value === null) return;

  const field = document.querySelector(`select[name="${name}"]`);
  if (field) {
    field.value = value;
    triggerInputEvent(field);
    console.log(`Filled select field ${name} with value ${value}`);
  } else {
    console.warn(`Could not find select field ${name}`);
  }
}

/**
 * Set checkbox field to checked state and trigger change events
 *
 * @param {string} name - Checkbox field name
 * @param {boolean} checked - Checked state
 */
export function fillCheckboxField(name, checked) {
  const field = document.querySelector(
    `input[name="${name}"][type="checkbox"]`
  );
  if (field) {
    field.checked = checked;
    triggerInputEvent(field);
    console.log(`Set checkbox field ${name} to ${checked}`);
  } else {
    console.warn(`Could not find checkbox field ${name}`);
  }
}

/**
 * Trigger appropriate events on form elements to notify React of changes
 *
 * @param {HTMLElement} element - DOM element to trigger events on
 */
export function triggerInputEvent(element) {
  // Create and dispatch input event
  const inputEvent = new Event("input", { bubbles: true });
  element.dispatchEvent(inputEvent);

  // Create and dispatch change event
  const changeEvent = new Event("change", { bubbles: true });
  element.dispatchEvent(changeEvent);

  // For React controlled inputs, we need to manually set the value property
  // and then trigger the events
  const oldValue = element.value;

  // Try to access the React internal properties (this is hacky but often works)
  if (element._valueTracker) {
    element._valueTracker.setValue("");
  }

  // Reset the value and dispatch events
  if (element.type === "checkbox" || element.type === "radio") {
    const mouseEvent = new MouseEvent("click", { bubbles: true });
    element.dispatchEvent(mouseEvent);
  } else {
    element.value = oldValue;
    element.dispatchEvent(inputEvent);
    element.dispatchEvent(changeEvent);
  }
}

/**
 * Wait for an element to be present in the DOM
 *
 * @param {string} selector - CSS selector to wait for
 * @param {number} timeout - Timeout in milliseconds
 * @return {Promise<HTMLElement>} - Resolves with the element once available
 */
export function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Reject if element doesn't appear within timeout
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element not found: ${selector}`));
    }, timeout);
  });
}
