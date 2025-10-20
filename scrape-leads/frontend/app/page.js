'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Head from 'next/head';

// ==============================
// 📞 PHONE NORMALIZATION (Sri Lanka)
// ==============================
function normalizePhone(phone) {
  if (!phone) return '';
  let digits = phone.toString().replace(/\D/g, '');

  // Already in 94XXXXXXXXX (11-digit) format
  if (digits.startsWith('94') && digits.length === 11) {
    return digits;
  }
  // Starts with 0 (local format): 0771234567 → 94771234567
  if (digits.startsWith('0') && digits.length === 10) {
    return '94' + digits.substring(1);
  }
  // Pure 9-digit mobile: 771234567 → 94771234567
  if (digits.length === 9 && /^[789]/.test(digits)) {
    return '94' + digits;
  }
  // Fallback: assume last 9 digits are the number
  if (digits.length >= 9) {
    const last9 = digits.slice(-9);
    if (/^[789]/.test(last9)) {
      return '94' + last9;
    }
  }
  return '';
}

// ==============================
// 🔍 SEARCH & FILTERING
// ==============================
function fuzzyMatch(text, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (text || '').toLowerCase().includes(q);
}

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// ==============================
// 📊 LEAD SCORING & ACTIONS
// ==============================
function calculateLeadScore(lead) {
  let score = 0;
  if (lead.lead_quality === 'HOT') score += 40;
  else if (lead.lead_quality === 'WARM') score += 20;

  if (lead.email && lead.phone_raw) score += 25;
  else if (lead.email || lead.phone_raw) score += 10;

  const rating = parseFloat(lead.rating) || 0;
  const reviews = parseInt(lead.review_count) || 0;

  if (rating >= 4.0) score += 15;
  if (reviews >= 20) score += 10;

  const tags = (lead.tags || '').toLowerCase();
  if (tags.includes('decision-maker')) score += 10;
  if (tags.includes('urgent')) score += 10;

  return Math.min(100, Math.max(0, score));
}

function getNextBestAction(lead) {
  const hasEmail = !!lead.email;
  const hasPhone = !!lead.phone_raw;
  const isHot = lead.lead_quality === 'HOT';
  const rating = parseFloat(lead.rating) || 0;
  const reviews = parseInt(lead.review_count) || 0;
  const tags = (lead.tags || '').toLowerCase();

  if (tags.includes('urgent')) return '🚨 Urgent: Follow up immediately';
  if (isHot && hasEmail && !lead.last_contacted) return '📧 Send intro email';
  if (hasPhone && (rating >= 4.0 || reviews >= 20)) return '📞 Call now – high trust signal';
  if (hasPhone) return '💬 Start WhatsApp chat';
  if (hasEmail) return '📧 Email for initial contact';
  return '🔍 Research before outreach';
}

// ==============================
// 💬 WHATSAPP LINK GENERATION
// ==============================
function generateWhatsAppLink(lead, template, myBusinessName) {
  const normalized = normalizePhone(lead.whatsapp_number || lead.phone_raw);
  if (!normalized || normalized.length !== 11 || !normalized.startsWith('94')) return '';

  let message = template
    .replace(/{{contact_name}}/g, lead.contact_name || 'there')
    .replace(/{{business_name}}/g, lead.business_name || 'your business')
    .replace(/{{my_business_name}}/g, myBusinessName);

  const encodedMessage = encodeURIComponent(message.trim());
  // ✅ CORRECT FORMAT: NO SPACES — https://wa.me/94771234567?text=...
  return `https://wa.me/${normalized}?text=${encodedMessage}`;
}

function renderMessagePreview(lead, template, myBusinessName) {
  return template
    .replace(/{{contact_name}}/g, lead.contact_name || 'there')
    .replace(/{{business_name}}/g, lead.business_name || 'your business')
    .replace(/{{my_business_name}}/g, myBusinessName);
}

// ==============================
// 🧩 MAIN COMPONENT
// ==============================
export default function LeadDashboard() {
  // === State ===
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
  const [sortField, setSortField] = useState('score');
  const [sortDirection, setSortDirection] = useState('desc');

  const [myBusinessName, setMyBusinessName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('myBusinessName') || 'Your Company';
    }
    return 'Your Company';
  });

  const [whatsappTemplate, setWhatsappTemplate] = useState(() => {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem('whatsappTemplate') ||
        'Hi {{contact_name}}, I’m reaching out from {{my_business_name}} about {{business_name}}. Would you be open to a quick chat?'
      );
    }
    return 'Hi {{contact_name}}, I’m reaching out from {{my_business_name}} about {{business_name}}. Would you be open to a quick chat?';
  });

  // === Side Effects ===
  useEffect(() => {
    localStorage.setItem('myBusinessName', myBusinessName);
  }, [myBusinessName]);

  useEffect(() => {
    localStorage.setItem('whatsappTemplate', whatsappTemplate);
  }, [whatsappTemplate]);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const showToast = useCallback((msg) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: '' }), 2500);
  }, []);

  // === Data Fetching ===
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const res = await fetch('/api/leads');
        if (!res.ok) throw new Error('Failed to load leads');
        const data = await res.json();
        const leadsWithScore = data.map((lead) => ({
          ...lead,
          _score: calculateLeadScore(lead),
        }));
        setLeads(leadsWithScore);
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

  // === Derived Data ===
  const allTags = useMemo(() => {
    const tags = new Set();
    leads.forEach((lead) => {
      if (lead.tags) {
        lead.tags.split(';').forEach((tag) => tags.add(tag.trim()));
      }
    });
    return Array.from(tags).sort();
  }, [leads]);

  const uniqueCategories = [...new Set(leads.map((l) => l.category).filter(Boolean))].sort();

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const normalizedLeadPhone = normalizePhone(lead.phone_raw);
      const normalizedSearchPhone = normalizePhone(debouncedSearchTerm);

      const matchesSearch =
        fuzzyMatch(lead.business_name, debouncedSearchTerm) ||
        fuzzyMatch(lead.contact_name, debouncedSearchTerm) ||
        fuzzyMatch(lead.email, debouncedSearchTerm) ||
        normalizedLeadPhone.includes(normalizedSearchPhone) ||
        fuzzyMatch(lead.address, debouncedSearchTerm) ||
        fuzzyMatch(lead.tags, debouncedSearchTerm);

      const matchesQuality = qualityFilter === 'ALL' || lead.lead_quality === qualityFilter;
      const matchesCategory = categoryFilter === 'ALL' || lead.category === categoryFilter;

      const hasEmail = !!lead.email;
      const hasPhone = !!lead.phone_raw;
      const matchesContact =
        contactFilter === 'ALL' ||
        (contactFilter === 'EMAIL' && hasEmail) ||
        (contactFilter === 'PHONE' && hasPhone) ||
        (contactFilter === 'BOTH' && hasEmail && hasPhone);

      const rating = parseFloat(lead.rating) || 0;
      const reviews = parseInt(lead.review_count) || 0;

      const matchesMinRating = !minRating || rating >= parseFloat(minRating);
      const matchesMaxRating = !maxRating || rating <= parseFloat(maxRating);
      const matchesReviews = !minReviews || reviews >= parseInt(minReviews);

      const matchesTag =
        tagFilter === 'ALL' ||
        (lead.tags && lead.tags.split(';').map((t) => t.trim()).includes(tagFilter));

      return (
        matchesSearch &&
        matchesQuality &&
        matchesCategory &&
        matchesContact &&
        matchesMinRating &&
        matchesMaxRating &&
        matchesReviews &&
        matchesTag
      );
    });
  }, [
    leads,
    debouncedSearchTerm,
    qualityFilter,
    categoryFilter,
    contactFilter,
    minRating,
    maxRating,
    minReviews,
    tagFilter,
  ]);

  const sortedLeads = useMemo(() => {
    return [...filteredLeads].sort((a, b) => {
      let aVal, bVal;

      if (sortField === 'score') {
        aVal = a._score;
        bVal = b._score;
      } else if (sortField === 'rating') {
        aVal = parseFloat(a.rating) || 0;
        bVal = parseFloat(b.rating) || 0;
      } else if (sortField === 'quality') {
        const order = { HOT: 3, WARM: 2, COLD: 1 };
        aVal = order[a.lead_quality] || 0;
        bVal = order[b.lead_quality] || 0;
      } else if (sortField === 'name') {
        aVal = (a.contact_name || a.business_name || '').toLowerCase();
        bVal = (b.contact_name || b.business_name || '').toLowerCase();
      } else {
        return 0;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });
  }, [filteredLeads, sortField, sortDirection]);

  // === EXPORTS ===
  const exportToCSV = () => {
    if (sortedLeads.length === 0) return;

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
      'tags',
      'last_contacted',
    ];

    const csvContent = [
      headers.join(','),
      ...sortedLeads.map((lead) =>
        headers
          .map((field) => {
            const val = lead[field] || '';
            return `"${String(val).replace(/"/g, '""')}"`;
          })
          .join(',')
      ),
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

  const exportWhatsAppNumbers = () => {
    const numbers = sortedLeads
      .map((lead) => normalizePhone(lead.whatsapp_number || lead.phone_raw))
      .filter((n) => n.length === 11 && n.startsWith('94'))
      .map((n) => `+${n}`);

    if (numbers.length === 0) {
      showToast('❌ No valid WhatsApp numbers to export');
      return;
    }

    const blob = new Blob([numbers.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'whatsapp_numbers.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`✅ Exported ${numbers.length} WhatsApp numbers!`);
  };

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`✅ ${label} copied!`);
    } catch (err) {
      showToast('❌ Failed to copy');
    }
  };

  // === RENDER ===
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="space-y-3 w-full max-w-md">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white p-4 rounded-xl shadow-sm animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <p className="text-black mb-2 text-lg">⚠️ Failed to load leads</p>
          <p className="text-gray-600 text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 relative">
      <Head>
        <title>🚀 Colombo B2B Revenue Hub | Close Deals Faster</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </Head>

      {toast.show && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-black text-white px-4 py-2 rounded-lg shadow-lg text-center text-sm">
          {toast.message}
        </div>
      )}

      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex justify-between items-start mb-3">
            <h1 className="text-lg font-bold text-black">Colombo B2B Revenue Hub</h1>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm text-blue-600 font-medium mt-1"
            >
              {showFilters ? '▲ Hide Filters' : '▼ Show Filters'}
            </button>
          </div>

          {/* Business & Template */}
          <div className="space-y-3 mb-4">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Your Business Name</label>
              <input
                type="text"
                value={myBusinessName}
                onChange={(e) => setMyBusinessName(e.target.value)}
                className="w-full p-2.5 text-sm border border-gray-300 rounded bg-gray-50 text-black"
                placeholder="e.g. Colombo Tech Solutions"
              />
            </div>

            <div>
              <label className="text-xs text-gray-600 block mb-1">
                WhatsApp Message Template
                <span className="ml-2 text-gray-500 text-[10px]">
                  Use: {{contact_name}}, {{business_name}}, {{my_business_name}}
                </span>
              </label>
              <textarea
                value={whatsappTemplate}
                onChange={(e) => setWhatsappTemplate(e.target.value)}
                rows={2}
                className="w-full p-2.5 text-sm border border-gray-300 rounded bg-gray-50 text-black resize-none"
                placeholder="Hi {{contact_name}}, I'm from {{my_business_name}}..."
              />
            </div>

            {sortedLeads.length > 0 && (
              <div className="text-xs bg-blue-50 p-2.5 rounded text-gray-700 border border-blue-100">
                <strong>Preview:</strong>{' '}
                "{renderMessagePreview(sortedLeads[0], whatsappTemplate, myBusinessName)}"
              </div>
            )}
          </div>

          <input
            type="text"
            placeholder="Search business, contact, email, phone, or address..."
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
                  {uniqueCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
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
                  {allTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
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
              {sortedLeads.length} leads • Avg Score:{' '}
              {sortedLeads.length
                ? Math.round(
                    sortedLeads.reduce((sum, l) => sum + l._score, 0) / sortedLeads.length
                  )
                : 0}
              /100
            </span>
            <div className="flex gap-2">
              <button
                onClick={exportToCSV}
                disabled={sortedLeads.length === 0}
                className={`px-3 py-2 rounded font-medium text-sm ${
                  sortedLeads.length === 0
                    ? 'bg-gray-200 text-gray-500'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                📥 CSV
              </button>
              <button
                onClick={exportWhatsAppNumbers}
                disabled={sortedLeads.length === 0}
                className={`px-3 py-2 rounded font-medium text-sm ${
                  sortedLeads.length === 0
                    ? 'bg-gray-200 text-gray-500'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                📲 WA Numbers
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4">
        {sortedLeads.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-black text-lg font-medium">No leads match your filters</p>
            <p className="text-gray-600 mt-1">Try broadening your search or adjusting filters.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setQualityFilter('ALL');
                setCategoryFilter('ALL');
                setContactFilter('ALL');
                setTagFilter('ALL');
                setMinRating('');
                setMaxRating('');
                setMinReviews('');
              }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="space-y-4 pb-24">
            {sortedLeads.map((lead, i) => {
              const contactName = lead.contact_name || lead.business_name || 'Prospect';
              const waLink = generateWhatsAppLink(lead, whatsappTemplate, myBusinessName);
              const isHighValue = lead._score >= 75;

              return (
                <div
                  key={lead.id || i}
                  className={`border rounded-xl p-4 bg-white shadow-sm transition-all ${
                    isHighValue ? 'border-green-500 ring-1 ring-green-200' : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="font-bold text-black text-lg leading-tight">{contactName}</h2>
                      {lead.business_name && lead.business_name !== contactName && (
                        <p className="text-black text-sm mt-1 opacity-90">{lead.business_name}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {lead.lead_quality && (
                          <span
                            className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                              lead.lead_quality === 'HOT'
                                ? 'bg-red-100 text-red-800'
                                : lead.lead_quality === 'WARM'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {lead.lead_quality === 'HOT'
                              ? '🔥 HOT'
                              : lead.lead_quality === 'WARM'
                              ? '🔸 WARM'
                              : '❄️ COLD'}
                          </span>
                        )}
                        {lead.category && (
                          <span className="px-2.5 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                            {lead.category}
                          </span>
                        )}
                        {isHighValue && (
                          <span className="px-2.5 py-1 text-xs bg-green-100 text-green-800 rounded-full font-bold">
                            💎 High-Value (Score: {lead._score})
                          </span>
                        )}
                        <span className="px-2.5 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                          {lead._score}/100
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-blue-700 font-medium">
                        ➡️ {getNextBestAction(lead)}
                      </div>
                    </div>
                    {waLink && (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => showToast('Opening WhatsApp...')}
                        className="flex-shrink-0 w-12 h-12 rounded-full bg-green-600 flex items-center justify-center active:scale-95 transition hover:bg-green-700"
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
                      {lead.tags.split(';').map((tag, idx) => {
                        const trimmed = tag.trim();
                        const isUrgent = trimmed.toLowerCase().includes('urgent');
                        const isDecisionMaker = trimmed.toLowerCase().includes('decision-maker');
                        let bgColor = 'bg-gray-100';
                        if (isUrgent) bgColor = 'bg-red-100';
                        else if (isDecisionMaker) bgColor = 'bg-green-100';

                        return (
                          <span
                            key={idx}
                            className={`px-2 py-1 ${bgColor} text-black text-xs rounded-full`}
                          >
                            {trimmed}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {lead.last_contacted && (
                    <div className="mt-3 text-xs text-gray-600">
                      Last contacted: {new Date(lead.last_contacted).toLocaleDateString()}
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