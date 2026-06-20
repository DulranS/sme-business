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
from collections import defaultdict
from datetime import datetime
from threading import Lock

# -----------------------------
# CONFIGURATION
# -----------------------------
REQUIRED_COLUMNS = ['website']
OUTPUT_COLUMNS = [
    'business_name', 'company_website', 'careers_page_url', 'ats_platform',
    'job_title', 'job_url', 'location', 'department', 'role_category',
    'matched_keywords', 'posted_date', 'status', 'scraped_at'
]

REQUEST_TIMEOUT = 10
MAX_RETRIES = 2
MAX_WORKERS = 6
REQUEST_DELAY_MIN = 0.5
REQUEST_DELAY_MAX = 1.2
DOMAIN_REQUEST_DELAY = 2.0
CHECKPOINT_INTERVAL = 5

# Paths to try when a careers page can't be found by crawling homepage links
CAREER_PATH_GUESSES = [
    '/careers', '/careers/', '/career', '/jobs', '/jobs/', '/vacancies',
    '/join-us', '/work-with-us', '/about/careers', '/company/careers',
    '/current-openings', '/about-us/careers', '/life-at-us', '/opportunities'
]

# Keywords used to find a "careers" link on the homepage
CAREER_LINK_HINTS = ['career', 'job', 'vacanc', 'join-us', 'work-with-us', 'opportunit']

# Your three target role buckets -> keywords that identify them in a job title
ROLE_CATEGORIES = {
    'Solutions/Integration Engineer': [
        'solutions engineer', 'solution engineer', 'integration engineer',
        'implementation engineer', 'pre-sales engineer', 'presales engineer',
        'technical consultant', 'systems integration', 'middleware engineer'
    ],
    'Software/AI Engineer': [
        'software engineer', 'software developer', 'ai engineer', 'ml engineer',
        'machine learning engineer', 'backend engineer', 'back-end engineer',
        'full stack', 'fullstack', 'data engineer', 'cloud engineer',
        'devops engineer', 'platform engineer', 'systems engineer'
    ],
    'Logistics Ops + Systems': [
        'logistics', 'supply chain', 'operations executive', 'systems analyst',
        'erp', 'warehouse', 'fleet', 'shipping', 'freight'
    ]
}
ALL_ROLE_KEYWORDS = [kw for kws in ROLE_CATEGORIES.values() for kw in kws]

# ATS detection patterns -> (regex, platform name)
ATS_PATTERNS = {
    'greenhouse': re.compile(r'(?:job-)?boards\.greenhouse\.io/([A-Za-z0-9_-]+)', re.IGNORECASE),
    'lever': re.compile(r'jobs\.lever\.co/([A-Za-z0-9_-]+)', re.IGNORECASE),
    'smartrecruiters': re.compile(r'smartrecruiters\.com/([A-Za-z0-9_-]+)', re.IGNORECASE),
    'workable': re.compile(r'([A-Za-z0-9_-]+)\.workable\.com', re.IGNORECASE),
    'bamboohr': re.compile(r'([A-Za-z0-9_-]+)\.bamboohr\.com', re.IGNORECASE),
    'recruitee': re.compile(r'([A-Za-z0-9_-]+)\.recruitee\.com', re.IGNORECASE),
    'workday': re.compile(r'([A-Za-z0-9_-]+)\.(?:my)?workday\.com', re.IGNORECASE),
}

domain_locks = defaultdict(Lock)
domain_last_request = {}
domain_lock_manager = Lock()
robots_cache = {}
robots_cache_lock = Lock()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger()

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
]


# -----------------------------
# UTILITY FUNCTIONS
# -----------------------------
def create_output_filename(input_path):
    base_name = os.path.splitext(os.path.basename(input_path))[0]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_name = f"{base_name}_jobs_{timestamp}.csv"
    output_dir = os.path.dirname(input_path) or '.'
    output_path = os.path.join(output_dir, output_name)
    counter = 1
    while os.path.exists(output_path):
        output_name = f"{base_name}_jobs_{timestamp}_{counter}.csv"
        output_path = os.path.join(output_dir, output_name)
        counter += 1
    return output_path


def normalize_url(url):
    if not url or not isinstance(url, str):
        return None
    url = url.strip()
    if not url or url.lower() in {'n/a', 'null', 'none', '-', '', '·'}:
        return None
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    try:
        parsed = urlparse(url)
        if not parsed.netloc or len(parsed.netloc) < 4:
            return None
    except Exception:
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
                except Exception:
                    robots_cache[base_url] = None
            rp = robots_cache.get(base_url)
            if rp is None:
                return True
            return rp.can_fetch("*", url)
    except Exception:
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


def polite_get(url, timeout=REQUEST_TIMEOUT, as_json=False):
    """Robots-aware, rate-limited GET. Returns (BeautifulSoup or dict, status_note)."""
    if not can_fetch_url(url):
        return None, 'blocked_by_robots'

    parsed = urlparse(url)
    domain = extract_base_domain(parsed.netloc)
    rate_limit_domain(domain)

    headers = {'User-Agent': random.choice(USER_AGENTS)}
    for attempt in range(MAX_RETRIES + 1):
        try:
            resp = requests.get(url, timeout=timeout, headers=headers, allow_redirects=True)
            if resp.status_code == 200:
                if as_json:
                    try:
                        return resp.json(), 'ok'
                    except Exception:
                        return None, 'invalid_json'
                resp.encoding = resp.apparent_encoding or 'utf-8'
                return BeautifulSoup(resp.text, 'html.parser'), 'ok'
            elif resp.status_code == 404:
                return None, 'not_found'
        except Exception:
            if attempt < MAX_RETRIES:
                time.sleep(random.uniform(0.5, 1.0))
                continue
    return None, 'fetch_failed'


def classify_role(title):
    title_lower = title.lower()
    matched = []
    category = ''
    for cat, keywords in ROLE_CATEGORIES.items():
        for kw in keywords:
            if kw in title_lower:
                matched.append(kw)
                if not category:
                    category = cat
    return category, matched


def looks_like_job_title(text):
    if not text:
        return False
    text = text.strip()
    if len(text) < 4 or len(text) > 100:
        return False
    return any(kw in text.lower() for kw in ALL_ROLE_KEYWORDS)


# -----------------------------
# ATS-SPECIFIC FETCHERS (public job board APIs — no robots.txt issues, meant for embedding)
# -----------------------------
def fetch_greenhouse_jobs(token):
    url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=false"
    data, note = polite_get(url, as_json=True)
    jobs = []
    if data and isinstance(data, dict):
        for j in data.get('jobs', []):
            jobs.append({
                'job_title': j.get('title', ''),
                'job_url': j.get('absolute_url', ''),
                'location': (j.get('location') or {}).get('name', ''),
                'department': ', '.join(d.get('name', '') for d in j.get('departments', [])),
                'posted_date': j.get('updated_at', '')
            })
    return jobs


def fetch_lever_jobs(site):
    url = f"https://api.lever.co/v0/postings/{site}?mode=json"
    data, note = polite_get(url, as_json=True)
    jobs = []
    if data and isinstance(data, list):
        for j in data:
            categories = j.get('categories', {}) or {}
            jobs.append({
                'job_title': j.get('text', ''),
                'job_url': j.get('hostedUrl', ''),
                'location': categories.get('location', ''),
                'department': categories.get('team', ''),
                'posted_date': j.get('createdAt', '')
            })
    return jobs


def fetch_smartrecruiters_jobs(company):
    url = f"https://api.smartrecruiters.com/v1/companies/{company}/postings"
    data, note = polite_get(url, as_json=True)
    jobs = []
    if data and isinstance(data, dict):
        for j in data.get('content', []):
            loc = j.get('location', {}) or {}
            jobs.append({
                'job_title': j.get('name', ''),
                'job_url': f"https://jobs.smartrecruiters.com/{company}/{j.get('id', '')}",
                'location': loc.get('city', ''),
                'department': (j.get('department') or {}).get('label', ''),
                'posted_date': j.get('releasedDate', '')
            })
    return jobs


ATS_FETCHERS = {
    'greenhouse': fetch_greenhouse_jobs,
    'lever': fetch_lever_jobs,
    'smartrecruiters': fetch_smartrecruiters_jobs,
}


def detect_ats(html_text):
    for platform, pattern in ATS_PATTERNS.items():
        match = pattern.search(html_text)
        if match:
            return platform, match.group(1)
    return None, None


# -----------------------------
# CORE SCRAPE LOGIC
# -----------------------------
def find_careers_page(base_url):
    """Crawl the homepage for a careers/jobs link; fall back to guessing common paths."""
    soup, note = polite_get(base_url)
    if soup is None:
        return None, None, note  # careers_url, homepage_soup, status_note

    candidates = []
    for a_tag in soup.find_all('a', href=True):
        href = a_tag['href'].strip()
        text = a_tag.get_text(strip=True).lower()
        full_url = urljoin(base_url, href)
        if any(hint in href.lower() or hint in text for hint in CAREER_LINK_HINTS):
            if urlparse(full_url).netloc or full_url.startswith(base_url):
                candidates.append(full_url)

    # Dedup, keep same-domain links first
    base_domain = urlparse(base_url).netloc
    candidates = sorted(set(candidates), key=lambda u: urlparse(u).netloc != base_domain)

    if not candidates:
        candidates = [urljoin(base_url, p) for p in CAREER_PATH_GUESSES]

    for url in candidates[:6]:
        page_soup, page_note = polite_get(url)
        if page_soup is not None:
            return url, page_soup, soup  # found careers page, also return homepage soup
        time.sleep(random.uniform(REQUEST_DELAY_MIN, REQUEST_DELAY_MAX))

    return None, None, soup


def scrape_generic_jobs(careers_url, soup):
    """Parse a careers page for anchors whose text looks like a job title."""
    jobs = []
    seen_titles = set()
    for a_tag in soup.find_all('a', href=True):
        text = a_tag.get_text(strip=True)
        if looks_like_job_title(text) and text.lower() not in seen_titles:
            seen_titles.add(text.lower())
            jobs.append({
                'job_title': text,
                'job_url': urljoin(careers_url, a_tag['href']),
                'location': '',
                'department': '',
                'posted_date': ''
            })
    return jobs


def page_looks_js_rendered(soup):
    """Heuristic: very little visible text + a real script tag count usually means an SPA shell."""
    for tag in soup(['script', 'style', 'noscript']):
        tag.decompose()
    visible_text = soup.get_text(strip=True)
    return len(visible_text) < 200


def process_company(row):
    business_name = row.get('business_name', 'Unknown').strip()
    website = row.get('website', '')
    base_url = normalize_url(website)
    scraped_at = datetime.now().strftime('%Y-%m-%d %H:%M')

    base_row = {
        'business_name': business_name,
        'company_website': website,
        'careers_page_url': '',
        'ats_platform': '',
        'job_title': '',
        'job_url': '',
        'location': '',
        'department': '',
        'role_category': '',
        'matched_keywords': '',
        'posted_date': '',
        'status': '',
        'scraped_at': scraped_at
    }

    if not base_url:
        base_row['status'] = 'invalid_website'
        return [base_row]

    if not can_fetch_url(base_url):
        base_row['status'] = 'blocked_by_robots'
        return [base_row]

    try:
        result = find_careers_page(base_url)
        careers_url, page_soup, homepage_or_note = result

        if careers_url is None:
            note = homepage_or_note if isinstance(homepage_or_note, str) else 'careers_page_not_found'
            base_row['status'] = note
            return [base_row]

        base_row['careers_page_url'] = careers_url

        # Check both the careers page and homepage for ATS fingerprints
        combined_html = str(page_soup)
        if isinstance(homepage_or_note, BeautifulSoup):
            combined_html += str(homepage_or_note)

        platform, token = detect_ats(combined_html)

        jobs = []
        if platform and token and platform in ATS_FETCHERS:
            jobs = ATS_FETCHERS[platform](token)
            base_row['ats_platform'] = platform
            if not jobs:
                base_row['status'] = f'{platform}_detected_no_jobs_returned'
                return [base_row]
        elif platform:
            # Detected an ATS we don't have an API integration for (e.g. Workday — JS-rendered)
            base_row['ats_platform'] = platform
            base_row['status'] = f'{platform}_detected_manual_check_needed'
            return [base_row]
        else:
            if page_looks_js_rendered(page_soup):
                base_row['status'] = 'likely_js_rendered_manual_check_needed'
                return [base_row]
            jobs = scrape_generic_jobs(careers_url, page_soup)

        if not jobs:
            base_row['status'] = 'no_jobs_listed'
            return [base_row]

        output_rows = []
        any_match = False
        for job in jobs:
            category, matched_kw = classify_role(job['job_title'])
            if not category:
                continue  # skip postings that don't match your three target role buckets
            any_match = True
            new_row = base_row.copy()
            new_row['job_title'] = job['job_title']
            new_row['job_url'] = job['job_url']
            new_row['location'] = job.get('location', '')
            new_row['department'] = job.get('department', '')
            new_row['posted_date'] = str(job.get('posted_date', ''))
            new_row['role_category'] = category
            new_row['matched_keywords'] = ', '.join(sorted(set(matched_kw)))
            new_row['status'] = 'match_found'
            output_rows.append(new_row)
            logger.info(f"  ✓ {business_name}: {job['job_title']} [{category}]")

        if not any_match:
            base_row['status'] = f'{len(jobs)}_jobs_found_none_matched_role_keywords'
            return [base_row]

        return output_rows

    except Exception as e:
        base_row['status'] = f'error: {str(e)[:80]}'
        logger.warning(f"Failed on {business_name}: {str(e)[:100]}")
        return [base_row]


def save_checkpoint(results, output_path, columns):
    checkpoint_path = output_path.replace('.csv', '_checkpoint.csv')
    try:
        with open(checkpoint_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=columns, restval='')
            writer.writeheader()
            for row in results:
                writer.writerow({k: v for k, v in row.items() if k in columns})
        logger.info(f"💾 Checkpoint saved: {len(results)} rows")
    except Exception as e:
        logger.error(f"Failed to save checkpoint: {e}")


# -----------------------------
# MAIN
# -----------------------------
def main():
    print("\n" + "=" * 70)
    print("🎯 TARGET-COMPANY JOB SCRAPER")
    print("=" * 70 + "\n")

    input_file = input("📁 Enter path to your companies CSV: ").strip().strip('"').strip("'")

    if not os.path.exists(input_file):
        logger.error(f"❌ File not found: {input_file}")
        return

    query = input(
        "🔍 Enter a job search query (e.g. 'AI engineer, integration engineer') "
        "or press Enter to use the default role categories: "
    ).strip()

    if query:
        global ROLE_CATEGORIES, ALL_ROLE_KEYWORDS
        keywords = [k.strip().lower() for k in query.split(',') if k.strip()]
        if keywords:
            ROLE_CATEGORIES = {f"Custom Search: {query}": keywords}
            ALL_ROLE_KEYWORDS = keywords
            logger.info(f"🔍 Searching for: {', '.join(keywords)}")

    try:
        with open(input_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            input_columns = reader.fieldnames
    except Exception as e:
        logger.error(f"❌ Failed to read input file: {e}")
        return

    missing_cols = [col for col in REQUIRED_COLUMNS if col not in input_columns]
    if missing_cols:
        logger.error(f"❌ Missing required column(s): {missing_cols}")
        logger.info(f"Available columns: {', '.join(input_columns)}")
        return

    total_companies = len(rows)
    logger.info(f"✅ Loaded {total_companies} companies from {input_file}")

    output_path = create_output_filename(input_file)
    logger.info(f"📄 Output will be saved to: {output_path}")
    print(f"\n⚙️  Processing with {MAX_WORKERS} workers")
    print("⏳ Starting job scrape...\n")

    results = []
    completed = 0
    start_time = time.time()

    try:
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            future_to_row = {executor.submit(process_company, row): row for row in rows}

            for future in as_completed(future_to_row):
                try:
                    company_rows = future.result()
                    results.extend(company_rows)
                    completed += 1

                    elapsed = time.time() - start_time
                    rate = completed / elapsed if elapsed > 0 else 0
                    eta = (total_companies - completed) / rate if rate > 0 else 0
                    logger.info(f"📊 Progress: {completed}/{total_companies} ({100*completed//total_companies}%) | ETA: {int(eta//60)}m {int(eta%60)}s")

                    if completed % CHECKPOINT_INTERVAL == 0:
                        save_checkpoint(results, output_path, OUTPUT_COLUMNS)

                except Exception as e:
                    logger.error(f"❌ Error processing company: {str(e)[:100]}")

    except KeyboardInterrupt:
        logger.warning("\n⚠️  Interrupted. Saving progress...")
        save_checkpoint(results, output_path, OUTPUT_COLUMNS)
        return
    except Exception as e:
        logger.error(f"❌ Critical error: {e}")
        save_checkpoint(results, output_path, OUTPUT_COLUMNS)
        return

    if not results:
        logger.error("❌ No results to write")
        return

    try:
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS, restval='')
            writer.writeheader()
            for row in results:
                writer.writerow({k: v for k, v in row.items() if k in OUTPUT_COLUMNS})

        total_matches = sum(1 for r in results if r['status'] == 'match_found')
        manual_check = sum(1 for r in results if 'manual_check_needed' in r['status'])
        not_found = sum(1 for r in results if r['status'] == 'careers_page_not_found')
        blocked = sum(1 for r in results if r['status'] == 'blocked_by_robots')
        total_time = time.time() - start_time

        print("\n" + "=" * 70)
        print("✅ JOB SCRAPE COMPLETE!")
        print("=" * 70)
        print(f"\n📁 Output File: {output_path}")
        print(f"⏱️  Total Time: {int(total_time//60)}m {int(total_time%60)}s")
        print(f"\n📊 RESULTS SUMMARY:")
        print(f"   • Companies Processed: {total_companies}")
        print(f"   • Matching Job Postings Found: {total_matches}")
        print(f"   • Companies Needing Manual Check (JS-rendered/unsupported ATS): {manual_check}")
        print(f"   • Careers Page Not Found: {not_found}")
        print(f"   • Blocked by robots.txt: {blocked}")
        print("\n" + "=" * 70 + "\n")

        checkpoint_path = output_path.replace('.csv', '_checkpoint.csv')
        if os.path.exists(checkpoint_path):
            os.remove(checkpoint_path)
            logger.info("🧹 Checkpoint file cleaned up")

    except Exception as e:
        logger.error(f"❌ Failed to write output file: {e}")
        return


if __name__ == "__main__":
    main()
