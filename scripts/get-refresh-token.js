/**
 * One-time script to obtain a Gmail OAuth2 refresh token.
 * Run: node scripts/get-refresh-token.js
 * Delete this file after you have your refresh token.
 *
 * Prereq: add http://localhost:3000 as an authorized redirect URI
 * in your Google Cloud Console OAuth2 client.
 */
require('dotenv').config();
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET } = process.env;

if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
  console.error('GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in .env');
  process.exit(1);
}

const REDIRECT_URI = 'http://localhost:3000';

const oauth2Client = new google.auth.OAuth2(
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  REDIRECT_URI
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://mail.google.com/'],
  prompt: 'consent',
});

// Start a temporary local server to capture the redirect
const server = http.createServer(async (req, res) => {
  const code = new url.URL(req.url, REDIRECT_URI).searchParams.get('code');

  if (!code) {
    res.end('No code found. Try again.');
    return;
  }

  res.end('<h2>Done! You can close this tab and check your terminal.</h2>');
  server.close();

  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      console.error('\nNo refresh_token returned.');
      console.error('Go to https://myaccount.google.com/permissions, revoke access for your app, then re-run this script.');
      process.exit(1);
    }
    console.log('\nSuccess! Add this to your .env:\n');
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\nThen delete scripts/get-refresh-token.js.');
  } catch (err) {
    console.error('\nFailed to exchange code:', err.message);
    process.exit(1);
  }
});

server.listen(3000, () => {
  console.log('\nOpen this URL in your browser:\n');
  console.log('  ' + authUrl);
  console.log('\nWaiting for Google to redirect back...');
});
