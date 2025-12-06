// app/api/send/route.js
import { NextResponse } from 'next/server';
import { google } from '@googleapis/gmail';
import { getApps, getApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { parse as csvParse } from 'csv-parse/sync';

// Initialize Firebase Admin SDK
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
if (!getApps().length && firebasePrivateKey) {
  initializeApp({
    credential: {
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: firebasePrivateKey,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    },
  });
}

// Helper: Validate email
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  return trimmed.length > 0 && trimmed.includes('@') && trimmed.includes('.');
}

// Helper: Replace template variables
function replaceTemplateVars(text, data, fieldMappings, senderName) {
  if (!text) return '';
  let result = text;
  for (const [varName, csvCol] of Object.entries(fieldMappings)) {
    const varRegex = new RegExp(`{{\\s*${varName}\\s*}}`, 'g');
    if (!varRegex.test(result)) continue;

    if (varName === 'sender_name') {
      result = result.replace(varRegex, senderName || '[Sender Name]');
    } else if (csvCol && data[csvCol] !== undefined) {
      result = result.replace(varRegex, String(data[csvCol]));
    } else {
      result = result.replace(varRegex, `[MISSING: ${varName}]`);
    }
  }
  return result;
}

export async function POST(request) {
  try {
    const { csvContent, subject, body, accessToken, senderName, fieldMappings } = await request.json();

    // Validate required fields
    if (!csvContent || !subject || !body || !accessToken || !senderName || !fieldMappings) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Determine email column (critical!)
    const emailColumn = fieldMappings.email || 'email';

    // Parse CSV
    let records;
    try {
      records = csvParse(csvContent, { 
        skip_empty_lines: true, 
        columns: true,
        relax_column_count: true
      });
    } catch (parseError) {
      console.error('CSV Parse Error:', parseError);
      return NextResponse.json({ error: 'Invalid CSV format' }, { status: 400 });
    }

    // Filter valid recipients using the mapped email column
    const validRecipients = records.filter(row => {
      const email = row[emailColumn];
      return isValidEmail(email);
    });

    if (validRecipients.length === 0) {
      return NextResponse.json({ error: 'No valid email addresses found in CSV' }, { status: 400 });
    }

    // Initialize Gmail API
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    // Send emails in batches
    const sent = [];
    const BATCH_SIZE = 50;

    for (let i = 0; i < validRecipients.length; i += BATCH_SIZE) {
      const batch = validRecipients.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (row) => {
        try {
          const email = row[emailColumn].trim();
          const finalSubject = replaceTemplateVars(subject, row, fieldMappings, senderName);
          const finalBody = replaceTemplateVars(body, row, fieldMappings, senderName);

          // Build raw RFC 2822 message
          const rawMessage = [
            `To: ${email}`,
            `Subject: ${finalSubject}`,
            'Content-Type: text/plain; charset=utf-8',
            '',
            finalBody
          ].join('\r\n');

          // Web-safe base64 encoding (required by Gmail API)
          const encodedMessage = Buffer.from(rawMessage)
            .toString('base64')
            .replace(/\+/g, '-')   // URL-safe
            .replace(/\//g, '_')   // URL-safe
            .replace(/=+$/, '');   // Remove padding

          await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: encodedMessage }
          });

          sent.push(email);
        } catch (err) {
          console.error(`Failed to send to ${row[emailColumn]}:`, err.message);
        }
      }));

      // Throttle between batches to respect Gmail limits
      if (i + BATCH_SIZE < validRecipients.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return NextResponse.json({ 
      success: true, 
      sent: sent.length, 
      total: validRecipients.length
    });

  } catch (error) {
    console.error('Send API Error:', error);
    
    if (error.message?.includes('Invalid Credentials')) {
      return NextResponse.json({ 
        error: 'Gmail authentication expired. Please reconnect.' 
      }, { status: 401 });
    }

    return NextResponse.json({ 
      error: 'Failed to send emails. Please try again.' 
    }, { status: 500 });
  }
}