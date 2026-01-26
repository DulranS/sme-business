// app/api/list-sent-leads/route.js
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';

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

// ✅ SECURITY: Input validation helper
function validateUserId(userId) {
  if (!userId || typeof userId !== 'string') return false;
  // Firebase UIDs are typically 28 characters, alphanumeric
  return /^[a-zA-Z0-9]{20,}$/.test(userId);
}

export async function POST(req) {
  try {
    const { userId } = await req.json();
    
    // ✅ SECURITY: Input validation
    if (!userId) {
      return Response.json({ error: 'User ID required' }, { status: 400 });
    }
    
    // ✅ SECURITY: Validate userId format
    if (!validateUserId(userId)) {
      return Response.json({ error: 'Invalid user ID format' }, { status: 400 });
    }

    const q = query(collection(db, 'sent_emails'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const leads = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    let deletedCount = 0;
    
    // ✅ CLEANUP: Delete old closed loops (>30 days)
    const deletionPromises = [];
    
    snapshot.forEach(docSnapshot => {
      const data = docSnapshot.data();
      const email = data.to;
      const replied = data.replied || false;
      const followUpCount = data.followUpSentCount || 0;
      const loopClosed = data.loopClosed || false;
      
      // ✅ Determine if loop is closed (replied OR 3+ follow-ups)
      const isClosed = replied || followUpCount >= 3 || loopClosed;
      
      if (isClosed) {
        // ✅ Determine the closure date
        let closureDate = null;
        
        if (replied && data.repliedAt) {
          // Use explicit replied date if available
          closureDate = new Date(data.repliedAt);
        } else if (followUpCount >= 3 && data.lastFollowUpSentAt) {
          // Use last follow-up date if 3+ follow-ups sent
          closureDate = new Date(data.lastFollowUpSentAt);
        } else if (data.lastFollowUpSentAt) {
          // Fallback to last follow-up date
          closureDate = new Date(data.lastFollowUpSentAt);
        } else if (data.sentAt) {
          // Final fallback to sent date
          closureDate = new Date(data.sentAt);
        }
        
        // ✅ Delete if closed more than 30 days ago
        if (closureDate && closureDate < thirtyDaysAgo) {
          console.log(`🗑️ Deleting old closed loop: ${email} (closed ${Math.floor((now - closureDate) / (1000 * 60 * 60 * 24))} days ago)`);
          deletionPromises.push(deleteDoc(doc(db, 'sent_emails', docSnapshot.id)));
          deletedCount++;
          return; // Skip adding to leads array
        }
      }
      
      // ✅ Calculate interest score based on engagement
      let interestScore = data.interestScore || 0;
      if (replied) interestScore += 50; // Reply = 50 points
      
      // ✅ Determine if lead seems interested (score >= 30 = opened + clicked, or replied)
      const seemsInterested = interestScore >= 30 || replied;
      
      // ✅ Only include non-deleted leads
      leads.push({
        email: email,
        sentAt: data.sentAt,
        replied: replied,
        followUpAt: data.followUpAt,
        // ✅ CRITICAL: Include follow-up tracking data
        followUpCount: followUpCount,
        lastFollowUpAt: data.lastFollowUpSentAt || null,
        followUpDates: data.followUpDates || [],
        threadId: data.threadId || null,
        // ✅ Engagement tracking
        opened: data.opened || false,
        openedAt: data.openedAt || null,
        openedCount: data.openedCount || 0,
        clicked: data.clicked || false,
        clickedAt: data.clickedAt || null,
        clickCount: data.clickCount || 0,
        lastEngagementAt: data.lastEngagementAt || null,
        interestScore: interestScore,
        seemsInterested: seemsInterested
      });
    });
    
    // ✅ Execute deletions
    if (deletionPromises.length > 0) {
      await Promise.all(deletionPromises);
      console.log(`✅ Deleted ${deletedCount} old closed loops (>30 days)`);
    }

    leads.sort((a, b) => {
      if (a.replied && !b.replied) return -1;
      if (!a.replied && b.replied) return 1;
      const aReady = new Date(a.followUpAt) <= new Date();
      const bReady = new Date(b.followUpAt) <= new Date();
      if (aReady && !bReady) return -1;
      if (!aReady && bReady) return 1;
      return new Date(b.sentAt) - new Date(a.sentAt);
    });

    return Response.json({ 
      leads,
      deletedCount: deletedCount > 0 ? deletedCount : undefined // Only include if deletions occurred
    });
  } catch (error) {
    console.error('List sent leads error:', error);
    return Response.json({ error: 'Failed to load sent leads' }, { status: 500 });
  }
}