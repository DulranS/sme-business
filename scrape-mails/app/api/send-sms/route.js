// app/api/send-sms/route.js
import { NextResponse } from 'next/server';

// ✅ Firebase Client SDK (ESM-compatible)
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

// ✅ Twilio (dynamically imported to avoid ESM issues)
async function createTwilioClient(accountSid, authToken) {
  const twilioModule = await import('twilio');
  return twilioModule(accountSid, authToken);
}

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

// ✅ Universal E.164 Validator (supports ALL countries)
function normalizeToE164(phone) {
  if (!phone) return null;

  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // If starts with +, validate length (7–15 digits after +)
  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    if (digits.length >= 7 && digits.length <= 15) {
      return `+${digits}`;
    }
    return null;
  }

  // If no +, assume national format — but Twilio REQUIRES E.164
  // So we CANNOT safely add country code — return as-is and let Twilio validate
  if (cleaned.length >= 7 && cleaned.length <= 15) {
    return `+${cleaned}`; // Assume user omitted +
  }

  return null;
}

export async function POST(request) {
  try {
    const { phone, message, businessName, userId } = await request.json();

    // ✅ Validation
    if (!phone || !message) {
      return NextResponse.json({ 
        error: 'Phone number and message are required' 
      }, { status: 400 });
    }

    // ✅ Normalize to E.164 (works for ALL countries)
    const formattedPhone = normalizeToE164(phone);
    if (!formattedPhone) {
      return NextResponse.json({ 
        error: 'Invalid phone number. Please use E.164 format (+1234567890) or include country code (e.g., 94771234567 for Sri Lanka).' 
      }, { status: 400 });
    }

    // ✅ Get Twilio credentials
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !twilioPhone) {
      return NextResponse.json({ 
        error: 'Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your environment variables.' 
      }, { status: 500 });
    }

    // ✅ Send SMS (Twilio validates final number)
    const client = await createTwilioClient(accountSid, authToken);
    const smsResult = await client.messages.create({
      body: message,
      from: twilioPhone,
      to: formattedPhone // Twilio handles final validation
    });

    // ✅ Log to Firestore
    if (userId) {
      try {
        await addDoc(collection(db, 'sms_logs'), {
          userId,
          phone: formattedPhone,
          businessName: businessName || 'Unknown',
          message,
          status: smsResult.status,
          sid: smsResult.sid,
          timestamp: new Date().toISOString(),
          cost: smsResult.price || null,
          direction: 'outbound'
        });
      } catch (logError) {
        console.warn('Failed to log SMS to Firestore:', logError);
      }
    }

    return NextResponse.json({
      success: true,
      sid: smsResult.sid,
      status: smsResult.status,
      message: 'SMS sent successfully'
    });

  } catch (error) {
    console.error('Twilio SMS Error:', error);
    
    // ✅ Handle Twilio errors
    if (error.code === 21211) {
      return NextResponse.json({ 
        error: 'Invalid phone number format. Please use E.164 format (+1234567890).' 
      }, { status: 400 });
    }
    if (error.code === 21608) {
      return NextResponse.json({ 
        error: 'This phone number has opted out of SMS or is unreachable.' 
      }, { status: 400 });
    }
    if (error.code === 21614) {
      return NextResponse.json({ 
        error: 'Invalid Twilio phone number configured.' 
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: error.message || 'Failed to send SMS. Please try again later.',
      code: error.code
    }, { status: 500 });
  }
}