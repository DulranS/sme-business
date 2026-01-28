'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitCSV } from '../lib/api';

export default function HomePage() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
    } else {
      alert('Please upload a valid CSV file.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      const { job_id } = await submitCSV(text);
      router.push(`/results/${job_id}`);
    } catch (err) {
      alert('Error: ' + (err.message || 'Failed to start scraping.'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-3xl font-bold text-white sm:text-4xl mb-4">
          Extract Verified Business Emails
        </h1>
        <p className="text-gray-400 mb-8">
          Upload a CSV with a <code className="bg-gray-700 px-1.5 py-0.5 rounded text-sm text-indigo-300">website</code> column. We'll visit each site and extract real contact emails.
        </p>

        <div className="bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-700">
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-medium
                  file:bg-blue-900 file:text-blue-300
                  hover:file:bg-blue-800"
              />
            </div>
            <button
              type="submit"
              disabled={!file || loading}
              className={`w-full py-3 px-4 rounded-xl font-semibold ${
                !file || loading
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white'
              }`}
            >
              {loading ? 'Processing...' : 'Start Scraping'}
            </button>
          </form>
        </div>

        <div className="mt-8 bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-3">🚀 Quick Start Guide</h2>
          <ol className="text-left text-sm text-gray-300 space-y-2">
            <li className="flex items-start">
              <span className="text-indigo-400 font-bold mr-2">1.</span>
              <span>Upload CSV with business websites</span>
            </li>
            <li className="flex items-start">
              <span className="text-indigo-400 font-bold mr-2">2.</span>
              <span>Wait for email extraction (1-5 min)</span>
            </li>
            <li className="flex items-start">
              <span className="text-indigo-400 font-bold mr-2">3.</span>
              <span>Download verified leads</span>
            </li>
            <li className="flex items-start">
              <span className="text-indigo-400 font-bold mr-2">4.</span>
              <span>Launch outreach from dashboard</span>
            </li>
          </ol>
        </div>

        <p className="mt-6 text-xs text-gray-500">
          Your data is processed securely. We never store your CSV or results.
        </p>
        
        <div className="mt-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center text-sm text-indigo-400 hover:text-indigo-300 transition"
          >
            ← Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}