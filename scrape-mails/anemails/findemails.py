#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🔍 HIGH-VALUE BUSINESS EMAIL EXTRACTOR
Purpose: Enrich lead lists with verified, domain-matching business emails.
Ideal for Sales, Marketing, BD teams.

✅ Strategic Value:
- Replace manual prospecting
- Improve outbound email deliverability (only real, relevant emails)
- Reduce bounce rates
- Target decision-makers via contextual pages (About, Team, Contact)

⚠️ Use ethically. Respect robots.txt. Don’t spam.
"""

import csv
import re
import time
import logging
import sys
import os
import random
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError
from collections import deque
from urllib.parse import urlparse, urljoin, urldefrag
from urllib.robotparser import RobotFileParser
import requests
from bs4 import BeautifulSoup

# -----------------------------
# 🔐 CONFIGURATION (TUNE FOR YOUR NEEDS)
# -----------------------------
CSV_INPUT_PATH = r"c:\Users\dulra\Downloads\google-2025-12-16 (5).csv"
CSV_OUTPUT_PATH = "business_leads_enriched_emails.csv"

# Performance & Safety
MAX_WORKERS = 6                # Reduce if getting blocked (start with 4–6)
MAX_PAGES_PER_SITE = 8         # Balance depth vs speed
MAX_TIME_PER_SITE = 25         # Hard timeout per domain (seconds)
REQUEST_DELAY_RANGE = (0.7, 1.3)  # Randomized delay to appear human
EMAIL_TIMEOUT = 10             # Per HTTP request timeout
MAX_RETRIES = 2

# Targeting Logic
PRIORITY_PATHS = [
    '/contact', '/contact-us', '/contactus', '/contacts',
    '/about', '/about-us', '/team', '/staff', '/leadership',
    '/support', '/help', '/info', '/enquiry', '/enquiries',
    '/founders', '/ceo', '/management'
]

# Column detection (case-insensitive)
WEBSITE_COLUMN_NAMES = {'website', 'url', 'site', 'homepage', 'domain', 'link', 'web', 'company_url'}

# Email validation
EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
DISPOSABLE_DOMAINS = {
    'mailinator.com', 'guerrillamail.com', 'tempmail.org', '10minutemail.com',
    'throwaway.email', 'yopmail.com', 'temp-mail.org', 'sharklasers.com'
}

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger()

# -----------------------------
# 🛠️ UTILITIES
# -----------------------------

def normalize_url(url):
    """Clean and standardize URL for processing."""
    if not url or not isinstance(url, str):
        return None
    url = url.strip()
    if not url or url.lower() in {'n/a', 'null', 'none', '-', '', 'http://', 'https://'}:
        return None
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    parsed = urlparse(url)
    if not parsed.netloc:
        return None
    # Remove fragments and standardize
    clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    return clean_url.rstrip('/').lower()

def extract_base_domain(netloc):
    """Extract root domain (e.g., 'example.com' from 'www.sub.example.com')."""
    netloc = netloc.lower().replace('www.', '').split(':')[0]
    parts = netloc.split('.')
    if len(parts) >= 2:
        return '.'.join(parts[-2:])
    return netloc

def is_disposable_email(email):
    """Filter out temporary/disposable email services."""
    try:
        domain = email.split('@')[1].lower()
        return domain in DISPOSABLE_DOMAINS
    except:
        return True

def is_relevant_email(email, base_domain):
    """Check if email belongs to the target company."""
    if not email or '@' not in email:
        return False
    if is_disposable_email(email):
        return False
    try:
        local, domain = email.rsplit('@', 1)
        domain = domain.lower().strip()
        base_domain = base_domain.lower()
        # Exact match or subdomain (e.g., info@sales.example.com for example.com)
        return domain == base_domain or domain.endswith('.' + base_domain)
    except Exception:
        return False

def can_fetch_robots(url):
    """Check robots.txt (basic, non-blocking)."""
    try:
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        response = requests.get(robots_url, timeout=5)
        if response.status_code == 200:
            rp = RobotFileParser()
            rp.parse(response.text.splitlines())
            return rp.can_fetch('*', url)
        return True  # If no robots.txt, assume allowed
    except:
        return True  # On error, assume allowed (conservative)

def get_soup(url, timeout=EMAIL_TIMEOUT):
    """Fetch and parse HTML with retry logic."""
    headers = {
        'User-Agent': random.choice([
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        ]),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
    }
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = requests.get(url, timeout=timeout, headers=headers, allow_redirects=True)
            if response.status_code == 200:
                response.encoding = response.apparent_encoding or 'utf-8'
                return BeautifulSoup(response.text, 'html.parser')
        except Exception as e:
            if attempt < MAX_RETRIES:
                time.sleep(random.uniform(0.5, 1.2))
                continue
    return None

def get_internal_links(soup, root_url, base_domain):
    """Extract clean, relevant internal links."""
    links = set()
    for a_tag in soup.find_all('a', href=True):
        href = a_tag['href']
        href, _ = urldefrag(href)
        full_url = urljoin(root_url, href)
        if not full_url.startswith(('http://', 'https://')):
            continue
        parsed = urlparse(full_url)
        link_base = extract_base_domain(parsed.netloc)
        if link_base != base_domain:
            continue
        path = parsed.path.lower()
        # Skip noisy or irrelevant paths
        noisy = any(noise in path for noise in [
            '/blog', '/news', '/events', '/jobs', '/careers', '/job', '/career',
            '/login', '/signup', '/register', '/admin', '/wp-', '/cdn-cgi/',
            'facebook.com', 'linkedin.com', 'twitter.com', 'instagram.com'
        ])
        if noisy:
            continue
        # Skip overly long or parameter-heavy URLs
        if len(path) > 50 or '?' in full_url or '#' in full_url:
            continue
        links.add(full_url)
    return links

def scrape_site_deep(root_url):
    """Scrape up to MAX_PAGES_PER_SITE for relevant emails."""
    root_url = normalize_url(root_url)
    if not root_url:
        return set()

    # Respect robots.txt (optional – comment out if speed critical)
    # if not can_fetch_robots(root_url):
    #     logger.debug(f"⚠️ Blocked by robots.txt: {root_url}")
    #     return set()

    parsed = urlparse(root_url)
    base_domain = extract_base_domain(parsed.netloc)
    all_emails = set()
    visited = set()
    urls_to_check = deque()

    # Priority: home + key pages first
    priority_urls = [urljoin(root_url, path) for path in PRIORITY_PATHS]
    urls_to_check.append(root_url)
    urls_to_check.extend(priority_urls)

    while urls_to_check and len(visited) < MAX_PAGES_PER_SITE:
        url = urls_to_check.popleft()
        if url in visited:
            continue
        visited.add(url)

        soup = get_soup(url, timeout=EMAIL_TIMEOUT)
        if not soup:
            continue

        # Remove noisy HTML elements
        for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'noscript', 'svg', 'iframe', 'form', 'button']):
            tag.decompose()

        # Extract emails from visible text
        text = soup.get_text(separator=' ', strip=True)
        raw_emails = set(re.findall(EMAIL_PATTERN, text))
        valid_emails = {
            e.lower() for e in raw_emails
            if is_relevant_email(e, base_domain)
        }
        all_emails.update(valid_emails)

        # Crawl internal links only if under page limit
        if len(visited) < MAX_PAGES_PER_SITE:
            internal_links = get_internal_links(soup, root_url, base_domain)
            for link in internal_links:
                if link not in visited and len(visited) + len(urls_to_check) < MAX_PAGES_PER_SITE:
                    urls_to_check.append(link)

        # Human-like delay
        time.sleep(random.uniform(*REQUEST_DELAY_RANGE))

    # Final cleanup
    clean_emails = set()
    for e in all_emails:
        e = e.strip().lower()
        if 5 <= len(e) <= 254 and EMAIL_PATTERN.fullmatch(e) and not is_disposable_email(e):
            clean_emails.add(e)
    return clean_emails

def find_website_column(headers):
    """Auto-detect website column in CSV."""
    for i, h in enumerate(headers):
        if not isinstance(h, str):
            continue
        clean = h.strip().lower().replace('\ufeff', '')
        if clean in WEBSITE_COLUMN_NAMES:
            return i
    return None

# -----------------------------
# 🚀 MAIN PROCESSING
# -----------------------------

def process_row(row, url_key):
    """Process a single row – called in thread pool."""
    raw_url = row.get(url_key, "")
    if not raw_url:
        return {**row, 'email': ""}
    emails = scrape_site_deep(raw_url)
    return {**row, 'email': '; '.join(sorted(emails)) if emails else ""}

def main():
    logger.info("🚀 Starting Strategic Business Email Enrichment...")
    logger.info(f"📁 Input: {CSV_INPUT_PATH}")
    logger.info(f"📤 Output: {CSV_OUTPUT_PATH}")

    if not os.path.exists(CSV_INPUT_PATH):
        logger.error(f"❌ Input file not found: {CSV_INPUT_PATH}")
        sys.exit(1)

    # Read input CSV
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
        logger.error("❌ No data rows found")
        sys.exit(1)

    # Detect website column
    website_col_idx = find_website_column(headers)
    if website_col_idx is None:
        logger.error(f"❌ No website column found. Checked: {headers}")
        sys.exit(1)

    url_col = headers[website_col_idx]
    logger.info(f"✅ Using URL column: '{url_col}'")
    logger.info(f"📊 Processing {len(rows)} companies with {MAX_WORKERS} parallel workers...")

    # Ensure output includes 'email'
    output_headers = list(headers)
    if 'email' not in output_headers:
        output_headers.append('email')

    # Process with timeout per site
    results = [None] * len(rows)
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_index = {
            executor.submit(process_row, row, url_col): i
            for i, row in enumerate(rows)
        }

        completed = 0
        for future in as_completed(future_to_index):
            idx = future_to_index[future]
            try:
                result = future.result(timeout=MAX_TIME_PER_SITE)
                results[idx] = result
                completed += 1
                if completed % 10 == 0 or completed == len(rows):
                    logger.info(f"✅ Progress: {completed}/{len(rows)} sites done")
            except TimeoutError:
                logger.warning(f"⏱️ Timeout on row {idx} (>{MAX_TIME_PER_SITE}s). Skipping.")
                results[idx] = {**rows[idx], 'email': ""}
            except Exception as e:
                logger.warning(f"💥 Error on row {idx}: {str(e)[:100]}")
                results[idx] = {**rows[idx], 'email': ""}

    # Write output
    try:
        with open(CSV_OUTPUT_PATH, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=output_headers)
            writer.writeheader()
            writer.writerows(results)
        logger.info(f"🎉 SUCCESS! Enriched file saved to: {CSV_OUTPUT_PATH}")
        total_with_emails = sum(1 for r in results if r.get('email'))
        logger.info(f"📧 {total_with_emails}/{len(rows)} leads now have verified business emails!")
    except PermissionError:
        logger.error(f"❌ Permission denied. Close '{CSV_OUTPUT_PATH}' in Excel/Google Sheets.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Failed to write output: {e}")
        sys.exit(1)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\n🛑 Process interrupted by user.")
        sys.exit(0)