// app/api/send-followup/route.js
import { NextResponse } from 'next/server';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { google } from 'googleapis';

// Firebase
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};


const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// Templates (same as dashboard)
const FOLLOW_UP_1 = {
  subject: 'Quick question for {{business_name}}',
  body: `Hi {{business_name}},

Just circling back—did my note about outsourced dev & ops support land at a bad time?

No pressure at all, but if you’re ever swamped with web, automation, or backend work and need a reliable extra hand (especially for white-label or fast-turnaround needs), we’re ready to help.

Even a 1-hour task is a great way to test the waters.

Either way, wishing you a productive week!

Best,  
Dulran  
Founder — Syndicate Solutions  
WhatsApp: 0741143323`
};

const FOLLOW_UP_2 = {
  subject: '{{business_name}}, a quick offer (no strings)',
  body: `Hi again,

I noticed you haven’t had a chance to reply—totally understand!

To make this zero-risk: **I’ll audit one of your digital workflows (e.g., lead capture, client onboarding, internal tooling) for free** and send 2–3 actionable automation ideas you can implement immediately—even if you never work with us.

Zero sales pitch. Just value.

Interested? Hit “Yes” or reply with a workflow you’d like optimized.

Cheers,  
Dulran  
Portfolio: https://syndicatesolutions.vercel.app/  
Book a call: https://cal.com/syndicate-solutions/15min`
};

const FOLLOW_UP_3 = {
  subject: 'Closing the loop',
  body: `Hi {{business_name}},

I’ll stop emailing after this one! 😅

Just wanted to say: if outsourcing ever becomes a priority—whether for web dev, AI tools, or ongoing ops—we’re here. Many of our clients started with a tiny $100 task and now work with us monthly.

If now’s not the time, no worries! I’ll circle back in a few months.

Either way, keep crushing it!

— Dulran  
WhatsApp: 0741143323`
};

function renderText(text, businessName) {
  return text.replace(/{{business_name}}/g, businessName);
}

// ✅ SECURITY: Input validation helper
function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim()) && email.length <= 254;
}

function validateUserId(userId) {
  if (!userId || typeof userId !== 'string') return false;
  // Firebase UIDs are typically 28 characters, alphanumeric
  return /^[a-zA-Z0-9]{20,}$/.test(userId);
}

export async function POST(req) {
  try {
    const { email, userId, accessToken } = await req.json();

    // ✅ SECURITY: Input validation
    if (!email || !userId || !accessToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ✅ SECURITY: Validate email format
    if (!validateEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // ✅ SECURITY: Validate userId format
    if (!validateUserId(userId)) {
      return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
    }

    // ✅ SECURITY: Sanitize email (lowercase, trim)
    const sanitizedEmail = email.trim().toLowerCase();

    const docId = `${userId}_${sanitizedEmail}`;
    const docRef = doc(db, 'sent_emails', docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return NextResponse.json({ error: 'Email record not found' }, { status: 404 });
    }

    const data = docSnap.data();
    
    // ✅ SECURITY: Verify userId matches the document owner
    if (data.userId !== userId) {
      return NextResponse.json({ 
        error: 'Unauthorized: User ID mismatch' 
      }, { status: 403 });
    }
    
    // ✅ CRITICAL: BLOCK if lead has already replied (closing the loop)
    if (data.replied) {
      return NextResponse.json({ 
        error: 'Lead has already replied. No further emails should be sent.',
        code: 'ALREADY_REPLIED'
      }, { status: 403 });
    }
    
    // ✅ CRITICAL: BLOCK if already sent 3+ follow-ups (closing the loop)
    const currentFollowUpCount = data.followUpSentCount || 0;
    if (currentFollowUpCount >= 3) {
      return NextResponse.json({ 
        error: 'Maximum follow-ups (3) already sent. Loop is closed. No further emails should be sent.',
        code: 'MAX_FOLLOWUPS_REACHED',
        followUpCount: currentFollowUpCount
      }, { status: 403 });
    }
    
    const sentAt = new Date(data.sentAt);
    const now = new Date();
    const days = (now - sentAt) / (1000 * 60 * 60 * 24);

    let template;
    if (days >= 7) template = FOLLOW_UP_3;
    else if (days >= 5) template = FOLLOW_UP_2;
    else if (days >= 2) template = FOLLOW_UP_1;
    else return NextResponse.json({ error: 'Too early' }, { status: 400 });

    // ✅ SECURITY: Sanitize business name to prevent XSS
    const businessName = sanitizedEmail.split('@')[0].replace(/[^a-zA-Z0-9\s]/g, ' ').substring(0, 50);
    const subject = renderText(template.subject, businessName);
    const body = renderText(template.body, businessName);

    // Send via Gmail
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const rawMessage = Buffer.from(
      `To: ${email}\r\n` +
      `Subject: ${subject}\r\n` +
      `Content-Type: text/plain; charset=utf-8\r\n\r\n` +
      body
    ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: rawMessage }
    });

    // Update record with follow-up tracking
    const followUpCount = (data.followUpSentCount || 0) + 1;
    const existingDates = data.followUpDates || [];
    const updatedDates = [...existingDates, now.toISOString()];
    
    // ✅ If this is follow-up 3 (closing the loop), mark as final and disable future follow-ups
    const isFinalFollowUp = followUpCount >= 3;
    
    await updateDoc(docRef, {
      followUpSentCount: followUpCount,
      lastFollowUpSentAt: now.toISOString(),
      // ✅ CRITICAL: Track all follow-up dates
      followUpDates: updatedDates,
      // ✅ If closing the loop (follow-up 3), set followUpAt to far future to prevent any more sends
      followUpAt: isFinalFollowUp 
        ? new Date('2099-12-31').toISOString() // Far future date to effectively disable
        : new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
      // ✅ Mark that loop is closed if this is the final follow-up
      loopClosed: isFinalFollowUp
    });

    return NextResponse.json({ 
      success: true, 
      followUpCount: followUpCount,
      message: `Follow-up #${followUpCount} sent successfully`
    });
  } catch (error) {
    console.error('Follow-up error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}