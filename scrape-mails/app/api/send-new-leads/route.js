// app/api/send-new-leads/route.js
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { google } from 'googleapis';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

const DAILY_EMAIL_LIMIT = 500;

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

function buildHtmlEmail(to, subject, body, images, trackingId) {
  let htmlBody = body.replace(/\n/g, '<br>');
  const boundary = 'boundary_' + Date.now();

  images.forEach(img => {
    const imgTag = `<img src="cid:${img.cid}" alt="Inline" style="max-width:100%;">`;
    htmlBody = htmlBody.replace(new RegExp(img.placeholder, 'g'), imgTag);
  });

  // ✅ Add click tracking to links
  if (trackingId) {
    htmlBody = htmlBody.replace(
      /<a\s+href=["']([^"']+)["']/gi,
      (match, url) => {
        const trackingUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/track/click?clid=${trackingId}&url=${encodeURIComponent(url)}`;
        return match.replace(url, trackingUrl);
      }
    );
    
    // ✅ Add open tracking pixel at the end
    const trackingPixel = `<img src="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/track/open?email=${encodeURIComponent(to)}&tid=${trackingId}" width="1" height="1" style="display:none;" />`;
    htmlBody += trackingPixel;
  }

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

function cleanEmail(email) {
  if (!email) return '';
  return email.trim()
    .toLowerCase()
    .replace(/^["'`]+/, '')
    .replace(/["'`]+$/, '')
    .replace(/[<>]/g, '')
    .trim();
}

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  
  let cleaned = email.trim()
    .toLowerCase()
    .replace(/^["'`]+/, '')
    .replace(/["'`]+$/, '')
    .replace(/\s+/g, '')
    .replace(/[<>]/g, '');
  
  if (cleaned.length < 5) return false;
  if (cleaned === 'undefined' || cleaned === 'null' || cleaned === 'na' || cleaned === 'n/a') return false;
  if (cleaned.startsWith('[') || cleaned.includes('missing')) return false;
  
  const atCount = (cleaned.match(/@/g) || []).length;
  if (atCount !== 1) return false;
  
  const parts = cleaned.split('@');
  const [localPart, domainPart] = parts;
  
  if (!localPart || localPart.length < 1) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
  
  if (!domainPart || domainPart.length < 3) return false;
  if (!domainPart.includes('.')) return false;
  if (domainPart.startsWith('.') || domainPart.endsWith('.')) return false;
  
  const domainBits = domainPart.split('.');
  const tld = domainBits[domainBits.length - 1];
  
  if (!tld || tld.length < 2 || tld.length > 6) return false;
  if (!/^[a-z0-9-]+$/.test(tld)) return false;
  if (tld.startsWith('-') || tld.endsWith('-')) return false;
  
  return true;
}

async function getDailyEmailCount(userId) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const dailyCountDoc = doc(db, 'daily_email_counts', `${userId}_${today}`);
  const docSnap = await getDoc(dailyCountDoc);
  
  if (docSnap.exists()) {
    return docSnap.data().count || 0;
  }
  return 0;
}

async function incrementDailyEmailCount(userId) {
  const today = new Date().toISOString().split('T')[0];
  const dailyCountDoc = doc(db, 'daily_email_counts', `${userId}_${today}`);
  const docSnap = await getDoc(dailyCountDoc);
  
  const currentCount = docSnap.exists() ? (docSnap.data().count || 0) : 0;
  
  await setDoc(dailyCountDoc, {
    userId,
    date: today,
    count: currentCount + 1,
    lastUpdated: new Date().toISOString()
  }, { merge: true });
  
  return currentCount + 1;
}

async function getSentEmailsSet(userId) {
  const q = query(collection(db, 'sent_emails'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  const sentSet = new Set();
  
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.to) {
      sentSet.add(cleanEmail(data.to));
    }
  });
  
  return sentSet;
}

async function saveSentEmailRecord(userId, email, threadId, trackingId) {
  const sentAt = new Date();
  const followUpAt = new Date(sentAt.getTime() + 48 * 60 * 60 * 1000); // 48 hours

  await setDoc(doc(db, 'sent_emails', `${userId}_${email}`), {
    userId,
    to: email,
    threadId,
    trackingId: trackingId || null,
    sentAt: sentAt.toISOString(),
    replied: false,
    followUpAt: followUpAt.toISOString(),
    followUpSentCount: 0,
    lastFollowUpSentAt: null,
    followUpDates: [],
    isNewLead: true, // Mark as new lead outreach
    // ✅ Engagement tracking
    opened: false,
    openedAt: null,
    openedCount: 0,
    clicked: false,
    clickedAt: null,
    clickCount: 0,
    lastEngagementAt: null,
    interestScore: 0
  });
}

export async function POST(req) {
  try {
    const {
      recipients,
      senderName,
      fieldMappings,
      accessToken,
      template,
      userId,
      emailImages = []
    } = await req.json();

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return Response.json({ error: 'No recipients provided' }, { status: 400 });
    }

    if (!accessToken || !userId || !template) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ✅ Check daily email limit
    const currentDailyCount = await getDailyEmailCount(userId);
    if (currentDailyCount >= DAILY_EMAIL_LIMIT) {
      return Response.json({ 
        error: `Daily email limit reached (${DAILY_EMAIL_LIMIT} emails/day). Please try again tomorrow.`,
        dailyCount: currentDailyCount,
        limit: DAILY_EMAIL_LIMIT
      }, { status: 429 });
    }

    // ✅ Get set of already-sent emails to prevent duplicates
    const sentEmailsSet = await getSentEmailsSet(userId);

    // ✅ Filter out already-sent emails and invalid emails
    const newLeads = recipients
      .map(recipient => {
        const email = cleanEmail(recipient.email);
        return { ...recipient, email };
      })
      .filter(recipient => {
        if (!isValidEmail(recipient.email)) return false;
        if (sentEmailsSet.has(recipient.email)) return false; // Skip already-sent
        return true;
      });

    if (newLeads.length === 0) {
      return Response.json({ 
        error: 'No new leads to email. All recipients have already been contacted.',
        totalRecipients: recipients.length,
        alreadySent: recipients.length
      }, { status: 400 });
    }

    // ✅ Calculate how many we can send today
    const remainingQuota = DAILY_EMAIL_LIMIT - currentDailyCount;
    const leadsToSend = newLeads.slice(0, remainingQuota);

    if (leadsToSend.length < newLeads.length) {
      console.log(`⚠️ Limiting to ${leadsToSend.length} emails (${remainingQuota} remaining quota today)`);
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    let sentCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const recipient of leadsToSend) {
      try {
        // ✅ Check quota before each send
        const currentCount = await getDailyEmailCount(userId);
        if (currentCount >= DAILY_EMAIL_LIMIT) {
          console.log(`⚠️ Daily limit reached. Stopping at ${sentCount} emails.`);
          break;
        }

        const subject = renderText(template.subject, recipient, fieldMappings, senderName);
        const body = renderText(template.body, recipient, fieldMappings, senderName);

        // ✅ Generate tracking ID for this email
        const trackingId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const rawMessage = emailImages.length > 0 
          ? buildHtmlEmail(recipient.email, subject, body, emailImages, trackingId)
          : buildPlainTextEmail(recipient.email, subject, body);

        const response = await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: rawMessage }
        });

        if (response.data?.threadId) {
          await saveSentEmailRecord(userId, recipient.email, response.data.threadId, trackingId);
          await incrementDailyEmailCount(userId);
          sentCount++;
        }
      } catch (e) {
        console.warn(`Failed to send to ${recipient.email}:`, e.message);
        failedCount++;
        errors.push({ email: recipient.email, error: e.message });
      }
    }

    const finalDailyCount = await getDailyEmailCount(userId);
    const remainingToday = DAILY_EMAIL_LIMIT - finalDailyCount;

    return Response.json({ 
      sent: sentCount, 
      total: leadsToSend.length,
      failed: failedCount,
      skipped: newLeads.length - leadsToSend.length,
      dailyCount: finalDailyCount,
      remainingToday,
      limit: DAILY_EMAIL_LIMIT,
      errors: errors.slice(0, 10) // Return first 10 errors
    });
  } catch (error) {
    console.error('Send New Leads API Error:', error);
    return Response.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
