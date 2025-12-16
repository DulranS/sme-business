import csv
import re
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin, urldefrag
import os
import logging
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import deque

# -----------------------------
# CONFIGURATION
# -----------------------------
CSV_INPUT_PATH = "c:\\Users\\dulra\\Downloads\\google-2025-12-16 (2).csv"
CSV_OUTPUT_PATH = "business_leads_with_emails.csv"  # Output-only file
EMAIL_TIMEOUT = 8
REQUEST_DELAY = 0.8
MAX_RETRIES = 2
MAX_PAGES_PER_SITE = 10
MAX_WORKERS = 8

PRIORITY_PATHS = [
    '/contact', '/contact-us', '/contactus', '/contacts',
    '/about', '/about-us', '/team', '/staff',
    '/support', '/help', '/info', '/enquiry', '/enquiries'
]

WEBSITE_COLUMN_NAMES = {'website', 'url', 'site', 'homepage', 'domain', 'link', 'web'}
EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger()

# -----------------------------
# UTILS
# -----------------------------

def normalize_url(url):
    if not url or not isinstance(url, str):
        return None
    url = url.strip()
    if not url or url.lower() in {'n/a', 'null', 'none', '-', ''}:
        return None
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    parsed = urlparse(url)
    if not parsed.netloc:
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
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = requests.get(url, timeout=timeout, headers=headers, allow_redirects=True)
            if response.status_code == 200:
                response.encoding = response.apparent_encoding or 'utf-8'
                return BeautifulSoup(response.text, 'html.parser')
        except:
            if attempt < MAX_RETRIES:
                time.sleep(0.3)
                continue
    return None

def get_internal_links(soup, root_url, base_domain):
    links = set()
    for a in soup.find_all('a', href=True):
        href = a['href']
        href, _ = urldefrag(href)
        full_url = urljoin(root_url, href)
        if not full_url.startswith(('http://', 'https://')):
            continue
        parsed = urlparse(full_url)
        if extract_base_domain(parsed.netloc) == base_domain:
            path = parsed.path.lower()
            # Skip noisy paths
            if any(x in path for x in ('/blog', '/news', '/events', '/jobs', '/careers', '/login', '/signup', 'facebook.com', 'linkedin.com')):
                continue
            links.add(full_url)
    return links

def scrape_site_deep(root_url):
    root_url = normalize_url(root_url)
    if not root_url:
        return set()

    parsed = urlparse(root_url)
    base_domain = extract_base_domain(parsed.netloc)
    all_emails = set()
    visited = set()

    # Start with priority paths
    priority_urls = [urljoin(root_url, path) for path in PRIORITY_PATHS]
    urls_to_check = deque(priority_urls)
    urls_to_check.appendleft(root_url)  # home page first

    while urls_to_check and len(visited) < MAX_PAGES_PER_SITE:
        url = urls_to_check.popleft()
        if url in visited:
            continue
        visited.add(url)

        soup = get_soup(url, timeout=EMAIL_TIMEOUT)
        if not soup:
            continue

        # Remove noisy elements
        for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'noscript', 'svg', 'iframe', 'form']):
            tag.decompose()

        text = soup.get_text(separator=' ', strip=True)
        raw_emails = set(re.findall(EMAIL_PATTERN, text))
        valid_emails = {
            e.lower() for e in raw_emails
            if is_relevant_email(e, base_domain)
        }
        all_emails.update(valid_emails)

        # Crawl internal links if under limit
        if len(visited) < MAX_PAGES_PER_SITE:
            internal_links = get_internal_links(soup, root_url, base_domain)
            for link in internal_links:
                if link not in visited and len(urls_to_check) + len(visited) < MAX_PAGES_PER_SITE:
                    urls_to_check.append(link)

        time.sleep(REQUEST_DELAY / 2)

    # Final validation
    clean_emails = set()
    for e in all_emails:
        e = e.strip().lower()
        if 5 <= len(e) <= 254 and EMAIL_PATTERN.fullmatch(e):
            clean_emails.add(e)
    return clean_emails

def find_website_column(headers):
    for i, h in enumerate(headers):
        if not isinstance(h, str):
            continue
        clean = h.strip()
        if clean.startswith('\ufeff'):
            clean = clean[1:]
        if clean.lower() in WEBSITE_COLUMN_NAMES:
            return i
    return None

# -----------------------------
# MAIN
# -----------------------------

def process_row(row, url_col_name):
    raw_url = row.get(url_col_name, "")
    scraped_emails = scrape_site_deep(raw_url)
    row['email'] = '; '.join(sorted(scraped_emails)) if scraped_emails else ""
    return row

def main():
    logger.info("🔍 Deep email scraper (output-only mode)...")

    if not os.path.exists(CSV_INPUT_PATH):
        logger.error(f"❌ Input file not found: {CSV_INPUT_PATH}")
        sys.exit(1)

    try:
        with open(CSV_INPUT_PATH, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
            if not headers:
                logger.error("❌ CSV has no headers")
                sys.exit(1)
            rows = list(reader)
    except Exception as e:
        logger.error(f"❌ Failed to read CSV: {e}")
        sys.exit(1)

    if not rows:
        logger.error("❌ No data rows")
        sys.exit(1)

    website_col_idx = find_website_column(headers)
    if website_col_idx is None:
        logger.error(f"❌ No website column found in: {headers}")
        sys.exit(1)

    url_col = headers[website_col_idx]
    logger.info(f"✅ Using column: '{url_col}'")
    logger.info(f"🌐 Scraping {len(rows)} sites deeply...")

    # Ensure 'email' is in output headers
    output_headers = list(headers)  # preserve order
    if 'email' not in output_headers:
        output_headers.append('email')

    results = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_index = {
            executor.submit(process_row, row.copy(), url_col): i
            for i, row in enumerate(rows)
        }
        for future in as_completed(future_to_index):
            try:
                result_row = future.result()
                results.append(result_row)
                if len(results) % 10 == 0:
                    logger.info(f"✅ Completed {len(results)}/{len(rows)}")
            except Exception as e:
                idx = future_to_index[future]
                row = rows[idx]
                row['email'] = ""
                results.append(row)
                logger.warning(f"Row {idx} failed: {e}")

    # Restore original order
    url_to_row = {row.get(url_col, f"row_{i}"): row for i, row in enumerate(rows)}
    result_map = {row.get(url_col, f"row_{i}"): row for i, row in enumerate(results)}
    ordered_results = []
    for i, row in enumerate(rows):
        key = row.get(url_col, f"row_{i}")
        matched = result_map.get(key)
        if matched:
            ordered_results.append(matched)
        else:
            row['email'] = ""
            ordered_results.append(row)

    # Write output ONLY — input untouched
    try:
        with open(CSV_OUTPUT_PATH, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=output_headers)
            writer.writeheader()
            writer.writerows(ordered_results)
        logger.info(f"🎉 Done! Output saved to: {CSV_OUTPUT_PATH}")
    except PermissionError:
        logger.error(f"❌ Permission denied. Close '{CSV_OUTPUT_PATH}' if open in Excel.")
        sys.exit(1)

if __name__ == "__main__":
    main()