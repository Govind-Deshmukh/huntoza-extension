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

  // Create sidebar container with improved animation
  const sidebar = document.createElement("div");
  sidebar.id = "pursuitpal-sidebar";
  sidebar.style.cssText = `
    position: fixed;
    top: 0;
    right: -450px; /* Start offscreen */
    width: 450px;
    height: 100vh;
    background: white;
    box-shadow: -5px 0 25px rgba(0,0,0,0.15);
    z-index: 2147483647;
    transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow-y: hidden;
    border-left: 1px solid rgba(229, 231, 235, 1);
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

  // Create improved backdrop overlay with blur effect
  const backdrop = document.createElement("div");
  backdrop.id = "pursuitpal-backdrop";
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0,0,0,0.3);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    z-index: 2147483646;
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
    pointer-events: none;
  `;
  backdrop.addEventListener("click", toggleSidebar);

  // Create loading indicator shown while iframe loads
  const loadingIndicator = document.createElement("div");
  loadingIndicator.id = "pursuitpal-loading";
  loadingIndicator.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: white;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 10;
    transition: opacity 0.3s ease-in-out;
  `;

  // Create spinner
  const spinner = document.createElement("div");
  spinner.style.cssText = `
    width: 40px;
    height: 40px;
    border: 3px solid rgba(79, 70, 229, 0.2);
    border-radius: 50%;
    border-top: 3px solid #4f46e5;
    animation: pursuitpal-spin 1s linear infinite;
    margin-bottom: 16px;
  `;

  // Add keyframes for spinner animation
  const style = document.createElement("style");
  style.textContent = `
    @keyframes pursuitpal-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // Create loading text
  const loadingText = document.createElement("div");
  loadingText.textContent = "Loading PursuitPal...";
  loadingText.style.cssText = `
    color: #4f46e5;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
  `;

  // Add elements to the DOM
  loadingIndicator.appendChild(spinner);
  loadingIndicator.appendChild(loadingText);
  sidebar.appendChild(loadingIndicator);
  sidebar.appendChild(iframe);
  document.body.appendChild(sidebar);
  document.body.appendChild(backdrop);

  // Handle iframe load event to hide loading indicator
  iframe.addEventListener("load", () => {
    // Fade out loading indicator
    loadingIndicator.style.opacity = "0";
    // Remove loading indicator after transition
    setTimeout(() => {
      if (loadingIndicator.parentNode) {
        loadingIndicator.parentNode.removeChild(loadingIndicator);
      }
    }, 300);
  });

  // Show sidebar (with slight delay for smoother animation)
  setTimeout(() => {
    // Slide in sidebar
    sidebar.style.right = "0";
    backdrop.style.opacity = "1";
    backdrop.style.pointerEvents = "auto";

    // Add class to body to prevent scrolling when sidebar is open
    document.body.classList.add("pursuitpal-sidebar-open");

    // Add scroll lock to body
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.top = `-${scrollY}px`;
  }, 50);

  // Function to toggle sidebar visibility with improved animations
  function toggleSidebar() {
    const sidebar = document.getElementById("pursuitpal-sidebar");
    const backdrop = document.getElementById("pursuitpal-backdrop");

    if (sidebar && sidebar.style.right === "0px") {
      // Hide sidebar
      sidebar.style.right = "-450px";
      backdrop.style.opacity = "0";
      backdrop.style.pointerEvents = "none";

      // Remove scroll lock from body
      document.body.classList.remove("pursuitpal-sidebar-open");
      const scrollY = document.body.style.top;
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
      window.scrollTo(0, parseInt(scrollY || "0") * -1);

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

      // Add class to body to prevent scrolling
      document.body.classList.add("pursuitpal-sidebar-open");

      // Add scroll lock to body
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.top = `-${scrollY}px`;
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

  // Handle escape key to close sidebar
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      const sidebar = document.getElementById("pursuitpal-sidebar");
      if (sidebar && sidebar.style.right === "0px") {
        toggleSidebar();
      }
    }
  });
})();
