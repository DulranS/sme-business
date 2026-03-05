// app/api/make-call/route.js
// Initiates outbound calls via Twilio with compliance tracking
// Maintains same pattern as send-email: Firebase + Supabase sync

import twilio from 'twilio';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { supabaseAdmin } from '../../../lib/supabaseClient';

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

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken) {
  console.error('⚠️ Twilio credentials missing - calls will not work');
}

const twilioClient = twilio(accountSid, authToken);

// ✅ Format phone to E.164 standard
function formatPhoneE164(raw) {
  if (!raw || typeof raw !== 'string') return null;
  
  let cleaned = raw.replace(/[^\d+]/g, '');
  
  // Handle local formats (assume +1 for US if no country code)
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) cleaned = '+1' + cleaned;
    else if (cleaned.length === 11 && cleaned.startsWith('1')) cleaned = '+' + cleaned;
    else cleaned = '+1' + cleaned; // Default fallback
  }
  
  // Validate E.164: +[1-9]\d{1,14}
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(cleaned) ? cleaned : null;
}

export async function POST(req) {
  try {
    const {
      toPhone,
      businessName,
      contactName,
      userId,
      callType = 'direct',
      consent,
      timezone = 'UTC'
    } = await req.json();

    // ✅ Validation
    if (!toPhone || !businessName || !userId) {
      return Response.json(
        { error: 'Missing required: toPhone, businessName, userId' },
        { status: 400 }
      );
    }

    if (!consent) {
      return Response.json(
        { error: 'Call consent required' },
        { status: 403 }
      );
    }

    if (!twilioClient) {
      return Response.json(
        { error: 'Twilio not configured - contact administrator' },
        { status: 500 }
      );
    }

    const formattedPhone = formatPhoneE164(toPhone);
    if (!formattedPhone) {
      return Response.json(
        { error: `Invalid phone format: ${toPhone}. Use E.164 format (+1234567890)` },
        { status: 400 }
      );
    }

    // ✅ Get user's voice script from Firestore
    const userDocRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userDocRef);
    const voiceScript = userSnap.data()?.voiceScript || 
      'Hi, I wanted to reach out about how we can help your business grow.';

    // ✅ Build TwiML response based on call type
    let twiml = new twilio.twiml.VoiceResponse();

    switch (callType) {
      case 'direct':
        // Play message and wait for response
        twiml.gather({
          numDigits: 1,
          action: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/call-webhook`,
          method: 'POST',
          timeout: 10
        }).say(voiceScript);
        twiml.hangup();
        break;

      case 'bridge':
        // Connect to human agent
        const bridgePhone = process.env.TWILIO_BRIDGE_PHONE || '+12025551234';
        twiml.dial(bridgePhone);
        break;

      case 'interactive':
        // Interactive menu
        twiml.gather({
          numDigits: 1,
          action: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/call-webhook`,
          method: 'POST',
          timeout: 10
        }).say('Press 1 to schedule a call, press 2 to send an email, or press 3 to do nothing.');
        break;

      default:
        return Response.json(
          { error: 'Invalid callType. Use: direct, bridge, or interactive' },
          { status: 400 }
        );
    }

    // ✅ Initiate call via Twilio
    const call = await twilioClient.calls.create({
      to: formattedPhone,
      from: twilioPhoneNumber,
      twiml: twiml.toString(),
      statusCallback: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/call-webhook`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST'
    });

    // ✅ Log call in Firebase
    const callDocRef = doc(db, 'calls', call.sid);
    await setDoc(callDocRef, {
      callSid: call.sid,
      toPhone: formattedPhone,
      businessName,
      contactName: contactName || 'Unknown',
      callType,
      status: 'initiated',
      userId,
      createdAt: new Date().toISOString(),
      consent,
      timezone,
      estimatedCost: 0.015 // ~$0.015/min with Twilio
    });

    // ✅ Mirror to Supabase for async workflows
    if (supabaseAdmin) {
      try {
        const { data: lead, error: leadError } = await supabaseAdmin
          .from('leads')
          .select('id')
          .eq('email', businessName.toLowerCase()) // Simple lookup
          .single()
          .catch(() => ({ data: null }));

        if (lead) {
          await supabaseAdmin
            .from('call_logs')
            .insert({
              lead_id: lead.id,
              phone: formattedPhone,
              call_sid: call.sid,
              status: 'initiated',
              call_type: callType,
              called_at: new Date().toISOString()
            });
        }
      } catch (supabaseError) {
        console.warn('[make-call] Supabase sync failed:', supabaseError.message);
      }
    }

    return Response.json({
      success: true,
      callId: call.sid,
      callSid: call.sid,
      status: 'initiated',
      businessName,
      phone: formattedPhone,
      callType,
      message: `Call initiated to ${businessName}`
    });

  } catch (error) {
    console.error('[make-call] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to initiate call' },
      { status: 500 }
    );
  }
}

// ✅ Handle Twilio call status callbacks
export async function PUT(req) {
  try {
    const { CallSid, CallStatus, Duration, RecordingUrl } = await req.json();

    if (!CallSid) {
      return Response.json({ error: 'Missing CallSid' }, { status: 400 });
    }

    // ✅ Update call record
    const callDocRef = doc(db, 'calls', CallSid);
    const updateData = {
      status: CallStatus,
      duration: parseInt(Duration) || 0,
      updatedAt: new Date().toISOString()
    };

    if (RecordingUrl) {
      updateData.recordingUrl = RecordingUrl;
    }

    await setDoc(callDocRef, updateData, { merge: true });

    return Response.json({ 
      success: true, 
      message: 'Call status updated',
      callSid: CallSid,
      newStatus: CallStatus
    });

  } catch (error) {
    console.error('[call-webhook] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}