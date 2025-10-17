// app/api/leads/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function GET() {
  const csvPath = join(__dirname, 'whatsapp_ready_leads.csv');

  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found at:', csvPath);
    return NextResponse.json({ error: 'Leads file not found' }, { status: 404 });
  }

  try {
    const content = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });

    // Optional: filter out summary rows
    const cleanRecords = records.filter(row =>
      row.contact_name &&
      !row.contact_name.includes('SUMMARY') &&
      row.contact_name !== 'Prospect'
    );

    return NextResponse.json(cleanRecords);
  } catch (error) {
    console.error('CSV Parse Error:', error);
    return NextResponse.json({ error: 'Failed to parse leads' }, { status: 500 });
  }
}