// app/api/check-replies/route.js
import { getFirestore, doc, getDocs, collection, query, where, updateDoc } from 'firebase/firestore';
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

// ✅ SECURITY: Input validation helper
function validateUserId(userId) {
  if (!userId || typeof userId !== 'string') return false;
  return /^[a-zA-Z0-9]{20,}$/.test(userId);
}

export async function POST(req) {
  try {
    const { accessToken, userId } = await req.json();

    // ✅ SECURITY: Input validation
    if (!accessToken || !userId) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ✅ SECURITY: Validate userId format
    if (!validateUserId(userId)) {
      return Response.json({ error: 'Invalid user ID format' }, { status: 400 });
    }

    const sentQuery = query(collection(db, 'sent_emails'), where('userId', '==', userId));
    const sentSnapshot = await getDocs(sentQuery);
    if (sentSnapshot.empty) {
      return Response.json({ repliedCount: 0 });
    }

    const threadToEmail = {};
    const emailToDocId = {};
    sentSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!data.replied && data.threadId) {
        threadToEmail[data.threadId] = data.to;
        emailToDocId[data.to] = doc.id;
      }
    });

    if (Object.keys(threadToEmail).length === 0) {
      return Response.json({ repliedCount: 0 });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const afterTimestamp = Math.floor(thirtyDaysAgo.getTime() / 1000);

    const messagesRes = await gmail.users.messages.list({
      userId: 'me',
      q: `in:inbox after:${afterTimestamp}`,
      maxResults: 100
    });

    const messageIds = messagesRes.data.messages?.map(m => m.id) || [];
    let repliedCount = 0;

    for (const msgId of messageIds) {
      const msgRes = await gmail.users.messages.get({
        userId: 'me',
        id: msgId,
        format: 'metadata',
        metadataHeaders: ['References', 'In-Reply-To', 'From']
      });

      const headers = msgRes.data.payload?.headers || [];
      const from = headers.find(h => h.name === 'From')?.value || '';

      if (from.includes('@gmail.com')) continue;

      const threadId = msgRes.data.threadId;
      const email = threadToEmail[threadId];
      if (email) {
        const docId = emailToDocId[email];
        const repliedAt = new Date().toISOString();
        // ✅ Track when lead replied for 30-day deletion logic
        await updateDoc(doc(db, 'sent_emails', docId), { 
          replied: true,
          repliedAt: repliedAt // Track reply date for cleanup
        });
        await updateDoc(doc(db, 'deals', email), {
          stage: 'replied',
          lastUpdate: repliedAt
        });
        repliedCount++;
        delete threadToEmail[threadId];
      }
    }

    return Response.json({ repliedCount });
  } catch (error) {
    console.error('Check replies error:', error);
    return Response.json({ error: error.message || 'Failed to check replies' }, { status: 500 });
  }
}