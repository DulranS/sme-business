// app/api/leads/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CSV_PATH = join(__dirname, 'output_business_leads.csv');
const CONTACTED_PATH = join(__dirname, 'contacted_leads.json');

// ─── Utility Functions ────────────────────────────────────────
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[\r\n\t]+/g, ' ').replace(/<[^>]*>/g, '');
}

function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && re.test(email);
}

function normalizeToE164(phone) {
  if (!phone) return '';
  try {
    const { parsePhoneNumber } = require('libphonenumber-js');
    const parsed = parsePhoneNumber(phone.toString(), 'LK');
    if (parsed?.isValid()) return parsed.format('E.164');
  } catch (e) {}

  const digits = phone.toString().replace(/\D/g, '');
  if (digits.startsWith('94') && digits.length === 11) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+94${digits.slice(1)}`;
  if (digits.length === 9 && /^[789]/.test(digits)) return `+94${digits}`;
  if (digits.length >= 9) {
    const last9 = digits.slice(-9);
    if (/^[789]/.test(last9)) return `+94${last9}`;
  }
  return '';
}

function generateWhatsAppLink(e164) {
  if (!e164) return '';
  const digits = e164.replace(/\D/g, '');
  return digits.length >= 10 ? `https://wa.me/${digits}` : '';
}

function generateLeadId(lead) {
  const key = `${lead.business_name}|${lead.phone_e164}|${lead.email}`.toLowerCase();
  return crypto.createHash('md5').update(key).digest('hex').substring(0, 12);
}

function loadContactedMap() {
  try {
    if (fs.existsSync(CONTACTED_PATH)) {
      return JSON.parse(fs.readFileSync(CONTACTED_PATH, 'utf8'));
    }
  } catch (e) {
    console.warn('[Leads API] Failed to load contacted data');
  }
  return {};
}

function parseScrapedDate(dateStr) {
  if (!dateStr) return '';
  const trimmed = sanitize(dateStr);
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  }
  const ukMatch = trimmed.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (ukMatch) {
    const [, day, month, year] = ukMatch;
    const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  }
  return '';
}

function getDaysSinceScraped(scrapedDate) {
  if (!scrapedDate) return null;
  const scraped = new Date(scrapedDate);
  const today = new Date();
  const diffTime = today - scraped;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// ─── Main Handler ─────────────────────────────────────────────
export async function GET() {
  let records = [];
  let source = 'live';

  try {
    if (!fs.existsSync(CSV_PATH)) {
      throw new Error('CSV not found');
    }
    const content = fs.readFileSync(CSV_PATH, 'utf-8');
    records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });
  } catch (error) {
    console.warn('[Leads API] Using empty fallback:', error.message);
    records = [];
    source = 'fallback';
  }

  try {
    const seen = new Set();
    const cleanedLeads = [];
    const contactedMap = loadContactedMap();

    for (const row of records) {
      const business_name = sanitize(row.business_name);
      if (!business_name || business_name.toLowerCase().includes('summary')) continue;

      const email = sanitize(row.email);
      const validEmail = isValidEmail(email) ? email : '';

      const phoneCandidates = [
        row.whatsapp_number, row.whatsapp, row.phone_raw, row.phone,
        row.mobile, row.contact_number,
      ].filter(Boolean);
      const rawPhone = phoneCandidates.length ? sanitize(phoneCandidates[0]) : '';
      const phone_e164 = normalizeToE164(rawPhone);
      const whatsapp_link = generateWhatsAppLink(phone_e164);

      const dedupeKey = `${business_name}|${phone_e164}|${validEmail}`.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      let contact_name = sanitize(row.contact_name) || business_name;
      const lead_quality = ['HOT', 'WARM'].includes((row.lead_quality || '').trim().toUpperCase())
        ? row.lead_quality.trim().toUpperCase()
        : 'COLD';

      const rating = parseFloat(row.rating) >= 0 ? String(parseFloat(row.rating).toFixed(1)) : '';
      const review_count = parseInt(row.review_count, 10) >= 0 ? String(parseInt(row.review_count, 10)) : '';

      const scraped_date = parseScrapedDate(row.scraped_date || row.date_scraped);
      const days_since_scraped = getDaysSinceScraped(scraped_date);
      const has_contact = !!(validEmail || phone_e164);
      const is_high_value = lead_quality === 'HOT' && has_contact && (parseFloat(rating) >= 4.0 || parseInt(review_count) >= 20);

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
        contact_status: 'NEW',
      };

      const id = generateLeadId(baseLead);
      const last_contacted = contactedMap[id] || '';

      cleanedLeads.push({ ...baseLead, id, last_contacted });
    }

    const qualityOrder = { HOT: 0, WARM: 1, COLD: 2 };
    cleanedLeads.sort((a, b) => {
      if (a.lead_quality !== b.lead_quality) return qualityOrder[a.lead_quality] - qualityOrder[b.lead_quality];
      if (a.days_since_scraped !== null && b.days_since_scraped !== null)
        return a.days_since_scraped - b.days_since_scraped;
      return a.business_name.localeCompare(b.business_name, 'en', { sensitivity: 'base' });
    });

    return NextResponse.json({
      leads: cleanedLeads,
      source,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Leads API] Processing failed:', error);
    return NextResponse.json({
      leads: [],
      source: 'error',
      error: 'Data processing failed',
    }, { status: 200 });
  }
}