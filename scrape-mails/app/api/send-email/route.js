// app/api/send-email/route.js
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { google } from 'googleapis';

const firebaseConfig = {
  apiKey: "AIzaSyDE-hRmyPs02dBm_OlVfwR9ZzmmMIiKw7o",
  authDomain: "email-marketing-c775d.firebaseapp.com",
  projectId: "email-marketing-c775d",
  storageBucket: "email-marketing-c775d.firebasestorage.app",
  messagingSenderId: "178196903576",
  appId: "1:178196903576:web:56b97d8e0b7943e3ee82ed"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

function renderText(text, recipient, mappings, sender) {
  if (!text) return '';
  let result = text;
  Object.entries(mappings).forEach(([varName, col]) => {
    const regex = new RegExp(`{{\\s*${varName}\\s*}}`, 'g');
    if (varName === 'sender_name') {
      result = result.replace(regex, sender || 'Team');
    } else if (recipient && col && recipient[col] !== undefined) {
      result = result.replace(regex, String(recipient[col]));
    } else {
      result = result.replace(regex, `[MISSING: ${varName}]`);
    }
  });
  return result;
}

function parseCsvRow(str) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && !inQuotes) inQuotes = true;
    else if (char === '"' && inQuotes) {
      if (i + 1 < str.length && str[i + 1] === '"') {
        current += '"';
        i++;
      } else inQuotes = false;
    } else if (char === ',' && !inQuotes) {
      result.push(current); current = '';
    } else current += char;
  }
  result.push(current);
  return result.map(field => field.replace(/[\r\n]/g, '').trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"'));
}

export async function POST(req) {
  try {
    const {
      csvContent,
      senderName,
      fieldMappings,
      accessToken,
      templateA,
      templateB,
      templateToSend,
      userId,
      emailImages = []
    } = await req.json();

    const lines = csvContent
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter(line => line.trim() !== '');

    if (lines.length < 2) {
      return Response.json({ error: 'Invalid CSV' }, { status: 400 });
    }

    const headers = parseCsvRow(lines[0]).map(h => h.trim());
    const recipients = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvRow(lines[i]);
      if (values.length !== headers.length) continue;
      const row = {};
      headers.forEach((h, idx) => row[h] = values[idx] || '');
      if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) continue;
      recipients.push(row);
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const template = templateToSend === 'B' ? templateB : templateA;
    let sentCount = 0;
    const sentRecords = [];

    for (const recipient of recipients) {
      try {
        const subject = renderText(template.subject, recipient, fieldMappings, senderName);
        let htmlBody = renderText(template.body, recipient, fieldMappings, senderName);

        emailImages.forEach(img => {
          const imgTag = `<img src="cid:${img.cid}" alt="Inline">`;
          htmlBody = htmlBody.replace(new RegExp(img.placeholder, 'g'), imgTag);
        });

        const message = [
          `To: ${recipient.email}`,
          `Subject: ${subject}`,
          'Content-Type: multipart/related; boundary="boundary"',
          '',
          '--boundary',
          'Content-Type: text/html; charset=utf-8',
          '',
          htmlBody,
          ''
        ];

        emailImages.forEach(img => {
          message.push('--boundary');
          message.push(`Content-Type: ${img.mimeType}`);
          message.push(`Content-Transfer-Encoding: base64`);
          message.push(`Content-ID: <${img.cid}>`);
          message.push('');
          message.push(img.base64);
          message.push('');
        });
        message.push('--boundary--');

        const rawMessage = btoa(message.join('\n').replace(/\n/g, '\r\n'))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        const response = await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: rawMessage }
        });

        const messageId = response.data.payload?.headers?.find(h => h.name === 'Message-ID')?.value;
        const threadId = response.data.threadId;

        if (recipient.email && messageId && threadId) {
          await setDoc(doc(db, 'sent_emails', `${userId}_${recipient.email}`), {
            userId,
            to: recipient.email,
            messageId,
            threadId,
            sentAt: new Date().toISOString(),
            replied: false,
            followUpAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
          });
          sentRecords.push({ email: recipient.email, messageId, threadId });
        }

        sentCount++;
      } catch (e) {
        console.warn(`Failed to send to ${recipient.email}:`, e.message);
      }
    }

    return Response.json({ sent: sentCount, total: recipients.length, messageIds: sentRecords });
  } catch (error) {
    console.error('Send email error:', error);
    return Response.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}