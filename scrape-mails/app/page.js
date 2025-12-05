// app/page.js
'use client';

import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";



export default function MassEmailer() {
  const [refreshToken, setRefreshToken] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [subject, setSubject] = useState('Hello from MassEmailer!');
  const [template, setTemplate] = useState('Hi {{email}},\n\nThis is a test email from our tool!');
  const [previewEmail, setPreviewEmail] = useState('you@example.com');
  const [status, setStatus] = useState('');
  const fileInputRef = useRef(null);
  const searchParams = useSearchParams();

  // Auto-set token from URL (for demo only!)
  if (!refreshToken) {
    const token = searchParams.get('token');
    if (token) setRefreshToken(token);
  }

  const handleAuth = () => {
    window.location.href = '/api/auth';
  };

  const handleFileChange = (e) => {
    setCsvFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!refreshToken || !csvFile) {
      alert('Please connect Gmail and upload a CSV');
      return;
    }

    setStatus('Sending...');
    const formData = new FormData();
    formData.append('refreshToken', refreshToken);
    formData.append('csv', csvFile);
    formData.append('subject', subject);
    formData.append('template', template);

    const res = await fetch('/api/send', { method: 'POST', body: formData });
    const data = await res.json();

    if (res.ok) {
      setStatus(`✅ Sent to ${data.sent}/${data.total} emails!`);
    } else {
      setStatus(`❌ Error: ${data.error}`);
    }
  };

  const preview = template.replace(/\{\{email\}\}/g, previewEmail);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center py-8">
          <h1 className="text-3xl font-bold text-gray-800">Gmail Mass Emailer</h1>
          <p className="text-gray-600 mt-2">Send personalized emails via your Gmail account</p>
        </header>

        {!refreshToken ? (
          <div className="bg-white rounded-2xl shadow-md p-6 text-center">
            <h2 className="text-xl font-semibold mb-4">Connect Your Gmail</h2>
            <button
              onClick={handleAuth}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-lg transition"
            >
              🔗 Connect with Google
            </button>
            <p className="text-xs text-gray-500 mt-4">
              We only request permission to send emails. No data is stored.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* CSV Upload */}
            <div className="bg-white p-4 rounded-2xl shadow">
              <label className="block text-sm font-medium mb-2">Upload Email List (CSV)</label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                One email per line, or in the first column
              </p>
            </div>

            {/* Subject */}
            <div className="bg-white p-4 rounded-2xl shadow">
              <label className="block text-sm font-medium mb-2">Subject Line</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg"
                placeholder="e.g., Special Offer Just For You!"
              />
            </div>

            {/* Template */}
            <div className="bg-white p-4 rounded-2xl shadow">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium">Email Template</label>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Use <code className="font-mono">{{email}}</code> to personalize
                </span>
              </div>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={6}
                className="w-full p-3 font-mono text-sm border border-gray-300 rounded-lg"
                placeholder="Hi {{email}}, ..."
              />
            </div>

            {/* Preview */}
            <div className="bg-white p-4 rounded-2xl shadow">
              <h3 className="font-medium mb-3">Preview</h3>
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="text-sm font-medium text-gray-700 mb-2">To: {previewEmail}</div>
                <div className="text-sm font-medium text-gray-700 mb-2">Subject: {subject}</div>
                <div className="text-sm whitespace-pre-wrap text-gray-800 border-t pt-2 mt-2">
                  {preview}
                </div>
              </div>
              <input
                type="email"
                value={previewEmail}
                onChange={(e) => setPreviewEmail(e.target.value)}
                className="mt-3 w-full text-sm p-2 border rounded"
                placeholder="Preview email address"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!csvFile}
              className={`w-full py-4 rounded-2xl font-bold text-white ${
                !csvFile ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              📨 Send Mass Email
            </button>

            {status && (
              <div className={`p-4 rounded-xl text-center font-medium ${
                status.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {status}
              </div>
            )}
          </form>
        )}

        <footer className="text-center text-gray-500 text-sm mt-12 pb-8">
          <p>Respects Gmail's sending limits. Max 500 emails/day.</p>
        </footer>
      </div>
    </div>
  );
}