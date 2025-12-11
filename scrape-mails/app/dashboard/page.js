// app/dashboard/page.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import Head from 'next/head';

// ✅ YOUR FIREBASE CONFIG
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

// ============= DEFAULT TEMPLATES =============
const DEFAULT_TEMPLATE_A = {
  subject: '🚀 Special Offer for {{business_name}}',
  body: 'Hi {{business_name}},\n\nWe noticed your business at {{address}} and believe our [service] could help you grow faster. As a limited-time offer, use code **WELCOME20** for 20% off your first purchase.\n\nBest regards,\n{{sender_name}}\nGrowthCo'
};

const DEFAULT_TEMPLATE_B = {
  subject: '💡 Growth Opportunity for {{business_name}}',
  body: 'Hello {{business_name}},\n\nWe’ve helped businesses like yours increase revenue by 30%+ in 90 days.\n\nLet’s schedule a quick 15-min call to explore if we’re a fit?\n\nBest,\n{{sender_name}}\nGrowthCo'
};

const DEFAULT_WHATSAPP_TEMPLATE = 
  'Hi {{business_name}}! 👋\n\nWe’re {{sender_name}} from GrowthCo. Saw your business at {{address}}.\n\nWould you be open to a quick chat about how we can help grow your business?\n\nReply YES to connect!';

const DEFAULT_SMS_TEMPLATE = 
  'Hi {{business_name}}! 🚀 GrowthCo here. Saw your business at {{address}}. Use WELCOME20 for 20% off! Reply STOP to opt out.';

// ============= PHONE HANDLING =============
function formatForDialing(raw) {
  if (!raw || raw === 'N/A') return null;
  let cleaned = raw.toString().replace(/\D/g, '');
  if (cleaned.startsWith('0') && cleaned.length >= 9) {
    cleaned = '94' + cleaned.slice(1);
  }
  return /^[1-9]\d{9,14}$/.test(cleaned) ? cleaned : null;
}

const handleSendSMS = async (contact) => {
  if (!smsConsent) {
    alert('Please enable SMS consent before sending messages.');
    return;
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
        userId: user.uid
      })
    });

    const data = await response.json();
    if (response.ok) {
      alert(`✅ SMS sent to ${contact.business}!`);
      setLastSent(prev => ({ ...prev, [contact.email]: new Date().toISOString() }));
      if (dealStage[contact.email] === 'new') {
        updateDealStage(contact.email, 'contacted');
      }
    } else {
      alert(`❌ SMS failed: ${data.error}`);
    }
  } catch (error) {
    console.error('SMS send error:', error);
    alert(`❌ Failed to send SMS: ${error.message}`);
  }
};

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

// ============= CUSTOM BINDING HELPER =============
const extractTemplateVariables = (text) => {
  if (!text) return [];
  const matches = text.match(/\{\{\s*([^}]+?)\s*\}\}/g) || [];
  return [...new Set(matches.map(m => m.replace(/\{\{\s*|\s*\}\}/g, '').trim()))];
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

const isValidEmail = (email) => email?.includes('@') && email?.includes('.');

const parseCsvRow = (str) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && !inQuotes) inQuotes = true;
    else if (char === '"' && inQuotes && str[i + 1] === '"') { current += '"'; i++; }
    else if (char === '"' && inQuotes) inQuotes = false;
    else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
    else current += char;
  }
  result.push(current);
  return result.map(f => f.trim().replace(/^"(.*)"$/, '$1'));
};

// ============= MAIN COMPONENT =============
export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [csvContent, setCsvContent] = useState('');
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [senderName, setSenderName] = useState('');
  const [abTestMode, setAbTestMode] = useState(false);
  const [templateA, setTemplateA] = useState(DEFAULT_TEMPLATE_A);
  const [templateB, setTemplateB] = useState(DEFAULT_TEMPLATE_B);
  const [whatsappTemplate, setWhatsappTemplate] = useState(DEFAULT_WHATSAPP_TEMPLATE);
  const [smsTemplate, setSmsTemplate] = useState(DEFAULT_SMS_TEMPLATE); // ✅ SMS TEMPLATE
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
  const [smsConsent, setSmsConsent] = useState(false);
  const [abResults, setAbResults] = useState({ a: { opens: 0, clicks: 0 }, b: { opens: 0, clicks: 0 } });

  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
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

  // ============= API CALLS =============
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
        setSmsTemplate(data.smsTemplate || DEFAULT_SMS_TEMPLATE); // ✅ LOAD SMS TEMPLATE
        setFieldMappings(data.fieldMappings || {});
        setAbTestMode(data.abTestMode || false);
        setSmsConsent(data.smsConsent || false);
      } else {
        setSenderName(auth.currentUser?.displayName?.split(' ')[0] || 'Team');
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }
  };

  // ============= SAVE SETTINGS =============
  const saveSettings = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'settings', 'templates');
      await setDoc(docRef, {
        senderName,
        templateA,
        templateB,
        whatsappTemplate,
        smsTemplate, // ✅ SAVE SMS TEMPLATE
        fieldMappings,
        abTestMode,
        smsConsent
      }, { merge: true });
    } catch (error) {
      console.warn('Failed to save settings:', error);
    }
  }, [user?.uid, senderName, templateA, templateB, whatsappTemplate, smsTemplate, fieldMappings, abTestMode, smsConsent]);

  useEffect(() => {
    if (!user?.uid) return;
    const handler = setTimeout(() => saveSettings(), 1500);
    return () => clearTimeout(handler);
  }, [saveSettings, user?.uid]);

  // ============= CSV UPLOAD =============
  const handleCsvUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      setCsvContent(content);

      const lines = content.split('\n').filter(line => line.trim() !== '');
      if (lines.length < 2) {
        alert('CSV must have headers and data rows.');
        return;
      }

      const headers = parseCsvRow(lines[0]).map(h => h.trim());
      setCsvHeaders(headers);
      setPreviewRecipient(null);

      const allVars = [...new Set([
        ...extractTemplateVariables(templateA.subject),
        ...extractTemplateVariables(templateA.body),
        ...extractTemplateVariables(templateB.subject),
        ...extractTemplateVariables(templateB.body),
        ...extractTemplateVariables(whatsappTemplate),
        ...extractTemplateVariables(smsTemplate), // ✅ SMS VARIABLE EXTRACTION
        'sender_name'
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

      let hotEmails = 0, warmEmails = 0, whatsappCount = 0, firstValid = null;
      const validContacts = [];
      const newLeadScores = {};
      const newLastSent = {};

      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvRow(lines[i]);
        if (values.length !== headers.length) continue;

        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });

        let score = 50;
        if (row.lead_quality === 'HOT') score += 30;
        if (parseFloat(row.rating) >= 4.8) score += 20;
        if (parseInt(row.review_count) > 100) score += 10;
        if (clickStats[row.email]?.count > 0) score += 20;
        if (dealStage[row.email] === 'contacted') score += 10;
        score = Math.min(100, Math.max(0, score));
        newLeadScores[row.email] = score;

        if (isValidEmail(row.email)) {
          if (row.lead_quality === 'HOT') hotEmails++;
          else if (row.lead_quality === 'WARM') warmEmails++;
        }

        const rawPhone = row.whatsapp_number || row.phone_raw;
        const formattedPhone = formatForDialing(rawPhone);
        if (formattedPhone) {
          whatsappCount++;
          validContacts.push({
            business: row.business_name || 'Business',
            address: row.address || '',
            phone: formattedPhone,
            email: row.email,
            place_id: row.place_id || '',
            url: `https://wa.me/${formattedPhone}?text=${encodeURIComponent(
              renderPreviewText(whatsappTemplate, row, fieldMappings, senderName)
            )}`
          });
        }

        if (!firstValid) firstValid = row;
      }

      validContacts.sort((a, b) => (newLeadScores[b.email] || 0) - (newLeadScores[a.email] || 0));

      setPreviewRecipient(firstValid);
      setValidEmails(leadQualityFilter === 'HOT' ? hotEmails : 
                    leadQualityFilter === 'WARM' ? warmEmails : hotEmails + warmEmails);
      setValidWhatsApp(whatsappCount);
      setWhatsappLinks(validContacts);
      setLeadScores(newLeadScores);
      setLastSent(newLastSent);
    };
    reader.readAsText(file);
  };

  // ============= IMAGE UPLOAD =============
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

  // ============= DEAL STAGE AUTOMATION =============
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

  // ============= AUTH STATE =============
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        loadSettings(user.uid);
        loadClickStats();
        loadDeals();
        loadAbResults();
      } else {
        setUser(null);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // ============= GMAIL AUTH =============
  const requestGmailToken = () => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') return reject('Browser only');
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) return reject('Google Client ID missing');
      if (!window.google?.accounts?.oauth2) return reject('Google not loaded');
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/gmail.send',
        callback: (res) => res.access_token ? resolve(res.access_token) : reject('No token'),
        error_callback: reject
      });
      client.requestAccessToken();
    });
  };

  // ============= SEND EMAILS =============
  const handleSendEmails = async (templateToSend = null) => {
    if (!csvContent || !senderName.trim() || validEmails === 0) {
      alert('Check CSV, sender name, and valid emails.');
      return;
    }
    
    if (abTestMode && !templateToSend) {
      alert('Please select Template A or B.');
      return;
    }

    if (abTestMode) {
      if (templateToSend === 'A' && !templateA.subject.trim()) {
        alert('Template A subject is required.');
        return;
      }
      if (templateToSend === 'B' && !templateB.subject.trim()) {
        alert('Template B subject is required.');
        return;
      }
    } else {
      if (!templateA.subject.trim()) {
        alert('Email subject is required.');
        return;
      }
    }

    setIsSending(true);
    setStatus('Getting Gmail access...');

    try {
      const accessToken = await requestGmailToken();

      const imagesWithBase64 = await Promise.all(
        emailImages.map(async (img) => {
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

      const lines = csvContent.split('\n').filter(line => line.trim() !== '');
      const headers = parseCsvRow(lines[0]).map(h => h.trim());
      let validRecipients = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvRow(lines[i]);
        if (values.length !== headers.length) continue;
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        if (isValidEmail(row.email)) {
          if (leadQualityFilter === 'all' || row.lead_quality === leadQualityFilter) {
            validRecipients.push(row);
          }
        }
      }

      let recipientsToSend = [];
      if (abTestMode && templateToSend) {
        const half = Math.ceil(validRecipients.length / 2);
        if (templateToSend === 'A') {
          recipientsToSend = validRecipients.slice(0, half);
        } else {
          recipientsToSend = validRecipients.slice(half);
        }
      } else {
        recipientsToSend = validRecipients;
      }

      if (recipientsToSend.length === 0) {
        setStatus('❌ No valid leads for selected criteria.');
        setIsSending(false);
        return;
      }

      const templateToSendData = abTestMode 
        ? (templateToSend === 'A' ? templateA : templateB)
        : templateA;

      setStatus(`Sending Template ${abTestMode ? templateToSend : ''} to ${recipientsToSend.length} leads...`);

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent: [headers.join(','), ...recipientsToSend.map(r => 
            headers.map(h => `"${r[h] || ''}"`).join(',')
          ).join('\n')].join('\n'),
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
        setStatus(`✅ Template ${abTestMode ? templateToSend : ''}: ${data.sent}/${data.total} emails sent!`);
        if (abTestMode) {
          const newResults = { ...abResults };
          if (templateToSend === 'A') {
            newResults.a.sent = data.sent;
          } else {
            newResults.b.sent = data.sent;
          }
          setAbResults(newResults);
          await setDoc(doc(db, 'ab_results', user.uid), newResults);
        }
      } else {
        setStatus(`❌ ${data.error}`);
      }
    } catch (err) {
      setStatus(`❌ ${err.message}`);
    } finally {
      setIsSending(false);
    }
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

  const allVars = [...new Set([
    ...extractTemplateVariables(templateA.subject),
    ...extractTemplateVariables(templateA.body),
    ...extractTemplateVariables(templateB.subject),
    ...extractTemplateVariables(templateB.body),
    ...extractTemplateVariables(whatsappTemplate),
    ...extractTemplateVariables(smsTemplate), // ✅ SMS VARIABLES
    'sender_name',
    ...emailImages.map(img => img.placeholder.replace(/{{|}}/g, ''))
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
    <div className="min-h-screen bg-gray-50">
      <Head><title>B2B Growth Engine | Strategic Outreach</title></Head>
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">B2B Growth Engine</h1>
          <button onClick={() => signOut(auth)} className="text-sm text-gray-600">
            Sign Out
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-4">1. Upload Leads CSV</h2>
              <input type="file" accept=".csv" onChange={handleCsvUpload} className="w-full p-2 border rounded" />
              <p className="text-xs text-gray-600 mt-2">
                Auto-scores leads and binds fields.
              </p>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">Target Lead Quality</label>
                <select
                  value={leadQualityFilter}
                  onChange={(e) => setLeadQualityFilter(e.target.value)}
                  className="w-full p-1 border rounded text-sm"
                >
                  <option value="HOT">🔥 HOT Leads Only</option>
                  <option value="WARM">📈 WARM Leads Only</option>
                  <option value="all">👥 All Leads</option>
                </select>
                <p className="text-xs text-green-600 mt-1">
                  {validEmails} {leadQualityFilter} leads ready
                </p>
              </div>
              
              <div className="mt-3">
                <label className="flex items-center text-sm">
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

            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-4">2. Field Mappings</h2>
              {allVars.map(varName => (
                <div key={varName} className="flex items-center mb-2">
                  <span className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono mr-2">
                    {`{{${varName}}}`}
                  </span>
                  <select
                    value={fieldMappings[varName] || ''}
                    onChange={(e) => handleMappingChange(varName, e.target.value)}
                    className="text-xs border rounded px-1 py-0.5 flex-1"
                  >
                    <option value="">-- Map to Column --</option>
                    {csvHeaders.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                    {varName === 'sender_name' && (
                      <option value="sender_name">Use sender name</option>
                    )}
                  </select>
                </div>
              ))}
            </div>

            {/* <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-sm font-bold text-green-800">💰 Revenue Pipeline</div>
              <div className="text-lg font-bold text-green-600">${pipelineValue.toLocaleString()}</div>
              <div className="text-xs text-green-700">Potential deals this month</div>
            </div> */}

            {abSummary}
          </div>

          {/* MIDDLE */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-3">3. Your Name (Sender)</h2>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="e.g., Alex from GrowthCo"
              />
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-bold">4. Email Template</h2>
                <label className="flex items-center text-sm">
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
                  <div className="border rounded p-3">
                    <h3 className="font-bold text-green-600 mb-2">Template A (Offer)</h3>
                    <input
                      type="text"
                      value={templateA.subject}
                      onChange={(e) => setTemplateA({ ...templateA, subject: e.target.value })}
                      className="w-full p-1 border rounded mb-1 text-sm"
                      placeholder="Subject A"
                    />
                    <textarea
                      value={templateA.body}
                      onChange={(e) => setTemplateA({ ...templateA, body: e.target.value })}
                      rows="3"
                      className="w-full p-1 font-mono text-sm border rounded"
                      placeholder="Body A..."
                    />
                  </div>
                  
                  <div className="border rounded p-3">
                    <h3 className="font-bold text-blue-600 mb-2">Template B (Call)</h3>
                    <input
                      type="text"
                      value={templateB.subject}
                      onChange={(e) => setTemplateB({ ...templateB, subject: e.target.value })}
                      className="w-full p-1 border rounded mb-1 text-sm"
                      placeholder="Subject B"
                    />
                    <textarea
                      value={templateB.body}
                      onChange={(e) => setTemplateB({ ...templateB, body: e.target.value })}
                      rows="3"
                      className="w-full p-1 font-mono text-sm border rounded"
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
                    className="w-full p-2 border rounded mb-2"
                    placeholder="Subject"
                  />
                  <textarea
                    value={templateA.body}
                    onChange={(e) => setTemplateA({ ...templateA, body: e.target.value })}
                    rows="4"
                    className="w-full p-2 font-mono border rounded"
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
                        ? 'bg-gray-400'
                        : 'bg-green-600 text-white'
                    }`}
                  >
                    📧 Send Template A (First {Math.ceil(validEmails / 2)} leads)
                  </button>
                  <button
                    onClick={() => handleSendEmails('B')}
                    disabled={isSending || !csvContent || !senderName.trim() || validEmails === 0}
                    className={`w-full py-2.5 rounded font-bold ${
                      isSending || !csvContent || !senderName.trim() || validEmails === 0
                        ? 'bg-gray-400'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    📧 Send Template B (Last {Math.floor(validEmails / 2)} leads)
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleSendEmails()}
                  disabled={isSending || !csvContent || !senderName.trim() || validEmails === 0}
                  className={`w-full py-2.5 rounded font-bold mt-4 ${
                    isSending || !csvContent || !senderName.trim() || validEmails === 0
                      ? 'bg-gray-400'
                      : 'bg-green-600 text-white'
                  }`}
                >
                  📧 Send Emails ({validEmails})
                </button>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-3">5. WhatsApp Template</h2>
              <textarea
                value={whatsappTemplate}
                onChange={(e) => setWhatsappTemplate(e.target.value)}
                rows="3"
                className="w-full p-2 font-mono border rounded"
                placeholder="Hi {{business_name}}! ..."
              />
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-3">6. SMS Template</h2>
              <textarea
                value={smsTemplate}
                onChange={(e) => setSmsTemplate(e.target.value)}
                rows="3"
                className="w-full p-2 font-mono border rounded"
                placeholder="Hi {{business_name}}! ..."
              />
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-3">7. Email Images (Optional)</h2>
              <input
                type="file"
                accept="image/jpeg,image/png"
                multiple
                onChange={handleImageUpload}
                className="w-full p-2 border rounded"
              />
              {emailImages.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Use in template: {emailImages.map(img => img.placeholder).join(', ')}
                </p>
              )}
            </div>

            {status && (
              <div className={`p-3 rounded text-center whitespace-pre-line ${
                status.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {status}
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-3">8. Email Preview</h2>
              <div className="bg-gray-50 p-4 rounded border">
                <div className="text-sm text-gray-500">To: {previewRecipient?.email || 'email@example.com'}</div>
                <div className="mt-1 font-medium">
                  {renderPreviewText(
                    abTestMode ? templateA.subject : templateA.subject,
                    previewRecipient,
                    fieldMappings,
                    senderName
                  )}
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm">
                  {renderPreviewText(
                    abTestMode ? templateA.body : templateA.body,
                    previewRecipient,
                    fieldMappings,
                    senderName
                  )}
                </div>
              </div>
            </div>

            {abTestMode && (
              <div className="bg-white p-6 rounded-xl shadow">
                <h2 className="text-xl font-bold mb-3">9. Template B Preview</h2>
                <div className="bg-gray-50 p-4 rounded border">
                  <div className="text-sm text-gray-500">To: {previewRecipient?.email || 'email@example.com'}</div>
                  <div className="mt-1 font-medium">
                    {renderPreviewText(templateB.subject, previewRecipient, fieldMappings, senderName)}
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-sm">
                    {renderPreviewText(templateB.body, previewRecipient, fieldMappings, senderName)}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-3">10. WhatsApp Preview</h2>
              <div className="bg-gray-50 p-4 rounded border">
                <div className="text-sm text-gray-500">
                  To: {previewRecipient?.whatsapp_number || previewRecipient?.phone_raw || '9477...'}
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm">
                  {renderPreviewText(whatsappTemplate, previewRecipient, fieldMappings, senderName)}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-3">11. SMS Preview</h2>
              <div className="bg-gray-50 p-4 rounded border">
                <div className="text-sm text-gray-500">
                  To: {previewRecipient?.phone_raw || '9477...'}
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm">
                  {renderPreviewText(smsTemplate, previewRecipient, fieldMappings, senderName)}
                </div>
              </div>
            </div>

            {whatsappLinks.length > 0 && (
              <div className="bg-white p-4 rounded-xl shadow">
                <h2 className="text-lg font-bold text-gray-800 mb-3">12. Multi-Channel Outreach ({whatsappLinks.length})</h2>
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {whatsappLinks.map((link, i) => {
                    const last = lastSent[link.email];
                    const score = leadScores[link.email] || 0;
                    return (
                      <div key={i} className="p-3 bg-gray-50 rounded-lg border">
                        <div className="flex justify-between">
                          <div>
                            <div className="font-medium">{link.business}</div>
                            <div className="text-sm text-gray-600">+{link.phone}</div>
                            <div className="text-xs text-blue-600">Score: {score}/100</div>
                            {last && (
                              <div className="text-xs text-green-600 mt-1">📅 Last: {new Date(last).toLocaleDateString()}</div>
                            )}
                          </div>
                          <div className="flex flex-col items-end space-y-1">
                            <div className="flex space-x-1">
                              <button
                                onClick={() => navigator.clipboard.writeText(`+${link.phone}`)}
                                className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
                              >
                                Copy
                              </button>
                              <button
                                onClick={() => handleCall(link.phone)}
                                className="text-xs bg-green-600 text-white px-2 py-1 rounded"
                              >
                                Call
                              </button>
                              <a
                                href={link.url}
                                target="_blank"
                                className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
                              >
                                WhatsApp
                              </a>
                              {link.place_id && (
                                <a
                                  href={`https://search.google.com/local/writereview?placeid=${link.place_id}`}
                                  target="_blank"
                                  className="text-xs bg-purple-600 text-white px-2 py-1 rounded"
                                >
                                  Google
                                </a>
                              )}
                              <a
                                href={`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(link.business)}`}
                                target="_blank"
                                className="text-xs bg-blue-800 text-white px-2 py-1 rounded"
                              >
                                LinkedIn
                              </a>
                            </div>
                            
                            {smsConsent && (
                              <button
                                onClick={() => handleSendSMS(link)}
                                className="text-xs bg-orange-600 text-white px-2 py-1 rounded mt-1 w-full"
                              >
                                SMS
                              </button>
                            )}
                            
                            <select
                              value={dealStage[link.email] || 'new'}
                              onChange={(e) => updateDealStage(link.email, e.target.value)}
                              className="text-xs border rounded px-1 py-0.5 mt-1 w-full"
                            >
                              <option value="new">New</option>
                              <option value="contacted">Contacted</option>
                              <option value="demo">Demo Scheduled</option>
                              <option value="proposal">Proposal Sent</option>
                              <option value="won">Closed Won</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}