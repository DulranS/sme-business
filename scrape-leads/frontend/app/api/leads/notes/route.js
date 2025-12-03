// app/api/leads/notes/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const NOTES_PATH = join(__dirname, 'lead_notes.json');

// Ensure file exists
if (!fs.existsSync(NOTES_PATH)) {
  fs.writeFileSync(NOTES_PATH, JSON.stringify({}));
}

export async function GET() {
  const data = fs.readFileSync(NOTES_PATH, 'utf8');
  return NextResponse.json(JSON.parse(data));
}

export async function POST(req) {
  try {
    const { leadId, note } = await req.json();
    if (!leadId || typeof note !== 'string') {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const current = JSON.parse(fs.readFileSync(NOTES_PATH, 'utf8'));
    current[leadId] = note;
    fs.writeFileSync(NOTES_PATH, JSON.stringify(current, null, 2));

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}