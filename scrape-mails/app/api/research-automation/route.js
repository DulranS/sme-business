// app/api/research-automation/route.js
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

// 2-Minute Research Automation
export async function POST(request) {
  try {
    const { userId, companyName, website } = await request.json();
    
    if (!userId || !companyName || !website) {
      return NextResponse.json({ error: 'User ID, company name, and website required' }, { status: 400 });
    }

    // Get ICP configuration for context
    const icpDoc = await getDoc(doc(db, 'icp_configs', userId));
    if (!icpDoc.exists()) {
      return NextResponse.json({ error: 'ICP configuration not found' }, { status: 400 });
    }
    
    const icp = icpDoc.data();

    // Perform 2-minute research
    const research = await performTwoMinuteResearch(companyName, website, icp);
    
    // Update company record
    const companyRef = doc(db, 'target_companies', `${userId}_${companyName.replace(/\s+/g, '_')}`);
    await updateDoc(companyRef, {
      researchCompleted: true,
      researchData: research,
      researchedAt: new Date().toISOString(),
      status: 'research_completed'
    });

    return NextResponse.json({
      success: true,
      research: research,
      message: `Research completed for ${companyName}`
    });
  } catch (error) {
    console.error('Research automation error:', error);
    return NextResponse.json({ error: 'Research automation failed' }, { status: 500 });
  }
}

async function performTwoMinuteResearch(companyName, website, icp) {
  const research = {
    companyName,
    website,
    headline: '',
    recentTriggers: [],
    decisionMakers: [],
    companySize: '',
    industry: '',
    geography: '',
    painPoints: [],
    researchTimestamp: new Date().toISOString()
  };

  try {
    // Step 1: Company headline and basic info
    const companyInfo = await getCompanyHeadline(website);
    research.headline = companyInfo.headline;
    research.companySize = companyInfo.size;
    research.industry = companyInfo.industry;
    research.geography = companyInfo.geography;

    // Step 2: Find recent triggers based on ICP
    research.recentTriggers = await findRecentTriggers(companyName, icp.trigger, website);

    // Step 3: Identify decision makers
    research.decisionMakers = await findDecisionMakers(companyName, icp.decisionMakerRoles, website);

    // Step 4: Analyze pain points
    research.painPoints = await analyzePainPoints(companyName, icp.painPoint, website);

  } catch (error) {
    console.error(`Research error for ${companyName}:`, error);
    research.error = error.message;
  }

  return research;
}

async function getCompanyHeadline(website) {
  // Simulate web scraping for company info
  // In production, integrate with Apollo.io, LinkedIn, or similar
  
  return {
    headline: `${website} - Leading provider in their industry`,
    size: '50-200 employees',
    industry: 'Technology',
    geography: 'North America'
  };
}

async function findRecentTriggers(companyName, triggerType, website) {
  const triggers = [];
  
  // Simulate trigger detection based on ICP
  const triggerPatterns = {
    'Recent funding': ['raised', 'funding', 'investment', 'series', 'venture'],
    'Hiring spree': ['hiring', 'jobs', 'careers', 'we are hiring', 'join our team'],
    'Product launch': ['launch', 'new product', 'release', 'announcement'],
    'Leadership change': ['appointed', 'new ceo', 'leadership', 'executive']
  };

  // In production, this would scrape news, press releases, LinkedIn updates
  const mockTriggers = [
    {
      type: triggerType,
      description: `${companyName} recently announced ${triggerType.toLowerCase()}`,
      source: 'Company Website',
      date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      url: website,
      relevanceScore: 0.9
    }
  ];

  return mockTriggers;
}

async function findDecisionMakers(companyName, roles, website) {
  const decisionMakers = [];
  
  // Simulate decision maker identification
  // In production, integrate with LinkedIn Sales Navigator, Apollo.io
  
  for (const role of roles.slice(0, 2)) { // Max 2 per company
    const mockDecisionMaker = {
      name: `${role} at ${companyName}`,
      role: role,
      title: role,
      linkedInUrl: `https://linkedin.com/in/${role.toLowerCase().replace(/\s+/g, '')}-${companyName.toLowerCase().replace(/\s+/g, '')}`,
      email: `${role.toLowerCase().replace(/\s+/g, '.')}@${website.replace('https://', '').replace('www.', '')}`,
      confidence: 0.8,
      lastActive: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
    };
    decisionMakers.push(mockDecisionMaker);
  }

  return decisionMakers;
}

async function analyzePainPoints(companyName, painPointType, website) {
  // Simulate pain point analysis
  const painPoints = [
    {
      type: painPointType,
      description: `Based on industry analysis, ${companyName} likely faces challenges with ${painPointType.toLowerCase()}`,
      severity: 'medium',
      evidence: 'Industry benchmark analysis',
      confidence: 0.7
    }
  ];

  return painPoints;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status') || 'research_pending';
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const q = query(
      collection(db, 'target_companies'),
      where('userId', '==', userId),
      where('status', '==', status)
    );
    
    const querySnapshot = await getDocs(q);
    const companies = [];
    
    querySnapshot.forEach((doc) => {
      companies.push({ id: doc.id, ...doc.data() });
    });

    return NextResponse.json({
      success: true,
      companies: companies,
      count: companies.length
    });
  } catch (error) {
    console.error('Get research queue error:', error);
    return NextResponse.json({ error: 'Failed to get research queue' }, { status: 500 });
  }
}
