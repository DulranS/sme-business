// pages/api/make-call.js
// This creates the API endpoint for making Twilio calls

import twilio from 'twilio';

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER; // Your Twilio number
const yourPhone = process.env.YOUR_PHONE_NUMBER; // Your personal number to receive calls

const client = twilio(accountSid, authToken);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { toPhone, businessName, userId } = req.body;

  if (!toPhone || !businessName || !userId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Format phone number for Twilio (must include country code with +)
    let formattedPhone = toPhone.toString().replace(/\D/g, '');
    
    // Add + prefix if not present
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    // Option 1: Connect directly to the lead
    // This will call the lead's number directly
    const call = await client.calls.create({
      from: twilioPhone,
      to: formattedPhone,
      url: `https://yourdomain.com/api/voice-response?business=${encodeURIComponent(businessName)}`,
      statusCallback: `https://yourdomain.com/api/call-status?userId=${userId}&phone=${formattedPhone}`,
      statusCallbackEvent: ['completed', 'failed'],
      record: true, // Optional: record the call
      recordingStatusCallback: `https://yourdomain.com/api/recording-callback`
    });

    // Option 2: Bridge call (connect you to the lead)
    // Uncomment this if you want to receive the call first, then connect to lead
    /*
    const call = await client.calls.create({
      from: twilioPhone,
      to: yourPhone, // Calls you first
      url: `https://yourdomain.com/api/bridge-call?targetPhone=${encodeURIComponent(formattedPhone)}&business=${encodeURIComponent(businessName)}`,
      statusCallback: `https://yourdomain.com/api/call-status?userId=${userId}&phone=${formattedPhone}`,
      statusCallbackEvent: ['completed', 'failed']
    });
    */

    return res.status(200).json({
      success: true,
      callSid: call.sid,
      status: call.status,
      to: formattedPhone,
      businessName
    });
  } catch (error) {
    console.error('Twilio call error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to initiate call',
      details: error.toString()
    });
  }
}