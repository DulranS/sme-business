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
  appId: "1:178196903576:web:56b97d8e0b7943e3ee82ed",
  measurementId: "G-6CL2EGLEVH"
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

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length === 0) return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(trimmed);
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
      emailImages = [],
      leadQualityFilter
    } = await req.json();

    if (!csvContent || !accessToken || !userId) {
      return Response.json({ error: 'Missing required fields: csvContent, accessToken, or userId' }, { status: 400 });
    }

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

    // ✅ FIXED: Find the actual CSV column names from fieldMappings
    const emailColumnName = Object.entries(fieldMappings).find(([key, val]) => key === 'email')?.[1] || 'email';
    const qualityColumnName = Object.entries(fieldMappings).find(([key, val]) => key === 'lead_quality')?.[1] || 'lead_quality';

    console.log('API 🔍 Email column:', emailColumnName);
    console.log('API 🔍 Quality column:', qualityColumnName);
    console.log('API 🔍 Headers:', headers);
    console.log('API 🔍 Lead Quality Filter:', leadQualityFilter);

    // ✅ Check if quality column exists in headers
    const hasQualityField = headers.includes(qualityColumnName);

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvRow(lines[i]);
      if (values.length !== headers.length) continue;

      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });

      // ✅ Get email using actual CSV column name
      const emailValue = row[emailColumnName] || '';
      if (!isValidEmail(emailValue)) {
        console.log('API ❌ Invalid email:', emailValue);
        continue;
      }

      // ✅ Apply quality filter only if column exists
      let include = true;
      if (hasQualityField) {
        const quality = (row[qualityColumnName] || '').trim() || 'HOT';
        console.log(`API 📧 ${emailValue} - Quality: ${quality}, Filter: ${leadQualityFilter}`);
        
        if (leadQualityFilter !== 'all' && quality !== leadQualityFilter) {
          console.log(`API ⏭️ Skipping ${emailValue} - Quality mismatch`);
          include = false;
        }
      } else {
        console.log(`API ⚠️ No quality column found, including all emails`);
      }

      if (!include) continue;

      // ✅ Push with normalized 'email' key for rendering
      recipients.push({ ...row, email: emailValue });
      console.log(`API ✅ Added ${emailValue} to recipients`);
    }

    console.log(`API 📊 Total valid recipients: ${recipients.length}`);

    if (recipients.length === 0) {
      return Response.json({
        error: `No valid email recipients found. Email column: "${emailColumnName}", Quality column: "${qualityColumnName}", Filter: "${leadQualityFilter}". Check if these columns exist in your CSV.`
      }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const template = templateToSend === 'B' ? templateB : templateA;
    let sentCount = 0;

    for (const recipient of recipients) {
      try {
        const subject = renderText(template.subject, recipient, fieldMappings, senderName);
        let body = renderText(template.body, recipient, fieldMappings, senderName);

        let rawMessage;
        if (emailImages.length > 0) {
          let htmlBody = body.replace(/\n/g, '<br>');
          const finalMessage = [
            `To: ${recipient.email}`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            'Content-Type: multipart/related; boundary="boundary"',
            '',
            '--boundary',
            'Content-Type: text/html; charset=utf-8',
            '',
            htmlBody,
            ''
          ];

          emailImages.forEach(img => {
            const imgTag = `<img src="cid:${img.cid}" alt="Inline" style="max-width:100%;">`;
            htmlBody = htmlBody.replace(new RegExp(img.placeholder, 'g'), imgTag);
          });

          finalMessage[9] = htmlBody;

          emailImages.forEach(img => {
            finalMessage.push('--boundary');
            finalMessage.push(`Content-Type: ${img.mimeType}`);
            finalMessage.push('Content-Transfer-Encoding: base64');
            finalMessage.push(`Content-ID: <${img.cid}>`);
            finalMessage.push('');
            finalMessage.push(img.base64);
          });
          finalMessage.push('--boundary--');

          rawMessage = Buffer.from(finalMessage.join('\r\n'))
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        } else {
          const emailLines = [
            `To: ${recipient.email}`,
            `Subject: ${subject}`,
            'Content-Type: text/plain; charset=utf-8',
            '',
            body
          ];
          rawMessage = Buffer.from(emailLines.join('\r\n'))
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        }

        const response = await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: rawMessage }
        });

        const { threadId } = response.data;
        if (threadId) {
          const sentAt = new Date();
          const followUpAt = new Date(sentAt.getTime() + 48 * 60 * 60 * 1000); // 48 hours

          await setDoc(doc(db, 'sent_emails', `${userId}_${recipient.email}`), {
            userId,
            to: recipient.email,
            threadId,
            sentAt: sentAt.toISOString(),
            replied: false,
            followUpAt: followUpAt.toISOString(),
            followUpSentCount: 0,
            lastFollowUpSentAt: null
          });

          sentCount++;
          console.log(`API ✅ Sent to ${recipient.email}`);
        }
      } catch (e) {
        console.warn(`API ❌ Failed to send to ${recipient.email}:`, e.message);
      }
    }

    console.log(`API 📊 Final results: ${sentCount}/${recipients.length} sent`);

    return Response.json({ sent: sentCount, total: recipients.length });
  } catch (error) {
    console.error('📧 Send Email API Error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}