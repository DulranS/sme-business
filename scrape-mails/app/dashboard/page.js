// app/dashboard/page.js
'use client';
import { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import Head from 'next/head';
import { useRouter } from 'next/navigation';

const firebaseConfig = {
  apiKey: "AIzaSyDE-hRmyPs02dBm_OlVfwR9ZzmmMIiKw7o",
  authDomain: "email-marketing-c775d.firebaseapp.com",
  projectId: "email-marketing-c775d",
  storageBucket: "email-marketing-c775d.firebasestorage.app",
  messagingSenderId: "178196903576",
  appId: "1:178196903576:web:56b97d8e0b7943e3ee82ed",
  measurementId: "G-6CL2EGLEVH"
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

const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length === 0) return false;
  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain || !domain.includes('.')) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
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
  const [callHistory, setCallHistory] = useState([]);
  const [loadingCallHistory, setLoadingCallHistory] = useState(false);
  const [showCallHistoryModal, setShowCallHistoryModal] = useState(false);
  const [activeCallStatus, setActiveCallStatus] = useState(null);
  const [showMultiChannelModal, setShowMultiChannelModal] = useState(false);
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

  // ✅ Twilio Call
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
    const callTypeLabels = {
      direct: 'Automated Message (Plays your script)',
      bridge: 'Bridge Call (Connects you first)',
      interactive: 'Interactive Menu (They can press buttons)'
    };
    const confirmed = confirm(
      `📞 Call ${contact.business} at +${contact.phone}?
Type: ${callTypeLabels[callType]}
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
        const contactKey = contact.email || contact.phone;
        setLastSent(prev => ({ ...prev, [contactKey]: new Date().toISOString() }));
        if (contact.email && dealStage[contactKey] === 'new') {
          updateDealStage(contactKey, 'contacted');
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
  const handleSendSMS = async (contact) => {
    if (!user?.uid) return;
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
        if (dealStage[contactKey] === 'new') {
          updateDealStage(contactKey, 'contacted');
        }
      } else {
        alert(`❌ SMS failed: ${data.error}`);
      }
    } catch (error) {
      console.error('SMS send error:', error);
      alert(`❌ Failed to send SMS: ${error.message}`);
    }
  };

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

  // ✅ Settings
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
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }
  };

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
        smsConsent
      }, { merge: true });
    } catch (error) {
      console.warn('Failed to save settings:', error);
    }
  }, [user?.uid, senderName, templateA, templateB, whatsappTemplate, smsTemplate, instagramTemplate, twitterTemplate, followUpTemplates, fieldMappings, abTestMode, smsConsent]);

  useEffect(() => {
    if (!user?.uid) return;
    const handler = setTimeout(() => saveSettings(), 1500);
    return () => clearTimeout(handler);
  }, [saveSettings, user?.uid]);

  // ✅ CSV Upload
  const handleCsvUpload = (e) => {
    setValidEmails(0);
    setValidWhatsApp(0);
    setWhatsappLinks([]);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
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
          if (dealStage[row.email] === 'contacted') score += 10;
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
            url: `https://wa.me/${formattedPhone}?text=${encodeURIComponent(
              renderPreviewText(whatsappTemplate, row, fieldMappings, senderName)
            )}`
          });
          if (!firstValid) firstValid = row;
        }
      }
      setPreviewRecipient(firstValid);
      if (leadQualityFilter === 'HOT') setValidEmails(hotEmails);
      else if (leadQualityFilter === 'WARM') setValidEmails(warmEmails);
      else setValidEmails(hotEmails + warmEmails);
      setValidWhatsApp(validPhoneContacts.length);
      setWhatsappLinks(validPhoneContacts);
      setLeadScores(newLeadScores);
      setLastSent(newLastSent);
      setCsvContent(normalizedContent);
    };
    reader.readAsText(file);
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

  const loadDeals = async () => {
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
  };

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
        setSentLeads(data.leads);
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
        alert(`✅ Follow-up sent to ${email}`);
        await loadSentLeads();
        await loadDeals();
      } else {
        alert(`❌ Follow-up failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Follow-up send error:', err);
      alert(`❌ Error: ${err.message || 'Failed to send follow-up'}`);
    }
  };

  const isEligibleForFollowUp = (lead) => {
    if (!lead || !lead.email || lead.replied) return false;
    const now = new Date();
    const followUpAt = new Date(lead.followUpAt);
    return followUpAt <= now;
  };

  const sendMassFollowUp = async (accessToken) => {
    if (!user?.uid || !accessToken) return;
    const confirmed = confirm(`Send follow-up to all eligible leads (${sentLeads.filter(isEligibleForFollowUp).length})?`);
    if (!confirmed) return;
    setIsSending(true);
    setStatus('📤 Sending mass follow-ups...');
    let successCount = 0;
    for (const lead of sentLeads) {
      if (!isEligibleForFollowUp(lead)) continue;
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
        if (res.ok) successCount++;
      } catch (err) {
        console.error(`Error sending to ${lead.email}:`, err);
      }
    }
    setIsSending(false);
    alert(`✅ Sent follow-ups to ${successCount} leads.`);
    await loadSentLeads();
  };

  const checkRepliesAndLoad = async () => {
    await checkForReplies();
    await loadSentLeads();
  };

  // ✅ Send Emails
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
      
      console.log('🔍 Debug - Email column:', emailColumnName);
      console.log('🔍 Debug - Quality column:', qualityColumnName);
      console.log('🔍 Debug - Headers:', headers);
      console.log('🔍 Debug - Lead Quality Filter:', leadQualityFilter);
      
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
          console.log('❌ Invalid email:', emailValue);
          continue;
        }
        
        // ✅ Check if quality column exists in headers
        const hasQualityColumn = headers.includes(qualityColumnName);
        const quality = hasQualityColumn ? (row[qualityColumnName] || '').trim() || 'HOT' : 'HOT';
        console.log(`📧 ${emailValue} - Quality: ${quality}, Filter: ${leadQualityFilter}`);
        
        // ✅ Apply quality filter
        if (leadQualityFilter !== 'all' && quality !== leadQualityFilter) {
          console.log(`⏭️ Skipping ${emailValue} - Quality mismatch`);
          continue;
        }
        
        // ✅ Normalize row to include 'email' key for consistent rendering
        const normalizedRow = { ...row, email: emailValue };
        validRecipients.push(normalizedRow);
        console.log(`✅ Added ${emailValue} to recipients`);
      }
      
      console.log(`📊 Total valid recipients: ${validRecipients.length}`);
      
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
Filter: ${leadQualityFilter}
Check browser console for details.`);
        return;
      }
      
      setStatus(`Sending to ${recipientsToSend.length} leads...`);
      
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
      
      console.log('📤 Reconstructed CSV sample (first 3 rows):');
      console.log(csvLines.slice(0, 3).join('\n'));
      console.log(`✅ Total rows being sent: ${recipientsToSend.length}`);
      
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
        if (abTestMode) {
          const newResults = { ...abResults };
          if (templateToSend === 'A') newResults.a.sent = data.sent;
          else newResults.b.sent = data.sent;
          setAbResults(newResults);
          await setDoc(doc(db, 'ab_results', user.uid), newResults);
        }
      } else {
        setStatus(`❌ ${data.error}`);
        
        // 🚨 CRITICAL DEBUG OUTPUT
        console.error('╔════════════════════════════════════════════════════════════╗');
        console.error('║          EMAIL SEND ERROR - DEBUG INFORMATION              ║');
        console.error('╚════════════════════════════════════════════════════════════╝');
        console.error('');
        console.error('ERROR STATS:', data.stats);
        console.error('EMAIL COLUMN:', data.emailColumn);
        console.error('');
        console.error('FIRST 5 INVALID EMAILS (THIS IS YOUR KEY):');
        if (data.invalidDetails && data.invalidDetails.length > 0) {
          data.invalidDetails.forEach((invalid, idx) => {
            console.error(`  ${idx + 1}. Raw: "${invalid.raw}"`);
            console.error(`     Cleaned: "${invalid.cleaned}"`);
            console.error(`     Reasons: ${invalid.reasons.join(', ')}`);
            console.error('');
          });
        } else {
          console.error('  (No invalidDetails found)');
        }
        console.error('FULL RESPONSE:', data);
        console.error('');
        console.error('📋 COPY THE SECTION ABOVE AND SEND IT TO DEVELOPER');
        console.error('╔════════════════════════════════════════════════════════════╗');
        
        alert(`❌ Error: ${data.error}\n\nCheck Console (F12) for detailed debugging info. Look for "FIRST 5 INVALID EMAILS"`);
      }
    } catch (err) {
      console.error('Send error:', err);
      setStatus(`❌ ${err.message || 'Failed to send'}`);
      alert(`❌ ${err.message || 'Failed to send emails'}`);
    } finally {
      setIsSending(false);
    }
  };

  // ✅ Auth & Data Loading
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        loadSettings(user.uid);
        loadClickStats();
        loadDeals();
        loadAbResults();
        loadRepliedAndFollowUp();
      } else {
        setUser(null);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

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
  }, [clickStats]);

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

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg">Loading your strategic outreach dashboard...</div>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <button
          onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg"
        >
          Sign in to Continue
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
    ...csvHeaders // 👈 CRITICAL: include all CSV columns
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

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200">
      <Head>
        <title>B2B Growth Engine | Strategic Outreach</title>
      </Head>
      <header className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-white">B2B Growth Engine</h1>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                loadCallHistory();
                setShowCallHistoryModal(true);
              }}
              className="text-sm bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded"
            >
              📞 Call History
            </button>
            <button
              onClick={() => {
                loadSentLeads();
                setShowFollowUpModal(true);
              }}
              className="text-sm bg-indigo-700 hover:bg-indigo-600 text-white px-3 py-1.5 rounded"
            >
              📬 Reply & Follow-Up Center
            </button>
            <button
              onClick={() => router.push('/format')}
              className="text-sm bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded"
            >
              🔥 Scrape Mails
            </button>
            <button
              onClick={() => signOut(auth)}
              className="text-sm text-gray-300 hover:text-white"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT PANEL */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
              <h2 className="text-xl font-bold mb-4 text-white">1. Upload Leads CSV</h2>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded"
              />
              <p className="text-xs text-gray-400 mt-2">Auto-scores leads and binds fields.</p>
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
            {/* ✅ FIELD MAPPINGS: SHOW ALL VARS + ALL CSV COLUMNS */}
            <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
              <h2 className="text-xl font-bold mb-4 text-white">2. Field Mappings</h2>
              {(() => {
                const allVars = [...new Set([
                  ...extractTemplateVariables(templateA.subject),
                  ...extractTemplateVariables(templateA.body),
                  ...extractTemplateVariables(templateB.subject),
                  ...extractTemplateVariables(templateB.body),
                  ...extractTemplateVariables(whatsappTemplate),
                  ...extractTemplateVariables(smsTemplate),
                  ...extractTemplateVariables(instagramTemplate),
                  ...extractTemplateVariables(twitterTemplate),
                  ...followUpTemplates.flatMap(t => [
                    ...extractTemplateVariables(t.subject || ''),
                    ...extractTemplateVariables(t.body || '')
                  ]),
                  'sender_name',
                  ...emailImages.map(img => img.placeholder.replace(/{{|}}/g, '')),
                  ...csvHeaders
                ])];
                return allVars.map(varName => (
                  <div key={varName} className="flex items-center mb-2">
                    <span className="bg-gray-700 px-1.5 py-0.5 rounded text-xs font-mono mr-2 text-gray-200">
                      {`{{${varName}}}`}
                    </span>
                    <select
                      value={fieldMappings[varName] || ''}
                      onChange={(e) => handleMappingChange(varName, e.target.value)}
                      className="text-xs bg-gray-700 text-gray-200 border border-gray-600 rounded px-2 py-1 flex-1"
                    >
                      <option value="">-- Map to Column --</option>
                      {csvHeaders.map(col => (
                        <option key={col} value={col} className="bg-gray-800 text-gray-200">{col}</option>
                      ))}
                      {varName === 'sender_name' && (
                        <option value="sender_name" className="bg-gray-800 text-gray-200">Use sender name</option>
                      )}
                    </select>
                  </div>
                ));
              })()}
            </div>
            {abSummary}
          </div>

          {/* MIDDLE PANEL */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
              <h2 className="text-xl font-bold mb-3 text-white">3. Your Name (Sender)</h2>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded"
                placeholder="e.g., Alex from GrowthCo"
              />
            </div>
            <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-bold text-white">4. Email Template</h2>
                <label className="flex items-center text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={abTestMode}
                    onChange={(e) => setAbTestMode(e.target.checked)}
                    className="mr-2"
                  />
                  A/B Testing
                </label>
              </div>
              {abTestMode ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-gray-700 rounded p-3 bg-gray-750">
                    <h3 className="font-bold text-green-400 mb-2">Template A</h3>
                    <input
                      type="text"
                      value={templateA.subject}
                      onChange={(e) => setTemplateA({ ...templateA, subject: e.target.value })}
                      className="w-full p-1 bg-gray-700 text-white border border-gray-600 rounded mb-1 text-sm"
                      placeholder="Subject A"
                    />
                    <textarea
                      value={templateA.body}
                      onChange={(e) => setTemplateA({ ...templateA, body: e.target.value })}
                      rows="3"
                      className="w-full p-1 font-mono text-sm bg-gray-700 text-white border border-gray-600 rounded"
                      placeholder="Body A..."
                    />
                  </div>
                  <div className="border border-gray-700 rounded p-3 bg-gray-750">
                    <h3 className="font-bold text-blue-400 mb-2">Template B</h3>
                    <input
                      type="text"
                      value={templateB.subject}
                      onChange={(e) => setTemplateB({ ...templateB, subject: e.target.value })}
                      className="w-full p-1 bg-gray-700 text-white border border-gray-600 rounded mb-1 text-sm"
                      placeholder="Subject B"
                    />
                    <textarea
                      value={templateB.body}
                      onChange={(e) => setTemplateB({ ...templateB, body: e.target.value })}
                      rows="3"
                      className="w-full p-1 font-mono text-sm bg-gray-700 text-white border border-gray-600 rounded"
                      placeholder="Body B..."
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    value={templateA.subject}
                    onChange={(e) => setTemplateA({ ...templateA, subject: e.target.value })}
                    className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded mb-2"
                    placeholder="Subject"
                  />
                  <textarea
                    value={templateA.body}
                    onChange={(e) => setTemplateA({ ...templateA, body: e.target.value })}
                    rows="4"
                    className="w-full p-2 font-mono bg-gray-700 text-white border border-gray-600 rounded"
                    placeholder="Hello {{business_name}}, ..."
                  />
                </div>
              )}
              {abTestMode ? (
                <div className="space-y-2 mt-4">
                  <button
                    onClick={() => handleSendEmails('A')}
                    disabled={isSending || !csvContent || !senderName.trim() || validEmails === 0}
                    className={`w-full py-2.5 rounded font-bold ${
                      isSending || !csvContent || !senderName.trim() || validEmails === 0
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-green-700 hover:bg-green-600 text-white'
                    }`}
                  >
                    📧 Send Template A (First {Math.ceil(validEmails / 2)} leads)
                  </button>
                  <button
                    onClick={() => handleSendEmails('B')}
                    disabled={isSending || !csvContent || !senderName.trim() || validEmails === 0}
                    className={`w-full py-2.5 rounded font-bold ${
                      isSending || !csvContent || !senderName.trim() || validEmails === 0
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-blue-700 hover:bg-blue-600 text-white'
                    }`}
                  >
                    📧 Send Template B (Last {Math.floor(validEmails / 2)} leads)
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleSendEmails()}
                  className={`w-full py-2.5 rounded font-bold mt-4 ${
                    isSending || !csvContent || !senderName.trim() || validEmails === 0
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-green-700 hover:bg-green-600 text-white'
                  }`}
                >
                  📧 Send Emails ({validEmails})
                </button>
              )}
            </div>
            <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
              <h2 className="text-xl font-bold mb-3 text-white">5. WhatsApp Template</h2>
              <textarea
                value={whatsappTemplate}
                onChange={(e) => setWhatsappTemplate(e.target.value)}
                rows="3"
                className="w-full p-2 font-mono bg-gray-700 text-white border border-gray-600 rounded"
                placeholder="Hi {{business_name}}! ..."
              />
            </div>
            <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
              <h2 className="text-xl font-bold mb-3 text-white">6. SMS Template</h2>
              <textarea
                value={smsTemplate}
                onChange={(e) => setSmsTemplate(e.target.value)}
                rows="3"
                className="w-full p-2 font-mono bg-gray-700 text-white border border-gray-600 rounded"
                placeholder="Hi {{business_name}}! ..."
              />
            </div>
            
            {/* FOLLOW-UP TEMPLATES */}
            <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
              <h2 className="text-xl font-bold mb-3 text-white">7. Follow-Up Sequences</h2>
              {followUpTemplates.map((template, index) => (
                <div key={template.id} className="border border-gray-700 rounded p-3 mb-3 bg-gray-750">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-purple-400">{template.name}</h3>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={template.enabled}
                        onChange={(e) => {
                          const updated = [...followUpTemplates];
                          updated[index].enabled = e.target.checked;
                          setFollowUpTemplates(updated);
                        }}
                        className="mr-1"
                      />
                      <span className="text-xs text-gray-300">Enable</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label className="text-xs block text-gray-300">Channel</label>
                      <select
                        value={template.channel}
                        onChange={(e) => {
                          const updated = [...followUpTemplates];
                          updated[index].channel = e.target.value;
                          setFollowUpTemplates(updated);
                        }}
                        className="w-full text-xs bg-gray-700 text-white border border-gray-600 rounded p-1"
                      >
                        <option value="email">Email</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="sms">SMS</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs block text-gray-300">Delay (days)</label>
                      <input
                        type="number"
                        min="1"
                        value={template.delayDays}
                        onChange={(e) => {
                          const updated = [...followUpTemplates];
                          updated[index].delayDays = parseInt(e.target.value) || 1;
                          setFollowUpTemplates(updated);
                        }}
                        className="w-full text-xs bg-gray-700 text-white border border-gray-600 rounded p-1"
                      />
                    </div>
                  </div>
                  {template.channel === 'email' && (
                    <>
                      <input
                        type="text"
                        value={template.subject || ''}
                        onChange={(e) => {
                          const updated = [...followUpTemplates];
                          updated[index].subject = e.target.value;
                          setFollowUpTemplates(updated);
                        }}
                        className="w-full mt-2 p-1 bg-gray-700 text-white border border-gray-600 rounded text-sm"
                        placeholder="Subject"
                      />
                      <textarea
                        value={template.body || ''}
                        onChange={(e) => {
                          const updated = [...followUpTemplates];
                          updated[index].body = e.target.value;
                          setFollowUpTemplates(updated);
                        }}
                        rows="3"
                        className="w-full mt-1 p-1 font-mono text-sm bg-gray-700 text-white border border-gray-600 rounded"
                        placeholder="Body..."
                      />
                    </>
                  )}
                  {(template.channel === 'whatsapp' || template.channel === 'sms') && (
                    <textarea
                      value={template.body || ''}
                      onChange={(e) => {
                        const updated = [...followUpTemplates];
                        updated[index].body = e.target.value;
                        setFollowUpTemplates(updated);
                      }}
                      rows="3"
                      className="w-full mt-1 p-1 font-mono text-sm bg-gray-700 text-white border border-gray-600 rounded"
                      placeholder="Message..."
                    />
                  )}
                </div>
              ))}
            </div>
            
            <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
              <h2 className="text-xl font-bold mb-3 text-white">8. Instagram Template</h2>
              <textarea
                value={instagramTemplate}
                onChange={(e) => setInstagramTemplate(e.target.value)}
                rows="3"
                className="w-full p-2 font-mono bg-gray-700 text-white border border-gray-600 rounded"
                placeholder="Hi {{business_name}}! ..."
              />
            </div>
            
            <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
              <h2 className="text-xl font-bold mb-3 text-white">9. Twitter Template</h2>
              <textarea
                value={twitterTemplate}
                onChange={(e) => setTwitterTemplate(e.target.value)}
                rows="3"
                className="w-full p-2 font-mono bg-gray-700 text-white border border-gray-600 rounded"
                placeholder="Hi {{business_name}}! ..."
              />
            </div>
            
            {status && (
              <div
                className={`p-3 rounded text-center whitespace-pre-line ${
                  status.includes('✅')
                  ? 'bg-green-900/50 text-green-300 border border-green-700'
                  : 'bg-red-900/50 text-red-300 border border-red-700'
                }`}
              >
                {status}
              </div>
            )}
          </div>

          {/* RIGHT PANEL */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
              <h2 className="text-xl font-bold mb-3 text-white">10. Email Preview</h2>
              <div className="bg-gray-750 p-4 rounded border border-gray-600">
                <div className="text-sm text-gray-400">
                  To: {previewRecipient?.email || 'email@example.com'}
                </div>
                <div className="mt-1 font-medium text-white">
                  {renderPreviewText(
                    abTestMode ? templateA.subject : templateA.subject,
                    previewRecipient,
                    fieldMappings,
                    senderName
                  )}
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-gray-200">
                  {renderPreviewText(templateA.body, previewRecipient, fieldMappings, senderName)}
                </div>
              </div>
            </div>
            
            {whatsappLinks.length > 0 && (
              <div className="bg-gray-800 p-4 rounded-xl shadow border border-gray-700">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-lg font-bold text-white">
                    11. Multi-Channel Outreach ({whatsappLinks.length})
                  </h2>
                  <button
                    onClick={() => setShowMultiChannelModal(true)}
                    className="text-sm bg-indigo-700 hover:bg-indigo-600 text-white px-3 py-1.5 rounded font-medium"
                    title="Expand to full view for easier management"
                  >
                    ⬆️ Expand
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {whatsappLinks.map((link) => {
                    const contactKey = link.email || link.phone;
                    const last = lastSent[contactKey];
                    const score = leadScores[link.email] || 0;
                    const isReplied = repliedLeads[link.email];
                    const isFollowUp = followUpLeads[link.email];
                    return (
                      <div key={link.id} className="p-3 bg-gray-750 rounded-lg border border-gray-600">
                        <div className="flex justify-between">
                          <div>
                            <div className="font-medium text-white">{link.business}</div>
                            <div className="text-sm text-gray-400">+{link.phone}</div>
                            {link.email ? (
                              <div className="text-xs text-blue-400">Score: {score}/100</div>
                            ) : (
                              <div className="text-xs text-gray-500 italic">No email (phone-only)</div>
                            )}
                            {last && (
                              <div className="text-xs text-green-400 mt-1">
                                📅 Last: {new Date(last).toLocaleDateString()}
                              </div>
                            )}
                            {isReplied && (
                              <span className="inline-block bg-green-900/30 text-green-300 text-xs px-1.5 py-0.5 rounded mt-1">
                                Replied
                              </span>
                            )}
                            {!isReplied && isFollowUp && (
                              <span className="inline-block bg-yellow-900/30 text-yellow-300 text-xs px-1.5 py-0.5 rounded mt-1">
                                Follow Up
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col items-end space-y-1">
                            <div className="flex flex-wrap gap-1 justify-end">
                              <button
                                onClick={() => handleCall(link.phone)}
                                className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded"
                              >
                                Call
                              </button>
                              <button
                                onClick={() => handleTwilioCall(link, 'direct')}
                                className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded"
                                title="Automated message"
                              >
                                📞 Auto Call
                              </button>
                              <button
                                onClick={() => handleSmartCall(link)}
                                className="text-xs bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-3 py-1.5 rounded font-medium"
                              >
                                📞 Smart Call
                              </button>
                              <button
                                onClick={() => handleTwilioCall(link, 'bridge')}
                                className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded"
                                title="Connect you first"
                              >
                                🤝 Bridge
                              </button>
                              <button
                                onClick={() => handleTwilioCall(link, 'interactive')}
                                className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-2 py-1 rounded"
                                title="Interactive menu"
                              >
                                🎛️ IVR
                              </button>
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded"
                              >
                                WhatsApp
                              </a>
                              <button
                                onClick={() => handleOpenNativeSMS(link)}
                                className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-2 py-1 rounded"
                                title="Open in Messages"
                              >
                                SMS
                              </button>
                              <button
                                onClick={() => handleOpenInstagram(link)}
                                className="text-xs bg-pink-700 hover:bg-pink-600 text-white px-2 py-1 rounded"
                                title="Open Instagram"
                              >
                                IG
                              </button>
                              <button
                                onClick={() => handleOpenTwitter(link)}
                                className="text-xs bg-sky-700 hover:bg-sky-600 text-white px-2 py-1 rounded"
                                title="Open Twitter"
                              >
                                X
                              </button>
                            </div>
                            {smsConsent && (
                              <button
                                onClick={() => handleSendSMS(link)}
                                className="text-xs bg-orange-700 hover:bg-orange-600 text-white px-2 py-1 rounded mt-1 w-full"
                              >
                                Twilio SMS
                              </button>
                            )}
                            {link.email ? (
                              <select
                                value={dealStage[link.email] || 'new'}
                                onChange={(e) => updateDealStage(link.email, e.target.value)}
                                className="text-xs bg-gray-700 text-white border border-gray-600 rounded px-1 py-0.5 mt-1 w-full"
                              >
                                <option value="new">New</option>
                                <option value="contacted">Contacted</option>
                                <option value="demo">Demo Scheduled</option>
                                <option value="proposal">Proposal Sent</option>
                                <option value="won">Closed Won</option>
                              </select>
                            ) : (
                              <div className="text-xs text-gray-500 mt-1 italic">No email → CRM not tracked</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4">
                  <button
                    onClick={handleSendBulkSMS}
                    disabled={!smsConsent || isSending}
                    className={`w-full py-2 rounded font-bold ${
                      !smsConsent ? 'bg-gray-600 cursor-not-allowed' : 'bg-orange-700 hover:bg-orange-600 text-white'
                    }`}
                  >
                    📲 Send SMS to All ({whatsappLinks.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* FOLLOW-UP MODAL */}
      {showFollowUpModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">📨 Reply & Follow-Up Center</h2>
              <button
                onClick={() => setShowFollowUpModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex space-x-2">
              <button
                onClick={checkRepliesAndLoad}
                className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-3 py-1.5 rounded"
              >
                🔄 Check for New Replies
              </button>
              <button
                onClick={async () => {
                  try {
                    const accessToken = await requestGmailToken();
                    sendMassFollowUp(accessToken);
                  } catch (err) {
                    alert('Gmail access denied or blocked. Check popup blocker.');
                    console.error(err);
                  }
                }}
                className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded"
                disabled={isSending}
              >
                📨 Send Mass Follow-Up
              </button>
              <div className="text-xs text-gray-400 ml-2">Auto-checks replies & updates follow-up status</div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingSentLeads ? (
                <div className="text-center py-6 text-gray-300">Loading sent leads...</div>
              ) : sentLeads.length === 0 ? (
                <div className="text-center py-6 text-gray-500">No emails sent yet.</div>
              ) : (
                <div className="grid gap-3">
                  {sentLeads.map((lead) => {
                    const sentAt = new Date(lead.sentAt);
                    const followUpAt = new Date(lead.followUpAt);
                    const now = new Date();
                    const needsFollowUp = !lead.replied && followUpAt <= now;
                    return (
                      <div
                        key={lead.email}
                        className={`p-4 rounded-lg border ${
                          lead.replied
                            ? 'border-green-700 bg-green-900/20'
                            : needsFollowUp
                              ? 'border-yellow-700 bg-yellow-900/20'
                              : 'border-gray-700 bg-gray-750'
                        }`}
                      >
                        <div className="flex justify-between">
                          <div>
                            <div className="font-medium text-white">{lead.email}</div>
                            <div className="text-xs text-gray-400">
                              Sent: {sentAt.toLocaleString()}
                            </div>
                            {lead.replied ? (
                              <span className="inline-block mt-1 bg-green-900/30 text-green-300 text-xs px-2 py-0.5 rounded">
                                ✅ Replied
                              </span>
                            ) : needsFollowUp ? (
                              <span className="inline-block mt-1 bg-yellow-900/30 text-yellow-300 text-xs px-2 py-0.5 rounded">
                                ⏳ Follow-Up Ready
                              </span>
                            ) : (
                              <span className="inline-block mt-1 bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded">
                                📤 Pending Reply
                              </span>
                            )}
                          </div>
                          {!lead.replied && (
                            <button
                              onClick={async () => {
                                try {
                                  const token = await requestGmailToken();
                                  sendFollowUpWithToken(lead.email, token);
                                } catch (err) {
                                  alert('Gmail auth failed. Check popup blocker or try again.');
                                  console.error(err);
                                }
                              }}
                              disabled={!needsFollowUp}
                              className={`text-xs px-3 py-1 rounded ${
                                needsFollowUp
                                  ? 'bg-blue-700 hover:bg-blue-600 text-white'
                                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              {needsFollowUp ? 'Send Follow-Up' : 'Too Early'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
              • Replied leads are auto-detected<br />
              • Follow-ups are ready 48h after send if no reply<br />
              • Click "Send Follow-Up" to send a polite reminder
            </div>
          </div>
        </div>
      )}
      
      {/* CALL HISTORY MODAL */}
      {showCallHistoryModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gradient-to-r from-green-900/20 to-blue-900/20">
              <div>
                <h2 className="text-xl font-bold text-white">📞 Call History & Analytics</h2>
                <p className="text-sm text-gray-400">Track all your Twilio calls</p>
              </div>
              <button
                onClick={() => setShowCallHistoryModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="p-4 bg-gray-850 border-b border-gray-700 grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{callHistory.length}</div>
                <div className="text-xs text-gray-400">Total Calls</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">
                  {callHistory.filter(c => c.status === 'completed').length}
                </div>
                <div className="text-xs text-gray-400">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">
                  {callHistory.filter(c => c.status === 'failed').length}
                </div>
                <div className="text-xs text-gray-400">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">
                  {callHistory.filter(c => c.answeredBy === 'human').length}
                </div>
                <div className="text-xs text-gray-400">Human Answered</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400">
                  {callHistory.filter(c => c.answeredBy?.includes('machine')).length}
                </div>
                <div className="text-xs text-gray-400">Voicemail</div>
              </div>
            </div>
            <div className="p-4 border-b border-gray-700 flex space-x-2">
              <button
                onClick={loadCallHistory}
                disabled={loadingCallHistory}
                className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded disabled:bg-gray-700"
              >
                {loadingCallHistory ? '🔄 Loading...' : '🔄 Refresh'}
              </button>
              <button
                onClick={() => {
                  const csvContent = [
                    ['Business', 'Phone', 'Status', 'Duration', 'Answered By', 'Date', 'Call SID'].join(','),
                    ...callHistory.map(call => [
                      call.businessName,
                      call.toPhone,
                      call.status,
                      call.duration || 0,
                      call.answeredBy || 'unknown',
                      new Date(call.createdAt).toLocaleString(),
                      call.callSid
                    ].join(','))
                  ].join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `call-history-${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                }}
                className="text-xs bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded"
              >
                📥 Export CSV
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingCallHistory ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">⏳</div>
                  <div className="text-lg text-gray-300">Loading call history...</div>
                </div>
              ) : callHistory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📞</div>
                  <div className="text-xl font-medium mb-2 text-gray-300">No calls yet</div>
                  <div className="text-gray-500">Start making calls to see them here</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {callHistory.map((call) => {
                    const isCompleted = call.status === 'completed';
                    const hasRecording = !!call.recordingUrl;
                    return (
                      <div
                        key={call.id}
                        className={`p-4 rounded-lg border-2 ${
                          isCompleted
                            ? 'border-green-700 bg-green-900/10'
                            : call.status === 'failed'
                              ? 'border-red-700 bg-red-900/10'
                              : 'border-gray-700 bg-gray-800'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-bold text-white">{call.businessName}</h3>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                call.status === 'completed'
                                  ? 'bg-green-900/30 text-green-300'
                                  : call.status === 'failed'
                                    ? 'bg-red-900/30 text-red-300'
                                    : 'bg-gray-700 text-gray-300'
                              }`}>
                                {call.status === 'completed' ? 'Completed' : call.status === 'failed' ? 'Failed' : 'In Progress'}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm text-gray-400 mt-2">
                              <div>
                                <span className="font-medium">📞 Phone:</span> {call.toPhone}
                              </div>
                              <div>
                                <span className="font-medium">⏱️ Duration:</span> {call.duration || 0}s
                              </div>
                              <div>
                                <span className="font-medium">🎤 Answered by:</span>{' '}
                                {call.answeredBy === 'human'
                                  ? '👤 Human'
                                  : call.answeredBy?.includes('machine')
                                    ? '📠 Voicemail'
                                    : '❓ Unknown'}
                              </div>
                              <div>
                                <span className="font-medium">📅 Date:</span>{' '}
                                {new Date(call.createdAt).toLocaleDateString() + ' ' +
                                  new Date(call.createdAt).toLocaleTimeString()}
                              </div>
                            </div>
                            {call.callSid && (
                              <div className="text-xs text-gray-500 mt-2 font-mono">
                                SID: {call.callSid}
                              </div>
                            )}
                            {call.error && (
                              <div className="mt-2 p-2 bg-red-900/20 rounded text-xs text-red-300">
                                <strong>Error:</strong> {call.error}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col space-y-2 ml-4">
                            {hasRecording && (
                              <a
                                href={call.recordingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-3 py-1.5 rounded text-center"
                              >
                                🎙️ Listen
                              </a>
                            )}
                            {isCompleted && (
                              <span className="text-xs bg-green-900/30 text-green-300 px-3 py-1.5 rounded text-center font-medium">
                                ✅ Success
                              </span>
                            )}
                            {call.toPhone && (
                              <button
                                onClick={() => {
                                  let contact = whatsappLinks.find(c =>
                                    c.phone === call.toPhone.replace(/\D/g, '')
                                  );
                                  if (!contact) {
                                    contact = {
                                      business: call.businessName || 'Unknown Business',
                                      phone: call.toPhone,
                                      email: null,
                                      address: ''
                                    };
                                  }
                                  handleTwilioCall(contact, call.callType || 'direct');
                                }}
                                className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded"
                              >
                                🔄 Retry
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-700 bg-gray-850 text-xs text-gray-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <strong>💡 Tip:</strong> Calls are tracked in real-time
                </div>
                <div>
                  <strong>🎙️ Recordings:</strong> Available for completed calls
                </div>
                <div>
                  <strong>📊 Analytics:</strong> Filter and export your data
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* MULTI-CHANNEL OUTREACH MODAL */}
      {showMultiChannelModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
            {/* HEADER */}
            <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gradient-to-r from-indigo-900/20 to-blue-900/20">
              <div>
                <h2 className="text-2xl font-bold text-white">🌐 Multi-Channel Outreach Manager</h2>
                <p className="text-sm text-gray-400">Manage all your communication channels ({whatsappLinks.length} contacts)</p>
              </div>
              <button
                onClick={() => setShowMultiChannelModal(false)}
                className="text-gray-400 hover:text-white text-3xl"
              >
                ✕
              </button>
            </div>

            {/* STATS BAR */}
            <div className="p-4 bg-gray-850 border-b border-gray-700 grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="text-center">
                <div className="text-xl font-bold text-blue-400">{whatsappLinks.length}</div>
                <div className="text-xs text-gray-400">Total Contacts</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-400">
                  {Object.keys(repliedLeads).filter(k => repliedLeads[k]).length}
                </div>
                <div className="text-xs text-gray-400">Replied</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-yellow-400">
                  {Object.keys(followUpLeads).filter(k => followUpLeads[k]).length}
                </div>
                <div className="text-xs text-gray-400">Need Follow-Up</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-purple-400">
                  {whatsappLinks.filter(l => lastSent[l.email || l.phone]).length}
                </div>
                <div className="text-xs text-gray-400">Recently Contacted</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-orange-400">
                  {whatsappLinks.filter(l => !l.email).length}
                </div>
                <div className="text-xs text-gray-400">Phone Only</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-cyan-400">
                  {whatsappLinks.filter(l => l.email && (leadScores[l.email] || 0) >= 70).length}
                </div>
                <div className="text-xs text-gray-400">High Quality</div>
              </div>
            </div>

            {/* SEARCH & FILTER BAR */}
            <div className="p-4 border-b border-gray-700 bg-gray-800 flex gap-2 flex-wrap">
              <input
                type="text"
                placeholder="🔍 Search by business name or phone..."
                className="flex-1 min-w-[200px] px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onChange={(e) => {
                  const value = e.target.value.toLowerCase();
                  // Filter logic can be added here
                }}
              />
              <select
                defaultValue="all"
                className="px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded text-sm"
              >
                <option value="all">📊 All Status</option>
                <option value="replied">✅ Replied</option>
                <option value="followup">⏳ Follow-Up Ready</option>
                <option value="pending">📤 Pending Reply</option>
              </select>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {whatsappLinks.map((link) => {
                  const contactKey = link.email || link.phone;
                  const last = lastSent[contactKey];
                  const score = leadScores[link.email] || 0;
                  const isReplied = repliedLeads[link.email];
                  const isFollowUp = followUpLeads[link.email];

                  return (
                    <div
                      key={link.id}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        isReplied
                          ? 'border-green-700 bg-green-900/15'
                          : isFollowUp
                            ? 'border-yellow-700 bg-yellow-900/15'
                            : 'border-gray-700 bg-gray-750'
                      }`}
                    >
                      {/* HEADER */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-white text-lg">{link.business}</h3>
                          <p className="text-sm text-gray-400">📞 +{link.phone}</p>
                          {link.email && (
                            <p className="text-xs text-blue-400">📧 {link.email}</p>
                          )}
                        </div>
                        {/* STATUS BADGES */}
                        <div className="flex flex-col gap-1">
                          {isReplied && (
                            <span className="bg-green-900/40 text-green-300 text-xs px-2 py-1 rounded font-medium">
                              ✅ Replied
                            </span>
                          )}
                          {!isReplied && isFollowUp && (
                            <span className="bg-yellow-900/40 text-yellow-300 text-xs px-2 py-1 rounded font-medium">
                              ⏳ Follow-Up
                            </span>
                          )}
                        </div>
                      </div>

                      {/* INFO */}
                      <div className="mb-3 p-2 bg-gray-800/50 rounded text-xs space-y-1">
                        {link.email ? (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Lead Quality Score:</span>
                            <span className={`font-bold ${
                              score >= 70 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-orange-400'
                            }`}>
                              {score}/100
                            </span>
                          </div>
                        ) : (
                          <div className="text-gray-500 italic">📵 No email (phone-only lead)</div>
                        )}
                        {last && (
                          <div className="flex justify-between text-gray-400">
                            <span>Last Contacted:</span>
                            <span className="text-green-400">{new Date(last).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>

                      {/* ACTION BUTTONS */}
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleCall(link.phone)}
                            className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-1.5 rounded font-medium transition"
                          >
                            📞 Call
                          </button>
                          <button
                            onClick={() => handleTwilioCall(link, 'direct')}
                            className="text-xs bg-green-600 hover:bg-green-500 text-white px-2 py-1.5 rounded font-medium transition"
                            title="Send automated message"
                          >
                            🤖 Auto Call
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleSmartCall(link)}
                            className="text-xs bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-600 hover:to-indigo-700 text-white px-2 py-1.5 rounded font-medium transition col-span-2"
                          >
                            📞 Smart Call
                          </button>
                        </div>
                        {link.phone && (
                          <button
                            onClick={() => handleTwilioCall(link, 'bridge')}
                            className="text-xs w-full bg-blue-700 hover:bg-blue-600 text-white px-2 py-1.5 rounded font-medium transition"
                            title="Connect and bridge call"
                          >
                            🌉 Bridge Call
                          </button>
                        )}
                        {link.phone && (
                          <a
                            href={`https://wa.me/${link.phone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs w-full block text-center bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-white px-2 py-1.5 rounded font-medium transition"
                          >
                            💬 WhatsApp
                          </a>
                        )}
                        {link.email && (
                          <button
                            onClick={() => window.location.href = `mailto:${link.email}`}
                            className="text-xs w-full bg-purple-700 hover:bg-purple-600 text-white px-2 py-1.5 rounded font-medium transition"
                          >
                            ✉️ Email
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {whatsappLinks.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🌐</div>
                  <div className="text-xl font-medium mb-2 text-gray-300">No contacts yet</div>
                  <div className="text-gray-500">Generate WhatsApp links from your CSV to see them here</div>
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div className="p-4 border-t border-gray-700 bg-gray-850 flex justify-between items-center">
              <div className="text-xs text-gray-500 space-x-4">
                <span>💡 Click "Expand" from the dashboard to manage all channels</span>
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
    </div>
  );
}