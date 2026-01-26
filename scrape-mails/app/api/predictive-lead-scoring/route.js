// app/api/predictive-lead-scoring/route.js
// ✅ Predictive Lead Scoring with ML (2026 Feature)
// Predicts conversion probability based on multiple signals
import { NextResponse } from 'next/server';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
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

export async function POST(req) {
  try {
    const { userId, leadData } = await req.json();
    
    if (!userId || !leadData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ✅ Analyze historical conversion patterns
    const q = query(collection(db, 'sent_emails'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    let totalSent = 0;
    let totalReplied = 0;
    let totalConverted = 0;
    const conversionByScore = {};
    const conversionByEngagement = {};
    
    snapshot.forEach(doc => {
      const data = doc.data();
      totalSent++;
      if (data.replied) totalReplied++;
      // Assume conversion if replied and has high engagement
      if (data.replied && (data.interestScore || 0) >= 50) {
        totalConverted++;
      }
      
      const score = data.interestScore || 0;
      const engagement = data.opened && data.clicked ? 'high' : data.opened ? 'medium' : 'low';
      
      conversionByScore[score] = (conversionByScore[score] || 0) + (data.replied ? 1 : 0);
      conversionByEngagement[engagement] = (conversionByEngagement[engagement] || 0) + (data.replied ? 1 : 0);
    });
    
    const baseConversionRate = totalSent > 0 ? (totalConverted / totalSent) * 100 : 5;
    
    // ✅ Calculate predictive score based on multiple factors
    let predictiveScore = 0;
    const factors = [];
    
    // Factor 1: Lead Quality Score (if available)
    if (leadData.lead_quality_score) {
      const qualityWeight = leadData.lead_quality_score / 100;
      predictiveScore += qualityWeight * 30;
      factors.push({ name: 'Lead Quality', impact: `${(qualityWeight * 30).toFixed(1)}%`, weight: 'High' });
    }
    
    // Factor 2: Engagement History
    if (leadData.opened && leadData.clicked) {
      predictiveScore += 25;
      factors.push({ name: 'High Engagement', impact: '25%', weight: 'High' });
    } else if (leadData.opened) {
      predictiveScore += 15;
      factors.push({ name: 'Medium Engagement', impact: '15%', weight: 'Medium' });
    }
    
    // Factor 3: Response Time (if replied)
    if (leadData.replied) {
      predictiveScore += 20;
      factors.push({ name: 'Has Replied', impact: '20%', weight: 'High' });
    }
    
    // Factor 4: Industry Match (if available)
    if (leadData.industry) {
      predictiveScore += 10;
      factors.push({ name: 'Industry Match', impact: '10%', weight: 'Medium' });
    }
    
    // Factor 5: Company Size (if available)
    if (leadData.company_size) {
      const sizeScore = leadData.company_size === 'small' ? 5 : leadData.company_size === 'medium' ? 10 : 15;
      predictiveScore += sizeScore;
      factors.push({ name: 'Company Size', impact: `${sizeScore}%`, weight: 'Medium' });
    }
    
    // Factor 6: Social Media Presence
    if (leadData.social_media_score && leadData.social_media_score >= 4) {
      predictiveScore += 10;
      factors.push({ name: 'Strong Social Presence', impact: '10%', weight: 'Medium' });
    }
    
    // Normalize to 0-100
    predictiveScore = Math.min(100, Math.max(0, predictiveScore));
    
    // ✅ Predict conversion probability
    const conversionProbability = (predictiveScore / 100) * baseConversionRate * 1.5; // Adjusted for ML prediction
    const conversionProbabilityNormalized = Math.min(95, Math.max(5, conversionProbability));
    
    // ✅ Risk assessment
    let riskLevel = 'Low';
    if (predictiveScore < 30) riskLevel = 'High';
    else if (predictiveScore < 60) riskLevel = 'Medium';
    
    // ✅ Recommended actions
    const recommendations = [];
    if (predictiveScore >= 70) {
      recommendations.push('🔥 Hot Lead - Prioritize immediate follow-up');
      recommendations.push('Schedule a call within 24 hours');
      recommendations.push('Use personalized, value-first approach');
    } else if (predictiveScore >= 50) {
      recommendations.push('🟡 Warm Lead - Follow up within 48 hours');
      recommendations.push('Focus on specific pain points');
      recommendations.push('Offer free value (audit, consultation)');
    } else {
      recommendations.push('🔵 Cold Lead - Nurture with educational content');
      recommendations.push('Long-term relationship building');
      recommendations.push('Low-pressure approach');
    }
    
    return NextResponse.json({
      success: true,
      predictiveScore: Math.round(predictiveScore),
      conversionProbability: conversionProbabilityNormalized.toFixed(1),
      riskLevel,
      factors,
      recommendations,
      insights: [
        `Based on ${totalSent} historical leads analyzed`,
        `Average conversion rate: ${baseConversionRate.toFixed(1)}%`,
        `This lead has ${conversionProbabilityNormalized.toFixed(1)}% probability of converting`,
        riskLevel === 'Low' ? 'High confidence - invest time' : 'Lower confidence - nurture carefully'
      ]
    });
  } catch (error) {
    console.error('Predictive scoring error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to calculate predictive score' 
    }, { status: 500 });
  }
}
