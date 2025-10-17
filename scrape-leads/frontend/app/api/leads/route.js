// app/api/leads/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CSV_PATH = join(__dirname, 'output_business_leads.csv');

// Helper: extract clean 9-digit Sri Lankan local number (without country code)
function extractLocalNumber(phone) {
  if (!phone) return '';
  const digits = phone.toString().replace(/\D/g, '');
  // Sri Lankan numbers: usually 10 digits including 0, or 9 without leading 0
  // We want last 9 digits after removing country code (94) or leading 0
  if (digits.startsWith('94') && digits.length >= 11) {
    return digits.substring(2).slice(-9);
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return digits.substring(1);
  }
  if (digits.length === 9) {
    return digits;
  }
  // Fallback: take last 9 digits if long enough
  return digits.length >= 9 ? digits.slice(-9) : '';
}

export async function GET() {
  if (!fs.existsSync(CSV_PATH)) {
    return NextResponse.json(
      { error: 'output_business_leads.csv not found in /app/api/leads/' },
      { status: 404 }
    );
  }

  try {
    const content = fs.readFileSync(CSV_PATH, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });

    const seen = new Set(); // for deduplication
    const cleaned = records
      .filter(row => {
        const name = (row.business_name || '').trim();
        if (!name || name.includes('SUMMARY') || name.toLowerCase() === 'business name') {
          return false;
        }

        // Optional: dedupe by business + phone/email
        const key = `${name}|${row.phone_raw || ''}|${row.email || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(row => {
        // Clean email
        let email = (row.email || '').trim();
        if (
          !email ||
          email.includes('.png') ||
          email.includes('sentry') ||
          email.includes('@domain.com') ||
          email.includes('example.com') ||
          !email.includes('@')
        ) {
          email = '';
        }

        // Clean phone
        const phone_raw = (row.phone_raw || '').toString().trim();

        // Derive WhatsApp number (9-digit local format)
        const whatsapp_number = extractLocalNumber(phone_raw);

        // Normalize lead quality
        let lead_quality = (row.lead_quality || '').trim().toUpperCase();
        if (!['HOT', 'WARM', 'COLD'].includes(lead_quality)) {
          lead_quality = 'COLD';
        }

        // Ensure all fields exist to avoid frontend errors
        return {
          business_name: (row.business_name || '').trim(),
          contact_name: '', // intentionally left for frontend flexibility
          category: (row.category || '').trim(),
          lead_quality,
          phone_raw: phone_raw,
          whatsapp_number, // critical for frontend WhatsApp link
          email,
          website: (row.website || '').trim(),
          address: (row.address || '').trim(),
          rating: row.rating ? String(row.rating).trim() : '',
          review_count: row.review_count ? String(row.review_count).trim() : '',
          tags: (row.tags || '').trim(),
        };
      })
      .sort((a, b) => {
        // Sort: HOT > WARM > COLD, then by business name
        const qualityOrder = { HOT: 0, WARM: 1, COLD: 2 };
        if (a.lead_quality !== b.lead_quality) {
          return qualityOrder[a.lead_quality] - qualityOrder[b.lead_quality];
        }
        return a.business_name.localeCompare(b.business_name);
      });

    return NextResponse.json(cleaned);
  } catch (error) {
    console.error('CSV Parsing Error:', error);
    return NextResponse.json({ error: 'Failed to parse leads data' }, { status: 500 });
  }
}