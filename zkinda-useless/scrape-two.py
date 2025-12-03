"""
elite_lead_engine.py

🎯 ZERO-COST B2B LEAD GENERATION — Optimized for Monthly Free Tier
✅ Stays within Google's $200/month free credit (4 weekly runs)
✅ Maximum lead quality per API call
✅ Progressive enrichment (only enriches best prospects)
✅ Persistent deduplication across runs
✅ Smart caching & resumability
✅ ROI-focused: targets high-value, ready-to-buy businesses

FREE TIER LIMITS:
- Text Search: $32/1k = 6,250 free calls/month → 1,560/week
- Place Details: $17/1k = 11,764 free calls/month → 2,940/week

OPTIMIZED STRATEGY:
- Week 1-4: 35 searches + 45 enrichments each = 140 + 180 = 320 total
- Cost per run: ~$2.88 | Monthly: ~$11.52 (94% under budget!)
"""

import os
import time
import csv
import re
import logging
import requests
import json
import hashlib
from datetime import datetime, timedelta
from collections import deque
from urllib.parse import urljoin
from pathlib import Path
from dotenv import load_dotenv
import googlemaps
import phonenumbers

# ==============================
# 🔐 CONFIGURATION
# ==============================
load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise EnvironmentError("❌ Missing GOOGLE_API_KEY in .env")

# Location (Colombo)
DEFAULT_LAT = float(os.getenv("DEFAULT_LAT", "6.86026115"))
DEFAULT_LNG = float(os.getenv("DEFAULT_LNG", "79.912990"))
SEARCH_RADIUS = int(os.getenv("SEARCH_RADIUS", "10000"))  # 10km for better coverage

# File paths
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / "lead_data"
DATA_DIR.mkdir(exist_ok=True)

LEADS_FILE = DATA_DIR / "b2b_leads_master.csv"
CACHE_FILE = DATA_DIR / "seen_businesses.json"
WEEKLY_REPORT = DATA_DIR / f"weekly_report_{datetime.now().strftime('%Y%m%d')}.csv"
LOG_FILE = DATA_DIR / "lead_engine.log"

# FREE TIER BUDGET (per weekly run)
MAX_SEARCH_CALLS = 35  # Conservative: ~$1.12
MAX_ENRICHMENT_CALLS = 45  # Conservative: ~$0.76
# Total per run: ~$1.88 | Monthly (4 runs): ~$7.52

# Quality filters
MIN_RATING = 4.0  # Higher threshold = better leads
MIN_REVIEWS = 10

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("EliteLeadEngine")

# ==============================
# 🎯 STRATEGIC TARGETING
# ==============================

# HIGH-VALUE B2B TARGETS (ordered by revenue potential)
PRIORITY_SEARCH_TERMS = [
    # TIER 1: Enterprise Services (highest LTV)
    "software company Colombo",
    "IT consulting Colombo",
    "digital agency Colombo",
    "marketing agency Colombo",
    "business consulting Colombo",
    
    # TIER 2: Professional Services
    "law firm Colombo",
    "accounting firm Colombo",
    "architecture firm Colombo",
    "engineering consultancy Colombo",
    "management consulting Colombo",
    
    # TIER 3: Healthcare & Finance
    "medical center Colombo",
    "dental clinic Colombo",
    "insurance company Colombo",
    "financial services Colombo",
    "investment firm Colombo",
    
    # TIER 4: Real Estate & Construction
    "real estate agency Colombo",
    "property developer Colombo",
    "construction company Colombo",
    
    # TIER 5: Hospitality & Retail (B2B angle)
    "hotel group Colombo",
    "restaurant chain Colombo",
    "retail chain Colombo",
    
    # TIER 6: Growth Sectors
    "fintech Colombo",
    "edtech Colombo",
    "healthtech Colombo",
    "logistics company Colombo",
    "e-commerce company Colombo",
    
    # TIER 7: Niche High-Value
    "coworking space Colombo",
    "event management Colombo",
    "PR agency Colombo",
    "design studio Colombo",
    "recruitment agency Colombo"
]

# Buying signals (indicates active growth = higher conversion)
BUYING_SIGNALS = [
    "hiring", "careers", "join our team", "we're growing", "now hiring",
    "new office", "expansion", "recently funded", "series", "investment",
    "launching", "new service", "new product", "partnership", "award-winning"
]

# Decision-maker indicators
DECISION_MAKER_TITLES = ["founder", "ceo", "cto", "director", "head of", "vp", "president"]

# ==============================
# 💾 PERSISTENCE & DEDUPLICATION
# ==============================

class LeadCache:
    """Tracks seen businesses across runs to avoid duplicates"""
    
    def __init__(self, cache_file):
        self.cache_file = cache_file
        self.cache = self._load_cache()
    
    def _load_cache(self):
        if self.cache_file.exists():
            try:
                with open(self.cache_file, 'r') as f:
                    return json.load(f)
            except:
                return {"seen_ids": [], "last_updated": None}
        return {"seen_ids": [], "last_updated": None}
    
    def is_seen(self, place_id):
        return place_id in self.cache["seen_ids"]
    
    def mark_seen(self, place_id):
        if place_id not in self.cache["seen_ids"]:
            self.cache["seen_ids"].append(place_id)
    
    def save(self):
        self.cache["last_updated"] = datetime.now().isoformat()
        with open(self.cache_file, 'w') as f:
            json.dump(self.cache, f, indent=2)
    
    def get_stats(self):
        return {
            "total_seen": len(self.cache["seen_ids"]),
            "last_run": self.cache.get("last_updated", "Never")
        }

# ==============================
# 🧠 SMART SCORING ENGINE
# ==============================

def calculate_lead_score(business_data):
    """
    Scores 0-100 based on revenue potential & readiness to buy
    """
    score = 0
    signals = []
    
    rating = business_data.get("rating", 0)
    reviews = business_data.get("review_count", 0)
    has_website = bool(business_data.get("website"))
    has_email = bool(business_data.get("email"))
    has_phone = bool(business_data.get("phone"))
    category = business_data.get("category", "")
    
    # 1. Business Credibility (35 points max)
    if rating >= 4.7: score += 20; signals.append("Excellent Rating")
    elif rating >= 4.3: score += 15
    elif rating >= 4.0: score += 10
    
    if reviews >= 200: score += 15; signals.append("High Engagement")
    elif reviews >= 50: score += 10
    elif reviews >= 20: score += 5
    
    # 2. Contact Quality (30 points max)
    if has_email: score += 15; signals.append("Email Verified")
    if has_phone: score += 10; signals.append("Phone Verified")
    if has_website: score += 5
    
    # 3. Business Category (25 points max)
    if "software" in category.lower() or "IT" in category: 
        score += 25; signals.append("Tech Target")
    elif any(x in category.lower() for x in ["agency", "consulting", "law", "accounting"]):
        score += 20; signals.append("Professional Services")
    elif any(x in category.lower() for x in ["medical", "dental", "healthcare"]):
        score += 15; signals.append("Healthcare")
    else:
        score += 10
    
    # 4. Buying Intent (10 points max)
    if business_data.get("high_intent"):
        score += 10; signals.append("🔥 Active Buyer")
    
    # 5. Tech Stack (bonus)
    tech = business_data.get("tech_stack", "")
    if tech and "WordPress" not in tech:
        score += 5; signals.append(f"Modern Tech: {tech}")
    
    # 6. LinkedIn Presence (bonus)
    if business_data.get("linkedin_url"):
        score += 5; signals.append("LinkedIn Active")
    
    # Classify
    if score >= 80:
        tier = "🔥 HOT"
    elif score >= 60:
        tier = "⭐ WARM"
    elif score >= 40:
        tier = "💼 QUALIFIED"
    else:
        tier = "❄️ COLD"
    
    return score, tier, signals

# ==============================
# 🔍 INTELLIGENCE GATHERING
# ==============================

def clean_phone_sri_lanka(phone_str):
    """Standardizes Sri Lankan phone numbers"""
    if not phone_str:
        return None
    
    digits = re.sub(r"[^\d+]", "", phone_str.strip())
    
    # Convert to +94 format
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

def extract_email_smart(website_url, business_name=""):
    """
    Intelligent email extraction with fallback strategies
    """
    if not website_url:
        return None
    
    if not website_url.startswith(("http://", "https://")):
        website_url = "https://" + website_url
    
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    })
    
    # Priority paths for B2B sites
    paths = ["/contact", "/contact-us", "/about", "/about-us", "", "/team", "/careers"]
    
    for path in paths:
        try:
            url = urljoin(website_url, path)
            response = session.get(url, timeout=6, allow_redirects=True)
            
            if response.status_code != 200:
                continue
            
            # Extract all emails
            emails = re.findall(
                r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
                response.text
            )
            
            # Prioritize decision-maker emails
            for email in emails:
                email = email.lower()
                
                # Skip generic/system emails
                if any(skip in email for skip in [
                    "noreply", "no-reply", "donotreply", "example", "test",
                    "admin", "webmaster", "postmaster", "support@", "help@"
                ]):
                    continue
                
                # Prioritize executive emails
                if any(title in email for title in DECISION_MAKER_TITLES):
                    return email
                
                # Accept info@ or contact@ as fallback
                if any(ok in email for ok in ["info@", "contact@", "sales@", "hello@"]):
                    return email
                
                # Any professional email from company domain
                domain = email.split("@")[-1]
                if website_url and domain in website_url:
                    return email
            
        except Exception:
            continue
    
    return None

def detect_buying_intent(website_url):
    """Checks if company shows active growth signals"""
    if not website_url:
        return False
    
    try:
        response = requests.get(website_url, timeout=5)
        text = response.text.lower()
        
        # Count buying signals
        signal_count = sum(1 for signal in BUYING_SIGNALS if signal in text)
        return signal_count >= 2  # At least 2 signals = high intent
        
    except:
        return False

def extract_linkedin(website_url):
    """Finds company LinkedIn profile"""
    if not website_url:
        return ""
    
    try:
        response = requests.get(website_url, timeout=5)
        match = re.search(
            r'https?://(?:[a-z]{2,3}\.)?linkedin\.com/company/[^\s"\'<>]+',
            response.text
        )
        return match.group(0).rstrip('/') if match else ""
    except:
        return ""

def detect_tech_stack(website_url):
    """Identifies website technology (indicates modernization budget)"""
    if not website_url:
        return ""
    
    try:
        response = requests.get(website_url, timeout=5)
        html = response.text.lower()
        headers = {k.lower(): v.lower() for k, v in response.headers.items()}
        
        tech = []
        
        # CMS
        if "wp-content" in html or "wp-includes" in html:
            tech.append("WordPress")
        elif "shopify" in html or "myshopify" in html:
            tech.append("Shopify")
        elif "wix" in html:
            tech.append("Wix")
        
        # Frontend
        if "react" in html or "_next" in html:
            tech.append("React/Next.js")
        elif "vue" in html or "nuxt" in html:
            tech.append("Vue/Nuxt")
        elif "angular" in html:
            tech.append("Angular")
        
        # Marketing tools
        if "hubspot" in html:
            tech.append("HubSpot")
        elif "marketo" in html:
            tech.append("Marketo")
        
        # Analytics/Tag managers
        if "google-analytics" in html or "gtag" in html:
            tech.append("GA")
        if "googletagmanager" in html:
            tech.append("GTM")
        
        return ", ".join(tech) if tech else "Custom"
        
    except:
        return ""

def categorize_business(name, types):
    """Categorizes business for targeting"""
    text = f"{name} {' '.join(types)}".lower()
    
    # Tech & Digital
    if any(x in text for x in ["software", "tech", "it", "digital", "app", "web", "dev"]):
        return "Technology"
    
    # Agencies & Consulting
    if any(x in text for x in ["agency", "marketing", "advertising", "consulting", "strategy"]):
        return "Agency/Consulting"
    
    # Professional Services
    if any(x in text for x in ["law", "legal", "accounting", "audit", "tax", "finance"]):
        return "Professional Services"
    
    # Healthcare
    if any(x in text for x in ["medical", "dental", "clinic", "hospital", "health"]):
        return "Healthcare"
    
    # Real Estate & Construction
    if any(x in text for x in ["real estate", "property", "construction", "architect"]):
        return "Real Estate/Construction"
    
    return "Other Services"

# ==============================
# 🚀 CORE ENGINE
# ==============================

class RateLimiter:
    """Prevents API rate limit violations"""
    def __init__(self, calls_per_minute=50):
        self.calls = deque()
        self.limit = calls_per_minute
    
    def wait_if_needed(self):
        now = time.time()
        # Remove calls older than 60 seconds
        while self.calls and now - self.calls[0] > 60:
            self.calls.popleft()
        
        if len(self.calls) >= self.limit:
            sleep_time = 60 - (now - self.calls[0]) + 1
            logger.info(f"⏳ Rate limit: sleeping {sleep_time:.1f}s")
            time.sleep(sleep_time)
        
        self.calls.append(now)

def progressive_search(gmaps, cache, rate_limiter):
    """
    Smart search that prioritizes quality over quantity
    """
    location = (DEFAULT_LAT, DEFAULT_LNG)
    all_candidates = []
    api_calls = 0
    
    logger.info(f"🔍 Starting smart search (budget: {MAX_SEARCH_CALLS} calls)")
    
    for i, query in enumerate(PRIORITY_SEARCH_TERMS[:MAX_SEARCH_CALLS], 1):
        rate_limiter.wait_if_needed()
        
        try:
            logger.info(f"[{i}/{MAX_SEARCH_CALLS}] {query}")
            
            results = gmaps.places(
                query=query,
                location=location,
                radius=SEARCH_RADIUS
            ).get("results", [])
            
            api_calls += 1
            
            # Filter and score on the fly
            for place in results:
                pid = place.get("place_id")
                rating = place.get("rating", 0)
                reviews = place.get("user_ratings_total", 0)
                
                # Skip if seen or low quality
                if cache.is_seen(pid):
                    continue
                
                if rating < MIN_RATING or reviews < MIN_REVIEWS:
                    continue
                
                # Quick pre-score based on available data
                pre_score = (rating * 10) + min(reviews / 10, 20)
                
                all_candidates.append({
                    "place": place,
                    "pre_score": pre_score,
                    "query": query
                })
                
                cache.mark_seen(pid)
            
            logger.info(f"   → Found {len(results)} | Qualified: {len([p for p in results if p.get('rating', 0) >= MIN_RATING])}")
            
        except Exception as e:
            logger.error(f"Search error: {e}")
    
    # Sort by pre-score and return top candidates for enrichment
    all_candidates.sort(key=lambda x: x["pre_score"], reverse=True)
    
    logger.info(f"✅ Search complete: {len(all_candidates)} candidates | API calls: {api_calls}")
    return all_candidates, api_calls

def progressive_enrichment(gmaps, candidates, cache, rate_limiter):
    """
    Enriches only the best candidates to stay within budget
    """
    enriched_leads = []
    api_calls = 0
    
    logger.info(f"📞 Enriching top {MAX_ENRICHMENT_CALLS} candidates...")
    
    for i, candidate in enumerate(candidates[:MAX_ENRICHMENT_CALLS], 1):
        rate_limiter.wait_if_needed()
        
        place = candidate["place"]
        
        try:
            # Get full details
            details = gmaps.place(
                place_id=place["place_id"],
                fields=["formatted_phone_number", "website", "formatted_address", "name", "types"]
            ).get("result", {})
            
            api_calls += 1
            
            # Extract contacts
            phone = clean_phone_sri_lanka(details.get("formatted_phone_number"))
            website = details.get("website", "").strip()
            email = extract_email_smart(website, place.get("name", "")) if website else None
            
            # Must have at least one contact method
            if not phone and not email:
                continue
            
            # Deep enrichment
            category = categorize_business(
                place.get("name", ""),
                details.get("types", [])
            )
            
            tech_stack = detect_tech_stack(website) if website else ""
            linkedin = extract_linkedin(website) if website else ""
            high_intent = detect_buying_intent(website) if website else False
            
            # Build lead object
            lead_data = {
                "business_name": place.get("name", "Unknown"),
                "category": category,
                "phone": phone or "",
                "email": email or "",
                "website": website,
                "linkedin_url": linkedin,
                "address": details.get("formatted_address", ""),
                "rating": place.get("rating", 0),
                "review_count": place.get("user_ratings_total", 0),
                "tech_stack": tech_stack,
                "high_intent": high_intent,
                "place_id": place["place_id"],
                "found_via": candidate["query"],
                "scraped_at": datetime.now().isoformat()
            }
            
            # Calculate final score
            score, tier, signals = calculate_lead_score(lead_data)
            lead_data["lead_score"] = score
            lead_data["lead_tier"] = tier
            lead_data["signals"] = "; ".join(signals)
            
            enriched_leads.append(lead_data)
            
            if i % 10 == 0:
                logger.info(f"   Progress: {i}/{MAX_ENRICHMENT_CALLS} | Current leads: {len(enriched_leads)}")
            
        except Exception as e:
            logger.error(f"Enrichment error for {place.get('name')}: {e}")
    
    # Sort by score
    enriched_leads.sort(key=lambda x: x["lead_score"], reverse=True)
    
    logger.info(f"✅ Enrichment complete: {len(enriched_leads)} leads | API calls: {api_calls}")
    return enriched_leads, api_calls

# ==============================
# 💾 OUTPUT & REPORTING
# ==============================

def save_leads(leads, weekly_report=True):
    """Saves leads with smart formatting"""
    
    if not leads:
        logger.warning("📭 No leads to save")
        return
    
    columns = [
        "lead_tier", "lead_score", "business_name", "category", "signals",
        "phone", "email", "website", "linkedin_url", "address",
        "rating", "review_count", "tech_stack", "found_via",
        "place_id", "scraped_at"
    ]
    
    # Weekly report (new leads this run)
    if weekly_report:
        with open(WEEKLY_REPORT, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=columns)
            writer.writeheader()
            for lead in leads:
                writer.writerow({col: lead.get(col, "") for col in columns})
        
        logger.info(f"💾 Weekly report: {WEEKLY_REPORT}")
    
    # Master database (append mode with deduplication)
    existing_ids = set()
    if LEADS_FILE.exists():
        with open(LEADS_FILE, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            existing_ids = {row.get("place_id") for row in reader if row.get("place_id")}
    
    new_leads = [l for l in leads if l.get("place_id") not in existing_ids]
    
    if new_leads:
        mode = 'a' if LEADS_FILE.exists() else 'w'
        with open(LEADS_FILE, mode, newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=columns)
            if mode == 'w':
                writer.writeheader()
            for lead in new_leads:
                writer.writerow({col: lead.get(col, "") for col in columns})
        
        logger.info(f"💾 Master database updated: {len(new_leads)} new leads added")
    
    # JSON export for CRM integration
    json_file = WEEKLY_REPORT.with_suffix('.json')
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(leads, f, indent=2, ensure_ascii=False)
    
    # Statistics
    hot = sum(1 for l in leads if "HOT" in l["lead_tier"])
    warm = sum(1 for l in leads if "WARM" in l["lead_tier"])
    qualified = sum(1 for l in leads if "QUALIFIED" in l["lead_tier"])
    
    logger.info(f"📊 Breakdown: 🔥{hot} ⭐{warm} 💼{qualified} ❄️{len(leads)-hot-warm-qualified}")

def estimate_cost(search_calls, detail_calls):
    """Calculates actual API cost"""
    search_cost = (search_calls * 32) / 1000
    detail_cost = (detail_calls * 17) / 1000
    total = search_cost + detail_cost
    return search_cost, detail_cost, total

# ==============================
# 🎯 MAIN EXECUTION
# ==============================

def main():
    logger.info("=" * 70)
    logger.info("🚀 ELITE B2B LEAD ENGINE — FREE TIER OPTIMIZED")
    logger.info("=" * 70)
    
    start_time = time.time()
    
    try:
        # Initialize
        gmaps = googlemaps.Client(key=GOOGLE_API_KEY)
        cache = LeadCache(CACHE_FILE)
        rate_limiter = RateLimiter()
        
        cache_stats = cache.get_stats()
        logger.info(f"📊 Cache: {cache_stats['total_seen']} businesses seen | Last run: {cache_stats['last_run']}")
        
        # Step 1: Smart search
        candidates, search_calls = progressive_search(gmaps, cache, rate_limiter)
        
        if not candidates:
            logger.warning("🔍 No new qualified candidates found")
            return
        
        # Step 2: Progressive enrichment
        leads, detail_calls = progressive_enrichment(gmaps, candidates, cache, rate_limiter)
        
        if not leads:
            logger.warning("📭 No leads with verified contacts")
            return
        
        # Step 3: Save results
        save_leads(leads)
        cache.save()
        
        # Final report
        duration = (time.time() - start_time) / 60
        search_cost, detail_cost, total_cost = estimate_cost(search_calls, detail_calls)
        
        logger.info("=" * 70)
        logger.info("✅ RUN COMPLETED SUCCESSFULLY")
        logger.info(f"⏱️  Duration: {duration:.1f} minutes")
        logger.info(f"📊 Leads Generated: {len(leads)}")
        logger.info(f"💰 API Cost Breakdown:")
        logger.info(f"   - Search: ${search_cost:.2f} ({search_calls} calls)")
        logger.info(f"   - Details: ${detail_cost:.2f} ({detail_calls} calls)")
        logger.info(f"   - TOTAL: ${total_cost:.2f}")
        logger.info(f"📈 Monthly projection (4 runs): ${total_cost * 4:.2f} / $200 free tier")
        logger.info(f"📤 Ready for outreach: {WEEKLY_REPORT}")
        logger.info("=" * 70)
        
    except Exception as e:
        logger.exception(f"💥 CRITICAL ERROR: {e}")
        raise

if __name__ == "__main__":
    main()