// app/api/send-followup/route.js
import { NextResponse } from 'next/server';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { google } from 'googleapis';

// Firebase
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

export async function POST(req) {
  try {
    const { email, userId, accessToken } = await req.json();

    if (!email || !userId || !accessToken) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const docId = `${userId}_${email}`;
    const docRef = doc(db, 'sent_emails', docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return NextResponse.json({ error: 'Email record not found' }, { status: 404 });
    }

    const data = docSnap.data();
    const sentAt = new Date(data.sentAt);
    const now = new Date();
    const days = (now - sentAt) / (1000 * 60 * 60 * 24);

    let template;
    if (days >= 7) template = FOLLOW_UP_3;
    else if (days >= 5) template = FOLLOW_UP_2;
    else if (days >= 2) template = FOLLOW_UP_1;
    else return NextResponse.json({ error: 'Too early' }, { status: 400 });

    const businessName = email.split('@')[0].replace(/[^a-zA-Z]/g, ' ');
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
    
    await updateDoc(docRef, {
      followUpSentCount: followUpCount,
      lastFollowUpSentAt: now.toISOString(),
      // ✅ CRITICAL: Track all follow-up dates
      followUpDates: updatedDates,
      // ✅ Reset follow-up window for next round
      followUpAt: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString()
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