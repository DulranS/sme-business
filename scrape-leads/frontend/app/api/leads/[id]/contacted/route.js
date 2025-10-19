// app/api/leads/[id]/contacted/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ✅ Point to the SAME contacted_leads.json used in /api/leads/route.js
// This path goes: [id]/contacted → leads → api → contacted_leads.json
const CONTACTED_PATH = join(__dirname, '../../../contacted_leads.json');

export async function POST(request, { params }) {
  const { id } = params;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
  }

  try {
    // Ensure the directory exists (optional but safe)
    const dir = dirname(CONTACTED_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Load existing contacted data
    let contactedMap = {};
    if (fs.existsSync(CONTACTED_PATH)) {
      const data = fs.readFileSync(CONTACTED_PATH, 'utf-8');
      if (data.trim()) {
        contactedMap = JSON.parse(data);
      }
    }

    // Update timestamp
    contactedMap[id] = new Date().toISOString();

    // Save back as JSON
    fs.writeFileSync(CONTACTED_PATH, JSON.stringify(contactedMap, null, 2));

    return NextResponse.json({ success: true, last_contacted: contactedMap[id] });
  } catch (error) {
    console.error('[Contacted API] Error:', error);
    return NextResponse.json({ error: 'Failed to update contact status' }, { status: 500 });
  }
}