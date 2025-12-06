// app/api/whatsapp/route.js
import { NextResponse } from 'next/server';
import { parse as csvParse } from 'csv-parse/sync';

// Only allow numbers starting with 07 (Sri Lankan mobile)
function isValidSriLankanMobile(raw) {
  if (!raw) return false;
  const cleaned = raw.replace(/\D/g, ''); // Remove non-digits
  return cleaned.startsWith('07') && cleaned.length >= 9 && cleaned.length <= 10;
}

// Format for WhatsApp: 077... → 9477...
function formatPhoneForWhatsApp(raw) {
  if (!isValidSriLankanMobile(raw)) return null;
  let cleaned = raw.replace(/\D/g, '');
  return '94' + cleaned.slice(1); // 0771234567 → 94771234567
}

// Replace template variables
function replaceTemplateVars(text, data, fieldMappings, senderName) {
  if (!text) return '';
  let result = text;
  for (const [varName, csvCol] of Object.entries(fieldMappings)) {
    const regex = new RegExp(`{{\\s*${varName}\\s*}}`, 'g');
    if (!regex.test(result)) continue;
    if (varName === 'sender_name') {
      result = result.replace(regex, senderName || '[Sender]');
    } else if (csvCol && data[csvCol] !== undefined) {
      result = result.replace(regex, String(data[csvCol]));
    } else {
      result = result.replace(regex, `[MISSING: ${varName}]`);
    }
  }
  return result;
}

export async function POST(request) {
  try {
    const { csvContent, whatsappTemplate, senderName, fieldMappings } = await request.json();
    
    if (!csvContent || !whatsappTemplate || !senderName) {
      return NextResponse.json({ error: 'Missing WhatsApp message template' }, { status: 400 });
    }

    const records = csvParse(csvContent, { skip_empty_lines: true, columns: true });
    
    const validContacts = records
      .map(row => {
        // Check both whatsapp_number and phone_raw for 07 prefix
        const rawPhone = row.whatsapp_number || row.phone_raw;
        const phone = formatPhoneForWhatsApp(rawPhone);
        if (!phone) return null;
        const message = replaceTemplateVars(whatsappTemplate, row, fieldMappings, senderName);
        return { business: row.business_name || 'Business', phone, url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}` };
      })
      .filter(Boolean);

    if (validContacts.length === 0) {
      return NextResponse.json({ error: 'No valid Sri Lankan mobile numbers (starting with 07) found' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      contacts: validContacts,
      total: validContacts.length
    });

  } catch (error) {
    console.error('WhatsApp link error:', error);
    return NextResponse.json({ error: 'Failed to generate WhatsApp links' }, { status: 500 });
  }
}