/**
 * utils/dom-utils.js - DOM manipulation utilities
 *
 * Provides helper functions for working with the DOM.
 */

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

/**
 * Try different selectors and return the first matching element
 *
 * @param {string[]} selectors - Array of CSS selectors to try
 * @return {HTMLElement|null} - First matching element or null if none found
 */
export function queryAny(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
  }
  return null;
}

/**
 * Find a text element containing the specified text
 *
 * @param {string} text - Text to search for
 * @param {string} [tag='*'] - Tag name to search within
 * @return {HTMLElement|null} - Matching element or null if none found
 */
export function findElementByText(text, tag = "*") {
  const elements = document.getElementsByTagName(tag);
  for (const element of elements) {
    if (element.textContent.includes(text)) {
      return element;
    }
  }
  return null;
}

/**
 * Find an element by its text content and then find a specific child/descendant
 *
 * @param {string} parentText - Text to search for in parent element
 * @param {string} childSelector - CSS selector for the child element
 * @param {string} [parentTag='*'] - Tag name to search within for parent
 * @return {HTMLElement|null} - Matching child element or null if none found
 */
export function findRelatedElement(parentText, childSelector, parentTag = "*") {
  const parent = findElementByText(parentText, parentTag);
  if (parent) {
    return parent.querySelector(childSelector);
  }
  return null;
}

/**
 * Parse HTML string into a DOM element
 *
 * @param {string} html - HTML string to parse
 * @return {HTMLElement} - Parsed HTML element
 */
export function parseHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  return doc.body.firstChild;
}

/**
 * Safely get text content from an element, handling null values
 *
 * @param {HTMLElement|null} element - Element to get text from
 * @return {string} - Text content or empty string if element is null
 */
export function safeGetText(element) {
  return element ? element.textContent.trim() : "";
}

/**
 * Check if the document contains any of the provided selectors
 *
 * @param {string[]} selectors - Array of CSS selectors to check
 * @return {boolean} - True if any selector matches
 */
export function hasAnySelector(selectors) {
  for (const selector of selectors) {
    if (document.querySelector(selector)) {
      return true;
    }
  }
  return false;
}

/**
 * Get elements matching a selector and map them using a function
 *
 * @param {string} selector - CSS selector
 * @param {Function} mapFn - Function to process each element
 * @return {Array} - Array of processed items
 */
export function mapElements(selector, mapFn) {
  const elements = document.querySelectorAll(selector);
  return Array.from(elements).map(mapFn);
}
