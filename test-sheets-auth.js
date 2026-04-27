#!/usr/bin/env node

/**
 * Test script to verify Google Sheets authentication
 * Run with: node test-sheets-auth.js
 */

require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

async function testSheetsAuth() {
  console.log('🧪 Testing Google Sheets Authentication...\n');

  const SHEET_ID = process.env.GOOGLE_SHEET_ID;
  const GOOGLE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const GOOGLE_PRIVATE_KEY_RAW = process.env.GOOGLE_PRIVATE_KEY;

  // Validate environment
  console.log('📋 Environment Check:');
  console.log(`   SHEET_ID: ${SHEET_ID ? '✓' : '✗ Missing'}`);
  console.log(`   SERVICE_ACCOUNT_EMAIL: ${GOOGLE_EMAIL ? '✓' : '✗ Missing'}`);
  console.log(`   PRIVATE_KEY: ${GOOGLE_PRIVATE_KEY_RAW ? '✓' : '✗ Missing'}`);

  if (!SHEET_ID || !GOOGLE_EMAIL || !GOOGLE_PRIVATE_KEY_RAW) {
    console.log('\n❌ Missing required environment variables');
    process.exit(1);
  }

  // Process private key
  let privateKey = GOOGLE_PRIVATE_KEY_RAW;
  if (!privateKey.includes('BEGIN PRIVATE KEY')) {
    // Wrap base64 if needed
    privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`;
  }

  try {
    console.log('\n🔑 Creating JWT client...');
    const jwtClient = new JWT({
      email: GOOGLE_EMAIL,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'],
    });

    console.log('🎫 Authorizing JWT client...');
    await jwtClient.authorize();
    const accessToken = jwtClient.credentials?.access_token;
    if (!accessToken) throw new Error('No access token obtained');
    console.log(`   ✓ Got access token: ${accessToken.substring(0, 20)}...`);

    console.log('\n📊 Creating GoogleSpreadsheet instance...');
    const doc = new GoogleSpreadsheet(SHEET_ID, jwtClient);

    console.log('📄 Loading sheet info...');
    await doc.loadInfo();
    console.log(`   ✓ Sheet title: ${doc.title}`);
    console.log(`   ✓ Sheet count: ${doc.sheetCount}`);

    console.log('\n✅ All checks passed! Google Sheets authentication is working correctly.');
    console.log('\nAvailable sheets:');
    doc.sheetsByIndex.forEach((sheet, idx) => {
      console.log(`   ${idx + 1}. ${sheet.title} (${sheet.rowCount} rows, ${sheet.columnCount} cols)`);
    });

  } catch (err) {
    console.error('\n❌ Authentication failed:');
    console.error(`   Error: ${err.message}`);
    if (err.stack) console.error(`   Stack: ${err.stack}`);
    process.exit(1);
  }
}

testSheetsAuth();
