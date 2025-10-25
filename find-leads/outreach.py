import os
import requests
import time
from datetime import datetime
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from email.mime.text import MIMEText
import base64

# === CONFIG (HARDCODED FOR TESTING ONLY) ===
APOLLO_API_KEY = "xJt-EnnoiYBbX9LvCG-6u"  # ⚠️ From apollo.io (likely inactive in 2025)
HUNTER_API_KEY = "b7365d0ed1796ba7c82e51363db7c29353dcb5c7"
GOOGLE_SHEET_ID = "Y1HhNMNiQdeOtbUeog1Q2JczCrP4-58Zi0SASqdW7yJRw"
GOOGLE_SEARCH_API_KEY = "AIzaSyAMFaeJPb0XGiUh4OnJMVl7jce87aVvWrA"
GOOGLE_SEARCH_ENGINE_ID = "53e151b118e714d88"

# Fallback: Use Apollo if key works, else use Hunter + Google
USE_APOLLO = True  # Set to False if Apollo fails

GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/spreadsheets'
]

DAILY_EMAIL_LIMIT = 30
DELAY = 180  # 3 minutes

# === 1. FIND LEADS VIA APOLLO (IF WORKING) ===
def find_leads_via_apollo():
    url = "https://api.apollo.io/v1/mixed_people/search"
    headers = {
        "Content-Type": "application/json",
        "X-Api-Key": APOLLO_API_KEY
    }
    data = {
        "page": 1,
        "per_page": 20,
        "q_organization_industry": "Software",
        "q_title": "Head of Marketing",
        "person_locations": ["United States"],
        "organization_num_employees_min": 50,
        "organization_num_employees_max": 200,
        "contact_email_status": ["verified"]
    }
    try:
        response = requests.post(url, json=data, headers=headers, timeout=10)
        if response.status_code == 200:
            leads = []
            for person in response.json().get("people", []):
                if person.get("email"):
                    leads.append({
                        "name": person.get("name"),
                        "title": person.get("title"),
                        "company": person.get("organization", {}).get("name"),
                        "email": person.get("email"),
                        "linkedin_url": person.get("linkedin_url")
                    })
            return leads[:20]
        else:
            print(f"❌ Apollo returned {response.status_code}. Trying fallback...")
            return None
    except Exception as e:
        print(f"❌ Apollo failed: {e}")
        return None

# === 2. FALLBACK: HUNTER + GOOGLE SEARCH ===
def find_company_website(company_name):
    query = f"{company_name} official site"
    url = "https://www.googleapis.com/customsearch/v1"
    params = {
        "key": GOOGLE_SEARCH_API_KEY,
        "cx": GOOGLE_SEARCH_ENGINE_ID,
        "q": query,
        "num": 1
    }
    try:
        res = requests.get(url, params=params, timeout=5)
        if res.status_code == 200:
            items = res.json().get("items", [])
            if items:
                return items[0]["link"]
    except:
        pass
    return None

def find_leads_via_hunter():
    TARGET_COMPANIES = [
        "Notion", "Linear", "Figma", "Vercel", "Airtable",
        "Webflow", "Coda", "ClickUp", "Miro", "Zapier"
    ]
    leads = []
    for company in TARGET_COMPANIES[:10]:
        website = find_company_website(company)
        if not website:
            continue
        domain = website.replace("https://", "").replace("http://", "").split("/")[0]
        if domain.startswith("www."):
            domain = domain[4:]

        # Hunter domain search
        hunter_url = "https://api.hunter.io/v2/domain-search"
        params = {
            "domain": domain,
            "api_key": HUNTER_API_KEY,
            "limit": 1,
            "seniority": "executive,management",
            "department": "marketing"
        }
        try:
            res = requests.get(hunter_url, params=params, timeout=5)
            if res.status_code == 200:
                data = res.json().get("data", {})
                for email_data in data.get("emails", []):
                    if email_data.get("confidence") in ["high", "medium"]:
                        name = f"{email_data.get('first_name', '')} {email_data.get('last_name', '')}".strip()
                        email = email_data.get("value")
                        if name and email:
                            leads.append({
                                "name": name,
                                "title": email_data.get("position", "Marketing Leader"),
                                "company": company,
                                "email": email,
                                "linkedin_url": None
                            })
                            break
        except:
            continue
        time.sleep(1)
    return leads

# === 3. GET LEADS (PREFER APOLLO, FALLBACK TO HUNTER) ===
def find_leads():
    if USE_APOLLO:
        leads = find_leads_via_apollo()
        if leads is not None:
            print("✅ Using Apollo.io for leads")
            return leads
    print("🔄 Falling back to Hunter.io + Google Search")
    return find_leads_via_hunter()

# === 4. VERIFY EMAIL (SKIP IF USING HUNTER) ===
def verify_email(email):
    return True  # Hunter already verifies; Apollo returns verified

# === 5. BUILD MESSAGE ===
def build_message(name, company, title):
    subject = f"Quick idea for {company}?"
    body = f"""Hi {name},

I noticed {company} is scaling fast in {title.split()[-1].lower()} — congrats!

We helped a similar team reduce customer churn by 18% with a simple onboarding tweak. 
If useful, I’d share the exact playbook (no pitch).

Either way, keep up the great work!

Best,
[Your Name]
"""
    return subject, body

# === 6. GMAIL & SHEETS ===
def get_gmail_service():
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', GMAIL_SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', GMAIL_SCOPES)
            creds = flow.run_local_server(port=0)
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    return build('gmail', 'v1', credentials=creds)

def send_email(service, to, subject, body):
    message = MIMEText(body)
    message['to'] = to
    message['subject'] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    return service.users().messages().send(userId="me", body={'raw': raw}).execute()

def log_to_sheet(row_data):
    creds = Credentials.from_authorized_user_file('token.json', GMAIL_SCOPES)
    service = build('sheets', 'v4', credentials=creds)
    service.spreadsheets().values().append(
        spreadsheetId=GOOGLE_SHEET_ID,
        range='A:H',
        valueInputOption='USER_ENTERED',
        body={'values': [row_data]}
    ).execute()

# === MAIN ===
def main():
    print("🚀 Starting outreach with hardcoded keys...")
    leads = find_leads()
    print(f"✅ Found {len(leads)} leads")

    if not leads:
        print("❌ No leads found. Check API keys or internet.")
        return

    gmail_service = get_gmail_service()
    email_count = 0

    for lead in leads:
        if email_count >= DAILY_EMAIL_LIMIT:
            break

        subject, body = build_message(lead["name"], lead["company"], lead["title"])
        
        try:
            send_email(gmail_service, lead["email"], subject, body)
            print(f"✅ Sent to {lead['name']} ({lead['email']})")
            
            log_to_sheet([
                lead["name"],
                lead["title"],
                lead["company"],
                lead["email"],
                "email",
                body[:100] + "...",
                datetime.now().strftime("%Y-%m-%d %H:%M"),
                "Sent"
            ])
            
            email_count += 1
            if email_count < DAILY_EMAIL_LIMIT:
                print(f"⏳ Sleeping {DELAY} seconds...")
                time.sleep(DELAY)

        except Exception as e:
            error_msg = str(e)[:150]
            print(f"❌ Failed: {error_msg}")
            log_to_sheet([
                lead["name"], lead["title"], lead["company"], lead["email"],
                "email", "", "", f"Error: {error_msg}"
            ])

        # LinkedIn manual message
        role = lead["title"].split()[-1].lower() if lead["title"] else "your space"
        print(f"\n🔗 [LINKEDIN] Copy-paste:\nHi {lead['name']}, loved {lead['company']}'s work in {role}! Quick idea to help — happy to share if useful.\n")

    print(f"\n🎉 Done! Sent {email_count} emails.")

if __name__ == "__main__":
    main()