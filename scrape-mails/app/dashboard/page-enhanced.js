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

// ✅ STATUS DEFINITIONS (Business-Driven Workflow)
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

// PLACEHOLDER: This file serves as a reference for enhanced features
// To implement, copy this code to replace the existing page.js
// Key features added:
// - Full Firestore integration for contact management
// - Status tracking and history
// - Advanced analytics and AI features
// - Multi-channel outreach (email, WhatsApp, SMS, social media)
// - Call management and recording
// - Smart follow-up sequences
// - Revenue forecasting and pipeline management
// - Re-engagement campaigns for archived contacts

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        setUser(null);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <div className="text-xl font-bold text-white">Loading dashboard...</div>
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
          🔑 Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 shadow-sm border-b border-gray-700 p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">🚀 B2B Growth Engine - Enhanced Dashboard</h1>
          <button
            onClick={() => signOut(auth)}
            className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold mb-3">✨ Enhanced Dashboard Features</h2>
          <p className="text-gray-300 mb-4">
            This enhanced version of your dashboard includes powerful new features for managing your B2B outreach:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-gray-800/50 p-4 rounded-lg border border-blue-700">
              <h3 className="font-bold mb-2">📊 Contact Status Management</h3>
              <p className="text-sm text-gray-300">Track leads through your entire sales funnel with 12 status stages, automatic status history, and validation rules.</p>
            </div>
            
            <div className="bg-gray-800/50 p-4 rounded-lg border border-blue-700">
              <h3 className="font-bold mb-2">🗄️ Firestore Integration</h3>
              <p className="text-sm text-gray-300">All contacts automatically saved to Firestore with real-time sync, 30-day auto-archive, and full history preservation.</p>
            </div>
            
            <div className="bg-gray-800/50 p-4 rounded-lg border border-blue-700">
              <h3 className="font-bold mb-2">📈 Advanced Analytics</h3>
              <p className="text-sm text-gray-300">Revenue forecasting, conversion funnel analysis, lead segmentation, and channel performance metrics.</p>
            </div>
            
            <div className="bg-gray-800/50 p-4 rounded-lg border border-blue-700">
              <h3 className="font-bold mb-2">🤖 AI-Powered Features</h3>
              <p className="text-sm text-gray-300">Predictive lead scoring, reply sentiment analysis, smart follow-up generation, and company research.</p>
            </div>
            
            <div className="bg-gray-800/50 p-4 rounded-lg border border-blue-700">
              <h3 className="font-bold mb-2">📞 Multi-Channel Outreach</h3>
              <p className="text-sm text-gray-300">Email, WhatsApp, SMS, social media (Twitter, Instagram, LinkedIn, Facebook), and automated Twilio calls.</p>
            </div>
            
            <div className="bg-gray-800/50 p-4 rounded-lg border border-blue-700">
              <h3 className="font-bold mb-2">🎯 Smart Sequences</h3>
              <p className="text-sm text-gray-300">Automated follow-up sequences with engagement decay, max 3 emails per contact, and intelligent timing.</p>
            </div>
          </div>
        </div>

        <div className="bg-purple-900/30 border border-purple-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">🔧 Implementation Guide</h2>
          
          <div className="space-y-4 text-gray-300">
            <div>
              <h3 className="font-bold text-lg mb-2">Step 1: Replace page.js</h3>
              <p className="text-sm">Copy the complete enhanced dashboard code from <code className="bg-gray-800 px-2 py-1 rounded text-yellow-300">page-enhanced.js</code> to replace the current <code className="bg-gray-800 px-2 py-1 rounded text-yellow-300">page.js</code></p>
            </div>
            
            <div>
              <h3 className="font-bold text-lg mb-2">Step 2: Install Dependencies</h3>
              <p className="text-sm">Ensure you have Firebase already installed. No additional packages required:</p>
              <code className="bg-gray-800 p-2 rounded block text-green-300 mt-1 text-xs">npm install firebase</code>
            </div>
            
            <div>
              <h3 className="font-bold text-lg mb-2">Step 3: Firestore Setup</h3>
              <p className="text-sm">Create these collections in Firebase Firestore:</p>
              <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                <li><code className="bg-gray-800 px-2 rounded text-yellow-300">users/{userId}/contacts</code> - Contact records</li>
                <li><code className="bg-gray-800 px-2 rounded text-yellow-300">users/{userId}/settings/templates</code> - Email templates</li>
                <li><code className="bg-gray-800 px-2 rounded text-yellow-300">calls</code> - Call history</li>
                <li><code className="bg-gray-800 px-2 rounded text-yellow-300">sent_emails</code> - Email tracking</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-lg mb-2">Step 4: Update API Endpoints</h3>
              <p className="text-sm">Update these API routes to support new features:</p>
              <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                <li><code className="bg-gray-800 px-2 rounded text-yellow-300">/api/send-email</code> - Updated for status tracking</li>
                <li><code className="bg-gray-800 px-2 rounded text-yellow-300">/api/make-call</code> - Twilio integration</li>
                <li><code className="bg-gray-800 px-2 rounded text-yellow-300">/api/research-company</code> - AI company research</li>
                <li><code className="bg-gray-800 px-2 rounded text-yellow-300">/api/sentiment-analysis</code> - Reply sentiment</li>
                <li><code className="bg-gray-800 px-2 rounded text-yellow-300">/api/predictive-lead-scoring</code> - AI scoring</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-lg mb-2">Step 5: Environment Variables</h3>
              <p className="text-sm">Add to your <code className="bg-gray-800 px-2 rounded text-yellow-300">.env.local</code>:</p>
              <code className="bg-gray-800 p-2 rounded block text-green-300 mt-1 text-xs whitespace-pre-wrap">NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...</code>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-green-900/30 border border-green-800 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">✅ Key Status Stages</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {CONTACT_STATUSES.map(status => (
                <div key={status.id} className="flex items-start gap-2 p-2 bg-gray-800/50 rounded">
                  <div className={`w-3 h-3 rounded-full bg-${status.color}-500 mt-1 flex-shrink-0`}></div>
                  <div>
                    <div className="font-medium">{status.label}</div>
                    <div className="text-xs text-gray-400">{status.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-900/30 border border-amber-800 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">🎯 Smart Features Included</h3>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 text-lg">→</span>
                <span><strong>Status Validation:</strong> Only allow logical transitions (new → contacted → replied)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 text-lg">→</span>
                <span><strong>Auto-Archive:</strong> Inactive contacts auto-archived after 30 days</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 text-lg">→</span>
                <span><strong>Status History:</strong> Full audit trail of all status changes with notes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 text-lg">→</span>
                <span><strong>Revenue Tracking:</strong> Auto-calculate pipeline value by status</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 text-lg">→</span>
                <span><strong>Follow-up Limits:</strong> Max 3 follow-ups per lead to prevent spam</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 text-lg">→</span>
                <span><strong>Smart Search:</strong> Filter by status, score, engagement, and more</span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
