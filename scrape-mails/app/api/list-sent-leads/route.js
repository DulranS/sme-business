// app/api/list-sent-leads/route.js
// Query sent emails with follow-up status and engagement metrics

import { getDocs, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

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
    const { userId, limitNum = 100, filter = 'all' } = await req.json();

    if (!userId) {
      return Response.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    let q = collection(db, 'sent_emails');
    const constraints = [where('userId', '==', userId)];

    // ✅ Apply filter
    if (filter === 'replied') {
      constraints.push(where('replied', '==', true));
    } else if (filter === 'pending') {
      constraints.push(where('replied', '==', false));
    }

    constraints.push(orderBy('sentAt', 'desc'));
    constraints.push(limit(limitNum));

    const q_final = query(q, ...constraints);
    const snapshot = await getDocs(q_final);

    const leads = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      leads.push({
        id: doc.id,
        email: data.to,
        business_name: data.businessName || 'Unknown',
        status: data.replied ? 'replied' : 'awaiting_reply',
        replied: data.replied || false,
        opened: data.opened || false,
        clicked: data.clicked || false,
        sentAt: data.sentAt,
        repliedAt: data.repliedAt || null,
        followUpSentCount: data.followUpSentCount || 0,
        followUpAt: data.followUpAt || null,
        engagement: {
          opens: data.openedCount || 0,
          clicks: data.clickCount || 0,
          lastEngagement: data.lastEngagementAt || null
        },
        interestScore: data.interestScore || 0,
        quality: data.leadQuality || 'unknown'
      });
    });

    // ✅ Calculate aggregate stats
    const stats = {
      total: leads.length,
      replied: leads.filter(l => l.replied).length,
      pending: leads.filter(l => !l.replied).length,
      opened: leads.filter(l => l.opened).length,
      clicked: leads.filter(l => l.clicked).length,
      engagementRate: leads.length > 0 
        ? Math.round((leads.filter(l => l.opened || l.clicked).length / leads.length) * 100)
        : 0,
      replyRate: leads.length > 0
        ? Math.round((leads.filter(l => l.replied).length / leads.length) * 100)
        : 0
    };

    return Response.json({
      success: true,
      leads,
      stats,
      filter,
      message: `Retrieved ${leads.length} sent leads`
    });

  } catch (error) {
    console.error('[list-sent-leads] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to list sent leads' },
      { status: 500 }
    );
  }
}