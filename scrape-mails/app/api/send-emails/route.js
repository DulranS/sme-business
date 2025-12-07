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

function replaceTemplateVars(text, data, fieldMappings, senderName) {
  if (!text) return '';
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

function addTracking(body, testId, version, email) {
  const recipientId = Buffer.from(email).toString('base64').substring(0, 12);
  const pixelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/track/open?test=${testId}&v=${version}&r=${recipientId}`;
  let tracked = body + `\n\n<img src="${pixelUrl}" width="1" height="1" alt="" />`;
  tracked = tracked.replace(/(https?:\/\/[^\s]+)/g, (url) => {
    return `${url}?utm_source=email&utm_medium=abtest&utm_campaign=${testId}&utm_content=${version}`;
  });
  return tracked;
}

export async function POST(request) {
  try {
    const { 
      csvContent, 
      senderName, 
      fieldMappings, 
      accessToken,
      abTestMode,
      templateA,
      templateB,
      leadQualityFilter = 'all'
    } = await request.json();

    if (!csvContent || !senderName || !fieldMappings || !accessToken) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const records = csvParse(csvContent, { skip_empty_lines: true, columns: true });
    let validRecipients = records.filter(row => {
      if (!isValidEmail(row.email)) return false;
      if (leadQualityFilter === 'all') return true;
      return row.lead_quality === leadQualityFilter;
    });

    if (validRecipients.length === 0) {
      return NextResponse.json({ error: 'No valid emails for selected lead quality' }, { status: 400 });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    let results = { a: { sent: 0 }, b: { sent: 0 } };
    let testId = null;

    if (abTestMode) {
      testId = `ab_${Date.now()}_${uuidv4().slice(0, 8)}`;
      const half = Math.ceil(validRecipients.length / 2);
      const groupA = validRecipients.slice(0, half);
      const groupB = validRecipients.slice(half);

      // Send A
      for (const row of groupA) {
        const finalSubject = replaceTemplateVars(templateA.subject, row, fieldMappings, senderName);
        let finalBody = replaceTemplateVars(templateA.body, row, fieldMappings, senderName);
        finalBody = addTracking(finalBody, testId, 'a', row.email);

        const rawMessage = [
          `To: ${row.email}`,
          `Subject: ${finalSubject}`,
          'Content-Type: text/html; charset=utf-8',
          '',
          finalBody
        ].join('\r\n');

        const encoded = Buffer.from(rawMessage)
          .toString('base64')
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        try {
          await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
          results.a.sent++;
        } catch (err) {
          console.error('Send A error:', err.message);
        }
        await new Promise(r => setTimeout(r, 1100));
      }

      // Send B
      for (const row of groupB) {
        const finalSubject = replaceTemplateVars(templateB.subject, row, fieldMappings, senderName);
        let finalBody = replaceTemplateVars(templateB.body, row, fieldMappings, senderName);
        finalBody = addTracking(finalBody, testId, 'b', row.email);

        const rawMessage = [
          `To: ${row.email}`,
          `Subject: ${finalSubject}`,
          'Content-Type: text/html; charset=utf-8',
          '',
          finalBody
        ].join('\r\n');

        const encoded = Buffer.from(rawMessage)
          .toString('base64')
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        try {
          await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
          results.b.sent++;
        } catch (err) {
          console.error('Send B error:', err.message);
        }
        await new Promise(r => setTimeout(r, 1100));
      }

      await setDoc(doc(db, 'users', 'anon', 'ab_tests', testId), {
        testId,
        name: `A/B Test ${new Date().toISOString().split('T')[0]}`,
        templateA,
        templateB,
        total: validRecipients.length,
        results,
        createdAt: new Date().toISOString()
      });

      return NextResponse.json({ success: true, ...results, testId });
    } else {
      const sent = [];
      for (const row of validRecipients) {
        const finalSubject = replaceTemplateVars(templateA.subject, row, fieldMappings, senderName);
        const finalBody = replaceTemplateVars(templateA.body, row, fieldMappings, senderName);

        const rawMessage = [
          `To: ${row.email}`,
          `Subject: ${finalSubject}`,
          'Content-Type: text/plain; charset=utf-8',
          '',
          finalBody
        ].join('\r\n');

        const encoded = Buffer.from(rawMessage)
          .toString('base64')
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        try {
          await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
          sent.push(row.email);
        } catch (err) {
          console.error('Send error:', err.message);
        }
        await new Promise(r => setTimeout(r, 1100));
      }
      return NextResponse.json({ success: true, sent: sent.length, total: validRecipients.length });
    }
  } catch (error) {
    console.error('Send API error:', error);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}