// app/dashboard/page.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
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

// ============= DEFAULT TEMPLATES (WITH A/B TESTING) =============
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

// ============= PHONE HANDLING =============
function formatForDialing(raw) {
  if (!raw || raw === 'N/A') return null;
  let cleaned = raw.toString().replace(/\D/g, '');
  if (cleaned.startsWith('0') && cleaned.length >= 9) {
    cleaned = '94' + cleaned.slice(1);
  }
  return /^[1-9]\d{9,14}$/.test(cleaned) ? cleaned : null;
}

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
  const [abTestMode, setAbTestMode] = useState(false); // ✅ A/B TESTING
  const [templateA, setTemplateA] = useState(DEFAULT_TEMPLATE_A);
  const [templateB, setTemplateB] = useState(DEFAULT_TEMPLATE_B); // ✅ A/B TESTING
  const [whatsappTemplate, setWhatsappTemplate] = useState(DEFAULT_WHATSAPP_TEMPLATE);
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
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState('');

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

  const loadSettings = async (userId) => {
    try {
      const docRef = doc(db, 'users', userId, 'settings', 'templates');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setSenderName(data.senderName || 'Team');
        setTemplateA(data.templateA || DEFAULT_TEMPLATE_A);
        setTemplateB(data.templateB || DEFAULT_TEMPLATE_B); // ✅ A/B
        setWhatsappTemplate(data.whatsappTemplate || DEFAULT_WHATSAPP_TEMPLATE);
        setFieldMappings(data.fieldMappings || {});
        setAbTestMode(data.abTestMode || false); // ✅ A/B
      } else {
        setSenderName(auth.currentUser?.displayName?.split(' ')[0] || 'Team');
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }
  };

  // ============= CSV UPLOAD WITH CUSTOM BINDING + LEAD SCORING =============
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

      // ✅ AUTO-FIELD MAPPING (CUSTOM BINDING)
      const allVars = [...new Set([
        ...extractTemplateVariables(templateA.subject),
        ...extractTemplateVariables(templateA.body),
        ...extractTemplateVariables(templateB.subject), // ✅ A/B
        ...extractTemplateVariables(templateB.body),     // ✅ A/B
        ...extractTemplateVariables(whatsappTemplate),
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

        // ✅ LEAD SCORING
        let score = 50;
        if (row.lead_quality === 'HOT') score += 30;
        if (parseFloat(row.rating) >= 4.8) score += 20;
        if (parseInt(row.review_count) > 100) score += 10;
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
          // ✅ CUSTOM BINDING IN WHATSAPP
          const message = renderPreviewText(whatsappTemplate, row, fieldMappings, senderName);
          validContacts.push({
            business: row.business_name || 'Business',
            phone: formattedPhone,
            email: row.email,
            url: `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
          });
        }

        if (!firstValid) firstValid = row;
      }

      // ✅ SORT BY SCORE (HIGHEST FIRST)
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

  // ============= FIELD MAPPING HANDLER =============
  const handleMappingChange = (varName, csvColumn) => {
    setFieldMappings(prev => ({ ...prev, [varName]: csvColumn }));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        loadSettings(user.uid);
        loadClickStats();
      } else {
        setUser(null);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

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

  // ============= SEND EMAILS (WITH A/B TESTING) =============
  const handleSendEmails = async () => {
    if (!csvContent || !senderName.trim() || validEmails === 0) {
      alert('Check CSV, sender name, and valid emails.');
      return;
    }
    if (abTestMode && (!templateA.subject.trim() || !templateB.subject.trim())) {
      alert('Both Template A and B need a subject.');
      return;
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

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent,
          senderName,
          fieldMappings,
          accessToken,
          abTestMode, // ✅ A/B TESTING
          templateA,
          templateB, // ✅ A/B TESTING
          leadQualityFilter,
          emailImages: imagesWithBase64
        })
      });

      const data = await res.json();
      if (res.ok) {
        if (abTestMode) {
          setStatus(`✅ A/B Test Complete!\nTemplate A: ${data.a.sent} sent\nTemplate B: ${data.b.sent} sent`);
        } else {
          setStatus(`✅ ${data.sent}/${data.total} ${leadQualityFilter} leads emailed!`);
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

  // ============= ALL VARS FOR FIELD MAPPING =============
  const allVars = [...new Set([
    ...extractTemplateVariables(templateA.subject),
    ...extractTemplateVariables(templateA.body),
    ...extractTemplateVariables(templateB.subject),
    ...extractTemplateVariables(templateB.body),
    ...extractTemplateVariables(whatsappTemplate),
    'sender_name',
    ...emailImages.map(img => img.placeholder.replace(/{{|}}/g, ''))
  ])];

  // ============= MAIN UI =============
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
          {/* LEFT: CSV & MAPPINGS */}
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
          </div>

          {/* MIDDLE: TEMPLATES */}
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
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-3">5. Email Images (Optional)</h2>
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

            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-3">6. WhatsApp Template</h2>
              <textarea
                value={whatsappTemplate}
                onChange={(e) => setWhatsappTemplate(e.target.value)}
                rows="5"
                className="w-full p-2 font-mono border rounded"
                placeholder="Hi {{business_name}}! ..."
              />
            </div>

            <div className="space-y-2">
              <button
                onClick={handleSendEmails}
                disabled={isSending || !csvContent || !senderName.trim() || validEmails === 0}
                className={`w-full py-2.5 rounded font-bold ${
                  isSending || !csvContent || !senderName.trim() || validEmails === 0
                    ? 'bg-gray-400'
                    : 'bg-green-600 text-white'
                }`}
              >
                {abTestMode ? '🧪 Send A/B Test' : '📧 Send Emails'} ({validEmails})
              </button>
            </div>

            {status && (
              <div className={`p-3 rounded text-center whitespace-pre-line ${
                status.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {status}
              </div>
            )}
          </div>

          {/* RIGHT: PREVIEW & CONTACTS */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-3">7. Email Preview</h2>
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
                <h2 className="text-xl font-bold mb-3">8. Template B Preview</h2>
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
              <h2 className="text-xl font-bold mb-3">9. WhatsApp Preview</h2>
              <div className="bg-gray-50 p-4 rounded border">
                <div className="text-sm text-gray-500">
                  To: {previewRecipient?.whatsapp_number || previewRecipient?.phone_raw || '9477...'}
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm">
                  {renderPreviewText(whatsappTemplate, previewRecipient, fieldMappings, senderName)}
                </div>
              </div>
            </div>

            {/* ✅ WHATSAPP CONTACTS WITH ALL FEATURES */}
            {whatsappLinks.length > 0 && (
              <div className="bg-white p-4 rounded-xl shadow">
                <h2 className="text-lg font-bold text-gray-800 mb-3">10. WhatsApp Contacts ({whatsappLinks.length})</h2>
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
                          <div className="flex space-x-1">
                            <button
                              onClick={() => navigator.clipboard.writeText(`+${link.phone}`)}
                              className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
                            >
                              Copy
                            </button>
                            <a
                              href={link.url}
                              target="_blank"
                              className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
                            >
                              WhatsApp
                            </a>
                            <button
                              onClick={() => handleCall(link.phone)}
                              className="text-xs bg-green-600 text-white px-2 py-1 rounded"
                            >
                              Call
                            </button>
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