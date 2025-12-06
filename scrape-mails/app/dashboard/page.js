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

// Helper: Extract template variables
const extractTemplateVariables = (text) => {
  if (!text) return [];
  const matches = text.match(/\{\{\s*([^}]+?)\s*\}\}/g) || [];
  return [...new Set(matches.map(m => m.replace(/\{\{\s*|\s*\}\}/g, '').trim()))];
};

// Helper: Render preview using field mappings
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

// Helper: Parse CSV row (handles quotes)
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
  const [senderName, setSenderName] = useState('');
  const [template, setTemplate] = useState({
    subject: 'Special Offer for {{business_name}}',
    body: 'Hello {{business_name}},\n\nWe noticed your business at {{address}} could benefit from our solution. As a special offer, use code WELCOME20 for 20% off your first purchase.\n\nBest regards,\n{{sender_name}}'
  });
  const [fieldMappings, setFieldMappings] = useState({
    business_name: 'business_name',
    address: 'address',
    sender_name: 'sender_name',
    email: 'email'
  });
  const [previewRecipient, setPreviewRecipient] = useState(null);
  const [validRecipientCount, setValidRecipientCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState('');

  // Google Identity Services loader
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const [googleLoadError, setGoogleLoadError] = useState(null);

  useEffect(() => {
    if (window.google?.accounts?.oauth2?.initTokenClient) {
      setIsGoogleLoaded(true);
      return;
    }

    const script = document.createElement('script');
    // ✅ FIXED: Removed trailing spaces
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setIsGoogleLoaded(true);
    script.onerror = () => setGoogleLoadError('Failed to load Google Identity Services');

    document.head.appendChild(script);
    return () => document.head.removeChild(script);
  }, []);

  // Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        setSenderName(user.displayName?.split(' ')[0] || 'Team');
      }
    });
    return () => unsubscribe();
  }, []);

  // CSV upload
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
        setValidRecipientCount(0);
        return;
      }

      const headers = parseCsvRow(lines[0]);
      const emailCol = fieldMappings.email || 'email';
      const emailIndex = headers.indexOf(emailCol);

      if (emailIndex === -1) {
        alert(`Email column "${emailCol}" not found in CSV.`);
        setValidRecipientCount(0);
        return;
      }

      let validCount = 0;
      let firstValid = null;

      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvRow(lines[i]);
        if (values.length !== headers.length) continue;

        const email = values[emailIndex];
        if (isValidEmail(email)) {
          validCount++;
          if (!firstValid) {
            const record = {};
            headers.forEach((header, idx) => {
              record[header] = values[idx] || '';
            });
            firstValid = record;
          }
        }
      }

      setPreviewRecipient(firstValid);
      setValidRecipientCount(validCount);
    };
    reader.readAsText(file);
  };

  const allVars = [...new Set([
    ...extractTemplateVariables(template.subject),
    ...extractTemplateVariables(template.body),
    'sender_name'
  ])];

  const handleMappingChange = (varName, csvColumn) => {
    setFieldMappings(prev => ({ ...prev, [varName]: csvColumn }));
  };

  // ✅ FULLY FIXED: Removed trailing spaces in scope
  const requestGmailToken = () => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Only works in browser'));
        return;
      }

      // ✅ Hardcoded client ID (replace with process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID in production)
      const clientId = '148388414130-016bpk4vog74c8vb8b5igfqut9joiipt.apps.googleusercontent.com';
      if (!clientId) {
        reject(new Error('Google Client ID missing'));
        return;
      }

      if (!window.google?.accounts?.oauth2) {
        reject(new Error('Google Identity Services not loaded'));
        return;
      }

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        // ✅ FIXED: Removed trailing spaces
        scope: 'https://www.googleapis.com/auth/gmail.send',
        callback: (response) => response.access_token ? resolve(response.access_token) : reject(new Error('No token')),
        error_callback: (error) => reject(error)
      });

      client.requestAccessToken();
    });
  };

  const handleSend = async () => {
    if (!csvContent) return alert('Upload a CSV file');
    if (!template.subject.trim()) return alert('Enter a subject');
    if (!senderName.trim()) return alert('Enter your sender name');
    if (validRecipientCount === 0) return alert('No valid emails found');
    if (!isGoogleLoaded) return alert('Google services loading...');

    setIsSending(true);
    setStatus('Getting Gmail access...');

    try {
      const accessToken = await requestGmailToken();
      setStatus('Sending emails...');

      const response = await fetch('/api/send-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent,
          subject: template.subject,
          body: template.body,
          accessToken,
          senderName,
          fieldMappings
        })
      });

      const data = await response.json();
      setStatus(response.ok 
        ? `✅ Sent to ${data.sent}/${data.total} emails!`
        : `❌ ${data.error || 'Unknown error'}`
      );
    } catch (error) {
      console.error('Send error:', error);
      setStatus(`❌ ${error.message || 'Failed to send'}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      alert('Login failed. Please try again.');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md text-center">
          <h1 className="text-2xl font-bold mb-6">B2B Email Campaigns</h1>
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>B2B Email Campaigns</title>
        <meta name="description" content="Send personalized business emails via your Gmail account" />
      </Head>

      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Business Email Campaigns</h1>
          <button 
            onClick={() => signOut(auth)} 
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT: CSV & Mappings */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-4">1. Upload Recipients (CSV)</h2>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="w-full text-sm p-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-600 mt-2">
                Must include: <code>email, business_name, address</code>
              </p>
              {validRecipientCount > 0 && (
                <p className="text-sm text-green-600 mt-2">
                  ✅ {validRecipientCount} valid emails
                </p>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-4">2. Field Mappings</h2>
              <p className="text-sm text-gray-600 mb-4">
                Map template variables to CSV columns:
              </p>
              {allVars.map(varName => (
                <div key={varName} className="flex items-center mb-3">
                  <span className="bg-gray-100 px-2 py-1 rounded text-sm font-mono mr-2">
                    {`{{${varName}}}`}
                  </span>
                  <select
                    value={fieldMappings[varName] || ''}
                    onChange={(e) => handleMappingChange(varName, e.target.value)}
                    className="border rounded px-2 py-1 text-sm flex-1"
                  >
                    <option value="">-- Select column --</option>
                    {previewRecipient && Object.keys(previewRecipient).map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                    {varName === 'sender_name' && (
                      <option value="sender_name">Use custom sender name</option>
                    )}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* MIDDLE: Email Editor */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-4">3. Customize Email</h2>
              
              <div className="mb-5">
                <label className="block text-sm font-medium mb-1">Your Name (in email)</label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g., Alex from GrowthCo"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Replaces <code>{'{{sender_name}}'}</code>
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Subject</label>
                <input
                  type="text"
                  value={template.subject}
                  onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
                  className="w-full p-2 border rounded"
                  placeholder="e.g., Special Offer for {{business_name}}"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Body</label>
                <textarea
                  value={template.body}
                  onChange={(e) => setTemplate({ ...template, body: e.target.value })}
                  rows="8"
                  className="w-full p-2 font-mono border rounded"
                  placeholder="Hello {{business_name}}, ..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use <code>{'{{placeholders}}'}</code> like <code>{'{{business_name}}'}</code>
                </p>
              </div>
            </div>

            <button
              onClick={handleSend}
              disabled={isSending || !csvContent || !template.subject.trim() || !senderName.trim() || validRecipientCount === 0 || !isGoogleLoaded}
              className={`w-full py-3 rounded-xl font-bold ${
                isSending || !csvContent || !template.subject.trim() || !senderName.trim() || validRecipientCount === 0 || !isGoogleLoaded
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {!isGoogleLoaded ? '⏳ Loading Google...' : isSending ? '📤 Sending...' : `📤 Send to ${validRecipientCount} Emails`}
            </button>

            {status && (
              <div className={`p-4 rounded-xl text-center ${
                status.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {status}
              </div>
            )}

            {googleLoadError && (
              <div className="p-3 bg-red-100 text-red-800 rounded text-sm">
                ❌ {googleLoadError}
              </div>
            )}
          </div>

          {/* RIGHT: Preview */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold mb-4">4. Preview</h2>
              <div className="bg-gray-50 p-4 rounded border min-h-[200px]">
                <div className="text-sm text-gray-500">
                  To: {previewRecipient?.email || 'recipient@example.com'}
                </div>
                <div className="font-medium mt-1">
                  Subject: {renderPreviewText(template.subject, previewRecipient, fieldMappings, senderName) || 'No subject'}
                </div>
                <div className="mt-3 whitespace-pre-wrap text-sm font-sans">
                  {renderPreviewText(template.body, previewRecipient, fieldMappings, senderName) || 'No body'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}