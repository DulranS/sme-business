// app/format/page.js
'use client';

import { useRouter } from 'next/navigation';

export default function FormatPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-xl border border-gray-700 p-8 text-center">
        <div className="text-5xl mb-4">🚧</div>
        <h1 className="text-2xl font-bold text-white mb-3">Lead Scraper Temporarily Disabled</h1>
        <p className="text-gray-400 mb-6">
          This feature requires backend infrastructure that hasn't been deployed yet.
          <br /><br />
          ✅ <strong>Recommended workflow:</strong> Upload CSV files directly in the Dashboard
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition transform hover:scale-105"
        >
          → Go to Dashboard (Upload CSV Here)
        </button>
        <p className="text-xs text-gray-500 mt-4">
          All contact status tracking & outreach features work immediately in Dashboard
        </p>
      </div>
    </div>
  );
}