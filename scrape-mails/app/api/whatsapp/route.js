// app/api/whatsapp/route.js
import { NextResponse } from 'next/server';
import { parse as csvParse } from 'csv-parse/sync';

// Only allow Sri Lankan mobiles (start with 07)
function isValidSriLankanMobile(raw) {
  if (!raw) return false;
  const cleaned = raw.replace(/\D/g, '');
  return cleaned.startsWith('07') && cleaned.length >= 9 && cleaned.length <= 10;
}

// Format for WhatsApp: 077... → 9477...
function formatPhone(raw) {
  if (!isValidSriLankanMobile(raw)) return null;
  const cleaned = raw.replace(/\D/g, '');
  return '94' + cleaned.slice(1);
}

// Replace placeholders
function replaceVars(text, data, mappings, sender) {
  if (!text) return '';
  let result = text;
  for (const [varName, col] of Object.entries(mappings)) {
    const re = new RegExp(`{{\\s*${varName}\\s*}}`, 'g');
    if (!re.test(result)) continue;
    if (varName === 'sender_name') result = result.replace(re, sender);
    else if (col && data[col] !== undefined) result = result.replace(re, String(data[col]));
    else result = result.replace(re, `[MISSING: ${varName}]`);
  }
  return result;
}

export async function POST(req) {
  try {
    const { csvContent, whatsappTemplate, senderName, fieldMappings } = await req.json();
    if (!csvContent || !whatsappTemplate || !senderName) {
      return NextResponse.json({ error: 'Missing WhatsApp template or sender name' }, { status: 400 });
    }

    const records = csvParse(csvContent, { skip_empty_lines: true, columns: true });
    const valid = records
      .map(row => {
        const raw = row.whatsapp_number || row.phone_raw;
        const phone = formatPhone(raw);
        if (!phone) return null;
        const msg = replaceVars(whatsappTemplate, row, fieldMappings, senderName);
        return { business: row.business_name || 'Business', phone, url: `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` };
      })
      .filter(Boolean);

    if (valid.length === 0) {
      return NextResponse.json({ error: 'No valid Sri Lankan mobile numbers (starting with 07) found' }, { status: 400 });
    }

    return NextResponse.json({ success: true, contacts: valid, total: valid.length });
  } catch (error) {
    console.error('WhatsApp error:', error);
    return NextResponse.json({ error: 'Failed to generate WhatsApp links' }, { status: 500 });
  }
}