# PursuitPal Job Tracker Extension

![PursuitPal Logo](chrome-extension/images/icon.png)

PursuitPal is a browser extension that helps job seekers organize their job search process by automatically extracting and saving job posting details from popular job boards.

## Features

- **Automatic Job Data Extraction**: Extract job titles, companies, locations, salaries, and descriptions from popular job boards
- **Preview & Edit**: Review and modify extracted job data before saving
- **One-Click Tracking**: Save job applications directly to your PursuitPal account
- **Multiple Job Board Support**: Works with LinkedIn, Indeed, Glassdoor, Naukri, and many other job sites
- **Customizable Settings**: Configure default preferences for currency, job priority, and more

## Supported Job Boards

- LinkedIn
- Indeed
- Glassdoor
- Naukri.com
- ZipRecruiter
- Monster
- And many more job sites...

## Installation

### Chrome Web Store

1. Visit the [PursuitPal extension page](https://chrome.google.com/webstore/detail/pursuitpal/YOUR_EXTENSION_ID) on the Chrome Web Store
2. Click "Add to Chrome"
3. Follow the prompts to install the extension

### Firefox Add-ons

1. Visit the [PursuitPal add-on page](https://addons.mozilla.org/en-US/firefox/addon/pursuitpal/) on Firefox Add-ons
2. Click "Add to Firefox"
3. Follow the prompts to install the add-on

### Manual Installation (Developer Mode)

1. Download or clone this repository
2. For Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the extension directory
3. For Firefox:
   - Open Firefox and go to `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select any file in the extension directory

## How to Use

1. **Sign In**: Click the PursuitPal extension icon and sign in to your account
2. **Visit Job Postings**: Browse job boards like LinkedIn, Indeed, Glassdoor, etc.
3. **Extract Job Details**: Click the PursuitPal icon when viewing a job posting
4. **Review & Edit**: Verify and edit the extracted details if needed
5. **Save to Account**: Click "Save to PursuitPal" to add the job to your account

### Alternative Methods

- **Right-Click Menu**: Right-click on any job posting page and select "Extract Job Details" from the context menu
- **Auto-Extract**: Enable auto-extraction in settings to automatically extract job details when visiting job pages

## Screenshots

![Job Details Preview](screenshots/preview.png)
_Preview and edit job details before saving_

![Options Page](screenshots/options.png)
_Customize extension behavior and defaults_

## Account & Web App

PursuitPal extension works with the [PursuitPal web application](https://pursuitpal.app), which provides comprehensive job hunt tracking features:

- Dashboard with job application stats
- Interview scheduling and tracking
- Application status updates
- Resume and cover letter management
- Contact tracking
- And much more...

[Sign up for a free account](https://pursuitpal.app/signup) to get started!

## Privacy & Permissions

PursuitPal requires certain permissions to function:

- **Storage**: To save your preferences and temporary job data
- **Active Tab & Scripting**: To extract job details from the current page
- **Tabs**: To detect when you're viewing a job posting
- **Notifications**: To inform you when job details are extracted
- **Host Permissions**: To communicate with the PursuitPal API and job posting sites

We value your privacy. PursuitPal:

- Only extracts data from job postings you explicitly request
- Never collects personal browsing history
- Only sends data to the PursuitPal servers with your authorization
- Never shares your data with third parties

## License

This extension is licensed under the [MIT License](LICENSE).

---

Happy job hunting!
