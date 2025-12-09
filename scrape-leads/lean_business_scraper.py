"""
lean_business_scraper.py

🌍 GLOBAL B2B LEAD GENERATION ENGINE — Any Country, Any City
✅ Multi-country support with automatic localization
✅ Intelligent caching & deduplication
✅ Budget-safe (configurable API limits)
✅ High-quality lead filtering
✅ Full audit trail & metrics

SUPPORTED: 195+ countries via Google Maps API
CONFIGURATION: Set via environment variables or config.yaml
"""

import os
import time
import csv
import json
import re
import logging
import requests
import yaml
from datetime import datetime
from collections import deque
from urllib.parse import urljoin
from pathlib import Path
from dotenv import load_dotenv
import googlemaps

# ==============================
# 🔐 CONFIGURATION LOADER
# ==============================

# Load environment variables
if os.path.exists(".env"):
    load_dotenv()
elif os.path.exists(os.path.join("scrape-leads", ".env")):
    load_dotenv(os.path.join("scrape-leads", ".env"))

SCRIPT_DIR = Path(__file__).parent.resolve()

# Try to load country config from YAML (preferred) or fallback to env vars
CONFIG_FILE = SCRIPT_DIR / "country_config.yaml"

def load_country_config():
    """Load country configuration from YAML or environment variables."""
    
    # Default configuration (can be overridden)
    default_config = {
        "country_code": "LK",
        "country_name": "Sri Lanka",
        "city": "Colombo",
        "latitude": 6.86026115,
        "longitude": 79.912990,
        "search_radius": 8000,
        "phone_country_code": "+94",
        "phone_number_length": 9,
        "currency": "USD",
        "language": "en"
    }
    
    # Try loading from YAML first
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                yaml_config = yaml.safe_load(f)
                if yaml_config:
                    default_config.update(yaml_config)
                    return default_config
        except Exception as e:
            logging.warning(f"Could not load {CONFIG_FILE}: {e}")
    
    # Fallback to environment variables
    env_config = {
        "country_code": os.getenv("COUNTRY_CODE", default_config["country_code"]),
        "country_name": os.getenv("COUNTRY_NAME", default_config["country_name"]),
        "city": os.getenv("CITY", default_config["city"]),
        "latitude": float(os.getenv("LATITUDE", default_config["latitude"])),
        "longitude": float(os.getenv("LONGITUDE", default_config["longitude"])),
        "search_radius": int(os.getenv("SEARCH_RADIUS", default_config["search_radius"])),
        "phone_country_code": os.getenv("PHONE_COUNTRY_CODE", default_config["phone_country_code"]),
        "phone_number_length": int(os.getenv("PHONE_NUMBER_LENGTH", default_config["phone_number_length"])),
        "currency": os.getenv("CURRENCY", default_config["currency"]),
        "language": os.getenv("LANGUAGE", default_config["language"])
    }
    
    return env_config

# Load configuration
CONFIG = load_country_config()

# API Key
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise EnvironmentError("❌ Missing GOOGLE_API_KEY")

# Location settings from config
LOCATION = (CONFIG["latitude"], CONFIG["longitude"])
LOCATION_LABEL = f"{CONFIG['city']}, {CONFIG['country_name']}"
SEARCH_RADIUS = CONFIG["search_radius"]

# I/O Paths
DATA_DIR = SCRIPT_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

LEADS_FILE = Path(os.getenv("LEADS_FILE", DATA_DIR / "b2b_leads.csv"))
LOG_FILE = os.getenv("LOG_FILE", "lead_engine.log")
CACHE_FILE = DATA_DIR / "business_cache.json"
STATE_FILE = DATA_DIR / "scraper_state.json"

# Budget & Safety Guardrails
MAX_SEARCH_QUERIES = int(os.getenv("MAX_SEARCH_QUERIES", "5"))
MAX_RESULTS_PER_QUERY = int(os.getenv("MAX_RESULTS_PER_QUERY", "20"))
MAX_DETAILS_CALLS = int(os.getenv("MAX_DETAILS_CALLS", "40"))
MAX_NEW_LEADS_PER_RUN = int(os.getenv("MAX_NEW_LEADS_PER_RUN", "50"))

# Quality Filters
MIN_RATING = float(os.getenv("MIN_RATING", "4.0"))
MIN_REVIEWS = int(os.getenv("MIN_REVIEWS", "10"))

# Logging
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
# 🌍 GLOBAL SEARCH TERMS DATABASE
# ==============================

# Universal B2B search terms (works in most countries)
UNIVERSAL_B2B_TERMS = [
    "marketing agency",
    "digital marketing",
    "software company",
    "IT consulting",
    "web development",
    "business consulting",
    "law firm",
    "accounting firm",
    "architecture firm",
    "engineering consulting",
    "advertising agency",
    "design agency"
]

def generate_localized_search_terms(city, country=None, language="en"):
    """
    Generate search terms optimized for the target location.
    Automatically localizes terms based on language.
    """
    
    # Language-specific business terms
    translations = {
        "en": UNIVERSAL_B2B_TERMS,
        "es": [  # Spanish
            "agencia de marketing", "empresa de software", "consultoría IT",
            "desarrollo web", "consultoría empresarial", "bufete de abogados",
            "firma de contabilidad", "estudio de arquitectura"
        ],
        "fr": [  # French
            "agence de marketing", "entreprise de logiciels", "conseil IT",
            "développement web", "conseil en entreprise", "cabinet d'avocats",
            "cabinet comptable", "cabinet d'architecture"
        ],
        "de": [  # German
            "Marketingagentur", "Softwareunternehmen", "IT-Beratung",
            "Webentwicklung", "Unternehmensberatung", "Anwaltskanzlei",
            "Wirtschaftsprüfung", "Architekturbüro"
        ],
        "pt": [  # Portuguese
            "agência de marketing", "empresa de software", "consultoria de TI",
            "desenvolvimento web", "consultoria empresarial", "escritório de advocacia"
        ],
        "zh": [  # Chinese
            "营销公司", "软件公司", "IT咨询", "网络开发", "商业咨询", "律师事务所"
        ],
        "ja": [  # Japanese
            "マーケティング会社", "ソフトウェア会社", "ITコンサルティング", "ウェブ開発"
        ],
        "ar": [  # Arabic
            "وكالة تسويق", "شركة برمجيات", "استشارات تقنية", "تطوير ويب"
        ]
    }
    
    # Get base terms in target language
    base_terms = translations.get(language, translations["en"])
    
    # Localize with city name
    localized_terms = [f"{term} {city}" for term in base_terms[:12]]
    
    # Add nearby/area variations for better coverage
    localized_terms.extend([
        f"{base_terms[0]} near {city}",
        f"best {base_terms[0]} {city}",
        f"top {base_terms[1]} {city}"
    ])
    
    return localized_terms

# Generate search terms for current location
SEARCH_TERMS = generate_localized_search_terms(
    CONFIG["city"],
    CONFIG["country_name"],
    CONFIG["language"]
)

# Weekly rotation pools
SEARCH_TERM_POOLS = {
    "week_1": SEARCH_TERMS[:5],
    "week_2": SEARCH_TERMS[5:10],
    "week_3": SEARCH_TERMS[10:15] if len(SEARCH_TERMS) > 10 else SEARCH_TERMS[:5],
    "week_4": SEARCH_TERMS[3:8]
}

B2B_KEYWORDS = [
    "marketing", "advertising", "consulting", "law", "legal", "accounting",
    "software", "it", "technology", "finance", "architecture", "engineering",
    "digital", "agency", "solutions", "services", "development", "design",
    # Multi-language keywords
    "agencia", "empresa", "consultoría", "bufete", "firma",  # Spanish
    "agence", "entreprise", "cabinet", "société",  # French
    "agentur", "unternehmen", "beratung", "kanzlei",  # German
]

# ==============================
# 🛠️ GOOGLE MAPS CLIENT FACTORY (COMPATIBLE WITH ALL VERSIONS)
# ==============================

def create_gmaps_client(api_key, timeout=10):
    """Create a Google Maps client with timeout and retry settings (fully compatible)."""
    return googlemaps.Client(
        key=api_key,
        timeout=timeout,
        retry_timeout=timeout + 5
    )

# ==============================
# 🧠 SMART CACHING & STATE
# ==============================

def load_cache():
    """Load previously discovered businesses."""
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load cache: {e}")
            return {}
    return {}

def save_cache(cache):
    """Save business cache."""
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)

def load_state():
    """Load scraper state."""
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load state: {e}")
            return {}
    return {}

def save_state(state):
    """Save scraper state."""
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, indent=2, ensure_ascii=False)

def get_weekly_search_terms():
    """Rotate search terms weekly."""
    state = load_state()
    last_week = state.get("last_week_number", 0)
    current_week = (last_week % 4) + 1

    state["last_week_number"] = current_week
    state["last_run_date"] = datetime.now().isoformat()
    save_state(state)

    week_key = f"week_{current_week}"
    logger.info(f"📅 Using search pool: {week_key}")

    return SEARCH_TERM_POOLS[week_key]

# ==============================
# 🛡️ QUALITY & VALIDATION
# ==============================

def is_professional_email(email):
    """Validate professional email addresses."""
    if not email:
        return False
    email = email.lower()

    # Reject non-business patterns
    if any(bad in email for bad in ["noreply", "example", "test", "admin", "support@"]):
        return False

    domain = email.split("@")[-1]

    # Common disposable/personal email domains
    personal_domains = {
        "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
        "mailinator.com", "10minutemail.com", "guerrillamail.com",
        "yopmail.com", "tempmail.com", "throwaway.email"
    }

    return domain not in personal_domains

def extract_email_from_website(base_url, max_attempts=3):
    """Smart email extraction from websites."""
    if not base_url:
        return None
    if not base_url.startswith(("http://", "https://")):
        base_url = "https://" + base_url

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": f"{CONFIG['language']},en;q=0.9"
    })

    # Prioritized paths (most likely to have emails)
    paths = ["/contact", "/contact-us", "/about", "/team", "/contacto", "/kontakt"]

    for path in paths[:max_attempts]:
        try:
            url = urljoin(base_url, path)
            response = session.get(url, timeout=5, allow_redirects=True)
            if response.status_code != 200:
                continue

            emails = re.findall(
                r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
                response.text
            )

            for email in emails:
                email = email.lower().strip()
                if is_professional_email(email):
                    return email
        except Exception:
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
    """Score lead quality (0-100)."""
    score = 0
    tags = []

    # Rating (max 35)
    if rating >= 4.7:
        score += 35
    elif rating >= 4.5:
        score += 30
    elif rating >= 4.3:
        score += 25
    elif rating >= 4.0:
        score += 15

    # Reviews (max 25)
    if reviews >= 150:
        score += 25
    elif reviews >= 75:
        score += 20
    elif reviews >= 30:
        score += 15
    elif reviews >= 10:
        score += 10

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

    # Category (max 15)
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
# 🔍 DISCOVERY & ENRICHMENT
# ==============================

def discover_businesses(location, search_terms, cache):
    """Discover new businesses with caching."""
    gmaps = create_gmaps_client(GOOGLE_API_KEY, timeout=10)
    rate_limiter = RateLimiter()
    api_calls = 0
    new_discoveries = []
    cached_count = 0

    logger.info(f"🔍 Starting discovery in {LOCATION_LABEL}...")
    logger.info(f"📍 Coordinates: {location[0]:.4f}, {location[1]:.4f}")
    logger.info(f"🔎 Using {len(search_terms)} search queries")

    for i, query in enumerate(search_terms, 1):
        if len(new_discoveries) >= MAX_NEW_LEADS_PER_RUN:
            logger.info(f"✅ Reached target of {MAX_NEW_LEADS_PER_RUN} new leads")
            break

        rate_limiter.wait_if_needed()

        try:
            logger.info(f"[{i}/{len(search_terms)}] Query: '{query}'")
            results = gmaps.places(
                query=query,
                location=location,
                radius=SEARCH_RADIUS,
                language=CONFIG["language"]
            ).get("results", [])
            api_calls += 1

            for place in results[:MAX_RESULTS_PER_QUERY]:
                pid = place.get("place_id")
                if not pid:
                    continue

                if pid in cache:
                    cached_count += 1
                    continue

                rating = place.get("rating", 0)
                reviews = place.get("user_ratings_total", 0)

                if rating >= MIN_RATING and reviews >= MIN_REVIEWS:
                    new_discoveries.append(place)
                    cache[pid] = {
                        "name": place.get("name"),
                        "rating": rating,
                        "reviews": reviews,
                        "discovered_at": datetime.now().isoformat()
                    }

            logger.info(f"   → Found {len(results)} | New: {len(new_discoveries)} | Cached: {cached_count}")

        except Exception as e:
            logger.error(f"   ❌ Search error: {e}")

    logger.info(f"📊 Discovery complete: {len(new_discoveries)} new | API calls: {api_calls}")
    return new_discoveries, api_calls, cache

def enrich_leads_smartly(places, cache):
    """Smart enrichment (website-first, then selective details API)."""
    gmaps = create_gmaps_client(GOOGLE_API_KEY, timeout=8)
    rate_limiter = RateLimiter()
    leads = []
    api_calls = 0
    details_calls_used = 0

    logger.info(f"📧 Smart enrichment for {len(places)} businesses...")

    for i, place in enumerate(places, 1):
        pid = place["place_id"]

        website = place.get("website", "").strip()
        email = None

        if website:
            email = extract_email_from_website(website)

        phone = None
        address = place.get("vicinity", "")

        if details_calls_used < MAX_DETAILS_CALLS and (not email or not phone):
            rate_limiter.wait_if_needed()
            try:
                details = gmaps.place(
                    place_id=pid,
                    fields=["formatted_phone_number", "website", "formatted_address"],
                    language=CONFIG["language"]
                ).get("result", {})
                api_calls += 1
                details_calls_used += 1

                phone = details.get("formatted_phone_number")
                if not website:
                    website = details.get("website", "").strip()
                    if website and not email:
                        email = extract_email_from_website(website)
                address = details.get("formatted_address", address)

            except Exception as e:
                logger.debug(f"   Details API error: {e}")

        if not phone and not email:
            continue

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
            "country": CONFIG["country_name"],
            "city": CONFIG["city"],
            "scraped_at": datetime.now().isoformat()
        }

        leads.append(lead)

        cache[pid].update({
            "phone": phone,
            "email": email,
            "website": website,
            "enriched": True
        })

        if (i % 10 == 0):
            logger.info(f"   Progress: {i}/{len(places)} | Details calls: {details_calls_used}/{MAX_DETAILS_CALLS}")

    logger.info(f"✅ Enrichment done: {len(leads)} leads | Details calls: {details_calls_used}")

    leads.sort(key=lambda x: x["score"], reverse=True)
    return leads, api_calls, cache

# ==============================
# 💾 OUTPUT
# ==============================

def save_leads(leads):
    """Save leads to CSV."""
    if not leads:
        logger.warning("📭 No leads to save.")
        return

    columns = [
        "lead_quality", "score", "business_name", "category", "tags",
        "phone", "email", "website", "address",
        "rating", "review_count", "country", "city", "scraped_at"
    ]

    output_dir = LEADS_FILE.parent
    output_dir.mkdir(parents=True, exist_ok=True)

    with open(LEADS_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        for lead in leads:
            writer.writerow({col: lead.get(col, "") for col in columns})

    hot = sum(1 for l in leads if "HOT" in l["lead_quality"])
    warm = sum(1 for l in leads if "WARM" in l["lead_quality"])
    potential = sum(1 for l in leads if "POTENTIAL" in l["lead_quality"])

    with open(LEADS_FILE, "a", encoding="utf-8") as f:
        f.write("\n")
        f.write(f"SUMMARY: HOT={hot}, WARM={warm}, POTENTIAL={potential} | Total={len(leads)}\n")
        f.write(f"Location: {LOCATION_LABEL}\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    logger.info(f"💾 Saved {len(leads)} leads → {LEADS_FILE}")
    logger.info(f"🎯 Quality: HOT={hot} | WARM={warm} | POTENTIAL={potential}")

# ==============================
# 💰 COST ESTIMATION
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
    logger.info("🚀 GLOBAL B2B LEAD ENGINE — STARTED")
    logger.info("=" * 70)
    logger.info(f"🌍 Target Location: {LOCATION_LABEL}")
    logger.info(f"🗣️  Language: {CONFIG['language'].upper()}")
    logger.info(f"📞 Phone Format: {CONFIG['phone_country_code']}XXXXXXXXX")
    logger.info("=" * 70)

    start_time = time.time()

    cache = load_cache()
    logger.info(f"📦 Loaded cache: {len(cache)} known businesses")

    search_terms = get_weekly_search_terms()

    try:
        # Phase 1: Discover
        places, search_calls, cache = discover_businesses(LOCATION, search_terms, cache)

        if not places:
            logger.warning("🔍 No new businesses discovered")
            return

        # Phase 2: Enrich
        leads, details_calls, cache = enrich_leads_smartly(places, cache)

        if not leads:
            logger.warning("📭 No qualified leads after enrichment")
            return

        # Save
        save_leads(leads)
        save_cache(cache)

        # Report
        total_calls = search_calls + details_calls
        cost = estimate_cost(search_calls, details_calls)
        duration = (time.time() - start_time) / 60

        logger.info("=" * 70)
        logger.info("✅ RUN COMPLETE")
        logger.info(f"⏱️  Duration: {duration:.1f} minutes")
        logger.info(f"📊 API Calls: {total_calls} (Search: {search_calls}, Details: {details_calls})")
        logger.info(f"💰 Cost: ${cost:.2f} | Monthly (4x): ~${cost * 4:.2f}")
        logger.info(f"🎯 Leads: {len(leads)} | Cost/Lead: ${cost/len(leads):.3f}")
        logger.info(f"💾 Output: {LEADS_FILE}")

        if cost * 4 > 8:
            logger.warning("⚠️  Monthly projection > $8")
        else:
            logger.info("✅ Within budget!")

    except Exception as e:
        logger.exception(f"💥 CRITICAL ERROR: {e}")
        raise

if __name__ == "__main__":
    main()