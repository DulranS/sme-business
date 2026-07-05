#!/usr/bin/env python3
"""
Lead Enrichment Tool — async rewrite
Dependencies: pip install aiohttp beautifulsoup4 lxml
"""

import asyncio
import aiohttp
import csv
import re
import random
import os
import time
import logging
from collections import deque
from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse, urljoin
from urllib.robotparser import RobotFileParser

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
MAX_PAGES_PER_SITE   = 12
MAX_CONCURRENT_SITES = 20   # global async cap
DOMAIN_CONCURRENCY   = 2    # per-host cap (aiohttp connector)
REQUEST_TIMEOUT      = 8    # seconds
DOMAIN_DELAY         = 1.5  # seconds between requests to same host
MAX_RETRIES          = 2
CHECKPOINT_EVERY     = 10   # rows

OUTPUT_COLUMNS = [
    'place_id','business_name','rating','reviews','category','address',
    'whatsapp_number','website','email','instagram','twitter',
    'linkedin_company','linkedin_ceo','linkedin_founder','phone_primary',
    'email_primary','contact_page_found','social_media_score',
    'lead_quality_score','contact_confidence','best_contact_method',
    'decision_maker_found','tech_stack_detected','company_size_indicator',
    'facebook','youtube',
]

PRIORITY_PATHS = [
    '/contact','/contact-us','/about','/about-us','/team','/info',
    '/support','/get-in-touch','/reach-us','/leadership','/our-team',
    '/meet-the-team','/careers','/privacy','/impressum','/services',
    '/products','/blog','/news','/company','/locations','/offices',
]

SKIP_EXTENSIONS = frozenset([
    '.pdf','.zip','.jpg','.jpeg','.png','.gif','.svg',
    '.mp4','.mp3','.css','.js','.woff','.woff2','.ico',
])

CONTACT_KEYWORDS = frozenset(['/contact','/contact-us','/get-in-touch','/reach-us'])

DECISION_MAKER_TITLES = frozenset([
    'ceo','founder','co-founder','president','owner','director',
    'chief executive','managing director','principal','partner',
    'head of','vp of','vice president','executive',
])

TECH_STACK: Dict[str, Tuple[str,...]] = {
    'shopify':    ('shopify.com','myshopify.com'),
    'wordpress':  ('wp-content','wp-includes','wordpress'),
    'wix':        ('wix.com','wixsite.com'),
    'squarespace':('squarespace.com','sqsp.com'),
    'webflow':    ('webflow.io','webflow.com'),
    'react':      ('_next/','react-dom'),
    'angular':    ('ng-version','angular.js'),
    'vue':        ('__vue__','nuxt'),
}

COMPANY_SIZE: Dict[str, frozenset] = {
    'small':  frozenset(['startup','boutique','small team','family-owned','solo']),
    'medium': frozenset(['growing','expanding','established','regional']),
    'large':  frozenset(['enterprise','global','multinational','fortune','industry leader']),
}

EMAIL_SCORE_MAP = {
    'high': frozenset(['contact','info','hello','hi','sales','inquiries']),
    'mid':  frozenset(['support','help','service','admin']),
    'low':  frozenset(['noreply','no-reply','donotreply','mailer-daemon']),
}

SOCIAL_SKIP_PATHS = frozenset(['pages','groups','events','sharer','share','intent','search','watch','feed','results'])

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
]

# ─────────────────────────────────────────────
# COMPILED REGEXES
# ─────────────────────────────────────────────
EMAIL_RE        = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
PHONE_RE        = re.compile(r'(?:(?<!\d))(\+?[\d][\d\s\-().]{6,18}[\d])(?!\d)')
INSTAGRAM_RE    = re.compile(r'instagram\.com/([A-Za-z0-9._-]{1,30})/?', re.I)
TWITTER_RE      = re.compile(r'(?:twitter\.com|x\.com)/([A-Za-z0-9_]{1,15})/?', re.I)
LINKEDIN_CO_RE  = re.compile(r'linkedin\.com/company/([A-Za-z0-9-]+)/?', re.I)
LINKEDIN_IN_RE  = re.compile(r'linkedin\.com/in/([A-Za-z0-9-]+)/?', re.I)
FACEBOOK_RE     = re.compile(r'facebook\.com/([A-Za-z0-9.]+)/?', re.I)
YOUTUBE_RE      = re.compile(r'youtube\.com/(?:channel/|user/|@)?([A-Za-z0-9_-]+)/?', re.I)
EMPLOYEE_RE     = re.compile(r'(\d+)\+?\s*(?:employees|team members|staff)', re.I)
SPAM_EMAIL_RE   = re.compile(r'example|test\.com|sample|dummy|fake|youremail|tempmail', re.I)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%H:%M:%S',
)
logger = logging.getLogger()

# ─────────────────────────────────────────────
# PURE UTILITIES  (no I/O, no async)
# ─────────────────────────────────────────────

def normalize_url(url: str) -> Optional[str]:
    if not url or not isinstance(url, str):
        return None
    url = url.strip()
    if url.lower() in {'n/a','null','none','-','','·'}:
        return None
    if any(x in url for x in ('google.com/aclk','google.com/maps','gclid=','bit.ly','goo.gl','maps.app')):
        return None
    if not url.startswith(('http://','https://')):
        url = 'https://' + url
    try:
        p = urlparse(url)
        if not p.netloc or 'google.com' in p.netloc or len(p.netloc) < 4:
            return None
    except Exception:
        return None
    return url.rstrip('/')


def base_domain(netloc: str) -> str:
    netloc = netloc.lower().replace('www.','').split(':')[0]
    parts = netloc.split('.')
    return '.'.join(parts[-2:]) if len(parts) >= 2 else netloc


def score_email(email: str) -> int:
    local = email.split('@')[0].lower()
    for kw in EMAIL_SCORE_MAP['low']:
        if kw in local: return 2
    for kw in EMAIL_SCORE_MAP['high']:
        if kw in local: return 9
    for kw in EMAIL_SCORE_MAP['mid']:
        if kw in local: return 6
    return 7 if '.' in local else 5


def is_valid_email(email: str, domain: str) -> bool:
    if SPAM_EMAIL_RE.search(email):
        return False
    try:
        _, dom = email.rsplit('@', 1)
        dom = dom.lower()
        return dom == domain or dom.endswith('.' + domain)
    except Exception:
        return False


def clean_phone(raw: str) -> Optional[str]:
    if not raw:
        return None
    digits = re.sub(r'\D', '', raw)
    if not (8 <= len(digits) <= 15):
        return None
    if len(set(digits)) <= 2 or re.match(r'^[01]+$', digits):
        return None
    return re.sub(r'\s+', ' ', re.sub(r'[()]', '', raw.strip()))


def detect_tech_stack(html_lower: str) -> List[str]:
    return [t for t, inds in TECH_STACK.items() if any(i in html_lower for i in inds)]


def estimate_company_size(text_lower: str) -> str:
    for size, kwords in COMPANY_SIZE.items():
        if any(kw in text_lower for kw in kwords):
            return size
    m = EMPLOYEE_RE.search(text_lower)
    if m:
        n = int(m.group(1))
        return 'small' if n < 50 else 'medium' if n < 250 else 'large'
    return 'unknown'


def has_decision_maker(text_lower: str) -> bool:
    return any(t in text_lower for t in DECISION_MAKER_TITLES)


def calc_lead_score(row: Dict) -> int:
    s = 0
    if row.get('email_primary'):
        s += (score_email(row['email_primary']) / 10) * 35
    if row.get('phone_primary'):
        s += 20
    s += min(int(row.get('social_media_score', 0)) * 2.5, 15)
    if row.get('decision_maker_found') == 'Yes': s += 15
    if row.get('linkedin_company'):               s += 10
    if row.get('contact_page_found') == 'Yes':    s += 5
    return min(int(s), 100)


def calc_confidence(row: Dict) -> str:
    s = 0
    if row.get('email_primary'):    s += score_email(row['email_primary'])
    if row.get('phone_primary'):    s += 8
    if row.get('contact_page_found') == 'Yes': s += 5
    if row.get('linkedin_company'): s += 4
    return 'High' if s >= 18 else 'Medium' if s >= 10 else 'Low'


def best_contact(row: Dict) -> str:
    methods = []
    if row.get('email_primary') and score_email(row['email_primary']) >= 7:
        methods.append('Email')
    if row.get('phone_primary'):          methods.append('Phone')
    if row.get('linkedin_company') or row.get('linkedin_ceo'): methods.append('LinkedIn')
    if row.get('instagram'):              methods.append('Instagram DM')
    if row.get('facebook'):               methods.append('Facebook Message')
    return ' → '.join(methods[:2]) if methods else 'Website Form'


def make_output_path(input_path: str) -> str:
    base = os.path.splitext(os.path.basename(input_path))[0]
    ts   = datetime.now().strftime('%Y%m%d_%H%M%S')
    d    = os.path.dirname(input_path) or '.'
    path = os.path.join(d, f'{base}_enriched_{ts}.csv')
    i = 1
    while os.path.exists(path):
        path = os.path.join(d, f'{base}_enriched_{ts}_{i}.csv')
        i += 1
    return path


# ─────────────────────────────────────────────
# HTML PARSING  (CPU-bound; runs in executor)
# ─────────────────────────────────────────────

def parse_page(html: str, page_url: str, site_dom: str) -> Dict:
    """Single-pass extraction of all data from one page's HTML."""
    from bs4 import BeautifulSoup
    try:
        soup = BeautifulSoup(html, 'lxml')
    except Exception:
        soup = BeautifulSoup(html, 'html.parser')

    out: Dict = {
        'emails': set(), 'phones': set(),
        'instagram':'', 'twitter':'', 'linkedin_company':'',
        'linkedin_ceo':'', 'linkedin_founder':'', 'facebook':'', 'youtube':'',
        'is_contact': any(kw in page_url.lower() for kw in CONTACT_KEYWORDS),
        'text_lower': '', 'html_lower': '',
    }

    # ── single pass over <a> tags ──
    for a in soup.find_all('a', href=True):
        href: str = (a.get('href') or '').strip()
        if not href:
            continue
        hl = href.lower()

        # mailto
        if hl.startswith('mailto:'):
            em = href[7:].split('?')[0].strip().lower()
            if EMAIL_RE.fullmatch(em) and is_valid_email(em, site_dom):
                out['emails'].add(em)
            continue

        # tel
        if hl.startswith('tel:'):
            c = clean_phone(href[4:])
            if c:
                out['phones'].add(c)
            continue

        full = urljoin(page_url, href)
        fl   = full.lower()

        # Instagram
        if 'instagram.com' in fl and not out['instagram']:
            m = INSTAGRAM_RE.search(full)
            if m:
                u = m.group(1).rstrip('/')
                if 2 <= len(u) <= 30 and u not in SOCIAL_SKIP_PATHS:
                    out['instagram'] = f"https://www.instagram.com/{u}/"

        # Twitter / X
        elif ('twitter.com' in fl or 'x.com' in fl) and not out['twitter']:
            m = TWITTER_RE.search(full)
            if m:
                u = m.group(1).rstrip('/')
                if 1 <= len(u) <= 15 and u not in SOCIAL_SKIP_PATHS:
                    out['twitter'] = f"https://x.com/{u}/"

        # LinkedIn company
        elif 'linkedin.com/company' in fl and not out['linkedin_company']:
            m = LINKEDIN_CO_RE.search(full)
            if m:
                cid = m.group(1)
                if len(cid) > 1 and not cid.isdigit():
                    out['linkedin_company'] = f"https://www.linkedin.com/company/{cid}/"

        # LinkedIn personal
        elif 'linkedin.com/in/' in fl:
            m = LINKEDIN_IN_RE.search(full)
            if m:
                pid = m.group(1)
                if len(pid) > 2:
                    anchor = a.get_text(strip=True).lower()
                    if not out['linkedin_ceo'] and any(t in anchor for t in ('ceo','chief executive')):
                        out['linkedin_ceo'] = f"https://www.linkedin.com/in/{pid}/"
                    elif not out['linkedin_founder'] and any(t in anchor for t in ('founder','co-founder')):
                        out['linkedin_founder'] = f"https://www.linkedin.com/in/{pid}/"

        # Facebook
        elif 'facebook.com' in fl and not out['facebook']:
            m = FACEBOOK_RE.search(full)
            if m:
                pid = m.group(1)
                if pid not in SOCIAL_SKIP_PATHS:
                    out['facebook'] = f"https://www.facebook.com/{pid}/"

        # YouTube
        elif 'youtube.com' in fl and not out['youtube']:
            m = YOUTUBE_RE.search(full)
            if m:
                cid = m.group(2) if len(m.groups()) > 1 else m.group(1)
                if cid and cid not in SOCIAL_SKIP_PATHS:
                    out['youtube'] = f"https://www.youtube.com/@{cid}/"

    # ── strip noise before text extraction ──
    for tag in soup(['script','style','noscript','svg','iframe','nav','footer','header']):
        tag.decompose()

    text       = soup.get_text(separator=' ', strip=True)
    text_lower = text.lower()

    # emails from visible text
    for e in EMAIL_RE.findall(text):
        if is_valid_email(e.lower(), site_dom):
            out['emails'].add(e.lower())

    # phones from visible text
    for m in PHONE_RE.finditer(text):
        c = clean_phone(m.group(1))
        if c:
            out['phones'].add(c)

    out['text_lower'] = text_lower
    out['html_lower'] = html.lower()[:60_000]   # capped for tech-stack scan
    return out


# ─────────────────────────────────────────────
# ASYNC INFRASTRUCTURE
# ─────────────────────────────────────────────

class RobotsCache:
    """Async robots.txt cache."""
    def __init__(self):
        self._cache: Dict[str, Optional[RobotFileParser]] = {}
        self._lock  = asyncio.Lock()

    async def allowed(self, session: aiohttp.ClientSession, url: str) -> bool:
        p    = urlparse(url)
        base = f"{p.scheme}://{p.netloc}"
        async with self._lock:
            if base in self._cache:
                rp = self._cache[base]
                return rp.can_fetch('*', url) if rp else True

        # Fetch robots.txt outside the lock to avoid blocking other coroutines
        rp = RobotFileParser()
        rp.set_url(f"{base}/robots.txt")
        try:
            async with session.get(
                f"{base}/robots.txt",
                timeout=aiohttp.ClientTimeout(total=5),
            ) as resp:
                if resp.status == 200:
                    rp.parse((await resp.text(errors='replace')).splitlines())
                else:
                    rp = None  # type: ignore[assignment]
        except Exception:
            rp = None  # type: ignore[assignment]

        async with self._lock:
            self._cache[base] = rp
        return rp.can_fetch('*', url) if rp else True


class DomainLimiter:
    """Per-domain rate limiter using asyncio."""
    def __init__(self, delay: float = DOMAIN_DELAY):
        self._delay   = delay
        self._last:   Dict[str, float] = {}
        self._locks:  Dict[str, asyncio.Lock] = {}
        self._global  = asyncio.Lock()

    async def wait(self, domain: str):
        async with self._global:
            if domain not in self._locks:
                self._locks[domain] = asyncio.Lock()
        async with self._locks[domain]:
            now  = asyncio.get_event_loop().time()
            wait = self._delay - (now - self._last.get(domain, 0))
            if wait > 0:
                await asyncio.sleep(wait)
            self._last[domain] = asyncio.get_event_loop().time()


# ─────────────────────────────────────────────
# ASYNC SCRAPER CORE
# ─────────────────────────────────────────────

async def fetch_and_parse(
    session:  aiohttp.ClientSession,
    url:      str,
    site_dom: str,
    robots:   RobotsCache,
    limiter:  DomainLimiter,
    loop:     asyncio.AbstractEventLoop,
) -> Optional[Dict]:
    """Fetch a single URL, parse in thread-pool, return structured data."""
    if not await robots.allowed(session, url):
        return None

    dom = base_domain(urlparse(url).netloc)
    await limiter.wait(dom)

    headers = {'User-Agent': random.choice(USER_AGENTS)}

    for attempt in range(MAX_RETRIES + 1):
        try:
            async with session.get(
                url,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT),
                allow_redirects=True,
                ssl=False,
            ) as resp:
                if resp.status == 200:
                    html = await resp.text(errors='replace')
                    # CPU-bound parsing → thread-pool so event loop stays free
                    return await loop.run_in_executor(None, parse_page, html, url, site_dom)
                if resp.status in (403, 404, 410, 429):
                    return None
        except asyncio.TimeoutError:
            pass
        except aiohttp.ClientError:
            pass
        except Exception:
            pass

        if attempt < MAX_RETRIES:
            await asyncio.sleep(0.5 * (attempt + 1))

    return None


async def scrape_site(
    session:  aiohttp.ClientSession,
    root_url: str,
    robots:   RobotsCache,
    limiter:  DomainLimiter,
    loop:     asyncio.AbstractEventLoop,
    existing_phone: str = '',
) -> Dict:
    """Crawl a website and return all enrichment data."""

    EMPTY: Dict = {
        'emails': set(), 'phones': set(), 'instagram': '', 'twitter': '',
        'linkedin_company': '', 'linkedin_ceo': '', 'linkedin_founder': '',
        'facebook': '', 'youtube': '', 'contact_page_found': False,
        'social_media_score': 0, 'decision_maker_found': False,
        'tech_stack': [], 'company_size': 'unknown',
    }

    root_url = normalize_url(root_url)
    if not root_url:
        return EMPTY

    parsed   = urlparse(root_url)
    site_dom = base_domain(parsed.netloc)
    site_netloc = parsed.netloc

    agg: Dict = {
        'emails': set(), 'phones': set(),
        'instagram':'', 'twitter':'', 'linkedin_company':'',
        'linkedin_ceo':'', 'linkedin_founder':'', 'facebook':'', 'youtube':'',
        'contact_page_found': False,
        'texts': [], 'htmls': [],
    }

    if existing_phone:
        c = clean_phone(existing_phone)
        if c:
            agg['phones'].add(c)

    # Build prioritised URL queue (deque for O(1) popleft)
    visited: Set[str] = set()
    queue: deque = deque(
        [root_url] + [urljoin(root_url, p) for p in PRIORITY_PATHS]
    )
    pages_done = 0

    while queue and pages_done < MAX_PAGES_PER_SITE:
        # pull a small concurrent batch
        batch: List[str] = []
        while queue and len(batch) < DOMAIN_CONCURRENCY:
            url = queue.popleft()
            if url in visited:
                continue
            path_lower = urlparse(url).path.lower()
            if any(path_lower.endswith(ext) for ext in SKIP_EXTENSIONS):
                continue
            batch.append(url)
            visited.add(url)

        if not batch:
            break

        tasks = [
            fetch_and_parse(session, u, site_dom, robots, limiter, loop)
            for u in batch
        ]
        pages_done += len(batch)

        for page_data in await asyncio.gather(*tasks, return_exceptions=True):
            if not page_data or isinstance(page_data, Exception):
                continue

            agg['emails'].update(page_data['emails'])
            agg['phones'].update(page_data['phones'])

            if page_data['is_contact']:
                agg['contact_page_found'] = True

            for field in ('instagram','twitter','linkedin_company','linkedin_ceo',
                          'linkedin_founder','facebook','youtube'):
                if page_data[field] and not agg[field]:
                    agg[field] = page_data[field]

            agg['texts'].append(page_data['text_lower'])
            agg['htmls'].append(page_data['html_lower'])

        # early-exit once we have enough data
        if (pages_done >= 3
                and agg['emails']
                and agg['phones']
                and agg['linkedin_company']
                and agg['instagram']):
            break

    combined_text = ' '.join(agg['texts'])
    combined_html = ' '.join(agg['htmls'])
    social_score  = sum(1 for f in ('instagram','twitter','linkedin_company','facebook','youtube') if agg[f])

    return {
        'emails':             agg['emails'],
        'phones':             agg['phones'],
        'instagram':          agg['instagram'],
        'twitter':            agg['twitter'],
        'linkedin_company':   agg['linkedin_company'],
        'linkedin_ceo':       agg['linkedin_ceo'],
        'linkedin_founder':   agg['linkedin_founder'],
        'facebook':           agg['facebook'],
        'youtube':            agg['youtube'],
        'contact_page_found': agg['contact_page_found'],
        'social_media_score': social_score,
        'decision_maker_found': has_decision_maker(combined_text),
        'tech_stack':         detect_tech_stack(combined_html),
        'company_size':       estimate_company_size(combined_text),
    }


# ─────────────────────────────────────────────
# ROW PROCESSOR
# ─────────────────────────────────────────────

async def process_row(
    row:      Dict,
    session:  aiohttp.ClientSession,
    robots:   RobotsCache,
    limiter:  DomainLimiter,
    loop:     asyncio.AbstractEventLoop,
) -> Dict:
    row = row.copy()
    website        = row.get('website','')
    existing_phone = row.get('whatsapp_number','')
    name           = row.get('business_name','Unknown')

    try:
        data = await scrape_site(session, website, robots, limiter, loop, existing_phone)

        primary_email = max(data['emails'], key=score_email) if data['emails'] else ''
        primary_phone = (
            sorted(data['phones'], key=lambda p: (not p.startswith('+'), len(p)))[0]
            if data['phones'] else ''
        )

        row['email']              = '; '.join(sorted(data['emails']))
        row['email_primary']      = primary_email
        row['instagram']          = data['instagram']
        row['twitter']            = data['twitter']
        row['linkedin_company']   = data['linkedin_company']
        row['linkedin_ceo']       = data['linkedin_ceo']
        row['linkedin_founder']   = data['linkedin_founder']
        row['facebook']           = data['facebook']
        row['youtube']            = data['youtube']
        row['contact_page_found'] = 'Yes' if data['contact_page_found'] else 'No'
        row['social_media_score'] = str(data['social_media_score'])
        row['decision_maker_found'] = 'Yes' if data['decision_maker_found'] else 'No'
        row['tech_stack_detected']  = ', '.join(data['tech_stack'])
        row['company_size_indicator'] = data['company_size']

        if data['phones']:
            row['whatsapp_number'] = '; '.join(sorted(data['phones'], key=lambda p: (not p.startswith('+'), p)))
            row['phone_primary']   = primary_phone
        elif existing_phone:
            row['phone_primary'] = existing_phone
        else:
            row['whatsapp_number'] = ''
            row['phone_primary']   = ''

        row['lead_quality_score'] = str(calc_lead_score(row))
        row['contact_confidence'] = calc_confidence(row)
        row['best_contact_method'] = best_contact(row)

        logger.info(f"✓ {name}: Q={row['lead_quality_score']} C={row['contact_confidence']} "
                    f"E={bool(primary_email)} P={bool(primary_phone)}")

    except Exception as e:
        logger.warning(f"✗ {name}: {str(e)[:80]}")
        _blank_row(row, existing_phone)

    row['website'] = website
    return row


def _blank_row(row: Dict, existing_phone: str):
    for f in ('email','email_primary','instagram','twitter','linkedin_company',
              'linkedin_ceo','linkedin_founder','facebook','youtube','tech_stack_detected'):
        row[f] = ''
    row.update({
        'contact_page_found':'No', 'social_media_score':'0',
        'decision_maker_found':'No', 'company_size_indicator':'unknown',
        'lead_quality_score':'0', 'contact_confidence':'Low',
        'best_contact_method':'Unknown', 'phone_primary': existing_phone or '',
    })
    if not existing_phone:
        row['whatsapp_number'] = ''


# ─────────────────────────────────────────────
# CHECKPOINT + OUTPUT
# ─────────────────────────────────────────────

def save_checkpoint(results: List[Dict], path: str, cols: List[str]):
    cp = path.replace('.csv','_checkpoint.csv')
    try:
        with open(cp, 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=cols, restval='', extrasaction='ignore')
            w.writeheader()
            w.writerows(results)
        logger.info(f"💾 Checkpoint: {len(results)} rows")
    except Exception as e:
        logger.error(f"Checkpoint failed: {e}")


# ─────────────────────────────────────────────
# MAIN ASYNC ENTRYPOINT
# ─────────────────────────────────────────────

async def run(input_file: str):
    # ── read input ──
    try:
        with open(input_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows   = list(reader)
            in_cols: List[str] = list(reader.fieldnames or [])
    except Exception as e:
        logger.error(f"Cannot read input: {e}")
        return

    if 'website' not in in_cols:
        logger.error("Input CSV must have a 'website' column.")
        return

    # ── build output column list ──
    out_cols = [c for c in OUTPUT_COLUMNS if c in in_cols]
    enrichment_fields = [
        'email','email_primary','instagram','twitter','linkedin_company',
        'linkedin_ceo','linkedin_founder','facebook','youtube','phone_primary',
        'contact_page_found','social_media_score','lead_quality_score',
        'contact_confidence','best_contact_method','decision_maker_found',
        'tech_stack_detected','company_size_indicator',
    ]
    for f in enrichment_fields:
        if f not in out_cols:
            out_cols.append(f)

    output_path = make_output_path(input_file)
    total       = len(rows)
    logger.info(f"Loaded {total} leads  →  {output_path}")

    # ── shared async objects ──
    robots  = RobotsCache()
    limiter = DomainLimiter(DOMAIN_DELAY)
    loop    = asyncio.get_event_loop()

    connector = aiohttp.TCPConnector(
        limit=MAX_CONCURRENT_SITES,
        limit_per_host=DOMAIN_CONCURRENCY,
        ttl_dns_cache=300,
        ssl=False,
        enable_cleanup_closed=True,
    )

    results: List[Dict] = []
    start = time.time()

    async with aiohttp.ClientSession(connector=connector) as session:
        sem = asyncio.Semaphore(MAX_CONCURRENT_SITES)

        async def bounded(row: Dict) -> Dict:
            async with sem:
                return await process_row(row, session, robots, limiter, loop)

        tasks = [asyncio.create_task(bounded(r)) for r in rows]

        for i, task in enumerate(asyncio.as_completed(tasks), 1):
            try:
                result = await task
                results.append(result)
            except Exception as e:
                logger.error(f"Task error: {e}")

            if i % CHECKPOINT_EVERY == 0:
                elapsed = time.time() - start
                rate    = i / elapsed if elapsed else 1
                eta     = (total - i) / rate
                logger.info(f"Progress {i}/{total} ({100*i//total}%)  ETA {int(eta//60)}m{int(eta%60)}s")
                save_checkpoint(results, output_path, out_cols)

    # ── write final CSV ──
    try:
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=out_cols, restval='', extrasaction='ignore')
            w.writeheader()
            w.writerows(results)
    except Exception as e:
        logger.error(f"Write failed: {e}")
        return

    # ── clean up checkpoint ──
    cp = output_path.replace('.csv','_checkpoint.csv')
    if os.path.exists(cp):
        os.remove(cp)

    # ── summary ──
    elapsed  = time.time() - start
    n        = len(results) or 1
    hq       = sum(1 for r in results if int(r.get('lead_quality_score',0)) >= 70)
    w_email  = sum(1 for r in results if r.get('email_primary'))
    w_phone  = sum(1 for r in results if r.get('phone_primary'))
    w_li     = sum(1 for r in results if r.get('linkedin_company'))
    w_dm     = sum(1 for r in results if r.get('decision_maker_found') == 'Yes')

    print(f"""
{'='*60}
✅  ENRICHMENT COMPLETE
{'='*60}
  Output : {output_path}
  Time   : {int(elapsed//60)}m {int(elapsed%60)}s  ({elapsed/n:.1f}s/lead)
  Total  : {len(results)}
  High quality (70+) : {hq} ({100*hq//n}%)
  With email         : {w_email} ({100*w_email//n}%)
  With phone         : {w_phone} ({100*w_phone//n}%)
  With LinkedIn      : {w_li} ({100*w_li//n}%)
  Decision makers    : {w_dm} ({100*w_dm//n}%)
{'='*60}""")


def main():
    print("\n" + "="*60)
    print("🚀  LEAD ENRICHMENT TOOL  (async edition)")
    print("="*60)
    f = input("\n📁 CSV file path: ").strip().strip('"').strip("'")
    if not os.path.exists(f):
        logger.error(f"File not found: {f}")
        return
    asyncio.run(run(f))


if __name__ == '__main__':
    main()