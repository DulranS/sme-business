// pages/index.js
"use client";
import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function LeadDashboard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const res = await fetch('/api/leads');
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'Unknown error');
        }
        const data = await res.json();
        setLeads(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
    // Optional: auto-refresh every 30 seconds
    const interval = setInterval(fetchLeads, 30000);
    return () => clearInterval(interval);
  }, []);

  const exportToCSV = () => {
    if (leads.length === 0) return;

    const headers = Object.keys(leads[0]);
    const csvRows = [
      headers.join(','),
      ...leads.map(row =>
        headers.map(fieldName => {
          const value = row[fieldName] ?? '';
          const escaped = String(value).replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(',')
      )
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'colombo_b2b_leads.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getQualityBadgeClass = (quality) => {
    if (!quality) return 'bg-gray-200 text-gray-800';
    if (quality.includes('HOT')) return 'bg-red-200 text-red-800';
    if (quality.includes('WARM')) return 'bg-yellow-200 text-yellow-800';
    return 'bg-gray-200 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading leads...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-6 max-w-md">
          <p className="text-red-600 mb-2">⚠️ Failed to load leads</p>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <p className="text-xs text-gray-500">
            Make sure <code>whatsapp_ready_leads.csv</code> exists in the project root.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Head>
        <title>Colombo B2B Leads</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-lg font-bold text-gray-800">Colombo B2B Leads</h1>
          <button
            onClick={exportToCSV}
            disabled={leads.length === 0}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              leads.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            📥 Export CSV
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 pt-4">
        {leads.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No leads found.</p>
            <p className="text-sm mt-2">
              Run your lead pipeline to generate <code>whatsapp_ready_leads.csv</code>.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {leads.map((lead, index) => (
              <div
                key={index}
                className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="font-semibold text-gray-900">{lead.contact_name}</h2>
                    {lead.business_name && (
                      <p className="text-sm text-gray-600 mt-0.5">{lead.business_name}</p>
                    )}
                    {lead.lead_quality && (
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${getQualityBadgeClass(
                          lead.lead_quality
                        )}`}
                      >
                        {lead.lead_quality}
                      </span>
                    )}
                  </div>
                  {lead.whatsapp_link && (
                    <a
                      href={lead.whatsapp_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center"
                      aria-label="Message on WhatsApp"
                    >
                      <span className="text-white text-lg">💬</span>
                    </a>
                  )}
                </div>

                <div className="mt-3 text-sm text-gray-700 space-y-1">
                  {lead.email && <div>📧 {lead.email}</div>}
                  {lead.mobile_9digit && <div>📱 +94 {lead.mobile_9digit}</div>}
                  {lead.address && <div>📍 {lead.address}</div>}
                </div>

                {lead.tags && (
                  <div className="mt-2 text-xs text-gray-500">
                    Tags: {lead.tags}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t p-2 text-center text-xs text-gray-500">
        {leads.length} leads • Tap 💬 to open WhatsApp
      </footer>
    </div>
  );
}