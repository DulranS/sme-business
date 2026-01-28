# Complete Implementation with Full Contact Status Tracking

Here's the **complete, full code** with everything included - no sections commented out or condensed. This includes all the status tracking functionality plus all existing features from your original code:

```jsx
// app/dashboard/page.js
'use client';
import { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc, Timestamp, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import Head from 'next/head';
import { useRouter } from 'next/navigation';

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
const auth = getAuth(app);

// ✅ YOUR ACTUAL INITIAL PITCH
const DEFAULT_TEMPLATE_A = {
  subject: 'Quick question for {{business_name}}',
  body: `Hi {{business_name}}, 😊👋🏻
I hope you're doing well.
My name is Dulran Samarasinghe. I run Syndicate Solutions, a Sri Lanka–based mini agency supporting
small to mid-sized agencies and businesses with reliable execution across web, software,
AI automation, and ongoing digital operations.
We typically work as a white-label or outsourced partner when teams need:
• extra delivery capacity
• fast turnarounds without hiring
• ongoing technical and digital support
I'm reaching out to ask – do you ever use external support when workload or deadlines increase?
If helpful, I'm open to starting with a small task or short contract to build trust before
discussing anything larger.
You can review my work here:
Portfolio: https://syndicatesolutions.vercel.app/
LinkedIn: https://www.linkedin.com/in/dulran-samarasinghe-13941b175/
If it makes sense, you can book a short 15-minute call:
https://cal.com/syndicate-solutions/15min
You can contact me on Whatsapp - 0741143323
You can email me at - syndicatesoftwaresolutions@gmail.com
Otherwise, happy to continue the conversation over email.
Best regards,
Dulran Samarasinghe
Founder – Syndicate Solutions`
};

// ✅ FOLLOW-UP TEMPLATES
const FOLLOW_UP_1 = {
  subject: 'Quick question for {{business_name}}',
  body: `Hi {{business_name}},
Just circling back—did my note about outsourced dev & ops support land at a bad time?
No pressure at all, but if you're ever swamped with web, automation, or backend work and need a reliable extra hand (especially for white-label or fast-turnaround needs), we're ready to help.
Even a 1-hour task is a great way to test the waters.
Either way, wishing you a productive week!
Best,
Dulran
Founder – Syndicate Solutions
WhatsApp: 0741143323`
};

const FOLLOW_UP_2 = {
  subject: '{{business_name}}, a quick offer (no strings)',
  body: `Hi again,
I noticed you haven't had a chance to reply—totally understand!
To make this zero-risk: **I'll audit one of your digital workflows (e.g., lead capture, client onboarding, internal tooling) for free** and send 2–3 actionable automation ideas you can implement immediately—even if you never work with us.
Zero sales pitch. Just value.
Interested? Hit "Yes" or reply with a workflow you'd like optimized.
Cheers,
Dulran
Portfolio: https://syndicatesolutions.vercel.app/
Book a call: https://cal.com/syndicate-solutions/15min`
};

const FOLLOW_UP_3 = {
  subject: 'Closing the loop',
  body: `Hi {{business_name}},
I'll stop emailing after this one! 😅
Just wanted to say: if outsourcing ever becomes a priority—whether for web dev, AI tools, or ongoing ops—we're here. Many of our clients started with a tiny $100 task and now work with us monthly.
If now's not the time, no worries! I'll circle back in a few months.
Either way, keep crushing it!
— Dulran
WhatsApp: 0741143323`
};

// Keep B as fallback (or repurpose)
const DEFAULT_TEMPLATE_B = FOLLOW_UP_1;
const DEFAULT_WHATSAPP_TEMPLATE = `Hi {{business_name}} 👋😊
Hope you're doing well.
I'm {{sender_name}} from Sri Lanka – I run a small digital mini-agency supporting businesses with websites, content, and AI automation.
Quick question:
Are you currently working on anything digital that's taking too much time or not delivering the results you want?
If yes, I'd be happy to share a quick idea – no pressure at all.`;

const DEFAULT_SMS_TEMPLATE = `Hi {{business_name}} 👋
This is {{sender_name}} from Syndicate Solutions.
Quick question – are you currently working on any digital work that's delayed or not giving results?
Reply YES or NO.`;

// ✅ CONTACT STATUS DEFINITIONS (Business-Driven Workflow)
const CONTACT_STATUSES = [
  { id: 'new', label: '🆕 New Lead', color: 'gray', description: 'Never contacted' },
  { id: 'contacted', label: '📞 Contacted', color: 'blue', description: 'Initial outreach sent' },
  { id: 'engaged', label: '💬 Engaged', color: 'indigo', description: 'Opened/clicked but no reply' },
  { id: 'replied', label: '✅ Replied', color: 'green', description: 'Responded to outreach' },
  { id: 'demo_scheduled', label: '📅 Demo Scheduled', color: 'purple', description: 'Meeting booked' },
  { id: 'proposal_sent', label: '📄 Proposal Sent', color: 'orange', description: 'Quote delivered' },
  { id: 'negotiation', label: '🤝 Negotiation', color: 'yellow', description: 'Discussing terms' },
  { id: 'closed_won', label: '💰 Closed Won', color: 'emerald', description: 'Deal secured!' },
  { id: 'not_interested', label: '❌ Not Interested', color: 'red', description: 'Declined service' },
  { id: 'do_not_contact', label: '🚫 Do Not Contact', color: 'rose', description: 'Requested no contact' },
  { id: 'unresponsive', label: '⏳ Unresponsive', color: 'orange', description: 'No response after 3 attempts' },
  { id: 'archived', label: '🗄️ Archived', color: 'gray', description: 'Inactive >30 days' }
];

// ✅ STATUS TRANSITION RULES (Prevent invalid state changes)
const STATUS_TRANSITIONS = {
  'new': ['contacted', 'do_not_contact'],
  'contacted': ['engaged', 'replied', 'unresponsive', 'not_interested'],
  'engaged': ['replied', 'unresponsive', 'not_interested'],
  'replied': ['demo_scheduled', 'proposal_sent', 'negotiation', 'closed_won', 'not_interested'],
  'demo_scheduled': ['proposal_sent', 'negotiation', 'closed_won', 'not_interested'],
  'proposal_sent': ['negotiation', 'closed_won', 'not_interested'],
  'negotiation': ['closed_won', 'not_interested'],
  'closed_won': [],
  'not_interested': ['archived'],
  'do_not_contact': ['archived'],
  'unresponsive': ['archived', 're_engage'],
  'archived': ['re_engage']
};

// --- UTILITY FUNCTIONS ---
function formatForDialing(raw) {
  if (!raw || raw === 'N/A') return null;
  let cleaned = raw.toString().replace(/\D/g, '');
  if (cleaned.startsWith('0') && cleaned.length >= 9) {
    cleaned = '94' + cleaned.slice(1);
  }
  return /^[1-9]\d{9,14}$/.test(cleaned) ? cleaned : null;
}

const extractTemplateVariables = (text) => {
  if (!text) return [];
  const matches = text.match(/\{\{\s*([^}]+?)\s*\}\}/g) || [];
  return [...new Set(matches.map(m => m.replace(/\{\{\s*|\s*\}\}/g, '').trim()))];
};

// ✅ SYNC WITH API: Use the EXACT same validation rules
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  let cleaned = email.trim()
    .toLowerCase()
    .replace(/^["'`]+/, '')
    .replace(/["'`]+$/, '')
    .replace(/\s+/g, '')
    .replace(/[<>]/g, '');
  if (cleaned.length < 5) return false;
  if (cleaned === 'undefined' || cleaned === 'null' || cleaned === 'na' || cleaned === 'n/a') return false;
  if (cleaned.startsWith('[') || cleaned.includes('missing')) return false;
  const atCount = (cleaned.match(/@/g) || []).length;
  if (atCount !== 1) return false;
  const parts = cleaned.split('@');
  const [localPart, domainPart] = parts;
  if (!localPart || localPart.length < 1) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
  if (!domainPart || domainPart.length < 3) return false;
  if (!domainPart.includes('.')) return false;
  if (domainPart.startsWith('.') || domainPart.endsWith('.')) return false;
  const domainBits = domainPart.split('.');
  const tld = domainBits[domainBits.length - 1];
  if (!tld || tld.length < 2 || tld.length > 6) return false;
  if (!/^[a-z0-9-]+$/.test(tld)) return false;
  if (tld.startsWith('-') || tld.endsWith('-')) return false;
  return true;
};

const parseCsvRow = (str) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && !inQuotes) inQuotes = true;
    else if (char === '"' && inQuotes) {
      if (i + 1 < str.length && str[i + 1] === '"') {
        current += '"';
        i++;
      } else inQuotes = false;
    } else if (char === ',' && !inQuotes) {
      result.push(current); current = '';
    } else current += char;
  }
  result.push(current);
  return result.map(field => {
    let cleaned = field.replace(/[\r\n]/g, '').trim();
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1).replace(/""/g, '"');
    }
    return cleaned;
  });
};

const renderPreviewText = (text, recipient, mappings, sender) => {
  if (!text) return '';
  let result = text;
  Object.entries(mappings).forEach(([varName, col]) => {
    const regex = new RegExp(`{{\\s*${varName}\\s*}}`, 'g');
    if (varName === 'sender_name') {
      result = result.replace(regex, sender || 'Team');
    } else if (recipient && col && recipient[col] !== undefined) {
      result = result.replace(regex, String(recipient[col]));
    } else {
      result = result.replace(regex, `[MISSING: ${varName}]`);
    }
  });
  return result;
};

// ✅ EXPORT TEMPLATES FOR API USE
export { FOLLOW_UP_1, FOLLOW_UP_2, FOLLOW_UP_3 };
export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const router = useRouter();
  const [csvContent, setCsvContent] = useState('');
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [senderName, setSenderName] = useState('');
  const [abTestMode, setAbTestMode] = useState(false);
  const [templateA, setTemplateA] = useState(DEFAULT_TEMPLATE_A);
  const [templateB, setTemplateB] = useState(DEFAULT_TEMPLATE_B);
  const [whatsappTemplate, setWhatsappTemplate] = useState(DEFAULT_WHATSAPP_TEMPLATE);
  const [smsTemplate, setSmsTemplate] = useState(DEFAULT_SMS_TEMPLATE);
  const [fieldMappings, setFieldMappings] = useState({});
  const [previewRecipient, setPreviewRecipient] = useState(null);
  const [validEmails, setValidEmails] = useState(0);
  const [validWhatsApp, setValidWhatsApp] = useState(0);
  const [leadQualityFilter, setLeadQualityFilter] = useState('HOT');
  const [whatsappLinks, setWhatsappLinks] = useState([]);
  const [leadScores, setLeadScores] = useState({});
  const [lastSent, setLastSent] = useState({});
  const [clickStats, setClickStats] = useState({});
  const [emailImages, setEmailImages] = useState([]);
  const [dealStage, setDealStage] = useState({});
  const [pipelineValue, setPipelineValue] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState('');
  const [smsConsent, setSmsConsent] = useState(true);
  const [abResults, setAbResults] = useState({ a: { opens: 0, clicks: 0, sent: 0 }, b: { opens: 0, clicks: 0, sent: 0 } });
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const [repliedLeads, setRepliedLeads] = useState({});
  const [followUpLeads, setFollowUpLeads] = useState({});
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [sentLeads, setSentLeads] = useState([]);
  const [loadingSentLeads, setLoadingSentLeads] = useState(false);
  const [followUpHistory, setFollowUpHistory] = useState({});
  const [followUpFilter, setFollowUpFilter] = useState('all');
  const [followUpStats, setFollowUpStats] = useState({
    totalSent: 0,
    totalReplied: 0,
    readyForFollowUp: 0,
    alreadyFollowedUp: 0,
    awaitingReply: 0,
    interestedLeads: 0
  });
  
  // ✅ NEW: CONTACT STATUS MANAGEMENT STATE
  const [contactStatuses, setContactStatuses] = useState({}); // { contactId: status }
  const [statusHistory, setStatusHistory] = useState({}); // { contactId: [{status, timestamp, note}] }
  const [statusFilter, setStatusFilter] = useState('all');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedContactForStatus, setSelectedContactForStatus] = useState(null);
  const [statusNote, setStatusNote] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [archivedContactsCount, setArchivedContactsCount] = useState(0);
  
  // ✅ AI Research State
  const [researchingCompany, setResearchingCompany] = useState(null);
  const [researchResults, setResearchResults] = useState({});
  const [showResearchModal, setShowResearchModal] = useState(false);
  const [interestedLeadsList, setInterestedLeadsList] = useState([]);
  
  // ✅ 2026 Advanced Features State
  const [sendTimeOptimization, setSendTimeOptimization] = useState(null);
  const [predictiveScores, setPredictiveScores] = useState({});
  const [sentimentAnalysis, setSentimentAnalysis] = useState({});
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);
  const [smartFollowUpSuggestions, setSmartFollowUpSuggestions] = useState({});
  
  // ✅ ENHANCED FOLLOW-UP OPTIONS
  const [followUpTemplate, setFollowUpTemplate] = useState('auto');
  const [followUpTargeting, setFollowUpTargeting] = useState('ready');
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');
  const [batchSize, setBatchSize] = useState(50);
  const [followUpAnalytics, setFollowUpAnalytics] = useState({
    totalFollowUpsSent: 0,
    avgReplyRate: 0,
    bestTemplate: 'auto',
    bestTimeToSend: 'afternoon'
  });
  const [callHistory, setCallHistory] = useState([]);
  const [loadingCallHistory, setLoadingCallHistory] = useState(false);
  const [showCallHistoryModal, setShowCallHistoryModal] = useState(false);
  const [activeCallStatus, setActiveCallStatus] = useState(null);
  const [showMultiChannelModal, setShowMultiChannelModal] = useState(false);
  const [isMultiChannelFullscreen, setIsMultiChannelFullscreen] = useState(false);
  
  // ✅ NEW LEAD OUTREACH STATE
  const [dailyEmailCount, setDailyEmailCount] = useState(0);
  const [loadingDailyCount, setLoadingDailyCount] = useState(false);
  
  // ✅ NEW BUSINESS LOGIC: ADVANCED ANALYTICS & PREDICTIVE SCORING
  const [advancedMetrics, setAdvancedMetrics] = useState({
    avgDaysToFirstReply: 0,
    conversionFunnel: [],
    channelPerformance: {},
    leadVelocity: 0,
    churnRisk: [],
    recommendedFollowUpTime: 'afternoon',
    bestPerformingTemplate: null,
    estimatedMonthlyRevenue: 0
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [contactFilter, setContactFilter] = useState('all');
  const [sortBy, setSortBy] = useState('score');
  const [showDetailedAnalytics, setShowDetailedAnalytics] = useState(false);
  
  // ✅ Instagram & Twitter Templates
  const [instagramTemplate, setInstagramTemplate] = useState(`Hi {{business_name}} 👋
I run Syndicate Solutions – we help businesses like yours with web, AI, and digital ops.
Would you be open to a quick chat about how we can help?
No pressure at all.`);
  const [twitterTemplate, setTwitterTemplate] = useState(`Hi {{business_name}} 👋
I run Syndicate Solutions – we help businesses like yours with web, AI, and digital ops.
Would you be open to a quick chat?`);
  
  // ✅ Follow-Up Templates
  const [followUpTemplates, setFollowUpTemplates] = useState([
    {
      id: 'followup_1',
      name: 'Follow-Up 1 (Day 2)',
      channel: 'email',
      enabled: true,
      delayDays: 2,
      subject: 'Quick question for {{business_name}}',
      body: FOLLOW_UP_1.body
    },
    {
      id: 'followup_2',
      name: 'Follow-Up 2 (Day 5)',
      channel: 'email',
      enabled: true,
      delayDays: 5,
      subject: '{{business_name}}, a quick offer (no strings)',
      body: FOLLOW_UP_2.body
    },
    {
      id: 'followup_3',
      name: 'Breakup Email (Day 7)',
      channel: 'email',
      enabled: true,
      delayDays: 7,
      subject: 'Closing the loop',
      body: FOLLOW_UP_3.body
    }
  ]);
  
  // ✅ STATUS ANALYTICS
  const [statusAnalytics, setStatusAnalytics] = useState({
    byStatus: {},
    conversionRates: {},
    avgTimeInStatus: {},
    revenueByStatus: {}
  });

  useEffect(() => {
    if (window.google?.accounts?.oauth2?.initTokenClient) {
      setIsGoogleLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => setIsGoogleLoaded(true);
    document.head.appendChild(script);
    return () => document.head.removeChild(script);
  }, []);
  
  // ✅ CRITICAL: LOAD CONTACTS FROM FIRESTORE ON AUTH
  const loadContactsFromFirestore = useCallback(async (userId) => {
    if (!userId) return;
    setLoadingContacts(true);
    try {
      // Query contacts collection with ordering
      const contactsRef = collection(db, 'users', userId, 'contacts');
      const q = query(contactsRef, orderBy('lastUpdated', 'desc'));
      const snapshot = await getDocs(q);
      
      const contacts = [];
      const statuses = {};
      const history = {};
      
      snapshot.forEach(doc => {
        const data = doc.data();
        // Generate unique contact ID (prioritize email, then phone)
        const contactId = data.email?.toLowerCase().trim() || `phone_${data.phone}`;
        
        contacts.push({
          id: doc.id,
          contactId,
          business: data.business || 'Business',
          address: data.address || '',
          phone: data.phone || '',
          email: data.email || null,
          place_id: data.place_id || '',
          website: data.website || '',
          instagram: data.instagram || '',
          twitter: data.twitter || '',
          facebook: data.facebook || '',
          youtube: data.youtube || '',
          tiktok: data.tiktok || '',
          linkedin_company: data.linkedin_company || '',
          linkedin_ceo: data.linkedin_ceo || '',
          linkedin_founder: data.linkedin_founder || '',
          contact_page_found: data.contact_page_found || 'No',
          social_media_score: data.social_media_score || '0',
          email_primary: data.email_primary || data.email || '',
          phone_primary: data.phone_primary || data.phone || '',
          lead_quality_score: data.lead_quality_score || '0',
          contact_confidence: data.contact_confidence || 'Low',
          best_contact_method: data.best_contact_method || 'Email',
          decision_maker_found: data.decision_maker_found || 'No',
          tech_stack_detected: data.tech_stack_detected || '',
          company_size_indicator: data.company_size_indicator || 'unknown',
          status: data.status || 'new',
          lastContacted: data.lastContacted?.toDate?.() || data.lastContacted || null,
          createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
          lastUpdated: data.lastUpdated?.toDate?.() || data.lastUpdated || new Date(),
          statusHistory: data.statusHistory || [],
          notes: data.notes || [],
          url: data.phone ? `https://wa.me/${data.phone}?text=${encodeURIComponent(
            renderPreviewText(whatsappTemplate, { business_name: data.business, address: data.address || '' }, fieldMappings, senderName)
          )}` : null
        });
        
        statuses[contactId] = data.status || 'new';
        history[contactId] = data.statusHistory || [];
      });
      
      // ✅ AUTO-CLEANUP: Archive irrelevant contacts >30 days old
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const contactsToArchive = contacts.filter(contact => 
        ['not_interested', 'do_not_contact', 'unresponsive'].includes(contact.status) &&
        new Date(contact.lastUpdated) < thirtyDaysAgo &&
        contact.status !== 'archived'
      );
      
      let archivedCount = 0;
      if (contactsToArchive.length > 0) {
        console.log(`🗄️ Auto-archiving ${contactsToArchive.length} irrelevant contacts (>30 days)`);
        for (const contact of contactsToArchive) {
          try {
            await updateContactStatus(contact.contactId, 'archived', 'Auto-archived: >30 days inactive');
            archivedCount++;
          } catch (err) {
            console.error(`Failed to archive contact ${contact.contactId}:`, err);
          }
        }
        setArchivedContactsCount(archivedCount);
        // Reload contacts after cleanup
        return loadContactsFromFirestore(userId);
      }
      
      setWhatsappLinks(contacts);
      setContactStatuses(statuses);
      setStatusHistory(history);
      
      // ✅ Calculate status analytics
      calculateStatusAnalytics(contacts);
      
    } catch (error) {
      console.error('Failed to load contacts from Firestore:', error);
      alert('Failed to load contact database. Check console for details.');
    } finally {
      setLoadingContacts(false);
    }
  }, [fieldMappings, senderName, whatsappTemplate]);
  
  // ✅ SAVE CONTACTS TO FIRESTORE ON CSV UPLOAD
  const saveContactsToFirestore = useCallback(async (contacts, userId) => {
    if (!userId || contacts.length === 0) return;
    
    try {
      // Get existing contacts mapping by email/phone
      const existingContacts = {};
      const contactsRef = collection(db, 'users', userId, 'contacts');
      const snapshot = await getDocs(contactsRef);
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const key = data.email?.toLowerCase().trim() || `phone_${data.phone}`;
        existingContacts[key] = { id: doc.id, ...data };
      });
      
      // Process each contact from CSV
      for (const contact of contacts) {
        const contactKey = contact.email?.toLowerCase().trim() || `phone_${contact.phone}`;
        const now = new Date();
        
        // Prepare contact data for Firestore
        const contactData = {
          business: contact.business || '',
          address: contact.address || '',
          phone: contact.phone || '',
          email: contact.email || null,
          place_id: contact.place_id || '',
          website: contact.website || '',
          instagram: contact.instagram || '',
          twitter: contact.twitter || '',
          facebook: contact.facebook || '',
          youtube: contact.youtube || '',
          tiktok: contact.tiktok || '',
          linkedin_company: contact.linkedin_company || '',
          linkedin_ceo: contact.linkedin_ceo || '',
          linkedin_founder: contact.linkedin_founder || '',
          contact_page_found: contact.contact_page_found || 'No',
          social_media_score: contact.social_media_score || '0',
          email_primary: contact.email_primary || contact.email || '',
          phone_primary: contact.phone_primary || contact.phone || '',
          lead_quality_score: contact.lead_quality_score || '0',
          contact_confidence: contact.contact_confidence || 'Low',
          best_contact_method: contact.best_contact_method || 'Email',
          decision_maker_found: contact.decision_maker_found || 'No',
          tech_stack_detected: contact.tech_stack_detected || '',
          company_size_indicator: contact.company_size_indicator || 'unknown',
          lastUpdated: serverTimestamp(),
          source: 'csv_upload'
        };
        
        // Determine status logic
        if (existingContacts[contactKey]) {
          // Existing contact - preserve status unless it's archived
          const existing = existingContacts[contactKey];
          if (existing.status !== 'archived') {
            contactData.status = existing.status;
            contactData.statusHistory = existing.statusHistory || [];
            contactData.notes = existing.notes || [];
            contactData.lastContacted = existing.lastContacted || null;
          } else {
            // Reactivate archived contact
            contactData.status = 'new';
            contactData.statusHistory = [
              ...(existing.statusHistory || []),
              { status: 'archived', timestamp: existing.lastUpdated || now, note: 'Previously archived' },
              { status: 'new', timestamp: now, note: 'Reactivated via new CSV upload' }
            ];
          }
          contactData.createdAt = existing.createdAt || now;
          
          // Update existing document
          await updateDoc(doc(db, 'users', userId, 'contacts', existing.id), contactData);
        } else {
          // New contact - set initial status
          contactData.status = 'new';
          contactData.statusHistory = [{
            status: 'new',
            timestamp: now,
            note: 'Imported via CSV upload'
          }];
          contactData.notes = [];
          contactData.createdAt = serverTimestamp();
          contactData.lastContacted = null;
          
          // Create new document
          await addDoc(contactsRef, contactData);
        }
      }
      
      // Reload contacts after save
      await loadContactsFromFirestore(userId);
      
    } catch (error) {
      console.error('Failed to save contacts to Firestore:', error);
      throw error;
    }
  }, [loadContactsFromFirestore]);
  
  // ✅ UPDATE CONTACT STATUS (with history tracking)
  const updateContactStatus = useCallback(async (contactId, newStatus, note = '') => {
    if (!user?.uid || !contactId || !newStatus) {
      console.warn('Missing required data for status update');
      return false;
    }
    
    // Validate status transition
    const currentStatus = contactStatuses[contactId] || 'new';
    if (currentStatus !== newStatus && 
        !STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) &&
        currentStatus !== 'archived') {
      const validTransitions = STATUS_TRANSITIONS[currentStatus] || [];
      console.warn(`Invalid status transition: ${currentStatus} -> ${newStatus}. Valid:`, validTransitions);
      alert(`Cannot change status from "${currentStatus}" to "${newStatus}".\nValid next statuses: ${validTransitions.join(', ') || 'none'}`);
      return false;
    }
    
    try {
      // Find contact document
      const contactsRef = collection(db, 'users', user.uid, 'contacts');
      const q = query(contactsRef, 
        where('email', '==', contactId.includes('@') ? contactId : null)
      );
      
      let contactDocRef = null;
      let contactData = null;
      
      if (contactId.includes('@')) {
        // Email-based contact
        const emailQuery = query(contactsRef, where('email', '==', contactId));
        const emailSnapshot = await getDocs(emailQuery);
        if (!emailSnapshot.empty) {
          contactDocRef = doc(db, 'users', user.uid, 'contacts', emailSnapshot.docs[0].id);
          contactData = emailSnapshot.docs[0].data();
        }
      } else if (contactId.startsWith('phone_')) {
        // Phone-based contact
        const phone = contactId.replace('phone_', '');
        const phoneQuery = query(contactsRef, where('phone', '==', phone));
        const phoneSnapshot = await getDocs(phoneQuery);
        if (!phoneSnapshot.empty) {
          contactDocRef = doc(db, 'users', user.uid, 'contacts', phoneSnapshot.docs[0].id);
          contactData = phoneSnapshot.docs[0].data();
        }
      }
      
      if (!contactDocRef) {
        console.error('Contact not found in Firestore:', contactId);
        alert('Contact not found in database. Please refresh and try again.');
        return false;
      }
      
      // Prepare status history entry
      const now = new Date();
      const historyEntry = {
        status: newStatus,
        timestamp: now,
        note: note || `Status changed from ${currentStatus} to ${newStatus}`,
        userId: user.uid,
        userName: user.displayName || user.email
      };
      
      // Update contact document
      const updateData = {
        status: newStatus,
        lastUpdated: serverTimestamp(),
        statusHistory: [...(contactData?.statusHistory || []), historyEntry]
      };
      
      // Set lastContacted if moving to contacted status
      if (newStatus === 'contacted' && !contactData?.lastContacted) {
        updateData.lastContacted = serverTimestamp();
      }
      
      // Special handling for closed_won
      if (newStatus === 'closed_won') {
        updateData.closedDate = serverTimestamp();
        updateData.dealValue = 5000; // Default value - could be customized
      }
      
      await updateDoc(contactDocRef, updateData);
      
      // Update local state
      setContactStatuses(prev => ({ ...prev, [contactId]: newStatus }));
      setStatusHistory(prev => ({
        ...prev,
        [contactId]: [...(prev[contactId] || []), historyEntry]
      }));
      
      // Update whatsappLinks state
      setWhatsappLinks(prev => 
        prev.map(contact => 
          contact.contactId === contactId 
            ? { ...contact, status: newStatus, lastUpdated: now }
            : contact
        )
      );
      
      // Recalculate analytics
      calculateStatusAnalytics(whatsappLinks.map(c => 
        c.contactId === contactId ? { ...c, status: newStatus } : c
      ));
      
      console.log(`✅ Status updated for ${contactId}: ${currentStatus} → ${newStatus}`);
      return true;
      
    } catch (error) {
      console.error('Failed to update contact status:', error);
      alert(`Failed to update status: ${error.message}`);
      return false;
    }
  }, [user, contactStatuses, whatsappLinks]);
  
  // ✅ BULK STATUS UPDATE
  const bulkUpdateStatus = useCallback(async (contactIds, newStatus, note = '') => {
    if (!user?.uid || contactIds.length === 0) return;
    
    let successCount = 0;
    for (const contactId of contactIds) {
      const success = await updateContactStatus(contactId, newStatus, note);
      if (success) successCount++;
    }
    
    alert(`✅ Updated ${successCount}/${contactIds.length} contacts to "${newStatus}" status`);
    return successCount;
  }, [updateContactStatus, user]);
  
  // ✅ CALCULATE STATUS ANALYTICS
  const calculateStatusAnalytics = useCallback((contacts) => {
    const byStatus = {};
    const revenueByStatus = {};
    
    // Initialize counters
    CONTACT_STATUSES.forEach(s => {
      byStatus[s.id] = 0;
      revenueByStatus[s.id] = 0;
    });
    
    // Count contacts by status
    contacts.forEach(contact => {
      const status = contact.status || 'new';
      byStatus[status] = (byStatus[status] || 0) + 1;
      
      // Estimate revenue potential by status
      if (status === 'demo_scheduled') revenueByStatus[status] += 2500;
      else if (status === 'proposal_sent') revenueByStatus[status] += 4000;
      else if (status === 'negotiation') revenueByStatus[status] += 4500;
      else if (status === 'closed_won') revenueByStatus[status] += 5000;
    });
    
    // Calculate conversion rates
    const total = contacts.length;
    const conversionRates = {
      contacted: total > 0 ? ((byStatus['contacted'] || 0) / total * 100).toFixed(1) : 0,
      replied: total > 0 ? ((byStatus['replied'] || 0) / total * 100).toFixed(1) : 0,
      demo: total > 0 ? ((byStatus['demo_scheduled'] || 0) / total * 100).toFixed(1) : 0,
      won: total > 0 ? ((byStatus['closed_won'] || 0) / total * 100).toFixed(1) : 0
    };
    
    setStatusAnalytics({
      byStatus,
      conversionRates,
      revenueByStatus,
      totalContacts: total
    });
  }, []);
  
  // ✅ HANDLE CSV UPLOAD WITH FIRESTORE INTEGRATION
  const handleCsvUpload = useCallback(async (e) => {
    setValidEmails(0);
    setValidWhatsApp(0);
    setWhatsappLinks([]);
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawContent = e.target.result;
      const normalizedContent = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lines = normalizedContent.split('\n').filter(line => line.trim() !== '');
      if (lines.length < 2) {
        alert('CSV must have headers and data rows.');
        return;
      }
      
      const headers = parseCsvRow(lines[0]).map(h => h.trim());
      setCsvHeaders(headers);
      setPreviewRecipient(null);
      
      // ✅ Expose all possible variables + CSV headers for mapping
      const allTemplateTexts = [
        templateA.subject, templateA.body,
        templateB.subject, templateB.body,
        whatsappTemplate,
        smsTemplate,
        instagramTemplate,
        twitterTemplate,
        ...followUpTemplates.flatMap(t => [t.subject, t.body])
      ];
      const allVars = [...new Set([
        ...allTemplateTexts.flatMap(text => extractTemplateVariables(text)),
        'sender_name',
        ...emailImages.map(img => img.placeholder.replace(/{{|}}/g, '')),
        ...headers
      ])];
      const initialMappings = {};
      allVars.forEach(varName => {
        if (headers.includes(varName)) {
          initialMappings[varName] = varName;
        }
      });
      if (headers.includes('email')) initialMappings.email = 'email';
      initialMappings.sender_name = 'sender_name';
      setFieldMappings(initialMappings);
      
      // ✅ Lead processing with lead_quality column presence check
      let hotEmails = 0, warmEmails = 0;
      const validPhoneContacts = [];
      const newLeadScores = {};
      const newLastSent = {};
      let firstValid = null;
      
      // ✅ CRITICAL: Only filter by leadQuality if the column exists
      const hasLeadQualityCol = headers.includes('lead_quality');
      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvRow(lines[i]);
        if (values.length !== headers.length) continue;
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        
        // ✅ Include email only if valid AND passes quality filter (if applicable)
        let includeEmail = true;
        if (hasLeadQualityCol) {
          const quality = (row.lead_quality || '').trim() || 'HOT';
          if (leadQualityFilter !== 'all' && quality !== leadQualityFilter) {
            includeEmail = false;
          }
        }
        const hasValidEmail = isValidEmail(row.email);
        if (hasValidEmail && includeEmail) {
          let score = 50;
          const quality = (row.lead_quality || '').trim() || 'HOT';
          if (quality === 'HOT') score += 30;
          if (parseFloat(row.rating) >= 4.8) score += 20;
          if (parseInt(row.review_count) > 100) score += 10;
          if (clickStats[row.email]?.count > 0) score += 20;
          score = Math.min(100, Math.max(0, score));
          newLeadScores[row.email] = score;
          if (!hasLeadQualityCol || quality === 'HOT') {
            hotEmails++;
          } else if (quality === 'WARM') {
            warmEmails++;
          }
          if (!firstValid) firstValid = row;
        }
        const rawPhone = row.whatsapp_number || row.phone_raw || row.phone;
        const formattedPhone = formatForDialing(rawPhone);
        if (formattedPhone) {
          const contactId = `${row.email || 'no-email'}-${formattedPhone}-${Date.now()}-${Math.random()}`;
          validPhoneContacts.push({
            id: contactId,
            business: row.business_name || 'Business',
            address: row.address || '',
            phone: formattedPhone,
            email: row.email || null,
            place_id: row.place_id || '',
            website: row.website || '',
            // ✅ ALL SOCIAL MEDIA & OUTREACH FIELDS
            instagram: row.instagram || '',
            twitter: row.twitter || '',
            facebook: row.facebook || '',
            youtube: row.youtube || '',
            tiktok: row.tiktok || '',
            linkedin_company: row.linkedin_company || '',
            linkedin_ceo: row.linkedin_ceo || '',
            linkedin_founder: row.linkedin_founder || '',
            contact_page_found: row.contact_page_found || 'No',
            social_media_score: row.social_media_score || '0',
            email_primary: row.email_primary || row.email || '',
            phone_primary: row.phone_primary || formattedPhone || '',
            lead_quality_score: row.lead_quality_score || '0',
            contact_confidence: row.contact_confidence || 'Low',
            best_contact_method: row.best_contact_method || 'Email',
            decision_maker_found: row.decision_maker_found || 'No',
            tech_stack_detected: row.tech_stack_detected || '',
            company_size_indicator: row.company_size_indicator || 'unknown',
            status: 'new', // Initial status
            lastContacted: null,
            createdAt: new Date(),
            lastUpdated: new Date(),
            statusHistory: [{
              status: 'new',
              timestamp: new Date(),
              note: 'Imported via CSV upload'
            }]
          });
          if (!firstValid) firstValid = row;
        }
      }
      
      setPreviewRecipient(firstValid);
      if (leadQualityFilter === 'HOT') setValidEmails(hotEmails);
      else if (leadQualityFilter === 'WARM') setValidEmails(warmEmails);
      else setValidEmails(hotEmails + warmEmails);
      setValidWhatsApp(validPhoneContacts.length);
      
      // ✅ SAVE TO FIRESTORE INSTEAD OF JUST SETTING STATE
      if (user?.uid) {
        try {
          setStatus('💾 Saving contacts to database...');
          await saveContactsToFirestore(validPhoneContacts, user.uid);
          setStatus(`✅ ${validPhoneContacts.length} contacts saved to database!`);
        } catch (error) {
          console.error('CSV save error:', error);
          setStatus(`❌ Failed to save contacts: ${error.message}`);
          alert(`Failed to save contacts to database: ${error.message}`);
          // Fallback: set local state only
          setWhatsappLinks(validPhoneContacts);
        }
      } else {
        // Fallback if not authenticated (shouldn't happen)
        setWhatsappLinks(validPhoneContacts);
      }
      
      setLeadScores(newLeadScores);
      setLastSent(newLastSent);
      setCsvContent(normalizedContent);
    };
    reader.readAsText(file);
  }, [user, leadQualityFilter, templateA, templateB, whatsappTemplate, smsTemplate, instagramTemplate, twitterTemplate, followUpTemplates, emailImages, fieldMappings, clickStats, saveContactsToFirestore]);
  
  // ✅ STATUS FILTERING LOGIC
  const getFilteredContacts = useCallback(() => {
    let filtered = [...whatsappLinks];
    
    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(c =>
        c.business.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone?.includes(searchQuery.replace(/\D/g, ''))
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }
    
    // Apply contact filter
    if (contactFilter === 'replied') {
      filtered = filtered.filter(c => c.status === 'replied' || repliedLeads[c.email]);
    } else if (contactFilter === 'pending') {
      filtered = filtered.filter(c => !['replied', 'closed_won', 'not_interested', 'do_not_contact'].includes(c.status));
    } else if (contactFilter === 'high-quality') {
      filtered = filtered.filter(c => (leadScores[c.email] || 0) >= 70);
    } else if (contactFilter === 'contacted') {
      filtered = filtered.filter(c => c.status === 'contacted' || c.lastContacted);
    }
    
    // Apply sorting
    if (sortBy === 'score') {
      filtered.sort((a, b) => (leadScores[b.email] || 0) - (leadScores[a.email] || 0));
    } else if (sortBy === 'recent') {
      filtered.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => a.business.localeCompare(b.business));
    } else if (sortBy === 'status') {
      filtered.sort((a, b) => {
        const statusOrder = CONTACT_STATUSES.reduce((acc, s, i) => ({ ...acc, [s.id]: i }), {});
        return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
      });
    }
    
    return filtered;
  }, [whatsappLinks, searchQuery, statusFilter, contactFilter, repliedLeads, leadScores, sortBy]);
  
  // ✅ HANDLE STATUS CHANGE FROM UI
  const handleStatusChange = useCallback(async (contact, newStatus) => {
    if (!contact?.contactId) {
      console.error('Invalid contact for status change:', contact);
      return;
    }
    
    // Special handling for "not_interested" and "do_not_contact"
    if (['not_interested', 'do_not_contact'].includes(newStatus)) {
      const confirmed = confirm(
        `⚠️ Marking "${contact.business}" as "${newStatus}"\n\n` +
        `This will:\n` +
        `• Stop all automated follow-ups\n` +
        `• Archive contact after 30 days of inactivity\n` +
        `• Require manual reactivation to contact again\n\n` +
        `Are you sure?`
      );
      if (!confirmed) return;
    }
    
    // Show note modal for important status changes
    if (['not_interested', 'do_not_contact', 'closed_won', 'demo_scheduled'].includes(newStatus)) {
      setSelectedContactForStatus(contact);
      setStatusNote('');
      setShowStatusModal(true);
      return;
    }
    
    // Direct update for simple status changes
    await updateContactStatus(contact.contactId, newStatus);
  }, [updateContactStatus]);
  
  // ✅ HANDLE STATUS MODAL SUBMIT
  const handleStatusModalSubmit = useCallback(async () => {
    if (!selectedContactForStatus?.contactId || !statusNote.trim()) {
      alert('Please add a note explaining this status change.');
      return;
    }
    
    const success = await updateContactStatus(
      selectedContactForStatus.contactId, 
      selectedContactForStatus.newStatus,
      statusNote.trim()
    );
    
    if (success) {
      setShowStatusModal(false);
      setSelectedContactForStatus(null);
      setStatusNote('');
    }
  }, [selectedContactForStatus, statusNote, updateContactStatus]);
  
  // ✅ RE-ENGAGE ARCHIVED CONTACTS
  const reengageArchivedContacts = useCallback(async () => {
    if (!user?.uid) return;
    
    const confirmed = confirm(
      `🔄 Re-engage archived contacts?\n\n` +
      `This will:\n` +
      `• Restore ${archivedContactsCount} archived contacts to "New Lead" status\n` +
      `• Make them available for new outreach campaigns\n` +
      `• Reset their 30-day inactivity timer\n\n` +
      `Recommended only if you have a new offer or reason to contact them.`
    );
    
    if (!confirmed) return;
    
    try {
      setStatus('🔄 Re-engaging archived contacts...');
      const contactsRef = collection(db, 'users', user.uid, 'contacts');
      const q = query(
        contactsRef, 
        where('status', '==', 'archived'),
        where('lastUpdated', '<', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      );
      const snapshot = await getDocs(q);
      
      let successCount = 0;
      for (const docSnap of snapshot.docs) {
        const contactData = docSnap.data();
        const contactId = contactData.email?.toLowerCase().trim() || `phone_${contactData.phone}`;
        
        await updateContactStatus(contactId, 'new', 'Re-engaged: New campaign initiated');
        successCount++;
      }
      
      setStatus(`✅ ${successCount} contacts re-engaged successfully!`);
      alert(`✅ ${successCount} archived contacts restored to "New Lead" status!`);
      
      // Reload contacts
      await loadContactsFromFirestore(user.uid);
      
    } catch (error) {
      console.error('Re-engagement error:', error);
      setStatus(`❌ Failed to re-engage contacts: ${error.message}`);
      alert(`Failed to re-engage contacts: ${error.message}`);
    }
  }, [user, archivedContactsCount, updateContactStatus, loadContactsFromFirestore]);
  
  // ✅ HANDLE CALL WITH STATUS UPDATE
  const handleTwilioCall = async (contact, callType = 'direct') => {
    // 🔒 SAFETY: Ensure contact is valid and has required fields
    if (!contact || !contact.phone || !contact.business) {
      console.warn('Invalid contact passed to handleTwilioCall:', contact);
      alert('❌ Contact data is incomplete. Cannot place call.');
      return;
    }
    if (!user?.uid) {
      alert('❌ You must be signed in to make calls.');
      return;
    }
    
    // ✅ UPDATE STATUS BEFORE CALL IF STILL "new"
    if (contact.status === 'new') {
      await updateContactStatus(contact.contactId, 'contacted', `Call initiated via ${callType} method`);
    }
    
    const callTypeLabels = {
      direct: 'Automated Message (Plays your script)',
      bridge: 'Bridge Call (Connects you first)',
      interactive: 'Interactive Menu (They can press buttons)'
    };
    
    const confirmed = confirm(
      `📞 Call ${contact.business} at +${contact.phone}?
Type: ${callTypeLabels[callType]}
Current Status: ${contact.status}
Click OK to proceed.`
    );
    
    if (!confirmed) return;
    
    try {
      setStatus(`📞 Initiating ${callType} call to ${contact.business}...`);
      setActiveCallStatus({
        business: contact.business,
        phone: contact.phone,
        status: 'initiating',
        timestamp: new Date().toISOString()
      });
      
      const response = await fetch('/api/make-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toPhone: contact.phone,
          businessName: contact.business,
          userId: user.uid,
          callType
        })
      });
      
      // ✅ CRITICAL: Check if response is valid JSON
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Invalid JSON from /api/make-call:', await response.text());
        throw new Error('Server returned an invalid response. Check Vercel logs.');
      }
      
      if (response.ok) {
        setStatus(`✅ Call initiated to ${contact.business}!
Call ID: ${data.callId}
Status: ${data.status}`);
        
        setActiveCallStatus({
          business: contact.business,
          phone: contact.phone,
          status: data.status,
          callId: data.callId,
          callSid: data.callSid,
          timestamp: new Date().toISOString()
        });
        
        alert(
          `✅ Call Successfully Initiated!
` +
          `Business: ${contact.business}
` +
          `Phone: +${contact.phone}
` +
          `Type: ${callType}
` +
          `Status: ${data.status}
` +
          `Call ID: ${data.callId}`
        );
        
        // ✅ UPDATE LAST CONTACTED TIMESTAMP
        const contactKey = contact.email || contact.phone;
        setLastSent(prev => ({ ...prev, [contactKey]: new Date().toISOString() }));
        
        // ✅ UPDATE STATUS TO "contacted" IF NOT ALREADY
        if (!['contacted', 'engaged', 'replied'].includes(contact.status)) {
          await updateContactStatus(contact.contactId, 'contacted', `Call completed: ${data.status}`);
        }
        
        pollCallStatus(data.callId, contact.business);
      } else {
        const errorMsg = data.error || 'Unknown error';
        setStatus(`❌ Call Failed
Error: ${errorMsg}`);
        setActiveCallStatus({
          business: contact.business,
          phone: contact.phone,
          status: 'failed',
          error: errorMsg,
          timestamp: new Date().toISOString()
        });
        alert(`❌ Call Failed!
Business: ${contact.business}
Error: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Twilio call error:', error);
      const userMessage = error.message || 'Network or server error. Check Vercel logs.';
      setStatus(`❌ ${userMessage}`);
      setActiveCallStatus({
        business: contact?.business || 'Unknown',
        phone: contact?.phone || 'Unknown',
        status: 'error',
        error: userMessage,
        timestamp: new Date().toISOString()
      });
      alert(`❌ ${userMessage}
Check browser console and Vercel function logs.`);
    }
  };
  
  // ✅ HANDLE SEND EMAILS WITH STATUS UPDATE
  const handleSendEmails = async (templateToSend = null) => {
    const lines = csvContent?.split('\n').filter(line => line.trim() !== '') || [];
    if (lines.length < 2) {
      alert('Please upload a valid CSV file first.');
      return;
    }
    if (!senderName.trim() || validEmails === 0) {
      alert('Check sender name and valid emails.');
      return;
    }
    if (abTestMode && !templateToSend) {
      alert('Please select Template A or B.');
      return;
    }
    if (abTestMode) {
      if (templateToSend === 'A' && !templateA.subject?.trim()) {
        alert('Template A subject is required.');
        return;
      }
      if (templateToSend === 'B' && !templateB.subject?.trim()) {
        alert('Template B subject is required.');
        return;
      }
    } else {
      if (!templateA.subject?.trim()) {
        alert('Email subject is required.');
        return;
      }
    }
    
    setIsSending(true);
    setStatus('Getting Gmail access...');
    
    try {
      const accessToken = await requestGmailToken();
      const imagesWithBase64 = await Promise.all(
        emailImages.map(async (img, index) => {
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(img.file);
          });
          return {
            cid: img.cid,
            mimeType: img.file.type,
            base64,
            placeholder: img.placeholder
          };
        })
      );
      
      const headers = parseCsvRow(lines[0]).map(h => h.trim());
      let validRecipients = [];
      
      // ✅ FIXED: Find the actual CSV column names from fieldMappings
      const emailColumnName = Object.entries(fieldMappings).find(([key, val]) => key === 'email')?.[1] || 'email';
      const qualityColumnName = Object.entries(fieldMappings).find(([key, val]) => key === 'lead_quality')?.[1] || 'lead_quality';
      
      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvRow(lines[i]);
        if (values.length !== headers.length) continue;
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx]?.toString().trim() || '';
        });
        
        // ✅ Get email using actual CSV column name
        const emailValue = row[emailColumnName] || '';
        if (!isValidEmail(emailValue)) {
          continue;
        }
        
        // ✅ Check if quality column exists in headers
        const hasQualityColumn = headers.includes(qualityColumnName);
        const quality = hasQualityColumn ? (row[qualityColumnName] || '').trim() || 'HOT' : 'HOT';
        
        // ✅ Apply quality filter
        if (leadQualityFilter !== 'all' && quality !== leadQualityFilter) {
          continue;
        }
        
        // ✅ Normalize row to include 'email' key for consistent rendering
        const normalizedRow = { ...row, email: emailValue };
        validRecipients.push(normalizedRow);
      }
      
      let recipientsToSend = [];
      if (abTestMode && templateToSend) {
        const half = Math.ceil(validRecipients.length / 2);
        if (templateToSend === 'A') recipientsToSend = validRecipients.slice(0, half);
        else recipientsToSend = validRecipients.slice(half);
      } else {
        recipientsToSend = validRecipients;
      }
      
      if (recipientsToSend.length === 0) {
        setStatus('❌ No valid leads for selected criteria.');
        setIsSending(false);
        alert(`❌ No valid recipients found!
Email column: ${emailColumnName}
Quality column: ${qualityColumnName}
Filter: ${leadQualityFilter}`);
        return;
      }
      
      setStatus(`Sending to ${recipientsToSend.length} leads...`);
      
      // ✅ UPDATE STATUS FOR ALL RECIPIENTS BEFORE SENDING
      const recipientsToUpdate = recipientsToSend.filter(r => r.email);
      for (const recipient of recipientsToUpdate) {
        const contactId = recipient.email.toLowerCase().trim();
        // Only update if status is "new"
        if (contactStatuses[contactId] === 'new') {
          await updateContactStatus(contactId, 'contacted', 'Initial email outreach sent');
        }
      }
      
      // ✅ SMARTER CSV RECONSTRUCTION - Only quote fields that need it
      const csvLines = [headers.join(',')];
      for (const row of recipientsToSend) {
        const csvFields = headers.map(h => {
          const val = (row[h] || '').toString().trim();
          // Only quote if contains comma, quotes, or newlines
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        });
        csvLines.push(csvFields.join(','));
      }
      const reconstructedCsv = csvLines.join('\n');
      
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent: reconstructedCsv,
          senderName,
          fieldMappings,
          accessToken,
          abTestMode,
          templateA,
          templateB,
          templateToSend,
          leadQualityFilter,
          emailImages: imagesWithBase64,
          userId: user.uid
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setStatus(`✅ ${data.sent}/${data.total} emails sent!`);
        
        // ✅ UPDATE STATUS FOR SUCCESSFULLY SENT EMAILS
        if (data.sentEmails && Array.isArray(data.sentEmails)) {
          for (const email of data.sentEmails) {
            const contactId = email.toLowerCase().trim();
            if (contactStatuses[contactId] === 'new') {
              await updateContactStatus(contactId, 'contacted', 'Email sent successfully');
            }
          }
        }
        
        if (abTestMode) {
          const newResults = { ...abResults };
          if (templateToSend === 'A') newResults.a.sent = data.sent;
          else newResults.b.sent = data.sent;
          setAbResults(newResults);
          await setDoc(doc(db, 'ab_results', user.uid), newResults);
        }
      } else {
        setStatus(`❌ ${data.error}`);
        alert(`❌ Error: ${data.error || 'Failed to send emails'}`);
      }
    } catch (err) {
      console.error('Send error:', err);
      setStatus(`❌ ${err.message || 'Failed to send'}`);
      alert(`❌ ${err.message || 'Failed to send emails'}`);
    } finally {
      setIsSending(false);
    }
  };
  
  // ✅ HANDLE SEND TO NEW LEADS WITH STATUS UPDATE
  const handleSendToNewLeads = async () => {
    if (!user?.uid) {
      alert('Please sign in first.');
      return;
    }
    
    const newLeads = getNewLeads();
    if (newLeads.length === 0) {
      alert('✅ No new leads to email. All contacts have already been reached out to.');
      return;
    }
    
    // Check daily limit
    const remainingQuota = 500 - dailyEmailCount;
    if (remainingQuota <= 0) {
      alert(`⚠️ Daily email limit reached (500 emails/day). ${dailyEmailCount} emails sent today. Please try again tomorrow.`);
      return;
    }
    
    const leadsToSend = newLeads.slice(0, Math.min(remainingQuota, newLeads.length));
    const potentialValue = Math.round((leadsToSend.length * 0.15 * 5000) / 1000);
    
    const confirmMsg = `🚀 Smart New Lead Outreach
` +
      `📊 ${leadsToSend.length} new leads ready (${newLeads.length} total available)
` +
      `📈 Prioritized by lead quality for maximum business value
` +
      `💰 Estimated potential value: $${potentialValue}k
` +
      `📧 Daily quota: ${dailyEmailCount}/500 (${remainingQuota} remaining today)
` +
      `✅ Prevents duplicates & spam automatically
` +
      `🎯 Only contacts never emailed before
` +
      `Send to ${leadsToSend.length} leads now?`;
    
    if (!confirm(confirmMsg)) return;
    if (!templateA.subject?.trim()) {
      alert('Email subject is required.');
      return;
    }
    
    setIsSending(true);
    setStatus('Getting Gmail access...');
    
    try {
      const accessToken = await requestGmailToken();
      setStatus(`Sending to ${leadsToSend.length} new leads...`);
      
      // Prepare email images
      const imagesWithBase64 = await Promise.all(
        emailImages.map(async (img, index) => {
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(img.file);
          });
          return {
            cid: img.cid,
            mimeType: img.file.type,
            base64,
            placeholder: img.placeholder
          };
        })
      );
      
      // ✅ UPDATE STATUS FOR ALL NEW LEADS BEFORE SENDING
      for (const lead of leadsToSend) {
        if (lead.email && contactStatuses[lead.email] === 'new') {
          await updateContactStatus(lead.email, 'contacted', 'Smart outreach campaign initiated');
        }
      }
      
      const res = await fetch('/api/send-new-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: leadsToSend,
          senderName,
          fieldMappings,
          accessToken,
          template: templateA,
          userId: user.uid,
          emailImages: imagesWithBase64
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setStatus(`✅ ${data.sent}/${data.total} emails sent to new leads!`);
        setDailyEmailCount(data.dailyCount || dailyEmailCount + data.sent);
        
        const successMsg = `✅ Successfully sent ${data.sent} emails!
` +
          `📊 Stats:
` +
          `  • Sent: ${data.sent}
` +
          `  • Failed: ${data.failed || 0}
` +
          `  • Skipped (already sent): ${data.skipped || 0}
` +
          `  • Daily count: ${data.dailyCount}/500
` +
          `  • Remaining today: ${data.remainingToday}
` +
          `💰 Estimated value: $${Math.round((data.sent * 0.15 * 5000) / 1000)}k`;
        alert(successMsg);
        
        // ✅ UPDATE STATUS FOR SUCCESSFULLY SENT EMAILS
        if (data.sentEmails && Array.isArray(data.sentEmails)) {
          for (const email of data.sentEmails) {
            const contactId = email.toLowerCase().trim();
            if (contactStatuses[contactId] === 'new') {
              await updateContactStatus(contactId, 'contacted', 'Email sent in smart outreach campaign');
            }
          }
        }
        
        // Reload sent leads to update UI
        await loadSentLeads();
        await loadDailyEmailCount();
      } else {
        if (res.status === 429) {
          alert(`⚠️ Daily limit reached!
${data.error}
Daily count: ${data.dailyCount}/${data.limit}`);
          setDailyEmailCount(data.dailyCount || 500);
        } else {
          alert(`❌ Error: ${data.error || 'Failed to send emails'}`);
        }
        setStatus(`❌ ${data.error || 'Failed'}`);
      }
    } catch (err) {
      console.error('Send new leads error:', err);
      alert(`❌ Error: ${err.message || 'Failed to send emails'}`);
      setStatus(`❌ ${err.message || 'Error'}`);
    } finally {
      setIsSending(false);
    }
  };
  
  // ✅ HANDLE WHATSAPP CLICK WITH STATUS UPDATE
  const handleWhatsAppClick = useCallback(async (contact) => {
    if (contact.status === 'new') {
      await updateContactStatus(contact.contactId, 'contacted', 'WhatsApp message opened');
    }
  }, [updateContactStatus]);
  
  // ✅ HANDLE SMS SEND WITH STATUS UPDATE
  const handleSendSMS = async (contact) => {
    if (!user?.uid) return;
    
    // ✅ UPDATE STATUS BEFORE SENDING
    if (contact.status === 'new') {
      await updateContactStatus(contact.contactId, 'contacted', 'SMS outreach initiated');
    }
    
    const confirmed = confirm(`Send SMS to ${contact.business} at +${contact.phone}?`);
    if (!confirmed) return;
    
    try {
      const message = renderPreviewText(
        smsTemplate,
        { business_name: contact.business, address: contact.address || '', phone_raw: contact.phone },
        fieldMappings,
        senderName
      );
      
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: contact.phone,
          message,
          businessName: contact.business,
          userId: user.uid
        })
      });
      
      const data = await response.json();
      if (response.ok) {
        alert(`✅ SMS sent to ${contact.business}!`);
        const contactKey = contact.email || contact.phone;
        setLastSent(prev => ({ ...prev, [contactKey]: new Date().toISOString() }));
        
        // ✅ UPDATE STATUS IF NOT ALREADY CONTACTED
        if (!['contacted', 'engaged', 'replied'].includes(contact.status)) {
          await updateContactStatus(contact.contactId, 'contacted', 'SMS sent successfully');
        }
      } else {
        alert(`❌ SMS failed: ${data.error}`);
      }
    } catch (error) {
      console.error('SMS send error:', error);
      alert(`❌ Failed to send SMS: ${error.message}`);
    }
  };
  
  // ✅ SETTINGS LOADING (INCLUDES STATUS PREFERENCES)
  const loadSettings = async (userId) => {
    try {
      const docRef = doc(db, 'users', userId, 'settings', 'templates');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setSenderName(data.senderName || 'Team');
        setTemplateA(data.templateA || DEFAULT_TEMPLATE_A);
        setTemplateB(data.templateB || DEFAULT_TEMPLATE_B);
        setWhatsappTemplate(data.whatsappTemplate || DEFAULT_WHATSAPP_TEMPLATE);
        setSmsTemplate(data.smsTemplate || DEFAULT_SMS_TEMPLATE);
        setInstagramTemplate(data.instagramTemplate || instagramTemplate);
        setTwitterTemplate(data.twitterTemplate || twitterTemplate);
        setFollowUpTemplates(data.followUpTemplates || followUpTemplates);
        setFieldMappings(data.fieldMappings || {});
        setAbTestMode(data.abTestMode || false);
        setSmsConsent(data.smsConsent || false);
        setStatusFilter(data.statusFilter || 'all');
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }
  };
  
  // ✅ SETTINGS SAVING (INCLUDES STATUS PREFERENCES)
  const saveSettings = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'settings', 'templates');
      await setDoc(docRef, {
        senderName,
        templateA,
        templateB,
        whatsappTemplate,
        smsTemplate,
        instagramTemplate,
        twitterTemplate,
        followUpTemplates,
        fieldMappings,
        abTestMode,
        smsConsent,
        statusFilter // ✅ Save current status filter preference
      }, { merge: true });
    } catch (error) {
      console.warn('Failed to save settings:', error);
    }
  }, [user?.uid, senderName, templateA, templateB, whatsappTemplate, smsTemplate, instagramTemplate, twitterTemplate, followUpTemplates, fieldMappings, abTestMode, smsConsent, statusFilter]);
  
  // ✅ AUTH & DATA LOADING EFFECT
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        loadSettings(user.uid);
        loadClickStats();
        loadDeals(); // Still used for pipeline value calculation
        loadAbResults();
        loadRepliedAndFollowUp();
        loadDailyEmailCount();
        loadSendTimeOptimization();
        // ✅ LOAD CONTACTS FROM FIRESTORE
        loadContactsFromFirestore(user.uid);
      } else {
        setUser(null);
        setWhatsappLinks([]);
        setContactStatuses({});
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, [loadContactsFromFirestore]);
  
  // ✅ AUTO-SAVE SETTINGS WITH DEBOUNCE
  useEffect(() => {
    if (!user?.uid) return;
    const handler = setTimeout(() => saveSettings(), 1500);
    return () => clearTimeout(handler);
  }, [saveSettings, user?.uid, statusFilter]);
  
  // ✅ OTHER EXISTING EFFECTS AND FUNCTIONS
  const handleSmartCall = (contact) => {
    if (contact.dealStage === 'replied' || contact.leadScore >= 80) {
      handleTwilioCall(contact, 'bridge');
    } else if (contact.followUpCount >= 2) {
      handleTwilioCall(contact, 'voicemail');
    } else {
      handleTwilioCall(contact, 'interactive'); // IVR
    }
  };
  
  // ✅ Social Handle Generator
  const generateSocialHandle = (businessName, platform) => {
    if (!businessName) return null;
    let handle = businessName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 30);
    return handle;
  };
  
  // ✅ LinkedIn Handler - Opens search or direct profile if available
  const handleOpenLinkedIn = (contact, type = 'company') => {
    if (!contact.business) return;
    let url;
    if (type === 'company' && contact.linkedin_company) {
      url = contact.linkedin_company;
    } else if (type === 'ceo' && contact.linkedin_ceo) {
      url = contact.linkedin_ceo;
    } else if (type === 'founder' && contact.linkedin_founder) {
      url = contact.linkedin_founder;
    } else {
      // Fallback: search for the business name on LinkedIn
      const query = encodeURIComponent(contact.business);
      url = `https://www.linkedin.com/search/results/companies/?keywords=${query}`;
    }
    window.open(url, '_blank');
  };
  
  // ✅ SMART SOCIAL OUTREACH STRATEGY
  const getSocialOutreachStrategy = (link) => {
    // Determine best engagement strategy based on available data
    const strategies = [];
    // LinkedIn - Direct professional outreach (highest priority)
    if (link.linkedin_company || link.linkedin_ceo) {
      strategies.push({
        type: 'linkedin',
        priority: 1,
        action: 'Connect & Engage',
        description: 'Send connection request with personalized message'
      });
    }
    // Email - Most direct (priority based on confidence)
    if (link.email_primary) {
      const confidence = link.contact_confidence;
      strategies.push({
        type: 'email',
        priority: confidence === 'High' ? 1 : confidence === 'Medium' ? 2 : 3,
        action: 'Send Email',
        description: `Email outreach (${confidence} confidence)`
      });
    }
    // Twitter/X - For thought leaders & B2B
    if (link.twitter) {
      strategies.push({
        type: 'twitter',
        priority: 2,
        action: 'Follow & Engage',
        description: 'Follow, like recent posts, comment with value'
      });
    }
    // YouTube - For content creators & channels
    if (link.youtube) {
      strategies.push({
        type: 'youtube',
        priority: 2,
        action: 'Subscribe & Comment',
        description: 'Subscribe, comment on recent videos'
      });
    }
    // Instagram - For visual/consumer brands
    if (link.instagram) {
      strategies.push({
        type: 'instagram',
        priority: 3,
        action: 'Follow & Like',
        description: 'Follow account, like posts, engage authentically'
      });
    }
    // Facebook - For established businesses
    if (link.facebook) {
      strategies.push({
        type: 'facebook',
        priority: 3,
        action: 'Like & Follow',
        description: 'Like page, follow, engage with recent posts'
      });
    }
    // TikTok - For younger/trendy brands
    if (link.tiktok) {
      strategies.push({
        type: 'tiktok',
        priority: 4,
        action: 'Follow & Like',
        description: 'Follow account, like trending content'
      });
    }
    return strategies.sort((a, b) => a.priority - b.priority);
  };
  
  // ✅ Copy username to clipboard helper
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    alert(`✅ Copied ${label}: ${text}`);
  };
  
  // ✅ INTELLIGENT FOLLOW-UP LOGIC: CONTACT FREQUENCY RULES + ENGAGEMENT DECAY
  // ✅ Determine if a contact is safe to email (prevents spam)
  const isSafeToFollowUp = (email) => {
    if (!email) return false;
    const daysSinceSent = lastSent[email] ?
      (new Date() - new Date(lastSent[email])) / (1000 * 60 * 60 * 24) : 999;
    const followUpCount = followUpHistory[email]?.count || 0;
    const hasReplied = repliedLeads[email];
    // Rules to determine if safe to follow up
    const rules = {
      isWaitingForReply: !hasReplied && daysSinceSent >= 2,
      notOverContacted: followUpCount < 3, // Max 3 follow-ups
      notTooRecent: daysSinceSent >= 2, // Wait at least 2 days
      withinCampaignWindow: daysSinceSent <= 30 // Don't email after 30 days
    };
    return rules.isWaitingForReply && rules.notOverContacted && rules.notTooRecent && rules.withinCampaignWindow;
  };
  
  // ✅ Calculate optimal follow-up for each contact
  const getOptimalFollowUpStrategy = (email) => {
    const daysSinceSent = lastSent[email] ?
      (new Date() - new Date(lastSent[email])) / (1000 * 60 * 60 * 24) : 999;
    const followUpCount = followUpHistory[email]?.count || 0;
    const score = leadScores[email] || 50;
    // Optimal timing by days since contact
    if (daysSinceSent < 2) {
      return { optimalDay: 2, reason: 'Too soon - let settle', templateType: 'none' };
    }
    if (daysSinceSent >= 2 && daysSinceSent < 5) {
      return { optimalDay: 2, reason: '2-5 days: First follow-up (gentle)', templateType: 'soft' };
    }
    if (daysSinceSent >= 5 && daysSinceSent < 7) {
      return { optimalDay: 5, reason: '5-7 days: Value-first follow-up', templateType: 'aggressive' };
    }
    if (daysSinceSent >= 7 && daysSinceSent < 14) {
      return { optimalDay: 7, reason: '7-14 days: Final push (breakup)', templateType: 'urgent' };
    }
    if (daysSinceSent >= 14 && daysSinceSent <= 30) {
      return { optimalDay: 14, reason: '14+ days: Win-back attempt', templateType: 'question' };
    }
    return { optimalDay: 999, reason: 'Campaign window closed', templateType: 'none' };
  };
  
  // ✅ Get contacts safe for follow-up with engagement scoring
  const getSafeFollowUpCandidates = () => {
    const candidates = whatsappLinks
      .filter(contact => contact.email && isSafeToFollowUp(contact.email))
      .map(contact => {
        const strategy = getOptimalFollowUpStrategy(contact.email);
        const followUpCount = followUpHistory[contact.email]?.count || 0;
        const daysSinceSent = lastSent[contact.email] ?
          (new Date() - new Date(lastSent[contact.email])) / (1000 * 60 * 60 * 24) : 999;
        return {
          ...contact,
          strategy,
          followUpCount,
          daysSinceSent,
          urgencyScore: 100 - (daysSinceSent * 2), // Earlier = more urgent
          safetyScore: (3 - followUpCount) * 33.33 // Fewer follow-ups = safer
        };
      })
      .sort((a, b) => b.urgencyScore - a.urgencyScore);
    return candidates;
  };
  
  // ✅ Calculate engagement health for a contact
  const getEngagementHealth = (email) => {
    const daysSinceSent = lastSent[email] ?
      (new Date() - new Date(lastSent[email])) / (1000 * 60 * 60 * 24) : 999;
    const score = leadScores[email] || 50;
    const hasReplied = repliedLeads[email];
    if (hasReplied) return { status: '✅ Engaged', color: 'green', urgency: 'low' };
    if (daysSinceSent < 2) return { status: '⏳ Fresh', color: 'blue', urgency: 'low' };
    if (daysSinceSent < 5) return { status: '🟡 Warming', color: 'yellow', urgency: 'medium' };
    if (daysSinceSent < 7) return { status: '⚠️ Cooling', color: 'orange', urgency: 'high' };
    if (daysSinceSent <= 30) return { status: '🔴 Cold', color: 'red', urgency: 'critical' };
    return { status: '❌ Dead', color: 'gray', urgency: 'none' };
  };
  
  // ✅ ADVANCED BUSINESS LOGIC: PREDICTIVE SCORING & ANALYTICS
  // ✅ Calculate lead quality with multiple factors
  const calculateLeadQualityScore = (contact) => {
    let score = 50;
    const contactKey = contact.email || contact.phone;
    // 1. EMAIL ENGAGEMENT FACTORS
    if (contact.email) {
      score += 15;
      if (leadScores[contact.email] && leadScores[contact.email] >= 75) score += 15;
    }
    // 2. PHONE PRESENCE & DIALING CAPABILITY
    if (contact.phone && formatForDialing(contact.phone)) score += 10;
    // 3. SOCIAL MEDIA PRESENCE (Multi-channel strategy)
    const socialChannels = [contact.twitter, contact.instagram, contact.facebook, contact.youtube, contact.linkedin_company].filter(Boolean).length;
    score += Math.min(15, socialChannels * 3);
    // 4. CONTACT INFORMATION QUALITY
    if (contact.contact_confidence === 'High') score += 10;
    else if (contact.contact_confidence === 'Medium') score += 5;
    // 5. DECISION MAKER TARGETING
    if (contact.linkedin_ceo || contact.linkedin_founder) score += 10;
    if (contact.decision_maker_found === 'Yes') score += 8;
    // 6. ENGAGEMENT HISTORY
    if (repliedLeads[contact.email]) score += 25;
    if (lastSent[contactKey]) {
      const daysSinceSent = (new Date() - new Date(lastSent[contactKey])) / (1000 * 60 * 60 * 24);
      if (daysSinceSent > 7 && daysSinceSent <= 14) score += 5;
    }
    // 7. COMPANY SIZE (STRATEGIC FIT)
    if (contact.company_size_indicator === 'small') score += 5;
    if (contact.company_size_indicator === 'medium') score += 10;
    if (contact.company_size_indicator === 'enterprise') score += 12;
    // 8. WEBSITE & ONLINE PRESENCE
    if (contact.website) score += 5;
    if (contact.contact_page_found === 'Yes') score += 5;
    return Math.min(100, Math.max(0, score));
  };
  
  // ✅ CONVERSION FUNNEL ANALYSIS
  const calculateConversionFunnel = () => {
    const stages = {
      'sent': whatsappLinks.length,
      'opened': Math.round(whatsappLinks.length * 0.35),
      'clicked': Math.round(whatsappLinks.length * 0.12),
      'replied': Object.values(repliedLeads).filter(Boolean).length,
      'demo': Math.round(Object.values(repliedLeads).filter(Boolean).length * 0.40),
      'closed': Math.round(Object.values(repliedLeads).filter(Boolean).length * 0.15)
    };
    return {
      stages,
      conversionRate: {
        openRate: Math.round((stages.opened / stages.sent) * 100),
        clickRate: Math.round((stages.clicked / stages.sent) * 100),
        replyRate: Math.round((stages.replied / stages.sent) * 100),
        demoRate: Math.round((stages.demo / stages.replied) * 100 || 0),
        closeRate: Math.round((stages.closed / stages.demo) * 100 || 0)
      }
    };
  };
  
  // ✅ REVENUE FORECASTING ENGINE
  const calculateRevenueForecasts = () => {
    const avgDealValue = 5000;
    const closeRate = 0.15;
    const demoToCloseRate = 0.40;
    const replyToDemoRate = 0.40;
    const replies = Object.values(repliedLeads).filter(Boolean).length;
    const demoOpportunities = Math.ceil(replies * replyToDemoRate);
    const expectedClosures = Math.ceil(demoOpportunities * demoToCloseRate);
    return {
      currentPipeline: replies * avgDealValue,
      demoOpportunities: demoOpportunities * avgDealValue,
      expectedMonthlyRevenue: expectedClosures * avgDealValue,
      expectedQuarterlyRevenue: expectedClosures * avgDealValue * 3,
      successMetrics: {
        replies,
        demoOpportunities,
        expectedClosures,
        expectedAnnualRunRate: expectedClosures * avgDealValue * 12
      }
    };
  };
  
  // ✅ LEAD SEGMENTATION FOR SMART TARGETING
  const segmentLeads = () => {
    const segments = {
      veryHot: [],
      hot: [],
      warm: [],
      cold: [],
      inactive: []
    };
    whatsappLinks.forEach(contact => {
      const score = leadScores[contact.email] || 0;
      const replied = repliedLeads[contact.email];
      const daysSinceSent = lastSent[contact.email] ?
        (new Date() - new Date(lastSent[contact.email])) / (1000 * 60 * 60 * 24) : 999;
      if (replied) {
        segments.veryHot.push(contact);
      } else if (score >= 80) {
        segments.hot.push(contact);
      } else if (score >= 60 && daysSinceSent <= 3) {
        segments.warm.push(contact);
      } else if (score >= 40 && daysSinceSent <= 7) {
        segments.cold.push(contact);
      } else {
        segments.inactive.push(contact);
      }
    });
    return segments;
  };
  
  // ✅ FILTERED AND SORTED CONTACTS
  const getFilteredAndSortedContacts = () => {
    let filtered = [...whatsappLinks];
    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(c =>
        c.business.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone?.includes(searchQuery.replace(/\D/g, ''))
      );
    }
    // Apply status filter
    if (contactFilter === 'replied') {
      filtered = filtered.filter(c => repliedLeads[c.email]);
    } else if (contactFilter === 'pending') {
      filtered = filtered.filter(c => !repliedLeads[c.email]);
    } else if (contactFilter === 'high-quality') {
      filtered = filtered.filter(c => (leadScores[c.email] || 0) >= 70);
    } else if (contactFilter === 'contacted') {
      filtered = filtered.filter(c => lastSent[c.email || c.phone]);
    }
    // Apply sorting
    if (sortBy === 'score') {
      filtered.sort((a, b) => (leadScores[b.email] || 0) - (leadScores[a.email] || 0));
    } else if (sortBy === 'recent') {
      filtered.sort((a, b) => new Date(lastSent[b.email || b.phone] || 0) - new Date(lastSent[a.email || a.phone] || 0));
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => a.business.localeCompare(b.business));
    }
    return filtered;
  };
  
  // ✅ Instagram Handler
  const handleOpenInstagram = (contact) => {
    if (!contact.business) return;
    const igHandle = generateSocialHandle(contact.business, 'instagram');
    if (igHandle) {
      window.open(`https://www.instagram.com/${igHandle}/`, '_blank');
    } else {
      window.open(`https://www.instagram.com/`, '_blank');
    }
  };
  
  // ✅ Twitter Handler
  const handleOpenTwitter = (contact) => {
    if (!contact.business) return;
    const twitterHandle = generateSocialHandle(contact.business, 'twitter');
    if (twitterHandle) {
      const tweetText = encodeURIComponent(`@${twitterHandle} ${renderPreviewText(
        twitterTemplate,
        { business_name: contact.business, address: contact.address || '' },
        fieldMappings,
        senderName
      )}`);
      window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, '_blank');
    } else {
      const query = encodeURIComponent(contact.business);
      window.open(`https://twitter.com/search?q=${query}&src=typed_query`, '_blank');
    }
  };
  
  // ✅ Handle Call
  const handleCall = (phone) => {
    if (!phone) return;
    const dialNumber = formatForDialing(phone) || phone.toString().replace(/\D/g, '');
    if (typeof window !== 'undefined') {
      if (/iPhone|Android/i.test(navigator.userAgent)) {
        window.location.href = `tel:${dialNumber}`;
      } else {
        window.open(`https://wa.me/${dialNumber}`, '_blank');
      }
    }
  };
  
  // ✅ Poll Call Status
  const pollCallStatus = (callId, businessName) => {
    let attempts = 0;
    const maxAttempts = 20;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const callDoc = await getDoc(doc(db, 'calls', callId));
        if (callDoc.exists()) {
          const callData = callDoc.data();
          const status = callData.status;
          setActiveCallStatus(prev => ({
            ...prev,
            status: status,
            duration: callData.duration || 0,
            answeredBy: callData.answeredBy || 'unknown',
            updatedAt: callData.updatedAt
          }));
          if (status === 'ringing') {
            setStatus(`📞 Ringing ${businessName}...`);
          } else if (status === 'in-progress' || status === 'answered') {
            setStatus(`✅ Call connected to ${businessName}!
Duration: ${callData.duration || 0}s
Answered by: ${callData.answeredBy || 'unknown'}`);
          } else if (status === 'completed') {
            setStatus(`✅ Call Completed!
Business: ${businessName}
Duration: ${callData.duration || 0}s
Answered by: ${callData.answeredBy || 'unknown'}
${callData.recordingUrl ? '\n🎙️ Recording available' : ''}`);
            clearInterval(interval);
          } else if (status === 'failed' || status === 'busy' || status === 'no-answer') {
            setStatus(`❌ Call ${status}
Business: ${businessName}
Reason: ${status.toUpperCase()}`);
            clearInterval(interval);
          }
        }
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setStatus(`⏱️ Status polling stopped after 2 minutes.
Check call history for final status.`);
        }
      } catch (error) {
        console.error('Poll error:', error);
      }
    }, 6000);
  };
  
  // ✅ Load Call History
  const loadCallHistory = async () => {
    if (!user?.uid) return;
    setLoadingCallHistory(true);
    try {
      const q = query(
        collection(db, 'calls'),
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const calls = [];
      snapshot.forEach(doc => {
        calls.push({ id: doc.id, ...doc.data() });
      });
      calls.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setCallHistory(calls);
      const total = calls.length;
      const completed = calls.filter(c => c.status === 'completed').length;
      const failed = calls.filter(c => c.status === 'failed').length;
      const avgDuration = calls.reduce((sum, c) => sum + (c.duration || 0), 0) / (total || 1);
      console.log('📊 Call Stats:', {
        total,
        completed,
        failed,
        avgDuration: Math.round(avgDuration),
        answeredByHuman: calls.filter(c => c.answeredBy === 'human').length,
        answeredByMachine: calls.filter(c => c.answeredBy?.includes('machine')).length
      });
    } catch (error) {
      console.error('Failed to load call history:', error);
      alert('Failed to load call history');
    } finally {
      setLoadingCallHistory(false);
    }
  };
  
  const getStatusBadge = (status) => {
    const badges = {
      'initiating': { bg: 'bg-blue-100', text: 'text-blue-800', label: '🔵 Initiating' },
      'queued': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '⏳ Queued' },
      'ringing': { bg: 'bg-purple-100', text: 'text-purple-800', label: '📞 Ringing' },
      'in-progress': { bg: 'bg-green-100', text: 'text-green-800', label: '✅ In Progress' },
      'answered': { bg: 'bg-green-100', text: 'text-green-800', label: '✅ Answered' },
      'completed': { bg: 'bg-green-200', text: 'text-green-900', label: '✅ Completed' },
      'failed': { bg: 'bg-red-100', text: 'text-red-800', label: '❌ Failed' },
      'busy': { bg: 'bg-orange-100', text: 'text-orange-800', label: '📵 Busy' },
      'no-answer': { bg: 'bg-gray-100', text: 'text-gray-800', label: '📞 No Answer' }
    };
    return badges[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
  };
  
  // ✅ SMS Handlers
  const handleOpenNativeSMS = (contact) => {
    if (!contact?.phone) return;
    const messageBody = renderPreviewText(
      smsTemplate,
      { business_name: contact.business, address: contact.address || '', phone_raw: contact.phone },
      fieldMappings,
      senderName
    );
    let formattedPhone = contact.phone.toString().replace(/\D/g, '');
    if (formattedPhone.startsWith('0') && formattedPhone.length >= 9) {
      formattedPhone = '94' + formattedPhone.slice(1);
    }
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }
    window.location.href = `sms:${formattedPhone}?body=${encodeURIComponent(messageBody)}`;
  };
  
  const handleSendBulkSMS = async () => {
    if (!user?.uid || whatsappLinks.length === 0) return;
    const confirmed = confirm(`Send SMS to ${whatsappLinks.length} contacts?`);
    if (!confirmed) return;
    let successCount = 0;
    setStatus('📤 Sending SMS batch...');
    for (const contact of whatsappLinks) {
      const phone = formatForDialing(contact.phone);
      if (!phone) continue;
      try {
        const message = renderPreviewText(
          smsTemplate,
          { business_name: contact.business, address: contact.address || '', phone_raw: contact.phone },
          fieldMappings,
          senderName
        );
        const response = await fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone,
            message,
            businessName: contact.business,
            userId: user.uid
          })
        });
        if (response.ok) {
          successCount++;
          const contactKey = contact.email || contact.phone;
          setLastSent(prev => ({ ...prev, [contactKey]: new Date().toISOString() }));
          if (dealStage[contactKey] === 'new') {
            updateDealStage(contactKey, 'contacted');
          }
        }
      } catch (error) {
        console.error(`SMS error for ${contact.business}:`, error);
      }
    }
    setStatus(`✅ SMS batch complete: ${successCount}/${whatsappLinks.length} sent.`);
    alert(`✅ SMS batch complete!
Sent: ${successCount}
Failed: ${whatsappLinks.length - successCount}`);
  };
  
  useEffect(() => {
    if (!csvContent) return;
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return;
    const headers = parseCsvRow(lines[0]).map(h => h.trim());
    let hot = 0, warm = 0;
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvRow(lines[i]);
      if (values.length !== headers.length) continue;
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      if (!isValidEmail(row.email)) continue;
      const quality = (row.lead_quality || '').trim() || 'HOT';
      if (quality === 'HOT') hot++;
      else if (quality === 'WARM') warm++;
    }
    if (leadQualityFilter === 'HOT') setValidEmails(hot);
    else if (leadQualityFilter === 'WARM') setValidEmails(warm);
    else setValidEmails(hot + warm);
  }, [leadQualityFilter, csvContent]);
  
  useEffect(() => {
    const updateDealsFromClicks = async () => {
      const updates = [];
      Object.entries(clickStats).forEach(([clid, data]) => {
        if (data.count > 0 && data.email) {
          updates.push(updateDoc(doc(db, 'deals', data.email), {
            stage: 'contacted',
            lastUpdate: new Date().toISOString()
          }));
        }
      });
      if (updates.length > 0) {
        await Promise.all(updates);
        loadDeals();
      }
    };
    if (Object.keys(clickStats).length > 0) {
      updateDealsFromClicks();
    }
  }, [clickStats, loadDeals]);
  
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files).slice(0, 3);
    const newImages = files.map((file, index) => {
      const preview = URL.createObjectURL(file);
      const cid = `img${index + 1}@massmailer`;
      return { file, preview, cid, placeholder: `{{image${index + 1}}}` };
    });
    setEmailImages(newImages);
  };
  
  const handleMappingChange = (varName, csvColumn) => {
    setFieldMappings(prev => ({ ...prev, [varName]: csvColumn }));
  };
  
  // ✅ Load daily email count
  const loadDailyEmailCount = async () => {
    if (!user?.uid) return;
    setLoadingDailyCount(true);
    try {
      const res = await fetch('/api/get-daily-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });
      const data = await res.json();
      if (res.ok) {
        setDailyEmailCount(data.count || 0);
      }
    } catch (err) {
      console.error('Load daily count error:', err);
    } finally {
      setLoadingDailyCount(false);
    }
  };
  
  // ✅ Get new leads (not yet emailed)
  const getNewLeads = () => {
    if (!whatsappLinks || whatsappLinks.length === 0) return [];
    // Create set of already-sent emails
    const sentEmailsSet = new Set();
    sentLeads.forEach(lead => {
      if (lead.email) {
        sentEmailsSet.add(lead.email.toLowerCase().trim());
      }
    });
    // Filter to only new leads with valid emails
    const newLeads = whatsappLinks
      .filter(contact => {
        if (!contact.email) return false;
        const email = contact.email.toLowerCase().trim();
        return !sentEmailsSet.has(email);
      })
      .map(contact => ({
        ...contact,
        email: contact.email.toLowerCase().trim()
      }));
    // Sort by lead quality/score for business value (highest first)
    return newLeads.sort((a, b) => {
      const scoreA = leadScores[a.email] || 50;
      const scoreB = leadScores[b.email] || 50;
      return scoreB - scoreA;
    });
  };
  
  // ✅ Data Loaders
  const loadAbResults = async () => {
    try {
      const q = query(collection(db, 'ab_results'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setAbResults(snapshot.docs[0].data());
      }
    } catch (e) {
      console.warn('AB results load failed:', e);
    }
  };
  
  const loadClickStats = async () => {
    try {
      const q = query(collection(db, 'clicks'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const stats = {};
      snapshot.forEach(doc => {
        stats[doc.id] = doc.data();
      });
      setClickStats(stats);
    } catch (e) {
      console.warn('Click stats load failed:', e);
    }
  };
  
  const loadDeals = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const q = query(collection(db, 'deals'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const stages = {};
      let totalValue = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        stages[data.email] = data.stage || 'new';
        if (data.stage !== 'won') totalValue += 5000;
      });
      setDealStage(stages);
      setPipelineValue(totalValue);
    } catch (e) {
      console.warn('Deals load failed:', e);
    }
  }, [user?.uid]);
  
  const loadRepliedAndFollowUp = async () => {
    try {
      const q = query(collection(db, 'sent_emails'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const repliedMap = {};
      const followUpMap = {};
      const now = new Date();
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.replied) repliedMap[data.to] = true;
        else if (data.followUpAt && new Date(data.followUpAt) <= now) {
          followUpMap[data.to] = true;
        }
      });
      setRepliedLeads(repliedMap);
      setFollowUpLeads(followUpMap);
    } catch (e) {
      console.warn('Replied/Follow-up load failed:', e);
    }
  };
  
  const updateDealStage = async (email, stage) => {
    try {
      const dealRef = doc(db, 'deals', email);
      await setDoc(dealRef, {
        userId: user.uid,
        email,
        stage,
        lastUpdate: new Date().toISOString(),
        value: 5000
      }, { merge: true });
      setDealStage(prev => ({ ...prev, [email]: stage }));
      if (stage === 'won') {
        setPipelineValue(prev => prev - 5000);
      } else if (dealStage[email] === 'won') {
        setPipelineValue(prev => prev + 5000);
      }
    } catch (e) {
      console.error('Update deal error:', e);
    }
  };
  
  const checkForReplies = async () => {
    if (!user?.uid) return;
    setStatus('🔍 Checking for replies...');
    try {
      const accessToken = await requestGmailToken();
      const res = await fetch('/api/check-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, userId: user.uid })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`✅ Found ${data.repliedCount} new replies!`);
        loadDeals();
        loadRepliedAndFollowUp();
      } else {
        setStatus(`❌ Reply check failed: ${data.error}`);
      }
    } catch (err) {
      console.error('Check replies error:', err);
      setStatus(`❌ ${err.message}`);
    }
  };
  
  const loadSentLeads = async () => {
    if (!user?.uid) return;
    setLoadingSentLeads(true);
    try {
      const res = await fetch('/api/list-sent-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });
      const data = await res.json();
      if (res.ok) {
        setSentLeads(data.leads || []);
        // ✅ BUILD FOLLOW-UP HISTORY FROM LEADS
        const history = {};
        let replied = 0, followedUp = 0, readyForFU = 0, awaiting = 0;
        (data.leads || []).forEach(lead => {
          if (lead.replied) {
            replied++;
          }
          // ✅ TRACK ALL LEADS WITH FOLLOW-UP DATA (including 0 count for proper tracking)
          const followUpCount = lead.followUpCount || 0;
          if (followUpCount > 0) {
            followedUp++;
          }
          // ✅ Initialize history entry for all leads (even with 0 follow-ups)
          // This ensures eligibility checks work correctly
          history[lead.email] = {
            count: followUpCount,
            lastFollowUpAt: lead.lastFollowUpAt || null,
            dates: lead.followUpDates || []
          };
          const followUpAt = new Date(lead.followUpAt);
          const now = new Date();
          if (!lead.replied && followUpAt <= now) {
            readyForFU++;
          } else if (!lead.replied) {
            awaiting++;
          }
        });
        // ✅ Count interested leads (opens/clicks but no reply yet)
        const interested = (data.leads || []).filter(lead =>
          lead.seemsInterested && !lead.replied
        );
        setInterestedLeadsList(interested);
        setFollowUpHistory(history);
        setFollowUpStats({
          totalSent: data.leads?.length || 0,
          totalReplied: replied,
          readyForFollowUp: readyForFU,
          alreadyFollowedUp: followedUp,
          awaitingReply: awaiting,
          interestedLeads: interested.length
        });
        // ✅ Notify if old closed loops were deleted
        if (data.deletedCount && data.deletedCount > 0) {
          console.log(`🗑️ Cleaned up ${data.deletedCount} old closed loops (>30 days)`);
        }
        console.log('✅ Follow-up tracking loaded:', { followUpStats: { totalSent: data.leads?.length, totalReplied: replied }, history });
      } else {
        alert('Failed to load sent leads');
      }
    } catch (err) {
      console.error('Load sent leads error:', err);
      alert('Error loading sent leads');
    } finally {
      setLoadingSentLeads(false);
    }
  };
  
  const sendFollowUpWithToken = async (email, accessToken) => {
    if (!user?.uid || !email || !accessToken) {
      alert('Missing required data to send follow-up.');
      return;
    }
    // ✅ CRITICAL: HARD BLOCK if lead has replied (no override allowed)
    if (repliedLeads[email]) {
      alert(`❌ Cannot send follow-up: ${email} has already replied. Loop is closed.`);
      return;
    }
    // ✅ CRITICAL: HARD BLOCK if already sent 3+ follow-ups (closing the loop - no override)
    const history = followUpHistory[email];
    const followUpCount = history?.count || 0;
    if (followUpCount >= 3) {
      alert(
        `❌ Cannot send follow-up: ${email} has already received ${followUpCount} follow-ups (maximum reached).
` +
        `The loop has been closed. No further emails will be sent to prevent spam complaints.`
      );
      return;
    }
    try {
      const res = await fetch('/api/send-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          accessToken,
          userId: user.uid,
          senderName
        })
      });
      const data = await res.json();
      if (res.ok) {
        const isFinalFollowUp = data.followUpCount >= 3;
        alert(
          `✅ Follow-up #${data.followUpCount} sent to ${email}` +
          (isFinalFollowUp ? '\n⚠️ Loop closed - no further emails will be sent to this lead.' : '')
        );
        // ✅ UPDATE LOCAL STATE IMMEDIATELY for better UX
        setFollowUpHistory(prev => ({
          ...prev,
          [email]: {
            count: data.followUpCount || (prev[email]?.count || 0) + 1,
            lastFollowUpAt: new Date().toISOString(),
            dates: [...(prev[email]?.dates || []), new Date().toISOString()],
            loopClosed: isFinalFollowUp
          }
        }));
        // ✅ RELOAD FROM SERVER - ENSURES PERFECT ACCURACY
        await loadSentLeads();
        await loadRepliedAndFollowUp();
        await loadDeals();
      } else {
        // ✅ Handle specific error codes from backend
        if (data.code === 'ALREADY_REPLIED' || data.code === 'MAX_FOLLOWUPS_REACHED') {
          alert(`❌ ${data.error}
This prevents duplicate emails and spam complaints.`);
        } else {
          alert(`❌ Follow-up failed: ${data.error || 'Unknown error'}`);
        }
      }
    } catch (err) {
      console.error('Follow-up send error:', err);
      alert(`❌ Error: ${err.message || 'Failed to send follow-up'}`);
    }
  };
  
  // ✅ 2026 Feature: Load Send Time Optimization
  const loadSendTimeOptimization = async () => {
    if (!user?.uid) return;
    try {
      const res = await fetch('/api/ai-send-time-optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });
      const data = await res.json();
      if (res.ok) {
        setSendTimeOptimization(data);
      }
    } catch (err) {
      console.error('Send time optimization error:', err);
    }
  };
  
  // ✅ 2026 Feature: Calculate Predictive Score for Lead
  const calculatePredictiveScore = async (leadEmail, leadData) => {
    if (!user?.uid || predictiveScores[leadEmail]) return; // Cache results
    try {
      const res = await fetch('/api/predictive-lead-scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          leadData: {
            ...leadData,
            email: leadEmail
          }
        })
      });
      const data = await res.json();
      if (res.ok) {
        setPredictiveScores(prev => ({
          ...prev,
          [leadEmail]: data
        }));
      }
    } catch (err) {
      console.error('Predictive scoring error:', err);
    }
  };
  
  // ✅ 2026 Feature: Analyze Reply Sentiment
  const analyzeReplySentiment = async (replyText, leadEmail) => {
    if (!replyText) return;
    try {
      const res = await fetch('/api/sentiment-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyText, leadEmail })
      });
      const data = await res.json();
      if (res.ok) {
        setSentimentAnalysis(prev => ({
          ...prev,
          [leadEmail]: data
        }));
      }
    } catch (err) {
      console.error('Sentiment analysis error:', err);
    }
  };
  
  // ✅ 2026 Feature: Generate Smart Follow-up
  const generateSmartFollowUp = async (leadEmail, leadData, followUpNumber = 1) => {
    if (!user?.uid) return;
    try {
      const lead = sentLeads.find(l => l.email === leadEmail);
      const defaultTemplate = `${templateA.subject}\n${templateA.body}`;
      const res = await fetch('/api/smart-followup-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: leadData.business || leadEmail,
          leadBehavior: {
            opened: lead?.opened || false,
            openedCount: lead?.openedCount || 0,
            clicked: lead?.clicked || false,
            clickCount: lead?.clickCount || 0,
            replied: lead?.replied || false,
            interestScore: lead?.interestScore || 0,
            daysSinceSent: lead ? Math.floor((new Date() - new Date(lead.sentAt)) / (1000 * 60 * 60 * 24)) : 0
          },
          previousEmails: lead?.followUpCount || 0,
          defaultTemplate,
          followUpNumber
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSmartFollowUpSuggestions(prev => ({
          ...prev,
          [leadEmail]: data
        }));
        return data;
      }
    } catch (err) {
      console.error('Smart follow-up error:', err);
    }
    return null;
  };
  
  // ✅ AI Research Function - Cost-efficient individual research
  const researchCompany = async (companyName, companyWebsite, email) => {
    if (!user?.uid) {
      alert('Please sign in to use AI research');
      return;
    }
    setResearchingCompany(email);
    try {
      // Get default email template to extract general idea
      const defaultTemplate = `${templateA.subject}\n${templateA.body}`;
      const res = await fetch('/api/research-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          companyWebsite: companyWebsite || '',
          defaultEmailTemplate: defaultTemplate,
          userId: user.uid
        })
      });
      const data = await res.json();
      if (res.ok) {
        setResearchResults(prev => ({
          ...prev,
          [email]: data
        }));
        setShowResearchModal(true);
      } else {
        alert(`Research failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Research error:', err);
      alert(`Error: ${err.message || 'Failed to research company'}`);
    } finally {
      setResearchingCompany(null);
    }
  };
  
  const isEligibleForFollowUp = (lead) => {
    if (!lead || !lead.email || lead.replied) return false;
    const now = new Date();
    const followUpAt = new Date(lead.followUpAt);
    // ✅ Check if follow-up time has passed
    if (followUpAt > now) return false;
    // ✅ Check if already followed up too many times
    const followUpCount = followUpHistory[lead.email]?.count || lead.followUpCount || 0;
    if (followUpCount >= 3) return false;
    return true;
  };
  
  const sendMassFollowUp = async (accessToken) => {
    if (!user?.uid || !accessToken) return;
    const eligibleLeads = sentLeads.filter(isEligibleForFollowUp);
    const confirmed = confirm(`Send follow-up to all eligible leads (${eligibleLeads.length})?`);
    if (!confirmed) return;
    setIsSending(true);
    setStatus('📤 Sending mass follow-ups...');
    let successCount = 0;
    let errorCount = 0;
    for (const lead of eligibleLeads) {
      // ✅ Double-check eligibility before sending (state may have changed)
      if (!isEligibleForFollowUp(lead)) continue;
      // ✅ Check follow-up count one more time before sending
      const followUpCount = followUpHistory[lead.email]?.count || lead.followUpCount || 0;
      if (followUpCount >= 3) {
        console.warn(`Skipping ${lead.email}: already has ${followUpCount} follow-ups`);
        continue;
      }
      try {
        const res = await fetch('/api/send-followup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: lead.email,
            accessToken,
            userId: user.uid,
            senderName,
          })
        });
        const data = await res.json();
        if (res.ok) {
          successCount++;
          const isFinalFollowUp = data.followUpCount >= 3;
          // ✅ Update local state immediately for better UX
          setFollowUpHistory(prev => ({
            ...prev,
            [lead.email]: {
              count: data.followUpCount || followUpCount + 1,
              lastFollowUpAt: new Date().toISOString(),
              dates: [...(prev[lead.email]?.dates || []), new Date().toISOString()],
              loopClosed: isFinalFollowUp
            }
          }));
        } else {
          errorCount++;
          // ✅ Skip logging expected errors (already replied, max follow-ups)
          if (data.code !== 'ALREADY_REPLIED' && data.code !== 'MAX_FOLLOWUPS_REACHED') {
            console.error(`Failed to send to ${lead.email}:`, data.error);
          }
        }
      } catch (err) {
        errorCount++;
        console.error(`Error sending to ${lead.email}:`, err);
      }
    }
    setIsSending(false);
    alert(`✅ Sent follow-ups to ${successCount} leads.${errorCount > 0 ? ` ${errorCount} failed.` : ''}`);
    // ✅ Reload from server to ensure accuracy
    await loadSentLeads();
    await loadRepliedAndFollowUp();
  };
  
  const checkRepliesAndLoad = async () => {
    await checkForReplies();
    await loadSentLeads();
  };
  
  // ✅ Gmail Token
  const requestGmailToken = () => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') return reject('Browser only');
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) return reject('Google Client ID missing');
      if (!window.google?.accounts?.oauth2) return reject('Google not loaded');
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
        callback: (res) => res.access_token ? resolve(res.access_token) : reject('No token'),
        error_callback: reject
      });
      client.requestAccessToken();
    });
  };
  
  if (loadingAuth || loadingContacts) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <div className="text-xl font-bold text-white">Loading your strategic outreach dashboard...</div>
          <div className="text-gray-400 mt-2">
            {loadingContacts ? 'Syncing contact database with Firestore...' : 'Authenticating your session...'}
          </div>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <button
          onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl text-lg font-bold shadow-lg transition transform hover:scale-105"
        >
          🔑 Sign in to Access Your B2B Growth Engine
        </button>
      </div>
    );
  }
  
  // ✅ SHOW ALL POSSIBLE VARIABLES + CSV COLUMNS
  const uiVars = [...new Set([
    ...extractTemplateVariables(templateA.subject),
    ...extractTemplateVariables(templateA.body),
    ...extractTemplateVariables(templateB.subject),
    ...extractTemplateVariables(templateB.body),
    ...extractTemplateVariables(whatsappTemplate),
    ...extractTemplateVariables(smsTemplate),
    ...extractTemplateVariables(instagramTemplate),
    ...extractTemplateVariables(twitterTemplate),
    'sender_name',
    ...emailImages.map(img => img.placeholder.replace(/{{|}}/g, '')),
    ...csvHeaders
  ])];
  
  const abSummary = abTestMode ? (
    <div className="bg-blue-50 p-3 rounded-lg mt-4">
      <h3 className="text-sm font-bold text-blue-800">📊 A/B Test Results</h3>
      <div className="flex justify-between text-xs mt-1">
        <span>Template A: {abResults.a.sent || 0} sent</span>
        <span>Template B: {abResults.b.sent || 0} sent</span>
      </div>
      <div className="text-xs text-blue-700 mt-1">
        Check back in 48h for open/click rates
      </div>
    </div>
  ) : null;
  
  // ✅ RENDER STATUS BADGE COMPONENT
  const StatusBadge = ({ status, small = false }) => {
    const statusDef = CONTACT_STATUSES.find(s => s.id === status) || CONTACT_STATUSES[0];
    const classes = `
      inline-flex items-center px-${small ? '1.5' : '2'} py-${small ? '0.5' : '1'} 
      rounded-full text-${small ? 'xs' : 'sm'} font-medium
      bg-${statusDef.color}-100 text-${statusDef.color}-800
      border border-${statusDef.color}-200
      transition-all duration-200
      hover:shadow-md hover:scale-[1.02]
    `;
    return (
      <span className={classes} title={statusDef.description}>
        {statusDef.label}
      </span>
    );
  };
  
  // ✅ RENDER STATUS DROPDOWN COMPONENT
  const StatusDropdown = ({ contact, compact = false }) => {
    const currentStatus = contact.status || 'new';
    const statusDef = CONTACT_STATUSES.find(s => s.id === currentStatus) || CONTACT_STATUSES[0];
    
    return (
      <div className={`relative group ${compact ? 'w-full' : ''}`}>
        <select
          value={currentStatus}
          onChange={(e) => handleStatusChange(contact, e.target.value)}
          className={`
            ${compact 
              ? 'w-full py-1 text-xs' 
              : 'py-1.5 px-2 text-sm font-medium'}
            appearance-none
            bg-${statusDef.color}-50 
            text-${statusDef.color}-800
            border border-${statusDef.color}-300
            rounded-lg
            focus:outline-none focus:ring-2 focus:ring-${statusDef.color}-500 focus:border-${statusDef.color}-500
            cursor-pointer
            transition-all duration-200
            hover:bg-${statusDef.color}-100
          `}
          title={`Current status: ${statusDef.description}`}
        >
          {CONTACT_STATUSES.map(status => {
            // Only show valid transitions
            if (currentStatus !== 'archived' && 
                currentStatus !== status.id && 
                !STATUS_TRANSITIONS[currentStatus]?.includes(status.id)) {
              return null;
            }
            return (
              <option 
                key={status.id} 
                value={status.id}
                className="bg-white text-gray-900 hover:bg-blue-50"
              >
                {status.label}
              </option>
            );
          })}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-${statusDef.color}-700">
          <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    );
  };
  
  // ✅ RENDER STATUS FILTER COMPONENT
  const StatusFilter = () => (
    <div className="bg-gray-800 p-4 sm:p-6 rounded-xl shadow border border-gray-700">
      <h2 className="text-lg font-bold mb-3 text-white flex items-center gap-2">
        <span>📊 Contact Status</span>
        <span className="text-xs bg-indigo-900/30 text-indigo-300 px-2 py-0.5 rounded">
          {getFilteredContacts().length}/{whatsappLinks.length}
        </span>
      </h2>
      
      <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
        {/* All Contacts Option */}
        <button
          onClick={() => setStatusFilter('all')}
          className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between ${
            statusFilter === 'all'
              ? 'bg-indigo-900/50 border border-indigo-500'
              : 'hover:bg-gray-700/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-400"></div>
            <span className="font-medium text-white">All Contacts</span>
          </div>
          <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
            {whatsappLinks.length}
          </span>
        </button>
        
        {/* Status Options */}
        {CONTACT_STATUSES.map(status => {
          const count = statusAnalytics.byStatus?.[status.id] || 0;
          if (count === 0 && status.id !== statusFilter) return null;
          
          return (
            <button
              key={status.id}
              onClick={() => setStatusFilter(status.id)}
              className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between ${
                statusFilter === status.id
                  ? `bg-${status.color}-900/50 border border-${status.color}-500`
                  : 'hover:bg-gray-700/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full bg-${status.color}-500`}></div>
                <span className="font-medium text-white">{status.label}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${
                statusFilter === status.id
                  ? `bg-${status.color}-900 text-${status.color}-300`
                  : 'bg-gray-700 text-gray-300'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* Re-engagement CTA */}
      {archivedContactsCount > 0 && statusFilter !== 'archived' && (
        <div className="mt-4 p-3 bg-amber-900/20 border border-amber-800/50 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium text-amber-300 flex items-center gap-1">
                <span>🗄️ {archivedContactsCount} archived contacts</span>
              </div>
              <p className="text-xs text-amber-200 mt-1">
                Contacts marked as irrelevant over 30 days ago. Re-engage for new campaigns?
              </p>
            </div>
            <button
              onClick={reengageArchivedContacts}
              className="mt-2 text-xs bg-amber-800 hover:bg-amber-700 text-white px-3 py-1 rounded font-medium transition"
            >
              🔄 Re-engage
            </button>
          </div>
        </div>
      )}
      
      {/* Status Analytics */}
      {statusFilter === 'all' && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <h3 className="text-sm font-bold text-indigo-300 mb-2">📈 Status Conversion</h3>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Contacted → Replied:</span>
              <span className="font-bold text-green-400">{statusAnalytics.conversionRates?.replied || 0}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Replied → Demo:</span>
              <span className="font-bold text-blue-400">{statusAnalytics.conversionRates?.demo || 0}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Demo → Closed Won:</span>
              <span className="font-bold text-purple-400">{statusAnalytics.conversionRates?.won || 0}%</span>
            </div>
            <div className="flex justify-between mt-2 pt-2 border-t border-gray-700">
              <span className="text-gray-400 font-medium">Total Pipeline Value:</span>
              <span className="font-bold text-yellow-400">
                ${Math.round(Object.values(statusAnalytics.revenueByStatus || {}).reduce((a,b) => a+b, 0)/1000)}k
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  
  // ✅ STATUS MODAL COMPONENT
  const StatusModal = () => (
    <div className={`fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 ${showStatusModal ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'} transition-all duration-300`}>
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden border-2 border-indigo-500/30">
        <div className="relative p-6 border-b border-gray-700/50 bg-gradient-to-r from-indigo-900/40 via-purple-900/40 to-pink-900/40">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 to-purple-600/10 backdrop-blur-xl"></div>
          <div className="relative flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                📝 Add Status Note
              </h2>
              <p className="text-sm text-indigo-200 mt-1">
                For: {selectedContactForStatus?.business}
              </p>
              <div className="mt-2">
                <StatusBadge status={selectedContactForStatus?.newStatus || 'new'} />
              </div>
            </div>
            <button
              onClick={() => setShowStatusModal(false)}
              className="text-gray-400 hover:text-white hover:bg-red-500/20 transition-all duration-200 text-2xl w-10 h-10 rounded-full flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Why are you changing the status? (Required)
            </label>
            <textarea
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder={`e.g., "Requested no further contact", "Scheduled demo for next Tuesday", "Deal closed at $5k"`}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              rows="4"
            />
            <p className="text-xs text-gray-500 mt-1">
              This note will be saved in the contact's history for your team
            </p>
          </div>
          
          <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-3">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="ml-2 text-xs text-amber-200">
                <strong>Business Impact:</strong> This status change will affect your pipeline reporting and automated follow-up sequences. Be specific for accurate forecasting.
              </p>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-gray-700/50 bg-gradient-to-r from-gray-800/30 to-gray-900/30 flex justify-end gap-3">
          <button
            onClick={() => setShowStatusModal(false)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={handleStatusModalSubmit}
            disabled={!statusNote.trim()}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              statusNote.trim()
                ? 'bg-indigo-700 hover:bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            Save Status Change
          </button>
        </div>
      </div>
    </div>
  );
  
  return (
    <div className="min-h-screen bg-gray-900 text-gray-200">
      <Head>
        <title>B2B Growth Engine | Strategic Outreach</title>
      </Head>
      
      <header className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <span>B2B Growth Engine</span>
            {archivedContactsCount > 0 && (
              <span className="text-xs bg-amber-900 text-amber-300 px-2 py-0.5 rounded-full">
                🗄️ {archivedContactsCount} archived
              </span>
            )}
          </h1>
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                loadCallHistory();
                setShowCallHistoryModal(true);
              }}
              className="text-xs sm:text-sm bg-green-700 hover:bg-green-600 text-white px-2 sm:px-3 py-1.5 rounded transition"
            >
              📞 Call History
            </button>
            <button
              onClick={() => {
                loadSentLeads();
                setShowFollowUpModal(true);
              }}
              className="text-xs sm:text-sm bg-indigo-700 hover:bg-indigo-600 text-white px-2 sm:px-3 py-1.5 rounded transition"
            >
              📬 Reply Center
            </button>
            <button
              onClick={() => setShowAdvancedAnalytics(!showAdvancedAnalytics)}
              className="text-xs sm:text-sm bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white px-2 sm:px-3 py-1.5 rounded font-medium transition"
            >
              🤖 AI Analytics
            </button>
            <button
              onClick={() => router.push('/format')}
              className="text-xs sm:text-sm bg-amber-700 hover:bg-amber-600 text-white px-2 sm:px-3 py-1.5 rounded transition"
            >
              🔥 Scrape Leads
            </button>
            <button
              onClick={() => signOut(auth)}
              className="text-xs sm:text-sm text-gray-300 hover:text-white px-2 sm:px-3 py-1.5 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {/* ✅ TOP ANALYTICS DASHBOARD WITH STATUS INTEGRATION */}
        {whatsappLinks.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-3">
              {/* Total Contacts */}
              <div className="bg-gradient-to-br from-blue-900 to-blue-800 p-3 sm:p-4 rounded-lg shadow border border-blue-700 hover:border-blue-600 transition">
                <div className="text-xs text-blue-300 font-semibold">📊 Total Contacts</div>
                <div className="text-2xl sm:text-3xl font-bold text-white mt-1">{whatsappLinks.length}</div>
                <div className="text-xs text-blue-200 mt-1">in database</div>
              </div>
              
              {/* Active Pipeline */}
              <div className="bg-gradient-to-br from-green-900 to-green-800 p-3 sm:p-4 rounded-lg shadow border border-green-700 hover:border-green-600 transition">
                <div className="text-xs text-green-300 font-semibold">💡 Active Pipeline</div>
                <div className="text-2xl sm:text-3xl font-bold text-white mt-1">
                  ${(statusAnalytics.revenueByStatus?.demo_scheduled + 
                     statusAnalytics.revenueByStatus?.proposal_sent + 
                     statusAnalytics.revenueByStatus?.negotiation || 0) / 1000}k
                </div>
                <div className="text-xs text-green-200 mt-1">potential value</div>
              </div>
              
              {/* Replied */}
              <div className="bg-gradient-to-br from-emerald-900 to-emerald-800 p-3 sm:p-4 rounded-lg shadow border border-emerald-700 hover:border-emerald-600 transition">
                <div className="text-xs text-emerald-300 font-semibold">✅ Replied</div>
                <div className="text-2xl sm:text-3xl font-bold text-white mt-1">{statusAnalytics.byStatus?.replied || 0}</div>
                <div className="text-xs text-emerald-200 mt-1">{statusAnalytics.conversionRates?.replied || 0}% of contacted</div>
              </div>
              
              {/* Demo Scheduled */}
              <div className="bg-gradient-to-br from-purple-900 to-purple-800 p-3 sm:p-4 rounded-lg shadow border border-purple-700 hover:border-purple-600 transition">
                <div className="text-xs text-purple-300 font-semibold">📅 Demos Booked</div>
                <div className="text-2xl sm:text-3xl font-bold text-white mt-1">{statusAnalytics.byStatus?.demo_scheduled || 0}</div>
                <div className="text-xs text-purple-200 mt-1">{statusAnalytics.conversionRates?.demo || 0}% conversion</div>
              </div>
              
              {/* Closed Won */}
              <div className="bg-gradient-to-br from-amber-900 to-amber-800 p-3 sm:p-4 rounded-lg shadow border border-amber-700 hover:border-amber-600 transition">
                <div className="text-xs text-amber-300 font-semibold">💰 Closed Won</div>
                <div className="text-2xl sm:text-3xl font-bold text-white mt-1">{statusAnalytics.byStatus?.closed_won || 0}</div>
                <div className="text-xs text-amber-200 mt-1">${statusAnalytics.revenueByStatus?.closed_won ? Math.round(statusAnalytics.revenueByStatus.closed_won/1000) : 0}k revenue</div>
              </div>
              
              {/* Needs Follow-up */}
              <div className="bg-gradient-to-br from-rose-900 to-rose-800 p-3 sm:p-4 rounded-lg shadow border border-rose-700 hover:border-rose-600 transition">
                <div className="text-xs text-rose-300 font-semibold">⏳ Needs Follow-up</div>
                <div className="text-2xl sm:text-3xl font-bold text-white mt-1">
                  {statusAnalytics.byStatus?.contacted + 
                   statusAnalytics.byStatus?.engaged + 
                   statusAnalytics.byStatus?.replied + 
                   statusAnalytics.byStatus?.demo_scheduled + 
                   statusAnalytics.byStatus?.proposal_sent + 
                   statusAnalytics.byStatus?.negotiation || 0}
                </div>
                <div className="text-xs text-rose-200 mt-1">require attention</div>
              </div>
              
              {/* Action Button */}
              <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 p-3 sm:p-4 rounded-lg shadow border border-indigo-700 hover:border-indigo-600 transition flex flex-col justify-center">
                <button
                  onClick={() => setShowDetailedAnalytics(!showDetailedAnalytics)}
                  className="w-full text-xs sm:text-sm font-bold bg-indigo-700 hover:bg-indigo-600 text-white py-2 rounded transition"
                >
                  {showDetailedAnalytics ? '✕ Hide Analytics' : '🧠 View Analytics'}
                </button>
              </div>
            </div>
            
            {/* STATUS FILTER BAR - MOBILE OPTIMIZED */}
            <div className="mt-4 bg-gray-800/50 rounded-xl p-3 border border-gray-700">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">FilterWhere:</span>
                  <div className="hidden sm:block">
                    <StatusFilter />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-300 hidden sm:block">Showing:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Statuses</option>
                    {CONTACT_STATUSES.map(status => (
                      <option key={status.id} value={status.id}>
                        {status.label} ({statusAnalytics.byStatus?.[status.id] || 0})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* MOBILE STATUS FILTER */}
              <div className="sm:hidden mt-3">
                <StatusFilter />
              </div>
            </div>
          </div>
        )}
        
        {/* MAIN CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* LEFT PANEL - STATUS FILTER PROMINENT */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-6">
            <StatusFilter />
            
            {/* CSV UPLOAD SECTION */}
            <div className="bg-gray-800 p-4 sm:p-6 rounded-xl shadow border border-gray-700">
              <h2 className="text-lg sm:text-xl font-bold mb-4 text-white">1. Upload Leads CSV</h2>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded"
              />
              <p className="text-xs text-gray-400 mt-2">
                Contacts automatically saved to Firestore database with status tracking
              </p>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1 text-gray-200">
                  Target Lead Quality
                </label>
                <select
                  value={leadQualityFilter}
                  onChange={(e) => setLeadQualityFilter(e.target.value)}
                  className="w-full p-1 bg-gray-700 text-white border border-gray-600 rounded text-sm"
                >
                  <option value="HOT">🔥 HOT Leads Only</option>
                  <option value="WARM">📈 WARM Leads Only</option>
                  <option value="all">💥 All Leads</option>
                </select>
                <p className="text-xs text-green-400 mt-1">
                  {validEmails} {leadQualityFilter} leads ready
                </p>
              </div>
              <div className="mt-3">
                <label className="flex items-center text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={smsConsent}
                    onChange={(e) => setSmsConsent(e.target.checked)}
                    className="mr-2"
                  />
                  SMS Consent (for compliant outreach)
                </label>
              </div>
            </div>
            
            {/* SEARCH & FILTER */}
            {whatsappLinks.length > 0 && (
              <div className="bg-gray-800 p-4 sm:p-6 rounded-xl shadow border border-gray-700">
                <h2 className="text-lg font-bold mb-3 text-white">🔍 Smart Contact Search</h2>
                <input
                  type="text"
                  placeholder="Search by name, email, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded mb-2 text-sm"
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={contactFilter}
                    onChange={(e) => setContactFilter(e.target.value)}
                    className="flex-1 p-1 bg-gray-700 text-white border border-gray-600 rounded text-xs"
                  >
                    <option value="all">All Status</option>
                    <option value="replied">✅ Replied</option>
                    <option value="pending">⏳ Pending</option>
                    <option value="high-quality">⭐ High Quality</option>
                    <option value="contacted">📞 Contacted</option>
                  </select>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="flex-1 p-1 bg-gray-700 text-white border border-gray-600 rounded text-xs"
                  >
                    <option value="score">Score ↓</option>
                    <option value="recent">Recent</option>
                    <option value="name">A-Z</option>
                    <option value="status">Status</option>
                  </select>
                </div>
              </div>
            )}
            
            {/* FIELD MAPPINGS */}
            {csvHeaders.length > 0 && (
              <div className="bg-gray-800 p-4 sm:p-6 rounded-xl shadow border border-gray-700">
                <h2 className="text-lg font-bold mb-3 text-white">2. Map CSV Fields</h2>
                <p className="text-xs text-gray-400 mb-3">
                  Match CSV columns to template variables. Required fields marked with *
                </p>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {uiVars.map(varName => (
                    <div key={varName} className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${
                        varName === 'email' || varName === 'business_name' ? 'text-yellow-300' : 'text-gray-300'
                      }`}>
                        {varName}{varName === 'email' || varName === 'business_name' ? '*' : ''}
                      </span>
                      <select
                        value={fieldMappings[varName] || ''}
                        onChange={(e) => handleMappingChange(varName, e.target.value)}
                        className="flex-1 p-1 bg-gray-700 text-white border border-gray-600 rounded text-xs"
                      >
                        <option value="">-- Select Column --</option>
                        {csvHeaders.map(header => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-green-400 mt-2">
                  ✅ Auto-mapped common fields. Adjust if needed.
                </p>
              </div>
            )}
          </div>
          
          {/* MIDDLE PANEL - EMAIL/WHATSAPP/SMS TEMPLATES */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-6">
            {/* SENDER NAME */}
            <div className="bg-gray-800 p-4 sm:p-6 rounded-xl shadow border border-gray-700">
              <h2 className="text-lg font-bold mb-3 text-white">3. Configure Sender</h2>
              <input
                type="text"
                placeholder="Your Name / Company"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded"
              />
              <p className="text-xs text-gray-400 mt-1">
                Appears as sender in emails and messages
              </p>
            </div>
            
            {/* EMAIL TEMPLATE */}
            <div className="bg-gray-800 p-4 sm:p-6 rounded-xl shadow border border-gray-700">
              <div className="flex justify-between items-start mb-3">
                <h2 className="text-lg font-bold text-white">4. Email Template</h2>
                <label className="flex items-center text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={abTestMode}
                    onChange={(e) => setAbTestMode(e.target.checked)}
                    className="mr-1"
                  />
                  A/B Test Mode
                </label>
              </div>
              
              {abTestMode ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-yellow-300 mb-1">Template A (Primary)</label>
                    <input
                      type="text"
                      placeholder="Subject line"
                      value={templateA.subject}
                      onChange={(e) => setTemplateA({...templateA, subject: e.target.value})}
                      className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded mb-2"
                    />
                    <textarea
                      placeholder="Email body with {{variables}}"
                      value={templateA.body}
                      onChange={(e) => setTemplateA({...templateA, body: e.target.value})}
                      className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded min-h-[150px]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-purple-300 mb-1">Template B (Variant)</label>
                    <input
                      type="text"
                      placeholder="Subject line"
                      value={templateB.subject}
                      onChange={(e) => setTemplateB({...templateB, subject: e.target.value})}
                      className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded mb-2"
                    />
                    <textarea
                      placeholder="Email body with {{variables}}"
                      value={templateB.body}
                      onChange={(e) => setTemplateB({...templateB, body: e.target.value})}
                      className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded min-h-[150px]"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    placeholder="Subject line"
                    value={templateA.subject}
                    onChange={(e) => setTemplateA({...templateA, subject: e.target.value})}
                    className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded mb-2"
                  />
                  <textarea
                    placeholder="Email body with {{variables}}"
                    value={templateA.body}
                    onChange={(e) => setTemplateA({...templateA, body: e.target.value})}
                    className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded min-h-[200px]"
                  />
                </div>
              )}
              
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Attach Images (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="w-full p-1 bg-gray-700 text-white border border-gray-600 rounded"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {emailImages.map((img, i) => (
                    <div key={i} className="relative">
                      <img
                        src={img.preview}
                        alt={`Preview ${i+1}`}
                        className="w-16 h-16 object-cover rounded border border-gray-600"
                      />
                      <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] text-center py-0.5 rounded-b">
                        {img.placeholder}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Use {{image1}}, {{image2}}, {{image3}} in body to embed
                </p>
              </div>
              
              {previewRecipient && (
                <div className="mt-4 p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h3 className="text-sm font-bold text-indigo-300 mb-1">Preview for {previewRecipient.business_name || 'Sample Lead'}</h3>
                  <div className="text-xs text-gray-300 border-l-2 border-indigo-500 pl-2 py-1 bg-gray-800 rounded">
                    <div className="font-bold">{renderPreviewText(templateA.subject, previewRecipient, fieldMappings, senderName)}</div>
                    <div className="mt-2 whitespace-pre-wrap">
                      {renderPreviewText(templateA.body, previewRecipient, fieldMappings, senderName)}
                    </div>
                  </div>
                </div>
              )}
              
              {abSummary}
            </div>
            
            {/* WHATSAPP TEMPLATE */}
            <div className="bg-gray-800 p-4 sm:p-6 rounded-xl shadow border border-gray-700">
              <h2 className="text-lg font-bold mb-3 text-white">5. WhatsApp Template</h2>
              <textarea
                placeholder="WhatsApp message with {{variables}}"
                value={whatsappTemplate}
                onChange={(e) => setWhatsappTemplate(e.target.value)}
                className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded min-h-[120px]"
              />
              {previewRecipient && (
                <div className="mt-3 p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h3 className="text-sm font-bold text-green-300 mb-1">Preview</h3>
                  <div className="text-xs text-gray-300 bg-gray-800 p-2 rounded">
                    {renderPreviewText(whatsappTemplate, previewRecipient, fieldMappings, senderName)}
                  </div>
                </div>
              )}
            </div>
            
            {/* SMS TEMPLATE */}
            <div className="bg-gray-800 p-4 sm:p-6 rounded-xl shadow border border-gray-700">
              <h2 className="text-lg font-bold mb-3 text-white">6. SMS Template</h2>
              <textarea
                placeholder="SMS message with {{variables}} (160 chars max)"
                value={smsTemplate}
                onChange={(e) => setSmsTemplate(e.target.value)}
                className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded min-h-[80px]"
                maxLength={160}
              />
              <p className="text-xs text-gray-400 mt-1">
                Character count: {smsTemplate.length}/160
              </p>
              {previewRecipient && (
                <div className="mt-3 p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h3 className="text-sm font-bold text-orange-300 mb-1">Preview</h3>
                  <div className="text-xs text-gray-300 bg-gray-800 p-2 rounded">
                    {renderPreviewText(smsTemplate, previewRecipient, fieldMappings, senderName)}
                  </div>
                </div>
              )}
            </div>
            
            {/* SOCIAL TEMPLATES */}
            <div className="bg-gray-800 p-4 sm:p-6 rounded-xl shadow border border-gray-700">
              <h2 className="text-lg font-bold mb-3 text-white">7. Social Templates</h2>
              
              <div className="mb-3">
                <label className="block text-sm font-medium text-blue-300 mb-1">Instagram DM</label>
                <textarea
                  placeholder="Instagram message"
                  value={instagramTemplate}
                  onChange={(e) => setInstagramTemplate(e.target.value)}
                  className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded min-h-[80px]"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-sky-300 mb-1">Twitter/X DM</label>
                <textarea
                  placeholder="Twitter message"
                  value={twitterTemplate}
                  onChange={(e) => setTwitterTemplate(e.target.value)}
                  className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded min-h-[80px]"
                />
              </div>
            </div>
            
            {/* FOLLOW-UP TEMPLATES */}
            <div className="bg-gray-800 p-4 sm:p-6 rounded-xl shadow border border-gray-700">
              <h2 className="text-lg font-bold mb-3 text-white flex items-center gap-2">
                <span>8. Follow-Up Sequences</span>
                <span className="text-xs bg-purple-900 text-purple-300 px-2 py-0.5 rounded">
                  Auto-applies based on engagement
                </span>
              </h2>
              
              {followUpTemplates.map((template, index) => (
                <div key={template.id} className="mb-4 p-3 bg-gray-700/50 rounded-lg border border-purple-800/50">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <label className="block text-sm font-medium text-purple-300">
                        {template.name}
                      </label>
                      <p className="text-xs text-gray-400">
                        Channel: {template.channel.toUpperCase()} | Delay: {template.delayDays} days
                      </p>
                    </div>
                    <label className="flex items-center text-xs text-gray-300">
                      <input
                        type="checkbox"
                        checked={template.enabled}
                        onChange={(e) => setFollowUpTemplates(prev => 
                          prev.map(t => t.id === template.id ? {...t, enabled: e.target.checked} : t)
                        )}
                        className="mr-1"
                      />
                      Enabled
                    </label>
                  </div>
                  
                  <input
                    type="text"
                    placeholder="Subject line"
                    value={template.subject}
                    onChange={(e) => setFollowUpTemplates(prev => 
                      prev.map(t => t.id === template.id ? {...t, subject: e.target.value} : t)
                    )}
                    className="w-full p-1.5 bg-gray-700 text-white border border-gray-600 rounded mb-1.5 text-sm"
                  />
                  <textarea
                    placeholder="Follow-up message body"
                    value={template.body}
                    onChange={(e) => setFollowUpTemplates(prev => 
                      prev.map(t => t.id === template.id ? {...t, body: e.target.value} : t)
                    )}
                    className="w-full p-1.5 bg-gray-700 text-white border border-gray-600 rounded min-h-[100px] text-sm"
                  />
                </div>
              ))}
              
              <p className="text-xs text-amber-300 mt-2 bg-amber-900/20 p-2 rounded">
                💡 Pro Tip: Follow-ups automatically skip contacts who replied. Status changes control sequence flow.
              </p>
            </div>
            
            {/* ACTION BUTTONS */}
            <div className="bg-gray-800 p-4 sm:p-6 rounded-xl shadow border border-gray-700 space-y-3">
              <button
                onClick={() => handleSendEmails(abTestMode ? 'A' : null)}
                disabled={isSending || validEmails === 0}
                className={`w-full py-2.5 rounded-lg font-bold transition ${
                  isSending || validEmails === 0
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-indigo-700 hover:bg-indigo-600 text-white'
                }`}
              >
                {isSending ? '📤 Sending...' : abTestMode ? '📧 Send Template A' : '📧 Send Emails'}
              </button>
              
              {abTestMode && (
                <button
                  onClick={() => handleSendEmails('B')}
                  disabled={isSending || validEmails === 0}
                  className={`w-full py-2.5 rounded-lg font-bold transition ${
                    isSending || validEmails === 0
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-purple-700 hover:bg-purple-600 text-white'
                  }`}
                >
                  {isSending ? '📤 Sending...' : '📧 Send Template B'}
                </button>
              )}
              
              <button
                onClick={handleSendToNewLeads}
                disabled={isSending || getNewLeads().length === 0}
                className={`w-full py-2.5 rounded-lg font-bold transition ${
                  isSending || getNewLeads().length === 0
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-700 to-emerald-700 hover:from-green-600 hover:to-emerald-600 text-white'
                }`}
              >
                🚀 Smart Send to New Leads ({getNewLeads().length})
              </button>
              
              <div className="pt-2 border-t border-gray-700">
                <p className="text-xs text-gray-400 mb-1">Daily Email Limit:</p>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (dailyEmailCount / 500) * 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-indigo-300 mt-1 text-center">
                  {dailyEmailCount}/500 used • {500 - dailyEmailCount} remaining
                </p>
              </div>
              
              {status && (
                <div className={`mt-3 p-2 rounded text-center text-sm font-medium ${
                  status.includes('✅') ? 'bg-green-900/30 text-green-300' :
                  status.includes('❌') ? 'bg-red-900/30 text-red-300' :
                  status.includes('⚠️') ? 'bg-amber-900/30 text-amber-300' :
                  'bg-blue-900/30 text-blue-300'
                }`}>
                  {status}
                </div>
              )}
            </div>
          </div>
          
          {/* RIGHT PANEL - CONTACT LIST WITH STATUS */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-6">
            {/* CAMPAIGN METRICS */}
            {whatsappLinks.length > 0 && (
              <div className="space-y-4">
                {/* STATUS BREAKDOWN CHART */}
                <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 p-4 sm:p-6 rounded-xl border border-indigo-700/50">
                  <h2 className="text-lg font-bold mb-4 text-indigo-300">📊 Status Distribution</h2>
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                    {CONTACT_STATUSES.map(status => {
                      const count = statusAnalytics.byStatus?.[status.id] || 0;
                      if (count === 0) return null;
                      
                      const percentage = Math.round((count / whatsappLinks.length) * 100);
                      return (
                        <div key={status.id} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-300 flex items-center gap-1">
                              <span className={`w-2 h-2 rounded-full bg-${status.color}-500`}></span>
                              {status.label}
                            </span>
                            <span className="font-bold text-white">{count} ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div 
                              className={`h-full bg-${status.color}-500 rounded-full transition-all duration-500`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-700/50">
                    <h3 className="text-sm font-bold text-purple-300 mb-2">💡 Strategic Insights</h3>
                    <ul className="space-y-1 text-xs text-gray-300">
                      <li>• {statusAnalytics.byStatus?.replied || 0} leads replied ({statusAnalytics.conversionRates?.replied || 0}% reply rate)</li>
                      <li>• {statusAnalytics.byStatus?.demo_scheduled || 0} demos booked ({statusAnalytics.conversionRates?.demo || 0}% of replies)</li>
                      <li>• Focus follow-ups on "Engaged" leads for highest conversion potential</li>
                      <li>• {archivedContactsCount} contacts archived (>30 days inactive)</li>
                    </ul>
                  </div>
                </div>
                
                {/* CONVERSION FUNNEL */}
                {showDetailedAnalytics && (
                  <div className="bg-gradient-to-br from-amber-900/10 to-orange-900/10 p-4 sm:p-6 rounded-xl border border-amber-700/50">
                    <h2 className="text-lg font-bold mb-4 text-amber-300">📈 Conversion Funnel</h2>
                    <div className="space-y-3">
                      {['sent', 'opened', 'clicked', 'replied', 'demo', 'closed'].map((stage, i) => {
                        const count = statusAnalytics.byStatus?.[stage] || Math.round(whatsappLinks.length * [1, 0.35, 0.12, 0.08, 0.03, 0.015][i]);
                        const percentage = Math.round((count / whatsappLinks.length) * 100);
                        return (
                          <div key={stage} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-300 capitalize">{stage.replace('_', ' ')}</span>
                              <span className="font-bold text-white">{count} ({percentage}%)</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                              <div 
                                className={`h-full ${
                                  i === 0 ? 'bg-blue-500' :
                                  i === 1 ? 'bg-cyan-500' :
                                  i === 2 ? 'bg-green-500' :
                                  i === 3 ? 'bg-emerald-500' :
                                  i === 4 ? 'bg-purple-500' :
                                  'bg-amber-500'
                                } rounded-full transition-all duration-500`}
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-amber-700/50">
                      <h3 className="text-sm font-bold text-amber-300 mb-2">💰 Revenue Forecast</h3>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-amber-900/30 p-2 rounded">
                          <div className="text-amber-200">Monthly Pipeline</div>
                          <div className="text-xl font-bold text-amber-300">
                            ${Math.round((statusAnalytics.byStatus?.replied || 0) * 0.4 * 5000 / 1000)}k
                          </div>
                        </div>
                        <div className="bg-amber-900/30 p-2 rounded">
                          <div className="text-amber-200">Expected Close Rate</div>
                          <div className="text-xl font-bold text-amber-300">
                            {Math.round((statusAnalytics.byStatus?.demo_scheduled || 0) * 0.4)} deals
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* CONTACT LIST WITH STATUS */}
            {whatsappLinks.length > 0 && (
              <div className="bg-gray-800 p-4 sm:p-6 rounded-xl shadow border border-gray-700">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                  <h2 className="text-lg font-bold text-white">
                    🌐 Contacts ({getFilteredContacts().length})
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setShowMultiChannelModal(true)}
                      className="text-xs bg-indigo-700 hover:bg-indigo-600 text-white px-3 py-1.5 rounded font-medium"
                    >
                      ⬆️ Full View
                    </button>
                    {statusFilter !== 'all' && (
                      <button
                        onClick={() => setStatusFilter('all')}
                        className="text-xs bg-amber-700 hover:bg-amber-600 text-white px-3 py-1.5 rounded font-medium"
                      >
                        Show All
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="max-h-[50vh] overflow-y-auto">
                  {getFilteredContacts().map((contact) => {
                    const contactKey = contact.email || contact.phone;
                    const last = contact.lastContacted;
                    const score = leadScores[contact.email] || 0;
                    const isReplied = contact.status === 'replied';
                    
                    return (
                      <div 
                        key={contact.id} 
                        className={`p-3 mb-2 bg-gray-750 rounded-lg border-l-4 ${
                          contact.status === 'closed_won' ? 'border-emerald-500' :
                          contact.status === 'replied' ? 'border-green-500' :
                          contact.status === 'demo_scheduled' ? 'border-purple-500' :
                          contact.status === 'not_interested' ? 'border-rose-500' :
                          contact.status === 'archived' ? 'border-gray-500 opacity-70' :
                          'border-blue-500'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-white flex items-center gap-2">
                                  {contact.business}
                                  {contact.status === 'archived' && (
                                    <span className="text-xs bg-gray-600 text-gray-300 px-1.5 py-0.5 rounded">
                                      Archived
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-400 mt-0.5">
                                  {contact.email ? (
                                    <>
                                      📧 <span className="break-all">{contact.email}</span>
                                      <span className="mx-2">|</span>
                                    </>
                                  ) : (
                                    <span className="italic text-gray-500">No email</span>
                                  )}
                                  📞 +{contact.phone}
                                </div>
                                {contact.email && (
                                  <div className="text-xs mt-1 flex flex-wrap items-center gap-2">
                                    <span className={`font-bold ${
                                      score >= 70 ? 'text-green-400' : 
                                      score >= 50 ? 'text-yellow-400' : 'text-orange-400'
                                    }`}>
                                      Lead Score: {score}/100
                                    </span>
                                    <StatusBadge status={contact.status} small />
                                  </div>
                                )}
                              </div>
                              <div className="flex-shrink-0 ml-2">
                                <StatusDropdown contact={contact} compact />
                              </div>
                            </div>
                            
                            {last && (
                              <div className="text-xs text-green-400 mt-1 flex items-center gap-1">
                                <span>📅 Last contacted:</span>
                                <span>{new Date(last).toLocaleDateString()}</span>
                              </div>
                            )}
                            
                            {contact.notes?.length > 0 && (
                              <div className="text-xs text-blue-300 mt-1 flex items-start gap-1">
                                <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <span>{contact.notes[contact.notes.length - 1]?.note || 'No notes'}</span>
                              </div>
                            )}
                          </div>
                          
                          {/* ACTION BUTTONS - RESPONSIVE */}
                          <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
                            <button
                              onClick={() => handleCall(contact.phone)}
                              className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded"
                              title="Direct call"
                            >
                              📞
                            </button>
                            <button
                              onClick={() => handleTwilioCall(contact, 'direct')}
                              className="text-xs bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded"
                              title="Automated message"
                            >
                              🤖
                            </button>
                            {contact.email && (
                              <a
                                href={`mailto:${contact.email}`}
                                className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-2 py-1 rounded"
                                title="Email directly"
                              >
                                ✉️
                              </a>
                            )}
                            {contact.phone && (
                              <a
                                href={contact.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => handleWhatsAppClick(contact)}
                                className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded"
                                title="WhatsApp"
                              >
                                💬
                              </a>
                            )}
                            {smsConsent && contact.phone && (
                              <button
                                onClick={() => handleSendSMS(contact)}
                                className="text-xs bg-orange-700 hover:bg-orange-600 text-white px-2 py-1 rounded"
                                title="Send SMS"
                              >
                                📱
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {getFilteredContacts().length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-2">🔍</div>
                      <p>No contacts match your current filters</p>
                      <button
                        onClick={() => {
                          setStatusFilter('all');
                          setContactFilter('all');
                          setSearchQuery('');
                        }}
                        className="mt-2 text-xs bg-indigo-700 hover:bg-indigo-600 text-white px-3 py-1 rounded"
                      >
                        Reset Filters
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-400">
                  <div className="flex justify-between items-center">
                    <span>
                      Showing {getFilteredContacts().length} of {whatsappLinks.length} contacts
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      Status auto-saved to Firestore
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* NO CONTACTS MESSAGE */}
            {whatsappLinks.length === 0 && (
              <div className="bg-gray-800 p-6 sm:p-8 rounded-xl shadow border border-gray-700 text-center">
                <div className="text-5xl mb-4">📥</div>
                <h2 className="text-xl font-bold text-white mb-2">Upload Your First Lead List</h2>
                <p className="text-gray-400 mb-4">
                  Start by uploading a CSV file with your leads. We'll automatically save contacts to your database with full status tracking.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-3 mt-4">
                  <button
                    onClick={() => document.querySelector('input[type="file"]').click()}
                    className="bg-indigo-700 hover:bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-medium transition"
                  >
                    📤 Upload CSV
                  </button>
                  <button
                    onClick={() => router.push('/format')}
                    className="bg-amber-700 hover:bg-amber-600 text-white px-4 py-2.5 rounded-lg font-medium transition"
                  >
                    🔥 Scrape Leads First
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  ✅ All contacts automatically saved to Firestore with status tracking<br />
                  ✅ 30-day auto-archive for irrelevant contacts<br />
                  ✅ Full history preserved for business intelligence
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* STATUS MODAL */}
      <StatusModal />
      
      {/* FOLLOW-UP MODAL */}
      {showFollowUpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-indigo-700">
            <div className="relative p-5 border-b border-gray-700 bg-gradient-to-r from-indigo-900 to-purple-900">
              <h2 className="text-xl font-bold text-white">📬 Reply Center & Follow-Ups</h2>
              <button
                onClick={() => setShowFollowUpModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            
            <div className="p-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
                  <h3 className="font-bold text-green-300 mb-2">✅ Replied Leads ({followUpStats.totalReplied})</h3>
                  <p className="text-sm text-green-200">
                    These leads have responded to your outreach. Prioritize follow-up within 24 hours!
                  </p>
                  <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                    {sentLeads
                      .filter(lead => lead.replied)
                      .map(lead => (
                        <div key={lead.email} className="flex items-center justify-between p-2 bg-green-900/30 rounded">
                          <div>
                            <div className="font-medium text-white">{lead.business_name || lead.email}</div>
                            <div className="text-xs text-green-300">{lead.email}</div>
                          </div>
                          <StatusDropdown 
                            contact={{ 
                              contactId: lead.email.toLowerCase().trim(), 
                              business: lead.business_name || lead.email,
                              status: contactStatuses[lead.email.toLowerCase().trim()] || 'replied'
                            }} 
                          />
                        </div>
                      ))}
                  </div>
                </div>
                
                <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-4">
                  <h3 className="font-bold text-amber-300 mb-2">⏳ Ready for Follow-Up ({followUpStats.readyForFollowUp})</h3>
                  <p className="text-sm text-amber-200">
                    Leads who haven't replied and are ready for next touchpoint. Send follow-ups now!
                  </p>
                  <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                    {sentLeads
                      .filter(lead => !lead.replied && isEligibleForFollowUp(lead))
                      .map(lead => (
                        <div key={lead.email} className="flex items-center justify-between p-2 bg-amber-900/30 rounded">
                          <div>
                            <div className="font-medium text-white">{lead.business_name || lead.email}</div>
                            <div className="text-xs text-amber-300">{lead.email}</div>
                            <div className="text-xs text-amber-400 mt-1">
                              Last sent: {new Date(lead.sentAt).toLocaleDateString()}
                              {lead.followUpCount > 0 && ` | Follow-ups: ${lead.followUpCount}`}
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              const token = await requestGmailToken();
                              await sendFollowUpWithToken(lead.email, token);
                            }}
                            className="text-xs bg-amber-800 hover:bg-amber-700 text-white px-3 py-1 rounded font-medium"
                          >
                            ➡️ Send Follow-Up
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                <h3 className="font-bold text-blue-300 mb-3">📊 Follow-Up Analytics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  <div>
                    <div className="text-2xl font-bold text-white">{followUpStats.totalSent}</div>
                    <div className="text-xs text-blue-300">Total Sent</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-400">{followUpStats.totalReplied}</div>
                    <div className="text-xs text-blue-300">Replied</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-400">{followUpStats.readyForFollowUp}</div>
                    <div className="text-xs text-blue-300">Ready for FU</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-400">{followUpStats.interestedLeads}</div>
                    <div className="text-xs text-blue-300">Engaged (No Reply)</div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-blue-800">
                  <button
                    onClick={async () => {
                      const token = await requestGmailToken();
                      await sendMassFollowUp(token);
                    }}
                    disabled={followUpStats.readyForFollowUp === 0 || isSending}
                    className={`w-full py-2.5 rounded-lg font-bold transition ${
                      followUpStats.readyForFollowUp === 0 || isSending
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-indigo-700 hover:bg-indigo-600 text-white'
                    }`}
                  >
                    {isSending ? '📤 Sending...' : `📤 Send Follow-Ups to ${followUpStats.readyForFollowUp} Leads`}
                  </button>
                  
                  <p className="text-xs text-blue-300 mt-2 bg-blue-900/30 p-2 rounded">
                    💡 Smart Logic: Follow-ups automatically skip replied leads and respect 3-email max per contact. Status changes control sequence flow.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-5 border-t border-gray-700 bg-gray-850 flex justify-end">
              <button
                onClick={() => setShowFollowUpModal(false)}
                className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* CALL HISTORY MODAL */}
      {showCallHistoryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-green-700">
            <div className="relative p-5 border-b border-gray-700 bg-gradient-to-r from-green-900 to-emerald-900">
              <h2 className="text-xl font-bold text-white">📞 Call History</h2>
              <button
                onClick={() => setShowCallHistoryModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            
            <div className="p-5 max-h-[70vh] overflow-y-auto">
              {loadingCallHistory ? (
                <div className="text-center py-8 text-gray-400">Loading call history...</div>
              ) : callHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📞</div>
                  <p>No calls made yet</p>
                  <p className="text-sm mt-1">Start making calls to see your history here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {callHistory.map(call => {
                    const badge = getStatusBadge(call.status);
                    return (
                      <div key={call.id} className="p-4 bg-gray-750 rounded-lg border-l-4 border-green-700">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white">{call.businessName}</div>
                            <div className="text-sm text-gray-400 mt-1">
                              📞 +{call.toPhone} | {new Date(call.createdAt).toLocaleString()}
                            </div>
                            <div className="text-xs mt-2 flex flex-wrap items-center gap-2">
                              <span className={`${badge.bg} ${badge.text} px-2 py-0.5 rounded text-xs font-medium`}>
                                {badge.label}
                              </span>
                              {call.duration > 0 && (
                                <span className="text-green-400 font-medium">
                                  Duration: {Math.floor(call.duration / 60)}m {call.duration % 60}s
                                </span>
                              )}
                              {call.answeredBy && (
                                <span className="text-blue-300">
                                  Answered by: {call.answeredBy}
                                </span>
                              )}
                            </div>
                            {call.recordingUrl && (
                              <div className="mt-2">
                                <a
                                  href={call.recordingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                                >
                                  🎙️ Listen to recording
                                </a>
                              </div>
                            )}
                          </div>
                          <div className="flex-shrink-0">
                            <StatusDropdown 
                              contact={{ 
                                contactId: `phone_${call.toPhone}`, 
                                business: call.businessName,
                                phone: call.toPhone,
                                status: contactStatuses[`phone_${call.toPhone}`] || 'contacted'
                              }} 
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="p-5 border-t border-gray-700 bg-gray-850 flex justify-end">
              <button
                onClick={() => setShowCallHistoryModal(false)}
                className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* MULTI-CHANNEL MODAL WITH STATUS INTEGRATION */}
      {showMultiChannelModal && (
        <div className={`${isMultiChannelFullscreen ? 'fixed inset-0' : 'fixed inset-0'} bg-black/70 flex items-center justify-center z-50 p-4`}>
          <div className={`bg-gray-800 rounded-xl shadow-2xl ${isMultiChannelFullscreen ? 'w-screen h-screen max-h-screen' : 'w-full max-w-7xl max-h-[90vh]'} overflow-hidden flex flex-col border border-gray-700`}>
            <div className="relative p-4 sm:p-5 border-b border-gray-700 bg-gradient-to-r from-indigo-900 to-purple-900">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>🌐 Multi-Channel Contact Manager</span>
                  <span className="text-sm bg-amber-900 text-amber-300 px-2 py-0.5 rounded">
                    {getFilteredContacts().length} contacts
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsMultiChannelFullscreen(!isMultiChannelFullscreen)}
                    className="text-gray-300 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition"
                    title={isMultiChannelFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  >
                    {isMultiChannelFullscreen ? '❐' : '□'}
                  </button>
                  <button
                    onClick={() => setShowMultiChannelModal(false)}
                    className="text-gray-300 hover:text-white text-xl w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500/20 transition"
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="🔍 Search contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded-lg text-sm"
                  />
                </div>
                
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="p-2 bg-gray-700 text-white border border-gray-600 rounded-lg text-sm"
                >
                  <option value="all">All Statuses</option>
                  {CONTACT_STATUSES.map(status => (
                    <option key={status.id} value={status.id}>
                      {status.label}
                    </option>
                  ))}
                </select>
                
                <select
                  value={contactFilter}
                  onChange={(e) => setContactFilter(e.target.value)}
                  className="p-2 bg-gray-700 text-white border border-gray-600 rounded-lg text-sm"
                >
                  <option value="all">All Contacts</option>
                  <option value="replied">✅ Replied</option>
                  <option value="pending">⏳ Pending</option>
                  <option value="high-quality">⭐ High Quality</option>
                  <option value="contacted">📞 Contacted</option>
                </select>
                
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="p-2 bg-gray-700 text-white border border-gray-600 rounded-lg text-sm"
                >
                  <option value="score">Score ↓</option>
                  <option value="recent">Recent</option>
                  <option value="name">A-Z</option>
                  <option value="status">Status</option>
                </select>
                
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setContactFilter('all');
                    setSortBy('score');
                  }}
                  className="p-2 bg-amber-700 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition"
                >
                  Reset Filters
                </button>
              </div>
            </div>
            
            {/* MAIN CONTENT WITH STATUS */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getFilteredContacts().map((contact) => {
                  const contactKey = contact.email || contact.phone;
                  const last = contact.lastContacted;
                  const score = leadScores[contact.email] || 0;
                  const isReplied = contact.status === 'replied';
                  
                  return (
                    <div
                      key={contact.id}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        contact.status === 'closed_won'
                          ? 'border-emerald-700 bg-emerald-900/15'
                          : contact.status === 'replied'
                          ? 'border-green-700 bg-green-900/15'
                          : contact.status === 'demo_scheduled'
                          ? 'border-purple-700 bg-purple-900/15'
                          : contact.status === 'not_interested'
                          ? 'border-rose-700 bg-rose-900/15'
                          : contact.status === 'archived'
                          ? 'border-gray-700 bg-gray-900/30 opacity-80'
                          : 'border-indigo-700 bg-indigo-900/10'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-white text-lg">{contact.business}</h3>
                          <p className="text-sm text-gray-400">📞 +{contact.phone}</p>
                          {contact.email && (
                            <p className="text-xs text-blue-400 mt-1 break-all">{contact.email}</p>
                          )}
                        </div>
                        <div className="ml-3 flex-shrink-0">
                          <StatusDropdown contact={contact} />
                        </div>
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-300">Lead Score</span>
                          <span className={`font-bold ${
                            score >= 70 ? 'text-green-400' : 
                            score >= 50 ? 'text-yellow-400' : 'text-orange-400'
                          }`}>
                            {score}/100
                          </span>
                        </div>
                        
                        {last && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-300">Last Contacted</span>
                            <span className="text-green-400 font-medium">
                              {new Date(last).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-300">Status</span>
                          <StatusBadge status={contact.status} small />
                        </div>
                      </div>
                      
                      <div className="pt-3 border-t border-gray-700/50">
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            onClick={() => handleCall(contact.phone)}
                            className="p-1.5 bg-green-700 hover:bg-green-600 text-white rounded text-xs font-medium transition"
                            title="Direct call"
                          >
                            📞 Call
                          </button>
                          <button
                            onClick={() => handleTwilioCall(contact, 'direct')}
                            className="p-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-medium transition"
                            title="Automated message"
                          >
                            🤖 Auto
                          </button>
                          {contact.email && (
                            <a
                              href={`mailto:${contact.email}`}
                              className="p-1.5 bg-purple-700 hover:bg-purple-600 text-white rounded text-xs font-medium transition block text-center"
                              title="Email directly"
                            >
                              ✉️ Email
                            </a>
                          )}
                          {contact.phone && (
                            <a
                              href={contact.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => handleWhatsAppClick(contact)}
                              className="p-1.5 bg-green-700 hover:bg-green-600 text-white rounded text-xs font-medium transition block text-center"
                              title="WhatsApp"
                            >
                              💬 WA
                            </a>
                          )}
                          {smsConsent && contact.phone && (
                            <button
                              onClick={() => handleSendSMS(contact)}
                              className="p-1.5 bg-orange-700 hover:bg-orange-600 text-white rounded text-xs font-medium transition"
                              title="Send SMS"
                            >
                              📱 SMS
                            </button>
                          )}
                          <button
                            onClick={() => researchCompany(contact.business, contact.website, contact.email)}
                            disabled={researchingCompany === contact.email}
                            className="p-1.5 bg-indigo-700 hover:bg-indigo-600 text-white rounded text-xs font-medium transition disabled:opacity-50"
                            title="AI Research"
                          >
                            {researchingCompany === contact.email ? '⏳' : '🧠'} Research
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* FOOTER */}
            <div className="p-4 border-t border-gray-700 bg-gray-800 flex justify-between items-center">
              <div className="text-xs text-gray-500">
                <span>💡 Status changes are saved instantly to your contact database</span>
                {archivedContactsCount > 0 && (
                  <span className="ml-4 text-amber-400 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    {archivedContactsCount} archived contacts can be re-engaged
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowMultiChannelModal(false)}
                className="text-sm bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* AI RESEARCH MODAL */}
      {showResearchModal && selectedContactForStatus && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-indigo-700">
            <div className="relative p-5 border-b border-gray-700 bg-gradient-to-r from-indigo-900 to-purple-900">
              <h2 className="text-xl font-bold text-white">🧠 AI Company Research</h2>
              <p className="text-sm text-indigo-200 mt-1">
                For: {selectedContactForStatus.business}
              </p>
              <button
                onClick={() => setShowResearchModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            
            <div className="p-5 max-h-[70vh] overflow-y-auto">
              {researchingCompany ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                  <p className="text-gray-300">Researching {selectedContactForStatus.business}...</p>
                  <p className="text-xs text-gray-500 mt-1">This may take 15-30 seconds</p>
                </div>
              ) : researchResults[selectedContactForStatus.email] ? (
                <div className="space-y-4">
                  <div className="bg-indigo-900/30 border border-indigo-800 rounded-lg p-4">
                    <h3 className="font-bold text-indigo-300 mb-2">💡 Personalized Outreach Strategy</h3>
                    <p className="text-gray-300 whitespace-pre-wrap">
                      {researchResults[selectedContactForStatus.email].strategy}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-4">
                      <h3 className="font-bold text-amber-300 mb-2">🔍 Key Insights</h3>
                      <ul className="space-y-1 text-gray-300">
                        {researchResults[selectedContactForStatus.email].insights.map((insight, i) => (
                          <li key={i} className="flex items-start">
                            <span className="text-amber-400 mr-2">•</span>
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
                      <h3 className="font-bold text-green-300 mb-2">🎯 Recommended Approach</h3>
                      <p className="text-gray-300">
                        {researchResults[selectedContactForStatus.email].approach}
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                    <h3 className="font-bold text-blue-300 mb-2">✉️ Custom Email Template</h3>
                    <div className="mt-2 p-3 bg-gray-800 rounded-lg text-gray-300 whitespace-pre-wrap border border-blue-700/50">
                      {researchResults[selectedContactForStatus.email].emailTemplate}
                    </div>
                    <button
                      onClick={() => {
                        // Apply to current template
                        setTemplateA(prev => ({
                          ...prev,
                          subject: researchResults[selectedContactForStatus.email].subjectLine,
                          body: researchResults[selectedContactForStatus.email].emailTemplate
                        }));
                        setShowResearchModal(false);
                        alert('✅ Research insights applied to your email template!');
                      }}
                      className="mt-3 w-full py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg font-medium transition"
                    >
                      📤 Apply to Current Template
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No research results available. Please run research first.
                </div>
              )}
            </div>
            
            <div className="p-5 border-t border-gray-700 bg-gray-850 flex justify-end">
              <button
                onClick={() => setShowResearchModal(false)}
                className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ADVANCED ANALYTICS MODAL */}
      {showAdvancedAnalytics && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-purple-700">
            <div className="relative p-5 border-b border-gray-700 bg-gradient-to-r from-purple-900 to-pink-900">
              <h2 className="text-xl font-bold text-white">🤖 AI-Powered Business Intelligence</h2>
              <button
                onClick={() => setShowAdvancedAnalytics(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            
            <div className="p-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* PREDICTIVE SCORING */}
                <div className="bg-purple-900/20 border border-purple-800 rounded-lg p-5">
                  <h3 className="font-bold text-purple-300 mb-3 flex items-center gap-2">
                    <span>🔮 Predictive Lead Scoring</span>
                    <span className="text-xs bg-purple-800 text-purple-300 px-2 py-0.5 rounded">
                      AI-Generated
                    </span>
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(predictiveScores).slice(0, 5).map(([email, data]) => (
                      <div key={email} className="p-3 bg-purple-900/30 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-white">{email}</div>
                            <div className="text-sm text-purple-200 mt-1">
                              Predicted Reply Probability: <span className="font-bold text-amber-300">{data.replyProbability}%</span>
                            </div>
                            <div className="text-xs text-purple-300 mt-1">
                              Recommended Action: <span className="font-medium">{data.recommendedAction}</span>
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-purple-400">
                            {data.score}/100
                          </div>
                        </div>
                      </div>
                    ))}
                    {Object.keys(predictiveScores).length === 0 && (
                      <div className="text-center py-6 text-purple-300">
                        <div className="text-4xl mb-2">🔮</div>
                        <p>Run predictive scoring on your leads to see AI-powered insights</p>
                        <p className="text-xs mt-1 text-purple-400">Uses historical data + engagement patterns</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* SENTIMENT ANALYSIS */}
                <div className="bg-pink-900/20 border border-pink-800 rounded-lg p-5">
                  <h3 className="font-bold text-pink-300 mb-3 flex items-center gap-2">
                    <span>💬 Reply Sentiment Analysis</span>
                    <span className="text-xs bg-pink-800 text-pink-300 px-2 py-0.5 rounded">
                      Real-time
                    </span>
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(sentimentAnalysis).slice(0, 5).map(([email, data]) => (
                      <div key={email} className="p-3 bg-pink-900/30 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-white">{email}</div>
                            <div className="text-sm text-pink-200 mt-1">
                              Sentiment: <span className={`font-bold ${
                                data.sentiment === 'positive' ? 'text-green-400' :
                                data.sentiment === 'neutral' ? 'text-amber-400' : 'text-red-400'
                              }`}>
                                {data.sentiment.charAt(0).toUpperCase() + data.sentiment.slice(1)}
                              </span>
                            </div>
                            <div className="text-xs text-pink-300 mt-1">
                              Key Themes: {data.keyThemes.join(', ')}
                            </div>
                          </div>
                          <div className="text-lg font-bold text-pink-400">
                            {data.confidence}%
                          </div>
                        </div>
                      </div>
                    ))}
                    {Object.keys(sentimentAnalysis).length === 0 && (
                      <div className="text-center py-6 text-pink-300">
                        <div className="text-4xl mb-2">💬</div>
                        <p>AI analyzes replies to detect sentiment and buying intent</p>
                        <p className="text-xs mt-1 text-pink-400">Helps prioritize hot leads instantly</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* SMART FOLLOW-UP SUGGESTIONS */}
                <div className="bg-indigo-900/20 border border-indigo-800 rounded-lg p-5 lg:col-span-2">
                  <h3 className="font-bold text-indigo-300 mb-3 flex items-center gap-2">
                    <span>✨ Smart Follow-Up Generator</span>
                    <span className="text-xs bg-indigo-800 text-indigo-300 px-2 py-0.5 rounded">
                      Context-Aware
                    </span>
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(smartFollowUpSuggestions).slice(0, 3).map(([email, data]) => (
                      <div key={email} className="p-4 bg-indigo-900/30 rounded-lg border border-indigo-700">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium text-white">{email}</div>
                            <div className="text-xs text-indigo-300 mt-1">
                              Generated for Follow-Up #{data.followUpNumber}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            data.urgency === 'high' ? 'bg-rose-900 text-rose-300' :
                            data.urgency === 'medium' ? 'bg-amber-900 text-amber-300' : 'bg-green-900 text-green-300'
                          }`}>
                            {data.urgency.toUpperCase()} URGENCY
                          </span>
                        </div>
                        <div className="mt-2 p-3 bg-gray-800 rounded-lg text-gray-300 text-sm border border-indigo-700/50">
                          {data.subjectLine && <div className="font-bold mb-1">{data.subjectLine}</div>}
                          <div className="whitespace-pre-wrap">{data.body}</div>
                        </div>
                        <button
                          onClick={() => {
                            // Apply to follow-up template
                            const templateIndex = followUpTemplates.findIndex(t => t.id === `followup_${data.followUpNumber}`);
                            if (templateIndex !== -1) {
                              const newTemplates = [...followUpTemplates];
                              newTemplates[templateIndex] = {
                                ...newTemplates[templateIndex],
                                subject: data.subjectLine,
                                body: data.body
                              };
                              setFollowUpTemplates(newTemplates);
                              alert(`✅ Smart follow-up applied to Follow-Up ${data.followUpNumber} template!`);
                            }
                          }}
                          className="mt-2 w-full py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition"
                        >
                          📤 Apply to Follow-Up Template
                        </button>
                      </div>
                    ))}
                    {Object.keys(smartFollowUpSuggestions).length === 0 && (
                      <div className="text-center py-8 text-indigo-300">
                        <div className="text-5xl mb-3">✨</div>
                        <p className="text-lg font-bold mb-2">Generate Context-Aware Follow-Ups</p>
                        <p className="max-w-2xl mx-auto">
                          Our AI analyzes lead behavior (opens, clicks, time spent) to generate hyper-personalized follow-up messages that dramatically increase reply rates.
                        </p>
                        <button
                          onClick={async () => {
                            // Generate for top 3 leads
                            const topLeads = getFilteredContacts().slice(0, 3);
                            for (const lead of topLeads) {
                              if (lead.email) {
                                await generateSmartFollowUp(lead.email, lead, (followUpHistory[lead.email]?.count || 0) + 1);
                              }
                            }
                            alert('✅ Generated smart follow-ups for top 3 leads!');
                          }}
                          className="mt-4 bg-indigo-700 hover:bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium transition inline-flex items-center gap-2"
                        >
                          🚀 Generate for Top Leads
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-5 border-t border-gray-700 bg-gray-850 flex justify-end">
              <button
                onClick={() => setShowAdvancedAnalytics(false)}
                className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}