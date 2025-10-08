"""
lean_business_scraper.py

LEAN VERSION - Google Maps Scraper Only
- LIMITED REQUESTS to stay within 200 free credits/month
- Focused on quality businesses
- Extracts phone, email, website
- Categorizes + simple lead scoring
- Saves to CSV
- With respectful rate limiting
"""

import os
import time
import csv
import re
import requests
from datetime import datetime
from collections import deque
from dotenv import load_dotenv
import googlemaps
import phonenumbers

# ============ ENV & CONFIG ============
load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
DEFAULT_LAT = float(os.getenv("DEFAULT_LAT", "6.86026115"))  # Colombo
DEFAULT_LNG = float(os.getenv("DEFAULT_LNG", "79.912990"))
SEARCH_RADIUS = int(os.getenv("SEARCH_RADIUS", "8000"))

LEADS_FILE = os.getenv("LEADS_FILE", "business_leads.csv")

# ============ BUDGET LIMITS ============
# Google Places API costs:
# - Text Search: $32 per 1000 requests
# - Place Details: $17 per 1000 requests (Basic Data)
# With $200 credit, you get ~6250 Text Searches OR ~11,764 Details requests
# Conservative limit: 50 searches + 50 details = ~$2.50 per run
MAX_SEARCH_QUERIES = int(os.getenv("MAX_SEARCH_QUERIES", "5"))  # Limit search queries
MAX_RESULTS_PER_QUERY = int(os.getenv("MAX_RESULTS_PER_QUERY", "10"))  # Results per search
MAX_TOTAL_BUSINESSES = int(os.getenv("MAX_TOTAL_BUSINESSES", "50"))  # Total to process

# Quality filters
MIN_RATING = 3.5
MIN_REVIEWS = 3

# ============ CORE CATEGORIES ============
BUSINESS_CATEGORIES = {
    "HIGH_VALUE": [
        "marketing", "advertising", "consulting", "law", "legal", "accounting", 
        "medical", "dental", "clinic", "software", "IT", "tech", "real estate",
        "insurance", "finance", "architecture", "engineering"
    ],
    "LOCAL_BUSINESS": [
        "restaurant", "cafe", "hotel", "spa", "salon", "gym", "fitness",
        "repair", "automotive", "retail", "store", "shop", "pharmacy"
    ],
    "OTHER": [
        "service", "company", "business", "center", "office"
    ]
}

# Prioritized search terms - most valuable first
SEARCH_TERMS = [
    # High-value (priority)
    "marketing agency Colombo",
    "law firm Colombo",
    "IT company Colombo",
    "accounting firm Colombo",
    "medical clinic Colombo",
    # Local business
    "restaurant Colombo",
    "hotel Colombo",
    "spa Colombo",
    # General (lower priority)
    "business Colombo",
    "service Colombo"
]

# ============ HELPERS ============
def clean_phone_number(phone_str):
    """Standardize to Sri Lankan format"""
    if not phone_str:
        return None
    import phonenumbers
    clean = re.sub(r'[^\d+]', '', phone_str.strip())
    if clean.startswith('0'):
        clean = '+94' + clean[1:]
    elif clean.startswith('94'):
        clean = '+' + clean
    elif not clean.startswith('+'):
        clean = '+94' + clean
    try:
        parsed = phonenumbers.parse(clean, "LK")
        if phonenumbers.is_valid_number(parsed):
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except:
        pass
    return None

def extract_email_from_website(url):
    """Fetch first decent email from a site"""
    if not url:
        return None
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        response = requests.get(url, timeout=8, headers={
            'User-Agent': 'Mozilla/5.0'
        })
        emails = re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", response.text)
        good = [e for e in emails if not any(bad in e.lower() for bad in ["noreply", "example", "test"])]
        return good[0] if good else None
    except:
        return None

def categorize_business(name, types, website_text=""):
    text = f"{name} {' '.join(types)} {website_text}".lower()
    for cat, kws in BUSINESS_CATEGORIES.items():
        if any(k in text for k in kws):
            return cat
    return "OTHER"

def score_lead(rating, reviews, has_phone, has_email, has_website, category):
    score = 0
    if rating >= 4.5: score += 30
    elif rating >= 4.0: score += 20
    elif rating >= 3.5: score += 10
    if reviews >= 50: score += 25
    elif reviews >= 20: score += 15
    elif reviews >= 5: score += 10
    if has_phone: score += 20
    if has_email: score += 15
    if has_website: score += 10
    if category == "HIGH_VALUE": score += 20
    elif category == "LOCAL_BUSINESS": score += 10
    return "HOT" if score >= 70 else "WARM" if score >= 40 else "COLD"

# ============ RATE LIMITER ============
class SimpleRateLimiter:
    def __init__(self, max_calls_per_min=30):
        self.calls = deque()
        self.limit = max_calls_per_min
    def allow(self):
        now = time.time()
        while self.calls and now - self.calls[0] > 60:
            self.calls.popleft()
        if len(self.calls) < self.limit:
            self.calls.append(now)
            return True
        return False
    def wait_if_needed(self):
        while not self.allow():
            time.sleep(1)

# ============ SCRAPER ============
def scrape_quality_businesses():
    if not GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY required")
    gmaps = googlemaps.Client(key=GOOGLE_API_KEY)
    location = (DEFAULT_LAT, DEFAULT_LNG)
    all_places, seen = [], set()
    limiter = SimpleRateLimiter(30)
    
    # Limit number of search queries
    limited_search_terms = SEARCH_TERMS[:MAX_SEARCH_QUERIES]
    api_calls = 0

    print(f"🎯 Scraping businesses near {location} (radius {SEARCH_RADIUS}m)")
    print(f"📊 Budget limits: {MAX_SEARCH_QUERIES} queries, {MAX_RESULTS_PER_QUERY} results each, max {MAX_TOTAL_BUSINESSES} total")
    
    for i, term in enumerate(limited_search_terms, 1):
        if len(all_places) >= MAX_TOTAL_BUSINESSES:
            print(f"✋ Reached max businesses limit ({MAX_TOTAL_BUSINESSES})")
            break
            
        print(f"[{i}/{len(limited_search_terms)}] Searching: {term}")
        limiter.wait_if_needed()
        try:
            resp = gmaps.places(query=term, location=location, radius=SEARCH_RADIUS)
            api_calls += 1
            results = resp.get("results", [])
            
            # Limit results per query
            results = results[:MAX_RESULTS_PER_QUERY]
            
            for p in results:
                if len(all_places) >= MAX_TOTAL_BUSINESSES:
                    break
                    
                pid = p.get("place_id")
                rating = p.get("rating", 0)
                if pid and pid not in seen and rating >= MIN_RATING and p.get("user_ratings_total", 0) >= MIN_REVIEWS:
                    all_places.append(p)
                    seen.add(pid)
            print(f"   Found: {len(results)} | Total collected: {len(all_places)} | API calls: {api_calls}")
        except Exception as e:
            print(f"   Error: {e}")
    
    print(f"\n💰 Total API calls used: {api_calls} Text Searches")
    return all_places

def process_leads(places):
    gmaps = googlemaps.Client(key=GOOGLE_API_KEY)
    leads = []
    limiter = SimpleRateLimiter(60)
    api_calls = 0
    
    print(f"📞 Processing {len(places)} businesses...")
    for i, p in enumerate(places, 1):
        if i % 10 == 0: print(f"   Progress {i}/{len(places)} | API calls: {api_calls}")
        limiter.wait_if_needed()
        try:
            details = gmaps.place(
                place_id=p["place_id"],
                fields=["formatted_phone_number", "website", "formatted_address"]
            ).get("result", {})
            api_calls += 1
            
            phone = clean_phone_number(details.get("formatted_phone_number"))
            website = details.get("website", "")
            email = extract_email_from_website(website) if website else None
            if not phone and not email:
                continue
            category = categorize_business(p.get("name", ""), p.get("types", []))
            rating, reviews = p.get("rating", 0), p.get("user_ratings_total", 0)
            quality = score_lead(rating, reviews, bool(phone), bool(email), bool(website), category)
            leads.append({
                "place_id": p["place_id"],
                "business_name": p.get("name", "Unknown"),
                "address": details.get("formatted_address", p.get("vicinity", "")),
                "phone": phone or "",
                "email": email or "",
                "website": website,
                "rating": rating,
                "review_count": reviews,
                "category": category,
                "lead_quality": quality,
                "scraped_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
        except Exception as e:
            print(f"   Error {p.get('name','?')}: {e}")
    
    print(f"\n💰 Total API calls used: {api_calls} Place Details")
    leads.sort(key=lambda x: (x["lead_quality"], x["rating"]), reverse=True)
    return leads, api_calls

def save_leads_csv(leads):
    if not leads:
        return
    with open(LEADS_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=leads[0].keys())
        writer.writeheader()
        writer.writerows(leads)
    print(f"💾 Saved {len(leads)} leads to {LEADS_FILE}")

# ============ MAIN ============
def main():
    print("🚀 LEAN BUSINESS SCRAPER (Budget-Friendly)")
    print("="*50)
    start = time.time()
    
    # Scrape businesses
    places = scrape_quality_businesses()
    if not places:
        print("❌ No businesses found")
        return
    
    # Process leads
    leads, details_calls = process_leads(places)
    if not leads:
        print("❌ No leads generated")
        return
    
    # Save results
    save_leads_csv(leads)
    
    # Summary
    print(f"\n✅ Done in {(time.time()-start)/60:.1f} minutes")
    print(f"\n📊 LEAD QUALITY BREAKDOWN:")
    print(f"   🔥 HOT:  {sum(l['lead_quality']=='HOT' for l in leads)}")
    print(f"   🔸 WARM: {sum(l['lead_quality']=='WARM' for l in leads)}")
    print(f"   ❄️  COLD: {sum(l['lead_quality']=='COLD' for l in leads)}")
    
    # Cost estimate
    search_cost = (MAX_SEARCH_QUERIES * 32) / 1000
    details_cost = (details_calls * 17) / 1000
    total_cost = search_cost + details_cost
    print(f"\n💰 ESTIMATED API COST:")
    print(f"   Text Searches: ${search_cost:.2f}")
    print(f"   Place Details: ${details_cost:.2f}")
    print(f"   Total: ${total_cost:.2f}")
    print(f"   Remaining budget: ${200 - total_cost:.2f}")

if __name__ == "__main__":
    main()