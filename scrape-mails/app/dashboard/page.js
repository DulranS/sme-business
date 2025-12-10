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

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

// ============= DEFAULT TEMPLATES =============
const DEFAULT_TEMPLATE_A = {
  subject: '🚀 Special Offer for {{business_name}}',
  body: 'Hi {{business_name}},\n\nWe noticed your business at {{address}} and believe our [service] could help you grow faster. As a limited-time offer, use code **WELCOME20** for 20% off your first purchase.\n\nBest regards,\n{{sender_name}}\nGrowthCo'
};

const FOLLOW_UP_1 = {
  subject: 'Quick follow-up: Your WELCOME20 offer',
  body: 'Hi {{business_name}},\n\nJust circling back — your **20% off** offer is still available! 3 businesses signed up this week.\n\nUse code: WELCOME20\n\nBest,\n{{sender_name}}'
};

const BREAKUP_EMAIL = {
  subject: 'Should I close your file?',
  body: 'Hi {{business_name}},\n\nI’ve tried reaching out a few times but haven’t heard back. If you’re not interested, just reply “STOP” and I’ll close your file.\n\nOtherwise, your offer expires Friday!\n\nBest,\n{{sender_name}}'
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

// ============= CORE HELPER FUNCTIONS =============
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
  const [templateA, setTemplateA] = useState(DEFAULT_TEMPLATE_A);
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

  // ============= LOAD CLICK STATS =============
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

  // ============= AUTH & SETTINGS =============
  const loadSettings = async (userId) => {
    try {
      const docRef = doc(db, 'users', userId, 'settings', 'templates');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setSenderName(data.senderName || 'Team');
        setTemplateA(data.templateA || DEFAULT_TEMPLATE_A);
        setWhatsappTemplate(data.whatsappTemplate || DEFAULT_WHATSAPP_TEMPLATE);
        setFieldMappings(data.fieldMappings || {});
      } else {
        setSenderName(auth.currentUser?.displayName?.split(' ')[0] || 'Team');
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }
  };

  // ============= CSV UPLOAD WITH LEAD SCORING & SORTING =============
// ============= CSV UPLOAD WITH LEAD SCORING, SORTING & AUTO WHATSAPP =============
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

    // Auto-map fields
    const initialMappings = {};
    ['business_name', 'address', 'sender_name', 'email'].forEach(varName => {
      if (headers.includes(varName)) initialMappings[varName] = varName;
    });
    if (headers.includes('email')) initialMappings.email = 'email';
    initialMappings.sender_name = 'sender_name';
    setFieldMappings(initialMappings);

    let hotEmails = 0, warmEmails = 0, whatsappCount = 0, firstValid = null;
    const validContacts = [];
    const newLeadScores = {};
    const newLastSent = {};

    // Process all rows
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvRow(lines[i]);
      if (values.length !== headers.length) continue;

      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });

      // ✅ LEAD SCORING ALGORITHM (PRODUCTION-GRADE)
      let score = 50; // Base
      if (row.lead_quality === 'HOT') score += 30; // Manual qualification
      if (parseFloat(row.rating) >= 4.8) score += 20; // High satisfaction
      if (parseInt(row.review_count) > 100) score += 10; // Established business
      score = Math.min(100, Math.max(0, score)); // Clamp to 0-100
      newLeadScores[row.email] = score;

      // Count valid emails
      if (isValidEmail(row.email)) {
        if (row.lead_quality === 'HOT') hotEmails++;
        else if (row.lead_quality === 'WARM') warmEmails++;
      }

      // ✅ WHATSAPP CONTACT GENERATION
      const rawPhone = row.whatsapp_number || row.phone_raw;
      const formattedPhone = formatForDialing(rawPhone);
      if (formattedPhone) {
        whatsappCount++;
        // Generate WhatsApp message with template
        const message = whatsappTemplate
          .replace(/{{business_name}}/g, row.business_name || '')
          .replace(/{{address}}/g, row.address || '')
          .replace(/{{sender_name}}/g, senderName || 'Team');
        validContacts.push({
          business: row.business_name || 'Business',
          phone: formattedPhone,
          email: row.email,
          url: `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
        });
      }

      if (!firstValid) firstValid = row;
    }

    // ✅ SORT CONTACTS BY LEAD SCORE (HIGHEST FIRST)
    validContacts.sort((a, b) => {
      const scoreA = newLeadScores[a.email] || 0;
      const scoreB = newLeadScores[b.email] || 0;
      return scoreB - scoreA; // Descending order
    });

    // Update state
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

  // ============= AUTH STATE =============
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

  // ============= SEND DRIP CAMPAIGN =============
  const handleSendDrip = async () => {
    if (!csvContent || !senderName.trim() || validEmails === 0) {
      alert('Check CSV, sender name, and valid emails.');
      return;
    }

    setIsSending(true);
    setStatus('Starting drip campaign...');

    try {
      const accessToken = await requestGmailToken();
      setStatus('Sending Day 0 emails...');

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent,
          senderName,
          fieldMappings,
          accessToken,
          template: templateA,
          leadQualityFilter,
          isDrip: true,
          dripStep: 0
        })
      });

      const data = await res.json();
      if (res.ok) {
        setStatus(`✅ Day 0: ${data.sent} emails sent!\n\nDay 2 & Day 5 will be sent automatically.`);
        
        const newLastSent = { ...lastSent };
        whatsappLinks.forEach(link => {
          newLastSent[link.email] = new Date().toISOString();
        });
        setLastSent(newLastSent);
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
          {/* LEFT */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-4">1. Upload Leads CSV</h2>
              <input type="file" accept=".csv" onChange={handleCsvUpload} className="w-full p-2 border rounded" />
              <p className="text-xs text-gray-600 mt-2">
                Auto-scores leads using rating + reviews.
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
              <h2 className="text-xl font-bold mb-4">2. Strategic Actions</h2>
              {validEmails > 0 && (
                <button
                  onClick={handleSendDrip}
                  disabled={isSending}
                  className={`w-full py-2.5 rounded font-bold mb-2 ${
                    isSending ? 'bg-gray-400' : 'bg-green-600 text-white'
                  }`}
                >
                  📧 Start 3-Step Drip Campaign
                </button>
              )}
              {Object.values(clickStats).some(s => s.count > 0) && (
                <div className="text-sm bg-blue-50 p-2 rounded">
                  ✅ {Object.values(clickStats).reduce((a, b) => a + (b.count || 0), 0)} leads clicked your offer!
                </div>
              )}
            </div>
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
              <h2 className="text-xl font-bold mb-3">4. Initial Email Template</h2>
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
              <p className="text-xs text-gray-500 mt-1">
                Drip sequence: Day 0 (this) → Day 2 (follow-up) → Day 5 (breakup)
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-3">5. WhatsApp Template</h2>
              <textarea
                value={whatsappTemplate}
                onChange={(e) => setWhatsappTemplate(e.target.value)}
                rows="5"
                className="w-full p-2 font-mono border rounded"
                placeholder="Hi {{business_name}}! ..."
              />
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
              <h2 className="text-xl font-bold mb-3">6. Lead Preview</h2>
              {previewRecipient ? (
                <div className="bg-gray-50 p-4 rounded border">
                  <div className="text-sm text-gray-500">Business: {previewRecipient.business_name}</div>
                  <div className="text-sm text-gray-500">Score: {leadScores[previewRecipient.email] || 'N/A'}/100</div>
                  <div className="text-sm text-gray-500">Email: {previewRecipient.email}</div>
                  <div className="text-sm text-gray-500">Phone: {previewRecipient.phone_raw}</div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Upload CSV to preview lead</div>
              )}
            </div>

            {/* ✅ STRATEGIC WHATSAPP CONTACTS — SORTED BY SCORE */}
            {whatsappLinks.length > 0 && (
              <div className="bg-white p-4 rounded-xl shadow">
                <h2 className="text-lg font-bold text-gray-800 mb-3">7. WhatsApp Contacts ({whatsappLinks.length})</h2>
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