'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Head from 'next/head';

// Helper to normalize Sri Lankan phone numbers to 94XXXXXXXXX format
function normalizePhone(phone) {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');

  // Already in 94XXXXXXXXX format (11 digits starting with 94)
  if (digits.startsWith('94') && digits.length === 11) {
    return digits;
  }

  // Local mobile: 077XXXXXXX → 9477XXXXXXX
  if (digits.startsWith('0') && digits.length === 10) {
    return '94' + digits.substring(1);
  }

  // Short mobile: 77XXXXXXX (9 digits, starts with 7/8/9)
  if (digits.length === 9 && /^[789]/.test(digits)) {
    return '94' + digits;
  }

  // Landline or other: e.g., 011XXXXXX → 9411XXXXXX
  if (digits.startsWith('0') && digits.length >= 9) {
    return '94' + digits.substring(1);
  }

  // Fallback: just return cleaned digits
  return digits;
}

export default function LeadDashboard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [qualityFilter, setQualityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [contactFilter, setContactFilter] = useState('ALL');
  const [minRating, setMinRating] = useState('');
  const [maxRating, setMaxRating] = useState('');
  const [minReviews, setMinReviews] = useState('');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });

  const showToast = useCallback((msg) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: '' }), 2000);
  }, []);

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
      // Normalize once for performance
      const normalizedLeadPhone = normalizePhone(lead.phone_raw);
      const normalizedSearch = normalizePhone(searchTerm);

      const matchesSearch = !searchTerm ||
        (lead.business_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.contact_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        normalizedLeadPhone.includes(normalizedSearch);

      const matchesQuality = qualityFilter === 'ALL' || lead.lead_quality === qualityFilter;
      const matchesCategory = categoryFilter === 'ALL' || lead.category === categoryFilter;

      const hasEmail = !!lead.email;
      const hasPhone = !!lead.phone_raw;
      const matchesContact = contactFilter === 'ALL' ||
        (contactFilter === 'EMAIL' && hasEmail) ||
        (contactFilter === 'PHONE' && hasPhone) ||
        (contactFilter === 'BOTH' && hasEmail && hasPhone);

      const rating = parseFloat(lead.rating) || 0;
      const reviews = parseInt(lead.review_count) || 0;

      const matchesMinRating = !minRating || rating >= parseFloat(minRating);
      const matchesMaxRating = !maxRating || rating <= parseFloat(maxRating);
      const matchesReviews = !minReviews || reviews >= parseInt(minReviews);

      const matchesTag = tagFilter === 'ALL' || 
        (lead.tags && lead.tags.split(';').map(t => t.trim()).includes(tagFilter));

      return matchesSearch && matchesQuality && matchesCategory && 
             matchesContact && matchesMinRating && matchesMaxRating && 
             matchesReviews && matchesTag;
    });
  }, [leads, searchTerm, qualityFilter, categoryFilter, contactFilter, minRating, maxRating, minReviews, tagFilter]);

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
    a.download = 'colombo_b2b_leads.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`✅ ${label} copied!`);
    } catch (err) {
      showToast('❌ Failed to copy');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <p className="text-black text-center text-lg">Loading leads...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <p className="text-black mb-2 text-lg">⚠️ Failed to load leads</p>
          <p className="text-black text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 relative">
      <Head>
        <title>Colombo B2B Leads</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-black text-white px-4 py-2 rounded-lg shadow-lg text-center text-sm">
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-lg font-bold text-black">Colombo B2B Leads</h1>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm text-blue-600 font-medium"
            >
              {showFilters ? '▲ Hide Filters' : '▼ Show Filters'}
            </button>
          </div>

          <input
            type="text"
            placeholder="Search business, contact, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 text-base border border-gray-300 rounded-lg mb-3 text-black placeholder-gray-500"
          />

          {showFilters && (
            <div className="space-y-3 mb-3">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={qualityFilter}
                  onChange={(e) => setQualityFilter(e.target.value)}
                  className="w-full p-3 text-base border border-gray-300 rounded-lg text-black bg-white"
                >
                  <option value="ALL">All Qualities</option>
                  <option value="HOT">🔥 HOT</option>
                  <option value="WARM">🔸 WARM</option>
                  <option value="COLD">❄️ COLD</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full p-3 text-base border border-gray-300 rounded-lg text-black bg-white"
                >
                  <option value="ALL">All Categories</option>
                  {uniqueCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={contactFilter}
                  onChange={(e) => setContactFilter(e.target.value)}
                  className="w-full p-3 text-base border border-gray-300 rounded-lg text-black bg-white"
                >
                  <option value="ALL">Any Contact</option>
                  <option value="EMAIL">WithEmail</option>
                  <option value="PHONE">With Phone</option>
                  <option value="BOTH">WithEmail + Phone</option>
                </select>

                <select
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="w-full p-3 text-base border border-gray-300 rounded-lg text-black bg-white"
                >
                  <option value="ALL">All Tags</option>
                  {allTags.map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Min Rating (e.g. 4.0)"
                  value={minRating}
                  onChange={(e) => setMinRating(e.target.value)}
                  min="0"
                  max="5"
                  step="0.1"
                  className="w-full p-3 text-base border border-gray-300 rounded-lg text-black placeholder-gray-500"
                />
                <input
                  type="number"
                  placeholder="Max Rating (e.g. 4.9)"
                  value={maxRating}
                  onChange={(e) => setMaxRating(e.target.value)}
                  min="0"
                  max="5"
                  step="0.1"
                  className="w-full p-3 text-base border border-gray-300 rounded-lg text-black placeholder-gray-500"
                />
              </div>

              <input
                type="number"
                placeholder="Min Reviews (e.g. 50)"
                value={minReviews}
                onChange={(e) => setMinReviews(e.target.value)}
                min="0"
                className="w-full p-3 text-base border border-gray-300 rounded-lg text-black placeholder-gray-500"
              />
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <span className="text-black text-sm">
              {filteredLeads.length} leads
            </span>
            <button
              onClick={exportToCSV}
              disabled={filteredLeads.length === 0}
              className={`px-4 py-2.5 rounded-lg font-medium text-base ${
                filteredLeads.length === 0
                  ? 'bg-gray-200 text-gray-500'
                  : 'bg-green-600 text-white active:bg-green-700'
              }`}
            >
              📥 Export
            </button>
          </div>
        </div>
      </header>

      {/* Leads List */}
      <main className="px-4 pt-4">
        {filteredLeads.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-black text-lg">No matching leads</p>
            <p className="text-black text-sm mt-1">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="space-y-4 pb-24">
            {filteredLeads.map((lead, i) => {
              const contactName = lead.contact_name || lead.business_name || 'Prospect';
              const normalizedWaNumber = normalizePhone(lead.whatsapp_number);
              const waLink = normalizedWaNumber ? `https://wa.me/${normalizedWaNumber}` : '';

              return (
                <div key={i} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="font-bold text-black text-lg leading-tight">{contactName}</h2>
                      {lead.business_name && lead.business_name !== contactName && (
                        <p className="text-black text-sm mt-1 opacity-90">{lead.business_name}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {lead.lead_quality && (
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                            lead.lead_quality === 'HOT' ? 'bg-red-100 text-red-800' :
                            lead.lead_quality === 'WARM' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {lead.lead_quality === 'HOT' ? '🔥 HOT' :
                             lead.lead_quality === 'WARM' ? '🔸 WARM' : '❄️ COLD'}
                          </span>
                        )}
                        {lead.category && (
                          <span className="px-2.5 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
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
                        onClick={() => showToast('Opening WhatsApp...')}
                        className="flex-shrink-0 w-12 h-12 rounded-full bg-green-600 flex items-center justify-center active:scale-95 transition"
                        aria-label="Message on WhatsApp"
                      >
                        <span className="text-white text-xl">💬</span>
                      </a>
                    )}
                  </div>

                  <div className="mt-3 space-y-2 text-black text-base">
                    {lead.email && (
                      <div className="flex items-center justify-between">
                        <a
                          href={`mailto:${lead.email}`}
                          className="truncate text-blue-600 hover:underline flex items-center gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            showToast('Opening email app...');
                          }}
                        >
                          📧 {lead.email}
                        </a>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(lead.email, 'Email');
                          }}
                          className="text-gray-500 hover:text-blue-600 active:scale-95"
                          aria-label="Copy email"
                        >
                          📋
                        </button>
                      </div>
                    )}
                    {lead.phone_raw && (
                      <div className="flex items-center justify-between">
                        <a
                          href={`tel:+${normalizePhone(lead.phone_raw)}`}
                          className="text-blue-600 hover:underline flex items-center gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            showToast('Opening phone dialer...');
                          }}
                        >
                          📱 {lead.phone_raw}
                        </a>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(lead.phone_raw, 'Phone');
                          }}
                          className="text-gray-500 hover:text-blue-600 active:scale-95"
                          aria-label="Copy phone"
                        >
                          📋
                        </button>
                      </div>
                    )}
                    {lead.address && (
                      <div className="text-sm opacity-90 truncate">📍 {lead.address}</div>
                    )}
                  </div>

                  {(lead.rating || lead.review_count) && (
                    <div className="mt-2 text-black text-sm opacity-90">
                      ⭐ {lead.rating || 'N/A'} ({lead.review_count || 0} reviews)
                    </div>
                  )}

                  {lead.tags && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {lead.tags.split(';').map((tag, idx) => (
                        <span key={idx} className="px-2 py-1 bg-gray-100 text-black text-xs rounded-full">
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
    </div>
  );
}