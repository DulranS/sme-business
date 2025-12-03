"""
lean_business_scraper.py

🎯 OPTIMIZED B2B LEAD ENGINE — Maximum ROI per API call
✅ Intelligent caching & deduplication  
✅ Strategic query selection (highest ROI sectors)
✅ Incremental updates (no re-fetching known businesses)
✅ Smart contact enrichment (website-first, then details API)
✅ Budget: <$2/week (~500 calls) | <$8/month for 4 runs
✅ Target: 40-60 HIGH-QUALITY leads per run

OPTIMIZATION STRATEGY:
- Use caching to avoid re-fetching known businesses
- Prioritize high-value B2B sectors with strong buying intent
- Extract emails from websites BEFORE calling details API
- Only enrich businesses with missing critical data
- Rotate search terms weekly for market coverage
"""

import os
import time
import csv
import json
import re
import logging
import requests
from datetime import datetime, timedelta
from collections import deque
from urllib.parse import urljoin
from dotenv import load_dotenv
import googlemaps
import phonenumbers

# ==============================
# 🔐 CONFIGURATION
# ==============================

if os.path.exists(".env"):
    load_dotenv()
elif os.path.exists(os.path.join("scrape-leads", ".env")):
    load_dotenv(os.path.join("scrape-leads", ".env"))

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise EnvironmentError("❌ Missing GOOGLE_API_KEY")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_LEADS_NAME = "b2b_leads.csv"

# 📍 Colombo coordinates
DEFAULT_CENTER = (6.86026115, 79.912990)
LOCATION_LABEL = "Colombo, Sri Lanka"
SEARCH_RADIUS = 8000

# I/O Paths
LEADS_FILE = os.getenv("LEADS_FILE")
if not LEADS_FILE:
    data_dir = os.path.join(SCRIPT_DIR, "data")
    os.makedirs(data_dir, exist_ok=True)
    LEADS_FILE = os.path.join(data_dir, DEFAULT_LEADS_NAME)

LOG_FILE = os.getenv("LOG_FILE", "lead_engine.log")
CACHE_FILE = os.path.join(os.path.dirname(LEADS_FILE), "business_cache.json")
STATE_FILE = os.path.join(os.path.dirname(LEADS_FILE), "scraper_state.json")

# 🔒 OPTIMIZED BUDGET LIMITS (Weekly run: ~500 calls max)
MAX_SEARCH_QUERIES = 5  # 5 queries * ~32 SKU = 160 calls
MAX_RESULTS_PER_QUERY = 20  # More discoveries per query
MAX_DETAILS_CALLS = 40  # Only for high-priority missing data
MAX_NEW_LEADS_PER_RUN = 50  # Focus on quality

# Quality Filters - RAISED for better leads
MIN_RATING = 4.0  # Up from 3.5
MIN_REVIEWS = 10  # Up from 5

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
# 🎯 STRATEGIC SEARCH TERMS (Rotating Weekly)
# ==============================

# High-value sectors with strong B2B buying intent
SEARCH_TERM_POOLS = {
    "week_1": [
        "digital marketing agency Colombo",
        "software development company Colombo",
        "IT consulting services Colombo",
        "web development agency Colombo",
        "mobile app development Colombo"
    ],
    "week_2": [
        "law firm Colombo",
        "corporate legal services Colombo",
        "accounting firm Colombo",
        "financial consulting Colombo",
        "audit services Colombo"
    ],
    "week_3": [
        "business consulting Colombo",
        "management consulting Colombo",
        "HR consulting services Colombo",
        "recruitment agency Colombo",
        "training company Colombo"
    ],
    "week_4": [
        "architecture firm Colombo",
        "engineering consultancy Colombo",
        "real estate development Colombo",
        "interior design company Colombo",
        "construction company Colombo"
    ]
}

B2B_KEYWORDS = [
    "marketing", "advertising", "consulting", "law", "legal", "accounting",
    "software", "it", "technology", "finance", "architecture", "engineering",
    "digital", "agency", "solutions", "services", "development", "design"
]

# ==============================
# 🧠 SMART CACHING & STATE MANAGEMENT
# ==============================

def load_cache():
    """Load previously discovered businesses to avoid re-fetching."""
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_cache(cache):
    """Save business cache."""
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)

def load_state():
    """Load scraper state (week rotation, run history)."""
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_state(state):
    """Save scraper state."""
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, indent=2, ensure_ascii=False)

def get_weekly_search_terms():
    """Rotate search terms weekly for comprehensive market coverage."""
    state = load_state()
    
    # Determine current week cycle (1-4)
    last_week = state.get("last_week_number", 0)
    today = datetime.now()
    
    # Simple rotation: increment each run
    current_week = (last_week % 4) + 1
    
    state["last_week_number"] = current_week
    state["last_run_date"] = today.isoformat()
    save_state(state)
    
    week_key = f"week_{current_week}"
    logger.info(f"📅 Using search pool: {week_key}")
    
    return SEARCH_TERM_POOLS[week_key]

# ==============================
# 🛡️ QUALITY & VALIDATION
# ==============================

def is_professional_email(email):
    """Enhanced email validation."""
    if not email:
        return False
    email = email.lower()
    
    # Reject common non-business emails
    if any(bad in email for bad in ["noreply", "example", "test", "admin", "support@", "info@gmail", "info@yahoo"]):
        return False
    
    domain = email.split("@")[-1]
    disposable_domains = {
        "mailinator.com", "10minutemail.com", "guerrillamail.com", 
        "yopmail.com", "tempmail.com", "throwaway.email", "fakeinbox.com",
        "gmail.com", "yahoo.com", "hotmail.com"  # Personal emails
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

def extract_email_from_website(base_url, max_attempts=3):
    """Optimized email extraction with smart page prioritization."""
    if not base_url:
        return None
    if not base_url.startswith(("http://", "https://")):
        base_url = "https://" + base_url

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    })

    # Prioritized paths (most likely to have business emails)
    paths = ["/contact", "/contact-us", "/about", "/team"]
    
    for path in paths[:max_attempts]:
        try:
            url = urljoin(base_url, path)
            response = session.get(url, timeout=5, allow_redirects=True)
            if response.status_code != 200:
                continue

            emails = re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", response.text)
            for email in emails:
                email = email.lower().strip()
                if is_professional_email(email):
                    return email
        except:
            continue
    return None

def categorize_business(name, types):
    """Categorize business type."""
    text = f"{name} {' '.join(types)}".lower()
    for kw in B2B_KEYWORDS:
        if kw in text:
            return "B2B"
    return "B2C"

def score_lead(rating, reviews, has_phone, has_email, has_website, category):
    """Enhanced lead scoring."""
    score = 0
    tags = []

    # Rating score (max 35)
    if rating >= 4.7: score += 35
    elif rating >= 4.5: score += 30
    elif rating >= 4.3: score += 25
    elif rating >= 4.0: score += 15

    # Reviews score (max 25)
    if reviews >= 150: score += 25
    elif reviews >= 75: score += 20
    elif reviews >= 30: score += 15
    elif reviews >= 10: score += 10

    # Contact info (max 35)
    if has_email: 
        score += 30
        tags.append("Email✓")
    if has_phone: 
        score += 15
        tags.append("Phone✓")
    if has_website and not has_email: 
        score += 5
        tags.append("Website")

    # Category bonus (max 15)
    if category == "B2B":
        score += 15
        tags.append("B2B")

    # Quality tiers
    if score >= 85:
        quality = "🔥 HOT"
    elif score >= 65:
        quality = "⭐ WARM"
    elif score >= 45:
        quality = "💼 POTENTIAL"
    else:
        quality = "❄️ COLD"

    return score, quality, "; ".join(tags)

# ==============================
# ⚙️ RATE LIMITING
# ==============================

class RateLimiter:
    def __init__(self, max_per_minute=30):
        self.calls = deque()
        self.limit = max_per_minute

    def wait_if_needed(self):
        now = time.time()
        while self.calls and now - self.calls[0] > 60:
            self.calls.popleft()
        if len(self.calls) >= self.limit:
            sleep_time = 60 - (now - self.calls[0]) + 1
            time.sleep(sleep_time)
        self.calls.append(time.time())

# ==============================
# 🔍 SMART DISCOVERY & ENRICHMENT
# ==============================

def discover_businesses(location, search_terms, cache):
    """Phase 1: Discover new businesses (cached + fresh)."""
    gmaps = googlemaps.Client(key=GOOGLE_API_KEY)
    rate_limiter = RateLimiter()
    api_calls = 0
    new_discoveries = []
    cached_count = 0

    logger.info(f"🔍 Starting discovery with {len(search_terms)} queries...")

    for i, query in enumerate(search_terms, 1):
        rate_limiter.wait_if_needed()
        
        try:
            logger.info(f"[{i}/{len(search_terms)}] Query: '{query}'")
            results = gmaps.places(
                query=query,
                location=location,
                radius=SEARCH_RADIUS,
                timeout=10
            ).get("results", [])
            api_calls += 1

            for place in results[:MAX_RESULTS_PER_QUERY]:
                pid = place.get("place_id")
                if not pid:
                    continue

                # Check cache first
                if pid in cache:
                    cached_count += 1
                    continue

                rating = place.get("rating", 0)
                reviews = place.get("user_ratings_total", 0)

                # Apply quality filters early
                if rating >= MIN_RATING and reviews >= MIN_REVIEWS:
                    new_discoveries.append(place)
                    
                    # Basic cache entry
                    cache[pid] = {
                        "name": place.get("name"),
                        "rating": rating,
                        "reviews": reviews,
                        "discovered_at": datetime.now().isoformat()
                    }

            logger.info(f"   → Found {len(results)} | New: {len(new_discoveries)} | Cached: {cached_count}")

            if len(new_discoveries) >= MAX_NEW_LEADS_PER_RUN:
                logger.info(f"✅ Reached target of {MAX_NEW_LEADS_PER_RUN} new leads")
                break

        except Exception as e:
            logger.error(f"   ❌ Search error: {e}")

    logger.info(f"📊 Discovery complete: {len(new_discoveries)} new | {cached_count} cached | API calls: {api_calls}")
    return new_discoveries, api_calls, cache

def enrich_leads_smartly(places, cache):
    """Phase 2: Smart enrichment (website-first, then selective details API)."""
    gmaps = googlemaps.Client(key=GOOGLE_API_KEY)
    rate_limiter = RateLimiter()
    leads = []
    api_calls = 0
    details_calls_used = 0

    logger.info(f"📧 Smart enrichment for {len(places)} businesses...")

    for i, place in enumerate(places, 1):
        pid = place["place_id"]
        
        # Try to get website without details API first
        website = place.get("website", "").strip()
        
        # Extract email from website (no API cost!)
        email = None
        if website:
            email = extract_email_from_website(website)
        
        # Only call details API if we need phone OR don't have email yet
        phone = None
        address = place.get("vicinity", "")
        
        if details_calls_used < MAX_DETAILS_CALLS and (not email or not phone):
            rate_limiter.wait_if_needed()
            try:
                details = gmaps.place(
                    place_id=pid,
                    fields=["formatted_phone_number", "website", "formatted_address"],
                    timeout=8
                ).get("result", {})
                api_calls += 1
                details_calls_used += 1

                phone = clean_phone_number(details.get("formatted_phone_number"))
                if not website:
                    website = details.get("website", "").strip()
                    if website and not email:
                        email = extract_email_from_website(website)
                address = details.get("formatted_address", address)

            except Exception as e:
                logger.debug(f"   Details API error for {place.get('name')}: {e}")

        # Must have at least ONE contact method
        if not phone and not email:
            continue

        # Build lead entry
        category = categorize_business(place.get("name", ""), place.get("types", []))
        rating = place.get("rating", 0)
        reviews = place.get("user_ratings_total", 0)
        score, quality, tags = score_lead(
            rating, reviews, bool(phone), bool(email), bool(website), category
        )

        lead = {
            "lead_quality": quality,
            "score": score,
            "business_name": place.get("name", "Unknown"),
            "category": category,
            "tags": tags,
            "phone": phone or "",
            "email": email or "",
            "website": website,
            "address": address,
            "rating": rating,
            "review_count": reviews,
            "place_id": pid,
            "scraped_at": datetime.now().isoformat()
        }

        leads.append(lead)

        # Update cache with enriched data
        cache[pid].update({
            "phone": phone,
            "email": email,
            "website": website,
            "enriched": True
        })

        if (i % 10 == 0):
            logger.info(f"   Progress: {i}/{len(places)} | Details API: {details_calls_used}/{MAX_DETAILS_CALLS}")

    logger.info(f"✅ Enrichment done: {len(leads)} leads | Details API calls: {details_calls_used}")
    
    # Sort by quality score
    leads.sort(key=lambda x: x["score"], reverse=True)
    return leads, api_calls, cache

# ==============================
# 💾 OUTPUT
# ==============================

def save_leads(leads):
    """Save leads with summary."""
    if not leads:
        logger.warning("📭 No leads to save.")
        return

    columns = [
        "lead_quality", "score", "business_name", "category", "tags",
        "phone", "email", "website", "address",
        "rating", "review_count", "scraped_at"
    ]

    output_dir = os.path.dirname(LEADS_FILE)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    with open(LEADS_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        for lead in leads:
            writer.writerow({col: lead.get(col, "") for col in columns})

    # Summary stats
    hot = sum(1 for l in leads if "HOT" in l["lead_quality"])
    warm = sum(1 for l in leads if "WARM" in l["lead_quality"])
    potential = sum(1 for l in leads if "POTENTIAL" in l["lead_quality"])

    with open(LEADS_FILE, "a", encoding="utf-8") as f:
        f.write("\n")
        f.write(f"SUMMARY: HOT={hot}, WARM={warm}, POTENTIAL={potential} | Total={len(leads)}\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    logger.info(f"💾 Saved {len(leads)} leads → {LEADS_FILE}")
    logger.info(f"🎯 Quality breakdown: HOT={hot} | WARM={warm} | POTENTIAL={potential}")

# ==============================
# 💰 COST TRACKING
# ==============================

def estimate_cost(search_calls, details_calls):
    """Calculate Google Maps API cost."""
    search_cost = (search_calls * 32) / 1000
    details_cost = (details_calls * 17) / 1000
    return round(search_cost + details_cost, 2)

# ==============================
# 🚀 MAIN
# ==============================

def main():
    logger.info("🚀 OPTIMIZED B2B LEAD ENGINE — STARTED")
    logger.info("=" * 70)
    
    start_time = time.time()
    
    # Load cache & state
    cache = load_cache()
    logger.info(f"📦 Loaded cache: {len(cache)} known businesses")
    
    # Get weekly search terms
    search_terms = get_weekly_search_terms()
    
    try:
        # Phase 1: Discover
        places, search_calls, cache = discover_businesses(
            DEFAULT_CENTER, 
            search_terms, 
            cache
        )
        
        if not places:
            logger.warning("🔍 No new businesses discovered")
            return
        
        # Phase 2: Enrich
        leads, details_calls, cache = enrich_leads_smartly(places, cache)
        
        if not leads:
            logger.warning("📭 No qualified leads after enrichment")
            return
        
        # Save outputs
        save_leads(leads)
        save_cache(cache)
        
        # Final report
        total_calls = search_calls + details_calls
        cost = estimate_cost(search_calls, details_calls)
        duration = (time.time() - start_time) / 60
        
        logger.info("=" * 70)
        logger.info("✅ RUN COMPLETE")
        logger.info(f"⏱️  Duration: {duration:.1f} minutes")
        logger.info(f"📊 API Calls: {total_calls} (Search: {search_calls}, Details: {details_calls})")
        logger.info(f"💰 Cost: ${cost:.2f} | Monthly (4 runs): ~${cost * 4:.2f}")
        logger.info(f"🎯 Leads Generated: {len(leads)}")
        logger.info(f"📈 Cost per Lead: ${cost/len(leads):.3f}")
        logger.info(f"💾 Output: {LEADS_FILE}")
        
        # Budget warning
        if cost * 4 > 8:
            logger.warning("⚠️  Monthly projection > $8 — consider reducing limits")
        else:
            logger.info(f"✅ Well within free tier budget!")
        
    except Exception as e:
        logger.exception(f"💥 CRITICAL ERROR: {e}")
        raise

if __name__ == "__main__":
    main()