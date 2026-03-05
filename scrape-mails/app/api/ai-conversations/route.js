// Fetch AI-classified conversations and hot leads

import { getDocs, collection, query, where, orderBy, limit } from 'firebase/firestore';
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

export async function GET(req) {
  try {
    const userId = req.headers.get('x-user-id') || req.nextUrl.searchParams.get('userId');

    if (!userId) {
      return Response.json(
        { error: 'Missing userId in header or query' },
        { status: 400 }
      );
    }

    // ✅ Get replied emails from Firestore
    const repliedQuery = query(
      collection(db, 'sent_emails'),
      where('userId', '==', userId),
      where('replied', '==', true),
      orderBy('repliedAt', 'desc'),
      limit(50)
    );

    const repliedSnapshot = await getDocs(repliedQuery);
    const leadsWithReplies = [];

    repliedSnapshot.forEach(doc => {
      const data = doc.data();
      leadsWithReplies.push({
        id: doc.id,
        email: data.to,
        business_name: data.businessName || 'Unknown',
        replied: true,
        repliedAt: data.repliedAt,
        replyPreview: data.replyPreview,
        seemsInterested: data.seemsInterested || false
      });
    });

    // ✅ Get follow-ups scheduled for today
    const today = new Date().toDateString();
    const followupQuery = query(
      collection(db, 'sent_emails'),
      where('userId', '==', userId),
      where('replied', '==', false),
      where('followUpAt', '<=', new Date(today).getTime() + 86400000)
    );

    const followupSnapshot = await getDocs(followupQuery);
    const followupToday = [];

    followupSnapshot.forEach(doc => {
      const data = doc.data();
      followupToday.push({
        id: doc.id,
        email: data.to,
        business_name: data.businessName,
        followUpNumber: (data.followUpSentCount || 0) + 1,
        lastSentAt: data.sentAt
      });
    });

    // ✅ Identify "hot" leads (interested)
    const hotLeads = leadsWithReplies.filter(
      l => l.seemsInterested || (l.replyPreview && l.replyPreview.toLowerCase().includes('interested'))
    );

    return Response.json({
      success: true,
      leadsWithReplies,
      hotLeads,
      followupToday,
      stats: {
        totalReplies: leadsWithReplies.length,
        interestedCount: hotLeads.length,
        aiResolutionRate: leadsWithReplies.length > 0 
          ? Math.round((hotLeads.length / leadsWithReplies.length) * 100)
          : 0,
        followupsSentToday: followupToday.length
      }
    });

  } catch (error) {
    console.error('[ai-conversations] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

