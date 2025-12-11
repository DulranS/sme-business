// pages/api/send-sms.js
// This API route handles SMS sending via Twilio

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      phone, 
      message, 
      businessName,
      userId 
    } = req.body;

    // Validation
    if (!phone || !message) {
      return res.status(400).json({ 
        error: 'Phone number and message are required' 
      });
    }

    // Validate phone format (should be E.164: +94771234567)
    const phoneRegex = /^\+?[1-9]\d{10,14}$/;
    const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
    
    if (!phoneRegex.test(formattedPhone)) {
      return res.status(400).json({ 
        error: 'Invalid phone number format. Must be E.164 format (+94771234567)' 
      });
    }

    // Get Twilio credentials from environment variables
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !twilioPhone) {
      return res.status(500).json({ 
        error: 'Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your environment variables.' 
      });
    }

    // Create Twilio client
    const twilio = require('twilio');
    const client = twilio(accountSid, authToken);

    // Send SMS
    const smsResult = await client.messages.create({
      body: message,
      from: twilioPhone,
      to: formattedPhone
    });

    // Log to Firebase (optional - for tracking)
    if (userId) {
      try {
        const admin = require('firebase-admin');
        
        // Initialize Firebase Admin if not already initialized
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
            })
          });
        }

        const db = admin.firestore();
        
        // Log SMS send to Firestore
        await db.collection('sms_logs').add({
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
        // Continue anyway - don't fail the SMS send
      }
    }

    // Return success
    return res.status(200).json({
      success: true,
      sid: smsResult.sid,
      status: smsResult.status,
      message: 'SMS sent successfully'
    });

  } catch (error) {
    console.error('Twilio SMS Error:', error);
    
    // Handle specific Twilio errors
    if (error.code === 21211) {
      return res.status(400).json({ 
        error: 'Invalid phone number. Please check the format.' 
      });
    }
    
    if (error.code === 21608) {
      return res.status(400).json({ 
        error: 'This phone number is not reachable or has opted out.' 
      });
    }
    
    if (error.code === 21614) {
      return res.status(400).json({ 
        error: 'Invalid Twilio phone number configured.' 
      });
    }

    return res.status(500).json({ 
      error: error.message || 'Failed to send SMS',
      code: error.code
    });
  }
}