// app/api/get-daily-count/route.js
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: "AIzaSyDE-hRmyPs02dBm_OlVfwR9ZzmmMIiKw7o",
  authDomain: "email-marketing-c775d.firebaseapp.com",
  projectId: "email-marketing-c775d",
  storageBucket: "email-marketing-c775d.firebasestorage.app",
  messagingSenderId: "178196903576",
  appId: "1:178196903576:web:56b97d8e0b7943e3ee82ed"
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
