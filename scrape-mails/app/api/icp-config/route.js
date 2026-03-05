// app/api/icp-config/route.js
import { NextResponse } from 'next/server';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
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

// ICP Template - Focused B2B Sales Targeting
const ICP_TEMPLATE = {
  industry: '', // e.g., "SaaS", "Manufacturing", "Healthcare"
  companySize: '', // e.g., "50-200", "200-500", "500-1000"
  geography: '', // e.g., "North America", "Europe", "APAC"
  painPoint: '', // e.g., "Lead generation", "Customer retention", "Operational efficiency"
  trigger: '', // e.g., "Recent funding", "Hiring spree", "Product launch", "Leadership change"
  targetCompanies: [], // Max 50 companies
  decisionMakerRoles: ['CEO', 'CTO', 'VP Sales', 'Marketing Director'], // Configurable
  maxEmailsPerDay: 50, // Send safety rule
  bounceThreshold: 5, // Percentage threshold to pause
  unsubscribeThreshold: 1 // Percentage threshold to pause
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const docRef = doc(db, 'icp_configs', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return NextResponse.json({ 
        success: true, 
        icp: docSnap.data(),
        isConfigured: true 
      });
    } else {
      return NextResponse.json({ 
        success: true, 
        icp: ICP_TEMPLATE,
        isConfigured: false 
      });
    }
  } catch (error) {
    console.error('Get ICP config error:', error);
    return NextResponse.json({ error: 'Failed to get ICP configuration' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { userId, icpConfig } = await request.json();
    
    if (!userId || !icpConfig) {
      return NextResponse.json({ error: 'User ID and ICP configuration required' }, { status: 400 });
    }

    // Validate ICP configuration
    const validation = validateICP(icpConfig);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Save ICP configuration
    const docRef = doc(db, 'icp_configs', userId);
    await setDoc(docRef, {
      ...icpConfig,
      updatedAt: new Date().toISOString(),
      status: 'active'
    });

    // Initialize target companies if provided
    if (icpConfig.targetCompanies && icpConfig.targetCompanies.length > 0) {
      await initializeTargetCompanies(userId, icpConfig.targetCompanies);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'ICP configuration saved successfully',
      validation: validation
    });
  } catch (error) {
    console.error('Save ICP config error:', error);
    return NextResponse.json({ error: 'Failed to save ICP configuration' }, { status: 500 });
  }
}

function validateICP(icp) {
  const required = ['industry', 'companySize', 'geography', 'painPoint', 'trigger'];
  
  for (const field of required) {
    if (!icp[field] || icp[field].trim() === '') {
      return { isValid: false, error: `${field} is required` };
    }
  }

  if (icp.targetCompanies && icp.targetCompanies.length > 50) {
    return { isValid: false, error: 'Maximum 50 target companies allowed' };
  }

  if (icp.maxEmailsPerDay && (icp.maxEmailsPerDay < 10 || icp.maxEmailsPerDay > 100)) {
    return { isValid: false, error: 'Max emails per day must be between 10 and 100' };
  }

  return { isValid: true };
}

async function initializeTargetCompanies(userId, companies) {
  const batch = companies.map(company => ({
    userId,
    companyName: company.name,
    website: company.website,
    industry: company.industry,
    size: company.size,
    geography: company.geography,
    status: 'research_pending',
    addedAt: new Date().toISOString(),
    researchCompleted: false,
    decisionMakers: [],
    triggers: [],
    emails: [],
    lastContacted: null,
    sequenceStep: 0,
    replyStatus: 'no_reply'
  }));

  // Save to target_companies collection
  for (const company of batch) {
    await setDoc(doc(db, 'target_companies', `${userId}_${company.companyName.replace(/\s+/g, '_')}`), company);
  }
}
