// app/api/send-email/route.js
import { NextResponse } from 'next/server';
import { google } from '@googleapis/gmail';
import { parse as csvParse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDE-hRmyPs02dBm_OlVfwR9ZzmmMIiKw7o",
  authDomain: "email-marketing-c775d.firebaseapp.com",
  projectId: "email-marketing-c775d",
  storageBucket: "email-marketing-c775d.firebasestorage.app",
  messagingSenderId: "178196903576",
  appId: "1:178196903576:web:56b97d8e0b7943e3ee82ed",
  measurementId: "G-6CL2EGLEVH"
};
if (!getApps().length) initializeApp(firebaseConfig);
const db = getFirestore();

function isValidEmail(email) {
  if (!email) return false;
  const t = email.trim();
  return t.length > 0 && t.includes('@') && t.includes('.');
}

const FOLLOW_UP_1 = { subject: 'Quick follow-up...', body: 'Hi {{business_name}}...' };
const BREAKUP_EMAIL = { subject: 'Should I close your file?', body: 'Hi {{business_name}}...' };

function replaceTemplateVars(text, data, fieldMappings, senderName) {
  let result = text;
  for (const [varName, csvCol] of Object.entries(fieldMappings)) {
    const re = new RegExp(`{{\\s*${varName}\\s*}}`, 'g');
    if (!re.test(result)) continue;
    if (varName === 'sender_name') {
      result = result.replace(re, senderName || '[Sender]');
    } else if (csvCol && data[csvCol] !== undefined) {
      result = result.replace(re, String(data[csvCol]));
    } else {
      result = result.replace(re, `[MISSING: ${varName}]`);
    }
  }
  return result;
}

export async function POST(request) {
  try {
    const { 
      csvContent, 
      senderName, 
      fieldMappings, 
      accessToken,
      template,
      leadQualityFilter = 'HOT',
      isDrip = false,
      dripStep = 0,
      emailImages = []
    } = await request.json();

    if (!accessToken) {
      return NextResponse.json({ error: 'Missing Gmail access token' }, { status: 400 });
    }

    const records = csvParse(csvContent, { skip_empty_lines: true, columns: true });
    let validRecipients = records.filter(row => {
      if (!isValidEmail(row.email)) return false;
      if (leadQualityFilter === 'all') return true;
      return row.lead_quality === leadQualityFilter;
    });

    if (validRecipients.length === 0) {
      return NextResponse.json({ error: `No ${leadQualityFilter} leads found` }, { status: 400 });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    let currentTemplate = template;
    if (isDrip) {
      if (dripStep === 1) currentTemplate = FOLLOW_UP_1;
      if (dripStep === 2) currentTemplate = BREAKUP_EMAIL;
    }

    const sent = [];
    for (const row of validRecipients) {
      try {
        const finalSubject = replaceTemplateVars(currentTemplate.subject, row, fieldMappings, senderName);
        let finalBody = replaceTemplateVars(currentTemplate.body, row, fieldMappings, senderName);

        // ✅ CLICK TRACKING
        const clickId = `click_${uuidv4()}`;
        finalBody = finalBody.replace(
          /(https?:\/\/[^\s]+)/g,
          (url) => `${url}?clid=${clickId}`
        );

        await setDoc(doc(db, 'clicks', clickId), {
          email: row.email,
          userId: 'anon',
          count: 0,
          createdAt: new Date().toISOString()
        });

        // ✅ IMAGE EMBEDDING
        let htmlBody = `<html><body><pre style="font-family:monospace;white-space:pre-wrap;">${finalBody}</pre>`;
        emailImages.forEach(img => {
          const imgTag = `<img src="cid:${img.cid}" alt="" style="max-width:100%;">`;
          htmlBody = htmlBody.replace(new RegExp(`{{image\\d}}`, 'g'), imgTag);
        });
        htmlBody += '</body></html>';

        let rawMessageLines = [
          `To: ${row.email}`,
          `Subject: ${finalSubject}`,
          'MIME-Version: 1.0',
          'Content-Type: multipart/related; boundary="boundary"',
          '',
          '--boundary',
          'Content-Type: text/html; charset=utf-8',
          '',
          htmlBody
        ];

        emailImages.forEach(img => {
          rawMessageLines = [
            ...rawMessageLines,
            '',
            '--boundary',
            `Content-Type: ${img.mimeType}`,
            'Content-Transfer-Encoding: base64',
            `Content-ID: <${img.cid}>`,
            'Content-Disposition: inline',
            '',
            img.base64
          ];
        });

        rawMessageLines = [
          ...rawMessageLines,
          '',
          '--boundary--'
        ];

        const rawMessage = rawMessageLines.join('\r\n');
        const encoded = Buffer.from(rawMessage)
          .toString('base64')
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
        sent.push(row.email);

        if (isDrip && dripStep < 2) {
          console.log(`Scheduled drip ${dripStep + 1} for ${row.email}`);
        }
      } catch (err) {
        console.error('Send error:', err.message);
      }
      await new Promise(r => setTimeout(r, 1100));
    }
    return NextResponse.json({ success: true, sent: sent.length, total: validRecipients.length });
  } catch (error) {
    console.error('Send API error:', error);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}