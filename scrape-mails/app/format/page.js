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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl mb-4">
          Extract Verified Business Emails
        </h1>
        <p className="text-gray-600 mb-8">
          Upload a CSV with a <code className="bg-gray-200 px-1.5 py-0.5 rounded text-sm">website</code> column. We’ll visit each site and extract real contact emails.
        </p>

        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-200">
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-medium
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
            </div>
            <button
              type="submit"
              disabled={!file || loading}
              className={`w-full py-3 px-4 rounded-xl font-semibold text-white ${
                !file || loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800'
              }`}
            >
              {loading ? 'Processing...' : 'Start Scraping'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-xs text-gray-500">
          Your data is processed securely. We never store your CSV or results.
        </p>
      </div>
    </div>
  );
}