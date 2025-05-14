export function checkAuthFromContent() {
  return new Promise((resolve) => {
    // Send message to background script to check auth
    browser.runtime
      .sendMessage({ action: "checkAuth" })
      .then((response) => {
        resolve(response.isAuthenticated === true);
      })
      .catch((error) => {
        console.error("Error checking auth from content:", error);
        resolve(false);
      });
  });
}

export async function checkPursuitPalAuth() {
  try {
    const response = await fetch(
      "https://api.pursuitpal.app/api/v1/auth/check-extension-auth",
      {
        method: "GET",
        credentials: "include", // Important: ensures cookies are sent
      }
    );

    if (response.ok) {
      const data = await response.json();
      return { isAuthenticated: true, user: data.user };
    } else {
      return { isAuthenticated: false };
    }
  } catch (error) {
    console.error("Error checking PursuitPal auth:", error);
    return { isAuthenticated: false, error: error.message };
  }
}

export async function openPursuitPalLogin(returnPath = "/dashboard") {
  try {
    const encodedPath = encodeURIComponent(returnPath);
    const loginUrl = `https://pursuitpal.app/login?redirect=${encodedPath}&extension=true`;

    // Create a new tab with the login URL
    const tab = await browser.tabs.create({ url: loginUrl });
    return { success: true, tab };
  } catch (error) {
    console.error("Error opening PursuitPal login:", error);
    return { success: false, error: error.message };
  }
}
