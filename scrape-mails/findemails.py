import csv
import re
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import os

# -----------------------------
# CONFIGURATION (EDIT THIS PART)
# -----------------------------
CSV_INPUT_PATH = "websites.csv"        # Input CSV file (must exist)
CSV_OUTPUT_PATH = "emails_output.csv"  # Output CSV file
EMAIL_TIMEOUT = 10                     # Request timeout (seconds)
REQUEST_DELAY = 1                      # Delay between requests (seconds)
MAX_RETRIES = 2                        # Retry failed requests

# Column name candidates for website URLs (case-insensitive)
WEBSITE_COLUMN_NAMES = {'website', 'url', 'site', 'homepage', 'domain', 'link', 'web'}

# Email regex pattern
EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')

# -----------------------------
# CORE FUNCTIONS
# -----------------------------

def normalize_url(url):
    """Ensure URL starts with http(s)://"""
    if not url or not url.strip():
        return None
    url = url.strip()
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    return url

def extract_base_domain(netloc):
    """Extract base domain (e.g., 'example.com' from 'www.example.com')"""
    parts = netloc.lower().split('.')
    if len(parts) >= 2:
        return '.'.join(parts[-2:])
    return netloc.lower()

def is_relevant_email(email, base_domain):
    """Check if email belongs to the same base domain"""
    try:
        email_domain = email.split('@', 1)[-1].lower()
        return base_domain in email_domain
    except:
        return False

def scrape_emails_from_page(url, timeout=10):
    """Scrape and validate emails from a webpage"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; EmailBot/1.0)'
    }
    
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = requests.get(url, timeout=timeout, headers=headers)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'lxml')
            # Remove script/style/nav to reduce noise
            for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'noscript']):
                tag.decompose()
            
            text = soup.get_text(separator=' ', strip=True)
            raw_emails = set(re.findall(EMAIL_PATTERN, text))
            
            # Validate against domain
            parsed = urlparse(url)
            base_domain = extract_base_domain(parsed.netloc)
            valid_emails = {
                email for email in raw_emails
                if is_relevant_email(email, base_domain)
            }
            
            return valid_emails
            
        except Exception as e:
            if attempt < MAX_RETRIES:
                time.sleep(0.5)
                continue
            else:
                print(f"  ⚠️ Failed to scrape {url}: {str(e)[:100]}")
                return set()

def find_website_column(headers):
    """Find the best column that likely contains URLs"""
    header_lower = [h.strip().lower() for h in headers]
    for i, h in enumerate(header_lower):
        if h in WEBSITE_COLUMN_NAMES:
            return i
    return 0  # fallback to first column

def main():
    print("📧 Starting CSV Email Scraper...\n")
    
    # Read input CSV
    if not os.path.exists(CSV_INPUT_PATH):
        print(f"❌ Input file not found: {CSV_INPUT_PATH}")
        return
    
    with open(CSV_INPUT_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames
        if not headers:
            print("❌ Empty or invalid CSV")
            return
        
        # Identify website column
        url_col_index = find_website_column(headers)
        url_col_name = headers[url_col_index]
        print(f"✅ Using column: '{url_col_name}' for websites")
        
        rows = list(reader)
    
    if not rows:
        print("❌ No data rows in CSV")
        return
    
    print(f"📁 Processing {len(rows)} websites...\n")
    
    # Prepare output headers (add 'emails' if not exists)
    output_headers = headers.copy()
    if 'emails' not in [h.lower() for h in output_headers]:
        output_headers.append('emails')
    
    results = []
    
    # Process each row
    for i, row in enumerate(rows, 1):
        raw_url = row.get(url_col_name, '').strip()
        normalized_url = normalize_url(raw_url)
        
        if not normalized_url:
            row['emails'] = ""
            results.append(row)
            continue
        
        print(f"[{i}/{len(rows)}] Scraping: {normalized_url}")
        emails = scrape_emails_from_page(normalized_url, timeout=EMAIL_TIMEOUT)
        row['emails'] = '; '.join(sorted(emails)) if emails else ""
        results.append(row)
        time.sleep(REQUEST_DELAY)
    
    # Write output
    with open(CSV_OUTPUT_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=output_headers)
        writer.writeheader()
        writer.writerows(results)
    
    print(f"\n✅ Done! Results saved to: {CSV_OUTPUT_PATH}")

if __name__ == "__main__":
    main()