// app/api/track/open/route.js
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
  const testId = searchParams.get('test');
  const version = searchParams.get('v');

  if (testId && version) {
    try {
      const testRef = doc(db, 'users', 'anon', 'ab_tests', testId);
      await updateDoc(testRef, {
        [`results.${version}.opened`]: increment(1)
      });
    } catch (e) {
      console.error('Track open error:', e);
    }
  }

  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  return new NextResponse(pixel, {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-cache' }
  });
}