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
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, varName) => {
    const cleanVar = varName.trim();
    if (cleanVar === 'sender_name') return sender || 'Team';
    const col = mappings[cleanVar];
    return col && recipient[col] !== undefined 
      ? String(recipient[col]) 
      : `[MISSING: ${cleanVar}]`;
  });
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
      result.push(current); 
      current = '';
    } else current += char;
  }
  result.push(current);
  return result.map(field => 
    field.replace(/[\r\n]/g, '')
      .trim()
      .replace(/^"(.*)"$/, '$1')
      .replace(/""/g, '"')
  );
}

// ✅ IMPROVED EMAIL VALIDATION (handles real-world cases)
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length === 0) return false;
  // Allow common variations (Gmail dots, plus addressing, etc.)
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed);
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
      leadQualityFilter = 'all'
    } = await req.json();

    if (!csvContent || !accessToken || !userId) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Normalize line endings and split
    const lines = csvContent
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter(line => line.trim() !== '');

    if (lines.length < 2) {
      return Response.json({ error: 'Invalid CSV format' }, { status: 400 });
    }

    // Parse headers (case-insensitive normalization)
    const rawHeaders = parseCsvRow(lines[0]);
    const headers = rawHeaders.map(h => h.trim());
    
    // ✅ CRITICAL FIX: Auto-detect email column
    const emailCol = findEmailColumn(headers, fieldMappings);
    if (!emailCol) {
      return Response.json({ 
        error: `No email column found. Check your CSV headers: ${headers.join(', ')}` 
      }, { status: 400 });
    }

    // ✅ CRITICAL FIX: Auto-detect lead quality column
    const qualityCol = fieldMappings.lead_quality 
      ? headers.find(h => h.toLowerCase() === fieldMappings.lead_quality.toLowerCase())
      : 'lead_quality';
    
    const hasQualityField = qualityCol && headers.includes(qualityCol);

    const recipients = [];
    const template = templateToSend === 'B' ? templateB : templateA;

    // Process data rows
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvRow(lines[i]);
      if (values.length !== headers.length) continue;

      const row = {};
      headers.forEach((h, idx) => row[h] = values[idx]?.trim() || '');

      // ✅ Use detected email column
      const email = row[emailCol];
      if (!isValidEmail(email)) continue;

      // Apply lead quality filter if column exists
      if (hasQualityField) {
        const quality = (row[qualityCol] || '').trim() || 'HOT';
        if (leadQualityFilter !== 'all' && quality !== leadQualityFilter) continue;
      }

      recipients.push({ ...row, email });
    }

    if (recipients.length === 0) {
      // ✅ IMPROVED ERROR MESSAGE WITH DEBUG INFO
      return Response.json({ 
        error: `No valid recipients found. 
        • Email column used: "${emailCol}" 
        • Quality column: ${qualityCol ? `"${qualityCol}"` : 'none'}
        • Filter: "${leadQualityFilter}"
        • Total rows processed: ${lines.length - 1}
        • Sample headers: ${headers.slice(0, 5).join(', ')}
        Check your CSV structure and field mappings.`,
        debug: {
          emailCol,
          qualityCol,
          leadQualityFilter,
          headers,
          sampleRow: lines[1] ? parseCsvRow(lines[1]) : null
        }
      }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    let sentCount = 0;
    for (const recipient of recipients) {
      try {
        const subject = renderText(template.subject, recipient, fieldMappings, senderName);
        const body = renderText(template.body, recipient, fieldMappings, senderName);

        const rawMessage = emailImages.length > 0 
          ? buildHtmlEmail(recipient.email, subject, body, emailImages)
          : buildPlainTextEmail(recipient.email, subject, body);

        const response = await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: rawMessage }
        });

        if (response.data?.threadId) {
          await saveSentEmailRecord(userId, recipient.email, response.data.threadId);
          sentCount++;
        }
      } catch (e) {
        console.warn(`Failed to send to ${recipient.email}:`, e.message);
      }
    }

    return Response.json({ sent: sentCount, total: recipients.length });
  } catch (error) {
    console.error('Send Email API Error:', error);
    return Response.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

// ✅ AUTO-DETECT EMAIL COLUMN (critical fix)
function findEmailColumn(headers, fieldMappings) {
  // 1. Check field mappings first (user-defined)
  if (fieldMappings.email) {
    const mappedCol = headers.find(h => 
      h.toLowerCase() === fieldMappings.email.toLowerCase()
    );
    if (mappedCol) return mappedCol;
  }

  // 2. Try common email column names
  const emailCandidates = [
    'email', 'Email', 'EMAIL', 
    'email_address', 'Email Address', 'contact_email',
    'primary_email', 'business_email'
  ];
  
  for (const candidate of emailCandidates) {
    const match = headers.find(h => h.toLowerCase() === candidate.toLowerCase());
    if (match) return match;
  }

  // 3. Fallback: find any header containing "email"
  return headers.find(h => h.toLowerCase().includes('email'));
}

// Rest of the functions remain the same (buildPlainTextEmail, buildHtmlEmail, saveSentEmailRecord)
function buildPlainTextEmail(to, subject, body) {
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body
  ];
  return Buffer.from(emailLines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function buildHtmlEmail(to, subject, body, images) {
  let htmlBody = body.replace(/\n/g, '<br>');
  const boundary = 'boundary_' + Date.now();

  images.forEach(img => {
    const imgTag = `<img src="cid:${img.cid}" alt="Inline" style="max-width:100%;">`;
    htmlBody = htmlBody.replace(new RegExp(img.placeholder, 'g'), imgTag);
  });

  const parts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/related; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
    ''
  ];

  images.forEach(img => {
    parts.push(`--${boundary}`);
    parts.push(`Content-Type: ${img.mimeType}`);
    parts.push('Content-Transfer-Encoding: base64');
    parts.push(`Content-ID: <${img.cid}>`);
    parts.push('');
    parts.push(img.base64);
  });

  parts.push(`--${boundary}--`);
  return Buffer.from(parts.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function saveSentEmailRecord(userId, email, threadId) {
  const sentAt = new Date();
  const followUpAt = new Date(sentAt.getTime() + 48 * 60 * 60 * 1000); // 48 hours

  await setDoc(doc(db, 'sent_emails', `${userId}_${email}`), {
    userId,
    to: email,
    threadId,
    sentAt: sentAt.toISOString(),
    replied: false,
    followUpAt: followUpAt.toISOString(),
    followUpSentCount: 0,
    lastFollowUpSentAt: null
  });
}