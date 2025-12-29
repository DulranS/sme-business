import { getFirestore, doc, updateDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';

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

export default async function handler(req, res) {
  const {
    CallSid,
    CallStatus,
    CallDuration,
    To,
    From,
    AnsweredBy,
    RecordingUrl,
    RecordingDuration
  } = req.body;

  console.log(`📊 Call Status Update:`, {
    sid: CallSid,
    status: CallStatus,
    duration: CallDuration,
    answeredBy: AnsweredBy,
    to: To
  });

  try {
    // Find the call record by CallSid
    const callsRef = collection(db, 'calls');
    const q = query(callsRef, where('callSid', '==', CallSid));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      // Update existing record
      const callDoc = snapshot.docs[0];
      await updateDoc(doc(db, 'calls', callDoc.id), {
        status: CallStatus,
        duration: parseInt(CallDuration) || 0,
        answeredBy: AnsweredBy || 'unknown',
        recordingUrl: RecordingUrl || null,
        recordingDuration: parseInt(RecordingDuration) || 0,
        updatedAt: new Date().toISOString(),
        completedAt: ['completed', 'failed', 'busy', 'no-answer'].includes(CallStatus) 
          ? new Date().toISOString() 
          : null
      });

      console.log(`✅ Updated call ${callDoc.id} - Status: ${CallStatus}`);
    } else {
      // Create new record if not found
      await setDoc(doc(db, 'calls', CallSid), {
        callSid: CallSid,
        status: CallStatus,
        duration: parseInt(CallDuration) || 0,
        to: To,
        from: From,
        answeredBy: AnsweredBy || 'unknown',
        recordingUrl: RecordingUrl || null,
        recordingDuration: parseInt(RecordingDuration) || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      console.log(`📝 Created new call record for ${CallSid}`);
    }

    // Log status-specific messages
    if (CallStatus === 'completed') {
      console.log(`✅ Call completed - Duration: ${CallDuration}s - Answered by: ${AnsweredBy}`);
    } else if (CallStatus === 'failed') {
      console.log(`❌ Call failed to ${To}`);
    } else if (CallStatus === 'busy') {
      console.log(`📵 Call busy - ${To}`);
    } else if (CallStatus === 'no-answer') {
      console.log(`📞 No answer from ${To}`);
    }

  } catch (error) {
    console.error('❌ Failed to save call status:', error);
  }

  res.status(200).send('OK');
}