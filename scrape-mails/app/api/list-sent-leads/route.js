// app/api/list-sent-leads/route.js
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';

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

export async function POST(req) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return Response.json({ error: 'User ID required' }, { status: 400 });
    }

    const q = query(collection(db, 'sent_emails'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const leads = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      leads.push({
        email: data.to,
        sentAt: data.sentAt,
        replied: data.replied || false,
        followUpAt: data.followUpAt
      });
    });

    leads.sort((a, b) => {
      if (a.replied && !b.replied) return -1;
      if (!a.replied && b.replied) return 1;
      const aReady = new Date(a.followUpAt) <= new Date();
      const bReady = new Date(b.followUpAt) <= new Date();
      if (aReady && !bReady) return -1;
      if (!aReady && bReady) return 1;
      return new Date(b.sentAt) - new Date(a.sentAt);
    });

    return Response.json({ leads });
  } catch (error) {
    console.error('List sent leads error:', error);
    return Response.json({ error: 'Failed to load sent leads' }, { status: 500 });
  }
}