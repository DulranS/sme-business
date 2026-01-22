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

# -----------------------------
# CONFIGURATION
# -----------------------------
CSV_INPUT_PATH = r"c:\Users\dulra\Downloads\google (6).csv"
OUTPUT_BASE_NAME = "business_leads_with_email"

# Only website is mandatory
REQUIRED_COLUMNS = ['website']

# All possible output columns
OUTPUT_COLUMNS = [
    'place_id', 'business_name', 'rating', 'reviews', 'category', 
    'address', 'whatsapp_number', 'website', 'email', 'instagram', 'twitter',
    'linkedin_company', 'linkedin_ceo', 'linkedin_founder', 'phone_primary', 
    'email_primary', 'contact_page_found', 'social_media_score'
]

# Scraper settings
EMAIL_TIMEOUT = 10
MAX_RETRIES = 2
MAX_PAGES_PER_SITE = 6  # Increased for deeper search
MAX_WORKERS = 12  # Increased for faster processing
REQUEST_DELAY_MIN = 0.5
REQUEST_DELAY_MAX = 1.0
PRIORITY_PATHS = [
    '/contact', '/contact-us', '/about', '/about-us', '/team', 
    '/info', '/support', '/get-in-touch', '/reach-us', '/footer'
]

# Regex patterns — compiled for performance
EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
INSTAGRAM_PATTERN = re.compile(r'https?://(www\.)?instagram\.com/([A-Za-z0-9._-]{1,30})/?', re.IGNORECASE)
TWITTER_PATTERN = re.compile(r'https?://(www\.|mobile\.)?(twitter\.com|x\.com)/([A-Za-z0-9_]{1,15})/?', re.IGNORECASE)
LINKEDIN_PATTERN = re.compile(r'https?://(?:www\.)?linkedin\.com/(?:company|in)/([A-Za-z0-9-]+)/?', re.IGNORECASE)
LINKEDIN_COMPANY_PATTERN = re.compile(r'https?://(?:www\.)?linkedin\.com/company/([A-Za-z0-9-]+)/?', re.IGNORECASE)
FACEBOOK_PATTERN = re.compile(r'https?://(www\.)?(facebook\.com|fb\.com)/([A-Za-z0-9._-]+)/?', re.IGNORECASE)
YOUTUBE_PATTERN = re.compile(r'https?://(?:www\.)?youtube\.com/(?:@|channel/|user/)?([A-Za-z0-9_-]+)/?', re.IGNORECASE)
TIKTOK_PATTERN = re.compile(r'https?://(?:www\.)?tiktok\.com/@([A-Za-z0-9._-]+)/?', re.IGNORECASE)

# Enhanced phone pattern - international format aware
PHONE_PATTERN = re.compile(
    r'(?:(?:\+|00)\d{1,3}[\s.-]?)?'  # International prefix
    r'(?:\(?\d{1,4}\)?[\s.-]?)?'      # Area code
    r'\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,9}',  # Main number
    re.IGNORECASE
)

# Common phone prefixes to validate
VALID_PHONE_PREFIXES = ['+94', '+1', '+44', '+91', '+61', '+971', '+65', '+60']

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger()

# -----------------------------
# UTILS
# -----------------------------
def get_unique_output_path(base_name, extension=".csv"):
    if not os.path.exists(base_name + extension):
        return base_name + extension
    counter = 1
    while True:
        candidate = f"{base_name} ({counter}){extension}"
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
        return domain == base_domain or domain.endswith('.' + base_domain)
    except:
        return False

def clean_phone_number(phone_str):
    """Clean and validate phone number"""
    if not phone_str:
        return None
    
    # Remove common noise
    phone = re.sub(r'[^\d+\s()-]', '', phone_str)
    phone = phone.strip()
    
    # Must have at least 7 digits
    digits_only = re.sub(r'\D', '', phone)
    if len(digits_only) < 7 or len(digits_only) > 15:
        return None
    
    # Skip invalid patterns
    if re.match(r'^[01]+$', digits_only):  # All 0s or 1s
        return None
    if len(set(digits_only)) == 1:  # All same digit
        return None
    
    # Standardize format
    phone = re.sub(r'\s+', ' ', phone)
    phone = re.sub(r'[()]', '', phone)
    
    return phone

def extract_phone_numbers(text):
    """Extract and validate phone numbers from text"""
    phones = set()
    
    # Find all potential phone numbers
    matches = PHONE_PATTERN.findall(text)
    
    for match in matches:
        cleaned = clean_phone_number(match)
        if cleaned:
            phones.add(cleaned)
    
    # Also look for tel: links
    tel_pattern = re.compile(r'tel:([+\d\s()-]+)', re.IGNORECASE)
    tel_matches = tel_pattern.findall(text)
    for tel in tel_matches:
        cleaned = clean_phone_number(tel)
        if cleaned:
            phones.add(cleaned)
    
    return phones

def extract_linkedin_profiles(soup, text, base_domain):
    """Extract LinkedIn company and personal profiles"""
    linkedin_company = ""
    linkedin_ceo = ""
    linkedin_founder = ""
    
    # Look for LinkedIn links in all href attributes
    for a_tag in soup.find_all('a', href=True):
        href = a_tag.get('href', '').lower()
        
        # LinkedIn company profile
        if not linkedin_company and 'linkedin.com/company' in href:
            company_match = LINKEDIN_COMPANY_PATTERN.search(href)
            if company_match:
                company_id = company_match.group(1)
                if company_id and len(company_id) > 1 and not company_id.isdigit():
                    linkedin_company = f"https://www.linkedin.com/company/{company_id}/"
        
        # LinkedIn personal profiles (CEO, founder mentions in context)
        if 'linkedin.com/in' in href:
            person_match = re.search(r'linkedin\.com/in/([A-Za-z0-9-]+)', href)
            if person_match:
                profile_id = person_match.group(1)
                if profile_id and len(profile_id) > 2:
                    # Try to determine if it's CEO/Founder from anchor text or surrounding text
                    anchor_text = a_tag.get_text(strip=True).lower()
                    if 'ceo' in anchor_text or 'chief executive' in anchor_text:
                        if not linkedin_ceo:
                            linkedin_ceo = f"https://www.linkedin.com/in/{profile_id}/"
                    elif 'founder' in anchor_text or 'co-founder' in anchor_text:
                        if not linkedin_founder:
                            linkedin_founder = f"https://www.linkedin.com/in/{profile_id}/"
    
    return linkedin_company, linkedin_ceo, linkedin_founder

def extract_social_profiles(soup):
    """Extract all social media profiles for enhanced business intelligence"""
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
        
        # Facebook
        if not profiles['facebook'] and 'facebook.com' in href:
            fb_match = FACEBOOK_PATTERN.search(href)
            if fb_match:
                fb_handle = fb_match.group(3)
                if fb_handle and len(fb_handle) > 2:
                    profiles['facebook'] = f"https://www.facebook.com/{fb_handle}/"
        
        # YouTube
        if not profiles['youtube'] and 'youtube.com' in href:
            yt_match = YOUTUBE_PATTERN.search(href)
            if yt_match:
                yt_handle = yt_match.group(1)
                if yt_handle and len(yt_handle) > 2:
                    profiles['youtube'] = f"https://www.youtube.com/@{yt_handle}/"
        
        # TikTok
        if not profiles['tiktok'] and 'tiktok.com' in href:
            tt_match = TIKTOK_PATTERN.search(href)
            if tt_match:
                tt_handle = tt_match.group(1)
                if tt_handle and len(tt_handle) > 2:
                    profiles['tiktok'] = f"https://www.tiktok.com/@{tt_handle}/"
        
        # LinkedIn Company - look for both /company/ and /organizations/
        if not profiles['linkedin_company'] and 'linkedin.com' in href:
            # Try company URL
            li_company_match = LINKEDIN_COMPANY_PATTERN.search(href)
            if li_company_match:
                company_id = li_company_match.group(1)
                if company_id and len(company_id) > 1 and not company_id.isdigit():
                    profiles['linkedin_company'] = f"https://www.linkedin.com/company/{company_id}/"
            # Also try generic linkedin.com/company-name pattern
            elif 'linkedin.com' in href and '/company/' in href.lower():
                company_match = re.search(r'linkedin\.com/company/([A-Za-z0-9-]+)', href)
                if company_match:
                    company_id = company_match.group(1)
                    if company_id and len(company_id) > 1:
                        profiles['linkedin_company'] = f"https://www.linkedin.com/company/{company_id}/"
        
        # LinkedIn Personal (CEO/Founder)
        if 'linkedin.com/in' in href:
            li_personal_match = re.search(r'linkedin\.com/in/([A-Za-z0-9-]+)', href)
            if li_personal_match:
                profile_id = li_personal_match.group(1)
                if profile_id and len(profile_id) > 2:
                    if 'ceo' in anchor_text or 'chief executive' in anchor_text or 'executive officer' in anchor_text:
                        if not profiles['linkedin_ceo']:
                            profiles['linkedin_ceo'] = f"https://www.linkedin.com/in/{profile_id}/"
                    elif 'founder' in anchor_text or 'co-founder' in anchor_text or 'cofounder' in anchor_text:
                        if not profiles['linkedin_founder']:
                            profiles['linkedin_founder'] = f"https://www.linkedin.com/in/{profile_id}/"
    
    # Additional search in page text for LinkedIn patterns (fallback)
    if not profiles['linkedin_company']:
        linkedin_urls_in_text = re.findall(r'https?://(?:www\.)?linkedin\.com/company/([A-Za-z0-9-]+)', text)
        if linkedin_urls_in_text:
            company_id = linkedin_urls_in_text[0]
            if company_id and len(company_id) > 1:
                profiles['linkedin_company'] = f"https://www.linkedin.com/company/{company_id}/"
    
    if not profiles['linkedin_ceo']:
        linkedin_personal_urls = re.findall(r'https?://(?:www\.)?linkedin\.com/in/([A-Za-z0-9-]+)', text)
        if linkedin_personal_urls:
            profile_id = linkedin_personal_urls[0]
            if profile_id and len(profile_id) > 2:
                profiles['linkedin_ceo'] = f"https://www.linkedin.com/in/{profile_id}/"
    
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
                time.sleep(random.uniform(0.4, 0.8))
                continue
    return None

def scrape_all_data_from_site(root_url, existing_phone=""):
    """Scrape emails, phone numbers, and social media links"""
    root_url = normalize_url(root_url)
    if not root_url:
        return set(), set(), "", "", "", "", "", {}, False, 0
    
    parsed = urlparse(root_url)
    base_domain = extract_base_domain(parsed.netloc)
    
    all_emails = set()
    all_phones = set()
    instagram_url = ""
    twitter_url = ""
    linkedin_company = ""
    linkedin_ceo = ""
    linkedin_founder = ""
    social_profiles = {}
    contact_page_found = False
    social_media_score = 0
    
    # Add existing phone to search results if valid
    if existing_phone and isinstance(existing_phone, str):
        cleaned = clean_phone_number(existing_phone)
        if cleaned:
            all_phones.add(cleaned)
    
    visited = set()
    
    # Priority URLs to check first
    priority_urls = [urljoin(root_url, path) for path in PRIORITY_PATHS]
    urls_to_check = deque(priority_urls)
    urls_to_check.appendleft(root_url)
    
    pages_scraped = 0
    
    while urls_to_check and pages_scraped < MAX_PAGES_PER_SITE:
        url = urls_to_check.popleft()
        if url in visited:
            continue
        
        visited.add(url)
        pages_scraped += 1
        
        # Check if we're on a contact page
        if any(keyword in url.lower() for keyword in ['/contact', '/contact-us', '/get-in-touch']):
            contact_page_found = True
        
        soup = get_soup(url, timeout=EMAIL_TIMEOUT)
        if not soup:
            continue
        
        # Extract social profiles
        current_profiles = extract_social_profiles(soup)
        for key, val in current_profiles.items():
            if val and not social_profiles.get(key):
                social_profiles[key] = val
        
        # Update primary LinkedIn info
        if current_profiles.get('linkedin_company') and not linkedin_company:
            linkedin_company = current_profiles['linkedin_company']
        if current_profiles.get('linkedin_ceo') and not linkedin_ceo:
            linkedin_ceo = current_profiles['linkedin_ceo']
        if current_profiles.get('linkedin_founder') and not linkedin_founder:
            linkedin_founder = current_profiles['linkedin_founder']
        
        # Extract social links and other data
        for a_tag in soup.find_all('a', href=True):
            href = a_tag['href'].strip()
            if not href:
                continue
            
            full_url = urljoin(root_url, href)
            
            if not full_url.startswith(('http://', 'https://')):
                continue
            
            # Instagram
            if not instagram_url:
                insta_match = INSTAGRAM_PATTERN.search(full_url)
                if insta_match:
                    username = insta_match.group(2).rstrip('/')
                    if not any(bad in username for bad in ['p', 'explore', 'accounts', 'login', 'stories', 'reels', 'direct', 'directory', 'legal', 'about']):
                        if username and 2 <= len(username) <= 30 and not username.replace('.', '').replace('_', '').isdigit():
                            instagram_url = f"https://www.instagram.com/{username}/"
            
            # Twitter/X
            if not twitter_url:
                twitter_match = TWITTER_PATTERN.search(full_url)
                if twitter_match:
                    username = twitter_match.group(3).rstrip('/')
                    if (username and 1 <= len(username) <= 15 and 
                        username.replace('_', '').isalnum() and 
                        not username.isdigit() and 
                        not username.startswith('_') and 
                        not username.endswith('_')):
                        twitter_url = f"https://x.com/{username}/"
            
            # Add internal links to queue for deeper search
            if urlparse(full_url).netloc == parsed.netloc and len(visited) < MAX_PAGES_PER_SITE:
                if full_url not in visited and full_url not in urls_to_check:
                    # Prioritize contact-related pages
                    if any(keyword in full_url.lower() for keyword in ['contact', 'about', 'team', 'support', 'linkedin']):
                        urls_to_check.appendleft(full_url)
                    else:
                        urls_to_check.append(full_url)
        
        # Remove unwanted tags
        for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'noscript', 'svg', 'iframe', 'form', 'button', 'img', 'comment']):
            tag.decompose()
        
        # Get full HTML for phone extraction (before text conversion)
        html_text = str(soup)
        page_phones = extract_phone_numbers(html_text)
        all_phones.update(page_phones)
        
        # Get text for email extraction
        text = soup.get_text(separator=' ', strip=True)
        
        # Extract emails
        raw_emails = set(re.findall(EMAIL_PATTERN, text))
        valid_emails = {
            e.lower() for e in raw_emails 
            if is_relevant_email(e, base_domain)
        }
        all_emails.update(valid_emails)
        
        # Also extract phones from text
        text_phones = extract_phone_numbers(text)
        all_phones.update(text_phones)
        
        time.sleep(random.uniform(REQUEST_DELAY_MIN, REQUEST_DELAY_MAX))
    
    # Calculate social media score
    social_media_score = sum([1 for val in [instagram_url, twitter_url, linkedin_company, 
                                            social_profiles.get('facebook'), social_profiles.get('youtube'),
                                            social_profiles.get('tiktok')] if val])
    
    # Final email sanitization
    clean_emails = set()
    for e in all_emails:
        e = e.strip()
        if 5 <= len(e) <= 254 and EMAIL_PATTERN.fullmatch(e):
            clean_emails.add(e)
    
    return clean_emails, all_phones, instagram_url, twitter_url, linkedin_company, linkedin_ceo, linkedin_founder, social_profiles, contact_page_found, social_media_score

def process_row(row):
    """Process a single row from CSV"""
    business_name = row.get('business_name', 'Unknown')
    website = row.get('website', "")
    existing_phone = row.get('whatsapp_number', "")
    
    try:
        emails, phones, instagram, twitter, linkedin_company, linkedin_ceo, linkedin_founder, social_profiles, contact_page_found, social_score = scrape_all_data_from_site(website, existing_phone)
        
        # Primary contacts (best quality)
        primary_email = ""
        primary_phone = ""
        
        if emails:
            sorted_emails = sorted(emails)
            # Prefer admin, info, contact, support emails
            priority_keywords = ['contact', 'info', 'support', 'sales', 'admin', 'hello', 'hi']
            for priority_keyword in priority_keywords:
                for email in sorted_emails:
                    if priority_keyword in email:
                        primary_email = email
                        break
                if primary_email:
                    break
            # Fallback to first email
            if not primary_email:
                primary_email = sorted_emails[0]
        
        if phones:
            sorted_phones = sorted(phones, key=lambda p: (not p.startswith('+'), len(p), p))
            primary_phone = sorted_phones[0]
        
        # Fill output fields
        row['email'] = '; '.join(sorted(emails)) if emails else ""
        row['email_primary'] = primary_email
        row['instagram'] = instagram
        row['twitter'] = twitter
        row['linkedin_company'] = linkedin_company
        row['linkedin_ceo'] = linkedin_ceo
        row['linkedin_founder'] = linkedin_founder
        row['contact_page_found'] = "Yes" if contact_page_found else "No"
        row['social_media_score'] = str(social_score)
        
        # Update phone if we found new ones
        if phones:
            sorted_phones = sorted(phones, key=lambda p: (not p.startswith('+'), p))
            row['whatsapp_number'] = '; '.join(sorted_phones)
            row['phone_primary'] = primary_phone
        elif existing_phone:
            row['phone_primary'] = existing_phone
        else:
            row['whatsapp_number'] = ""
            row['phone_primary'] = ""
            
    except Exception as e:
        logger.warning(f"Failed to scrape {business_name}: {str(e)[:100]}")
        row['email'] = ""
        row['email_primary'] = ""
        row['instagram'] = ""
        row['twitter'] = ""
        row['linkedin_company'] = ""
        row['linkedin_ceo'] = ""
        row['linkedin_founder'] = ""
        row['contact_page_found'] = "No"
        row['social_media_score'] = "0"
        if not existing_phone:
            row['whatsapp_number'] = ""
            row['phone_primary'] = ""
        else:
            row['phone_primary'] = existing_phone
    
    return row

def main():
    logger.info("🚀 Starting business email, phone & social link enrichment...")
    
    # Read input CSV
    try:
        with open(CSV_INPUT_PATH, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            input_columns = reader.fieldnames
    except Exception as e:
        logger.error(f"❌ Failed to read input file: {e}")
        sys.exit(1)
    
    # Validate only required columns
    missing_cols = [col for col in REQUIRED_COLUMNS if col not in input_columns]
    if missing_cols:
        logger.error(f"❌ Missing required column(s): {missing_cols}")
        sys.exit(1)
    
    # Build output columns based on what exists in input + all new enrichment fields
    dynamic_output_cols = []
    for col in OUTPUT_COLUMNS:
        if col in input_columns:
            dynamic_output_cols.append(col)
    
    # Always add enrichment fields regardless of whether they're in input
    enrichment_fields = [
        'email', 'email_primary', 'instagram', 'twitter', 
        'linkedin_company', 'linkedin_ceo', 'linkedin_founder',
        'phone_primary', 'contact_page_found', 'social_media_score'
    ]
    for new_field in enrichment_fields:
        if new_field not in dynamic_output_cols:
            dynamic_output_cols.append(new_field)
    
    total_leads = len(rows)
    logger.info(f"✅ Loaded {total_leads} leads. Starting deep scrape...")
    
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
                    
                    if completed % 5 == 0 or completed == total_leads:
                        logger.info(f"✔ Progress: {completed}/{total_leads} leads processed")
                        
                except Exception as e:
                    row = future_to_row[future]
                    row.update({'email': '', 'instagram': '', 'twitter': ''})
                    results.append(row)
                    logger.error(f"Row failed: {e}")
                    
    except KeyboardInterrupt:
        logger.warning("⚠️ Script interrupted by user. Saving partial results...")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)
    
    # Restore original order
    key_to_result = {}
    for r in results:
        key = (r.get('business_name', ''), r.get('website', ''))
        key_to_result[key] = r
    
    ordered_results = []
    for row in rows:
        key = (row.get('business_name', ''), row.get('website', ''))
        if key in key_to_result:
            ordered_results.append(key_to_result[key])
        else:
            fallback = row.copy()
            fallback.update({'email': '', 'instagram': '', 'twitter': ''})
            ordered_results.append(fallback)
    
    # Save output
    OUTPUT_FILE = get_unique_output_path(OUTPUT_BASE_NAME)
    try:
        with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=dynamic_output_cols, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(ordered_results)
        logger.info(f"💾 Output saved: {OUTPUT_FILE}")
    except PermissionError:
        logger.error(f"❌ Cannot write to {OUTPUT_FILE} — close it in Excel!")
        sys.exit(1)
    
    # Final stats
    with_email = sum(1 for r in ordered_results if r.get('email', '').strip())
    with_phone = sum(1 for r in ordered_results if r.get('whatsapp_number', '').strip())
    with_instagram = sum(1 for r in ordered_results if r.get('instagram', '').strip())
    with_twitter = sum(1 for r in ordered_results if r.get('twitter', '').strip())
    with_linkedin_company = sum(1 for r in ordered_results if r.get('linkedin_company', '').strip())
    with_linkedin_ceo = sum(1 for r in ordered_results if r.get('linkedin_ceo', '').strip())
    with_linkedin_founder = sum(1 for r in ordered_results if r.get('linkedin_founder', '').strip())
    with_contact_page = sum(1 for r in ordered_results if r.get('contact_page_found', '').strip() == 'Yes')
    avg_social_score = sum(int(r.get('social_media_score', '0') or '0') for r in ordered_results) / total_leads if total_leads > 0 else 0
    
    pct_email = (with_email / total_leads) * 100 if total_leads > 0 else 0
    pct_phone = (with_phone / total_leads) * 100 if total_leads > 0 else 0
    pct_insta = (with_instagram / total_leads) * 100 if total_leads > 0 else 0
    pct_twitter = (with_twitter / total_leads) * 100 if total_leads > 0 else 0
    pct_linkedin = (with_linkedin_company / total_leads) * 100 if total_leads > 0 else 0
    pct_contact = (with_contact_page / total_leads) * 100 if total_leads > 0 else 0
    
    logger.info("\n" + "="*60)
    logger.info("✅ ENRICHMENT COMPLETE!")
    logger.info(f"Total leads          : {total_leads}")
    logger.info(f"With email           : {with_email} ({pct_email:.1f}%)")
    logger.info(f"With phone           : {with_phone} ({pct_phone:.1f}%)")
    logger.info(f"With LinkedIn Company: {with_linkedin_company} ({pct_linkedin:.1f}%)")
    logger.info(f"With LinkedIn CEO    : {with_linkedin_ceo} profiles found")
    logger.info(f"With LinkedIn Founder: {with_linkedin_founder} profiles found")
    logger.info(f"With Instagram       : {with_instagram} ({pct_insta:.1f}%)")
    logger.info(f"With Twitter/X       : {with_twitter} ({pct_twitter:.1f}%)")
    logger.info(f"Contact page found   : {with_contact_page} ({pct_contact:.1f}%)")
    logger.info(f"Avg social score     : {avg_social_score:.1f}/6")
    logger.info(f"Output file          : {OUTPUT_FILE}")
    logger.info("="*60)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.warning("\n🛑 Process stopped by user. Partial results may have been saved.")
        sys.exit(0)