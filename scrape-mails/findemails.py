import csv
import re
import time
import random
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin, urldefrag
import os
import logging
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import deque

# -----------------------------
# CONFIGURATION — TAILORED TO YOUR CSV
# -----------------------------
CSV_INPUT_PATH = r"c:\Users\dulra\Downloads\google-2025-12-18 (2).csv"
OUTPUT_BASE_NAME = "business_leads_with_email"

# Expected columns (order preserved)
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
OUTPUT_COLUMNS = ORIGINAL_COLUMNS + ['email']

# Scraper tuning
EMAIL_TIMEOUT = 12
MAX_RETRIES = 2
MAX_PAGES_PER_SITE = 4
MAX_WORKERS = 12
REQUEST_DELAY_MIN = 0.7
REQUEST_DELAY_MAX = 1.3

PRIORITY_PATHS = ['/contact', '/contact-us', '/about', '/team', '/info', '/support']
EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
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
    # Skip Google tracking URLs
    if any(x in url for x in ['google.com/aclk', 'google.com/maps', 'gclid=']):
        return None
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    parsed = urlparse(url)
    if not parsed.netloc or 'google.com' in parsed.netloc:
        return None
    return url.rstrip('/')

def extract_base_domain(netloc):
    netloc = netloc.lower().replace('www.', '').split(':')[0]
    parts = netloc.split('.')
    return '.'.join(parts[-2:]) if len(parts) >= 2 else netloc

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
        except Exception as e:
            if attempt < MAX_RETRIES:
                time.sleep(random.uniform(0.6, 1.0))
                continue
    return None

def scrape_emails_from_site(root_url):
    root_url = normalize_url(root_url)
    if not root_url:
        return set()

    parsed = urlparse(root_url)
    base_domain = extract_base_domain(parsed.netloc)
    all_emails = set()
    visited = set()

    # Build priority queue: home + key pages
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

        # Remove noisy elements
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

    # Final validation
    clean_emails = set()
    for e in all_emails:
        e = e.strip()
        if 5 <= len(e) <= 254 and EMAIL_PATTERN.fullmatch(e):
            clean_emails.add(e)
    return clean_emails

def process_row(row):
    business_name = row.get('business_name', 'Unknown')
    website = row.get('website', "")
    logger.info(f"Scraping: {business_name}")
    try:
        emails = scrape_emails_from_site(website)
        row['email'] = '; '.join(sorted(emails)) if emails else ""
    except Exception as e:
        logger.warning(f"Error scraping {business_name}: {e}")
        row['email'] = ""
    return row

def main():
    logger.info("🚀 Starting email enrichment...")

    # Read input
    try:
        with open(CSV_INPUT_PATH, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except Exception as e:
        logger.error(f"❌ Failed to read CSV: {e}")
        sys.exit(1)

    # Validate columns
    missing = [col for col in ORIGINAL_COLUMNS if col not in reader.fieldnames]
    if missing:
        logger.error(f"❌ Missing columns: {missing}")
        sys.exit(1)

    logger.info(f"✅ Loaded {len(rows)} leads. Beginning email scrape...")

    # Process in parallel
    results = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_row = {executor.submit(process_row, row.copy()): row for row in rows}
        for future in as_completed(future_to_row):
            try:
                results.append(future.result())
            except Exception as e:
                row = future_to_row[future]
                row['email'] = ""
                results.append(row)
                logger.error(f"Row processing failed: {e}")

    # Restore original order
    key_map = {(row['business_name'], row['website']): row for row in rows}
    result_map = {(row['business_name'], row['website']): row for row in results}
    ordered_results = []
    for key in [(r['business_name'], r['website']) for r in rows]:
        ordered_results.append(result_map.get(key, {**key_map[key], 'email': ''}))

    # Generate unique output path
    OUTPUT_FILE = get_unique_output_path(OUTPUT_BASE_NAME)

    # Write output
    try:
        with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(ordered_results)
    except PermissionError:
        logger.error(f"❌ Cannot write to {OUTPUT_FILE} — close it in Excel!")
        sys.exit(1)

    # Final stats
    total = len(ordered_results)
    with_email = sum(1 for r in ordered_results if r.get('email', '').strip())
    pct = (with_email / total) * 100 if total > 0 else 0

    logger.info("\n" + "="*60)
    logger.info("✅ ENRICHMENT COMPLETE!")
    logger.info(f"Total leads processed       : {total}")
    logger.info(f"Leads with valid email      : {with_email} ({pct:.1f}%)")
    logger.info(f"Output file                 : {OUTPUT_FILE}")
    logger.info("="*60)

if __name__ == "__main__":
    main()