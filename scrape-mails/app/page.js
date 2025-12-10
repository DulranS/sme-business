// app/page.js
'use client';
import { useState, useEffect } from 'react';
import { auth,googleProvider } from './lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { useRouter } from 'next/navigation';

const SECRET_KEY = 'goofyballcornball248';
const ACCESS_GRANTED = 'access_granted';

export default function Home() {
  const router = useRouter();
  const [accessGranted, setAccessGranted] = useState(false);
  const [inputKey, setInputKey] = useState('');
  const [error, setError] = useState('');

  // Check localStorage on load
  useEffect(() => {
    const isApproved = localStorage.getItem(ACCESS_GRANTED);
    if (isApproved === 'true') {
      setAccessGranted(true);
    }
  }, []);

  // Redirect if already approved
  useEffect(() => {
    if (accessGranted) {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user) {
          router.push('/dashboard');
        }
      });
      return () => unsubscribe();
    }
  }, [accessGranted, router]);

  const handleKeySubmit = (e) => {
    e.preventDefault();
    if (inputKey === SECRET_KEY) {
      localStorage.setItem(ACCESS_GRANTED, 'true');
      setAccessGranted(true);
    } else {
      setError('Incorrect key. Please try again.');
      setInputKey('');
    }
  };

  if (accessGranted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
            M
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Gmail Mass Email Sender</h1>
          <p className="text-gray-600 mb-6">
            You’ve been granted access. Please sign in with Google to continue.
          </p>
          <button
            onClick={async () => {
              try {
                await signInWithPopup(auth, googleProvider);
              } catch (error) {
                console.error('Login error:', error);
                alert('Login failed. Please try again.');
              }
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
          🔑
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Required</h1>
        <p className="text-gray-600 mb-6">
          Enter the secret key to unlock the B2B outreach platform.
        </p>
        <form onSubmit={handleKeySubmit} className="space-y-4">
          <input
            type="password"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            placeholder="Enter secret key"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            required
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition"
          >
            Unlock Access
          </button>
        </form>
      </div>
    </div>
  );
}