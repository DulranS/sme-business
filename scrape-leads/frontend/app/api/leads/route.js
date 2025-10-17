// app/api/leads/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CSV_PATH = join(__dirname, 'output_business_leads.csv');

export async function GET() {
  if (!fs.existsSync(CSV_PATH)) {
    return NextResponse.json(
      { error: 'output_business_leads.csv not found in /app/api/' },
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

    // Clean data on the server side
    const cleaned = records
      .filter(row => {
        const name = (row.business_name || '').trim();
        return name && !name.includes('SUMMARY');
      })
      .map(row => {
        let email = (row.email || '').trim();
        // Remove fake emails
        if (email.includes('.png') || email.includes('sentry') || email.includes('@domain.com')) {
          email = '';
        }

        return {
          ...row,
          email,
          contact_name: '', // We'll build this in frontend for flexibility
        };
      });

    return NextResponse.json(cleaned);
  } catch (error) {
    console.error('CSV Error:', error);
    return NextResponse.json({ error: 'Failed to parse CSV' }, { status: 500 });
  }
}