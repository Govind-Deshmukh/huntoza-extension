# Job Hunt Assist Chrome Extension

A Chrome extension that helps you extract job details from any job posting and automatically fill your job application tracker.

## Features

- **Automatic Job Detail Extraction**: Automatically extracts company name, position, location, job type, salary information, and job description from job postings.
- **AI Enhancement**: Optionally use AI to improve extracted job details and fill in missing information.
- **One-Click Application Tracking**: Send extracted job details directly to your Job Hunt Tracker app with one click.
- **Manual Editing**: Edit any extracted information before saving.
- **Copy to Clipboard**: Copy all extracted job details to your clipboard with one click.

## Installation

### For Users

1. Download the extension from the Chrome Web Store.
2. Click "Add to Chrome" to install.
3. Navigate to any job posting and click the extension icon to extract job details.

### For Developers

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/job-hunt-assist.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner.
4. Click "Load unpacked" and select the extension directory.

## Usage

1. Navigate to any job posting page (LinkedIn, Indeed, company career sites, etc.)
2. Click the Job Hunt Assist icon in your browser toolbar.
3. The extension will automatically extract job details from the page.
4. Review and edit the extracted information if needed.
5. Click "Create Application" to send the data to your Job Hunt Tracker app.

## Configuration

Click the gear icon in the extension popup to access settings:

- **API URL**: Set the URL of your Job Hunt Tracker app's API.
- **Auto-extract**: Toggle automatic extraction when visiting job posting pages.
- **AI Enhancement**: Enable or disable AI enhancement of extracted job details.
- **Tracking**: Toggle automatic opening of your job tracker app when creating applications.

## Troubleshooting

- **Extraction Not Working**: Some job sites have non-standard layouts. Try refreshing the page or clicking the refresh button in the extension popup.
- **AI Enhancement Not Working**: Check your AI credits in the settings page. You may need to purchase more credits.
- **App Connection Issues**: Verify that your Job Hunt Tracker API URL is correct in the settings and that you're logged in to your app.

## Privacy

- This extension only runs on job posting pages and only extracts job-related information.
- Your data is sent only to your Job Hunt Tracker app and nowhere else.
- AI enhancement is processed securely and no personal data is stored.

## Integration with Job Hunt Tracker App

To enable full integration with your Job Hunt Tracker app, ensure that:

1. You have set the correct API URL in the extension settings.
2. You are logged in to your Job Hunt Tracker app in the same browser.
3. Your Job Hunt Tracker app has enabled CORS for the extension.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Thanks to all the job boards whose layouts we've analyzed to build this extension.
- Thanks to the Job Hunt Tracker app team for their API integration.
