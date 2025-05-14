/**
 * utils/format.js - Formatting utility functions
 *
 * Provides functions for formatting values in a user-friendly way.
 */

/**
 * Format job type for display
 *
 * @param {string} type - Job type from data (e.g., "full-time")
 * @return {string} - Formatted job type (e.g., "Full Time")
 */
export function formatJobType(type) {
  if (!type) return "Not specified";

  // Replace hyphens with spaces and capitalize words
  return type.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Format salary for display
 *
 * @param {Object} salary - Salary object with min, max, and currency
 * @return {string} - Formatted salary string
 */
export function formatSalary(salary) {
  if (!salary || (!salary.min && !salary.max)) {
    return "Not specified";
  }

  const currency = getCurrencySymbol(salary.currency);

  if (salary.min > 0 && salary.max > 0) {
    return `${currency}${formatNumber(salary.min)} - ${currency}${formatNumber(
      salary.max
    )}`;
  } else if (salary.min > 0) {
    return `${currency}${formatNumber(salary.min)}+`;
  } else if (salary.max > 0) {
    return `Up to ${currency}${formatNumber(salary.max)}`;
  }

  return "Not specified";
}

/**
 * Get currency symbol for currency code
 *
 * @param {string} currency - Currency code (e.g., "USD")
 * @return {string} - Currency symbol (e.g., "$")
 */
export function getCurrencySymbol(currency) {
  switch (currency) {
    case "USD":
      return "$";
    case "INR":
      return "₹";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "JPY":
      return "¥";
    default:
      return "$"; // Default to USD
  }
}

/**
 * Format number with thousands separators
 *
 * @param {number} num - Number to format
 * @return {string} - Formatted number
 */
export function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Get user initials from name or email
 *
 * @param {string} str - User name or email
 * @return {string} - User initials (1-2 characters)
 */
export function getInitials(str) {
  if (!str) return "--";

  // If email, use first character
  if (str.includes("@")) {
    return str.charAt(0).toUpperCase();
  }

  // If name, use first character of first and last name
  const parts = str.split(" ");
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Format date for display
 *
 * @param {string} dateStr - Date string
 * @param {boolean} [includeTime=false] - Whether to include time
 * @return {string} - Formatted date string
 */
export function formatDate(dateStr, includeTime = false) {
  if (!dateStr) return "";

  try {
    const date = new Date(dateStr);

    if (isNaN(date.getTime())) return dateStr;

    const options = {
      year: "numeric",
      month: "short",
      day: "numeric",
    };

    if (includeTime) {
      options.hour = "2-digit";
      options.minute = "2-digit";
    }

    return date.toLocaleDateString(undefined, options);
  } catch (e) {
    console.error("Error formatting date:", e);
    return dateStr;
  }
}
