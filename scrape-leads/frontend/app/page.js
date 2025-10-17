// app/page.js
'use client';

import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';

export default function LeadDashboard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [qualityFilter, setQualityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [contactFilter, setContactFilter] = useState('ALL'); // 'EMAIL', 'PHONE', 'BOTH'
  const [minRating, setMinRating] = useState('');
  const [minReviews, setMinReviews] = useState('');
  const [tagFilter, setTagFilter] = useState('ALL');

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const res = await fetch('/api/leads');
        if (!res.ok) throw new Error('Failed to load leads');
        const data = await res.json();
        setLeads(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
    const interval = setInterval(fetchLeads, 30000);
    return () => clearInterval(interval);
  }, []);

  const allTags = useMemo(() => {
    const tags = new Set();
    leads.forEach(lead => {
      if (lead.tags) {
        lead.tags.split(';').forEach(tag => tags.add(tag.trim()));
      }
    });
    return Array.from(tags).sort();
  }, [leads]);

  const uniqueCategories = [...new Set(leads.map(l => l.category).filter(Boolean))].sort();

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch = !searchTerm ||
        (lead.business_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.contact_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.phone_raw || '').replace(/\D/g, '').includes(searchTerm.replace(/\D/g, '')) ||
        (lead.email || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesQuality = qualityFilter === 'ALL' || 
        (lead.lead_quality || '').includes(qualityFilter);

      const matchesCategory = categoryFilter === 'ALL' || lead.category === categoryFilter;

      const hasEmail = !!lead.email;
      const hasPhone = !!lead.phone_raw;
      const matchesContact = contactFilter === 'ALL' ||
        (contactFilter === 'EMAIL' && hasEmail) ||
        (contactFilter === 'PHONE' && hasPhone) ||
        (contactFilter === 'BOTH' && hasEmail && hasPhone);

      const rating = parseFloat(lead.rating) || 0;
      const reviews = parseInt(lead.review_count) || 0;
      const matchesRating = !minRating || rating >= parseFloat(minRating);
      const matchesReviews = !minReviews || reviews >= parseInt(minReviews);

      const matchesTag = tagFilter === 'ALL' || 
        (lead.tags && lead.tags.includes(tagFilter));

      return matchesSearch && matchesQuality && matchesCategory && 
             matchesContact && matchesRating && matchesReviews && matchesTag;
    });
  }, [leads, searchTerm, qualityFilter, categoryFilter, contactFilter, minRating, minReviews, tagFilter]);

  const exportToCSV = () => {
    if (filteredLeads.length === 0) return;

    const headers = [
      'business_name',
      'contact_name',
      'category',
      'lead_quality',
      'phone_raw',
      'whatsapp_number',
      'email',
      'website',
      'address',
      'rating',
      'review_count',
      'tags'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredLeads.map(lead =>
        headers.map(field => {
          const val = lead[field] || '';
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'strategic_colombo_leads.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-black">Loading leads...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="text-center max-w-md">
          <p className="text-black mb-2">⚠️ Failed to load leads</p>
          <p className="text-black text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32">
      <Head>
        <title>Colombo B2B Lead Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-black mb-4">Colombo B2B Lead Dashboard</h1>

          {/* Search */}
          <input
            type="text"
            placeholder="Search: business, contact, phone, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2.5 border border-gray-300 rounded mb-4 text-black text-sm"
          />

          {/* Advanced Filters - Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <select
              value={qualityFilter}
              onChange={(e) => setQualityFilter(e.target.value)}
              className="p-2 border border-gray-300 rounded text-black text-sm"
            >
              <option value="ALL">All Qualities</option>
              <option value="HOT">🔥 HOT</option>
              <option value="WARM">🔸 WARM</option>
              <option value="COLD">❄️ COLD</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="p-2 border border-gray-300 rounded text-black text-sm"
            >
              <option value="ALL">All Categories</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat} className="text-black">{cat}</option>
              ))}
            </select>

            <select
              value={contactFilter}
              onChange={(e) => setContactFilter(e.target.value)}
              className="p-2 border border-gray-300 rounded text-black text-sm"
            >
              <option value="ALL">Any Contact</option>
              <option value="EMAIL">WithEmail</option>
              <option value="PHONE">With Phone</option>
              <option value="BOTH">WithEmail + Phone</option>
            </select>

            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="p-2 border border-gray-300 rounded text-black text-sm"
            >
              <option value="ALL">All Tags</option>
              {allTags.map(tag => (
                <option key={tag} value={tag} className="text-black">{tag}</option>
              ))}
            </select>
          </div>

          {/* Numeric Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <input
              type="number"
              placeholder="Min Rating (e.g. 4.0)"
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              min="0"
              max="5"
              step="0.1"
              className="p-2 border border-gray-300 rounded text-black text-sm"
            />
            <input
              type="number"
              placeholder="Min Reviews (e.g. 50)"
              value={minReviews}
              onChange={(e) => setMinReviews(e.target.value)}
              min="0"
              className="p-2 border border-gray-300 rounded text-black text-sm"
            />
          </div>

          {/* Summary & Export */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <p className="text-black text-sm">
              Showing <span className="font-semibold">{filteredLeads.length}</span> of <span className="font-semibold">{leads.length}</span> leads
            </p>
            <button
              onClick={exportToCSV}
              disabled={filteredLeads.length === 0}
              className={`px-4 py-2 rounded font-medium text-sm ${
                filteredLeads.length === 0
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              📥 Export Filtered Leads
            </button>
          </div>
        </div>
      </header>

      {/* Leads List */}
      <main className="container mx-auto px-4 pt-6">
        {filteredLeads.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-black">No leads match your filters.</p>
            <p className="text-black text-sm mt-2">Try adjusting your criteria.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredLeads.map((lead, i) => {
              const contactName = lead.contact_name || lead.business_name || 'Prospect';
              const mobile9Digit = (lead.whatsapp_number || '').toString().replace(/\D/g, '').slice(0, 9);
              const waLink = mobile9Digit ? `https://wa.me/94${mobile9Digit}` : '';

              return (
                <div key={i} className="border border-gray-200 rounded-lg p-5 bg-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="font-bold text-black text-lg">{contactName}</h2>
                      {lead.business_name && lead.business_name !== contactName && (
                        <p className="text-black text-sm mt-0.5">{lead.business_name}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {lead.lead_quality && (
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                            lead.lead_quality.includes('HOT') ? 'bg-red-100 text-red-800' :
                            lead.lead_quality.includes('WARM') ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          } text-black`}>
                            {lead.lead_quality}
                          </span>
                        )}
                        {lead.category && (
                          <span className="px-2.5 py-1 text-xs bg-blue-100 text-blue-800 rounded-full text-black">
                            {lead.category}
                          </span>
                        )}
                      </div>
                    </div>
                    {waLink && (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-11 h-11 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0"
                        aria-label="WhatsApp"
                      >
                        <span className="text-white text-xl">💬</span>
                      </a>
                    )}
                  </div>

                  <div className="mt-4 space-y-1.5 text-black text-sm">
                    {lead.email && <div>📧 {lead.email}</div>}
                    {lead.phone_raw && <div>📱 {lead.phone_raw}</div>}
                    {lead.address && <div>📍 {lead.address}</div>}
                    {lead.website && (
                      <div>
                        🌐{' '}
                        <a
                          href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {lead.website.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}
                  </div>

                  {(lead.rating || lead.review_count) && (
                    <div className="mt-3 text-black text-sm">
                      ⭐ {lead.rating || 'N/A'} ({lead.review_count || 0} reviews)
                    </div>
                  )}

                  {lead.tags && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {lead.tags.split(';').map((tag, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-gray-100 text-black text-xs rounded">
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 text-center text-black text-xs">
        Strategic B2B Lead Dashboard — Colombo • Tap 💬 to message on WhatsApp
      </footer>
    </div>
  );
}