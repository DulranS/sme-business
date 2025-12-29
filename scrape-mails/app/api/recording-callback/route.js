import { getFirestore, doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';

const firebaseConfig = {
  apiKey: "AIzaSyDE-hRmyPs02dBm_OlVfwR9ZzmmMIiKw7o",
  authDomain: "email-marketing-c775d.firebaseapp.com",
  projectId: "email-marketing-c775d",
  storageBucket: "email-marketing-c775d.firebasestorage.app",
  messagingSenderId: "178196903576",
  appId: "1:178196903576:web:56b97d8e0b7943e3ee82ed",
  measurementId: "G-6CL2EGLEVH"
};


const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export default async function handler(req, res) {
  const { 
    RecordingUrl, 
    RecordingSid, 
    CallSid, 
    RecordingDuration,
    RecordingStatus
  } = req.body;

  console.log(`🎙️ Recording Ready:`, {
    recordingSid: RecordingSid,
    callSid: CallSid,
    url: RecordingUrl,
    duration: RecordingDuration,
    status: RecordingStatus
  });

  try {
    // Find call by CallSid and update with recording info
    const callsRef = collection(db, 'calls');
    const q = query(callsRef, where('callSid', '==', CallSid));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const callDoc = snapshot.docs[0];
      await updateDoc(doc(db, 'calls', callDoc.id), {
        recordingUrl: RecordingUrl,
        recordingSid: RecordingSid,
        recordingDuration: parseInt(RecordingDuration) || 0,
        recordingStatus: RecordingStatus,
        recordingReadyAt: new Date().toISOString()
      });

      console.log(`✅ Recording saved for call ${callDoc.id}`);
    }

    // TODO: Send email notification with recording link
    // TODO: Transcribe recording using AI

  } catch (error) {
    console.error('❌ Failed to save recording:', error);
  }

  res.status(200).send('OK');
}