# Google Sheets Integration - Fix Applied

## Problem
The bot was attempting to save customer data to Google Sheets but failing with authentication errors:
- `_setAxiosRequestAuth is not a function`
- `TypeError: Cannot use 'in' operator to search for 'getRequestHeaders' in undefined`

These errors occurred because the code was using internal methods of `google-spreadsheet` v4.x that are not designed for public use.

## Root Cause
The `google-spreadsheet` library version 4.x changed its authentication API:
- **Old approach** (v3.x): `doc.useServiceAccountAuth({ client_email, private_key })`
- **New approach** (v4.x): Pass the JWT client directly to the constructor

The code was trying to use internal methods (`_setAxiosRequestAuth`) that don't work reliably.

## Solution Applied
Updated `initializeSheet()` function to use the correct v4.x API:

```javascript
// ✅ CORRECT for google-spreadsheet v4.x
const jwtClient = new JWT({
  email: GOOGLE_EMAIL,
  key: privateKey,
  scopes: [...]
});
await jwtClient.authorize();
const doc = new GoogleSpreadsheet(SHEET_ID, jwtClient);  // Pass JWT client directly
```

Instead of:
```javascript
// ❌ WRONG - uses internal methods
doc._setAxiosRequestAuth({ type: 'Bearer', value: accessToken });
```

## Files Modified
- `index.js`: Fixed `initializeSheet()` function (lines 75-128)

## Deployment
Changes have been:
1. ✅ Committed to GitHub
2. ✅ Pushed to origin/master
3. ✅ Auto-deployed to Render

The service at `https://bot-8qmd.onrender.com/webhook` is now running with the fixed authentication.

## What You Need to Do
To complete the Google Sheets integration, you must provide the service account credentials:

1. Download your service account JSON file from Google Cloud Console
2. Extract:
   - `client_email` → Set in `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → Set in `GOOGLE_PRIVATE_KEY`
3. Update the `.env` file in Render with these values
4. Share your Google Sheet with the service account email (Editor permission)

See `GOOGLE_SHEETS_SETUP.md` for detailed instructions.

## Testing
To verify the authentication works locally:
```bash
node test-sheets-auth.js
```

This script will:
- ✓ Check all environment variables
- ✓ Create a JWT client
- ✓ Authorize with Google
- ✓ Load the spreadsheet
- ✓ List available sheets

## Expected Behavior After Fix
When a user sends a WhatsApp message with their name and phone:
1. Bot receives message via Twilio webhook
2. Extracts name and phone number
3. Calls `saveContactMessage()` which initializes Google Sheets
4. Row is added to the "Messages" tab with:
   - name
   - phone
   - whatsappFrom (sender's WhatsApp number)
   - timestamp (ISO format)
   - rawPayload (full message object as JSON)

## Troubleshooting If Still Failing
Check the Render logs:
1. Go to https://dashboard.render.com
2. Select your service
3. Click "Logs"
4. Look for `initializeSheet:` messages

If you see:
- `GOOGLE_PRIVATE_KEY not provided or malformed` → Check .env format
- `error:1E08010C:DECODER routines::unsupported` → Private key has escaping issues
- `Cannot access spreadsheet` → Sheet not shared with service account email
