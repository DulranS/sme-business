// app/api/nurture-management/route.js
import { NextResponse } from 'next/server';
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
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

// Nurture Sequence: Move non-responders to 30-60 day nurture
export async function POST(request) {
  try {
    const { userId, action, data } = await request.json();
    
    if (!userId || !action) {
      return NextResponse.json({ error: 'User ID and action required' }, { status: 400 });
    }

    switch (action) {
      case 'move_to_nurture':
        return await moveToNurture(userId, data);
      case 'create_nurture_campaign':
        return await createNurtureCampaign(userId, data);
      case 'send_nurture_email':
        return await sendNurtureEmail(userId, data);
      case 'iterate_templates':
        return await iterateTemplates(userId, data);
      case 'get_nurture_queue':
        return await getNurtureQueue(userId);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Nurture management error:', error);
    return NextResponse.json({ error: 'Nurture management failed' }, { status: 500 });
  }
}

async function moveToNurture(userId, data) {
  const { sequenceIds, nurtureDelay = 45 } = data; // Default 45 days
  
  const results = [];
  
  for (const sequenceId of sequenceIds) {
    try {
      const sequenceRef = doc(db, 'sequences', sequenceId);
      const sequenceSnap = await getDoc(sequenceRef);
      
      if (!sequenceSnap.exists()) {
        results.push({ sequenceId, success: false, error: 'Sequence not found' });
        continue;
      }

      const sequence = sequenceSnap.data();
      
      // Only move completed sequences (no reply, no meeting)
      if (sequence.status !== 'exited' || 
          (sequence.exitReason !== 'completed' && sequence.exitReason !== 'no_response')) {
        results.push({ sequenceId, success: false, error: 'Sequence not eligible for nurture' });
        continue;
      }

      // Create nurture record
      const nurtureId = `${userId}_nurture_${sequence.companyId.replace(/\s+/g, '_')}`;
      const nurtureData = {
        userId,
        companyId: sequence.companyId,
        originalSequenceId: sequenceId,
        decisionMaker: sequence.decisionMaker,
        status: 'nurture_pending',
        movedToNurtureAt: new Date().toISOString(),
        nurtureStartDate: new Date(Date.now() + nurtureDelay * 24 * 60 * 60 * 1000).toISOString(),
        nurtureCampaignId: null,
        nurtureEmailsSent: 0,
        nurtureReplies: 0,
        lastNurtureActivity: null,
        originalSequenceSteps: sequence.completedSteps?.length || 0,
        originalOutcome: sequence.exitReason
      };

      await setDoc(doc(db, 'nurture_sequences', nurtureId), nurtureData);
      
      // Update original sequence
      await updateDoc(sequenceRef, {
        status: 'nurtured',
        nurtureId: nurtureId,
        nurturedAt: new Date().toISOString()
      });

      results.push({ 
        sequenceId, 
        success: true, 
        nurtureId,
        nurtureStartDate: nurtureData.nurtureStartDate 
      });
      
    } catch (error) {
      results.push({ sequenceId, success: false, error: error.message });
    }
  }

  return NextResponse.json({
    success: true,
    message: `Moved ${results.filter(r => r.success).length} sequences to nurture`,
    results: results
  });
}

async function createNurtureCampaign(userId, data) {
  const { campaignName, templateVariations, scheduleSettings } = data;
  
  const campaignData = {
    userId,
    name: campaignName,
    status: 'active',
    createdAt: new Date().toISOString(),
    templateVariations: templateVariations, // A/B test variations
    scheduleSettings: {
      frequency: scheduleSettings.frequency || 'biweekly', // biweekly, monthly
      preferredDays: scheduleSettings.preferredDays || ['Tuesday', 'Thursday'],
      preferredTime: scheduleSettings.preferredTime || '10:00',
      timezone: scheduleSettings.timezone || 'EST'
    },
    performance: {
      sent: 0,
      replies: 0,
      meetings: 0,
      bestTemplate: null,
      iterationCount: 0
    }
  };

  const campaignRef = doc(db, 'nurture_campaigns', `${userId}_${campaignName.replace(/\s+/g, '_')}`);
  await setDoc(campaignRef, campaignData);

  return NextResponse.json({
    success: true,
    message: `Nurture campaign ${campaignName} created`,
    campaignId: campaignRef.id,
    campaign: campaignData
  });
}

async function sendNurtureEmail(userId, data) {
  const { nurtureId, campaignId, templateId, personalizedContent } = data;
  
  // Get nurture sequence
  const nurtureRef = doc(db, 'nurture_sequences', nurtureId);
  const nurtureSnap = await getDoc(nurtureRef);
  
  if (!nurtureSnap.exists()) {
    return NextResponse.json({ error: 'Nurture sequence not found' }, { status: 404 });
  }

  const nurture = nurtureSnap.data();
  
  // Check if it's time to send
  const now = new Date();
  const nurtureDate = new Date(nurture.nurtureStartDate);
  
  if (now < nurtureDate) {
    return NextResponse.json({ error: 'Not yet time to send nurture email' }, { status: 400 });
  }

  // Send email (integrate with existing email system)
  const emailResult = await sendEmail({
    userId,
    to: nurture.decisionMaker.email,
    subject: personalizedContent.subject,
    body: personalizedContent.body,
    campaignId: campaignId,
    nurtureId: nurtureId,
    templateId: templateId
  });

  if (emailResult.success) {
    // Update nurture sequence
    await updateDoc(nurtureRef, {
      status: 'nurture_active',
      nurtureEmailsSent: (nurture.nurtureEmailsSent || 0) + 1,
      lastNurtureActivity: new Date().toISOString(),
      lastEmailSentAt: new Date().toISOString()
    });

    // Update campaign performance
    const campaignRef = doc(db, 'nurture_campaigns', campaignId);
    await updateDoc(campaignRef, {
      'performance.sent': increment(1)
    });
  }

  return NextResponse.json({
    success: emailResult.success,
    emailResult: emailResult,
    nurtureUpdated: emailResult.success
  });
}

async function iterateTemplates(userId, data) {
  const { campaignId, performanceData, iterationCount = 100 } = data;
  
  // Get campaign data
  const campaignRef = doc(db, 'nurture_campaigns', campaignId);
  const campaignSnap = await getDoc(campaignRef);
  
  if (!campaignSnap.exists()) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const campaign = campaignSnap.data();
  
  // Analyze performance after first 100 sends
  const totalSent = campaign.performance.sent;
  
  if (totalSent < iterationCount) {
    return NextResponse.json({
      success: false,
      message: `Need ${iterationCount - totalSent} more sends before iteration`,
      currentSends: totalSent,
      targetSends: iterationCount
    });
  }

  // Analyze template performance
  const templatePerformance = analyzeTemplatePerformance(performanceData);
  const bestTemplate = templatePerformance.reduce((best, current) => 
    current.replyRate > best.replyRate ? current : best
  );

  // Generate template variations based on winner
  const newVariations = generateTemplateVariations(bestTemplate, campaign.templateVariations);

  // Update campaign with new variations
  await updateDoc(campaignRef, {
    templateVariations: newVariations,
    'performance.bestTemplate': bestTemplate.templateId,
    'performance.iterationCount': campaign.performance.iterationCount + 1,
    lastIterationAt: new Date().toISOString()
  });

  return NextResponse.json({
    success: true,
    message: 'Templates iterated based on performance data',
    analysis: {
      totalSent,
      bestTemplate,
      templatePerformance,
      newVariations: newVariations.length
    }
  });
}

async function getNurtureQueue(userId) {
  const now = new Date().toISOString();
  
  // Get nurture sequences ready for sending
  const q = query(
    collection(db, 'nurture_sequences'),
    where('userId', '==', userId),
    where('status', 'in', ['nurture_pending', 'nurture_active']),
    where('nurtureStartDate', '<=', now)
  );
  
  const querySnapshot = await getDocs(q);
  const queue = [];
  
  querySnapshot.forEach((doc) => {
    const nurture = doc.data();
    queue.push({
      nurtureId: doc.id,
      companyId: nurture.companyId,
      decisionMaker: nurture.decisionMaker,
      status: nurture.status,
      nurtureEmailsSent: nurture.nurtureEmailsSent || 0,
      lastNurtureActivity: nurture.lastNurtureActivity,
      movedToNurtureAt: nurture.movedToNurtureAt
    });
  });

  return NextResponse.json({
    success: true,
    queue: queue,
    queueSize: queue.length,
    date: now
  });
}

function analyzeTemplatePerformance(performanceData) {
  // Analyze A/B test results
  const templateStats = {};
  
  performanceData.forEach(send => {
    const templateId = send.templateId;
    
    if (!templateStats[templateId]) {
      templateStats[templateId] = {
        templateId,
        sent: 0,
        replies: 0,
        meetings: 0,
        replyRate: 0,
        meetingRate: 0
      };
    }
    
    templateStats[templateId].sent++;
    if (send.replied) templateStats[templateId].replies++;
    if (send.meetingBooked) templateStats[templateId].meetings++;
  });

  // Calculate rates
  Object.values(templateStats).forEach(stat => {
    stat.replyRate = stat.sent > 0 ? (stat.replies / stat.sent) * 100 : 0;
    stat.meetingRate = stat.sent > 0 ? (stat.meetings / stat.sent) * 100 : 0;
  });

  return Object.values(templateStats);
}

function generateTemplateVariations(bestTemplate, currentVariations) {
  // Create new variations based on winning template
  const baseTemplate = currentVariations.find(v => v.id === bestTemplate.templateId);
  
  if (!baseTemplate) return currentVariations;

  const newVariations = [...currentVariations];
  
  // Generate 2-3 new variations
  const variationStrategies = [
    'subject_line_test',
    'personalization_depth',
    'call_to_action_variant',
    'value_proposition_angle'
  ];

  variationStrategies.slice(0, 2).forEach((strategy, index) => {
    const variation = createTemplateVariation(baseTemplate, strategy, index + 1);
    newVariations.push(variation);
  });

  return newVariations;
}

function createTemplateVariation(baseTemplate, strategy, index) {
  const variation = { ...baseTemplate };
  variation.id = `${baseTemplate.id}_var_${strategy}_${index}`;
  variation.parentTemplate = baseTemplate.id;
  variation.variationStrategy = strategy;
  variation.createdAt = new Date().toISOString();

  switch (strategy) {
    case 'subject_line_test':
      variation.subject = generateAlternativeSubject(baseTemplate.subject);
      break;
    case 'personalization_depth':
      variation.body = adjustPersonalizationDepth(baseTemplate.body);
      break;
    case 'call_to_action_variant':
      variation.body = adjustCallToAction(baseTemplate.body);
      break;
    case 'value_proposition_angle':
      variation.body = adjustValueProposition(baseTemplate.body);
      break;
  }

  return variation;
}

function generateAlternativeSubject(originalSubject) {
  const alternatives = [
    `Quick question about {{company_name}}`,
    `{{personalization_observation}}`,
    `Thoughts on {{pain_point}}`,
    `{{industry}} insight`
  ];
  
  return alternatives[Math.floor(Math.random() * alternatives.length)];
}

function adjustPersonalizationDepth(body) {
  // Add more specific personalization
  return body.replace(
    '{{personalization_observation}}',
    '{{personalization_observation}} {{detailed_insight}}'
  );
}

function adjustCallToAction(body) {
  // Test different CTA approaches
  const ctas = [
    'Worth a quick 10-min chat?',
    'Open to a brief discussion?',
    'Mind if I share more details?',
    'Interested in learning more?'
  ];
  
  const newCTA = ctas[Math.floor(Math.random() * ctas.length)];
  return body.replace(/Worth a quick.*chat\?/g, newCTA);
}

function adjustValueProposition(body) {
  // Test different value proposition angles
  const angles = [
    'increase revenue by 30%',
    'reduce costs significantly',
    'improve team productivity',
    'accelerate growth timeline'
  ];
  
  const angle = angles[Math.floor(Math.random() * angles.length)];
  return body.replace(/help.*with.*pain_point/g, `help ${angle}`);
}

async function sendEmail(emailData) {
  // Integrate with existing email sending system
  // This would call your send-email API
  
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailData)
    });
    
    return await response.json();
  } catch (error) {
    console.error('Nurture email send error:', error);
    return { success: false, error: error.message };
  }
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
      case 'nurture_queue':
        return await getNurtureQueue(userId);
      case 'campaign_performance':
        return await getCampaignPerformance(userId);
      case 'template_analysis':
        return await getTemplateAnalysis(userId);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Nurture management GET error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

async function getCampaignPerformance(userId) {
  const q = query(collection(db, 'nurture_campaigns'), where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  
  const campaigns = [];
  querySnapshot.forEach((doc) => {
    campaigns.push({ id: doc.id, ...doc.data() });
  });

  return NextResponse.json({
    success: true,
    campaigns: campaigns
  });
}

async function getTemplateAnalysis(userId) {
  // Get all nurture emails sent for analysis
  const q = query(
    collection(db, 'nurture_emails'),
    where('userId', '==', userId)
  );
  
  const querySnapshot = await getDocs(q);
  const emails = [];
  
  querySnapshot.forEach((doc) => {
    emails.push({ id: doc.id, ...doc.data() });
  });

  const analysis = analyzeTemplatePerformance(emails);
  
  return NextResponse.json({
    success: true,
    analysis: analysis,
    totalEmails: emails.length
  });
}
