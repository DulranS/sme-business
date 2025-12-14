import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
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

// ✅ Helper: Format Sri Lankan numbers to E.164
function formatSriLankanNumber(phone) {
  if (!phone) return null;
  let cleaned = phone.toString().replace(/\D/g, '');
  
  // If starts with 0 and is Sri Lankan length
  if (cleaned.startsWith('0') && cleaned.length >= 9 && cleaned.length <= 10) {
    cleaned = '94' + cleaned.slice(1);
  }
  
  // Ensure it starts with 94 and is 11-12 digits
  if (cleaned.startsWith('94') && cleaned.length >= 11 && cleaned.length <= 12) {
    return `+${cleaned}`;
  }
  
  // If already E.164, keep it
  if (cleaned.startsWith('94') && cleaned.length >= 11 && cleaned.length <= 12) {
    return `+${cleaned}`;
  }
  
  return null;
}

export async function POST(request) {
  try {
    const { phone, message, businessName, userId } = await request.json();

    // ✅ Validation
    if (!phone || !message) {
      return NextResponse.json({ error: 'Phone number and message are required' }, { status: 400 });
    }

    // ✅ Format phone number (handles 077... and +9477...)
    const formattedPhone = formatSriLankanNumber(phone);
    if (!formattedPhone) {
      return NextResponse.json({ 
        error: 'Invalid phone number. Must be Sri Lankan mobile (e.g., 0771234567)' 
      }, { status: 400 });
    }

    // ✅ Get Twilio credentials
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !twilioPhone) {
      return NextResponse.json({ 
        error: 'Twilio credentials not configured' 
      }, { status: 500 });
    }

    // ✅ Send SMS
    const twilio = require('twilio');
    const client = twilio(accountSid, authToken);
    const smsResult = await client.messages.create({
      body: message,
      from: twilioPhone,
      to: formattedPhone
    });

    // ✅ Log to Firestore (using client SDK - safe for App Router)
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
        // Don't fail the SMS send
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
    
    // ✅ Handle Twilio-specific errors
    if (error.code === 21211) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
    }
    if (error.code === 21608) {
      return NextResponse.json({ error: 'Phone number has opted out or is unreachable' }, { status: 400 });
    }
    if (error.code === 21614) {
      return NextResponse.json({ error: 'Invalid Twilio phone number' }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: error.message || 'Failed to send SMS',
      code: error.code
    }, { status: 500 });
  }
}