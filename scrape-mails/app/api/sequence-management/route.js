// app/api/sequence-management/route.js
import { NextResponse } from 'next/server';
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, increment } from 'firebase/firestore';
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

// Cadence Management: Day0 Email1 + connection, Day3 Email2, Day5 social, Day7 Break-up
export async function POST(request) {
  try {
    const { userId, action, companyId, data } = await request.json();
    
    if (!userId || !action) {
      return NextResponse.json({ error: 'User ID and action required' }, { status: 400 });
    }

    switch (action) {
      case 'start_sequence':
        return await startSequence(userId, companyId, data);
      case 'advance_sequence':
        return await advanceSequence(userId, companyId, data);
      case 'pause_sequence':
        return await pauseSequence(userId, companyId, data);
      case 'exit_sequence':
        return await exitSequence(userId, companyId, data);
      case 'get_daily_queue':
        return await getDailyQueue(userId);
      case 'check_send_safety':
        return await checkSendSafety(userId);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Sequence management error:', error);
    return NextResponse.json({ error: 'Sequence management failed' }, { status: 500 });
  }
}

async function startSequence(userId, companyId, data) {
  const { decisionMaker, personalizedEmail, bookingLink, timezone } = data;
  
  // Get ICP configuration for send limits
  const icpDoc = await getDoc(doc(db, 'icp_configs', userId));
  if (!icpDoc.exists()) {
    return NextResponse.json({ error: 'ICP configuration not found' }, { status: 400 });
  }
  
  const icp = icpDoc.data();

  // Check send safety
  const safetyCheck = await checkSendSafetyRules(userId, icp);
  if (!safetyCheck.safe) {
    return NextResponse.json({ 
      error: 'Send safety limits reached', 
      safety: safetyCheck 
    }, { status: 429 });
  }

  // Initialize sequence for this company
  const sequenceRef = doc(db, 'sequences', `${userId}_${companyId}`);
  const sequenceData = {
    userId,
    companyId,
    decisionMaker,
    currentStep: 1,
    status: 'active',
    startedAt: new Date().toISOString(),
    nextActionDate: new Date().toISOString(), // Day 0
    completedSteps: [],
    pausedUntil: null,
    exitReason: null,
    emailsSent: 0,
    repliesReceived: 0,
    meetingsBooked: 0,
    bounceCount: 0,
    lastActivity: new Date().toISOString()
  };

  await setDoc(sequenceRef, sequenceData);

  // Schedule first email (Day 0)
  await scheduleEmail(userId, companyId, decisionMaker, personalizedEmail, 1);

  return NextResponse.json({
    success: true,
    message: `Sequence started for ${companyId}`,
    sequence: sequenceData,
    nextAction: 'Email1 scheduled for immediate delivery'
  });
}

async function advanceSequence(userId, companyId, data) {
  const { stepCompleted, outcome } = data;
  
  const sequenceRef = doc(db, 'sequences', `${userId}_${companyId}`);
  const sequenceSnap = await getDoc(sequenceRef);
  
  if (!sequenceSnap.exists()) {
    return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
  }

  const sequence = sequenceSnap.data();
  
  // Update completed steps
  const completedSteps = [...sequence.completedSteps, {
    step: sequence.currentStep,
    completedAt: new Date().toISOString(),
    outcome: outcome
  }];

  // Check for auto-exit conditions
  if (outcome === 'replied' || outcome === 'meeting_booked') {
    await exitSequence(userId, companyId, { reason: outcome });
    return NextResponse.json({
      success: true,
      message: `Sequence exited due to ${outcome}`,
      sequenceStatus: 'exited'
    });
  }

  // Calculate next step
  const nextStep = sequence.currentStep + 1;
  const cadenceDelays = { 1: 0, 2: 3, 3: 5, 4: 7 }; // Days from start
  
  if (nextStep > 4) {
    // Sequence completed
    await exitSequence(userId, companyId, { reason: 'completed' });
    return NextResponse.json({
      success: true,
      message: 'Sequence completed',
      sequenceStatus: 'completed'
    });
  }

  // Update sequence
  const nextActionDate = new Date();
  nextActionDate.setDate(nextActionDate.getDate() + cadenceDelays[nextStep]);

  await updateDoc(sequenceRef, {
    currentStep: nextStep,
    completedSteps: completedSteps,
    nextActionDate: nextActionDate.toISOString(),
    lastActivity: new Date().toISOString()
  });

  return NextResponse.json({
    success: true,
    message: `Advanced to step ${nextStep}`,
    nextActionDate: nextActionDate.toISOString(),
    nextStep: nextStep
  });
}

async function pauseSequence(userId, companyId, data) {
  const { reason, days } = data;
  
  const sequenceRef = doc(db, 'sequences', `${userId}_${companyId}`);
  const pauseUntil = new Date();
  pauseUntil.setDate(pauseUntil.getDate() + (days || 7));

  await updateDoc(sequenceRef, {
    status: 'paused',
    pausedUntil: pauseUntil.toISOString(),
    pauseReason: reason,
    lastActivity: new Date().toISOString()
  });

  return NextResponse.json({
    success: true,
    message: `Sequence paused until ${pauseUntil.toISOString()}`,
    pausedUntil: pauseUntil.toISOString()
  });
}

async function exitSequence(userId, companyId, data) {
  const { reason } = data;
  
  const sequenceRef = doc(db, 'sequences', `${userId}_${companyId}`);
  
  await updateDoc(sequenceRef, {
    status: 'exited',
    exitReason: reason,
    exitedAt: new Date().toISOString(),
    lastActivity: new Date().toISOString()
  });

  // Update company status
  const companyRef = doc(db, 'target_companies', companyId);
  await updateDoc(companyRef, {
    sequenceStatus: 'exited',
    exitReason: reason,
    exitedAt: new Date().toISOString()
  });

  return NextResponse.json({
    success: true,
    message: `Sequence exited: ${reason}`,
    exitReason: reason
  });
}

async function getDailyQueue(userId) {
  const today = new Date().toISOString().split('T')[0];
  
  // Get sequences due for action today
  const q = query(
    collection(db, 'sequences'),
    where('userId', '==', userId),
    where('status', '==', 'active'),
    where('nextActionDate', '<=', new Date().toISOString())
  );
  
  const querySnapshot = await getDocs(q);
  const queue = [];
  
  querySnapshot.forEach((doc) => {
    const sequence = doc.data();
    queue.push({
      sequenceId: doc.id,
      companyId: sequence.companyId,
      currentStep: sequence.currentStep,
      decisionMaker: sequence.decisionMaker,
      nextAction: getNextAction(sequence.currentStep)
    });
  });

  return NextResponse.json({
    success: true,
    queue: queue,
    date: today,
    queueSize: queue.length
  });
}

async function checkSendSafety(userId, icp) {
  const today = new Date().toISOString().split('T')[0];
  
  // Check today's send count
  const todaySends = await getTodaySendCount(userId);
  const maxDaily = icp.maxEmailsPerDay || 50;
  
  // Check bounce rate
  const bounceRate = await getBounceRate(userId);
  const bounceThreshold = icp.bounceThreshold || 5;
  
  // Check unsubscribe rate
  const unsubscribeRate = await getUnsubscribeRate(userId);
  const unsubscribeThreshold = icp.unsubscribeThreshold || 1;

  const safe = todaySends < maxDaily && 
              bounceRate < bounceThreshold && 
              unsubscribeRate < unsubscribeThreshold;

  return {
    safe,
    todaySends,
    maxDaily,
    bounceRate,
    bounceThreshold,
    unsubscribeRate,
    unsubscribeThreshold,
    recommendations: getSafetyRecommendations(todaySends, maxDaily, bounceRate, unsubscribeRate)
  };
}

async function checkSendSafetyRules(userId, icp) {
  return await checkSendSafety(userId, icp);
}

async function getTodaySendCount(userId) {
  const today = new Date().toISOString().split('T')[0];
  
  // This would query email logs for today
  // For now, return mock data
  return 25;
}

async function getBounceRate(userId) {
  // Calculate bounce rate from recent sends
  // For now, return mock data
  return 2.1;
}

async function getUnsubscribeRate(userId) {
  // Calculate unsubscribe rate from recent sends
  // For now, return mock data
  return 0.5;
}

function getSafetyRecommendations(todaySends, maxDaily, bounceRate, unsubscribeRate) {
  const recommendations = [];
  
  if (todaySends >= maxDaily * 0.8) {
    recommendations.push('Approaching daily send limit - consider pausing');
  }
  
  if (bounceRate >= 3) {
    recommendations.push('Bounce rate elevated - review email list quality');
  }
  
  if (unsubscribeRate >= 0.8) {
    recommendations.push('Unsubscribe rate rising - review messaging relevance');
  }
  
  return recommendations;
}

function getNextAction(currentStep) {
  const actions = {
    1: 'Send Email1 + LinkedIn connection',
    2: 'Send Email2',
    3: 'Send LinkedIn social message',
    4: 'Send Break-up email'
  };
  
  return actions[currentStep] || 'Unknown action';
}

async function scheduleEmail(userId, companyId, decisionMaker, email, step) {
  // This would integrate with your existing email sending system
  const emailRef = doc(db, 'scheduled_emails', `${userId}_${companyId}_step${step}`);
  
  await setDoc(emailRef, {
    userId,
    companyId,
    decisionMaker,
    email,
    step,
    scheduledFor: new Date().toISOString(),
    status: 'scheduled',
    sentAt: null
  });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    
    if (!userId || !action) {
      return NextResponse.json({ error: 'User ID and action required' }, { status: 400 });
    }

    switch (action) {
      case 'daily_queue':
        return await getDailyQueue(userId);
      case 'check_safety':
        const icpDoc = await getDoc(doc(db, 'icp_configs', userId));
        const icp = icpDoc.exists() ? icpDoc.data() : {};
        return NextResponse.json(await checkSendSafety(userId, icp));
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Sequence management GET error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
