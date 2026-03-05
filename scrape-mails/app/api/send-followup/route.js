// app/api/send-followup/route.js
// Send follow-up emails with hard stop after max follow-ups
// Maintains conversation loop closure

import { google } from 'googleapis';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { supabaseAdmin } from '../../../lib/supabaseClient';

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

const MAX_FOLLOWUPS = 3;

const FOLLOWUP_TEMPLATES = {
  1: {
    subject: 'Following up – {{business_name}}',
    body: 'Hi {{business_name}},\n\nJust circling back on my previous message. No pressure at all.\n\nBest,\nTeam'
  },
  2: {
    subject: '{{business_name}} – Quick value offer',
    body: 'Hi {{business_name}},\n\nOne final thought—I wanted to share a specific idea that could help.\n\nLet me know if you\'re open to a brief chat.\n\nBest,\nTeam'
  },
  3: {
    subject: 'Closing the loop',
    body: 'Hi {{business_name}},\n\nThis will be my last email—I respect your time.\n\nIf things change, I\'m here.\n\nBest,\nTeam'
  }
};

function renderFollowupText(template, recipient) {
  let text = template;
  text = text.replace(/\{\{\s*business_name\s*\}\}/g, recipient.business_name || 'there');
  return text;
}

export async function POST(req) {
  try {
    const { email, accessToken, userId, senderName } = await req.json();

    if (!email || !accessToken || !userId) {
      return Response.json(
        { error: 'Missing required: email, accessToken, userId' },
        { status: 400 }
      );
    }

    // ✅ Get sent email record
    const docRef = doc(db, 'sent_emails', `${userId}_${email}`);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return Response.json(
        { error: `Email ${email} not found in sent records`, code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const sentData = docSnap.data();

    // ✅ HARD BLOCK 1: Already replied
    if (sentData.replied) {
      return Response.json(
        {
          error: `Cannot send follow-up: ${email} already replied. Conversation closed.`,
          code: 'ALREADY_REPLIED',
          repliedAt: sentData.repliedAt
        },
        { status: 409 }
      );
    }

    // ✅ HARD BLOCK 2: Max follow-ups reached
    const currentFollowUpCount = sentData.followUpSentCount || 0;
    if (currentFollowUpCount >= MAX_FOLLOWUPS) {
      return Response.json(
        {
          error: `Cannot send follow-up: ${email} reached max follow-ups (${MAX_FOLLOWUPS})`,
          code: 'MAX_FOLLOWUPS_REACHED',
          followUpCount: currentFollowUpCount,
          maxAllowed: MAX_FOLLOWUPS
        },
        { status: 409 }
      );
    }

    // ✅ Get Gmail client
    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // ✅ Get next follow-up template
    const nextFollowUpNum = currentFollowUpCount + 1;
    const template = FOLLOWUP_TEMPLATES[nextFollowUpNum] || FOLLOWUP_TEMPLATES[3];

    const subject = renderFollowupText(template.subject, { business_name: sentData.businessName });
    const body = renderFollowupText(template.body, { business_name: sentData.businessName });

    // ✅ Build and send email
    const message = `To: ${email}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`;
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage }
    });

    // ✅ Update Firestore
    const isFinalFollowUp = nextFollowUpNum >= MAX_FOLLOWUPS;
    const followUpDates = sentData.followUpDates || [];
    followUpDates.push(new Date().toISOString());

    await setDoc(
      docRef,
      {
        followUpSentCount: nextFollowUpNum,
        followUpDates,
        lastFollowUpSentAt: new Date().toISOString(),
        loopClosed: isFinalFollowUp,
        status: isFinalFollowUp ? 'loop_closed' : 'awaiting_reply'
      },
      { merge: true }
    );

    // ✅ Update Supabase
    if (supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('follow_up_schedule')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('lead_email', email)
          .eq('follow_up_number', nextFollowUpNum);
      } catch (supabaseError) {
        console.warn('[send-followup] Supabase update failed:', supabaseError.message);
      }
    }

    return Response.json({
      success: true,
      email,
      followUpNumber: nextFollowUpNum,
      maxAllowed: MAX_FOLLOWUPS,
      loopClosed: isFinalFollowUp,
      messageId: result.data.id,
      message: `Follow-up #${nextFollowUpNum} sent${isFinalFollowUp ? ' (Loop closed - no more follow-ups)' : ''}`
    });

  } catch (error) {
    console.error('[send-followup] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to send follow-up' },
      { status: 500 }
    );
  }
}