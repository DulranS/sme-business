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

// ✅ BULLETPROOF EMAIL VALIDATION - accepts almost anything valid
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 3) return false;
  if (trimmed === 'undefined' || trimmed === 'null' || trimmed === '' || trimmed === 'NA' || trimmed === 'N/A') return false;
  if (trimmed.startsWith('[') || trimmed.includes('[MISSING')) return false;
  
  // Must have @ symbol
  const atIndex = trimmed.indexOf('@');
  if (atIndex < 1 || atIndex === trimmed.length - 1) return false;
  
  const afterAt = trimmed.substring(atIndex + 1);
  // After @ must have at least one dot and something after it
  const dotIndex = afterAt.indexOf('.');
  if (dotIndex < 1 || dotIndex === afterAt.length - 1) return false;
  
  // Must have at least one character for domain name, then dot, then TLD
  return true;
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
    
    console.log('[CSV PARSE] Headers found:', headers);
    
    // ✅ CRITICAL FIX: Auto-detect email column
    const emailCol = findEmailColumn(headers, fieldMappings);
    if (!emailCol) {
      console.error('[CSV PARSE] No email column found. Headers:', headers);
      return Response.json({ 
        error: `No email column found. Check your CSV headers: ${headers.join(', ')}` 
      }, { status: 400 });
    }

    console.log('[CSV PARSE] Email column detected:', emailCol);
    
    // ✅ CRITICAL FIX: Auto-detect lead quality column
    // ONLY use quality filter if explicitly defined in fieldMappings
    const qualityCol = fieldMappings?.lead_quality 
      ? headers.find(h => h.toLowerCase() === fieldMappings.lead_quality.toLowerCase())
      : null;
    
    const hasQualityField = qualityCol !== null;
    
    // ⚠️ CRITICAL: Ignore quality filter if quality column wasn't explicitly mapped
    // This prevents silently dropping all rows when filter is sent but column doesn't exist
    const shouldApplyQualityFilter = hasQualityField && leadQualityFilter && leadQualityFilter !== 'all';
    
    if (leadQualityFilter && leadQualityFilter !== 'all' && !hasQualityField) {
      console.warn(`[PARSE] ⚠️ Quality filter "${leadQualityFilter}" ignored - no quality column defined in fieldMappings. Set fieldMappings.lead_quality to use this filter.`);
    }

    const recipients = [];
    const template = templateToSend === 'B' ? templateB : templateA;
    let skippedCount = 0;
    let invalidEmailCount = 0;
    let emptyRowCount = 0;
    let qualityFilterSkipped = 0;

    console.log(`[PARSE START] Processing ${lines.length - 1} data rows, email column: "${emailCol}", shouldApplyQualityFilter: ${shouldApplyQualityFilter}`);

    // Process data rows
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvRow(lines[i]);
      
      // Skip completely empty rows
      if (!values || values.length === 0 || !values.some(v => v?.trim())) {
        emptyRowCount++;
        continue;
      }

      const row = {};
      // LENIENT: Map all available values to headers, don't care about count mismatch
      headers.forEach((h, idx) => {
        row[h] = (values[idx] || '').trim();
      });

      // ✅ CRITICAL: Get email from the detected column
      const rawEmail = row[emailCol];
      const email = rawEmail?.trim();
      
      if (!email) {
        invalidEmailCount++;
        if (i <= 3) console.log(`[PARSE] Row ${i}: Empty email field`);
        continue;
      }
      
      if (!isValidEmail(email)) {
        invalidEmailCount++;
        if (i <= 5) console.log(`[PARSE] Row ${i}: Invalid email format: "${email}"`);
        continue;
      }

      // ✅ Apply lead quality filter ONLY if column actually exists AND filter is set
      // NEVER apply filter if quality column wasn't found - that would silently drop all rows!
      if (shouldApplyQualityFilter) {
        const quality = (row[qualityCol] || '').trim().toUpperCase();
        // Only skip if quality column has a value AND it doesn't match filter
        if (quality && quality !== leadQualityFilter.toUpperCase()) {
          qualityFilterSkipped++;
          if (i <= 3) console.log(`[PARSE] Row ${i}: Filtered by quality - got "${quality}", wanted "${leadQualityFilter}"`);
          continue;
        }
      }

      recipients.push({ ...row, email });
    }
    
    const parseLog = `[PARSE COMPLETE] Rows: ${lines.length - 1} → Recipients: ${recipients.length} (Invalid emails: ${invalidEmailCount}, Empty: ${emptyRowCount}, Quality filtered: ${qualityFilterSkipped})`;
    console.log(parseLog);
    
    // ⚠️ Show sample recipients for debugging
    if (recipients.length > 0 && recipients.length <= 10) {
      console.log('[SAMPLE RECIPIENTS]', recipients.slice(0, 3).map(r => r.email));
    }

    if (recipients.length === 0) {
      // ✅ DIAGNOSTIC MODE: Show you EXACTLY what went wrong
      console.error('[PARSE ERROR] No recipients found! Full diagnostic:');
      console.error('  Email column:', emailCol);
      console.error('  Quality column:', qualityCol);
      console.error('  Should apply quality filter:', shouldApplyQualityFilter);
      console.error('  Quality filter:', leadQualityFilter);
      console.error('  Headers:', headers);
      console.error('  Total rows processed:', lines.length - 1);
      console.error('  Invalid emails: ' + invalidEmailCount);
      console.error('  Empty fields: ' + emptyRowCount);
      console.error('  Quality filtered: ' + qualityFilterSkipped);
      
      if (lines[1]) {
        const firstRowRaw = parseCsvRow(lines[1]);
        const firstRowMapped = {};
        headers.forEach((h, i) => firstRowMapped[h] = firstRowRaw[i] || '');
        console.error('  FIRST ROW DATA:', firstRowMapped);
        const emailFromRow = firstRowMapped[emailCol];
        console.error('  Email from first row:', emailFromRow);
        console.error('  Email valid?', isValidEmail(emailFromRow));
      }
      
      const diagMsg = `No valid recipients found. Processed ${lines.length - 1} rows: ${invalidEmailCount} invalid emails, ${emptyRowCount} empty, ${qualityFilterSkipped} filtered. See console for details.`;
      return Response.json({ 
        error: diagMsg,
        stats: {
          totalRows: lines.length - 1,
          invalidEmails: invalidEmailCount,
          emptyFields: emptyRowCount,
          qualityFiltered: qualityFilterSkipped
        },
        emailColumn: emailCol,
        qualityColumn: qualityCol
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

// ✅ AUTO-DETECT EMAIL COLUMN (bulletproof version)
function findEmailColumn(headers, fieldMappings) {
  if (!headers || headers.length === 0) return null;
  
  // 1. Check field mappings first (user-defined)
  if (fieldMappings?.email) {
    const mappedCol = headers.find(h => 
      h.toLowerCase() === fieldMappings.email.toLowerCase()
    );
    if (mappedCol) {
      console.log('[EMAIL COL] Found via fieldMappings:', mappedCol);
      return mappedCol;
    }
  }

  // 2. Try exact and common email column names (highest priority)
  const emailCandidates = [
    'email', 'Email', 'EMAIL', 
    'email_address', 'Email Address', 'emailaddress',
    'contact_email', 'e-mail', 'E-mail',
    'primary_email', 'business_email', 'work_email',
    'mail', 'Mail', 'MAIL'
  ];
  
  for (const candidate of emailCandidates) {
    const match = headers.find(h => h.toLowerCase() === candidate.toLowerCase());
    if (match) {
      console.log('[EMAIL COL] Found via exact match:', match);
      return match;
    }
  }

  // 3. Fallback: find any header containing "email"
  const emailMatch = headers.find(h => h.toLowerCase().includes('email'));
  if (emailMatch) {
    console.log('[EMAIL COL] Found via substring match:', emailMatch);
    return emailMatch;
  }
  
  // 4. Last resort: try first column as email (might work)
  if (headers.length > 0) {
    console.log('[EMAIL COL] WARNING: Using first column as fallback:', headers[0]);
    return headers[0];
  }
  
  return null;
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