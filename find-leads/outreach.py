import os
import time
import base64
import logging
from datetime import datetime
from typing import List, Dict, Optional, Any
from email.mime.text import MIMEText

import requests
from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# Load environment variables
load_dotenv()

# === CONFIG ===
APOLLO_API_KEY = os.getenv("APOLLO_API_KEY")
HUNTER_API_KEY = os.getenv("HUNTER_API_KEY")
GOOGLE_SEARCH_API_KEY = os.getenv("GOOGLE_SEARCH_API_KEY")
GOOGLE_SEARCH_ENGINE_ID = os.getenv("GOOGLE_SEARCH_ENGINE_ID")
GOOGLE_SHEET_ID = os.getenv("GOOGLE_SHEET_ID")

USE_APOLLO = True
DRY_RUN = False  # Set to True to test without sending emails
DAILY_EMAIL_LIMIT = 30
DELAY_BETWEEN_EMAILS = 180  # seconds
DELAY_BETWEEN_API_CALLS = 1  # seconds

GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/spreadsheets'
]

TARGET_COMPANIES = [
    "Notion", "Linear", "Figma", "Vercel", "Airtable",
    "Webflow", "Coda", "ClickUp", "Miro", "Zapier"
]

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# === 1. LEAD SOURCING ===
def find_leads_via_apollo() -> Optional[List[Dict[str, Any]]]:
    if not APOLLO_API_KEY:
        logger.warning("Apollo API key missing. Skipping Apollo.")
        return None

    url = "https://api.apollo.io/v1/mixed_people/search"
    headers = {
        "Content-Type": "application/json",
        "X-Api-Key": APOLLO_API_KEY.strip()
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
        response = requests.post(url, json=data, headers=headers, timeout=15)
        if response.status_code == 200:
            people = response.json().get("people", [])
            leads = []
            for person in people:
                email = person.get("email")
                if email:
                    leads.append({
                        "name": person.get("name", "").strip(),
                        "title": person.get("title", ""),
                        "company": person.get("organization", {}).get("name", ""),
                        "email": email,
                        "linkedin_url": person.get("linkedin_url")
                    })
            logger.info(f"Apollo returned {len(leads)} verified leads.")
            return leads[:20]
        else:
            logger.error(f"Apollo API error: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        logger.exception(f"Apollo request failed: {e}")
        return None


def find_company_website(company_name: str) -> Optional[str]:
    if not GOOGLE_SEARCH_API_KEY or not GOOGLE_SEARCH_ENGINE_ID:
        logger.warning("Google Custom Search credentials missing.")
        return None

    query = f"{company_name} official site"
    url = "https://www.googleapis.com/customsearch/v1"
    params = {
        "key": GOOGLE_SEARCH_API_KEY.strip(),
        "cx": GOOGLE_SEARCH_ENGINE_ID.strip(),
        "q": query,
        "num": 1
    }
    try:
        res = requests.get(url, params=params, timeout=10)
        if res.status_code == 200:
            items = res.json().get("items", [])
            if items:
                return items[0]["link"]
    except Exception as e:
        logger.warning(f"Google search failed for {company_name}: {e}")
    return None


def find_leads_via_hunter() -> List[Dict[str, Any]]:
    if not HUNTER_API_KEY:
        logger.error("Hunter API key missing. Cannot fallback.")
        return []

    leads = []
    for company in TARGET_COMPANIES[:10]:
        website = find_company_website(company)
        if not website:
            continue
        domain = website.replace("https://", "").replace("http://", "").split("/")[0]
        if domain.startswith("www."):
            domain = domain[4:]

        hunter_url = "https://api.hunter.io/v2/domain-search"
        params = {
            "domain": domain,
            "api_key": HUNTER_API_KEY.strip(),
            "limit": 1,
            "seniority": "executive,management",
            "department": "marketing"
        }
        try:
            res = requests.get(hunter_url, params=params, timeout=10)
            if res.status_code == 200:
                data = res.json().get("data", {})
                for email_data in data.get("emails", []):
                    confidence = email_data.get("confidence")
                    if confidence in ["high", "medium"]:
                        first = email_data.get("first_name", "")
                        last = email_data.get("last_name", "")
                        name = f"{first} {last}".strip()
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
        except Exception as e:
            logger.warning(f"Hunter failed for {company}: {e}")
        time.sleep(DELAY_BETWEEN_API_CALLS)
    logger.info(f"Hunter fallback found {len(leads)} leads.")
    return leads


def find_leads() -> List[Dict[str, Any]]:
    if USE_APOLLO:
        leads = find_leads_via_apollo()
        if leads is not None:
            logger.info("✅ Using Apollo.io for leads")
            return leads
    logger.info("🔄 Falling back to Hunter.io + Google Search")
    return find_leads_via_hunter()


# === 2. EMAIL & SHEETS ===
def build_message(name: str, company: str, title: str) -> tuple[str, str]:
    role = title.split()[-1].lower() if title else "your space"
    subject = f"Quick idea for {company}?"
    body = f"""Hi {name},

I noticed {company} is scaling fast in {role} — congrats!

We helped a similar team reduce customer churn by 18% with a simple onboarding tweak. 
If useful, I’d share the exact playbook (no pitch).

Either way, keep up the great work!

Best regards,  
[Your Name]  

—  
Unsubscribe or update preferences: [link]  
*We respect your inbox. This message was sent because you fit our ideal customer profile.*
"""
    return subject, body


def get_gmail_service():
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', GMAIL_SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists('credentials.json'):
                raise FileNotFoundError("credentials.json not found. Please download from Google Cloud Console.")
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', GMAIL_SCOPES)
            creds = flow.run_local_server(port=0)
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    return build('gmail', 'v1', credentials=creds)


def send_email(service, to: str, subject: str, body: str):
    if DRY_RUN:
        logger.info(f"[DRY RUN] Would send email to {to}")
        return {"id": "dry_run"}
    message = MIMEText(body)
    message['to'] = to
    message['subject'] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    return service.users().messages().send(userId="me", body={'raw': raw}).execute()


def log_to_sheet(row_data: List[Any]):
    try:
        creds = Credentials.from_authorized_user_file('token.json', GMAIL_SCOPES)
        service = build('sheets', 'v4', credentials=creds)
        service.spreadsheets().values().append(
            spreadsheetId=GOOGLE_SHEET_ID,
            range='A:H',
            valueInputOption='USER_ENTERED',
            body={'values': [row_data]}
        ).execute()
    except Exception as e:
        logger.error(f"Failed to log to Google Sheet: {e}")


# === 3. MAIN ===
def main():
    logger.info("🚀 Starting outreach automation...")
    leads = find_leads()
    logger.info(f"✅ Found {len(leads)} leads")

    if not leads:
        logger.error("❌ No leads found. Check API keys or internet.")
        return

    gmail_service = get_gmail_service()
    email_count = 0

    for lead in leads:
        if email_count >= DAILY_EMAIL_LIMIT:
            logger.info("Reached daily email limit.")
            break

        name = lead["name"]
        company = lead["company"]
        title = lead["title"]
        email = lead["email"]

        if not name or not email:
            logger.warning(f"Skipping lead with missing name/email: {lead}")
            continue

        subject, body = build_message(name, company, title)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")

        try:
            send_email(gmail_service, email, subject, body)
            status = "Sent"
            logger.info(f"✅ Sent to {name} ({email})")
            email_count += 1

            # Log success
            log_to_sheet([
                name, title, company, email, "email",
                body[:100] + "...", timestamp, status
            ])

            if email_count < DAILY_EMAIL_LIMIT:
                logger.info(f"⏳ Sleeping {DELAY_BETWEEN_EMAILS} seconds...")
                time.sleep(DELAY_BETWEEN_EMAILS)

        except Exception as e:
            error_msg = str(e)[:150]
            logger.error(f"❌ Failed to send to {email}: {error_msg}")
            log_to_sheet([
                name, title, company, email, "email",
                "", timestamp, f"Error: {error_msg}"
            ])

        # Suggest LinkedIn message
        role = title.split()[-1].lower() if title else "your space"
        linkedin_msg = f"Hi {name}, loved {company}'s work in {role}! Quick idea to help — happy to share if useful."
        logger.info(f"🔗 [LINKEDIN] Suggested message:\n{linkedin_msg}\n")

    logger.info(f"🎉 Done! Sent {email_count} emails.")


if __name__ == "__main__":
    main()