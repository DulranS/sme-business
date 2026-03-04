/* eslint-disable no-console */
// One-off migration script to seed Supabase leads from the existing CSV.
// Run from the scrape-mails directory with:
//   node scripts/migrate-csv-to-supabase.js

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { parse } = require('csv-parse/sync');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(
    '[migrate-csv-to-supabase] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  const csvPath = path.join(process.cwd(), 'anemails', 'business_leads.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(
      `[migrate-csv-to-supabase] CSV not found at ${csvPath}. Adjust path if needed.`
    );
    process.exit(1);
  }

  console.log(`[migrate-csv-to-supabase] Reading ${csvPath} ...`);
  const raw = fs.readFileSync(csvPath, 'utf8');
  const records = parse(raw, { columns: true, skip_empty_lines: true });

  let imported = 0;
  let skipped = 0;

  for (const row of records) {
    const businessName = row.business_name || row['Business Name'] || row['business'] || null;
    const address = row.address || row['Address'] || null;
    const phone =
      row.whatsapp_number || row['whatsapp_number'] || row['Phone'] || row['phone'] || null;
    const email = row.email || row['email'] || null;

    if (!businessName && !email) {
      skipped += 1;
      continue;
    }

    const insert = {
      business_name: businessName,
      email,
      phone,
      address,
      source: 'csv',
      status: 'cold',
    };

    const { error } = await supabase
      .from('leads')
      .upsert(insert, { onConflict: 'email' });

    if (error) {
      console.error('[migrate-csv-to-supabase] upsert failed', error.message, insert);
      skipped += 1;
    } else {
      imported += 1;
    }
  }

  console.log(
    `[migrate-csv-to-supabase] Completed. Imported: ${imported}, skipped: ${skipped}`
  );
}

run().catch((err) => {
  console.error('[migrate-csv-to-supabase] Fatal error', err);
  process.exit(1);
});

