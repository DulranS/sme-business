// app/api/leads/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const CONTACTED_PATH = join(__dirname, '..', 'app', 'api', 'leads', 'contacted_leads.json');

// Utility: sanitize string (prevent XSS, trim, collapse whitespace)
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/<[^>]*>/g, ''); // strip HTML
}

// Utility: validate email with regex
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Helper: extract clean 9-digit Sri Lankan local number (for WhatsApp)
function extractLocalNumber(phone) {
  if (!phone) return '';
  const digits = phone.toString().replace(/\D/g, '');

  if (digits.startsWith('94') && digits.length >= 11) {
    const local = digits.substring(2);
    return local.length >= 9 ? local.slice(-9) : '';
  }

  if (digits.startsWith('0') && digits.length === 10) {
    return digits.substring(1);
  }

  if (digits.length === 9 && /^[789]/.test(digits)) {
    return digits;
  }

  return digits.length >= 9 ? digits.slice(-9) : '';
}

// Helper: normalize phone to E.164 for display (e.g., +94771234567)
function normalizeToE164(phone) {
  if (!phone) return '';
  const digits = phone.toString().replace(/\D/g, '');
  if (digits.startsWith('94') && digits.length === 11) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+94${digits.substring(1)}`;
  }
  if (digits.length === 9 && /^[789]/.test(digits)) {
    return `+94${digits}`;
  }
  return '';
}

// Generate deterministic ID
function generateLeadId(lead) {
  const key = `${lead.business_name}|${lead.phone_e164}|${lead.email}`.toLowerCase();
  return crypto.createHash('md5').update(key).digest('hex').substring(0, 12);
}

// Load contacted timestamps (optional persistence)
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
    const cleaned = [];
    const contactedMap = loadContactedMap();

    for (const row of records) {
      const business_name = sanitize(row.business_name);
      if (!business_name || business_name.toLowerCase().includes('summary')) {
        continue;
      }

      const email = sanitize(row.email);
      const validEmail = email && isValidEmail(email) ? email : '';

      const phoneCandidates = [
        row.phone_raw,
        row.phone,
        row.mobile,
        row.whatsapp,
        row.contact_number
      ].filter(Boolean);
      const rawPhone = phoneCandidates.length ? sanitize(phoneCandidates[0]) : '';
      const e164Phone = normalizeToE164(rawPhone);
      const whatsappLocal = extractLocalNumber(rawPhone);

      const dedupeKey = `${business_name}|${e164Phone}|${validEmail}`.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      let contact_name = sanitize(row.contact_name);
      if (!contact_name) {
        contact_name = business_name;
      }

      const lead_quality = ['HOT', 'WARM'].includes((row.lead_quality || '').trim().toUpperCase())
        ? row.lead_quality.trim().toUpperCase()
        : 'COLD';

      const rating = parseFloat(row.rating) >= 0 ? String(parseFloat(row.rating).toFixed(1)) : '';
      const review_count = parseInt(row.review_count, 10) >= 0 ? String(parseInt(row.review_count, 10)) : '';

      const baseLead = {
        business_name,
        contact_name,
        category: sanitize(row.category),
        lead_quality,
        phone_raw: rawPhone,
        phone_e164: e164Phone,
        whatsapp_number: whatsappLocal,
        email: validEmail,
        website: sanitize(row.website),
        address: sanitize(row.address),
        rating,
        review_count,
        tags: sanitize(row.tags),
      };

      const id = generateLeadId(baseLead);
      const last_contacted = contactedMap[id] || '';

      cleaned.push({
        ...baseLead,
        id,
        last_contacted,
      });
    }

    const qualityOrder = { HOT: 0, WARM: 1, COLD: 2 };
    cleaned.sort((a, b) => {
      if (a.lead_quality !== b.lead_quality) {
        return qualityOrder[a.lead_quality] - qualityOrder[b.lead_quality];
      }
      return a.business_name.localeCompare(b.business_name, 'en', { sensitivity: 'base' });
    });

    return NextResponse.json(cleaned);
  } catch (error) {
    console.error('[Leads API] Fatal error:', error);
    return NextResponse.json(
      { error: 'Unable to load leads. Try again later.' },
      { status: 500 }
    );
  }
}