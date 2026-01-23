// app/api/make-call/route.js
import { NextResponse } from 'next';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import twilio from 'twilio';

// ✅ Initialize Firebase safely
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// 🔐 Twilio
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export async function POST(req) {
  // ✅ Always return JSON
  const sendJson = (data, status = 200) => {
    return NextResponse.json(data, { status });
  };

  try {
    const body = await req.json();
    const { toPhone, businessName, userId, callType = 'direct' } = body;

    // ✅ Input validation
    if (!toPhone || !businessName || !userId) {
      return sendJson(
        { error: 'Missing required fields: toPhone, businessName, userId' },
        400
      );
    }

    // ✅ Twilio config check
    if (!client) {
      console.error('Twilio not configured');
      return sendJson({ error: 'Twilio is not configured' }, 500);
    }

    // ✅ Format phone
    let formattedPhone = toPhone.toString().replace(/\D/g, '');
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    // ✅ Save initial call record
    const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await setDoc(doc(db, 'calls', callId), {
      userId,
      businessName,
      toPhone: formattedPhone,
      callType,
      status: 'initiating',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // ✅ Make call
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://mails2leadsfvxx.vercel.app').trim();
    let call;

    if (callType === 'direct') {
      call = await client.calls.create({
        from: twilioPhone,
        to: formattedPhone,
        url: `${baseUrl}/api/voice-response?business=${encodeURIComponent(businessName)}&callId=${callId}`,
        statusCallback: `${baseUrl}/api/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'failed', 'busy', 'no-answer'],
        record: true,
        machineDetection: 'DetectMessageEnd'
      });
    } else if (callType === 'bridge') {
      call = await client.calls.create({
        from: twilioPhone,
        to: process.env.YOUR_PHONE_NUMBER,
        url: `${baseUrl}/api/bridge-voice?target=${encodeURIComponent(formattedPhone)}&business=${encodeURIComponent(businessName)}&callId=${callId}`,
        statusCallback: `${baseUrl}/api/call-status`,
        record: true
      });
    } else if (callType === 'interactive') {
      call = await client.calls.create({
        from: twilioPhone,
        to: formattedPhone,
        url: `${baseUrl}/api/interactive-voice?business=${encodeURIComponent(businessName)}&callId=${callId}`,
        statusCallback: `${baseUrl}/api/call-status`,
        record: true
      });
    }

    // ✅ Update with SID
    await setDoc(doc(db, 'calls', callId), {
      callSid: call.sid,
      status: call.status,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return sendJson({
      success: true,
      callId,
      callSid: call.sid,
      status: call.status,
      to: formattedPhone,
      from: twilioPhone,
      businessName,
      callType
    });

  } catch (error) {
    console.error('❌ make-call API error:', error);

    // ✅ Log error to Firestore for debugging
    try {
      const errorId = `error_${Date.now()}`;
      await setDoc(doc(db, 'calls', errorId), {
        status: 'failed',
        error: error.message || 'Unknown error',
        stack: error.stack?.substring(0, 1000),
        timestamp: new Date().toISOString()
      });
    } catch (dbError) {
      console.error('Failed to log error to Firestore:', dbError);
    }

    // ✅ ALWAYS return JSON
    return sendJson({
      error: error.message || 'Internal server error',
      code: error.code || 'INTERNAL_ERROR'
    }, 500);
  }
}