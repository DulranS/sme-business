// app/api/get-daily-count/route.js
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';

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
    const { userId } = await req.json();
    
    if (!userId) {
      return Response.json({ error: 'User ID required' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const dailyCountDoc = doc(db, 'daily_email_counts', `${userId}_${today}`);
    const docSnap = await getDoc(dailyCountDoc);
    
    const count = docSnap.exists() ? (docSnap.data().count || 0) : 0;
    
    return Response.json({ 
      count,
      date: today,
      limit: 500,
      remaining: 500 - count
    });
  } catch (error) {
    console.error('Get daily count error:', error);
    return Response.json({ 
      error: error.message || 'Failed to get daily count',
      count: 0
    }, { status: 500 });
  }
}
