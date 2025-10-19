// app/api/leads/[id]/contacted/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONTACTED_PATH = join(__dirname, '../contacted_leads.json');

export async function POST(request, { params }) {
  const { id } = params;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
  }

  try {
    // Load existing contacted data
    let contactedMap = {};
    if (fs.existsSync(CONTACTED_PATH)) {
      const data = fs.readFileSync(CONTACTED_PATH, 'utf-8');
      contactedMap = JSON.parse(data || '{}');
    }

    // Update timestamp
    contactedMap[id] = new Date().toISOString();

    // Save back
    fs.writeFileSync(CONTACTED_PATH, JSON.stringify(contactedMap, null, 2));

    return NextResponse.json({ success: true, last_contacted: contactedMap[id] });
  } catch (error) {
    console.error('[Contacted API] Error:', error);
    return NextResponse.json({ error: 'Failed to update contact status' }, { status: 500 });
  }
}