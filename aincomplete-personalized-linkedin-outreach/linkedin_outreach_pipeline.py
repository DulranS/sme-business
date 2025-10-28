"""
ALL-IN-ONE LinkedIn Outreach Pipeline (Compliant Edition)
---------------------------------------------------------
Steps:
1. Enrich official LinkedIn export with company websites
2. Generate personalized outreach drafts for YOUR digital services
3. Output ready-to-review messages (YOU send manually)

Requirements:
- Python 3.7+
- pip install requests beautifulsoup4 - MAKE SURE TO INSTALL DEPENDENCIES

Instructions:
1. Export leads from LinkedIn Sales Navigator → save as 'linkedin_export.csv'
2. Run this script
3. Review 'outreach_drafts.txt' and add 1 personal detail per message
4. Send manually on LinkedIn (max 20/week)

"""

import csv
import time
import re
import os
from datetime import datetime
import requests
from bs4 import BeautifulSoup

# ======================
# CONFIGURATION (EDIT THIS)
# ======================
YOUR_NAME = "Alex Rivera"
YOUR_SERVICES = "video editing, social media management, websites, apps, and marketing campaigns"
YOUR_VALUE = f"I help businesses like yours execute digital projects—from {YOUR_SERVICES}—at fair, transparent prices."

# Input/Output files
LINKEDIN_EXPORT = "linkedin_export.csv"  # From LinkedIn's official export
ENRICHED_LEADS = "leads.csv"
OUTPUT_DRAFTS = "outreach_drafts.txt"

# Safety limits
MAX_LEADS = 20
WEB_REQUEST_DELAY = 3  # Seconds between public web requests

# ======================
# HELPER FUNCTIONS
# ======================

def guess_and_verify_domain(company_name):
    """Guess company domain and verify it resolves (public data only)"""
    if not company_name or len(company_name) < 2:
        return ""
    
    clean = re.sub(r'[^\w\s]', '', company_name.lower().strip())
    words = [w for w in clean.split() if len(w) > 2]
    if not words:
        return ""
    
    # Try common patterns
    candidates = [
        f"{''.join(words)}.com",
        f"{words[0]}.com",
        f"{''.join(words[:2])}.com" if len(words) > 1 else "",
        f"{words[0]}app.com",
        f"get{words[0]}.com"
    ]
    
    for domain in candidates:
        if not domain or len(domain) < 5:
            continue
        try:
            url = f"https://{domain}"
            response = requests.head(url, timeout=5, allow_redirects=True)
            if response.status_code < 400:
                return url
        except:
            continue
    return ""

def fetch_company_snippet(url, max_chars=200):
    """Get a short public snippet from company homepage"""
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Research; personal use)'}
        response = requests.get(url, headers=headers, timeout=8)
        soup = BeautifulSoup(response.text, 'html.parser')
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = ' '.join(soup.stripped_strings)
        text = re.sub(r'\s+', ' ', text)
        return text[:max_chars]
    except:
        return ""

def get_personalized_hook(headline, company):
    """Generate human-sounding opener based on job title"""
    h = headline.lower()
    if any(kw in h for kw in ['founder', 'ceo', 'owner', 'entrepreneur']):
        return f"building {company} in today's market takes serious vision"
    if any(kw in h for kw in ['video', 'content', 'creator', 'youtube', 'tiktok', 'editor']):
        return f"your content style really stands out"
    if any(kw in h for kw in ['marketing', 'growth', 'campaign', 'social media']):
        return f"your approach to marketing at {company} caught my eye"
    if any(kw in h for kw in ['developer', 'engineer', 'tech', 'app', 'software', 'cto']):
        return f"what you're building at {company} looks technically impressive"
    if any(kw in h for kw in ['design', 'creative', 'brand', 'visual', 'art']):
        return f"your eye for design is evident in {company}'s branding"
    return f"what you're building at {company}"

def generate_draft(first_name, headline, company, company_snippet):
    """Create warm, non-salesy message"""
    hook = get_personalized_hook(headline, company)
    return f"""Hi {first_name},

{hook.capitalize()}!

{YOUR_VALUE}

If you're ever looking to free up time or level up your online presence, I'd be glad to help.

No pressure to reply—just wanted to offer support in case it's useful!

Best regards,
{YOUR_NAME}
"""

# ======================
# MAIN WORKFLOW
# ======================

def main():
    print("🚀 LinkedIn Outreach Pipeline (Compliant Mode)")
    print("=" * 50)
    
    # STEP 1: Check for LinkedIn export
    if not os.path.exists(LINKEDIN_EXPORT):
        print(f"❌ ERROR: '{LINKEDIN_EXPORT}' not found.")
        print("👉 Export leads from LinkedIn Sales Navigator first!")
        return
    
    # STEP 2: Load and enrich leads
    print("Step 1: Enriching leads with company websites...")
    enriched_leads = []
    
    with open(LINKEDIN_EXPORT, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        
        if not rows:
            print("❌ No leads found in export.")
            return
            
        print(f"Found {len(rows)} leads. Processing up to {MAX_LEADS}...\n")
        
        for i, row in enumerate(rows[:MAX_LEADS]):
            name = row.get('Name', '').strip()
            company = row.get('Company', '').strip()
            title = row.get('Title', '').strip()
            
            if not name or not company:
                continue
                
            first_name = name.split()[0] if name else "There"
            
            # Guess & verify domain
            website = guess_and_verify_domain(company)
            print(f" → {first_name} @ {company} → {website or 'No website'}")
            
            enriched_leads.append({
                'first_name': first_name,
                'company': company,
                'headline': title,
                'company_website': website
            })
            
            if i < len(rows[:MAX_LEADS]) - 1:
                time.sleep(WEB_REQUEST_DELAY)
    
    # Save enriched leads
    with open(ENRICHED_LEADS, 'w', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['first_name','company','headline','company_website'])
        writer.writeheader()
        writer.writerows(enriched_leads)
    
    # STEP 3: Generate outreach drafts
    print("\nStep 2: Generating personalized drafts...")
    with open(OUTPUT_DRAFTS, 'w', encoding='utf-8') as f:
        f.write(f"Personalized Outreach Drafts\nGenerated: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
        f.write("="*60 + "\n\n")
        
        for lead in enriched_leads:
            snippet = fetch_company_snippet(lead['company_website']) if lead['company_website'] else ""
            draft = generate_draft(
                lead['first_name'],
                lead['headline'],
                lead['company'],
                snippet
            )
            
            f.write(f"TO: {lead['first_name']} @ {lead['company']}\n")
            f.write(f"ROLE: {lead['headline']}\n")
            f.write("-" * 40 + "\n")
            f.write(draft)
            f.write("\n" + "="*60 + "\n\n")
    
    print(f"\n✅ DONE!")
    print(f"• Enriched leads saved to: {ENRICHED_LEADS}")
    print(f"• Outreach drafts ready: {OUTPUT_DRAFTS}")
    print("\n⚠️  NEXT STEPS:")
    print("1. OPEN 'outreach_drafts.txt'")
    print("2. ADD 1 PERSONAL DETAIL per message (e.g., 'Loved your post about X!')")
    print("3. SEND MANUALLY on LinkedIn (max 20/week)")
    print("4. NEVER automate sending!")

if __name__ == "__main__":
    main()