"""
lean_business_scraper.py

LEAN & EFFECTIVE VERSION - Maximum ROI:
- Quality over quantity approach
- Email + WhatsApp extraction
- Simple lead scoring (Hot/Warm/Cold)
- 3 core business categories
- Single comprehensive export
- Fast, reliable WhatsApp automation

USAGE:
1. Set up .env with Google API key
2. Run: python lean_business_scraper.py
"""

import os
import time
import random
import csv
import json
import urllib.parse
import re
import requests
from datetime import datetime
from collections import deque
from dotenv import load_dotenv
import googlemaps
import phonenumbers
from phonenumbers.phonenumberutil import NumberParseException

# Selenium imports
from selenium import webdriver
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from bs4 import BeautifulSoup

load_dotenv()

# ============ LEAN CONFIG ============
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
DEFAULT_LAT = float(os.getenv("DEFAULT_LAT", "6.86026115"))  # Colombo
DEFAULT_LNG = float(os.getenv("DEFAULT_LNG", "79.912990"))
SEARCH_RADIUS = int(os.getenv("SEARCH_RADIUS", "8000"))

# Files
LEADS_FILE = os.getenv("LEADS_FILE", "business_leads.csv")
CAMPAIGN_FILE = os.getenv("CAMPAIGN_FILE", "whatsapp_campaign.csv")

# WhatsApp settings
MESSAGE = os.getenv("MESSAGE", 
    "Hi! I'm {your_name} from a digital marketing agency. Noticed {business_name} could benefit from online marketing. Interested in a free consultation? Reply STOP to opt-out.")
YOUR_NAME = os.getenv("YOUR_NAME", "Alex")  # Replace with your actual name

# Timing
MIN_DELAY = float(os.getenv("MIN_DELAY", "12"))
MAX_DELAY = float(os.getenv("MAX_DELAY", "25"))
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "30"))
BATCH_BREAK = int(os.getenv("BATCH_BREAK", "180"))
MAX_PER_DAY = int(os.getenv("MAX_PER_DAY", "150"))

# Quality filters
MIN_RATING = 3.5
MIN_REVIEWS = 3

# ============ CORE CATEGORIES (SIMPLIFIED) ============
BUSINESS_CATEGORIES = {
    "HIGH_VALUE": [
        # Service businesses with high marketing budgets
        "marketing", "advertising", "consulting", "law", "legal", "accounting", 
        "medical", "dental", "clinic", "software", "IT", "tech", "real estate",
        "insurance", "finance", "architecture", "engineering"
    ],
    "LOCAL_BUSINESS": [
        # Local businesses needing digital presence
        "restaurant", "cafe", "hotel", "spa", "salon", "gym", "fitness",
        "repair", "automotive", "retail", "store", "shop", "pharmacy"
    ],
    "OTHER": [
        # Everything else
        "service", "company", "business", "center", "office"
    ]
}

SEARCH_TERMS = [
    # High-value targets first
    "marketing agency Colombo", "law firm Colombo", "accounting firm Colombo",
    "medical clinic Colombo", "dental clinic Colombo", "IT company Colombo",
    
    # Local businesses
    "restaurant Colombo", "hotel Colombo", "spa Colombo", "gym Colombo",
    "retail store Colombo", "repair service Colombo",
    
    # General sweep
    "business Colombo", "service Colombo", "company Colombo"
]

# ============ HELPER FUNCTIONS ============
def clean_phone_number(phone_str):
    """Convert to Sri Lankan WhatsApp format"""
    if not phone_str:
        return None
    
    # Clean and standardize
    clean = re.sub(r'[^\d+]', '', phone_str.strip())
    
    # Convert to +94 format
    if clean.startswith('0'):
        clean = '+94' + clean[1:]
    elif clean.startswith('94'):
        clean = '+' + clean
    elif not clean.startswith('+'):
        clean = '+94' + clean
    
    try:
        parsed = phonenumbers.parse(clean, "LK")
        if phonenumbers.is_valid_number(parsed):
            national = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.NATIONAL)
            # Check for mobile prefixes
            if any(national.replace(' ', '').startswith(f'0{p}') for p in ['70','71','72','75','76','77','78']):
                return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164).lstrip("+")
    except:
        pass
    return None

def extract_email_from_website(url):
    """Quick email extraction from website"""
    if not url or not url.startswith(('http://', 'https://')):
        if url:
            url = 'https://' + url
        else:
            return None
    
    try:
        response = requests.get(url, timeout=8, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        # Simple email regex
        emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', response.text)
        
        # Filter out common junk emails
        good_emails = [e for e in emails if not any(skip in e.lower() 
                      for skip in ['noreply', 'no-reply', 'example', 'test', 'admin', 'info@google'])]
        
        return good_emails[0] if good_emails else None
        
    except:
        return None

def categorize_business(name, types, website_text=""):
    """Simple 3-category classification"""
    text = f"{name} {' '.join(types)} {website_text}".lower()
    
    for category, keywords in BUSINESS_CATEGORIES.items():
        if any(keyword in text for keyword in keywords):
            return category
    
    return "OTHER"

def score_lead(rating, reviews, has_phone, has_email, has_website, category):
    """Simple HOT/WARM/COLD scoring"""
    score = 0
    
    # Base quality
    if rating >= 4.5: score += 30
    elif rating >= 4.0: score += 20
    elif rating >= 3.5: score += 10
    
    if reviews >= 50: score += 25
    elif reviews >= 20: score += 15
    elif reviews >= 5: score += 10
    
    # Contact completeness
    if has_phone: score += 20
    if has_email: score += 15
    if has_website: score += 10
    
    # Category bonus
    if category == "HIGH_VALUE": score += 20
    elif category == "LOCAL_BUSINESS": score += 10
    
    # Simple classification
    if score >= 70: return "HOT"
    elif score >= 40: return "WARM"
    else: return "COLD"

# ============ RATE LIMITER ============
class SimpleRateLimiter:
    def __init__(self, max_per_day=150):
        self.max_per_day = max_per_day
        self.sends_today = deque()
    
    def can_send(self):
        now = time.time()
        # Remove old entries (older than 24 hours)
        while self.sends_today and now - self.sends_today[0] > 86400:
            self.sends_today.popleft()
        
        return len(self.sends_today) < self.max_per_day
    
    def record_send(self):
        self.sends_today.append(time.time())

# ============ SCRAPING FUNCTIONS ============
def scrape_quality_businesses():
    """Focused scraping for quality leads"""
    if not GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY required in .env file")
    
    gmaps = googlemaps.Client(key=GOOGLE_API_KEY)
    location = (DEFAULT_LAT, DEFAULT_LNG)
    all_places = []
    seen_ids = set()
    
    print(f"🎯 Scraping quality businesses near {location}")
    print(f"📍 Search radius: {SEARCH_RADIUS}m")
    
    for i, search_term in enumerate(SEARCH_TERMS, 1):
        print(f"[{i}/{len(SEARCH_TERMS)}] Searching: {search_term}")
        
        try:
            # Use text search for better targeting
            response = gmaps.places(query=search_term, location=location, radius=SEARCH_RADIUS)
            places = response.get("results", [])
            
            new_count = 0
            for place in places:
                place_id = place.get("place_id")
                rating = place.get("rating", 0)
                
                # Quality filter
                if (place_id and place_id not in seen_ids and 
                    rating >= MIN_RATING and 
                    place.get("user_ratings_total", 0) >= MIN_REVIEWS):
                    
                    all_places.append(place)
                    seen_ids.add(place_id)
                    new_count += 1
            
            print(f"   Added {new_count} quality businesses (total: {len(all_places)})")
            time.sleep(0.5)  # Respectful rate limiting
            
        except Exception as e:
            print(f"   Error: {e}")
            continue
    
    print(f"\n✅ Found {len(all_places)} quality businesses")
    return all_places

def process_leads(gmaps_client, places):
    """Convert places to qualified leads with contact info"""
    leads = []
    
    print(f"\n📞 Processing {len(places)} businesses for contact info...")
    
    for i, place in enumerate(places, 1):
        if i % 20 == 0:
            print(f"   Progress: {i}/{len(places)}")
        
        try:
            place_id = place.get("place_id")
            name = place.get("name", "Unknown")
            
            # Get detailed info
            details = gmaps_client.place(
                place_id=place_id,
                fields=["formatted_phone_number", "website", "formatted_address"]
            ).get("result", {})
            
            # Extract contact info
            phone_raw = details.get("formatted_phone_number", "")
            phone_wa = clean_phone_number(phone_raw)
            website = details.get("website", "")
            email = extract_email_from_website(website) if website else None
            
            # Skip if no contact method
            if not phone_wa and not email:
                continue
            
            # Business classification
            types = place.get("types", [])
            category = categorize_business(name, types)
            
            # Lead scoring
            rating = place.get("rating", 0)
            reviews = place.get("user_ratings_total", 0)
            lead_quality = score_lead(rating, reviews, bool(phone_wa), bool(email), bool(website), category)
            
            # Create lead record
            lead = {
                "place_id": place_id,
                "business_name": name,
                "address": details.get("formatted_address", place.get("vicinity", "")),
                "phone_raw": phone_raw,
                "whatsapp_number": phone_wa or "",
                "email": email or "",
                "website": website,
                "rating": rating,
                "review_count": reviews,
                "category": category,
                "lead_quality": lead_quality,
                "scraped_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            
            leads.append(lead)
            time.sleep(0.1)  # Brief pause
            
        except Exception as e:
            print(f"   Error processing {place.get('name', 'unknown')}: {e}")
            continue
    
    # Sort by quality and rating
    leads.sort(key=lambda x: (x["lead_quality"] == "HOT", x["lead_quality"] == "WARM", x["rating"]), reverse=True)
    
    print(f"✅ Generated {len(leads)} qualified leads")
    
    # Quick summary
    hot_leads = len([l for l in leads if l["lead_quality"] == "HOT"])
    warm_leads = len([l for l in leads if l["lead_quality"] == "WARM"])
    with_whatsapp = len([l for l in leads if l["whatsapp_number"]])
    with_email = len([l for l in leads if l["email"]])
    
    print(f"   🔥 HOT leads: {hot_leads}")
    print(f"   🔸 WARM leads: {warm_leads}")  
    print(f"   📱 WhatsApp contacts: {with_whatsapp}")
    print(f"   📧 Email contacts: {with_email}")
    
    return leads

def save_leads_csv(leads):
    """Save leads to CSV file"""
    if not leads:
        return
    
    with open(LEADS_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=[
            "place_id", "business_name", "address", "phone_raw", "whatsapp_number", 
            "email", "website", "rating", "review_count", "category", 
            "lead_quality", "scraped_date"
        ])
        writer.writeheader()
        writer.writerows(leads)
    
    print(f"💾 Saved {len(leads)} leads to {LEADS_FILE}")

# ============ WHATSAPP AUTOMATION ============
def setup_chrome():
    """Simple Chrome setup"""
    options = Options()
    options.add_argument("--start-maximized")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    
    # Use existing Chrome profile if available
    chrome_profile = os.getenv("CHROME_PROFILE_PATH")
    if chrome_profile and os.path.exists(chrome_profile):
        options.add_argument(f"--user-data-dir={chrome_profile}")
        print(f"Using Chrome profile: {chrome_profile}")
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.implicitly_wait(5)
    return driver

def send_whatsapp_message(driver, lead):
    """Send single WhatsApp message"""
    phone = lead["whatsapp_number"]
    if not phone:
        return False, "no_phone"
    
    # Create personalized message
    message = MESSAGE.format(
        your_name=YOUR_NAME,
        business_name=lead["business_name"]
    )
    
    wa_url = f"https://wa.me/{phone}?text={urllib.parse.quote(message)}"
    
    try:
        print(f"   Opening WhatsApp for {lead['business_name']}")
        driver.get(wa_url)
        time.sleep(3)
        
        # Try to click continue to WhatsApp Web
        try:
            continue_btn = WebDriverWait(driver, 8).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "a[href*='web.whatsapp.com'], .btn"))
            )
            continue_btn.click()
            time.sleep(4)
        except TimeoutException:
            pass  # Maybe already in WhatsApp Web
        
        # Try multiple send methods
        send_attempts = [
            lambda: driver.find_element(By.CSS_SELECTOR, "button[data-testid='compose-btn-send']").click(),
            lambda: driver.find_element(By.CSS_SELECTOR, "span[data-icon='send']").click(),
            lambda: driver.find_element(By.CSS_SELECTOR, "div[contenteditable='true']").send_keys(Keys.ENTER)
        ]
        
        for attempt in send_attempts:
            try:
                time.sleep(2)
                attempt()
                return True, "sent"
            except:
                continue
        
        return False, "send_failed"
        
    except Exception as e:
        return False, f"error: {str(e)[:50]}"

def run_whatsapp_campaign(leads):
    """Run WhatsApp campaign on qualified leads"""
    # Filter leads with WhatsApp
    whatsapp_leads = [l for l in leads if l["whatsapp_number"]]
    
    if not whatsapp_leads:
        print("No WhatsApp contacts available")
        return
    
    # Load already contacted
    contacted = set()
    try:
        with open(CAMPAIGN_FILE, 'r') as f:
            reader = csv.DictReader(f)
            contacted = {row["place_id"] for row in reader if row.get("status") == "sent"}
    except FileNotFoundError:
        pass
    
    # Filter new targets (prioritize HOT leads)
    targets = [l for l in whatsapp_leads if l["place_id"] not in contacted]
    targets = [l for l in targets if l["lead_quality"] in ["HOT", "WARM"]]  # Focus on quality
    
    if not targets:
        print("✅ All qualified leads already contacted")
        return
    
    print(f"\n📱 Starting WhatsApp campaign for {len(targets)} leads")
    
    # Setup
    driver = setup_chrome()
    rate_limiter = SimpleRateLimiter(MAX_PER_DAY)
    results = []
    
    try:
        for i, lead in enumerate(targets, 1):
            if not rate_limiter.can_send():
                print("⏳ Daily limit reached")
                break
            
            print(f"[{i}/{len(targets)}] {lead['business_name']} ({lead['lead_quality']})")
            
            success, reason = send_whatsapp_message(driver, lead)
            
            if success:
                print(f"   ✅ Message sent")
                rate_limiter.record_send()
            else:
                print(f"   ❌ Failed: {reason}")
            
            # Record result
            result = {
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "place_id": lead["place_id"],
                "business_name": lead["business_name"],
                "whatsapp_number": lead["whatsapp_number"],
                "lead_quality": lead["lead_quality"],
                "status": "sent" if success else "failed",
                "reason": reason
            }
            results.append(result)
            
            # Delay between messages
            if i < len(targets):
                delay = random.uniform(MIN_DELAY, MAX_DELAY)
                print(f"   ⏳ Waiting {delay:.1f}s...")
                time.sleep(delay)
            
            # Batch break
            if i % BATCH_SIZE == 0:
                print(f"\n🛑 Batch break: {BATCH_BREAK}s")
                time.sleep(BATCH_BREAK)
    
    except KeyboardInterrupt:
        print("\n⏹️ Campaign stopped by user")
    finally:
        driver.quit()
    
    # Save results
    if results:
        file_exists = os.path.exists(CAMPAIGN_FILE)
        with open(CAMPAIGN_FILE, 'a', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=[
                "timestamp", "place_id", "business_name", "whatsapp_number", 
                "lead_quality", "status", "reason"
            ])
            if not file_exists:
                writer.writeheader()
            writer.writerows(results)
        
        successful = len([r for r in results if r["status"] == "sent"])
        print(f"\n📊 Campaign Results: {successful}/{len(results)} sent successfully")
        print(f"💾 Results saved to {CAMPAIGN_FILE}")

# ============ MAIN EXECUTION ============
def main():
    print("🚀 LEAN BUSINESS LEAD SCRAPER & WHATSAPP AUTOMATION")
    print("🎯 Maximum ROI - Quality over Quantity")
    print("="*60)
    
    if "xxx" in MESSAGE or YOUR_NAME == "Alex":
        print("⚠️  Update YOUR_NAME and MESSAGE in .env file before running!")
        return
    
    start_time = time.time()
    
    # Step 1: Scrape quality businesses
    try:
        gmaps = googlemaps.Client(key=GOOGLE_API_KEY)
        places = scrape_quality_businesses()
        
        if not places:
            print("❌ No qualifying businesses found")
            return
            
    except Exception as e:
        print(f"❌ Scraping error: {e}")
        return
    
    # Step 2: Process into leads with contact info
    try:
        leads = process_leads(gmaps, places)
        
        if not leads:
            print("❌ No qualified leads generated")
            return
        
        save_leads_csv(leads)
        
    except Exception as e:
        print(f"❌ Processing error: {e}")
        return
    
    # Step 3: WhatsApp campaign
    try:
        run_whatsapp_campaign(leads)
    except Exception as e:
        print(f"❌ Campaign error: {e}")
    
    # Summary
    duration = time.time() - start_time
    hot_leads = len([l for l in leads if l["lead_quality"] == "HOT"])
    warm_leads = len([l for l in leads if l["lead_quality"] == "WARM"])
    
    print(f"\n🎉 MISSION COMPLETE!")
    print("="*60)
    print(f"📊 Results:")
    print(f"   Total Leads: {len(leads)}")
    print(f"   🔥 HOT: {hot_leads}")
    print(f"   🔸 WARM: {warm_leads}")
    print(f"   📱 WhatsApp Ready: {len([l for l in leads if l['whatsapp_number']])}")
    print(f"   📧 Email Ready: {len([l for l in leads if l['email']])}")
    print(f"   ⏱️ Time: {duration/60:.1f} minutes")
    print(f"\n📁 Files:")
    print(f"   📋 Leads: {LEADS_FILE}")
    print(f"   📱 Campaign: {CAMPAIGN_FILE}")

if __name__ == "__main__":
    main()