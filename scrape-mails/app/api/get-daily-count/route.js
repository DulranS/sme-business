// app/api/get-daily-count/route.js
// Track daily email sending count and enforce limits

import { doc, getDoc, setDoc } from 'firebase/firestore';
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

const DAILY_LIMIT = parseInt(process.env.NEXT_PUBLIC_DAILY_EMAIL_LIMIT || '500');

export async function POST(req) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return Response.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    // ✅ Get today's count
    const today = new Date().toDateString();
    const docRef = doc(db, 'daily_limits', `${userId}_${today}`);
    const docSnap = await getDoc(docRef);

    const count = docSnap.data()?.count || 0;
    const remaining = Math.max(0, DAILY_LIMIT - count);
    const resetTime = new Date();
    resetTime.setHours(24, 0, 0, 0);

    return Response.json({
      success: true,
      count,
      limit: DAILY_LIMIT,
      remaining,
      resetTime: resetTime.toISOString(),
      percentUsed: Math.round((count / DAILY_LIMIT) * 100),
      message: `${count}/${DAILY_LIMIT} emails sent today`
    });

  } catch (error) {
    console.error('[get-daily-count] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to get daily count' },
      { status: 500 }
    );
  }
}
