# WhatsApp Bot - Environment Configuration Guide

This file explains how to properly configure Google Sheets credentials for the bot.

## Required Google Sheets Setup

To enable data persistence to Google Sheets, you need to:

### 1. Create a Service Account
- Go to [Google Cloud Console](https://console.cloud.google.com)
- Create a new project or select existing one
- Enable "Google Sheets API" and "Google Drive API"
- Create a Service Account:
  - Navigation Menu → APIs & Services → Credentials
  - Click "Create Credentials" → Service Account
  - Fill in the details and create
  - Go to the service account you just created
  - Click "Keys" tab → "Add Key" → "Create New Key" → JSON
  - This downloads a JSON file with your credentials

### 2. Extract Credentials from the JSON File
From the downloaded JSON file, you need:
- `client_email`: The service account email address
- `private_key`: The full private key (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)

### 3. Add to Your .env File

Add these lines to your `.env` file:

```
GOOGLE_SHEET_ID=YOUR_SHEET_ID_HERE
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...(full key)...\n-----END PRIVATE KEY-----\n"
```

## IMPORTANT: Private Key Format

The private key must include:
- The full `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` markers
- Newline characters properly escaped as `\n`
- All content from the JSON file's `private_key` field

### Example Private Key in .env:
```
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7...many characters...\n-----END PRIVATE KEY-----\n"
```

## Finding Your Sheet ID

The Sheet ID is in the URL: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`

## Share Sheet with Service Account

After adding credentials to `.env`, you must share the Google Sheet with the service account email:
1. Open your Google Sheet
2. Click "Share"
3. Add the email from `GOOGLE_SERVICE_ACCOUNT_EMAIL`
4. Give it "Editor" permission

## Test Your Configuration

After setting up, run:
```bash
node test-sheets-auth.js
```

This will verify that all credentials are correctly formatted and working.

## Troubleshooting

- **"No access token from service account"**: Private key format issue
- **"Cannot access spreadsheet"**: Sheet not shared with service account email
- **"DECODER routines"**: Private key has escape issues or invalid characters
- **"undefined method"**: google-spreadsheet v4.x incompatibility

Run `node test-sheets-auth.js` to diagnose issues.
