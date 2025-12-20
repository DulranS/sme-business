import csv
import re
import time
import random
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
from collections import deque

# -----------------------------
# CONFIGURATION
# -----------------------------
ORIGINAL_COLUMNS = [
    'place_id', 'business_name', 'rating', 'reviews', 'category',
    'address', 'whatsapp_number', 'website'
]
OUTPUT_COLUMNS = ORIGINAL_COLUMNS + ['email']

EMAIL_TIMEOUT = 10
MAX_RETRIES = 2
MAX_PAGES_PER_SITE = 3
REQUEST_DELAY_MIN = 0.7
REQUEST_DELAY_MAX = 1.3

PRIORITY_PATHS = ['/contact', '/contact-us', '/about', '/team', '/info', '/support']
EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')

def normalize_url(url):
    if not url or not isinstance(url, str):
        return None
    url = url.strip()
    if not url or url.lower() in {'n/a', 'null', 'none', '-', '', '·'}:
        return None
    if any(x in url for x in ['google.com/aclk', 'google.com/maps', 'gclid=', 'maps.app.goo.gl']):
        return None
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    parsed = urlparse(url)
    if not parsed.netloc or 'google.com' in parsed.netloc or len(parsed.netloc) < 4:
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
        except:
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

    priority_urls = [urljoin(root_url, path) for path in PRIORITY_PATHS]
    urls_to_check = deque(priority_urls)
    urls_to_check.appendleft(root_url)

    count = 0
    while urls_to_check and count < MAX_PAGES_PER_SITE:
        url = urls_to_check.popleft()
        if url in visited:
            continue
        visited.add(url)
        count += 1

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

    clean_emails = set()
    for e in all_emails:
        e = e.strip()
        if 5 <= len(e) <= 254 and EMAIL_PATTERN.fullmatch(e):
            clean_emails.add(e)
    return clean_emails

def process_row(row):
    website = row.get('website', "")
    emails = scrape_emails_from_site(website)
    row['email'] = '; '.join(sorted(emails)) if emails else ""
    return row