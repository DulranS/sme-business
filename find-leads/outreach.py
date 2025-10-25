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

# === CONFIG (USE ENV VARS) ===
HUNTER_API_KEY = os.getenv("HUNTER_API_KEY")  # 50 free/mo
GOOGLE_SEARCH_API_KEY = os.getenv("GOOGLE_SEARCH_API_KEY")  # Free 100/day
GOOGLE_SEARCH_ENGINE_ID = os.getenv("GOOGLE_SEARCH_ENGINE_ID")
SHEET_ID = os.getenv("GOOGLE_SHEET_ID")

if not all([HUNTER_API_KEY, GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_ENGINE_ID, SHEET_ID]):
    raise ValueError("❌ Missing env vars. Set: HUNTER_API_KEY, GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_ENGINE_ID, GOOGLE_SHEET_ID")

GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/spreadsheets'
]

DAILY_EMAIL_LIMIT = 30  # Stay safe
DELAY = 180  # 3 mins between emails

# === 1. FIND COMPANY WEBSITE VIA GOOGLE ===
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
    except Exception as e:
        print(f"⚠️ Google Search error: {e}")
    return None

# === 2. FIND EMAIL VIA HUNTER.IO ===
def find_email_from_company(company_name, domain=None):
    if not domain:
        website = find_company_website(company_name)
        if not website:
            return None
        # Extract domain (simple)
        domain = website.replace("https://", "").replace("http://", "").split("/")[0]
        if domain.startswith("www."):
            domain = domain[4:]

    url = "https://api.hunter.io/v2/domain-search"
    params = {
        "domain": domain,
        "api_key": HUNTER_API_KEY,
        "limit": 1,
        "seniority": "executive,management",
        "department": "marketing"
    }
    try:
        res = requests.get(url, params=params, timeout=5)
        if res.status_code == 200:
            data = res.json().get("data", {})
            for email_data in data.get("emails", []):
                if email_data.get("confidence") in ["high", "medium"]:
                    first_name = email_data["first_name"] or ""
                    last_name = email_data["last_name"] or ""
                    name = f"{first_name} {last_name}".strip()
                    if name and email_data["value"]:
                        return {
                            "name": name,
                            "email": email_data["value"],
                            "company": company_name,
                            "title": email_data.get("position", "Marketing Leader")
                        }
    except Exception as e:
        print(f"⚠️ Hunter.io error: {e}")
    return None

# === 3. HARD-CODED TARGET COMPANIES (REPLACE WITH YOUR LIST) ===
TARGET_COMPANIES = [
    "Notion",
    "Linear",
    "Figma",
    "Vercel",
    "Airtable",
    "Webflow",
    "Coda",
    "ClickUp",
    "Miro",
    "Zapier"
]

def find_leads():
    leads = []
    for company in TARGET_COMPANIES[:10]:  # Max 10 to stay under Hunter limit
        print(f"🔍 Searching for lead at {company}...")
        lead = find_email_from_company(company)
        if lead:
            leads.append(lead)
        time.sleep(1)  # Be kind to APIs
    return leads

# === 4. VERIFY EMAIL (Hunter already verifies, so skip extra call) ===
def verify_email(email):
    return True  # Hunter gives verified emails

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

# === 6. GMAIL & SHEETS (SAME AS BEFORE) ===
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
        spreadsheetId=SHEET_ID,
        range='A:H',
        valueInputOption='USER_ENTERED',
        body={'values': [row_data]}
    ).execute()

# === MAIN ===
def main():
    print("🚀 Starting $0 lead gen + outreach...")
    leads = find_leads()
    print(f"✅ Found {len(leads)} leads")

    if not leads:
        print("⚠️ No leads found. Check API keys or company list.")
        return

    gmail_service = get_gmail_service()
    email_count = 0

    for lead in leads:
        if email_count >= DAILY_EMAIL_LIMIT:
            break

        if not verify_email(lead["email"]):
            continue

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
                print(f"⏳ Sleeping {DELAY} sec...")
                time.sleep(DELAY)

        except Exception as e:
            print(f"❌ Error: {str(e)[:150]}")
            log_to_sheet([lead["name"], lead["title"], lead["company"], lead["email"], "email", "", "", "Send failed"])

        # LinkedIn manual message
        role = lead["title"].split()[-1].lower()
        print(f"\n🔗 [LINKEDIN] Send manually:\nHi {lead['name']}, loved {lead['company']}'s work in {role}! Quick idea to help — happy to share if useful.\n")

    print(f"\n🎉 Done! Sent {email_count} emails.")

if __name__ == "__main__":
    main()