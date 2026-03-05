// app/api/email-verification/route.js
import { NextResponse } from 'next/server';
import { getFirestore, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
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

// Email verification and risk assessment
export async function POST(request) {
  try {
    const { userId, emails, companyName } = await request.json();
    
    if (!userId || !emails || !Array.isArray(emails) || !companyName) {
      return NextResponse.json({ error: 'User ID, emails array, and company name required' }, { status: 400 });
    }

    const verificationResults = [];
    
    for (const emailData of emails) {
      const verification = await verifyEmail(emailData.email);
      verificationResults.push({
        ...emailData,
        ...verification
      });
    }

    // Update company record with verification results
    const companyRef = doc(db, 'target_companies', `${userId}_${companyName.replace(/\s+/g, '_')}`);
    await updateDoc(companyRef, {
      emailVerification: verificationResults,
      verificationCompleted: true,
      verifiedAt: new Date().toISOString(),
      status: 'verification_completed'
    });

    // Calculate overall risk score
    const riskMetrics = calculateRiskMetrics(verificationResults);
    
    return NextResponse.json({
      success: true,
      results: verificationResults,
      riskMetrics: riskMetrics,
      message: `Verified ${emails.length} emails for ${companyName}`
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json({ error: 'Email verification failed' }, { status: 500 });
  }
}

async function verifyEmail(email) {
  const verification = {
    email: email,
    format: 'valid',
    mxRecord: 'valid',
    deliverability: 'unknown',
    riskScore: 'low',
    riskFactors: [],
    recommendation: 'safe_to_send'
  };

  try {
    // Step 1: Format validation
    if (!isValidEmailFormat(email)) {
      verification.format = 'invalid';
      verification.riskScore = 'high';
      verification.riskFactors.push('invalid_format');
      verification.recommendation = 'do_not_send';
      return verification;
    }

    // Step 2: MX record check (simulated)
    const domain = email.split('@')[1];
    const mxValid = await checkMXRecord(domain);
    verification.mxRecord = mxValid ? 'valid' : 'invalid';
    
    if (!mxValid) {
      verification.riskScore = 'high';
      verification.riskFactors.push('invalid_mx');
      verification.recommendation = 'do_not_send';
      return verification;
    }

    // Step 3: Basic deliverability assessment
    verification.deliverability = await assessDeliverability(email);

    // Step 4: Risk assessment
    const riskAssessment = assessEmailRisk(email);
    verification.riskScore = riskAssessment.score;
    verification.riskFactors = riskAssessment.factors;
    verification.recommendation = riskAssessment.recommendation;

    // Step 5: Optional third-party verification
    if (process.env.ZEROBOUNCE_API_KEY) {
      const thirdPartyResult = await thirdPartyVerification(email);
      verification.thirdParty = thirdPartyResult;
      
      // Update recommendation based on third-party result
      if (thirdPartyResult.status === 'invalid') {
        verification.riskScore = 'high';
        verification.recommendation = 'do_not_send';
        verification.riskFactors.push('third_party_invalid');
      }
    }

  } catch (error) {
    verification.error = error.message;
    verification.riskScore = 'medium';
    verification.riskFactors.push('verification_error');
  }

  return verification;
}

function isValidEmailFormat(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length >= 5 && email.length <= 254;
}

async function checkMXRecord(domain) {
  // Simulate MX record check
  // In production, use DNS lookup libraries or third-party services
  try {
    // Mock implementation - always return true for demo
    return true;
  } catch (error) {
    console.error(`MX check failed for ${domain}:`, error);
    return false;
  }
}

async function assessDeliverability(email) {
  const domain = email.split('@')[1];
  
  // Check against common disposable email domains
  const disposableDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com', 'maildrop.cc'];
  if (disposableDomains.some(d => domain.includes(d))) {
    return 'poor';
  }

  // Check for role-based emails
  const localPart = email.split('@')[0];
  const roleEmails = ['info', 'support', 'sales', 'contact', 'hello', 'noreply'];
  if (roleEmails.some(role => localPart.toLowerCase() === role)) {
    return 'fair';
  }

  return 'good';
}

function assessEmailRisk(email) {
  const riskFactors = [];
  let score = 'low';
  let recommendation = 'safe_to_send';

  const domain = email.split('@')[1];
  const localPart = email.split('@')[0];

  // Check for risky patterns
  if (localPart.includes('test') || localPart.includes('demo')) {
    riskFactors.push('test_pattern');
    score = 'high';
    recommendation = 'do_not_send';
  }

  if (domain.includes('spam') || domain.includes('fake')) {
    riskFactors.push('spam_domain');
    score = 'high';
    recommendation = 'do_not_send';
  }

  if (localPart.length > 20 || localPart.includes('..') || localPart.startsWith('.')) {
    riskFactors.push('suspicious_pattern');
    score = 'medium';
    recommendation = 'caution';
  }

  // Check for common catch-all patterns
  if (localPart.match(/^\d+/) || localPart.includes('random')) {
    riskFactors.push('possible_catchall');
    score = 'medium';
    recommendation = 'caution';
  }

  return { score, factors: riskFactors, recommendation };
}

async function thirdPartyVerification(email) {
  if (!process.env.ZEROBOUNCE_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.zerobounce.net/v1/validate?email=${encodeURIComponent(email)}&api_key=${process.env.ZEROBOUNCE_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`ZeroBounce API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      status: data.status,
      score: data.score,
      sub_status: data.sub_status,
      did_you_mean: data.did_you_mean,
      account: data.account,
      domain: data.domain
    };
  } catch (error) {
    console.error(`Third-party verification failed for ${email}:`, error);
    return null;
  }
}

function calculateRiskMetrics(results) {
  const total = results.length;
  const safe = results.filter(r => r.recommendation === 'safe_to_send').length;
  const caution = results.filter(r => r.recommendation === 'caution').length;
  const doNotSend = results.filter(r => r.recommendation === 'do_not_send').length;
  
  const highRisk = results.filter(r => r.riskScore === 'high').length;
  const mediumRisk = results.filter(r => r.riskScore === 'medium').length;
  const lowRisk = results.filter(r => r.riskScore === 'low').length;

  return {
    total,
    safe,
    caution,
    doNotSend,
    riskDistribution: {
      high: highRisk,
      medium: mediumRisk,
      low: lowRisk
    },
    safetyScore: total > 0 ? Math.round((safe / total) * 100) : 0,
    recommendation: doNotSend > 0 ? 'review_required' : (caution > safe ? 'proceed_with_caution' : 'safe_to_proceed')
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');
    
    if (!userId || !email) {
      return NextResponse.json({ error: 'User ID and email required' }, { status: 400 });
    }

    const verification = await verifyEmail(email);
    
    return NextResponse.json({
      success: true,
      verification: verification
    });
  } catch (error) {
    console.error('Single email verification error:', error);
    return NextResponse.json({ error: 'Email verification failed' }, { status: 500 });
  }
}
