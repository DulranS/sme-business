// app/api/track/click/route.js
import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, increment } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

if (!getApps().length) initializeApp(firebaseConfig);
const db = getFirestore();

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const clid = searchParams.get('clid');
  const url = searchParams.get('url') || '/';

  if (clid) {
    try {
      await updateDoc(doc(db, 'clicks', clid), {
        count: increment(1),
        lastClick: new Date().toISOString()
      });
      
      // ✅ Track email clicks for engagement stats (extract email from tracking ID)
      try {
        const { getDocs, query, where, collection } = await import('firebase/firestore');
        // Extract email from tracking ID format: userId_timestamp_random
        const parts = clid.split('_');
        if (parts.length >= 2) {
          const userId = parts[0];
          const q = query(collection(db, 'sent_emails'), where('trackingId', '==', clid));
          const snapshot = await getDocs(q);
          
          if (!snapshot.empty) {
            const docRef = snapshot.docs[0].ref;
            const now = new Date().toISOString();
            await updateDoc(docRef, {
              clicked: true,
              clickedAt: now,
              clickCount: increment(1),
              lastEngagementAt: now,
              interestScore: increment(20) // Click = 20 points (higher than open)
            });
          }
        }
      } catch (e) {
        console.error('Email click tracking error:', e);
      }
    } catch (e) {
      console.error('Click log error:', e);
    }
  }

  return NextResponse.redirect(url, 302);
}