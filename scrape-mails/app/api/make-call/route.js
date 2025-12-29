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

// Initialize Twilio
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
const yourPhone = process.env.YOUR_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { toPhone, businessName, userId, callType = 'direct' } = req.body;

  if (!toPhone || !businessName || !userId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Format phone number
    let formattedPhone = toPhone.toString().replace(/\D/g, '');
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    console.log(`📞 Initiating ${callType} call to ${businessName} at ${formattedPhone}`);

    // Save initial call record to Firebase
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

    // Create call based on type
    let call;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://your-domain.vercel.app';

    if (callType === 'direct') {
      // Direct call - plays automated message
      call = await client.calls.create({
        from: twilioPhone,
        to: formattedPhone,
        url: `${baseUrl}/api/voice-response?business=${encodeURIComponent(businessName)}&callId=${callId}`,
        statusCallback: `${baseUrl}/api/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'failed', 'busy', 'no-answer'],
        statusCallbackMethod: 'POST',
        record: true,
        recordingStatusCallback: `${baseUrl}/api/recording-callback`,
        recordingStatusCallbackMethod: 'POST',
        timeout: 60,
        machineDetection: 'DetectMessageEnd',
        machineDetectionTimeout: 5
      });
    } else if (callType === 'bridge') {
      // Bridge call - connects you first
      call = await client.calls.create({
        from: twilioPhone,
        to: yourPhone,
        url: `${baseUrl}/api/bridge-voice?target=${encodeURIComponent(formattedPhone)}&business=${encodeURIComponent(businessName)}&callId=${callId}`,
        statusCallback: `${baseUrl}/api/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'failed'],
        record: true
      });
    } else if (callType === 'interactive') {
      // Interactive IVR
      call = await client.calls.create({
        from: twilioPhone,
        to: formattedPhone,
        url: `${baseUrl}/api/interactive-voice?business=${encodeURIComponent(businessName)}&callId=${callId}`,
        statusCallback: `${baseUrl}/api/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'failed'],
        record: true
      });
    }

    // Update Firebase with call SID
    await setDoc(doc(db, 'calls', callId), {
      callSid: call.sid,
      status: call.status,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log(`✅ Call initiated: ${call.sid} - Status: ${call.status}`);

    return res.status(200).json({
      success: true,
      callId,
      callSid: call.sid,
      status: call.status,
      to: formattedPhone,
      from: twilioPhone,
      businessName,
      callType,
      message: `Call ${call.status} - Twilio is processing your request`
    });

  } catch (error) {
    console.error('❌ Twilio call error:', error);
    
    // Save error to Firebase
    try {
      await setDoc(doc(db, 'calls', callId || `error_${Date.now()}`), {
        userId,
        businessName,
        toPhone: formattedPhone,
        status: 'failed',
        error: error.message,
        errorCode: error.code,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (dbError) {
      console.error('Failed to save error to Firebase:', dbError);
    }

    return res.status(500).json({
      error: error.message || 'Failed to initiate call',
      code: error.code || 'UNKNOWN_ERROR',
      details: error.moreInfo || error.toString()
    });
  }
}