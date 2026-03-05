// app/api/kpi-dashboard/route.js
import { NextResponse } from 'next/server';
import { getFirestore, collection, query, where, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore';
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

// Weekly KPI Dashboard: reply rate, meeting rate, bounce rate
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const period = searchParams.get('period') || 'week'; // week, month, quarter
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const kpis = await calculateKPIs(userId, period);
    const trends = await calculateTrends(userId, period);
    const alerts = await generateAlerts(userId, kpis);
    
    return NextResponse.json({
      success: true,
      period: period,
      kpis: kpis,
      trends: trends,
      alerts: alerts,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('KPI dashboard error:', error);
    return NextResponse.json({ error: 'Failed to generate KPI dashboard' }, { status: 500 });
  }
}

async function calculateKPIs(userId, period) {
  const dateRange = getDateRange(period);
  
  // Get all sequences in the period
  const sequencesQuery = query(
    collection(db, 'sequences'),
    where('userId', '==', userId),
    where('startedAt', '>=', dateRange.start),
    where('startedAt', '<=', dateRange.end)
  );
  
  const sequencesSnapshot = await getDocs(sequencesQuery);
  const sequences = sequencesSnapshot.docs.map(doc => doc.data());
  
  // Get email performance data
  const emailsQuery = query(
    collection(db, 'sent_emails'),
    where('userId', '==', userId),
    where('sentAt', '>=', dateRange.start),
    where('sentAt', '<=', dateRange.end)
  );
  
  const emailsSnapshot = await getDocs(emailsQuery);
  const emails = emailsSnapshot.docs.map(doc => doc.data());
  
  // Calculate core KPIs
  const totalEmailsSent = emails.length;
  const replies = emails.filter(e => e.replied).length;
  const meetingsBooked = sequences.filter(s => s.meetingsBooked > 0).length;
  const bounces = emails.filter(e => e.bounce === true).length;
  const unsubscribes = emails.filter(e => e.unsubscribed === true).length;
  
  // Calculate rates
  const replyRate = totalEmailsSent > 0 ? (replies / totalEmailsSent) * 100 : 0;
  const meetingRate = sequences.length > 0 ? (meetingsBooked / sequences.length) * 100 : 0;
  const bounceRate = totalEmailsSent > 0 ? (bounces / totalEmailsSent) * 100 : 0;
  const unsubscribeRate = totalEmailsSent > 0 ? (unsubscribes / totalEmailsSent) * 100 : 0;
  
  // Calculate engagement metrics
  const opens = emails.filter(e => e.opened === true).length;
  const clicks = emails.filter(e => e.clicked === true).length;
  const openRate = totalEmailsSent > 0 ? (opens / totalEmailsSent) * 100 : 0;
  const clickRate = totalEmailsSent > 0 ? (clicks / totalEmailsSent) * 100 : 0;
  
  // Calculate sequence performance
  const sequenceSteps = sequences.reduce((acc, seq) => {
    const completed = seq.completedSteps ? seq.completedSteps.length : 0;
    acc[completed] = (acc[completed] || 0) + 1;
    return acc;
  }, {});
  
  return {
    overview: {
      totalEmailsSent,
      totalSequences: sequences.length,
      totalReplies: replies,
      totalMeetings: meetingsBooked,
      period: period
    },
    rates: {
      replyRate: Math.round(replyRate * 10) / 10,
      meetingRate: Math.round(meetingRate * 10) / 10,
      bounceRate: Math.round(bounceRate * 10) / 10,
      unsubscribeRate: Math.round(unsubscribeRate * 10) / 10,
      openRate: Math.round(openRate * 10) / 10,
      clickRate: Math.round(clickRate * 10) / 10
    },
    engagement: {
      totalOpens: opens,
      totalClicks: clicks,
      avgInterestScore: calculateAvgInterestScore(emails)
    },
    sequencePerformance: {
      stepDistribution: sequenceSteps,
      avgStepsPerSequence: sequences.length > 0 ? 
        sequences.reduce((sum, seq) => sum + (seq.completedSteps ? seq.completedSteps.length : 0), 0) / sequences.length : 0
    },
    deliverability: {
      delivered: totalEmailsSent - bounces,
      pending: 0, // Would calculate from scheduled emails
      failed: bounces
    }
  };
}

async function calculateTrends(userId, period) {
  const periods = getPeriodComparison(period);
  const trends = {};
  
  for (const p of periods) {
    const dateRange = getDateRange(p);
    const kpis = await calculateKPIs(userId, p);
    trends[p] = kpis.rates;
  }
  
  // Calculate trend percentages
  const current = trends[period];
  const previous = trends[periods[1]] || trends[period];
  
  const trendPercentages = {};
  Object.keys(current).forEach(key => {
    const curr = current[key];
    const prev = previous[key] || 0;
    const change = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
    trendPercentages[key] = {
      current: curr,
      previous: prev,
      change: Math.round(change * 10) / 10,
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
    };
  });
  
  return trendPercentages;
}

async function generateAlerts(userId, kpis) {
  const alerts = [];
  const rates = kpis.rates;
  
  // Critical alerts
  if (rates.bounceRate > 5) {
    alerts.push({
      level: 'critical',
      type: 'bounce_rate',
      message: `Bounce rate (${rates.bounceRate}%) exceeds 5% threshold`,
      recommendation: 'Immediately pause sending and review email list quality',
      action: 'pause_campaign'
    });
  }
  
  if (rates.unsubscribeRate > 1) {
    alerts.push({
      level: 'critical',
      type: 'unsubscribe_rate',
      message: `Unsubscribe rate (${rates.unsubscribeRate}%) exceeds 1% threshold`,
      recommendation: 'Review messaging relevance and target audience',
      action: 'review_templates'
    });
  }
  
  // Warning alerts
  if (rates.replyRate < 5) {
    alerts.push({
      level: 'warning',
      type: 'low_reply_rate',
      message: `Reply rate (${rates.replyRate}%) is below 5%`,
      recommendation: 'Consider A/B testing subject lines and personalization',
      action: 'optimize_templates'
    });
  }
  
  if (rates.meetingRate < 2) {
    alerts.push({
      level: 'warning',
      type: 'low_meeting_rate',
      message: `Meeting rate (${rates.meetingRate}%) is below 2%`,
      recommendation: 'Review ICP targeting and value proposition',
      action: 'refine_icp'
    });
  }
  
  // Info alerts
  if (rates.openRate < 30) {
    alerts.push({
      level: 'info',
      type: 'low_open_rate',
      message: `Open rate (${rates.openRate}%) could be improved`,
      recommendation: 'Test different subject lines and send times',
      action: 'test_subjects'
    });
  }
  
  return alerts;
}

function getDateRange(period) {
  const now = new Date();
  const start = new Date();
  
  switch (period) {
    case 'week':
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      start.setMonth(now.getMonth() - 3);
      break;
    default:
      start.setDate(now.getDate() - 7);
  }
  
  return {
    start: start.toISOString(),
    end: now.toISOString()
  };
}

function getPeriodComparison(period) {
  switch (period) {
    case 'week':
      return ['week', 'last_week'];
    case 'month':
      return ['month', 'last_month'];
    case 'quarter':
      return ['quarter', 'last_quarter'];
    default:
      return ['week', 'last_week'];
  }
}

function calculateAvgInterestScore(emails) {
  if (emails.length === 0) return 0;
  
  const totalScore = emails.reduce((sum, email) => {
    return sum + (email.interestScore || 0);
  }, 0);
  
  return Math.round((totalScore / emails.length) * 10) / 10;
}

// Auto-exit rules implementation
export async function POST(request) {
  try {
    const { userId, action } = await request.json();
    
    if (!userId || !action) {
      return NextResponse.json({ error: 'User ID and action required' }, { status: 400 });
    }

    switch (action) {
      case 'apply_auto_exit_rules':
        return await applyAutoExitRules(userId);
      case 'pause_campaign':
        return await pauseCampaign(userId);
      case 'get_recommendations':
        return await getRecommendations(userId);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('KPI action error:', error);
    return NextResponse.json({ error: 'Failed to process action' }, { status: 500 });
  }
}

async function applyAutoExitRules(userId) {
  const kpis = await calculateKPIs(userId, 'week');
  const actions = [];
  
  // Apply bounce rate rule
  if (kpis.rates.bounceRate > 5) {
    await pauseCampaign(userId);
    actions.push({
      rule: 'bounce_rate_threshold',
      action: 'campaign_paused',
      reason: `Bounce rate ${kpis.rates.bounceRate}% > 5%`,
      timestamp: new Date().toISOString()
    });
  }
  
  // Apply unsubscribe rate rule
  if (kpis.rates.unsubscribeRate > 1) {
    await pauseCampaign(userId);
    actions.push({
      rule: 'unsubscribe_rate_threshold',
      action: 'campaign_paused',
      reason: `Unsubscribe rate ${kpis.rates.unsubscribeRate}% > 1%`,
      timestamp: new Date().toISOString()
    });
  }
  
  // Auto-exit replied sequences
  const repliedSequences = await getRepliedSequences(userId);
  for (const sequence of repliedSequences) {
    await exitSequence(userId, sequence.companyId, 'replied');
    actions.push({
      rule: 'auto_exit_reply',
      action: 'sequence_exited',
      companyId: sequence.companyId,
      reason: 'Lead replied',
      timestamp: new Date().toISOString()
    });
  }
  
  // Auto-exit booked meetings
  const bookedSequences = await getBookedSequences(userId);
  for (const sequence of bookedSequences) {
    await exitSequence(userId, sequence.companyId, 'meeting_booked');
    actions.push({
      rule: 'auto_exit_meeting',
      action: 'sequence_exited',
      companyId: sequence.companyId,
      reason: 'Meeting booked',
      timestamp: new Date().toISOString()
    });
  }
  
  return NextResponse.json({
    success: true,
    actions: actions,
    message: `Applied ${actions.length} auto-exit rules`
  });
}

async function pauseCampaign(userId) {
  // Update ICP config to pause
  const icpRef = doc(db, 'icp_configs', userId);
  await updateDoc(icpRef, {
    status: 'paused',
    pausedAt: new Date().toISOString(),
    pauseReason: 'Auto-pause due to KPI thresholds'
  });
  
  // Pause all active sequences
  const sequencesQuery = query(
    collection(db, 'sequences'),
    where('userId', '==', userId),
    where('status', '==', 'active')
  );
  
  const sequencesSnapshot = await getDocs(sequencesQuery);
  const batch = [];
  
  sequencesSnapshot.forEach((doc) => {
    batch.push(updateDoc(doc.ref, {
      status: 'paused',
      pausedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      pauseReason: 'Campaign auto-paused'
    }));
  });
  
  await Promise.all(batch);
}

async function getRecommendations(userId) {
  const kpis = await calculateKPIs(userId, 'week');
  const recommendations = [];
  
  if (kpis.rates.replyRate < 5) {
    recommendations.push({
      priority: 'high',
      area: 'reply_rate',
      title: 'Improve Reply Rate',
      description: 'Current reply rate is below optimal range',
      actions: [
        'Test more personalized subject lines',
        'Review ICP targeting criteria',
        'Improve email personalization quality',
        'Test different send times'
      ]
    });
  }
  
  if (kpis.rates.openRate < 30) {
    recommendations.push({
      priority: 'medium',
      area: 'open_rate',
      title: 'Increase Open Rate',
      description: 'Subject lines may need improvement',
      actions: [
        'A/B test subject line variations',
        'Test personalization in subject lines',
        'Optimize send timing',
        'Clean up email list for better deliverability'
      ]
    });
  }
  
  if (kpis.rates.bounceRate > 2) {
    recommendations.push({
      priority: 'critical',
      area: 'deliverability',
      title: 'Fix Deliverability Issues',
      description: 'High bounce rate detected',
      actions: [
        'Verify email list quality',
        'Remove invalid emails',
        'Check domain reputation',
        'Review sending practices'
      ]
    });
  }
  
  return NextResponse.json({
    success: true,
    recommendations: recommendations
  });
}

async function getRepliedSequences(userId) {
  const q = query(
    collection(db, 'sequences'),
    where('userId', '==', userId),
    where('status', '==', 'active'),
    where('repliesReceived', '>', 0)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

async function getBookedSequences(userId) {
  const q = query(
    collection(db, 'sequences'),
    where('userId', '==', userId),
    where('status', '==', 'active'),
    where('meetingsBooked', '>', 0)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

async function exitSequence(userId, companyId, reason) {
  const sequenceRef = doc(db, 'sequences', `${userId}_${companyId}`);
  await updateDoc(sequenceRef, {
    status: 'exited',
    exitReason: reason,
    exitedAt: new Date().toISOString()
  });
}
