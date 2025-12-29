import twilio from 'twilio';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';

// Initialize Firebase (use your config)
const firebaseConfig = {
  apiKey: "AIzaSyDE-hRmyPs02dBm_OlVfwR9ZzmmMIiKw7o",
  authDomain: "email-marketing-c775d.firebaseapp.com",
  projectId: "email-marketing-c775d",
  storageBucket: "email-marketing-c775d.firebasestorage.app",
  messagingSenderId: "178196903576",
  appId: "1:178196903576:web:56b97d8e0b7943e3ee82ed"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// ✅ SAFELY get env vars — fail fast if missing
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
const yourPhone = process.env.YOUR_PHONE_NUMBER;

if (!accountSid || !authToken || !twilioPhone || !yourPhone) {
  console.error('❌ Missing Twilio environment variables');
}

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export default async function handler(req, res) {
  // ✅ Ensure JSON response ALWAYS
  res.setHeader('Content-Type', 'application/json');

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { toPhone, businessName, userId, callType = 'direct' } = req.body;

    if (!toPhone || !businessName || !userId) {
      return res.status(400).json({ error: 'Missing required fields: toPhone, businessName, userId' });
    }

    // ✅ Early exit if Twilio not configured
    if (!client) {
      console.error('Twilio client not initialized — check env vars');
      return res.status(500).json({
        error: 'Twilio is not configured',
        code: 'TWILIO_NOT_READY'
      });
    }

    // Format phone number
    let formattedPhone = toPhone.toString().replace(/\D/g, '');
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    // Save call record
    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await setDoc(doc(db, 'calls', callId), {
      userId,
      businessName,
      toPhone: formattedPhone,
      callType,
      status: 'initiating',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Build URL safely
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://mails2leadsfvxx.vercel.app').replace(/\s+$/, '');
    
    let call;
    if (callType === 'direct') {
      call = await client.calls.create({
        from: twilioPhone,
        to: formattedPhone,
        url: `${baseUrl}/api/voice-response?business=${encodeURIComponent(businessName)}&callId=${callId}`,
        statusCallback: `${baseUrl}/api/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'failed', 'busy', 'no-answer'],
        record: true,
        recordingStatusCallback: `${baseUrl}/api/recording-callback`,
        timeout: 60,
        machineDetection: 'DetectMessageEnd'
      });
    } else if (callType === 'bridge') {
      call = await client.calls.create({
        from: twilioPhone,
        to: yourPhone,
        url: `${baseUrl}/api/bridge-voice?target=${encodeURIComponent(formattedPhone)}&business=${encodeURIComponent(businessName)}&callId=${callId}`,
        statusCallback: `${baseUrl}/api/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'failed'],
        record: true
      });
    } else if (callType === 'interactive') {
      call = await client.calls.create({
        from: twilioPhone,
        to: formattedPhone,
        url: `${baseUrl}/api/interactive-voice?business=${encodeURIComponent(businessName)}&callId=${callId}`,
        statusCallback: `${baseUrl}/api/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'failed'],
        record: true
      });
    }

    // Update with SID
    await setDoc(doc(db, 'calls', callId), {
      callSid: call?.sid,
      status: call?.status || 'queued',
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return res.status(200).json({
      success: true,
      callId,
      callSid: call.sid,
      status: call.status,
      to: formattedPhone,
      from: twilioPhone,
      businessName,
      callType,
      message: `Call ${call.status} — Twilio is processing your request`
    });

  } catch (error) {
    console.error('❌ FATAL Twilio API error:', error);

    // Try to log to Firebase even on error
    try {
      const callId = `error_${Date.now()}`;
      await setDoc(doc(db, 'calls', callId), {
        status: 'failed',
        error: error.message || 'Unknown error',
        stack: error.stack?.substring(0, 1000),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (dbError) {
      console.error('Failed to log error to Firebase:', dbError);
    }

    // ✅ ALWAYS return valid JSON
    return res.status(500).json({
      error: error.message || 'Internal Server Error',
      code: error.code || 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}