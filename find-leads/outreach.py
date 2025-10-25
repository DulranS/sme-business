import os
import requests
import pandas as pd
import time
from datetime import datetime
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from email.mime.text import MIMEText
import base64

# === CONFIG (USE ENV VARS FOR SECURITY) ===
APOLLO_API_KEY = os.getenv("APOLLO_API_KEY")
HUNTER_API_KEY = os.getenv("HUNTER_API_KEY")
SHEET_ID = os.getenv("GOOGLE_SHEET_ID", "YOUR_SHEET_ID_HERE")

if not APOLLO_API_KEY:
    raise ValueError("❌ Missing APOLLO_API_KEY. Set it as an environment variable.")

GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/spreadsheets'
]

DAILY_EMAIL_LIMIT = 40  # Stay under Gmail's radar
DELAY = 150  # 2.5 mins between emails (avoids spam flags)

# === 1. FIND LEADS (Apollo.io) ===
def find_leads(industry="Software", title="Head of Marketing", num_leads=20):
    url = "https://api.apollo.io/v1/mixed_people/search"  # No trailing spaces!
    headers = {
        "Content-Type": "application/json",
        "X-Api-Key": APOLLO_API_KEY
    }
    data = {
        "page": 1,
        "per_page": min(num_leads, 100),  # Apollo max: 100
        "q_organization_industry": industry,
        "q_title": title,
        "person_locations": ["United States"],
        "organization_num_employees_min": 50,
        "organization_num_employees_max": 200,
        "contact_email_status": ["verified"]  # Only get verified emails
    }
    try:
        response = requests.post(url, json=data, headers=headers, timeout=10)
        if response.status_code != 200:
            print(f"❌ Apollo API error: {response.status_code} - {response.text}")
            return []
        
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
        return leads[:num_leads]
    except Exception as e:
        print(f"❌ Apollo request failed: {e}")
        return []

# === 2. VERIFY EMAIL (Hunter.io) ===
def verify_email(email):
    if not HUNTER_API_KEY:
        return True  # Skip if no key
    try:
        url = f"https://api.hunter.io/v2/email-verifier?email={email}&api_key={HUNTER_API_KEY}"
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            status = res.json().get("data", {}).get("status")
            return status in ["valid", "accept_all"]
    except Exception as e:
        print(f"⚠️ Hunter.io error (skipping verify): {e}")
    return True

# === 3. BUILD PERSONALIZED MESSAGE ===
def build_message(name, company, title):
    subject = f"Quick idea for {company}?"
    body = f"""Hi {name},

I noticed {company} is scaling in {title.split()[-1].lower()} — congrats!

We helped a similar team reduce customer churn by 18% with a simple onboarding tweak. 
If useful, I’d share the exact playbook (no pitch).

Either way, keep up the great work!

Best,
[Your Name]
"""
    return subject, body

# === 4. GMAIL SETUP & SEND ===
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

# === 5. LOG TO GOOGLE SHEET ===
def log_to_sheet(row_data):
    creds = Credentials.from_authorized_user_file('token.json', GMAIL_SCOPES)
    service = build('sheets', 'v4', credentials=creds)
    service.spreadsheets().values().append(
        spreadsheetId=SHEET_ID,
        range='A:H',
        valueInputOption='USER_ENTERED',
        body={'values': [row_data]}
    ).execute()

# === MAIN WORKFLOW ===
def main():
    print("🔍 Finding leads...")
    leads = find_leads(industry="Software", title="Head of Marketing", num_leads=20)
    print(f"✅ Found {len(leads)} leads")

    if not leads:
        print("⚠️ No leads found. Check Apollo filters or API key.")
        return

    gmail_service = get_gmail_service()
    email_count = 0

    for lead in leads:
        if email_count >= DAILY_EMAIL_LIMIT:
            print("📧 Daily email limit reached.")
            break

        # Verify email (skip if invalid)
        if not verify_email(lead["email"]):
            print(f"❌ Skipping invalid email: {lead['email']}")
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
                print(f"⏳ Sleeping {DELAY} seconds before next email...")
                time.sleep(DELAY)

        except Exception as e:
            error_msg = str(e)[:200]
            print(f"❌ Failed to send to {lead['email']}: {error_msg}")
            log_to_sheet([
                lead["name"], lead["title"], lead["company"], lead["email"],
                "email", "", "", f"Error: {error_msg}"
            ])

        # LinkedIn manual message (safe!)
        role = lead["title"].split()[-1].lower() if lead["title"] else "your space"
        linkedin_msg = f"Hi {lead['name']}, loved what {lead['company']} is doing in {role}! I had a quick idea to help — if useful, I’d share it (no pitch)."
        print(f"\n🔗 [LINKEDIN] Copy-paste to send manually:\n{linkedin_msg}\n")

    print(f"\n🎉 Done! Sent {email_count} emails. {len(leads)} LinkedIn messages ready.")

if __name__ == "__main__":
    main()