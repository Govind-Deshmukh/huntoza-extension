/**
 * Job Hunt Assist - Background Script
 *
 * This script runs in the background and handles:
 * 1. Communication between popup and content scripts
 * 2. AI enhancement of job data
 * 3. API communication with the job tracker app
 */

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveJobData") {
    // Save job data to storage
    chrome.storage.local.set({ jobData: request.data });
  } else if (request.action === "enhanceWithAI") {
    // Enhance job data with AI
    enhanceJobData(request.data)
      .then((enhancedData) => {
        sendResponse(enhancedData);
      })
      .catch((error) => {
        console.error("Error enhancing job data:", error);
        sendResponse(null);
      });
    return true; // Keep the message channel open for async response
  }
});

// Install event - set up initial storage and defaults
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Set default options
    chrome.storage.sync.set({
      options: {
        aiEnhancementEnabled: true,
        autoExtractOnPageLoad: true,
        trackApplicationsInApp: true,
        apiUrl: "https://your-job-tracker-app.com/api",
      },
    });
  }
});

// Function to enhance job data using AI
async function enhanceJobData(jobData) {
  try {
    // Get API URL from options
    const options = await getOptions();
    const apiUrl = options.apiUrl || "https://your-job-tracker-app.com/api";

    // In a real implementation, you would make an API call to your backend
    // For now, let's just simulate AI enhancement with a timeout

    // Simulated AI enhancement
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Example of enhanced data (in a real implementation, this would come from the API)
    const enhancedData = {
      ...jobData,
      // Enhanced fields
      jobDescription: improveJobDescription(jobData.jobDescription),
      salary: improveSalary(jobData.salary, jobData.company, jobData.position),
      jobType: improveJobType(jobData.jobType, jobData.jobDescription),
    };

    return enhancedData;

    /* Real implementation would look like:
    const response = await fetch(`${apiUrl}/enhance-job-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jobData),
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
    */
  } catch (error) {
    console.error("Error in enhanceJobData:", error);
    return jobData; // Return original data on error
  }
}

// Helper function to get extension options from storage
function getOptions() {
  return new Promise((resolve) => {
    chrome.storage.sync.get("options", (result) => {
      resolve(result.options || {});
    });
  });
}

// Simple simulation of AI improvement for job description
function improveJobDescription(description) {
  if (!description) return "";

  // For demo purposes, we'll just append a note
  return (
    description +
    "\n\n[Enhanced by AI: This description has been analyzed for key skills and responsibilities. The role appears to emphasize teamwork, problem-solving, and technical expertise.]"
  );
}

// Simple simulation of AI improvement for salary information
function improveSalary(salary, company, position) {
  // If salary is already provided, return it
  if (salary.min > 0 || salary.max > 0) {
    return salary;
  }

  // Otherwise, generate a simulated salary range based on position
  let min = 0;
  let max = 0;

  // Very basic simulation - in a real app, this would use ML to predict
  if (position.toLowerCase().includes("senior")) {
    min = 90000;
    max = 150000;
  } else if (position.toLowerCase().includes("manager")) {
    min = 100000;
    max = 180000;
  } else if (position.toLowerCase().includes("director")) {
    min = 150000;
    max = 250000;
  } else if (position.toLowerCase().includes("intern")) {
    min = 20000;
    max = 40000;
  } else {
    min = 60000;
    max = 100000;
  }

  return {
    min,
    max,
    currency: salary.currency || "INR",
  };
}

// Simple simulation of AI improvement for job type
function improveJobType(jobType, description) {
  if (jobType !== "full-time") {
    return jobType; // Keep non-default job types
  }

  // If description mentions remote work, update job type
  if (
    description &&
    description.toLowerCase().match(/remote|work from home|wfh/i)
  ) {
    return "remote";
  }

  // If description mentions contract or temporary, update job type
  if (
    description &&
    description.toLowerCase().match(/contract|temporary|fixed term/i)
  ) {
    return "contract";
  }

  return jobType;
}
