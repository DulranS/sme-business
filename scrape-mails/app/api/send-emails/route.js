// app/api/send-emails/route.js
import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const { recipients, subject, body, accessToken } = await request.json();

  if (!accessToken) {
    return NextResponse.json({ error: 'Missing Gmail access token' }, { status: 400 });
  }

  if (!recipients?.length || !subject || !body) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    let sentCount = 0;

    for (const recipient of recipients) {
      let emailSubject = subject;
      let emailBody = body;

      // Replace ALL your placeholders
      Object.keys(recipient).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        emailSubject = emailSubject.replace(regex, recipient[key] || '');
        emailBody = emailBody.replace(regex, recipient[key] || '');
      });

      // Ensure sender_name is set
      const senderName = user.displayName?.split(' ')[0] || 'Team';
      emailBody = emailBody.replace(/{{sender_name}}/g, senderName);

      // Build raw email
      const emailMessage = [
        `To: ${recipient.email}`,
        `Subject: ${emailSubject}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        emailBody
      ].join('\n');

      const encodedMessage = Buffer.from(emailMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Send via Gmail API
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage },
      });

      sentCount++;
      
      // Rate limit: 1 email/sec
      if (sentCount < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return NextResponse.json({ success: true, sent: sentCount });
  } catch (error) {
    console.error('Gmail API error:', error.message);
    
    if (error.message?.includes('Invalid Credentials')) {
      return NextResponse.json({ error: 'Gmail session expired. Please reconnect.' }, { status: 401 });
    }
    
    return NextResponse.json({ error: error.message || 'Failed to send emails' }, { status: 500 });
  }
}