'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitCSV } from '../lib/api';

export default function HomePage() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const router = useRouter();

  const handleFile = (file) => {
    if (file && file.type === 'text/csv') {
      setFile(file);
    } else {
      alert('Please upload a valid CSV file.');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (dropped_file) handleFile(droppedFile);
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
      alert('Error: ' + (err.message || 'Upload failed. Try again.'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl mb-4">
            Turn Websites into <span className="text-blue-600">Verified Leads</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Upload a CSV of business websites. We’ll scan them and extract real, usable email addresses — no guesswork.
          </p>
        </div>

        {/* Value Props */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            { icon: '⚡', title: 'Fast', desc: 'Get results in minutes, not hours' },
            { icon: '✅', title: 'Verified', desc: 'Only relevant, domain-matched emails' },
            { icon: '🔒', title: 'Private', desc: 'Your data never leaves your control' },
          ].map((item, i) => (
            <div key={i} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 text-center">
              <div className="text-2xl mb-2">{item.icon}</div>
              <h3 className="font-semibold text-gray-900">{item.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Upload Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Your Business List</h2>
          <p className="text-gray-600 text-sm mb-6">
            CSV must include a <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">website</code> column.
          </p>

          <form onSubmit={handleSubmit}>
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-50'
                  : file
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input').click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".csv"
                onChange={(e) => handleFile(e.target.files?.[0])}
                className="hidden"
              />
              {file ? (
                <div className="flex flex-col items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500 mt-1">Click to change file</p>
                </div>
              ) : (
                <div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="font-medium text-gray-900">Drag & drop your CSV here</p>
                  <p className="text-sm text-gray-500 mt-1">or click to browse</p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!file || loading}
              className={`w-full mt-6 py-3 px-4 rounded-xl font-semibold text-white transition-all ${
                !file || loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-md hover:shadow-lg'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                '🚀 Extract Emails Now'
              )}
            </button>
          </form>
        </div>

        {/* Trust Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Your data is processed securely. We never store your CSV or extracted emails.</p>
        </div>
      </div>
    </div>
  );
}