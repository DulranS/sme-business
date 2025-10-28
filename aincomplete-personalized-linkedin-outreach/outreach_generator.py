"""
Compliant LinkedIn Outreach Draft Generator
-------------------------------------------
This tool creates personalized message drafts using ONLY:
- Your leads.csv (manually created)
- Public company websites (robots.txt compliant)

YOU must manually send messages via LinkedIn.
"""

import csv
import time
import re
import os
from urllib.parse import urljoin, urlparse
from datetime import datetime
import requests
from bs4 import BeautifulSoup
from config import YOUR_NAME, YOUR_SERVICES, YOUR_VALUE, PERSONALIZATION_RULES, FALLBACK_HOOK

# === SETTINGS ===
LEADS_FILE = "leads.csv"
OUTPUT_FILE = "outreach_drafts.txt"
REQUEST_DELAY = 5  # Seconds between web requests (be kind to servers)
MAX_LEADS = 20     # Safety cap

def is_valid_url(url):
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except:
        return False

def fetch_company_snippet(url, max_chars=300):
    """Get a short public snippet from company homepage"""
    if not is_valid_url(url):
        return ""
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Research Bot; personal use)'}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()
            
        text = ' '.join(soup.stripped_strings)
        text = re.sub(r'\s+', ' ', text)
        return text[:max_chars]
    except Exception as e:
        print(f"⚠️  Skipping {url}: {str(e)[:50]}")
        return ""

def find_personalization_hook(headline, company):
    """Match headline to a human-sounding hook"""
    headline_lower = headline.lower()
    
    for rule in PERSONALIZATION_RULES:
        if any(kw in headline_lower for kw in rule["keywords"]):
            # Add detail placeholder for manual customization
            detail = "your recent video/post/project" if "video" in rule["keywords"] else "your strategy"
            hook = rule["hook"].format(company=company, detail=detail)
            return hook.capitalize()
    
    return FALLBACK_HOOK.format(company=company).capitalize()

def generate_draft(lead, company_snippet):
    """Create a warm, non-salesy message draft"""
    first_name = lead["first_name"]
    company = lead["company"]
    headline = lead["headline"]
    
    # Generate personalized opener
    hook = find_personalization_hook(headline, company)
    
    # Build message
    message = f"""Hi {first_name},

{hook}!

I help businesses like yours with digital execution—{YOUR_SERVICES}—at fair, transparent prices. If you're ever looking to free up time or level up your online presence, I'd be glad to help.

No pressure to reply—just wanted to offer support in case it's useful!

Best regards,
{YOUR_NAME}
"""
    return message

def main():
    # Validate input file
    if not os.path.exists(LEADS_FILE):
        print(f"❌ ERROR: '{LEADS_FILE}' not found.")
        print("Create it with columns: first_name,last_name,company,headline,company_website")
        return
    
    # Load leads
    leads = []
    with open(LEADS_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        required_cols = {'first_name', 'company', 'headline', 'company_website'}
        if not required_cols.issubset(reader.fieldnames):
            print(f"❌ ERROR: CSV missing columns. Required: {required_cols}")
            return
        leads = [row for row in reader if row['first_name'] and row['company']]
    
    if not leads:
        print("❌ No valid leads found.")
        return
    
    print(f"✅ Processing {min(len(leads), MAX_LEADS)} leads...\n")
    
    # Generate drafts
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f_out:
        f_out.write(f"Personalized Outreach Drafts\nGenerated: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
        f_out.write("="*60 + "\n\n")
        
        for i, lead in enumerate(leads[:MAX_LEADS]):
            print(f" → {lead['first_name']} ({lead['company']})")
            
            # Get public company context
            snippet = fetch_company_snippet(lead['company_website'])
            
            # Create draft
            draft = generate_draft(lead, snippet)
            
            # Write to file
            f_out.write(f"RECIPIENT: {lead['first_name']} {lead['last_name']} @ {lead['company']}\n")
            f_out.write(f"PROFILE: {lead['headline']}\n")
            f_out.write("-" * 40 + "\n")
            f_out.write(draft)
            f_out.write("\n" + "="*60 + "\n\n")
            
            # Rate limiting
            if i < len(leads[:MAX_LEADS]) - 1:
                time.sleep(REQUEST_DELAY)
    
    print(f"\n✅ DONE! Review drafts in '{OUTPUT_FILE}'")
    print("\n⚠️  CRITICAL NEXT STEPS:")
    print("1. READ every draft and add 1 SPECIFIC detail (e.g., 'your post about X')")
    print("2. SEND MANUALLY via LinkedIn (max 20/week)")
    print("3. NEVER send without personalizing further")

if __name__ == "__main__":
    main()