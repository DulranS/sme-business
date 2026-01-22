import csv
import re
import time
import random
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
from urllib.robotparser import RobotFileParser
import os
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import deque, defaultdict
from datetime import datetime
from threading import Lock

# ----------------------------- 
# CONFIGURATION
# ----------------------------- 
REQUIRED_COLUMNS = ['website']
OUTPUT_COLUMNS = [
    'place_id', 'business_name', 'rating', 'reviews', 'category', 'address',
    'whatsapp_number', 'website', 'email', 'instagram', 'twitter',
    'linkedin_company', 'linkedin_ceo', 'linkedin_founder', 'phone_primary',
    'email_primary', 'contact_page_found', 'social_media_score',
    'lead_quality_score', 'contact_confidence', 'best_contact_method',
    'decision_maker_found', 'tech_stack_detected', 'company_size_indicator'
]

# Scraper settings
EMAIL_TIMEOUT = 8
MAX_RETRIES = 2
MAX_PAGES_PER_SITE = 8
MAX_WORKERS = 8
REQUEST_DELAY_MIN = 0.5
REQUEST_DELAY_MAX = 1.0
BATCH_SIZE = 50
CHECKPOINT_INTERVAL = 10
DOMAIN_REQUEST_DELAY = 2.0

domain_locks = defaultdict(Lock)
domain_last_request = {}
domain_lock_manager = Lock()

PRIORITY_PATHS = [
    '/contact', '/contact-us', '/about', '/about-us', '/team', '/info',
    '/support', '/get-in-touch', '/reach-us', '/leadership', '/our-team',
    '/meet-the-team', '/careers', '/privacy', '/impressum'
]

# Enhanced regex patterns
EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
INSTAGRAM_PATTERN = re.compile(r'https?://(www\.)?instagram\.com/([A-Za-z0-9._-]{1,30})/?', re.IGNORECASE)
TWITTER_PATTERN = re.compile(r'https?://(www\.|mobile\.)?(twitter\.com|x\.com)/([A-Za-z0-9_]{1,15})/?', re.IGNORECASE)
LINKEDIN_PATTERN = re.compile(r'https?://(?:www\.)?linkedin\.com/(?:company|in)/([A-Za-z0-9-]+)/?', re.IGNORECASE)
LINKEDIN_COMPANY_PATTERN = re.compile(r'https?://(?:www\.)?linkedin\.com/company/([A-Za-z0-9-]+)/?', re.IGNORECASE)
PHONE_PATTERN = re.compile(
    r'(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{2,4}',
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

EMAIL_QUALITY_SCORES = {
    'high': ['contact', 'info', 'hello', 'hi', 'sales', 'inquiries'],
    'medium': ['support', 'help', 'service', 'admin'],
    'low': ['noreply', 'no-reply', 'donotreply', 'mailer-daemon']
}

robots_cache = {}
robots_cache_lock = Lock()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger()

# ----------------------------- 
# UTILITY FUNCTIONS
# ----------------------------- 
def create_output_filename(input_path):
    """Generate timestamped output filename based on input"""
    base_name = os.path.splitext(os.path.basename(input_path))[0]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_name = f"{base_name}_enriched_{timestamp}.csv"
    
    # Save in same directory as input
    output_dir = os.path.dirname(input_path) or '.'
    output_path = os.path.join(output_dir, output_name)
    
    # Ensure uniqueness
    counter = 1
    while os.path.exists(output_path):
        output_name = f"{base_name}_enriched_{timestamp}_{counter}.csv"
        output_path = os.path.join(output_dir, output_name)
        counter += 1
    
    return output_path

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

def can_fetch_url(url):
    try:
        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        with robots_cache_lock:
            if base_url not in robots_cache:
                rp = RobotFileParser()
                rp.set_url(urljoin(base_url, '/robots.txt'))
                try:
                    rp.read()
                    robots_cache[base_url] = rp
                except:
                    robots_cache[base_url] = None
            rp = robots_cache.get(base_url)
            if rp is None:
                return True
            return rp.can_fetch("*", url)
    except:
        return True

def rate_limit_domain(domain):
    with domain_lock_manager:
        if domain not in domain_locks:
            domain_locks[domain] = Lock()
    
    lock = domain_locks[domain]
    with lock:
        now = time.time()
        if domain in domain_last_request:
            elapsed = now - domain_last_request[domain]
            if elapsed < DOMAIN_REQUEST_DELAY:
                time.sleep(DOMAIN_REQUEST_DELAY - elapsed)
        domain_last_request[domain] = time.time()

def is_relevant_email(email, base_domain):
    try:
        if '@' not in email:
            return False
        local, domain = email.rsplit('@', 1)
        domain = domain.lower()
        base_domain = base_domain.lower()
        spam_patterns = ['example', 'test', 'sample', 'dummy', 'fake', 'youremail', 'tempmail']
        if any(pattern in email.lower() for pattern in spam_patterns):
            return False
        return domain == base_domain or domain.endswith('.' + base_domain)
    except:
        return False

def score_email_quality(email):
    email_lower = email.lower()
    for low_keyword in EMAIL_QUALITY_SCORES['low']:
        if low_keyword in email_lower:
            return 2
    for high_keyword in EMAIL_QUALITY_SCORES['high']:
        if high_keyword in email_lower:
            return 9
    for med_keyword in EMAIL_QUALITY_SCORES['medium']:
        if med_keyword in email_lower:
            return 6
    if '.' in email.split('@')[0]:
        return 7
    return 5

def clean_phone_number(phone_str):
    if not phone_str:
        return None
    phone = re.sub(r'[^\d+\s()-]', '', phone_str)
    phone = phone.strip()
    digits_only = re.sub(r'\D', '', phone)
    
    if len(digits_only) < 8 or len(digits_only) > 15:
        return None
    if re.match(r'^[01]+$', digits_only) or len(set(digits_only)) <= 2:
        return None
    
    is_sequential = all(
        int(digits_only[i]) == int(digits_only[i-1]) + 1
        for i in range(1, min(7, len(digits_only)))
    )
    if is_sequential and len(digits_only) >= 7:
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

def detect_decision_makers(text):
    decision_makers = []
    text_lower = text.lower()
    for title in DECISION_MAKER_TITLES:
        if title in text_lower:
            context = re.findall(rf'([A-Z][a-z]+\s+[A-Z][a-z]+)[\s,]*{title}', text, re.IGNORECASE)
            if context:
                decision_makers.extend(context[:3])
    return len(decision_makers) > 0, decision_makers

def detect_tech_stack(html_text):
    detected = []
    html_lower = html_text.lower()
    for tech, indicators in TECH_STACK_INDICATORS.items():
        if any(indicator in html_lower for indicator in indicators):
            detected.append(tech)
    return detected

def estimate_company_size(text):
    text_lower = text.lower()
    for size, keywords in COMPANY_SIZE_KEYWORDS.items():
        if any(keyword in text_lower for keyword in keywords):
            return size
    
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
        'linkedin_company': '',
        'linkedin_ceo': '',
        'linkedin_founder': ''
    }
    
    for a_tag in soup.find_all('a', href=True):
        href = a_tag.get('href', '').lower()
        anchor_text = a_tag.get_text(strip=True).lower()
        
        if not profiles['linkedin_company'] and 'linkedin.com/company' in href:
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
                    if any(title in anchor_text for title in ['ceo', 'chief executive']):
                        if not profiles['linkedin_ceo']:
                            profiles['linkedin_ceo'] = f"https://www.linkedin.com/in/{profile_id}/"
                    elif any(title in anchor_text for title in ['founder', 'co-founder']):
                        if not profiles['linkedin_founder']:
                            profiles['linkedin_founder'] = f"https://www.linkedin.com/in/{profile_id}/"
    
    return profiles

def get_soup(url, timeout=EMAIL_TIMEOUT):
    user_agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    ]
    headers = {'User-Agent': random.choice(user_agents)}
    
    if not can_fetch_url(url):
        logger.debug(f"Blocked by robots.txt: {url}")
        return None
    
    parsed = urlparse(url)
    domain = extract_base_domain(parsed.netloc)
    rate_limit_domain(domain)
    
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = requests.get(url, timeout=timeout, headers=headers, allow_redirects=True)
            if response.status_code == 200:
                response.encoding = response.apparent_encoding or 'utf-8'
                return BeautifulSoup(response.text, 'html.parser')
        except Exception as e:
            if attempt < MAX_RETRIES:
                time.sleep(random.uniform(0.5, 1.0))
                continue
            logger.debug(f"Failed to fetch {url}: {str(e)[:50]}")
    return None

def calculate_lead_quality_score(data):
    score = 0
    if data.get('email_primary'):
        email_quality = score_email_quality(data['email_primary'])
        score += (email_quality / 10) * 35
    if data.get('phone_primary'):
        score += 20
    social_score = int(data.get('social_media_score', 0))
    score += min(social_score * 2.5, 15)
    if data.get('decision_maker_found') == 'Yes':
        score += 15
    if data.get('linkedin_company'):
        score += 10
    if data.get('contact_page_found') == 'Yes':
        score += 5
    return min(int(score), 100)

def calculate_contact_confidence(data):
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
    return ' → '.join(methods[:2])

def scrape_all_data_from_site(root_url, existing_phone=""):
    root_url = normalize_url(root_url)
    if not root_url:
        return {
            'emails': set(), 'phones': set(), 'instagram': '', 'twitter': '',
            'linkedin_company': '', 'linkedin_ceo': '', 'linkedin_founder': '',
            'contact_page_found': False, 'social_media_score': 0,
            'decision_maker_found': False, 'tech_stack': [], 'company_size': 'unknown'
        }
    
    parsed = urlparse(root_url)
    base_domain = extract_base_domain(parsed.netloc)
    
    result = {
        'emails': set(), 'phones': set(), 'instagram': '', 'twitter': '',
        'linkedin_company': '', 'linkedin_ceo': '', 'linkedin_founder': '',
        'contact_page_found': False, 'social_media_score': 0,
        'decision_maker_found': False, 'tech_stack': [], 'company_size': 'unknown'
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
    all_html = ""
    
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
        
        current_profiles = extract_social_profiles(soup)
        for key, val in current_profiles.items():
            if val and not result.get(key):
                result[key] = val
        
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
        
        html_text = str(soup)
        all_html += " " + html_text
        page_phones = extract_phone_numbers(html_text)
        result['phones'].update(page_phones)
        
        for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'noscript', 'svg', 'iframe']):
            tag.decompose()
        
        text = soup.get_text(separator=' ', strip=True)
        all_text += " " + text
        
        raw_emails = set(re.findall(EMAIL_PATTERN, text))
        valid_emails = {e.lower() for e in raw_emails if is_relevant_email(e, base_domain)}
        result['emails'].update(valid_emails)
        
        text_phones = extract_phone_numbers(text)
        result['phones'].update(text_phones)
        
        time.sleep(random.uniform(REQUEST_DELAY_MIN, REQUEST_DELAY_MAX))
    
    result['decision_maker_found'], _ = detect_decision_makers(all_text)
    result['tech_stack'] = detect_tech_stack(all_html)
    result['company_size'] = estimate_company_size(all_text)
    result['social_media_score'] = sum([
        1 for val in [result['instagram'], result['twitter'], result['linkedin_company']] if val
    ])
    
    clean_emails = set()
    for e in result['emails']:
        e = e.strip()
        if 5 <= len(e) <= 254 and EMAIL_PATTERN.fullmatch(e):
            clean_emails.add(e)
    result['emails'] = clean_emails
    
    return result

def process_row(row):
    business_name = row.get('business_name', 'Unknown')
    website = row.get('website', "")
    existing_phone = row.get('whatsapp_number', "")
    
    try:
        data = scrape_all_data_from_site(website, existing_phone)
        
        primary_email = ""
        primary_phone = ""
        
        if data['emails']:
            scored_emails = [(email, score_email_quality(email)) for email in data['emails']]
            scored_emails.sort(key=lambda x: x[1], reverse=True)
            primary_email = scored_emails[0][0]
        
        if data['phones']:
            sorted_phones = sorted(data['phones'], key=lambda p: (not p.startswith('+'), len(p), p))
            primary_phone = sorted_phones[0]
        
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
        
        if data['phones']:
            sorted_phones = sorted(data['phones'], key=lambda p: (not p.startswith('+'), p))
            row['whatsapp_number'] = '; '.join(sorted_phones)
            row['phone_primary'] = primary_phone
        elif existing_phone:
            row['phone_primary'] = existing_phone
        else:
            row['whatsapp_number'] = ""
            row['phone_primary'] = ""
        
        row['lead_quality_score'] = str(calculate_lead_quality_score(row))
        row['contact_confidence'] = calculate_contact_confidence(row)
        row['best_contact_method'] = determine_best_contact_method(row)
        
        logger.info(f"✓ {business_name}: Quality={row['lead_quality_score']}, Confidence={row['contact_confidence']}")
    
    except Exception as e:
        logger.warning(f"Failed to scrape {business_name}: {str(e)[:100]}")
        for field in ['email', 'email_primary', 'instagram', 'twitter', 'linkedin_company', 
                      'linkedin_ceo', 'linkedin_founder', 'tech_stack_detected']:
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

def save_checkpoint(results, output_path, columns):
    checkpoint_path = output_path.replace('.csv', '_checkpoint.csv')
    try:
        with open(checkpoint_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=columns, restval='')
            writer.writeheader()
            for row in results:
                filtered_row = {k: v for k, v in row.items() if k in columns}
                writer.writerow(filtered_row)
        logger.info(f"💾 Checkpoint saved: {len(results)} rows")
    except Exception as e:
        logger.error(f"Failed to save checkpoint: {e}")

def main():
    print("\n" + "="*70)
    print("🚀 BUSINESS INTELLIGENCE LEAD ENRICHMENT TOOL")
    print("="*70 + "\n")
    
    # Get input file
    input_file = input("📁 Enter path to your CSV file: ").strip().strip('"').strip("'")
    
    if not os.path.exists(input_file):
        logger.error(f"❌ File not found: {input_file}")
        return
    
    # Read input
    try:
        with open(input_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            input_columns = reader.fieldnames
    except Exception as e:
        logger.error(f"❌ Failed to read input file: {e}")
        return
    
    # Validate required columns
    missing_cols = [col for col in REQUIRED_COLUMNS if col not in input_columns]
    if missing_cols:
        logger.error(f"❌ Missing required column(s): {missing_cols}")
        logger.info(f"Available columns: {', '.join(input_columns)}")
        return
    
    # Build output columns
    dynamic_output_cols = []
    for col in OUTPUT_COLUMNS:
        if col in input_columns:
            dynamic_output_cols.append(col)
    
    enrichment_fields = [
        'email', 'email_primary', 'instagram', 'twitter', 'linkedin_company',
        'linkedin_ceo', 'linkedin_founder', 'phone_primary', 'contact_page_found',
        'social_media_score', 'lead_quality_score', 'contact_confidence',
        'best_contact_method', 'decision_maker_found', 'tech_stack_detected',
        'company_size_indicator'
    ]
    
    for new_field in enrichment_fields:
        if new_field not in dynamic_output_cols:
            dynamic_output_cols.append(new_field)
    
    total_leads = len(rows)
    logger.info(f"✅ Loaded {total_leads} leads from {input_file}")
    
    # Generate output path
    output_path = create_output_filename(input_file)
    logger.info(f"📄 Output will be saved to: {output_path}")
    
    print(f"\n⚙️  Processing with {MAX_WORKERS} workers, batch size: {BATCH_SIZE}")
    print("⏳ Starting enrichment...\n")
    
    # Process in batches
    results = []
    completed = 0
    start_time = time.time()
    
    try:
        for batch_start in range(0, total_leads, BATCH_SIZE):
            batch_end = min(batch_start + BATCH_SIZE, total_leads)
            batch = rows[batch_start:batch_end]
            
            logger.info(f"📦 Processing batch {batch_start//BATCH_SIZE + 1}: rows {batch_start+1}-{batch_end}")
            
            with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                future_to_row = {executor.submit(process_row, row.copy()): row for row in batch}
                
                for future in as_completed(future_to_row):
                    try:
                        result = future.result()
                        results.append(result)
                        completed += 1
                        
                        if completed % 10 == 0:
                            elapsed = time.time() - start_time
                            rate = completed / elapsed if elapsed > 0 else 0
                            eta = (total_leads - completed) / rate if rate > 0 else 0
                            logger.info(f"📊 Progress: {completed}/{total_leads} ({100*completed//total_leads}%) | ETA: {int(eta//60)}m {int(eta%60)}s")
                        
                        # Save checkpoint periodically
                        if completed % CHECKPOINT_INTERVAL == 0:
                            save_checkpoint(results, output_path, dynamic_output_cols)
                    
                    except Exception as e:
                        logger.error(f"❌ Error processing row: {str(e)[:100]}")
            
            # Save checkpoint after each batch
            save_checkpoint(results, output_path, dynamic_output_cols)
    
    except KeyboardInterrupt:
        logger.warning("\n⚠️  Process interrupted by user. Saving progress...")
        save_checkpoint(results, output_path, dynamic_output_cols)
        return
    
    except Exception as e:
        logger.error(f"❌ Critical error: {e}")
        save_checkpoint(results, output_path, dynamic_output_cols)
        return
    
    # Write final output
    if not results:
        logger.error("❌ No results to write")
        return
    
    try:
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=dynamic_output_cols, restval='')
            writer.writeheader()
            for row in results:
                filtered_row = {k: v for k, v in row.items() if k in dynamic_output_cols}
                writer.writerow(filtered_row)
        
        # Calculate statistics
        high_quality = sum(1 for r in results if int(r.get('lead_quality_score', 0)) >= 70)
        has_email = sum(1 for r in results if r.get('email_primary'))
        has_phone = sum(1 for r in results if r.get('phone_primary'))
        has_linkedin = sum(1 for r in results if r.get('linkedin_company'))
        has_decision_maker = sum(1 for r in results if r.get('decision_maker_found') == 'Yes')
        
        total_time = time.time() - start_time
        
        print("\n" + "="*70)
        print("✅ ENRICHMENT COMPLETE!")
        print("="*70)
        print(f"\n📁 Output File: {output_path}")
        print(f"⏱️  Total Time: {int(total_time//60)}m {int(total_time%60)}s")
        print(f"\n📊 RESULTS SUMMARY:")
        print(f"   • Total Leads Processed: {len(results)}")
        print(f"   • High Quality Leads (70+ score): {high_quality} ({100*high_quality//len(results) if results else 0}%)")
        print(f"   • Leads with Email: {has_email} ({100*has_email//len(results) if results else 0}%)")
        print(f"   • Leads with Phone: {has_phone} ({100*has_phone//len(results) if results else 0}%)")
        print(f"   • Leads with LinkedIn: {has_linkedin} ({100*has_linkedin//len(results) if results else 0}%)")
        print(f"   • Decision Makers Found: {has_decision_maker} ({100*has_decision_maker//len(results) if results else 0}%)")
        print("\n" + "="*70 + "\n")
        
        # Clean up checkpoint file
        checkpoint_path = output_path.replace('.csv', '_checkpoint.csv')
        if os.path.exists(checkpoint_path):
            os.remove(checkpoint_path)
            logger.info("🧹 Checkpoint file cleaned up")
    
    except Exception as e:
        logger.error(f"❌ Failed to write output file: {e}")
        return

if __name__ == "__main__":
    main()