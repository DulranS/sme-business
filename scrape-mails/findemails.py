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
# CONFIGURATION — MATCHES YOUR CSV EXACTLY
# -----------------------------
CSV_INPUT_PATH = r"c:\Users\dulra\Downloads\google-2025-12-18 (1).csv"

# Auto-numbered output base name
OUTPUT_BASE_NAME = "business_leads_with_email"

# Preserve original column order + add 'email' at the end
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

# Scraper settings
EMAIL_TIMEOUT = 10
MAX_RETRIES = 2
MAX_PAGES_PER_SITE = 5
MAX_WORKERS = 10
REQUEST_DELAY_MIN = 0.8
REQUEST_DELAY_MAX = 1.4

PRIORITY_PATHS = ['/contact', '/contact-us', '/about', '/team', '/info', '/support']
EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger()

# -----------------------------
# UTILS
# -----------------------------

def get_unique_output_path(base_name, extension=".csv"):
    """Generates business_leads_with_email.csv, (1).csv, (2).csv, etc."""
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
    if 'google.com/aclk' in url or 'google.com/maps' in url or 'gclid=' in url:
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
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = requests.get(url, timeout=timeout, headers=headers, allow_redirects=True)
            if response.status_code == 200:
                return BeautifulSoup(response.text, 'html.parser')
        except:
            if attempt < MAX_RETRIES:
                time.sleep(0.8)
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

        for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'noscript', 'svg', 'iframe', 'form', 'button', 'img']):
            tag.decompose()

        text = soup.get_text(separator=' ', strip=True)
        raw_emails = set(re.findall(EMAIL_PATTERN, text))
        valid_emails = {
            e.lower() for e in raw_emails
            if is_relevant_email(e, base_domain)
        }
        all_emails.update(valid_emails)

        time.sleep(random.uniform(REQUEST_DELAY_MIN, REQUEST_DELAY_MAX))

    clean = set()
    for e in all_emails:
        e = e.strip()
        if 5 <= len(e) <= 254 and EMAIL_PATTERN.fullmatch(e):
            clean.add(e)
    return clean

def process_row(row):
    website = row.get('website', "")
    emails = scrape_emails_from_site(website)
    row['email'] = '; '.join(sorted(emails)) if emails else ""
    return row

def main():
    logger.info("🔍 Reading input CSV...")

    with open(CSV_INPUT_PATH, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    for col in ORIGINAL_COLUMNS:
        if col not in reader.fieldnames:
            logger.error(f"❌ Missing expected column: {col}")
            sys.exit(1)

    logger.info(f"✅ Found {len(rows)} leads. Scraping emails...")

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
                logger.warning(f"Failed to scrape: {e}")

    key_to_result = {}
    for r in results:
        key = (r['business_name'], r['website'])
        key_to_result[key] = r

    ordered_results = []
    for row in rows:
        key = (row['business_name'], row['website'])
        ordered_results.append(key_to_result.get(key, {**row, 'email': ''}))

    # ✅ AUTO-NUMBERED OUTPUT FILE
    OUTPUT_FILE = get_unique_output_path(OUTPUT_BASE_NAME)

    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(ordered_results)

    total = len(ordered_results)
    with_email = sum(1 for r in ordered_results if r.get('email', '').strip())
    pct = (with_email / total) * 100 if total > 0 else 0

    logger.info("\n" + "="*50)
    logger.info("✅ DONE!")
    logger.info(f"Total leads: {total}")
    logger.info(f"Leads with email: {with_email} ({pct:.1f}%)")
    logger.info(f"📁 Output saved to: {OUTPUT_FILE}")
    logger.info("="*50)

if __name__ == "__main__":
    main()