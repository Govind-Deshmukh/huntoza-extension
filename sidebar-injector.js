/**
 * PursuitPal - Sidebar Injector
 *
 * This script injects the sidebar UI into the current webpage
 * and handles its visibility and interactions.
 */

(function () {
  // Check if sidebar already exists
  if (document.getElementById("pursuitpal-sidebar")) {
    toggleSidebar();
    return;
  }

  // Create sidebar container
  const sidebar = document.createElement("div");
  sidebar.id = "pursuitpal-sidebar";
  sidebar.style.cssText = `
    position: fixed;
    top: 0;
    right: -450px; /* Start offscreen */
    width: 450px;
    height: 100vh;
    background: white;
    box-shadow: -2px 0 10px rgba(0,0,0,0.2);
    z-index: 2147483647;
    transition: right 0.3s ease-in-out;
    overflow-y: hidden;
  `;

  // Create iframe to load extension content
  const iframe = document.createElement("iframe");
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
    background: white;
  `;
  iframe.src = chrome.runtime.getURL("sidebar.html");

  // Optional: Create backdrop overlay
  const backdrop = document.createElement("div");
  backdrop.id = "pursuitpal-backdrop";
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0,0,0,0.5);
    z-index: 2147483646;
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
    pointer-events: none;
  `;
  backdrop.addEventListener("click", toggleSidebar);

  // Add elements to the DOM
  sidebar.appendChild(iframe);
  document.body.appendChild(sidebar);
  document.body.appendChild(backdrop);

  // Show sidebar (with slight delay for smoother animation)
  setTimeout(() => {
    sidebar.style.right = "0";
    backdrop.style.opacity = "1";
    backdrop.style.pointerEvents = "auto";
  }, 50);

  // Function to toggle sidebar visibility
  function toggleSidebar() {
    const sidebar = document.getElementById("pursuitpal-sidebar");
    const backdrop = document.getElementById("pursuitpal-backdrop");

    if (sidebar && sidebar.style.right === "0px") {
      // Hide sidebar
      sidebar.style.right = "-450px";
      backdrop.style.opacity = "0";
      backdrop.style.pointerEvents = "none";

      // Optionally remove elements after animation completes
      setTimeout(() => {
        if (sidebar && sidebar.style.right === "-450px") {
          document.body.removeChild(sidebar);
          document.body.removeChild(backdrop);
        }
      }, 300);
    } else if (sidebar) {
      // Show sidebar
      sidebar.style.right = "0";
      backdrop.style.opacity = "1";
      backdrop.style.pointerEvents = "auto";
    }
  }

  // Handle messages from extension sidebar iframe
  window.addEventListener("message", function (event) {
    // Verify the message is from our extension
    if (event.data && event.data.source === "pursuitpal-sidebar") {
      if (event.data.action === "closeSidebar") {
        toggleSidebar();
      } else if (event.data.action === "extractData") {
        // Trigger content script to extract data
        if (typeof chrome !== "undefined" && chrome.runtime) {
          chrome.runtime.sendMessage({ action: "extractJobData" });
        }
      }
    }
  });
})();
