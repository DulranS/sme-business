"""
Safely enrich LinkedIn-exported leads with company websites
using public data (Clearbit, company domain guesses).
NO LINKEDIN SCRAPING.
"""

import csv
import time
import requests
import re

LINKEDIN_CSV = "linkedin_export.csv"  # From Sales Navigator
ENRICHED_CSV = "leads.csv"

def guess_company_domain(company_name):
    """Guess domain from company name (public data only)"""
    if not company_name:
        return ""
    
    # Clean company name
    clean = re.sub(r'[^\w\s]', '', company_name.lower())
    words = clean.split()
    
    # Try common patterns
    candidates = [
        f"{''.join(words)}.com",
        f"{words[0]}.com",
        f"{''.join(words[:2])}.com" if len(words) > 1 else "",
    ]
    
    for domain in candidates:
        if domain and is_valid_domain(domain):
            return f"https://{domain}"
    return ""

def is_valid_domain(domain):
    """Check if domain resolves (lightweight)"""
    try:
        response = requests.head(f"https://{domain}", timeout=5, allow_redirects=True)
        return response.status_code < 400
    except:
        return False

def main():
    with open(LINKEDIN_CSV, 'r', encoding='utf-8') as f_in:
        reader = csv.DictReader(f_in)
        leads = []
        for row in reader:
            # Map LinkedIn's export columns
            first_name = row.get('Name', '').split()[0] if row.get('Name') else 'Unknown'
            company = row.get('Company', '')
            
            lead = {
                'first_name': first_name,
                'last_name': '',  # Not always in export
                'company': company,
                'headline': row.get('Title', ''),
                'company_website': guess_company_domain(company)
            }
            leads.append(lead)
            time.sleep(1)  # Be kind to DNS

    # Save enriched CSV
    with open(ENRICHED_CSV, 'w', encoding='utf-8') as f_out:
        writer = csv.DictWriter(f_out, fieldnames=leads[0].keys())
        writer.writeheader()
        writer.writerows(leads)
    
    print(f"✅ Enriched {len(leads)} leads → {ENRICHED_CSV}")

if __name__ == "__main__":
    main()