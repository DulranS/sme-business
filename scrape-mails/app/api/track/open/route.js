// app/api/track/open/route.js
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