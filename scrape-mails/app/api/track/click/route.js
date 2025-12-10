// app/api/track/click/route.js
import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, increment } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDE-hRmyPs02dBm_OlVfwR9ZzmmMIiKw7o",
  authDomain: "email-marketing-c775d.firebaseapp.com",
  projectId: "email-marketing-c775d",
  storageBucket: "email-marketing-c775d.firebasestorage.app",
  messagingSenderId: "178196903576",
  appId: "1:178196903576:web:56b97d8e0b7943e3ee82ed",
  measurementId: "G-6CL2EGLEVH"
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
    } catch (e) {
      console.error('Click log error:', e);
    }
  }

  return NextResponse.redirect(url, 302);
}