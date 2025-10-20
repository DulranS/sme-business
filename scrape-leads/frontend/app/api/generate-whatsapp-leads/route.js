// pages/api/generate-whatsapp-leads.js
import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import * as phonenumbers from 'google-libphonenumber';
import { parsePhoneNumber } from 'libphonenumber-js';

// ==============================
// 🔐 CONFIG — from environment
// ==============================
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) {
  throw new Error('Missing GOOGLE_API_KEY');
}

const LOCATION_NAME = process.env.LOCATION_NAME || 'Colombo, Sri Lanka';
const SEARCH_RADIUS = parseInt(process.env.SEARCH_RADIUS || '8000');
const MAX_SEARCH_QUERIES = parseInt(process.env.MAX_SEARCH_QUERIES || '4');
const MAX_RESULTS_PER_QUERY = parseInt(process.env.MAX_RESULTS_PER_QUERY || '8');
const MAX_TOTAL_BUSINESSES = parseInt(process.env.MAX_TOTAL_BUSINESSES || '30');
const MIN_RATING = parseFloat(process.env.MIN_RATING || '3.5');
const MIN_REVIEWS = parseInt(process.env.MIN_REVIEWS || '5');

// ==============================
// 📞 SRI LANKA PHONE RULES
// ==============================
const MOBILE_PREFIXES = new Set([
  '70', '71', '72', '75', '76', '77', '78',
  '12', '13', '14', '15', '16', '17', '18', '19'
]);

const LANDLINE_PREFIXES = new Set([
  '11', '31', '32', '33', '34', '35', '36', '37', '38',
  '41', '45', '47', '51', '52', '54', '55', '57', '63', '65', '66', '67'
]);

// ==============================
// 🎯 BUSINESS LOGIC
// ==============================
const B2B_KEYWORDS = [
  'marketing', 'advertising', 'consulting', 'law', 'legal', 'accounting',
  'software', 'it', 'technology', 'real estate', 'insurance', 'finance',
  'architecture', 'engineering', 'digital', 'agency', 'solutions', 'services'
];

const SEARCH_TERMS = [
  'marketing agency Colombo',
  'IT consulting Colombo',
  'law firm Colombo',
  'software company Colombo',
  'accounting services Colombo',
  'digital marketing Colombo',
  'business consulting Colombo'
];

const DEFAULT_CENTER = { lat: 6.86026115, lng: 79.912990 };

// ==============================
// 🧹 PHONE CLEANING & VALIDATION
// ==============================
function cleanAndClassifyNumber(rawNum) {
  if (!rawNum) return { cleaned: null, isValid: false, reason: 'Empty' };

  try {
    const parsed = parsePhoneNumber(rawNum.toString(), 'LK');
    if (!parsed.isValid()) {
      return { cleaned: null, isValid: false, reason: 'Invalid number format' };
    }

    const national = parsed.nationalNumber; // e.g., '771234567'
    if (national.length !== 9) {
      return { cleaned: national, isValid: false, reason: `Invalid length (${national.length})` };
    }

    const prefix = national.slice(0, 2);
    if (MOBILE_PREFIXES.has(prefix)) {
      return { cleaned: national, isValid: true, reason: 'Valid Mobile' };
    } else if (LANDLINE_PREFIXES.has(prefix)) {
      return { cleaned: national, isValid: false, reason: `Landline (${prefix})` };
    } else {
      return { cleaned: national, isValid: false, reason: `Unknown prefix (${prefix})` };
    }
  } catch (e) {
    return { cleaned: null, isValid: false, reason: `Parsing error: ${e.message}` };
  }
}

function generateWaLink(number) {
  return number ? `https://wa.me/94${number}` : '';
}

// ==============================
// 👤 CONTACT NAME BUILDING
// ==============================
function buildContactName(row) {
  if (row.business_name && !['', 'Unknown'].includes(row.business_name)) {
    return row.business_name.trim();
  }
  const first = (row.first_name || '').toString().trim();
  const last = (row.last_name || '').toString().trim();
  if (first || last) return `${first} ${last}`.trim();
  for (const col of ['company', 'name', 'place_name']) {
    if (row[col] && !['', 'Unknown'].includes(row[col])) {
      return row[col].toString().trim();
    }
  }
  return 'Prospect';
}

// ==============================
// 🕵️ SCRAPE BUSINESSES
// ==============================
async function scrapeBusinesses(location) {
  const allPlaces = [];
  const seenPlaceIds = new Set();
  let searchCalls = 0;

  for (let i = 0; i < Math.min(SEARCH_TERMS.length, MAX_SEARCH_QUERIES); i++) {
    if (allPlaces.length >= MAX_TOTAL_BUSINESSES) break;
    const query = SEARCH_TERMS[i];

    try {
      const res = await axios.get(
        'https://maps.googleapis.com/maps/api/place/textsearch/json',
        {
          params: { query, location: `${location.lat},${location.lng}`, radius: SEARCH_RADIUS, key: GOOGLE_API_KEY },
        }
      );
      searchCalls++;

      const results = res.data.results || [];
      for (const place of results.slice(0, MAX_RESULTS_PER_QUERY)) {
        if (
          place.place_id &&
          !seenPlaceIds.has(place.place_id) &&
          (place.rating || 0) >= MIN_RATING &&
          (place.user_ratings_total || 0) >= MIN_REVIEWS
        ) {
          allPlaces.push(place);
          seenPlaceIds.add(place.place_id);
          if (allPlaces.length >= MAX_TOTAL_BUSINESSES) break;
        }
      }
    } catch (e) {
      console.error(`Search error for "${query}":`, e.message);
    }
  }

  return { places: allPlaces, searchCalls };
}

// ==============================
// 💡 ENRICH & EXTRACT EMAIL (basic)
// ==============================
async function extractEmailFromWebsite(baseUrl) {
  if (!baseUrl) return null;
  const url = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
  const paths = ['', '/contact', '/about', '/contact-us', '/reach-us'];

  for (const path of paths) {
    try {
      const fullUrl = new URL(path, url).href;
      const res = await axios.get(fullUrl, {
        timeout: 5000,
        headers: { 'User-Agent': 'B2BLeadBot/1.0 (ethical scraping)' }
      });

      const emails = [...new Set(res.data.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])];
      for (const email of emails) {
        if (isProfessionalEmail(email)) return email.toLowerCase();
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

function isProfessionalEmail(email) {
  if (!email) return false;
  email = email.toLowerCase();
  if (['noreply', 'example', 'test', 'admin', 'info@'].some(bad => email.includes(bad))) return false;
  const domain = email.split('@')[1];
  const disposable = new Set([
    'mailinator.com', '10minutemail.com', 'guerrillamail.com', 'yopmail.com',
    'tempmail.com', 'throwaway.email', 'fakeinbox.com'
  ]);
  return !disposable.has(domain);
}

// ==============================
// 🚀 MAIN HANDLER
// ==============================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const startTime = Date.now();
  console.log('🚀 Starting WhatsApp Lead Engine');

  try {
    // === 1. Resolve location ===
    let location = DEFAULT_CENTER;
    let locationLabel = 'Colombo (default)';
    const userLocation = req.body.location || LOCATION_NAME;

    if (userLocation) {
      try {
        const geo = await axios.get(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(userLocation)}&key=${GOOGLE_API_KEY}`
        );
        if (geo.data.results?.[0]) {
          const geom = geo.data.results[0].geometry.location;
          location = { lat: geom.lat, lng: geom.lng };
          locationLabel = geo.data.results[0].formatted_address || userLocation;
        }
      } catch (e) {
        console.warn('Geocoding failed, using default');
      }
    }

    // === 2. Scrape businesses ===
    const { places, searchCalls } = await scrapeBusinesses(location);
    if (places.length === 0) {
      return res.status(200).json({ message: 'No qualifying businesses found.', leads: [] });
    }

    // === 3. Enrich with details & email ===
    const enrichedLeads = [];
    let detailsCalls = 0;

    for (const place of places) {
      try {
        const detailRes = await axios.get(
          'https://maps.googleapis.com/maps/api/place/details/json',
          {
            params: {
              place_id: place.place_id,
              fields: 'formatted_phone_number,website,formatted_address,name',
              key: GOOGLE_API_KEY,
            },
          }
        );
        detailsCalls++;
        const details = detailRes.data.result || {};

        const phone = details.formatted_phone_number || '';
        const website = (details.website || '').trim();
        const email = website ? await extractEmailFromWebsite(website) : null;

        enrichedLeads.push({
          business_name: place.name || 'Unknown',
          category: B2B_KEYWORDS.some(kw =>
            `${place.name} ${place.types?.join(' ') || ''}`.toLowerCase().includes(kw)
          ) ? 'B2B' : 'OTHER',
          phone_raw: phone,
          email,
          website,
          address: details.formatted_address || place.vicinity || '',
          rating: place.rating || 0,
          review_count: place.user_ratings_total || 0,
          place_id: place.place_id,
        });
      } catch (e) {
        console.error('Enrichment error:', e.message);
      }
    }

    // === 4. WhatsApp Preparation ===
    const validLeads = [];
    const invalidLeads = [];

    for (const lead of enrichedLeads) {
      const { cleaned, isValid, reason } = cleanAndClassifyNumber(lead.phone_raw);
      const contactName = buildContactName(lead);
      const waLink = generateWaLink(cleaned);

      const outputLead = {
        contact_name: contactName,
        mobile_9digit: cleaned,
        whatsapp_link: waLink,
        business_name: lead.business_name,
        category: lead.category,
        email: lead.email || '',
        website: lead.website || '',
        address: lead.address,
        rating: lead.rating,
        review_count: lead.review_count,
        original_phone: lead.phone_raw,
        rejection_reason: reason,
      };

      if (isValid) {
        validLeads.push(outputLead);
      } else {
        invalidLeads.push(outputLead);
      }
    }

    // Deduplicate by mobile number
    const seen = new Set();
    const dedupedValid = validLeads.filter(lead => {
      if (seen.has(lead.mobile_9digit)) return false;
      seen.add(lead.mobile_9digit);
      return true;
    });

    // Sort
    dedupedValid.sort((a, b) => a.contact_name.localeCompare(b.contact_name));

    const duration = (Date.now() - startTime) / 1000;
    const totalCost = Math.round(((searchCalls * 32 + detailsCalls * 17) / 1000) * 100) / 100;

    // === 5. Return final response ===
    res.status(200).json({
      success: true,
      location: locationLabel,
      duration_seconds: Math.round(duration),
      estimated_cost_usd: totalCost,
      leads: {
        total_input: enrichedLeads.length,
        valid: dedupedValid.length,
        invalid: invalidLeads.length,
        success_rate_percent: enrichedLeads.length ? Math.round((dedupedValid.length / enrichedLeads.length) * 100) : 0,
      },
      whatsapp_ready_leads: dedupedValid,
      invalid_leads: invalidLeads,
    });

  } catch (error) {
    console.error('💥 CRITICAL ERROR:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}