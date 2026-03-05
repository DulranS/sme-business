// app/api/check-replies/route.js
// Check Gmail for new replies using Gmail API
// Mirrors findings to Firestore + Supabase for AI workflows

import { google } from 'googleapis';
import { doc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
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

export async function POST(req) {
  try {
    const { accessToken, userId } = await req.json();

    if (!accessToken || !userId) {
      return Response.json(
        { error: 'Missing accessToken or userId' },
        { status: 400 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // ✅ Get sent emails from our records
    const sentEmailsQuery = query(
      collection(db, 'sent_emails'),
      where('userId', '==', userId),
      where('replied', '==', false)
    );

    const sentSnapshot = await getDocs(sentEmailsQuery);
    const replies = [];
    let repliedCount = 0;

    // ✅ Check each sent email for replies
    for (const sentDoc of sentSnapshot.docs) {
      const sentData = sentDoc.data();
      const threadId = sentData.threadId;

      if (!threadId) continue;

      try {
        // ✅ Get full thread
        const threadRes = await gmail.users.threads.get({
          userId: 'me',
          id: threadId,
          format: 'full'
        });

        const messages = threadRes.data.messages || [];
        
        // ✅ Find replies (messages after our sent message)
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          const headers = msg.payload.headers || [];
          const fromHeader = headers.find(h => h.name === 'From')?.value || '';
          const timeMs = parseInt(msg.internalDate);

          // Check if this message is from someone else (a reply)
          if (!fromHeader.includes('noreply@') && i > 0) {
            const bodyData = msg.payload.parts?.[0]?.body?.data ||
                           msg.payload.body?.data;
            
            const replyBody = bodyData
              ? Buffer.from(bodyData, 'base64').toString('utf-8')
              : '';

            replies.push({
              originalTo: sentData.to,
              replyFrom: fromHeader,
              replyBody: replyBody.slice(0, 500),
              repliedAt: new Date(timeMs).toISOString(),
              threadId,
              messageId: msg.id
            });

            // ✅ Update Firestore
            await setDoc(
              doc(db, 'sent_emails', sentDoc.id),
              {
                replied: true,
                repliedAt: new Date(timeMs).toISOString(),
                replyPreview: replyBody.slice(0, 200)
              },
              { merge: true }
            );

            repliedCount++;

            // ✅ Update Supabase
            if (supabaseAdmin) {
              try {
                await supabaseAdmin
                  .from('email_threads')
                  .insert({
                    lead_email: sentData.to,
                    gmail_thread_id: threadId,
                    gmail_message_id: msg.id,
                    subject: headers.find(h => h.name === 'Subject')?.value || '',
                    direction: 'received',
                    body: replyBody.slice(0, 2000),
                    received_at: new Date(timeMs).toISOString()
                  });
              } catch (supabaseError) {
                console.warn('[check-replies] Supabase insert failed:', supabaseError.message);
              }
            }

            break; // Found reply for this thread
          }
        }
      } catch (threadError) {
        console.warn(`[check-replies] Error checking thread ${threadId}:`, threadError.message);
      }
    }

    return Response.json({
      success: true,
      repliedCount,
      replies,
      totalChecked: sentSnapshot.size,
      message: `Found ${repliedCount} new replies from ${sentSnapshot.size} sent emails`
    });

  } catch (error) {
    console.error('[check-replies] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to check replies' },
      { status: 500 }
    );
  }
}