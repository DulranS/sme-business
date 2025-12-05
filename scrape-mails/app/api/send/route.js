// app/api/send/route.js
import { createGmailClient } from '@/lib/gmail';
import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const refreshToken = formData.get('refreshToken');
    const csvFile = formData.get('csv');
    const subject = formData.get('subject');
    const template = formData.get('template');

    if (!refreshToken || !csvFile || !subject || !template) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Parse CSV
    const csvBuffer = await csvFile.arrayBuffer();
    const csvString = new TextDecoder().decode(csvBuffer);
    const records = parse(csvString, {
      skip_empty_lines: true,
      columns: false,
    });

    // Extract emails (first column)
    const emails = records
      .map(row => row[0]?.trim())
      .filter(email => email && email.includes('@'));

    if (emails.length === 0) {
      return NextResponse.json({ error: 'No valid emails found' }, { status: 400 });
    }

    const gmail = createGmailClient(refreshToken);
    const sent = [];

    // Send in batches (max 90 to stay under Gmail's 100/day sending limit for new accounts)
    const BATCH_SIZE = 50;
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (email) => {
        const body = template.replace(/\{\{email\}\}/g, email);
        const rawMessage = [
          `To: ${email}`,
          `Subject: ${subject}`,
          'Content-Type: text/html; charset=utf-8',
          '',
          body
        ].join('\r\n');

        // Proper base64 encoding (web-safe)
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

      // Throttle to avoid hitting Gmail API rate limits
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 sec per batch
    }

    return NextResponse.json({ success: true, sent: sent.length, total: emails.length });
  } catch (error) {
    console.error('Send error:', error);
    return NextResponse.json({ error: 'Failed to send emails' }, { status: 500 });
  }
}