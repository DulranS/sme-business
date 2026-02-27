'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getJobStatus } from '@/app/lib/api';

export default function ResultsPage() {
  const { jobId } = useParams();
  const router = useRouter();
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      try {
        const data = await getJobStatus(jobId);
        setJob(data);
        if (data.status === 'processing') {
          const timer = setTimeout(poll, 1500);
          return () => clearTimeout(timer);
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch job status');
      }
    };

    poll();
  }, [jobId]);

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 text-sm mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-gray-700 text-white py-2 px-6 rounded-lg font-medium hover:bg-gray-800"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Processing — REAL PROGRESS
  if (!job || job.status === 'processing') {
    const current = job?.current || 0;
    const total = job?.total || 1;
    const percent = Math.min(Math.round((current / total) * 100), 99);

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md w-full">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-6">
            <svg
              className="animate-spin h-8 w-8 text-blue-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-3">Scraping in Progress</h2>
          
          {/* ✅ REAL PROGRESS TEXT */}
          <p className="text-gray-700 mb-2">
            <span className="font-bold text-blue-600">{current}</span> of{' '}
            <span className="font-bold">{total}</span> businesses processed
          </p>

          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${percent}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-500">{percent}% complete</p>

          <p className="mt-6 text-xs text-gray-500">
            Visiting websites and extracting verified contact emails...
          </p>
        </div>
      </div>
    );
  }

  // Failed
  if (job.status === 'failed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Failed</h2>
          <p className="text-gray-600 text-sm mb-6">{job.error || 'An unknown error occurred.'}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-blue-700"
          >
            Upload Again
          </button>
        </div>
      </div>
    );
  }

  // Success
  const total = job.total || 0;
  const withEmail = job.with_email || 0;
  const successRate = total > 0 ? Math.round((withEmail / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">✅ Complete!</h1>
          <p className="text-gray-600">
            Successfully enriched <span className="font-bold">{total}</span> leads.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-gray-200">
          <div className="text-center mb-4">
            <p className="text-lg text-gray-700">
              <span className="text-3xl font-bold text-blue-600">{withEmail}</span> of{' '}
              <span className="text-3xl font-bold text-gray-900">{total}</span> have emails
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full"
              style={{ width: `${successRate}%` }}
            ></div>
          </div>
          <p className="text-center mt-2 text-sm font-medium text-gray-700">
            {successRate}% success rate
          </p>
        </div>

        <button
          onClick={() => {
            const blob = new Blob([job.csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `business_leads_with_emails.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-700 text-white font-semibold py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Results ({withEmail} emails)
        </button>
      </div>
    </div>
  );
}