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
CSV_INPUT_PATH = r"c:\Users\dulra\Downloads\google-2026-01-20 (1).csv"
OUTPUT_BASE_NAME = "business_leads_with_email"

# Expected columns in input CSV
ORIGINAL_COLUMNS = [
    'place_id',
    'business_name',
    'rating',
    'reviews',
    'category',
    'address',
    'whatsapp_number',
    'website'
]
OUTPUT_COLUMNS = ORIGINAL_COLUMNS + ['email', 'instagram', 'twitter']

# Scraper settings
EMAIL_TIMEOUT = 12
MAX_RETRIES = 2
MAX_PAGES_PER_SITE = 4
MAX_WORKERS = 10
REQUEST_DELAY_MIN = 0.7
REQUEST_DELAY_MAX = 1.3

PRIORITY_PATHS = ['/contact', '/contact-us', '/about', '/team', '/info', '/support']

# Regex patterns — compiled for performance
EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
INSTAGRAM_PATTERN = re.compile(r'https?://(www\.)?instagram\.com/([A-Za-z0-9._-]{1,30})/?', re.IGNORECASE)
TWITTER_PATTERN = re.compile(r'https?://(www\.|mobile\.)?(twitter\.com|x\.com)/([A-Za-z0-9_]{1,15})/?', re.IGNORECASE)

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
                time.sleep(random.uniform(0.6, 1.0))
                continue
    return None

def scrape_emails_and_social_from_site(root_url):
    root_url = normalize_url(root_url)
    if not root_url:
        return set(), "", ""

    parsed = urlparse(root_url)
    base_domain = extract_base_domain(parsed.netloc)
    all_emails = set()
    instagram_url = ""
    twitter_url = ""
    visited = set()

    priority_urls = [urljoin(root_url, path) for path in PRIORITY_PATHS]
    urls_to_check = deque(priority_urls)
    urls_to_check.appendleft(root_url)

    while urls_to_check and len(visited) < MAX_PAGES_PER_SITE:
        url = urls_to_check.popleft()
        if url in visited:
            continue
        visited.add(url)

        soup = get_soup(url, timeout=EMAIL_TIMEOUT)
        if not soup:
            continue

        # Extract social links from all 'a' tags
        for a_tag in soup.find_all('a', href=True):
            href = a_tag['href'].strip()
            if not href:
                continue
            full_url = urljoin(root_url, href)

            # Skip non-HTTP URLs
            if not full_url.startswith(('http://', 'https://')):
                continue

            # --- Instagram: extract only valid profile URLs ---
            if not instagram_url:
                insta_match = INSTAGRAM_PATTERN.search(full_url)
                if insta_match:
                    username = insta_match.group(2).rstrip('/')
                    # Block non-profile paths (these shouldn't appear in username, but double-check)
                    if not any(bad in username for bad in ['p', 'explore', 'accounts', 'login', 'stories', 'reels', 'direct', 'directory', 'legal', 'about']):
                        if username and 2 <= len(username) <= 30 and not username.replace('.', '').replace('_', '').isdigit():
                            # Final validation: ensure no query/fragment
                            insta_clean = f"https://www.instagram.com/{username}/"
                            instagram_url = insta_clean

            # --- Twitter/X: extract only valid profile URLs ---
            if not twitter_url:
                twitter_match = TWITTER_PATTERN.search(full_url)
                if twitter_match:
                    username = twitter_match.group(3).rstrip('/')
                    # Validate username format
                    if (
                        username
                        and 1 <= len(username) <= 15
                        and username.replace('_', '').isalnum()
                        and not username.isdigit()
                        and not username.startswith('_')
                        and not username.endswith('_')
                    ):
                        twitter_clean = f"https://x.com/{username}/"
                        twitter_url = twitter_clean

        # --- Extract emails ---
        for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'noscript', 'svg', 'iframe', 'form', 'button', 'img', 'comment']):
            tag.decompose()

        text = soup.get_text(separator=' ', strip=True)
        raw_emails = set(re.findall(EMAIL_PATTERN, text))
        valid_emails = {
            e.lower() for e in raw_emails
            if is_relevant_email(e, base_domain)
        }
        all_emails.update(valid_emails)

        time.sleep(random.uniform(REQUEST_DELAY_MIN, REQUEST_DELAY_MAX))

    # Final email sanitization
    clean_emails = set()
    for e in all_emails:
        e = e.strip()
        if 5 <= len(e) <= 254 and EMAIL_PATTERN.fullmatch(e):
            clean_emails.add(e)

    return clean_emails, instagram_url, twitter_url

def process_row(row):
    business_name = row.get('business_name', 'Unknown')
    website = row.get('website', "")
    try:
        emails, instagram, twitter = scrape_emails_and_social_from_site(website)
        row['email'] = '; '.join(sorted(emails)) if emails else ""
        row['instagram'] = instagram
        row['twitter'] = twitter
    except Exception as e:
        logger.warning(f"Failed to scrape {business_name}: {str(e)[:100]}")
        row['email'] = ""
        row['instagram'] = ""
        row['twitter'] = ""
    return row

def main():
    logger.info("🚀 Starting business email & social link enrichment...")

    # Read input CSV
    try:
        with open(CSV_INPUT_PATH, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except Exception as e:
        logger.error(f"❌ Failed to read input file: {e}")
        sys.exit(1)

    # Validate columns
    missing_cols = [col for col in ORIGINAL_COLUMNS if col not in reader.fieldnames]
    if missing_cols:
        logger.error(f"❌ Missing required columns: {missing_cols}")
        sys.exit(1)

    total_leads = len(rows)
    logger.info(f"✅ Loaded {total_leads} leads. Starting scrape...")

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
                    if completed % 10 == 0 or completed == total_leads:
                        logger.info(f"✔ Progress: {completed}/{total_leads} leads done")
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

    # Restore original order using (business_name, website) as key
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
            writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(ordered_results)
        logger.info(f"💾 Output saved: {OUTPUT_FILE}")
    except PermissionError:
        logger.error(f"❌ Cannot write to {OUTPUT_FILE} — close it in Excel!")
        sys.exit(1)

    # Final stats
    with_email = sum(1 for r in ordered_results if r.get('email', '').strip())
    with_instagram = sum(1 for r in ordered_results if r.get('instagram', '').strip())
    with_twitter = sum(1 for r in ordered_results if r.get('twitter', '').strip())
    pct_email = (with_email / total_leads) * 100 if total_leads > 0 else 0
    pct_insta = (with_instagram / total_leads) * 100 if total_leads > 0 else 0
    pct_twitter = (with_twitter / total_leads) * 100 if total_leads > 0 else 0

    logger.info("\n" + "="*60)
    logger.info("✅ ENRICHMENT COMPLETE!")
    logger.info(f"Total leads          : {total_leads}")
    logger.info(f"With email           : {with_email} ({pct_email:.1f}%)")
    logger.info(f"With Instagram       : {with_instagram} ({pct_insta:.1f}%)")
    logger.info(f"With Twitter/X       : {with_twitter} ({pct_twitter:.1f}%)")
    logger.info(f"Output file          : {OUTPUT_FILE}")
    logger.info("="*60)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.warning("\n🛑 Process stopped by user. Partial results may have been saved.")
        sys.exit(0)