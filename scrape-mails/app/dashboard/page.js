// src/pages/dashboard.js
'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { auth } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useRouter } from 'next/navigation';
import Head from 'next/head';
import EmailEditor from '../components/EmailEditor';
import RecipientInput from '../components/RecipientInput';
import PreviewPane from '../components/PreviewPane';

export default function Dashboard() {
  const [user, loading] = useAuthState(auth);
  const [recipients, setRecipients] = useState([]);
  const [template, setTemplate] = useState({
    subject: 'Special Offer for {{business_name}}',
    body: 'Hello {{business_name}},\n\nWe noticed your business at {{address}} could benefit from our solution. As a special offer, use code WELCOME20 for 20% off your first purchase.\n\nBest regards,\n{{sender_name}}'
  });
  const [previewData, setPreviewData] = useState({});
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
  const [isSending, setIsSending] = useState(false);
  const router = useRouter();
  const gmailTokenRef = useRef(null);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  const requestGmailToken = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') return reject('No window');

      const client = window.google?.accounts?.oauth2?.initTokenClient({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/gmail.send',
        callback: (response) => {
          if (response.access_token) {
            resolve(response.access_token);
          } else {
            reject(new Error('No access token'));
          }
        },
        error_callback: (error) => {
          reject(error);
        }
      });

      if (!client) {
        reject(new Error('Google Identity not loaded'));
        return;
      }

      client.requestAccessToken();
    });
  }, []);

  const handleRecipientsChange = useCallback((data) => {
    setRecipients(data);
    if (data.length > 0) setPreviewData(data[0]);
  }, []);

  const handleSendEmails = async () => {
    if (recipients.length === 0) {
      alert('Please add recipients first');
      return;
    }
    if (!template.subject.trim()) {
      alert('Please enter a subject line');
      return;
    }

    setIsSending(true);
    setProgress({ current: 0, total: recipients.length, status: 'Getting Gmail access...' });

    try {
      const accessToken = await requestGmailToken();
      gmailTokenRef.current = accessToken;
      setProgress({ current: 0, total: recipients.length, status: 'Sending emails...' });

      const response = await fetch('/api/send-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients,
          subject: template.subject,
          body: template.body,
          accessToken
        })
      });

      const result = await response.json();

      if (response.ok) {
        setProgress({ current: result.sent, total: recipients.length, status: `✅ Sent ${result.sent} emails!` });
        alert(`Success! ${result.sent} emails delivered via your Gmail.`);
      } else {
        if (result.error?.includes('Invalid Credentials')) {
          alert('Gmail session expired. Please try again.');
          gmailTokenRef.current = null;
        } else {
          alert(`Send failed: ${result.error}`);
        }
        setProgress({ current: 0, total: 0, status: '' });
      }
    } catch (error) {
      console.error('Send error:', error);
      alert('Failed to send emails. Please ensure you allowed Gmail access.');
      setProgress({ current: 0, total: 0, status: '' });
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>B2B Email Campaigns | Gmail Sender</title>
        <meta name="description" content="Send personalized business emails through your Gmail account" />
      </Head>

      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Business Email Campaigns</h1>
          <button 
            onClick={() => auth.signOut()} 
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recipients */}
          <div className="lg:col-span-1">
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Recipients</h2>
              <RecipientInput onRecipientsChange={handleRecipientsChange} />
            </div>
            
            {/* Business Value Tip */}
            <div className="card mt-6 p-4 bg-blue-50 border border-blue-200">
              <p className="text-sm text-blue-700">
                Your CSV must include these columns:{" "}
                <code>place_id, business_name, address, phone_raw, whatsapp_number, email, website, rating, review_count, category, lead_quality, scraped_date</code>
              </p>
            </div>
          </div>
          
          {/* Editor */}
          <div className="lg:col-span-1">
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Compose Email</h2>
              <EmailEditor 
                template={template} 
                onChange={setTemplate}
                fields={[
                  'business_name', 'address', 'phone_raw', 'whatsapp_number', 
                  'website', 'rating', 'review_count', 'category', 'lead_quality'
                ]}
              />
            </div>
            
            {progress.total > 0 && (
              <div className="card mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm mt-2 text-gray-600">{progress.status}</p>
              </div>
            )}
            
            <button 
              onClick={handleSendEmails}
              disabled={isSending || recipients.length === 0 || !template.subject.trim()}
              className={`btn btn-primary w-full py-3 mt-6 ${
                isSending || recipients.length === 0 || !template.subject.trim() 
                  ? 'opacity-50 cursor-not-allowed' 
                  : ''
              }`}
            >
              {isSending ? 'Sending...' : `Send to ${recipients.length || '...'} Businesses`}
            </button>
          </div>
          
          {/* Preview */}
          <div className="lg:col-span-1">
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Email Preview</h2>
              <PreviewPane 
                subject={template.subject} 
                body={template.body} 
                previewData={previewData} 
                sender={user.displayName?.split(' ')[0] || 'Team'}
              />
              
              {recipients.length > 1 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preview for:
                  </label>
                  <select 
                    className="input w-full"
                    onChange={(e) => setPreviewData(recipients[parseInt(e.target.value)])}
                  >
                    {recipients.map((row, index) => (
                      <option key={index} value={index}>
                        {row.business_name || row.email || `Business ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}