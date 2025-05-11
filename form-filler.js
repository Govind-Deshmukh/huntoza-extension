/**
 * PursuitPal - Form Filler Script
 *
 * This script is injected directly into the React app when needed,
 * to fill form fields with extracted job data.
 */

(function () {
  // Check if we're on the job form page
  const isJobFormPage = () => {
    return window.location.href.includes("/jobs/new");
  };

  if (!isJobFormPage()) {
    return;
  }

  console.log("Form filler script loaded on job form page");

  // Get job data from Chrome extension storage
  chrome.storage.local.get(["pendingJobApplication"], function (result) {
    if (!result.pendingJobApplication) {
      console.log("No pending job application data found");
      return;
    }

    const jobData = result.pendingJobApplication;
    console.log("Job data retrieved from storage:", jobData);

    // Ensure the React form is fully loaded before filling
    const maxAttempts = 10;
    let attempts = 0;

    function attemptFillForm() {
      if (attempts >= maxAttempts) {
        console.error("Failed to fill form after maximum attempts");
        return;
      }

      attempts++;

      // Check if the form components are loaded
      const companyInput = document.querySelector('input[name="company"]');
      if (!companyInput) {
        console.log(
          `Form not ready yet, attempt ${attempts}. Retrying in 500ms...`
        );
        setTimeout(attemptFillForm, 500);
        return;
      }

      // Form is ready, fill it with job data
      fillFormWithJobData(jobData);
    }

    // Start the fill process after a short delay
    setTimeout(attemptFillForm, 1000);
  });

  // Function to fill form fields with job data
  function fillFormWithJobData(jobData) {
    try {
      console.log("Filling form with job data...");

      // Basic job information
      fillInputField("company", jobData.company);
      fillInputField("position", jobData.position);
      fillInputField("jobLocation", jobData.jobLocation);
      fillSelectField("jobType", jobData.jobType);

      // Salary information
      fillInputField("salary.min", jobData.salary.min);
      fillInputField("salary.max", jobData.salary.max);
      fillSelectField("salary.currency", jobData.salary.currency);

      // Job description and URL
      fillTextareaField("jobDescription", jobData.jobDescription);
      fillInputField("jobUrl", jobData.jobUrl);

      // Additional fields
      fillSelectField("priority", jobData.priority);
      fillCheckboxField("favorite", jobData.favorite || false);

      console.log("Form filled successfully!");

      // Optional: Show success message to user
      showFeedbackToUser(
        "Form auto-filled with job data from " + jobData.company
      );

      // Clean up - remove the data from storage
      chrome.storage.local.remove("pendingJobApplication");
    } catch (error) {
      console.error("Error filling form:", error);
    }
  }

  // Helper functions to fill different form field types
  function fillInputField(name, value) {
    if (!value) return;

    const field = document.querySelector(`input[name="${name}"]`);
    if (field) {
      field.value = value;
      triggerReactEvents(field);
    }
  }

  function fillTextareaField(name, value) {
    if (!value) return;

    const field = document.querySelector(`textarea[name="${name}"]`);
    if (field) {
      field.value = value;
      triggerReactEvents(field);
    }
  }

  function fillSelectField(name, value) {
    if (!value) return;

    const field = document.querySelector(`select[name="${name}"]`);
    if (field) {
      field.value = value;
      triggerReactEvents(field);
    }
  }

  function fillCheckboxField(name, checked) {
    const field = document.querySelector(
      `input[name="${name}"][type="checkbox"]`
    );
    if (field) {
      field.checked = checked;
      triggerReactEvents(field);
    }
  }

  // Function to trigger necessary React events for state update
  function triggerReactEvents(element) {
    // React uses native browser events
    // Input event - for tracking value changes
    const inputEvent = new Event("input", { bubbles: true });
    element.dispatchEvent(inputEvent);

    // Change event - for completing the update
    const changeEvent = new Event("change", { bubbles: true });
    element.dispatchEvent(changeEvent);
  }

  // Show feedback notification to the user
  function showFeedbackToUser(message) {
    // Set primary color
    const primaryColor = "#552dec";

    // Create notification element
    const notification = document.createElement("div");
    notification.style.position = "fixed";
    notification.style.top = "20px";
    notification.style.left = "50%";
    notification.style.transform = "translateX(-50%)";
    notification.style.backgroundColor = primaryColor;
    notification.style.color = "white";
    notification.style.padding = "10px 20px";
    notification.style.borderRadius = "4px";
    notification.style.zIndex = "10000";
    notification.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
    notification.textContent = message;

    // Add to the page
    document.body.appendChild(notification);

    // Remove after 5 seconds
    setTimeout(() => {
      notification.style.opacity = "0";
      notification.style.transition = "opacity 0.5s";
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 500);
    }, 5000);
  }
})();
