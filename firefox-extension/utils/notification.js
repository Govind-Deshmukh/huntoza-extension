/**
 * utils/notification.js - Notification utilities
 *
 * Provides functions for displaying notifications to the user.
 */

/**
 * Show a notification message as an overlay
 *
 * @param {string} message - Message to display
 * @param {string} type - Notification type: 'success', 'error', 'info'
 * @param {number} duration - Duration in milliseconds
 */
export function showNotification(message, type = "success", duration = 3000) {
  // Primary color from PursuitPal
  const colors = {
    success: "#552dec",
    error: "#ef4444",
    info: "#3b82f6",
    warning: "#f59e0b",
  };

  const bgColor = colors[type] || colors.success;

  // Create notification element
  const notification = document.createElement("div");

  // Style the notification
  notification.style.position = "fixed";
  notification.style.top = "20px";
  notification.style.left = "50%";
  notification.style.transform = "translateX(-50%)";
  notification.style.backgroundColor = bgColor;
  notification.style.color = "white";
  notification.style.padding = "12px 24px";
  notification.style.borderRadius = "8px";
  notification.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
  notification.style.zIndex = "10000";
  notification.style.fontFamily = "system-ui, -apple-system, sans-serif";
  notification.style.fontSize = "14px";
  notification.style.transition = "opacity 0.3s";

  // Add content
  notification.textContent = message;

  // Add to the page
  document.body.appendChild(notification);

  // Remove after specified duration
  setTimeout(() => {
    notification.style.opacity = "0";
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, duration);
}

/**
 * Show a browser notification
 * This requires the notifications permission in the manifest
 *
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} iconUrl - URL to icon image
 */
export function showBrowserNotification(
  title,
  message,
  iconUrl = "../images/icon.png"
) {
  if (typeof browser !== "undefined" && browser.notifications) {
    browser.notifications.create({
      type: "basic",
      title: title,
      message: message,
      iconUrl: iconUrl,
    });
  }
}

/**
 * Update the extension's badge
 *
 * @param {string} text - Badge text
 * @param {string} color - Badge background color
 */
export function updateBadge(text, color = "#552dec") {
  if (typeof browser !== "undefined" && browser.browserAction) {
    // Firefox extension API
    browser.browserAction.setBadgeText({ text });
    browser.browserAction.setBadgeBackgroundColor({ color });
  }
}
