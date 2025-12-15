// app/api/send-followup/route.js
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { google } from 'googleapis';

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

export async function POST(req) {
  try {
    const { email, accessToken, userId, senderName = 'Team' } = await req.json();

    if (!email || !accessToken || !userId) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const subject = `Quick follow-up – still interested?`;
    const body = `Hi there,\n\nI wanted to follow up on my email from 2 days ago. Are you still interested in growing your business with us?\n\nIf now isn’t a good time, just let me know — no pressure!\n\nBest regards,\n${senderName}\nGrowthCo`;

    const message = [
      `To: ${email}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body
    ].join('\r\n');

    const rawMessage = btoa(message)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: rawMessage }
    });

    const newFollowUpAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const docRef = doc(db, 'sent_emails', `${userId}_${email}`);
    await updateDoc(docRef, {
      followUpAt: newFollowUpAt.toISOString()
    });

    const dealRef = doc(db, 'deals', email);
    await updateDoc(dealRef, {
      stage: 'followed_up',
      lastUpdate: new Date().toISOString()
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Follow-up send error:', error);
    return Response.json({ error: error.message || 'Failed to send follow-up' }, { status: 500 });
  }
}