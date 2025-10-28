// app/api/leads/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';
import { parsePhoneNumber } from 'libphonenumber-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CSV_PATH = join(__dirname, 'output_business_leads.csv');
const CONTACTED_PATH = join(__dirname, 'contacted_leads.json');

// ───────────────────────────────────────────────
// Utility Functions
// ───────────────────────────────────────────────

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/<[^>]*>/g, '');
}

function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && re.test(email);
}

function normalizeToE164(phone) {
  if (!phone) return '';
  try {
    const parsed = parsePhoneNumber(phone.toString(), 'LK');
    if (parsed?.isValid()) {
      return parsed.format('E.164');
    }
  } catch (e) {
    const digits = phone.toString().replace(/\D/g, '');
    if (digits.startsWith('94') && digits.length === 11) {
      return `+${digits}`;
    }
    if (digits.startsWith('0') && digits.length === 10) {
      return `+94${digits.slice(1)}`;
    }
    if (digits.length === 9 && /^[789]/.test(digits)) {
      return `+94${digits}`;
    }
  }
  return '';
}

// 🔧 FIXED: Removed extra space in URL
function generateWhatsAppLink(e164) {
  if (!e164 || typeof e164 !== 'string') return '';
  const digitsOnly = e164.replace(/\D/g, '');
  return digitsOnly.length >= 10 ? `https://wa.me/${digitsOnly}` : '';
}

function generateLeadId(lead) {
  const key = `${lead.business_name}|${lead.phone_e164}|${lead.email}`.toLowerCase();
  return crypto.createHash('md5').update(key).digest('hex').substring(0, 12);
}

function loadContactedMap() {
  try {
    if (fs.existsSync(CONTACTED_PATH)) {
      const data = fs.readFileSync(CONTACTED_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn('[Leads API] Failed to load contacted data:', e.message);
  }
  return {};
}

/**
 * Parses scraped_date and returns ISO string or empty.
 * Accepts: "2025-10-28", "28/10/2025", etc.
 */
function parseScrapedDate(dateStr) {
  if (!dateStr) return '';
  const trimmed = sanitize(dateStr);
  if (!trimmed) return '';

  // Try ISO first
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  }

  // Try DD/MM/YYYY
  const ukMatch = trimmed.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (ukMatch) {
    const [, day, month, year] = ukMatch;
    const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  }

  return '';
}

/**
 * Calculates days between today and scraped date.
 */
function getDaysSinceScraped(scrapedDate) {
  if (!scrapedDate) return null;
  const scraped = new Date(scrapedDate);
  const today = new Date();
  const diffTime = today - scraped;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// ───────────────────────────────────────────────
// Main Handler
// ───────────────────────────────────────────────

export async function GET() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`[Leads API] CSV file not found at: ${CSV_PATH}`);
    return NextResponse.json(
      { error: 'Lead data file missing. Contact admin.' },
      { status: 404 }
    );
  }

  try {
    const content = fs.readFileSync(CSV_PATH, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      skip_records_with_empty_values: false,
    });

    const seen = new Set();
    const cleanedLeads = [];
    const contactedMap = loadContactedMap();

    for (const row of records) {
      const business_name = sanitize(row.business_name);
      if (!business_name || business_name.toLowerCase().includes('summary')) continue;

      // Email
      const email = sanitize(row.email);
      const validEmail = isValidEmail(email) ? email : '';

      // Phone: prioritize WhatsApp field if valid
      const phoneCandidates = [
        row.whatsapp_number,
        row.whatsapp,
        row.phone_raw,
        row.phone,
        row.mobile,
        row.contact_number,
      ].filter(Boolean);
      const rawPhone = phoneCandidates.length ? sanitize(phoneCandidates[0]) : '';
      const phone_e164 = normalizeToE164(rawPhone);
      const whatsapp_link = generateWhatsAppLink(phone_e164);

      const dedupeKey = `${business_name}|${phone_e164}|${validEmail}`.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      // Contact name
      let contact_name = sanitize(row.contact_name);
      if (!contact_name) contact_name = business_name;

      // Lead quality
      const lead_quality = ['HOT', 'WARM'].includes((row.lead_quality || '').trim().toUpperCase())
        ? row.lead_quality.trim().toUpperCase()
        : 'COLD';

      // Ratings
      const rating = parseFloat(row.rating) >= 0 ? String(parseFloat(row.rating).toFixed(1)) : '';
      const review_count = parseInt(row.review_count, 10) >= 0 ? String(parseInt(row.review_count, 10)) : '';

      // 📅 Scraped date & freshness
      const scraped_date = parseScrapedDate(row.scraped_date || row.date_scraped);
      const days_since_scraped = getDaysSinceScraped(scraped_date);

      // 🎯 Business intelligence flags
      const has_contact = !!(validEmail || phone_e164);
      const is_high_value = lead_quality === 'HOT' && has_contact && (parseFloat(rating) >= 4.0 || parseInt(review_count) >= 20);

      // Build lead
      const baseLead = {
        business_name,
        contact_name,
        category: sanitize(row.category),
        lead_quality,
        phone_raw: rawPhone,
        phone_e164,
        whatsapp_link,
        email: validEmail,
        website: sanitize(row.website),
        address: sanitize(row.address),
        rating,
        review_count,
        tags: sanitize(row.tags),
        scraped_date,
        days_since_scraped,
        is_high_value,
        has_contact,
        // Future-ready fields
        contact_status: 'NEW', // Could be updated via POST later
      };

      const id = generateLeadId(baseLead);
      const last_contacted = contactedMap[id] || '';

      cleanedLeads.push({
        ...baseLead,
        id,
        last_contacted,
      });
    }

    // Sort: HOT > WARM > COLD, then by recency, then name
    const qualityOrder = { HOT: 0, WARM: 1, COLD: 2 };
    cleanedLeads.sort((a, b) => {
      if (a.lead_quality !== b.lead_quality) {
        return qualityOrder[a.lead_quality] - qualityOrder[b.lead_quality];
      }
      // Prefer newer leads
      if (a.days_since_scraped !== null && b.days_since_scraped !== null) {
        return a.days_since_scraped - b.days_since_scraped;
      }
      return a.business_name.localeCompare(b.business_name, 'en', { sensitivity: 'base' });
    });

    return NextResponse.json(cleanedLeads);
  } catch (error) {
    console.error('[Leads API] Fatal error processing leads:', {
      message: error.message,
      stack: error.stack,
      csvPath: CSV_PATH,
    });
    return NextResponse.json(
      { error: 'Unable to load leads. Admin has been notified.' },
      { status: 500 }
    );
  }
}