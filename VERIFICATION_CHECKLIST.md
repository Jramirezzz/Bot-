# Verification Checklist - Google Sheets Integration Fix

## ✅ Code Changes Deployed
- [x] Fixed `initializeSheet()` to use JWT client properly
- [x] Removed internal `_setAxiosRequestAuth()` call
- [x] Using `google-spreadsheet` v4.x correctly
- [x] Changes pushed to GitHub and auto-deployed to Render

## 🔍 Pre-Deployment Verification

The following verifications have been completed:

### Authentication Method
```javascript
// OLD (broken):
doc._setAxiosRequestAuth({ type: 'Bearer', value: accessToken });

// NEW (correct):
const doc = new GoogleSpreadsheet(SHEET_ID, jwtClient);
```

### JWT Client Setup
- ✅ JWT client created with service account email
- ✅ Scopes include: spreadsheets & drive.file
- ✅ Authorization method: `jwtClient.authorize()`
- ✅ Access token extraction: `jwtClient.credentials.access_token`

### Error Handling
- ✅ Private key validation with helpful error messages
- ✅ Sheet initialization with proper logging
- ✅ Row addition with error catching
- ✅ Graceful degradation if Sheets unavailable

## 📋 Next Steps for You

### Step 1: Get Service Account Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create/Select a project with "Google Sheets API" enabled
3. Create a Service Account (Credentials → Create → Service Account)
4. Create a JSON key for the service account
5. Download the JSON file

### Step 2: Extract Credentials
From the JSON file, copy:
- `client_email` (e.g., `bot-123@myproject.iam.gserviceaccount.com`)
- `private_key` (full key including BEGIN/END markers)

### Step 3: Update Render Environment
1. Go to https://dashboard.render.com
2. Select your service (`bot-8qmd`)
3. Click "Environment" tab
4. Add/Update these variables:
   ```
   GOOGLE_SERVICE_ACCOUNT_EMAIL=<your-client-email>
   GOOGLE_PRIVATE_KEY=<full-private-key-with-quotes>
   ```
5. Service will auto-restart

### Step 4: Share Google Sheet
1. Open your Google Sheet
2. Click "Share"
3. Add the `GOOGLE_SERVICE_ACCOUNT_EMAIL` address
4. Give "Editor" permission

### Step 5: Test
1. Send a test WhatsApp message to your bot
2. Check your Google Sheet - new row should appear
3. Or run locally: `node test-sheets-auth.js`

## 🎯 Expected Results

### Successful Flow
```
User sends:   "Juan Perez 573001234567"
                    ↓
Bot receives & parses
                    ↓
initializeSheet() → JWT auth → Get access token → Load Sheets
                    ↓
saveContactMessage() → Add row to "Messages" tab
                    ↓
Row appears in Sheet:
│ name       │ phone         │ whatsappFrom      │ timestamp                     │ rawPayload   │
│ Juan Perez │ 573001234567  │ whatsapp:+... │ 2024-01-15T10:30:45.123Z  │ {...}        │
```

### Logging (in Render)
You should see in logs:
```
initializeSheet: starting for SHEET_ID=16MZYRLJ6XWncv34KV2C03vH3V32nO43ad68CezIohz0
initializeSheet: access token obtained, creating GoogleSpreadsheet with auth
initializeSheet: loaded doc title=Reclamaciones Bot
initializeSheet: sheet ready, title=Messages
saveContactMessage: row added to sheet, id?=2
```

## 🆘 Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `GOOGLE_PRIVATE_KEY not provided or malformed` | .env variable missing or empty | Check GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY are set in Render |
| `error:1E08010C:DECODER routines` | Private key format issue | Make sure key includes `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` |
| `Cannot read property 'sheetsByTitle'` | Sheet not initialized | Check Render logs for earlier errors; may indicate auth failure |
| `TypeError: doc.addSheet is not a function` | google-spreadsheet version mismatch | Check `package.json`: should be v4.x |
| `Permission denied` | Sheet not shared with service account | Share Google Sheet with the email in GOOGLE_SERVICE_ACCOUNT_EMAIL |
| `No access token` | Service account email or key is wrong | Verify credentials match downloaded JSON file |

## 📞 Support

If issues persist:
1. Check Render logs: https://dashboard.render.com → Your Service → Logs
2. Run test locally: `node test-sheets-auth.js`
3. Verify .env file format
4. Check Google Sheet is shared with service account email
5. Review `GOOGLE_SHEETS_SETUP.md` for detailed instructions

---

**Status**: ✅ Code fixed and deployed
**Pending**: Your setup of Google Sheets credentials
**Timeline**: Complete setup in ~5 minutes following steps above
