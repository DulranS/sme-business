'use client';

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import Head from 'next/head';

// ==============================
// 📞 PHONE NORMALIZATION (Sri Lanka)
// ==============================
function normalizePhone(phone) {
  if (!phone) return '';
  let digits = phone.toString().replace(/\D/g, '');
  if (digits.startsWith('94') && digits.length === 11) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '94' + digits.substring(1);
  if (digits.length === 9 && /^[789]/.test(digits)) return '94' + digits;
  if (digits.length > 9) {
    const last9 = digits.slice(-9);
    if (/^[789]/.test(last9)) return '94' + last9;
  }
  return digits;
}

// ==============================
// 💼 STRATEGIC BUSINESS LOGIC
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
  const days = lead.days_since_scraped;
  if (days !== null && days <= 3) score += 10;
  else if (days !== null && days <= 7) score += 5;
  return Math.min(100, Math.max(0, score));
}

function getNextBestAction(lead) {
  const hasEmail = !!lead.email;
  const hasPhone = !!lead.phone_raw;
  const isHot = lead.lead_quality === 'HOT';
  const rating = parseFloat(lead.rating) || 0;
  const reviews = parseInt(lead.review_count) || 0;
  if (isHot && hasPhone) return '📞 Call now – HOT lead';
  if (hasPhone && (rating >= 4.0 || reviews >= 20)) return '💬 WhatsApp: High trust signal';
  if (hasPhone) return '💬 Start WhatsApp chat';
  if (hasEmail) return '📧 Email for initial contact';
  return '🔍 Research: Find phone or decision-maker';
}

function getLeadUrgency(lead) {
  const days = lead.days_since_scraped;
  if (days === null) return { label: 'Unknown', color: 'gray-400' };
  if (days <= 1) return { label: '🔥 TODAY', color: 'red-500' };
  if (days <= 3) return { label: '⏰ This week', color: 'orange-500' };
  if (days <= 7) return { label: '📆 This month', color: 'yellow-500' };
  return { label: '⏳ Expired', color: 'gray-500' };
}

function estimateRevenuePotential(score) {
  if (score >= 80) return '$500–$2,000';
  if (score >= 60) return '$200–$800';
  if (score >= 40) return '$100–$400';
  return 'Low';
}

// ==============================
// 💬 MESSAGE GENERATORS
// ==============================
function generateMessage1(lead, template) {
  return lead?.business_name
    ? template.replace(/{business_name}/g, lead.business_name.trim())
    : template.replace(/{business_name}/g, 'your business');
}

function generateMessage2(lead, myBusinessName, linkedInUrl, template) {
  return template
    .replace(/{business_name}/g, lead?.business_name?.trim() || 'your business')
    .replace(/{my_business_name}/g, myBusinessName)
    .replace(/{linkedInUrl}/g, linkedInUrl);
}

function generateEmailMessage(lead, myBusinessName, linkedInUrl, template) {
  return template
    .replace(/{business_name}/g, lead?.business_name?.trim() || 'your business')
    .replace(/{my_business_name}/g, myBusinessName)
    .replace(/{linkedInUrl}/g, linkedInUrl);
}

function generateWhatsAppLink(lead, message1) {
  const normalized = normalizePhone(lead.whatsapp_number || lead.phone_raw);
  if (!normalized || normalized.length < 9) return '';
  let digitsOnly = normalized.replace(/\D/g, '');
  if (!digitsOnly.startsWith('94')) digitsOnly = '94' + digitsOnly.slice(-9);
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message1)}`;
}

// ==============================
// 🛠️ UTILS
// ==============================
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const fuzzyMatch = (text, query) => {
  if (!query) return true;
  return (text || '').toLowerCase().includes(query.toLowerCase());
};

// ==============================
// 🎯 LEAD CARD
// ==============================
const LeadCard = memo(({ lead, myBusinessName, linkedInUrl, message1Template, message2Template, emailTemplate, onCopy, onMarkContacted, leadNotes, onNoteChange, showToast }) => {
  const msg1 = generateMessage1(lead, message1Template);
  const msg2 = generateMessage2(lead, myBusinessName, linkedInUrl, message2Template);
  const waLink = generateWhatsAppLink(lead, msg1);

  const copyMessage2 = () => {
    navigator.clipboard.writeText(msg2)
      .then(() => showToast('✅ Follow-up message copied! Paste & send after your first message.'))
      .catch(() => showToast('❌ Failed to copy'));
  };

const handleComposeEmail = () => {
  const emailBody = generateEmailMessage(lead, myBusinessName, linkedInUrl, emailTemplate);
  const subject = `Quick question for ${lead.business_name || 'your business'}`;
  // Encode email to prevent issues with special characters
  const mailtoLink = `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;

  // Attempt to open the default email client
  const emailWindow = window.open(mailtoLink, '_self');

  // If the browser blocks the mailto (common on iOS/Safari or secure environments), copy to clipboard as fallback
  if (!emailWindow || emailWindow.closed || emailWindow.closed === undefined) {
    const fallbackMessage = `To: ${lead.email}\nSubject: ${subject}\n\n${emailBody}`;
    navigator.clipboard.writeText(fallbackMessage)
      .then(() => showToast('📧 Email client unavailable — full message copied to clipboard!'))
      .catch(() => showToast('❌ Unable to open email or copy message. Please check browser permissions.'));
  }
};

  const isHighValue = lead._score >= 75;
  const urgency = getLeadUrgency(lead);
  const revenue = estimateRevenuePotential(lead._score);

  return (
    <div className={`rounded-xl p-4 bg-white shadow-sm mb-4 border ${isHighValue ? 'border-green-300 ring-1 ring-green-50' : 'border-gray-200'}`}>
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 text-lg break-words">{lead.business_name || 'Unnamed Business'}</h2>
          {lead.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm opacity-90 mt-1 block truncate"
            >
              📍 {lead.address}
            </a>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {lead.lead_quality && (
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                lead.lead_quality === 'HOT' ? 'bg-red-100 text-red-700' :
                lead.lead_quality === 'WARM' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {lead.lead_quality}
              </span>
            )}
            {urgency.label && (
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full bg-${urgency.color.replace('-', '-100 text-')} bg-opacity-20`}>
                {urgency.label}
              </span>
            )}
            <span className="px-2.5 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">{revenue}</span>
          </div>
          <div className="mt-2 text-xs text-blue-700 font-medium">➡️ {getNextBestAction(lead)}</div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-gray-800 text-sm">
        {lead.email && (
          <div className="flex items-center justify-between">
            <a href={`mailto:${lead.email}`} className="truncate text-blue-600 hover:underline flex items-center gap-1">📧 {lead.email}</a>
            <button onClick={() => onCopy(lead.email, 'Email')} className="text-gray-400 hover:text-blue-600 text-base">📋</button>
          </div>
        )}
        {lead.phone_raw && (
          <div className="flex items-center justify-between">
            <a href={`tel:+${normalizePhone(lead.phone_raw)}`} className="text-blue-600 hover:underline flex items-center gap-1">📱 {lead.phone_raw}</a>
            <button onClick={() => onCopy(lead.phone_raw, 'Phone')} className="text-gray-400 hover:text-blue-600 text-base">📋</button>
          </div>
        )}
      </div>

      {(lead.rating || lead.review_count) && (
        <div className="mt-2 text-gray-700 text-sm">⭐ {lead.rating || 'N/A'} ({lead.review_count || 0} reviews)</div>
      )}

      {lead.website && (
        <div className="mt-2 text-sm">
          🌐 <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
            {lead.website}
          </a>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-gray-100 space-y-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">📝 Notes</label>
          <textarea
            value={leadNotes[lead.id] || ''}
            onChange={(e) => onNoteChange(lead.id, e.target.value)}
            placeholder="Add notes for your team..."
            className="w-full text-sm p-2 border border-gray-300 rounded bg-gray-50 text-gray-800"
            rows={2}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">📅 Last contacted:</span>
          <span className="text-sm text-gray-800">
            {lead.last_contacted ? new Date(lead.last_contacted).toLocaleDateString() : 'Never'}
          </span>
          <button
            onClick={() => onMarkContacted(lead.id)}
            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded"
          >
            Mark Today
          </button>
        </div>

        {/* === OUTREACH ACTIONS === */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {waLink && (
            <>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 text-center rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition"
              >
                💬 Msg 1
              </a>
              <button
                onClick={copyMessage2}
                className="w-full py-2 text-center rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
              >
                📋 Msg 2
              </button>
            </>
          )}
          {lead.email && (
            <button
              onClick={handleComposeEmail}
              className="w-full py-2 text-center rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition col-span-full"
            >
              📧 Compose Email
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// ==============================
// 🚀 MAIN DASHBOARD
// ==============================
export default function LeadDashboard() {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [qualityFilter, setQualityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [contactFilter, setContactFilter] = useState('ALL');
  const [minRating, setMinRating] = useState('');
  const [minReviews, setMinReviews] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });
  const [sortField, setSortField] = useState('score');
  const [sortDirection, setSortDirection] = useState('desc');
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Templates & Identity
  const [myBusinessName, setMyBusinessName] = useState(() => 
    typeof window !== 'undefined' ? localStorage.getItem('myBusinessName') || 'Dulran Samarasinghe' : 'Dulran Samarasinghe'
  );

  const [linkedInUrl, setLinkedInUrl] = useState(() => 
    typeof window !== 'undefined' 
      ? localStorage.getItem('linkedInUrl') || 'https://www.linkedin.com/in/dulran-samarasinghe-13941b175/'
      : 'https://www.linkedin.com/in/dulran-samarasinghe-13941b175/'
  );

  const [message1Template, setMessage1Template] = useState(() => 
    typeof window !== 'undefined' 
      ? localStorage.getItem('message1Template') || 'Hi, is this {business_name}?'
      : 'Hi, is this {business_name}?'
  );

  const [message2Template, setMessage2Template] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('message2Template') : null;
    return saved || `I hope you’re doing well. I’m reaching out because I currently offer a range of digital freelance services, including content creation, design, automation, and general online support.\n\nIf you need reliable, fast, and high-quality digital work done, I’d be happy to help.\nLet me know what you’re working on, and I’ll share how I can support you.\n\nBest regards,\n{my_business_name} - {linkedInUrl}`;
  });

  const [emailTemplate, setEmailTemplate] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('emailTemplate') : null;
    return saved || `Hi,\n\nIs this {business_name}?\n\nI hope you’re doing well. I’m reaching out because I currently offer a range of digital freelance services—including content creation, design, automation, and general online support.\n\nIf you need reliable, fast, and high-quality digital work done, I’d be happy to help.\nLet me know what you’re working on, and I’ll share how I can support you.\n\nBest regards,\n{my_business_name}\n{linkedInUrl}`;
  });

  const [leadNotes, setLeadNotes] = useState(() => 
    typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('leadNotes') || '{}') : {}
  );

  const [lastContacted, setLastContacted] = useState(() => 
    typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('lastContacted') || '{}') : {}
  );

  // Persist
  useEffect(() => { localStorage.setItem('myBusinessName', myBusinessName); }, [myBusinessName]);
  useEffect(() => { localStorage.setItem('linkedInUrl', linkedInUrl); }, [linkedInUrl]);
  useEffect(() => { localStorage.setItem('message1Template', message1Template); }, [message1Template]);
  useEffect(() => { localStorage.setItem('message2Template', message2Template); }, [message2Template]);
  useEffect(() => { localStorage.setItem('emailTemplate', emailTemplate); }, [emailTemplate]);
  useEffect(() => { localStorage.setItem('leadNotes', JSON.stringify(leadNotes)); }, [leadNotes]);
  useEffect(() => { localStorage.setItem('lastContacted', JSON.stringify(lastContacted)); }, [lastContacted]);

  // Scroll to top button
  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const showToast = useCallback((msg) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: '' }), 3500);
  }, []);

  // Fetch leads
  useEffect(() => {
    let isCurrent = true;
    const fetchLeads = async () => {
      try {
        const res = await fetch('/api/leads');
        const data = await res.json();
        if (!isCurrent) return;
        if (Array.isArray(data.leads)) {
          const enriched = data.leads.map(lead => ({
            ...lead,
            _score: calculateLeadScore(lead),
            last_contacted: lastContacted[lead.id] || lead.last_contacted
          }));
          setLeads(enriched);
        }
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        if (isCurrent) setLoading(false);
      }
    };
    fetchLeads();
    const interval = setInterval(fetchLeads, 30000);
    return () => { isCurrent = false; clearInterval(interval); };
  }, [lastContacted]);

  const uniqueCategories = [...new Set(leads.map(l => l.category).filter(Boolean))].sort();

  // Filtering
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const normPhone = normalizePhone(lead.phone_raw);
      const normSearch = normalizePhone(debouncedSearchTerm);
      const matchesSearch =
        fuzzyMatch(lead.business_name, debouncedSearchTerm) ||
        fuzzyMatch(lead.email, debouncedSearchTerm) ||
        normPhone.includes(normSearch) ||
        fuzzyMatch(lead.address, debouncedSearchTerm);
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
      const matchesReviews = !minReviews || reviews >= parseInt(minReviews);
      return matchesSearch && matchesQuality && matchesCategory && matchesContact && matchesMinRating && matchesReviews;
    });
  }, [leads, debouncedSearchTerm, qualityFilter, categoryFilter, contactFilter, minRating, minReviews]);

  // Sorting
  const sortedLeads = useMemo(() => {
    return [...filteredLeads].sort((a, b) => {
      let aVal = 0, bVal = 0;
      if (sortField === 'score') { aVal = a._score; bVal = b._score; }
      else if (sortField === 'rating') { aVal = parseFloat(a.rating) || 0; bVal = parseFloat(b.rating) || 0; }
      else if (sortField === 'quality') {
        const order = { HOT: 3, WARM: 2, COLD: 1 };
        aVal = order[a.lead_quality] || 0; bVal = order[b.lead_quality] || 0;
      }
      else if (sortField === 'name') {
        return (a.business_name || '').localeCompare(b.business_name || '');
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [filteredLeads, sortField, sortDirection]);

  // Business metrics
  const urgentLeads = sortedLeads.filter(l => (l.days_since_scraped || 999) <= 3);
  const contactedToday = Object.values(lastContacted).filter(date => date === new Date().toISOString().split('T')[0]).length;
  const avgScore = sortedLeads.length ? Math.round(sortedLeads.reduce((sum, l) => sum + l._score, 0) / sortedLeads.length) : 0;

  // Export functions
  const exportOutreachReport = () => {
    const today = new Date().toISOString().split('T')[0];
    const contacted = sortedLeads.filter(l => lastContacted[l.id] === today);
    let report = `OUTREACH REPORT – ${today}\n\n`;
    report += `Total leads contacted today: ${contacted.length}\n`;
    report += `Urgent leads (≤3 days old): ${urgentLeads.length}\n`;
    report += `\n--- CONTACTED TODAY ---\n`;
    contacted.forEach(l => {
      report += `${l.business_name} (${l.phone_raw || l.email}) – Notes: ${leadNotes[l.id] || 'None'}\n`;
    });
    navigator.clipboard.writeText(report).then(() => showToast('✅ Daily report copied!')).catch(() => showToast('❌ Failed'));
  };

  const exportToCSV = () => {
    if (sortedLeads.length === 0) return;
    const headers = ['business_name','address','phone_raw','email','website','rating','review_count','category','lead_quality','scraped_date','days_since_scraped','_score'];
    const csv = [headers.join(','), ...sortedLeads.map(l => headers.map(h => `"${String(l[h] || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `colombo_b2b_leads_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ CSV exported!');
  };

  const exportWhatsAppNumbers = () => {
    const numbers = sortedLeads
      .map(l => normalizePhone(l.whatsapp_number || l.phone_raw))
      .filter(n => n && n.length >= 9)
      .map(n => `+94${n.slice(-9)}`);
    if (numbers.length === 0) {
      showToast('❌ No valid numbers');
      return;
    }
    navigator.clipboard.writeText(numbers.join('\n'))
      .then(() => showToast(`✅ ${numbers.length} numbers copied!`))
      .catch(() => {
        const blob = new Blob([numbers.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'whatsapp_numbers.txt';
        a.click();
        URL.revokeObjectURL(url);
        showToast(`✅ ${numbers.length} numbers exported!`);
      });
  };

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`✅ ${label} copied!`);
    } catch {
      showToast('❌ Failed to copy');
    }
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-4xl mb-2">⏳</div>
          <p className="text-gray-800">Loading Colombo B2B leads...</p>
        </div>
      </div>
    );
  }

  // Empty
  if (sortedLeads.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No B2B Leads Available</h2>
          <p className="text-gray-600 mb-4">
            {leads.length === 0 ? "Pipeline hasn't run yet." : "No leads match your filters."}
          </p>
          {leads.length === 0 && (
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/leads/trigger-pipeline', { method: 'POST' });
                  if (res.ok) {
                    showToast('✅ Pipeline started! Refreshing in 10s...');
                    setTimeout(() => window.location.reload(), 10000);
                  } else {
                    const err = await res.json();
                    showToast(`❌ Failed: ${err.error}`);
                  }
                } catch {
                  showToast('⚠️ API unavailable');
                }
              }}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
            >
              🔄 Trigger Fresh Scrape
            </button>
          )}
        </div>
      </div>
    );
  }

  // Render
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Head>
        <title>Colombo B2B Leads | Strategic Outreach</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {toast.show && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-2.5 rounded-lg shadow-lg text-center text-sm font-medium">
          {toast.message}
        </div>
      )}

      {/* Scroll-to-top */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-4 z-50 w-11 h-11 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700 transition-all"
          aria-label="Scroll to top"
        >
          ↑
        </button>
      )}

      {/* Header – sticky only on desktop */}
      <header className={`${isMobile ? '' : 'sticky top-0 z-40'} bg-white border-b border-gray-200`}>
        <div className="px-4 py-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-3">
            <p className="text-blue-800 text-xs font-medium">
              🎯 <strong>Today:</strong> {urgentLeads.length} urgent leads • {contactedToday} contacted
            </p>
          </div>

          <div className="flex justify-between items-center mb-3">
            <h1 className="text-lg font-bold text-gray-900">Colombo B2B Leads</h1>
            <div className="flex gap-2">
              <button onClick={() => setShowSettings(!showSettings)} className="text-xs text-gray-600 hover:text-gray-900">
                {showSettings ? '▲' : '▼'} Settings
              </button>
              <button onClick={() => setShowFilters(!showFilters)} className="text-xs text-gray-600 hover:text-gray-900">
                {showFilters ? '▲' : '▼'} Filters
              </button>
            </div>
          </div>

          <input
            type="text"
            placeholder="Search business, phone, email, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2.5 text-sm border border-gray-300 rounded-lg mb-3 text-gray-800 placeholder-gray-500"
          />

          {showFilters && (
            <div className="space-y-2.5 mb-3">
              <div className="grid grid-cols-2 gap-2">
                <select value={qualityFilter} onChange={(e) => setQualityFilter(e.target.value)} className="w-full p-2 text-sm border border-gray-300 rounded bg-white text-gray-800">
                  <option value="ALL">All Qualities</option>
                  <option value="HOT">🔥 HOT</option>
                  <option value="WARM">🔸 WARM</option>
                  <option value="COLD">❄️ COLD</option>
                </select>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full p-2 text-sm border border-gray-300 rounded bg-white text-gray-800">
                  <option value="ALL">All Categories</option>
                  {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder="Min Rating" value={minRating} onChange={(e) => setMinRating(e.target.value)} min="0" max="5" step="0.1" className="w-full p-2 text-sm border border-gray-300 rounded bg-white text-gray-800" />
                <input type="number" placeholder="Min Reviews" value={minReviews} onChange={(e) => setMinReviews(e.target.value)} min="0" className="w-full p-2 text-sm border border-gray-300 rounded bg-white text-gray-800" />
              </div>
            </div>
          )}

          {showSettings && (
            <div className="space-y-2.5 mb-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="text"
                value={myBusinessName}
                onChange={(e) => setMyBusinessName(e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded text-gray-800"
                placeholder="Your name"
              />
              <input
                type="url"
                value={linkedInUrl}
                onChange={(e) => setLinkedInUrl(e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded text-gray-800"
                placeholder="LinkedIn URL"
              />
              <input
                type="text"
                value={message1Template}
                onChange={(e) => setMessage1Template(e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded text-gray-800"
                placeholder="WhatsApp Msg 1"
              />
              <textarea
                value={message2Template}
                onChange={(e) => setMessage2Template(e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded text-gray-800"
                rows="2"
                placeholder="WhatsApp Msg 2"
              />
              <textarea
                value={emailTemplate}
                onChange={(e) => setEmailTemplate(e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded text-gray-800"
                rows="3"
                placeholder="📧 Email Template"
              />
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <span className="text-gray-800 text-sm">
              {sortedLeads.length} leads • Avg: {avgScore}/100
            </span>
            <div className="flex gap-1.5">
              <button onClick={exportOutreachReport} className="px-2.5 py-1 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700">📝 Report</button>
              <button onClick={exportToCSV} className="px-2.5 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700">📥 CSV</button>
              <button onClick={exportWhatsAppNumbers} className="px-2.5 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700">📲 WhatsApp</button>
            </div>
          </div>

          <p className="text-[10px] text-gray-500 mt-2">
            ℹ️ Manual outreach ensures safety & privacy — aligned with WhatsApp’s human-first ethos.
          </p>
        </div>
      </header>

      <main className="px-4 pt-4">
        <div className="space-y-4">
          {sortedLeads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              myBusinessName={myBusinessName}
              linkedInUrl={linkedInUrl}
              message1Template={message1Template}
              message2Template={message2Template}
              emailTemplate={emailTemplate}
              onCopy={copyToClipboard}
              onMarkContacted={(id) => {
                const today = new Date().toISOString().split('T')[0];
                setLastContacted(prev => ({ ...prev, [id]: today }));
                showToast('✅ Marked as contacted today');
              }}
              leadNotes={leadNotes}
              onNoteChange={(id, note) => setLeadNotes(prev => ({ ...prev, [id]: note }))}
              showToast={showToast}
            />
          ))}
        </div>
      </main>
    </div>
  );
}