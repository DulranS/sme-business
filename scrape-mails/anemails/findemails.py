import csv
import re
import time
import random
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
import os
import logging
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import deque
from datetime import datetime

# -----------------------------
# CONFIGURATION
# -----------------------------
CSV_INPUT_PATH = r"c:\Users\dulra\Downloads\google (6).csv"
OUTPUT_BASE_NAME = "enriched_leads"

REQUIRED_COLUMNS = ['website']

OUTPUT_COLUMNS = [
    'place_id', 'business_name', 'rating', 'reviews', 'category', 
    'address', 'whatsapp_number', 'website', 'email', 'instagram', 'twitter',
    'linkedin_company', 'linkedin_ceo', 'linkedin_founder', 'phone_primary', 
    'email_primary', 'contact_page_found', 'social_media_score',
    'lead_quality_score', 'contact_confidence', 'best_contact_method',
    'decision_maker_found', 'tech_stack_detected', 'company_size_indicator'
]

# Optimized scraper settings
EMAIL_TIMEOUT = 8
MAX_RETRIES = 2
MAX_PAGES_PER_SITE = 8
MAX_WORKERS = 16  # Increased for faster processing
REQUEST_DELAY_MIN = 0.3
REQUEST_DELAY_MAX = 0.7

PRIORITY_PATHS = [
    '/contact', '/contact-us', '/about', '/about-us', '/team', 
    '/info', '/support', '/get-in-touch', '/reach-us', '/leadership',
    '/our-team', '/meet-the-team', '/careers', '/privacy', '/impressum'
]

# Enhanced regex patterns
EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
INSTAGRAM_PATTERN = re.compile(r'https?://(www\.)?instagram\.com/([A-Za-z0-9._-]{1,30})/?', re.IGNORECASE)
TWITTER_PATTERN = re.compile(r'https?://(www\.|mobile\.)?(twitter\.com|x\.com)/([A-Za-z0-9_]{1,15})/?', re.IGNORECASE)
LINKEDIN_PATTERN = re.compile(r'https?://(?:www\.)?linkedin\.com/(?:company|in)/([A-Za-z0-9-]+)/?', re.IGNORECASE)
LINKEDIN_COMPANY_PATTERN = re.compile(r'https?://(?:www\.)?linkedin\.com/company/([A-Za-z0-9-]+)/?', re.IGNORECASE)
FACEBOOK_PATTERN = re.compile(r'https?://(www\.)?(facebook\.com|fb\.com)/([A-Za-z0-9._-]+)/?', re.IGNORECASE)
YOUTUBE_PATTERN = re.compile(r'https?://(?:www\.)?youtube\.com/(?:@|channel/|user/)?([A-Za-z0-9_-]+)/?', re.IGNORECASE)
TIKTOK_PATTERN = re.compile(r'https?://(?:www\.)?tiktok\.com/@([A-Za-z0-9._-]+)/?', re.IGNORECASE)

PHONE_PATTERN = re.compile(
    r'(?:(?:\+|00)\d{1,3}[\s.-]?)?'
    r'(?:\(?\d{1,4}\)?[\s.-]?)?'
    r'\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,9}',
    re.IGNORECASE
)

# Business intelligence keywords
DECISION_MAKER_TITLES = [
    'ceo', 'founder', 'co-founder', 'president', 'owner', 'director',
    'chief executive', 'managing director', 'principal', 'partner',
    'head of', 'vp of', 'vice president', 'executive'
]

TECH_STACK_INDICATORS = {
    'shopify': ['shopify.com', 'myshopify.com'],
    'wordpress': ['wp-content', 'wp-includes', 'wordpress'],
    'wix': ['wix.com', 'wixsite.com'],
    'squarespace': ['squarespace.com', 'sqsp.com'],
    'webflow': ['webflow.io', 'webflow.com'],
    'react': ['react', '_next', 'nextjs'],
    'angular': ['ng-', 'angular'],
    'vue': ['vue', 'nuxt']
}

COMPANY_SIZE_KEYWORDS = {
    'small': ['startup', 'boutique', 'small team', 'family-owned', 'solo'],
    'medium': ['growing', 'expanding', 'established', 'regional'],
    'large': ['enterprise', 'global', 'multinational', 'fortune', 'leading', 'industry leader']
}

# Email quality scoring
EMAIL_QUALITY_SCORES = {
    'high': ['contact', 'info', 'hello', 'hi', 'sales', 'inquiries'],
    'medium': ['support', 'help', 'service', 'admin'],
    'low': ['noreply', 'no-reply', 'donotreply', 'mailer-daemon']
}

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger()

# -----------------------------
# ENHANCED UTILS
# -----------------------------
def get_unique_output_path(base_name, extension=".csv"):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    candidate = f"{base_name}_{timestamp}{extension}"
    if not os.path.exists(candidate):
        return candidate
    counter = 1
    while True:
        candidate = f"{base_name}_{timestamp}_{counter}{extension}"
        if not os.path.exists(candidate):
            return candidate
        counter += 1

def normalize_url(url):
    if not url or not isinstance(url, str):
        return None
    url = url.strip()
    if not url or url.lower() in {'n/a', 'null', 'none', '-', '', '·'}:
        return None
    if any(x in url for x in ['google.com/aclk', 'google.com/maps', 'gclid=', 'maps.app.goo.gl', 'goo.gl', 'bit.ly']):
        return None
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    try:
        parsed = urlparse(url)
        if not parsed.netloc or 'google.com' in parsed.netloc or len(parsed.netloc) < 4:
            return None
    except:
        return None
    return url.rstrip('/')

def extract_base_domain(netloc):
    netloc = netloc.lower().replace('www.', '').split(':')[0]
    parts = netloc.split('.')
    if len(parts) >= 2:
        return '.'.join(parts[-2:])
    return netloc

def is_relevant_email(email, base_domain):
    try:
        if '@' not in email:
            return False
        local, domain = email.rsplit('@', 1)
        domain = domain.lower()
        base_domain = base_domain.lower()
        
        # Exclude common spam/invalid patterns
        spam_patterns = ['example', 'test', 'sample', 'dummy', 'fake', 'youremail']
        if any(pattern in email.lower() for pattern in spam_patterns):
            return False
            
        return domain == base_domain or domain.endswith('.' + base_domain)
    except:
        return False

def score_email_quality(email):
    """Score email based on business value (0-10)"""
    email_lower = email.lower()
    
    # Low quality emails
    for low_keyword in EMAIL_QUALITY_SCORES['low']:
        if low_keyword in email_lower:
            return 2
    
    # High quality emails
    for high_keyword in EMAIL_QUALITY_SCORES['high']:
        if high_keyword in email_lower:
            return 9
    
    # Medium quality emails
    for med_keyword in EMAIL_QUALITY_SCORES['medium']:
        if med_keyword in email_lower:
            return 6
    
    # Generic email (firstname.lastname pattern gets higher score)
    if '.' in email.split('@')[0]:
        return 7
    
    return 5  # Default score

def clean_phone_number(phone_str):
    if not phone_str:
        return None
    
    phone = re.sub(r'[^\d+\s()-]', '', phone_str)
    phone = phone.strip()
    
    digits_only = re.sub(r'\D', '', phone)
    if len(digits_only) < 7 or len(digits_only) > 15:
        return None
    
    if re.match(r'^[01]+$', digits_only) or len(set(digits_only)) == 1:
        return None
    
    phone = re.sub(r'\s+', ' ', phone)
    phone = re.sub(r'[()]', '', phone)
    
    return phone

def extract_phone_numbers(text):
    phones = set()
    matches = PHONE_PATTERN.findall(text)
    
    for match in matches:
        cleaned = clean_phone_number(match)
        if cleaned:
            phones.add(cleaned)
    
    tel_pattern = re.compile(r'tel:([+\d\s()-]+)', re.IGNORECASE)
    tel_matches = tel_pattern.findall(text)
    for tel in tel_matches:
        cleaned = clean_phone_number(tel)
        if cleaned:
            phones.add(cleaned)
    
    return phones

def detect_decision_makers(soup, text):
    """Detect if decision maker profiles are present"""
    decision_makers = []
    text_lower = text.lower()
    
    for title in DECISION_MAKER_TITLES:
        if title in text_lower:
            # Try to extract names near titles
            context = re.findall(rf'([A-Z][a-z]+\s+[A-Z][a-z]+)[\s,]*{title}', text, re.IGNORECASE)
            if context:
                decision_makers.extend(context[:3])  # Max 3 names
    
    return len(decision_makers) > 0, decision_makers

def detect_tech_stack(soup, text):
    """Detect website technology stack"""
    detected = []
    html_text = str(soup).lower()
    
    for tech, indicators in TECH_STACK_INDICATORS.items():
        if any(indicator in html_text for indicator in indicators):
            detected.append(tech)
    
    return detected

def estimate_company_size(text):
    """Estimate company size from website content"""
    text_lower = text.lower()
    
    for size, keywords in COMPANY_SIZE_KEYWORDS.items():
        if any(keyword in text_lower for keyword in keywords):
            return size
    
    # Check for employee counts
    employee_match = re.search(r'(\d+)\+?\s*(employees|team members|staff)', text_lower)
    if employee_match:
        count = int(employee_match.group(1))
        if count < 50:
            return 'small'
        elif count < 250:
            return 'medium'
        else:
            return 'large'
    
    return 'unknown'

def extract_social_profiles(soup):
    profiles = {
        'facebook': '',
        'youtube': '',
        'tiktok': '',
        'linkedin_company': '',
        'linkedin_ceo': '',
        'linkedin_founder': ''
    }
    
    text = soup.get_text(separator=' ', strip=True).lower()
    
    for a_tag in soup.find_all('a', href=True):
        href = a_tag.get('href', '').lower()
        anchor_text = a_tag.get_text(strip=True).lower()
        
        if not profiles['facebook'] and 'facebook.com' in href:
            fb_match = FACEBOOK_PATTERN.search(href)
            if fb_match:
                fb_handle = fb_match.group(3)
                if fb_handle and len(fb_handle) > 2:
                    profiles['facebook'] = f"https://www.facebook.com/{fb_handle}/"
        
        if not profiles['youtube'] and 'youtube.com' in href:
            yt_match = YOUTUBE_PATTERN.search(href)
            if yt_match:
                yt_handle = yt_match.group(1)
                if yt_handle and len(yt_handle) > 2:
                    profiles['youtube'] = f"https://www.youtube.com/@{yt_handle}/"
        
        if not profiles['tiktok'] and 'tiktok.com' in href:
            tt_match = TIKTOK_PATTERN.search(href)
            if tt_match:
                tt_handle = tt_match.group(1)
                if tt_handle and len(tt_handle) > 2:
                    profiles['tiktok'] = f"https://www.tiktok.com/@{tt_handle}/"
        
        if not profiles['linkedin_company'] and 'linkedin.com' in href:
            li_company_match = LINKEDIN_COMPANY_PATTERN.search(href)
            if li_company_match:
                company_id = li_company_match.group(1)
                if company_id and len(company_id) > 1 and not company_id.isdigit():
                    profiles['linkedin_company'] = f"https://www.linkedin.com/company/{company_id}/"
        
        if 'linkedin.com/in' in href:
            li_personal_match = re.search(r'linkedin\.com/in/([A-Za-z0-9-]+)', href)
            if li_personal_match:
                profile_id = li_personal_match.group(1)
                if profile_id and len(profile_id) > 2:
                    if any(title in anchor_text for title in ['ceo', 'chief executive', 'executive officer']):
                        if not profiles['linkedin_ceo']:
                            profiles['linkedin_ceo'] = f"https://www.linkedin.com/in/{profile_id}/"
                    elif any(title in anchor_text for title in ['founder', 'co-founder', 'cofounder']):
                        if not profiles['linkedin_founder']:
                            profiles['linkedin_founder'] = f"https://www.linkedin.com/in/{profile_id}/"
    
    return profiles

def get_soup(url, timeout=EMAIL_TIMEOUT):
    user_agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    ]
    headers = {'User-Agent': random.choice(user_agents)}
    
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = requests.get(url, timeout=timeout, headers=headers, allow_redirects=True)
            if response.status_code == 200:
                response.encoding = response.apparent_encoding or 'utf-8'
                return BeautifulSoup(response.text, 'html.parser')
        except Exception:
            if attempt < MAX_RETRIES:
                time.sleep(random.uniform(0.3, 0.6))
                continue
    return None

def calculate_lead_quality_score(data):
    """Calculate comprehensive lead quality score (0-100)"""
    score = 0
    
    # Email quality (35 points max)
    if data.get('email_primary'):
        email_quality = score_email_quality(data['email_primary'])
        score += (email_quality / 10) * 35
    
    # Phone availability (20 points)
    if data.get('phone_primary'):
        score += 20
    
    # Social media presence (15 points)
    social_score = int(data.get('social_media_score', 0))
    score += min(social_score * 2.5, 15)
    
    # Decision maker found (15 points)
    if data.get('decision_maker_found') == 'Yes':
        score += 15
    
    # LinkedIn company profile (10 points)
    if data.get('linkedin_company'):
        score += 10
    
    # Contact page found (5 points)
    if data.get('contact_page_found') == 'Yes':
        score += 5
    
    return min(int(score), 100)

def calculate_contact_confidence(data):
    """Calculate confidence level in contact information (Low/Medium/High)"""
    confidence_score = 0
    
    if data.get('email_primary'):
        email_quality = score_email_quality(data['email_primary'])
        confidence_score += email_quality
    
    if data.get('phone_primary'):
        confidence_score += 8
    
    if data.get('contact_page_found') == 'Yes':
        confidence_score += 5
    
    if data.get('linkedin_company'):
        confidence_score += 4
    
    if confidence_score >= 18:
        return 'High'
    elif confidence_score >= 10:
        return 'Medium'
    else:
        return 'Low'

def determine_best_contact_method(data):
    """Recommend the best way to contact this lead"""
    methods = []
    
    if data.get('email_primary'):
        email_quality = score_email_quality(data['email_primary'])
        if email_quality >= 7:
            methods.append('Email')
    
    if data.get('phone_primary'):
        methods.append('Phone')
    
    if data.get('linkedin_company') or data.get('linkedin_ceo'):
        methods.append('LinkedIn')
    
    if data.get('instagram'):
        methods.append('Instagram DM')
    
    if not methods:
        return 'Website Form'
    
    return ' → '.join(methods[:2])  # Top 2 methods

def scrape_all_data_from_site(root_url, existing_phone=""):
    """Enhanced scraping with business intelligence"""
    root_url = normalize_url(root_url)
    if not root_url:
        return {
            'emails': set(), 'phones': set(), 'instagram': '', 'twitter': '',
            'linkedin_company': '', 'linkedin_ceo': '', 'linkedin_founder': '',
            'social_profiles': {}, 'contact_page_found': False, 'social_media_score': 0,
            'decision_maker_found': False, 'decision_makers': [], 'tech_stack': [],
            'company_size': 'unknown'
        }
    
    parsed = urlparse(root_url)
    base_domain = extract_base_domain(parsed.netloc)
    
    result = {
        'emails': set(),
        'phones': set(),
        'instagram': '',
        'twitter': '',
        'linkedin_company': '',
        'linkedin_ceo': '',
        'linkedin_founder': '',
        'social_profiles': {},
        'contact_page_found': False,
        'social_media_score': 0,
        'decision_maker_found': False,
        'decision_makers': [],
        'tech_stack': [],
        'company_size': 'unknown'
    }
    
    if existing_phone:
        cleaned = clean_phone_number(existing_phone)
        if cleaned:
            result['phones'].add(cleaned)
    
    visited = set()
    priority_urls = [urljoin(root_url, path) for path in PRIORITY_PATHS]
    urls_to_check = deque(priority_urls)
    urls_to_check.appendleft(root_url)
    
    pages_scraped = 0
    all_text = ""
    
    while urls_to_check and pages_scraped < MAX_PAGES_PER_SITE:
        url = urls_to_check.popleft()
        if url in visited:
            continue
        
        visited.add(url)
        pages_scraped += 1
        
        if any(keyword in url.lower() for keyword in ['/contact', '/contact-us', '/get-in-touch']):
            result['contact_page_found'] = True
        
        soup = get_soup(url, timeout=EMAIL_TIMEOUT)
        if not soup:
            continue
        
        # Extract social profiles
        current_profiles = extract_social_profiles(soup)
        for key, val in current_profiles.items():
            if val and not result['social_profiles'].get(key):
                result['social_profiles'][key] = val
        
        if current_profiles.get('linkedin_company') and not result['linkedin_company']:
            result['linkedin_company'] = current_profiles['linkedin_company']
        if current_profiles.get('linkedin_ceo') and not result['linkedin_ceo']:
            result['linkedin_ceo'] = current_profiles['linkedin_ceo']
        if current_profiles.get('linkedin_founder') and not result['linkedin_founder']:
            result['linkedin_founder'] = current_profiles['linkedin_founder']
        
        # Extract social links
        for a_tag in soup.find_all('a', href=True):
            href = a_tag['href'].strip()
            if not href:
                continue
            
            full_url = urljoin(root_url, href)
            
            if not full_url.startswith(('http://', 'https://')):
                continue
            
            if not result['instagram']:
                insta_match = INSTAGRAM_PATTERN.search(full_url)
                if insta_match:
                    username = insta_match.group(2).rstrip('/')
                    if username and 2 <= len(username) <= 30:
                        result['instagram'] = f"https://www.instagram.com/{username}/"
            
            if not result['twitter']:
                twitter_match = TWITTER_PATTERN.search(full_url)
                if twitter_match:
                    username = twitter_match.group(3).rstrip('/')
                    if username and 1 <= len(username) <= 15:
                        result['twitter'] = f"https://x.com/{username}/"
            
            if urlparse(full_url).netloc == parsed.netloc and len(visited) < MAX_PAGES_PER_SITE:
                if full_url not in visited and full_url not in urls_to_check:
                    if any(keyword in full_url.lower() for keyword in ['contact', 'about', 'team']):
                        urls_to_check.appendleft(full_url)
                    else:
                        urls_to_check.append(full_url)
        
        # Get HTML for phone extraction
        html_text = str(soup)
        page_phones = extract_phone_numbers(html_text)
        result['phones'].update(page_phones)
        
        # Remove unwanted tags
        for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'noscript', 'svg', 'iframe']):
            tag.decompose()
        
        text = soup.get_text(separator=' ', strip=True)
        all_text += " " + text
        
        # Extract emails
        raw_emails = set(re.findall(EMAIL_PATTERN, text))
        valid_emails = {
            e.lower() for e in raw_emails 
            if is_relevant_email(e, base_domain)
        }
        result['emails'].update(valid_emails)
        
        text_phones = extract_phone_numbers(text)
        result['phones'].update(text_phones)
        
        time.sleep(random.uniform(REQUEST_DELAY_MIN, REQUEST_DELAY_MAX))
    
    # Business intelligence analysis
    result['decision_maker_found'], result['decision_makers'] = detect_decision_makers(soup, all_text)
    result['tech_stack'] = detect_tech_stack(soup, all_text)
    result['company_size'] = estimate_company_size(all_text)
    
    # Calculate social media score
    result['social_media_score'] = sum([
        1 for val in [
            result['instagram'], result['twitter'], result['linkedin_company'],
            result['social_profiles'].get('facebook'),
            result['social_profiles'].get('youtube'),
            result['social_profiles'].get('tiktok')
        ] if val
    ])
    
    # Clean emails
    clean_emails = set()
    for e in result['emails']:
        e = e.strip()
        if 5 <= len(e) <= 254 and EMAIL_PATTERN.fullmatch(e):
            clean_emails.add(e)
    result['emails'] = clean_emails
    
    return result

def process_row(row):
    """Enhanced row processing with business intelligence"""
    business_name = row.get('business_name', 'Unknown')
    website = row.get('website', "")
    existing_phone = row.get('whatsapp_number', "")
    
    try:
        data = scrape_all_data_from_site(website, existing_phone)
        
        # Primary contacts with quality scoring
        primary_email = ""
        primary_phone = ""
        
        if data['emails']:
            # Sort by quality score
            scored_emails = [(email, score_email_quality(email)) for email in data['emails']]
            scored_emails.sort(key=lambda x: x[1], reverse=True)
            primary_email = scored_emails[0][0]
        
        if data['phones']:
            sorted_phones = sorted(data['phones'], key=lambda p: (not p.startswith('+'), len(p), p))
            primary_phone = sorted_phones[0]
        
        # Fill output fields
        row['email'] = '; '.join(sorted(data['emails'])) if data['emails'] else ""
        row['email_primary'] = primary_email
        row['instagram'] = data['instagram']
        row['twitter'] = data['twitter']
        row['linkedin_company'] = data['linkedin_company']
        row['linkedin_ceo'] = data['linkedin_ceo']
        row['linkedin_founder'] = data['linkedin_founder']
        row['contact_page_found'] = "Yes" if data['contact_page_found'] else "No"
        row['social_media_score'] = str(data['social_media_score'])
        row['decision_maker_found'] = "Yes" if data['decision_maker_found'] else "No"
        row['tech_stack_detected'] = ', '.join(data['tech_stack']) if data['tech_stack'] else ""
        row['company_size_indicator'] = data['company_size']
        
        # Update phone
        if data['phones']:
            sorted_phones = sorted(data['phones'], key=lambda p: (not p.startswith('+'), p))
            row['whatsapp_number'] = '; '.join(sorted_phones)
            row['phone_primary'] = primary_phone
        elif existing_phone:
            row['phone_primary'] = existing_phone
        else:
            row['whatsapp_number'] = ""
            row['phone_primary'] = ""
        
        # Calculate business intelligence scores
        row['lead_quality_score'] = str(calculate_lead_quality_score(row))
        row['contact_confidence'] = calculate_contact_confidence(row)
        row['best_contact_method'] = determine_best_contact_method(row)
            
    except Exception as e:
        logger.warning(f"Failed to scrape {business_name}: {str(e)[:100]}")
        # Set default values for failed scrapes
        for field in ['email', 'email_primary', 'instagram', 'twitter', 
                      'linkedin_company', 'linkedin_ceo', 'linkedin_founder',
                      'tech_stack_detected']:
            row[field] = ""
        row['contact_page_found'] = "No"
        row['social_media_score'] = "0"
        row['decision_maker_found'] = "No"
        row['company_size_indicator'] = "unknown"
        row['lead_quality_score'] = "0"
        row['contact_confidence'] = "Low"
        row['best_contact_method'] = "Unknown"
        if not existing_phone:
            row['whatsapp_number'] = ""
            row['phone_primary'] = ""
        else:
            row['phone_primary'] = existing_phone
    
    return row

def main():
    logger.info("🚀 Starting ENHANCED Business Intelligence Lead Enrichment...")
    
    # Read input
    try:
        with open(CSV_INPUT_PATH, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            input_columns = reader.fieldnames
    except Exception as e:
        logger.error(f"❌ Failed to read input file: {e}")
        sys.exit(1)
    
    missing_cols = [col for col in REQUIRED_COLUMNS if col not in input_columns]
    if missing_cols:
        logger.error(f"❌ Missing required column(s): {missing_cols}")
        sys.exit(1)
    
    # Build output columns
    dynamic_output_cols = []
    for col in OUTPUT_COLUMNS:
        if col in input_columns:
            dynamic_output_cols.append(col)
    
    enrichment_fields = [
        'email', 'email_primary', 'instagram', 'twitter', 
        'linkedin_company', 'linkedin_ceo', 'linkedin_founder',
        'phone_primary', 'contact_page_found', 'social_media_score',
        'lead_quality_score', 'contact_confidence', 'best_contact_method',
        'decision_maker_found', 'tech_stack_detected', 'company_size_indicator'
    ]
    for new_field in enrichment_fields:
        if new_field not in dynamic_output_cols:
            dynamic_output_cols.append(new_field)
    
    total_leads = len(rows)
    logger.info(f"✅ Loaded {total_leads} leads. Starting intelligent enrichment...")
    
    results = []
    completed = 0
    
    try:
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            future_to_row = {executor.submit(process_row, row.copy()): row for row in rows}
            
            for future in as_completed(future_to_row):
                try:
                    result = future.result()
                    results.append(result)
                    completed += 1
                    if completed % 10 == 0:
                        logger.info(f"📊 Progress: {completed}/{total_leads} leads processed")
                except Exception as e:
                    logger.error(f"❌ Error processing row: {str(e)[:100]}")
    
    except Exception as e:
        logger.error(f"❌ Threading error: {e}")
        sys.exit(1)
    
    # Write output
    if not results:
        logger.error("❌ No results to write")
        sys.exit(1)
    
    output_path = get_unique_output_path(OUTPUT_BASE_NAME)
    
    try:
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=dynamic_output_cols, restval='')
            writer.writeheader()
            
            for row in results:
                # Only include fields in dynamic_output_cols
                filtered_row = {k: v for k, v in row.items() if k in dynamic_output_cols}
                writer.writerow(filtered_row)
        
        logger.info(f"✅ Successfully enriched {len(results)} leads")
        logger.info(f"📁 Output saved to: {output_path}")
        
    except Exception as e:
        logger.error(f"❌ Failed to write output file: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()