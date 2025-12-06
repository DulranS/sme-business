// app/api/send/route.js
import { NextResponse } from 'next/server';
import { google } from '@googleapis/gmail';
import { parse as csvParse } from 'csv-parse/sync';

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

    if (!csvContent || !subject || !body || !accessToken || !senderName || !fieldMappings) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const emailColumn = fieldMappings.email || 'email';

    // Parse CSV using csv-parse (handles quotes)
    let records;
    try {
      records = csvParse(csvContent, { 
        skip_empty_lines: true, 
        columns: true,
        relax_column_count: true
      });
    } catch (parseError) {
      return NextResponse.json({ error: 'Invalid CSV format' }, { status: 400 });
    }

    // Filter valid recipients
    const validRecipients = records.filter(row => isValidEmail(row[emailColumn]));

    if (validRecipients.length === 0) {
      return NextResponse.json({ error: 'No valid emails found' }, { status: 400 });
    }

    // Gmail API
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    const sent = [];
    const BATCH_SIZE = 50;

    for (let i = 0; i < validRecipients.length; i += BATCH_SIZE) {
      const batch = validRecipients.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (row) => {
        try {
          const email = row[emailColumn].trim();
          const finalSubject = replaceTemplateVars(subject, row, fieldMappings, senderName);
          const finalBody = replaceTemplateVars(body, row, fieldMappings, senderName);

          const rawMessage = [
            `To: ${email}`,
            `Subject: ${finalSubject}`,
            'Content-Type: text/plain; charset=utf-8',
            '',
            finalBody
          ].join('\r\n');

          const encodedMessage = Buffer.from(rawMessage)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

          await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: encodedMessage }
          });

          sent.push(email);
        } catch (err) {
          console.error(`Failed to send to ${row[emailColumn]}:`, err.message);
        }
      }));

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
    console.error('Send error:', error);
    if (error.message?.includes('Invalid Credentials')) {
      return NextResponse.json({ error: 'Gmail auth expired. Reconnect.' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to send emails.' }, { status: 500 });
  }
}