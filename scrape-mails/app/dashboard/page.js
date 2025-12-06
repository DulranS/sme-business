// app/dashboard/page.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import { auth } from '../lib/firebase';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import Head from 'next/head';

// Helper: Validate email
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  return trimmed.length > 0 && trimmed.includes('@') && trimmed.includes('.');
};

// Helper: Check if phone starts with 07 (Sri Lankan mobile)
const isValidSriLankanMobile = (raw) => {
  if (!raw) return false;
  const cleaned = raw.replace(/\D/g, '');
  return cleaned.startsWith('07') && cleaned.length >= 9 && cleaned.length <= 10;
};

// Helper: Extract template variables
const extractTemplateVariables = (text) => {
  if (!text) return [];
  const matches = text.match(/\{\{\s*([^}]+?)\s*\}\}/g) || [];
  return [...new Set(matches.map(m => m.replace(/\{\{\s*|\s*\}\}/g, '').trim()))];
};

// Helper: Render preview
const renderPreviewText = (text, recipient, fieldMappings, senderName) => {
  if (!text) return '';
  let result = text;
  Object.entries(fieldMappings).forEach(([varName, csvColumn]) => {
    const regex = new RegExp(`{{\\s*${varName}\\s*}}`, 'g');
    if (varName === 'sender_name') {
      result = result.replace(regex, senderName || '[Sender Name]');
    } else if (recipient && csvColumn && recipient[csvColumn] !== undefined) {
      result = result.replace(regex, String(recipient[csvColumn]));
    } else {
      result = result.replace(regex, `[MISSING: ${varName}]`);
    }
  });
  return result;
};

// Helper: Parse CSV row
function parseCsvRow(str) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes && str[i + 1] === '"') {
      current += '"';
      i++;
    } else if (char === '"' && inQuotes) {
      inQuotes = false;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(field => field.trim().replace(/^"(.*)"$/, '$1'));
}

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [csvContent, setCsvContent] = useState('');
  // ✅ RESTORED: senderName is a top-level state
  const [senderName, setSenderName] = useState('');
  const [template, setTemplate] = useState({
    subject: 'Special Offer for {{business_name}}',
    body: 'Hello {{business_name}},\n\nWe noticed your business at {{address}} could benefit from our solution. As a special offer, use code WELCOME20 for 20% off your first purchase.\n\nBest regards,\n{{sender_name}}'
  });
  const [whatsappTemplate, setWhatsappTemplate] = useState(
    'Hi {{business_name}}! 👋\n\nWe’re {{sender_name}} from GrowthCo. We noticed your business at {{address}} and thought you’d benefit from our services.\n\nUse code WELCOME20 for 20% off!\n\nReply STOP to opt out.'
  );
  const [fieldMappings, setFieldMappings] = useState({
    business_name: 'business_name',
    address: 'address',
    sender_name: 'sender_name',
    email: 'email',
    whatsapp_number: 'whatsapp_number',
    phone_raw: 'phone_raw'
  });
  const [previewRecipient, setPreviewRecipient] = useState(null);
  const [validEmailCount, setValidEmailCount] = useState(0);
  const [validWhatsAppCount, setValidWhatsAppCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState('');
  const [whatsappLinks, setWhatsappLinks] = useState([]);

  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const [googleLoadError, setGoogleLoadError] = useState(null);

  useEffect(() => {
    if (window.google?.accounts?.oauth2?.initTokenClient) {
      setIsGoogleLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setIsGoogleLoaded(true);
    script.onerror = () => setGoogleLoadError('Failed to load Google Identity Services');

    document.head.appendChild(script);
    return () => document.head.removeChild(script);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        // ✅ Restore senderName from Firebase display name on load
        setSenderName(user.displayName?.split(' ')[0] || 'Team');
      }
    });
    return () => unsubscribe();
  }, []);

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
        setValidEmailCount(0);
        setValidWhatsAppCount(0);
        return;
      }

      const headers = parseCsvRow(lines[0]);
      const emailIndex = headers.indexOf('email');
      const whatsappIndex = headers.indexOf('whatsapp_number');
      const phoneIndex = headers.indexOf('phone_raw');

      let emailCount = 0;
      let whatsappCount = 0;
      let firstValid = null;

      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvRow(lines[i]);
        if (values.length !== headers.length) continue;

        const record = {};
        headers.forEach((header, idx) => {
          record[header] = values[idx] || '';
        });

        if (emailIndex !== -1 && isValidEmail(record.email)) {
          emailCount++;
        }

        const rawPhone = record.whatsapp_number || record.phone_raw;
        if (rawPhone && isValidSriLankanMobile(rawPhone)) {
          whatsappCount++;
        }

        if (!firstValid) firstValid = record;
      }

      setPreviewRecipient(firstValid);
      setValidEmailCount(emailCount);
      setValidWhatsAppCount(whatsappCount);
    };
    reader.readAsText(file);
  };

  const allVars = [...new Set([
    ...extractTemplateVariables(template.subject),
    ...extractTemplateVariables(template.body),
    ...extractTemplateVariables(whatsappTemplate),
    'sender_name'
  ])];

  const handleMappingChange = (varName, csvColumn) => {
    setFieldMappings(prev => ({ ...prev, [varName]: csvColumn }));
  };

  const requestGmailToken = () => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') return reject('Only in browser');
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) return reject('Google Client ID missing');
      if (!window.google?.accounts?.oauth2) return reject('Google Identity not loaded');

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/gmail.send',
        callback: (res) => res.access_token ? resolve(res.access_token) : reject('No token'),
        error_callback: reject
      });
      client.requestAccessToken();
    });
  };

  const handleSendEmails = async () => {
    if (!csvContent) return alert('Upload CSV');
    if (!template.subject.trim()) return alert('Enter subject');
    if (!senderName.trim()) return alert('Enter your sender name'); // ✅ Now required
    if (validEmailCount === 0) return alert('No valid emails');

    setIsSending(true);
    setStatus('Getting Gmail access...');

    try {
      const accessToken = await requestGmailToken();
      setStatus('Sending emails...');

      const res = await fetch('/api/send-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent,
          subject: template.subject,
          body: template.body,
          accessToken,
          senderName, // ✅ Passed to backend
          fieldMappings
        })
      });

      const data = await res.json();
      setStatus(res.ok 
        ? `✅ Emails: ${data.sent}/${data.total} sent`
        : `❌ ${data.error || 'Email failed'}`
      );
    } catch (err) {
      setStatus(`❌ ${err.message || 'Email error'}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleGenerateWhatsAppLinks = async () => {
    if (!csvContent) return alert('Upload CSV');
    if (!whatsappTemplate.trim()) return alert('Enter WhatsApp message');
    if (!senderName.trim()) return alert('Enter your sender name'); // ✅ Now required
    if (validWhatsAppCount === 0) return alert('No valid Sri Lankan mobile numbers (07...)');

    setIsSending(true);
    setStatus('Generating WhatsApp links...');

    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent,
          whatsappTemplate,
          senderName, // ✅ Passed to backend
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
      setStatus(`❌ ${err.message || 'WhatsApp error'}`);
    } finally {
      setIsSending(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md text-center">
          <h1 className="text-2xl font-bold mb-6">B2B Messaging</h1>
          <button
            onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
            className="w-full bg-blue-600 text-white py-3 rounded-lg"
          >
            Sign in with Google
          </button>
        </div>
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
          {/* LEFT */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-4">1. Upload CSV</h2>
              <input type="file" accept=".csv" onChange={handleCsvUpload} className="w-full p-2 border rounded" />
              <p className="text-xs text-gray-600 mt-2">
                Only numbers starting with <code>07</code> will be used for WhatsApp.
              </p>
              {validEmailCount > 0 && (
                <p className="text-sm text-green-600 mt-2">📧 {validEmailCount} valid emails</p>
              )}
              {validWhatsAppCount > 0 && (
                <p className="text-sm text-blue-600 mt-1">📱 {validWhatsAppCount} valid 07 numbers</p>
              )}
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

          {/* MIDDLE */}
          <div className="lg:col-span-1 space-y-6">
            {/* ✅ RESTORED: Sender Name Input */}
            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-4">3. Your Name (Sender)</h2>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full p-3 border rounded"
                placeholder="e.g., Alex from GrowthCo"
              />
              <p className="text-xs text-gray-500 mt-1">
                This replaces <code>{'{{sender_name}}'}</code> in both email and WhatsApp messages.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-4">4. Email Template</h2>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Subject</label>
                <input
                  type="text"
                  value={template.subject}
                  onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Body</label>
                <textarea
                  value={template.body}
                  onChange={(e) => setTemplate({ ...template, body: e.target.value })}
                  rows="5"
                  className="w-full p-2 font-mono border rounded"
                />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-4">5. WhatsApp Template</h2>
              <div className="text-xs text-gray-600 mb-2">
                Only numbers starting with <code>07</code> will receive this.
              </div>
              <textarea
                value={whatsappTemplate}
                onChange={(e) => setWhatsappTemplate(e.target.value)}
                rows="6"
                className="w-full p-2 font-mono border rounded"
                placeholder="Hi {{business_name}}! 👋 ..."
              />
            </div>

            <div className="space-y-2">
              <button
                onClick={handleSendEmails}
                disabled={isSending || !csvContent || !senderName.trim() || validEmailCount === 0}
                className={`w-full py-2.5 rounded-lg font-bold ${
                  isSending || !csvContent || !senderName.trim() || validEmailCount === 0
                    ? 'bg-gray-400'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                📧 Send Emails ({validEmailCount})
              </button>

              <button
                onClick={handleGenerateWhatsAppLinks}
                disabled={isSending || !csvContent || !senderName.trim() || validWhatsAppCount === 0}
                className={`w-full py-2.5 rounded-lg font-bold ${
                  isSending || !csvContent || !senderName.trim() || validWhatsAppCount === 0
                    ? 'bg-gray-400'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                📱 Generate WhatsApp Links ({validWhatsAppCount})
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

          {/* RIGHT */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-4">6. Email Preview</h2>
              <div className="bg-gray-50 p-4 rounded border">
                <div className="text-sm text-gray-500">To: {previewRecipient?.email || 'email@example.com'}</div>
                <div className="font-medium mt-1">Subject: {renderPreviewText(template.subject, previewRecipient, fieldMappings, senderName)}</div>
                <div className="mt-2 whitespace-pre-wrap text-sm">
                  {renderPreviewText(template.body, previewRecipient, fieldMappings, senderName)}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-4">7. WhatsApp Preview</h2>
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
                  <button onClick={() => setWhatsappLinks([])} className="text-sm text-red-600">
                    Clear
                  </button>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  Click to open WhatsApp Web. Send manually.
                </p>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {whatsappLinks.map((link, i) => (
                    <div key={i} className="flex justify-between items-center text-sm border-b pb-2">
                      <span className="text-gray-700 truncate max-w-[120px]">{link.business}</span>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
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