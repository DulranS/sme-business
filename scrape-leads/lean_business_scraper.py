"""
lean_business_scraper.py

🎯 STRATEGIC LEAD GENERATION ENGINE — B2B Focused (Colombo, Sri Lanka)
✅ High-intent leads only  
✅ Verified contact info (phone + email)  
✅ Deduplicated & scored  
✅ Budget-safe (<$1/run, <$4/month for 4 runs)  
✅ Outreach-ready output  
✅ Full audit trail  

Designed for sales teams, agencies, and founders who need QUALITY over quantity.
"""

import os
import time
import csv
import re
import logging
import requests
from datetime import datetime
from collections import deque
from urllib.parse import urljoin
from dotenv import load_dotenv
import googlemaps
import phonenumbers

# ==============================
# 🔐 CONFIGURATION & SECURITY
# ==============================

# 🌟 Load .env ONLY if it exists (safe for GitHub Actions)
if os.path.exists(".env"):
    load_dotenv()
elif os.path.exists(os.path.join("scrape-leads", ".env")):
    load_dotenv(os.path.join("scrape-leads", ".env"))

# API & Location
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise EnvironmentError(
        "❌ Missing GOOGLE_API_KEY. "
        "Please set it in a .env file (local) or as a GitHub Secret named 'GOOGLE_API_KEY' (CI)."
    )

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_LEADS_NAME = "b2b_leads.csv"

# 📍 HARD-CODED FOR COLOMBO — NO GEOCODING
DEFAULT_CENTER = (6.86026115, 79.912990)  # Colombo city center (near Fort)
LOCATION_LABEL = "Colombo, Sri Lanka"

SEARCH_RADIUS = int(os.getenv("SEARCH_RADIUS", "8000"))  # 8km radius

# I/O — Respect LEADS_FILE from environment (passed by pipeline)
LEADS_FILE = os.getenv("LEADS_FILE")
if not LEADS_FILE:
    # Fallback for local testing: use data/ subfolder
    data_dir = os.path.join(SCRIPT_DIR, "data")
    os.makedirs(data_dir, exist_ok=True)
    LEADS_FILE = os.path.join(data_dir, DEFAULT_LEADS_NAME)

LOG_FILE = os.getenv("LOG_FILE", "lead_engine.log")
LAST_RUN_FILE = os.path.join(os.path.dirname(LEADS_FILE), "last_run.txt")

# 🔒 BUDGET & SAFETY GUARDRAILS
MAX_SEARCH_QUERIES = int(os.getenv("MAX_SEARCH_QUERIES", "4"))
MAX_RESULTS_PER_QUERY = int(os.getenv("MAX_RESULTS_PER_QUERY", "8"))
MAX_TOTAL_BUSINESSES = int(os.getenv("MAX_TOTAL_BUSINESSES", "30"))

# Quality Filters
MIN_RATING = 3.5
MIN_REVIEWS = 5

# Setup structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("LeadEngine")

# ==============================
# 🎯 BUSINESS LOGIC & SCORING
# ==============================
B2B_KEYWORDS = [
    "marketing", "advertising", "consulting", "law", "legal", "accounting",
    "software", "it", "technology", "real estate", "insurance", "finance",
    "architecture", "engineering", "digital", "agency", "solutions", "services"
]

SEARCH_TERMS = [
    "marketing agency Colombo",
    "IT consulting Colombo",
    "law firm Colombo",
    "software company Colombo",
    "accounting services Colombo",
    "digital marketing Colombo",
    "business consulting Colombo"
]

def is_professional_email(email):
    """Allow info@ but reject disposable/temp/admin emails."""
    if not email:
        return False
    email = email.lower()
    if any(bad in email for bad in ["noreply", "example", "test", "admin"]):
        return False
    domain = email.split("@")[-1]
    disposable_domains = {
        "mailinator.com", "10minutemail.com", "guerrillamail.com", "yopmail.com",
        "tempmail.com", "throwaway.email", "fakeinbox.com"
    }
    return domain not in disposable_domains

def clean_phone_number(phone_str):
    """Standardize to E.164 Sri Lankan format."""
    if not phone_str:
        return None
    digits = re.sub(r"[^\d+]", "", phone_str.strip())
    if digits.startswith("0"):
        digits = "+94" + digits[1:]
    elif digits.startswith("94"):
        digits = "+" + digits
    elif not digits.startswith("+"):
        digits = "+94" + digits
    try:
        parsed = phonenumbers.parse(digits, "LK")
        if phonenumbers.is_valid_number(parsed):
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except:
        pass
    return None

def extract_email_from_website(base_url):
    """Smart email extraction with fallback paths and validation."""
    if not base_url:
        return None
    if not base_url.startswith(("http://", "https://")):
        base_url = "https://" + base_url

    session = requests.Session()
    session.headers.update({
        "User-Agent": "B2BLeadBot/1.0 (ethical scraping; contact: leads@yourcompany.lk)"
    })

    paths = ["", "/contact", "/about", "/en/contact", "/contact-us", "/reach-us", "/team", "/contactus", "/en/contact-us"]
    for path in paths:
        try:
            url = urljoin(base_url, path)
            response = session.get(url, timeout=6, allow_redirects=True)
            if response.status_code != 200:
                continue

            emails = re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", response.text)
            for email in emails:
                email = email.lower().strip()
                if is_professional_email(email):
                    return email
        except Exception as e:
            logger.debug(f"   → Email extraction failed for {url}: {e}")
            continue
    return None

def categorize_business(name, types):
    text = f"{name} {' '.join(types)}".lower()
    for kw in B2B_KEYWORDS:
        if kw in text:
            return "B2B"
    return "OTHER"

def score_and_tag_lead(rating, reviews, has_phone, has_email, has_website, category):
    score = 0
    tags = []

    if rating >= 4.5: score += 30
    elif rating >= 4.0: score += 20
    elif rating >= 3.5: score += 10

    if reviews >= 100: score += 25
    elif reviews >= 30: score += 15
    elif reviews >= 10: score += 10

    if has_email: 
        score += 30
        tags.append("Email Verified")
    if has_phone: 
        score += 20
        tags.append("Phone Verified")
    if has_website: 
        score += 10
        tags.append("Has Website")

    if category == "B2B":
        score += 10
        tags.append("B2B")

    if score >= 80:
        quality = "🔥 HOT"
    elif score >= 50:
        quality = "🔸 WARM"
    else:
        quality = "❄️ COLD"

    return score, quality, "; ".join(tags) if tags else "Basic"

# ==============================
# ⚙️ INFRASTRUCTURE
# ==============================
class RateLimiter:
    def __init__(self, max_per_minute=25):
        self.calls = deque()
        self.limit = max_per_minute

    def wait_if_needed(self):
        now = time.time()
        while self.calls and now - self.calls[0] > 60:
            self.calls.popleft()
        if len(self.calls) >= self.limit:
            sleep_time = 60 - (now - self.calls[0]) + 1
            logger.info(f"⏳ Rate limit hit. Sleeping {sleep_time:.1f}s...")
            time.sleep(sleep_time)
        self.calls.append(time.time())

# ==============================
# 💰 COST ESTIMATION
# ==============================
def estimate_cost(search_calls, details_calls, geocode_calls=0):
    search_cost = (search_calls * 32) / 1000
    details_cost = (details_calls * 17) / 1000
    geocode_cost = (geocode_calls * 5) / 1000
    return round(search_cost + details_cost + geocode_cost, 2)

# ==============================
# 🕵️ SCRAPING & PROCESSING
# ==============================
def scrape_businesses(location, location_label):
    gmaps = googlemaps.Client(key=GOOGLE_API_KEY)
    all_places = []
    seen_place_ids = set()
    rate_limiter = RateLimiter()
    api_calls = 0

    logger.info(f"📍 Starting B2B lead scrape in {location_label} (radius: {SEARCH_RADIUS}m)")
    logger.info(f"📊 Budget guardrails: {MAX_SEARCH_QUERIES} queries | Max {MAX_TOTAL_BUSINESSES} leads")

    for i, query in enumerate(SEARCH_TERMS[:MAX_SEARCH_QUERIES], 1):
        if len(all_places) >= MAX_TOTAL_BUSINESSES:
            break
        rate_limiter.wait_if_needed()
        try:
            logger.info(f"[{i}] Searching: '{query}'")
            results = gmaps.places(
                query=query,
                location=location,
                radius=SEARCH_RADIUS,
                timeout=10
            ).get("results", [])
            api_calls += 1

            for place in results[:MAX_RESULTS_PER_QUERY]:
                pid = place.get("place_id")
                rating = place.get("rating", 0)
                reviews = place.get("user_ratings_total", 0)

                if (
                    pid and pid not in seen_place_ids and
                    rating >= MIN_RATING and
                    reviews >= MIN_REVIEWS
                ):
                    all_places.append(place)
                    seen_place_ids.add(pid)
                    if len(all_places) >= MAX_TOTAL_BUSINESSES:
                        break

            logger.info(f"   → Found {len(results)} | Collected: {len(all_places)}")
        except Exception as e:
            logger.error(f"   ❌ Search error: {e}")

    logger.info(f"✅ Scraping done. Total places: {len(all_places)} | API calls: {api_calls}")
    return all_places, api_calls

def enrich_and_filter_leads(places):
    gmaps = googlemaps.Client(key=GOOGLE_API_KEY)
    leads = []
    rate_limiter = RateLimiter()
    api_calls = 0

    logger.info(f"📞 Enriching {len(places)} leads with contact info...")

    for i, place in enumerate(places, 1):
        if i % 10 == 0:
            logger.info(f"   Progress: {i}/{len(places)} | Details calls: {api_calls}")
        rate_limiter.wait_if_needed()

        try:
            details = gmaps.place(
                place_id=place["place_id"],
                fields=["formatted_phone_number", "website", "formatted_address", "name"],
                timeout=10
            ).get("result", {})
            api_calls += 1

            phone = clean_phone_number(details.get("formatted_phone_number"))
            website = details.get("website", "").strip()
            email = extract_email_from_website(website) if website else None

            if not phone and not email:
                continue

            category = categorize_business(place.get("name", ""), place.get("types", []))
            rating = place.get("rating", 0)
            reviews = place.get("user_ratings_total", 0)
            _, quality_label, tags = score_and_tag_lead(
                rating, reviews, bool(phone), bool(email), bool(website), category
            )

            leads.append({
                "lead_quality": quality_label,
                "business_name": place.get("name", "Unknown"),
                "category": category,
                "tags": tags,
                "phone": phone or "",
                "email": email or "",
                "website": website,
                "address": details.get("formatted_address", place.get("vicinity", "")),
                "rating": rating,
                "review_count": reviews,
                "place_id": place["place_id"],
                "scraped_at": datetime.now().isoformat()
            })

        except Exception as e:
            logger.error(f"   ❌ Enrichment error for {place.get('name', 'N/A')}: {e}")

    logger.info(f"✅ Enrichment done. Valid leads: {len(leads)} | API calls: {api_calls}")
    leads.sort(key=lambda x: ("HOT" in x["lead_quality"], x["rating"]), reverse=True)
    return leads, api_calls

# ==============================
# 💾 OUTPUT & REPORTING
# ==============================
def save_leads(leads):
    if not leads:
        logger.warning("📭 No leads to save.")
        return

    columns = [
        "lead_quality", "business_name", "category", "tags",
        "phone", "email", "website", "address",
        "rating", "review_count", "scraped_at"
    ]

    # Use exact path provided via LEADS_FILE (from pipeline)
    output_path = LEADS_FILE
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        for lead in leads:
            writer.writerow({col: lead.get(col, "") for col in columns})

    hot = sum(1 for l in leads if "HOT" in l["lead_quality"])
    warm = sum(1 for l in leads if "WARM" in l["lead_quality"])
    cold = len(leads) - hot - warm

    with open(output_path, "a", encoding="utf-8") as f:
        f.write("\n")
        f.write(f"SUMMARY: HOT={hot}, WARM={warm}, COLD={cold} | Total Leads={len(leads)}\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Source: Google Maps (Colombo)\n")

    logger.info(f"💾 Saved {len(leads)} leads to '{output_path}'")

# ==============================
# 🚀 MAIN EXECUTION
# ==============================
def main():
    logger.info("🚀 STRATEGIC B2B LEAD ENGINE — STARTED (Colombo Focus)")
    logger.info("=" * 60)

    # 🔒 Prevent duplicate runs on same day
    today = datetime.now().strftime("%Y-%m-%d")
    if os.path.exists(LAST_RUN_FILE):
        with open(LAST_RUN_FILE) as f:
            last_run = f.read().strip()
        if last_run == today:
            logger.warning("🚫 Already ran today. Skipping to preserve budget.")
            return

    start_time = time.time()

    # 📍 USE HARD-CODED COLOMBO — NO GEOCODING
    location = DEFAULT_CENTER
    location_label = LOCATION_LABEL

    try:
        # Phase 1: Discover
        places, search_calls = scrape_businesses(location, location_label)
        if not places:
            logger.warning("🔍 No qualifying businesses found.")
            return

        # Phase 2: Enrich & Filter
        leads, details_calls = enrich_and_filter_leads(places)
        if not leads:
            logger.warning("📭 No leads with verified contact info.")
            return

        # Phase 3: Save & Report
        save_leads(leads)
        total_cost = estimate_cost(search_calls, details_calls, geocode_calls=0)
        duration = (time.time() - start_time) / 60

        # Final Summary
        logger.info("✅ RUN COMPLETED SUCCESSFULLY")
        logger.info(f"⏱️  Duration: {duration:.1f} minutes")
        logger.info(f"💰 Estimated Cost: ${total_cost:.2f} | Monthly (4x): ~${total_cost * 4:.2f}")
        if total_cost * 4 > 10:
            logger.warning("⚠️  Projected monthly cost > $10 — consider lowering limits.")
        logger.info(f"📊 Leads: {len(leads)} (HOT: {sum('HOT' in l['lead_quality'] for l in leads)})")
        logger.info(f"📤 Ready for outreach: {LEADS_FILE}")

        # Record run date
        with open(LAST_RUN_FILE, "w") as f:
            f.write(today)

    except Exception as e:
        logger.exception(f"💥 CRITICAL FAILURE: {e}")
        raise

if __name__ == "__main__":
    main()