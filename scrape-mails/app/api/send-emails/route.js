import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { parse as csvParse } from 'csv-parse/sync';

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  return trimmed.includes('@') && trimmed.includes('.');
}

function replaceTemplateVars(text, data, fieldMappings, senderName) {
  let result = text;
  for (const [varName, csvCol] of Object.entries(fieldMappings)) {
    const regex = new RegExp(`{{\\s*${varName}\\s*}}`, 'g');
    if (varName === 'sender_name') {
      result = result.replace(regex, senderName || '[Sender Name]');
    } else if (csvCol && data[csvCol] !== undefined) {
      result = result.replace(regex, String(data[csvCol]));
    } else {
      result = result.replace(regex, `[MISSING: ${varName}]`);
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

    let records;
    try {
      records = csvParse(csvContent, { skip_empty_lines: true, columns: true, relax_column_count: true });
    } catch (e) {
      return NextResponse.json({ error: 'Invalid CSV format' }, { status: 400 });
    }

    const emailCol = fieldMappings.email || 'email';
    const validRecipients = records.filter(r => isValidEmail(r[emailCol]));
    if (validRecipients.length === 0) {
      return NextResponse.json({ error: 'No valid emails found' }, { status: 400 });
    }

    // ✅ Initialize Gmail client with only the access token
    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: authClient });

    const sent = [];
    const BATCH_SIZE = 50;

    for (let i = 0; i < validRecipients.length; i += BATCH_SIZE) {
      const batch = validRecipients.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async row => {
        const email = row[emailCol].trim();
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

        try {
          await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: encodedMessage }
          });
          sent.push(email);
        } catch (err) {
          console.error(`Failed to send to ${email}:`, err.message);
        }
      }));

      if (i + BATCH_SIZE < validRecipients.length) await new Promise(r => setTimeout(r, 2000));
    }

    return NextResponse.json({ success: true, sent: sent.length, total: validRecipients.length });

  } catch (err) {
    console.error('Send error:', err);

    // Check if the token is invalid or expired
    if (err?.response?.status === 401 || err.message?.includes('invalid_grant') || err.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Gmail auth expired or invalid. Reconnect.' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to send emails.' }, { status: 500 });
  }
}
