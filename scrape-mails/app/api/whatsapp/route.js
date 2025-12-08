// app/api/whatsapp/route.js
import { NextResponse } from 'next/server';
import { parse as csvParse } from 'csv-parse/sync';

function formatPhoneForWhatsApp(raw) {
  if (!raw || raw === 'N/A') return null;
  let cleaned = raw.toString().replace(/\D/g, '');
  if (cleaned.startsWith('0') && cleaned.length >= 9) {
    cleaned = '94' + cleaned.slice(1);
  }
  return /^[1-9]\d{9,14}$/.test(cleaned) ? cleaned : null;
}

function replaceTemplateVars(text, data, fieldMappings, senderName) {
  if (!text) return '';
  let result = text;
  for (const [varName, csvCol] of Object.entries(fieldMappings)) {
    const re = new RegExp(`{{\\s*${varName}\\s*}}`, 'g');
    if (!re.test(result)) continue;
    if (varName === 'sender_name') {
      result = result.replace(re, senderName || '[Sender]');
    } else if (csvCol && data[csvCol] !== undefined) {
      result = result.replace(re, String(data[csvCol]));
    } else {
      result = result.replace(re, `[MISSING: ${varName}]`);
    }
  }
  return result;
}

export async function POST(request) {
  try {
    const { csvContent, whatsappTemplate, senderName, fieldMappings } = await request.json();
    
    if (!csvContent || !whatsappTemplate || !senderName) {
      return NextResponse.json({ error: 'Missing WhatsApp template' }, { status: 400 });
    }

    const records = csvParse(csvContent, { skip_empty_lines: true, columns: true });
    
    const validContacts = records
      .map(row => {
        const rawPhone = row.whatsapp_number || row.phone_raw;
        const phone = formatPhoneForWhatsApp(rawPhone);
        if (!phone) return null;
        const message = replaceTemplateVars(whatsappTemplate, row, fieldMappings, senderName);
        return { 
          business: row.business_name || 'Business', 
          phone, 
          url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
        };
      })
      .filter(Boolean);

    if (validContacts.length === 0) {
      return NextResponse.json({ error: 'No valid WhatsApp numbers found' }, { status: 400 });
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