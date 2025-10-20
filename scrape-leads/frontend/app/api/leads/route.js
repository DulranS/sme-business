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

// ✅ Paths to data files
const CSV_PATH = join(__dirname, 'output_business_leads.csv');
const CONTACTED_PATH = join(__dirname, 'contacted_leads.json');

// ───────────────────────────────────────────────
// Utility Functions (Single Responsibility)
// ───────────────────────────────────────────────

/**
 * Sanitizes a string: trims, collapses whitespace, strips HTML-like tags.
 * @param {any} str - Input value
 * @returns {string} Cleaned string
 */
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/<[^>]*>/g, '');
}

/**
 * Validates basic email format.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && re.test(email);
}

/**
 * Normalizes a phone number to E.164 format (e.g., +94771234567).
 * Falls back to heuristic parsing if libphonenumber fails.
 * @param {string} phone - Raw phone input
 * @returns {string} E.164 number or empty string
 */
function normalizeToE164(phone) {
  if (!phone) return '';
  try {
    const parsed = parsePhoneNumber(phone.toString(), 'LK');
    if (parsed?.isValid()) {
      return parsed.format('E.164');
    }
  } catch (e) {
    // Fallback: extract digits and apply Sri Lankan rules
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

/**
 * Generates a WhatsApp deep link from an E.164 number.
 * @param {string} e164 - E.164 formatted phone number (e.g., +94771234567)
 * @returns {string} WhatsApp URL or empty string
 */
function generateWhatsAppLink(e164) {
  if (!e164 || typeof e164 !== 'string') return '';
  const digitsOnly = e164.replace(/\D/g, '');
  // WhatsApp requires full international number with no formatting
  return digitsOnly.length >= 10 ? `https://wa.me/${digitsOnly}` : '';
}

/**
 * Generates a deterministic, non-cryptographic ID for deduplication.
 * ⚠️ Not for security—only for UI consistency and tracking.
 * @param {Object} lead - Lead object with business_name, phone_e164, email
 * @returns {string} 12-char hex ID
 */
function generateLeadId(lead) {
  const key = `${lead.business_name}|${lead.phone_e164}|${lead.email}`.toLowerCase();
  // MD5 is acceptable here for deterministic hashing (not security-sensitive)
  return crypto.createHash('md5').update(key).digest('hex').substring(0, 12);
}

/**
 * Loads contacted timestamps from JSON file.
 * @returns {Record<string, string>} Map of lead ID → ISO timestamp
 */
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

// ───────────────────────────────────────────────
// Main Handler
// ───────────────────────────────────────────────

export async function GET() {
  // Guard: CSV must exist
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`[Leads API] CSV file not found at: ${CSV_PATH}`);
    return NextResponse.json(
      { error: 'Lead data file missing. Contact admin.' },
      { status: 404 }
    );
  }

  try {
    // Read and parse CSV
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

    // Process each row
    for (const row of records) {
      const business_name = sanitize(row.business_name);
      // Skip empty or summary-like entries
      if (!business_name || business_name.toLowerCase().includes('summary')) {
        continue;
      }

      // Email
      const email = sanitize(row.email);
      const validEmail = isValidEmail(email) ? email : '';

      // Phone: try multiple fields
      const phoneCandidates = [
        row.phone_raw,
        row.phone,
        row.mobile,
        row.whatsapp,
        row.contact_number,
      ].filter(Boolean);
      const rawPhone = phoneCandidates.length ? sanitize(phoneCandidates[0]) : '';

      // Normalize phone
      const phone_e164 = normalizeToE164(rawPhone);
      const whatsapp_link = generateWhatsAppLink(phone_e164);

      // Deduplication key
      const dedupeKey = `${business_name}|${phone_e164}|${validEmail}`.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      // Contact name fallback
      let contact_name = sanitize(row.contact_name);
      if (!contact_name) contact_name = business_name;

      // Lead quality
      const lead_quality = ['HOT', 'WARM'].includes((row.lead_quality || '').trim().toUpperCase())
        ? row.lead_quality.trim().toUpperCase()
        : 'COLD';

      // Ratings
      const rating = parseFloat(row.rating) >= 0 ? String(parseFloat(row.rating).toFixed(1)) : '';
      const review_count = parseInt(row.review_count, 10) >= 0 ? String(parseInt(row.review_count, 10)) : '';

      // Build base lead
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
      };

      // Final lead with metadata
      const id = generateLeadId(baseLead);
      const last_contacted = contactedMap[id] || '';

      cleanedLeads.push({
        ...baseLead,
        id,
        last_contacted,
      });
    }

    // Sort: HOT > WARM > COLD, then alphabetically
    const qualityOrder = { HOT: 0, WARM: 1, COLD: 2 };
    cleanedLeads.sort((a, b) => {
      if (a.lead_quality !== b.lead_quality) {
        return qualityOrder[a.lead_quality] - qualityOrder[b.lead_quality];
      }
      return a.business_name.localeCompare(b.business_name, 'en', { sensitivity: 'base' });
    });

    return NextResponse.json(cleanedLeads);
  } catch (error) {
    console.error('[Leads API] Fatal error:', error);
    return NextResponse.json(
      { error: 'Unable to load leads. Try again later.' },
      { status: 500 }
    );
  }
}