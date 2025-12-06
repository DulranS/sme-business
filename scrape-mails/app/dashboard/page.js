// app/dashboard/page.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import { auth,db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import Head from 'next/head';

// Default templates (always present)
const DEFAULT_EMAIL_TEMPLATE = {
  subject: 'Special Offer for {{business_name}}',
  body: 'Hello {{business_name}},\n\nWe noticed your business at {{address}} could benefit from our solution. As a special offer, use code WELCOME20 for 20% off your first purchase.\n\nBest regards,\n{{sender_name}}'
};

const DEFAULT_WHATSAPP_TEMPLATE = 
  'Hi {{business_name}}! 👋\n\nWe’re {{sender_name}} from GrowthCo. We noticed your business at {{address}} and thought you’d benefit from our services.\n\nUse code WELCOME20 for 20% off!\n\nReply STOP to opt out.';

const DEFAULT_FIELD_MAPPINGS = {
  business_name: 'business_name',
  address: 'address',
  sender_name: 'sender_name',
  email: 'email',
  whatsapp_number: 'whatsapp_number',
  phone_raw: 'phone_raw'
};

// Validate Sri Lankan mobile: must start with 07
const isValidSriLankanMobile = (raw) => {
  if (!raw) return false;
  const cleaned = raw.replace(/\D/g, '');
  return cleaned.startsWith('07') && cleaned.length >= 9 && cleaned.length <= 10;
};

// Validate email
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const t = email.trim();
  return t.length > 0 && t.includes('@') && t.includes('.');
};

// Extract template vars
const extractTemplateVariables = (text) => {
  if (!text) return [];
  const matches = text.match(/\{\{\s*([^}]+?)\s*\}\}/g) || [];
  return [...new Set(matches.map(m => m.replace(/\{\{\s*|\s*\}\}/g, '').trim()))];
};

// Render preview
const renderPreviewText = (text, recipient, fieldMappings, senderName) => {
  if (!text) return '';
  let result = text;
  Object.entries(fieldMappings).forEach(([varName, csvColumn]) => {
    const regex = new RegExp(`{{\\s*${varName}\\s*}}`, 'g');
    if (varName === 'sender_name') {
      result = result.replace(regex, senderName || '[Sender]');
    } else if (recipient && csvColumn && recipient[csvColumn] !== undefined) {
      result = result.replace(regex, String(recipient[csvColumn]));
    } else {
      result = result.replace(regex, `[MISSING: ${varName}]`);
    }
  });
  return result;
};

// Parse CSV row
function parseCsvRow(str) {
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
}

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [csvContent, setCsvContent] = useState('');
  const [senderName, setSenderName] = useState('');
  const [emailTemplate, setEmailTemplate] = useState(DEFAULT_EMAIL_TEMPLATE);
  const [whatsappTemplate, setWhatsappTemplate] = useState(DEFAULT_WHATSAPP_TEMPLATE);
  const [fieldMappings, setFieldMappings] = useState(DEFAULT_FIELD_MAPPINGS);
  const [previewRecipient, setPreviewRecipient] = useState(null); // ✅ FIXED TYPO
  const [validEmails, setValidEmails] = useState(0);
  const [validWhatsApp, setValidWhatsApp] = useState(0);
  const [whatsappLinks, setWhatsappLinks] = useState([]);
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

  // 💾 LOAD SETTINGS FROM FIRESTORE
  const loadSettings = async (userId) => {
    try {
      const docRef = doc(db, 'users', userId, 'settings', 'templates');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.senderName !== undefined) setSenderName(data.senderName);
        if (data.emailTemplate !== undefined) setEmailTemplate(data.emailTemplate);
        if (data.whatsappTemplate !== undefined) setWhatsappTemplate(data.whatsappTemplate);
        if (data.fieldMappings !== undefined) setFieldMappings(data.fieldMappings);
      } else {
        // First time: set sender name, keep default templates
        const initialSender = auth.currentUser?.displayName?.split(' ')[0] || 'Team';
        setSenderName(initialSender);
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }
  };

  // Auth + load settings
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        loadSettings(user.uid);
      } else {
        setUser(null);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // 💾 AUTO-SAVE SETTINGS
  const saveSettings = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'settings', 'templates');
      await setDoc(docRef, {
        senderName,
        emailTemplate,
        whatsappTemplate,
        fieldMappings
      }, { merge: true });
    } catch (error) {
      console.warn('Failed to save settings:', error);
    }
  }, [user?.uid, senderName, emailTemplate, whatsappTemplate, fieldMappings]);

  useEffect(() => {
    if (!user?.uid) return;
    const handler = setTimeout(() => saveSettings(), 1500);
    return () => clearTimeout(handler);
  }, [user?.uid, senderName, emailTemplate, whatsappTemplate, fieldMappings]);

  // Handle CSV upload
  const handleCsvUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      setCsvContent(content);
      const lines = content.split('\n').filter(l => l.trim() !== '');
      if (lines.length < 2) {
        alert('CSV must have headers and data rows.');
        setValidEmails(0); setValidWhatsApp(0);
        return;
      }
      const headers = parseCsvRow(lines[0]);
      const emailIdx = headers.indexOf('email');
      const waNumIdx = headers.indexOf('whatsapp_number');
      const phoneIdx = headers.indexOf('phone_raw');
      let emailCount = 0, waCount = 0, firstValid = null;
      for (let i = 1; i < lines.length; i++) {
        const vals = parseCsvRow(lines[i]);
        if (vals.length !== headers.length) continue;
        const row = {};
        headers.forEach((h, j) => row[h] = vals[j] || '');
        if (emailIdx !== -1 && isValidEmail(row.email)) emailCount++;
        const rawPhone = row.whatsapp_number || row.phone_raw;
        if (rawPhone && isValidSriLankanMobile(rawPhone)) waCount++;
        if (!firstValid) firstValid = row;
      }
      setPreviewRecipient(firstValid);
      setValidEmails(emailCount);
      setValidWhatsApp(waCount);
    };
    reader.readAsText(file);
  };

  const allVars = [...new Set([
    ...extractTemplateVariables(emailTemplate.subject),
    ...extractTemplateVariables(emailTemplate.body),
    ...extractTemplateVariables(whatsappTemplate),
    'sender_name'
  ])];

  const handleMappingChange = (variable, col) => setFieldMappings(p => ({ ...p, [variable]: col }));

  // Gmail token
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

  // Send emails
  const handleSendEmails = async () => {
    if (!csvContent || !emailTemplate.subject.trim() || !senderName.trim() || validEmails === 0) {
      alert('Check CSV, subject, sender name, and valid emails.');
      return;
    }
    setIsSending(true); setStatus('Getting Gmail access...');
    try {
      const accessToken = await requestGmailToken();
      setStatus('Sending emails...');
      const res = await fetch('/api/send-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent,
          subject: emailTemplate.subject,
          body: emailTemplate.body,
          accessToken,
          senderName,
          fieldMappings
        })
      });
      const data = await res.json();
      setStatus(res.ok ? `✅ Emails sent: ${data.sent}/${data.total}` : `❌ ${data.error}`);
    } catch (err) {
      setStatus(`❌ ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // Generate WhatsApp links
  const handleGenerateWhatsAppLinks = async () => {
    if (!csvContent || !whatsappTemplate.trim() || !senderName.trim() || validWhatsApp === 0) {
      alert('Check CSV, WhatsApp message, sender name, and valid 07 numbers.');
      return;
    }
    setIsSending(true); setStatus('Generating WhatsApp links...');
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent,
          whatsappTemplate,
          senderName,
          fieldMappings
        })
      });
      const data = await res.json();
      if (res.ok) {
        setWhatsappLinks(data.contacts);
        setStatus(`✅ Generated ${data.total} WhatsApp links`);
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
        <div className="text-lg">Loading your session...</div>
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Head><title>B2B Messaging</title></Head>
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">B2B Messaging</h1>
          <button onClick={() => signOut(auth)} className="text-sm text-gray-600">
            Sign Out
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT: CSV & Mappings */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-4">1. Upload CSV</h2>
              <input type="file" accept=".csv" onChange={handleCsvUpload} className="w-full p-2 border rounded" />
              <p className="text-xs text-gray-600 mt-2">
                Only numbers starting with <code>07</code> will be used for WhatsApp.
              </p>
              {validEmails > 0 && <p className="text-sm text-green-600 mt-2">📧 {validEmails} valid emails</p>}
              {validWhatsApp > 0 && <p className="text-sm text-blue-600 mt-1">📱 {validWhatsApp} valid 07 numbers</p>}
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
                    <option value="">-- Column --</option>
                    {previewRecipient && Object.keys(previewRecipient).map(col => (
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

          {/* MIDDLE: Templates */}
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
              <h2 className="text-xl font-bold mb-3">4. Email Template</h2>
              <input
                type="text"
                value={emailTemplate.subject}
                onChange={(e) => setEmailTemplate({ ...emailTemplate, subject: e.target.value })}
                className="w-full p-2 border rounded mb-2"
                placeholder="Subject"
              />
              <textarea
                value={emailTemplate.body}
                onChange={(e) => setEmailTemplate({ ...emailTemplate, body: e.target.value })}
                rows="4"
                className="w-full p-2 font-mono border rounded"
                placeholder="Hello {{business_name}}, ..."
              />
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-3">5. WhatsApp Template</h2>
              <p className="text-xs text-gray-600 mb-2">
                Only for numbers starting with <code>07</code>.
              </p>
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
                📧 Send Emails ({validEmails})
              </button>
              <button
                onClick={handleGenerateWhatsAppLinks}
                disabled={isSending || !csvContent || !senderName.trim() || validWhatsApp === 0}
                className={`w-full py-2.5 rounded font-bold ${
                  isSending || !csvContent || !senderName.trim() || validWhatsApp === 0
                    ? 'bg-gray-400'
                    : 'bg-blue-600 text-white'
                }`}
              >
                📱 Generate WhatsApp Links ({validWhatsApp})
              </button>
            </div>

            {status && (
              <div className={`p-3 rounded text-center ${
                status.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {status}
              </div>
            )}
          </div>

          {/* RIGHT: Preview & Links */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-3">6. Email Preview</h2>
              <div className="bg-gray-50 p-4 rounded border">
                <div className="text-sm text-gray-500">To: {previewRecipient?.email || 'email@example.com'}</div>
                <div className="mt-1 font-medium">
                  {renderPreviewText(emailTemplate.subject, previewRecipient, fieldMappings, senderName)}
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm">
                  {renderPreviewText(emailTemplate.body, previewRecipient, fieldMappings, senderName)}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-3">7. WhatsApp Preview</h2>
              <div className="bg-gray-50 p-4 rounded border">
                <div className="text-sm text-gray-500">
                  To: {previewRecipient?.whatsapp_number || previewRecipient?.phone_raw || '077...'}
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm">
                  {renderPreviewText(whatsappTemplate, previewRecipient, fieldMappings, senderName)}
                </div>
              </div>
            </div>

            {whatsappLinks.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-xl font-bold">8. WhatsApp Links ({whatsappLinks.length})</h2>
                  <button onClick={() => setWhatsappLinks([])} className="text-sm text-red-600">Clear</button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {whatsappLinks.map((link, i) => (
                    <div key={i} className="flex justify-between items-center text-sm border-b pb-2">
                      <span className="text-gray-700 truncate max-w-[120px]">{link.business}</span>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-600">
                        Open
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}