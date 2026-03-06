import { google } from 'googleapis';
import 'dotenv/config';

function getOAuth2Client() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN must be set');
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

function buildRawMessage(to: string, subject: string, body: string): string {
  const messageParts = [
    `To: ${to}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    body,
  ];
  const message = messageParts.join('\n');
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendGmailMessage(to: string, subject: string, body: string): Promise<string> {
  const auth = getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth });

  const raw = buildRawMessage(to, subject, body);

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  return response.data.id ?? 'unknown';
}
