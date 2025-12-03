"""
whatsapp_lead_preparer.py

🌍 GLOBAL WHATSAPP LEAD PREPARER — Multi-Country Support
✅ Automatic phone validation for 195+ countries
✅ Intelligent mobile vs landline detection
✅ Multi-language support
✅ Carrier detection (where applicable)
✅ International E.164 formatting
✅ Deduplication & prioritization

POWERED BY: phonenumbers library (Google's libphonenumber)
"""

import pandas as pd
import re
import os
import json
import logging
import yaml
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

# Import phonenumbers for international phone validation
try:
    import phonenumbers
    from phonenumbers import geocoder, carrier
except ImportError:
    raise ImportError(
        "Please install phonenumbers: pip install phonenumbers"
    )

# ==============================
# 🔧 CONFIGURATION
# ==============================

SCRIPT_DIR = Path(__file__).parent.resolve()
CONFIG_FILE = SCRIPT_DIR / "country_config.yaml"

def load_country_config():
    """Load country configuration."""
    default_config = {
        "country_code": "LK",
        "country_name": "Sri Lanka",
        "phone_country_code": "+94",
        "phone_number_length": 9,
        "language": "en"
    }
    
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                yaml_config = yaml.safe_load(f)
                if yaml_config:
                    default_config.update(yaml_config)
        except Exception:
            pass
    
    # Environment variable overrides
    env_overrides = {
        "country_code": os.getenv("COUNTRY_CODE"),
        "phone_country_code": os.getenv("PHONE_COUNTRY_CODE"),
    }
    
    for key, value in env_overrides.items():
        if value:
            default_config[key] = value
    
    return default_config

CONFIG = load_country_config()

# I/O Paths
INPUT_FILE = Path(os.getenv("INPUT_FILE", "b2b_leads.csv"))
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "whatsapp_ready"))
OUTPUT_DIR.mkdir(exist_ok=True)

WHATSAPP_CSV = OUTPUT_DIR / "whatsapp_leads_prioritized.csv"
WHATSAPP_JSON = OUTPUT_DIR / "whatsapp_leads_bulk.json"
CRM_IMPORT = OUTPUT_DIR / "crm_import_ready.csv"
REJECTED_FILE = OUTPUT_DIR / "rejected_leads.csv"
LOG_FILE = OUTPUT_DIR / "whatsapp_prep.log"

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("WhatsAppPrep")

# ==============================
# 📱 GLOBAL PHONE VALIDATION
# ==============================

def parse_and_validate_phone(raw_phone, default_region=None):
    """
    Universal phone number parser using Google's phonenumbers library.
    
    Returns: {
        "original": str,
        "is_valid": bool,
        "e164": str (international format),
        "national": str,
        "country_code": str,
        "region": str,
        "type": str (MOBILE, FIXED_LINE, etc.),
        "carrier": str (if available),
        "rejection_reason": str
    }
    """
    result = {
        "original": raw_phone,
        "is_valid": False,
        "e164": None,
        "national": None,
        "country_code": None,
        "region": None,
        "type": None,
        "carrier": None,
        "rejection_reason": "Unknown"
    }
    
    if pd.isna(raw_phone) or str(raw_phone).strip() == "":
        result["rejection_reason"] = "Empty"
        return result
    
    # Use configured country as default region
    if not default_region:
        default_region = CONFIG["country_code"]
    
    try:
        # Parse phone number
        parsed = phonenumbers.parse(str(raw_phone), default_region)
        
        # Validate
        if not phonenumbers.is_valid_number(parsed):
            result["rejection_reason"] = "Invalid format"
            return result
        
        # Get number type
        number_type = phonenumbers.number_type(parsed)
        type_names = {
            0: "FIXED_LINE",
            1: "MOBILE",
            2: "FIXED_LINE_OR_MOBILE",
            3: "TOLL_FREE",
            4: "PREMIUM_RATE",
            5: "SHARED_COST",
            6: "VOIP",
            7: "PERSONAL_NUMBER",
            8: "PAGER",
            9: "UAN",
            10: "VOICEMAIL",
            -1: "UNKNOWN"
        }
        
        type_name = type_names.get(number_type, "UNKNOWN")
        
        # Only accept mobile or mobile-capable numbers
        if number_type not in [1, 2]:  # MOBILE or FIXED_LINE_OR_MOBILE
            result["rejection_reason"] = f"Not mobile ({type_name})"
            return result
        
        # Extract information
        result["is_valid"] = True
        result["e164"] = phonenumbers.format_number(
            parsed, 
            phonenumbers.PhoneNumberFormat.E164
        )
        result["national"] = phonenumbers.format_number(
            parsed,
            phonenumbers.PhoneNumberFormat.NATIONAL
        )
        result["country_code"] = f"+{parsed.country_code}"
        result["region"] = phonenumbers.region_code_for_number(parsed)
        result["type"] = type_name
        
        # Try to get carrier name (not available in all countries)
        try:
            carrier_name = carrier.name_for_number(parsed, "en")
            if carrier_name:
                result["carrier"] = carrier_name
        except:
            pass
        
        result["rejection_reason"] = "Valid"
        
    except phonenumbers.NumberParseException as e:
        result["rejection_reason"] = f"Parse error: {e}"
    except Exception as e:
        result["rejection_reason"] = f"Error: {str(e)}"
    
    return result

def generate_wa_link(e164_number, prefilled_message=None):
    """Generate WhatsApp link from E.164 formatted number."""
    if not e164_number:
        return ""
    
    # Remove + from E.164 format for WhatsApp URL
    clean_number = e164_number.replace("+", "")
    base_url = f"https://wa.me/{clean_number}"
    
    if prefilled_message:
        encoded_msg = prefilled_message.replace(" ", "%20").replace("\n", "%0A")
        return f"{base_url}?text={encoded_msg}"
    
    return base_url

# ==============================
# 🎯 DEDUPLICATION
# ==============================

def deduplicate_leads(df):
    """Multi-level deduplication."""
    initial_count = len(df)
    
    # Sort by priority score first
    df = df.sort_values("outreach_score", ascending=False)
    
    # Remove exact phone duplicates
    df = df.drop_duplicates(subset=["e164_phone"], keep="first")
    after_phone = len(df)
    
    # Remove duplicate business names
    df["business_key"] = df["business_name"].fillna("").str.lower().str.replace(r'[^\w\s]', '', regex=True)
    df = df.drop_duplicates(subset=["business_key"], keep="first")
    after_business = len(df)
    
    # Remove duplicate emails (if present)
    if "email" in df.columns:
        email_mask = df["email"].notna() & (df["email"] != "")
        email_df = df[email_mask]
        if len(email_df) > 0:
            df = df.drop_duplicates(subset=["email"], keep="first")
    after_email = len(df)
    
    df = df.drop(columns=["business_key"], errors="ignore")
    
    logger.info(f"📊 Deduplication:")
    logger.info(f"   Phone: -{initial_count - after_phone}")
    logger.info(f"   Business: -{after_phone - after_business}")
    logger.info(f"   Email: -{after_business - after_email}")
    logger.info(f"   Final: {after_email} unique leads")
    
    return df

# ==============================
# 🏆 LEAD SCORING
# ==============================

def calculate_outreach_score(row):
    """Calculate outreach priority (0-100)."""
    score = 0
    
    quality = str(row.get("lead_quality", "")).upper()
    if "HOT" in quality or "🔥" in quality:
        score += 40
    elif "WARM" in quality or "⭐" in quality:
        score += 30
    elif "POTENTIAL" in quality or "💼" in quality:
        score += 20
    else:
        score += 10
    
    has_email = pd.notna(row.get("email")) and str(row.get("email")).strip() not in ["", "N/A"]
    has_website = pd.notna(row.get("website")) and str(row.get("website")).strip() not in ["", "N/A"]
    has_phone = pd.notna(row.get("e164_phone"))
    
    if has_email: score += 20
    if has_website: score += 10
    if has_phone: score += 10
    
    rating = float(row.get("rating", 0))
    if rating >= 4.5: score += 15
    elif rating >= 4.0: score += 10
    
    reviews = int(row.get("review_count", 0))
    if reviews >= 100: score += 5
    elif reviews >= 30: score += 3
    
    return min(score, 100)

def assign_priority(score):
    """Convert score to priority tier."""
    if score >= 80: return "🔥 PRIORITY 1"
    elif score >= 60: return "⭐ PRIORITY 2"
    elif score >= 40: return "💼 PRIORITY 3"
    else: return "📋 PRIORITY 4"

# ==============================
# 💬 MESSAGE TEMPLATES
# ==============================

def generate_message_template(row):
    """Create personalized opener."""
    name = row.get("contact_name", "")
    business = row.get("business_name", name)
    rating = row.get("rating", 0)
    
    if rating >= 4.5:
        opener = f"Hi {name}! 👋 I noticed {business} has an excellent {rating}⭐ rating."
    elif rating >= 4.0:
        opener = f"Hi {name}! I came across {business} and was impressed by your work."
    else:
        opener = f"Hi {name}! I wanted to reach out regarding {business}."
    
    template = f"""{opener}

[YOUR PITCH HERE - customize based on your service]

Would you be open to a brief call this week?

Best regards,
[YOUR NAME]
[YOUR COMPANY]"""
    
    return template

# ==============================
# 👤 CONTACT NAME
# ==============================

def build_contact_name(row):
    """Build display name."""
    business = str(row.get("business_name", "")).strip()
    if business and business not in ["", "Unknown", "Unknown Business", "N/A"]:
        return business
    
    first = str(row.get("first_name", "")).strip() if pd.notna(row.get("first_name")) else ""
    last = str(row.get("last_name", "")).strip() if pd.notna(row.get("last_name")) else ""
    if first or last:
        return f"{first} {last}".strip()
    
    for col in ["company", "name", "place_name"]:
        if pd.notna(row.get(col)):
            val = str(row[col]).strip()
            if val not in ["", "Unknown", "N/A"]:
                return val
    
    return "Business Contact"

# ==============================
# 📅 FOLLOW-UP SCHEDULING
# ==============================

def suggest_followup_schedule(priority):
    """Suggest follow-up timing."""
    today = datetime.now()
    
    if "PRIORITY 1" in priority:
        return {
            "first_contact": today.strftime("%Y-%m-%d"),
            "follow_up_1": (today + timedelta(days=2)).strftime("%Y-%m-%d"),
            "follow_up_2": (today + timedelta(days=5)).strftime("%Y-%m-%d"),
        }
    elif "PRIORITY 2" in priority:
        return {
            "first_contact": today.strftime("%Y-%m-%d"),
            "follow_up_1": (today + timedelta(days=3)).strftime("%Y-%m-%d"),
            "follow_up_2": (today + timedelta(days=7)).strftime("%Y-%m-%d"),
        }
    else:
        return {
            "first_contact": (today + timedelta(days=1)).strftime("%Y-%m-%d"),
            "follow_up_1": (today + timedelta(days=7)).strftime("%Y-%m-%d"),
            "follow_up_2": (today + timedelta(days=14)).strftime("%Y-%m-%d"),
        }

# ==============================
# 🚀 MAIN PROCESSING
# ==============================

def prepare_whatsapp_leads():
    logger.info("🚀 GLOBAL WHATSAPP LEAD PREPARATION")
    logger.info("=" * 70)
    logger.info(f"🌍 Target Country: {CONFIG['country_name']}")
    logger.info(f"📞 Phone Format: {CONFIG['phone_country_code']}")
    logger.info("=" * 70)

    if not INPUT_FILE.exists():
        logger.error(f"❌ Input file not found: {INPUT_FILE}")
        return

    # Load data
    df = pd.read_csv(INPUT_FILE)
    logger.info(f"📥 Loaded {len(df)} leads")

    # Find phone column
    phone_cols = ["phone", "phone_number", "formatted_phone_number", "mobile", "contact"]
    phone_col = next((col for col in phone_cols if col in df.columns), None)
    
    if not phone_col:
        logger.error(f"❌ No phone column found in: {list(df.columns)}")
        return

    logger.info(f"📞 Using phone column: '{phone_col}'")

    # Build contact names
    df["contact_name"] = df.apply(build_contact_name, axis=1)

    # Parse and validate phone numbers
    logger.info("📱 Validating phone numbers globally...")
    
    phone_results = df[phone_col].apply(
        lambda x: parse_and_validate_phone(x, CONFIG["country_code"])
    )
    
    # Extract parsed phone data
    df["is_valid_mobile"] = [r["is_valid"] for r in phone_results]
    df["e164_phone"] = [r["e164"] for r in phone_results]
    df["national_phone"] = [r["national"] for r in phone_results]
    df["phone_country"] = [r["region"] for r in phone_results]
    df["phone_type"] = [r["type"] for r in phone_results]
    df["carrier"] = [r["carrier"] for r in phone_results]
    df["rejection_reason"] = [r["rejection_reason"] for r in phone_results]

    # Split valid vs invalid
    valid_df = df[df["is_valid_mobile"]].copy()
    invalid_df = df[~df["is_valid_mobile"]].copy()

    logger.info(f"✅ Valid mobile: {len(valid_df)}")
    logger.info(f"❌ Invalid: {len(invalid_df)}")

    if len(valid_df) == 0:
        logger.warning("⚠️ No valid mobile numbers!")
        invalid_df.to_csv(REJECTED_FILE, index=False)
        return

    # Calculate scores
    logger.info("🏆 Calculating outreach scores...")
    valid_df["outreach_score"] = valid_df.apply(calculate_outreach_score, axis=1)
    valid_df["priority"] = valid_df["outreach_score"].apply(assign_priority)

    # Deduplicate
    valid_df = deduplicate_leads(valid_df)

    # Sort by priority
    valid_df = valid_df.sort_values(["outreach_score", "contact_name"], ascending=[False, True])

    # Generate WhatsApp assets
    logger.info("💬 Generating WhatsApp links...")
    valid_df["whatsapp_link"] = valid_df["e164_phone"].apply(generate_wa_link)
    valid_df["message_template"] = valid_df.apply(generate_message_template, axis=1)
    
    # Add follow-up schedule
    followup_data = valid_df["priority"].apply(suggest_followup_schedule)
    valid_df["first_contact_date"] = [f["first_contact"] for f in followup_data]
    valid_df["follow_up_1_date"] = [f["follow_up_1"] for f in followup_data]

    # Export WhatsApp CSV
    whatsapp_columns = [
        "priority", "outreach_score", "contact_name", "e164_phone", "national_phone",
        "whatsapp_link", "carrier", "phone_country", "business_name", "category",
        "email", "website", "address", "rating", "review_count",
        "first_contact_date", "tags"
    ]
    whatsapp_columns = [col for col in whatsapp_columns if col in valid_df.columns]
    whatsapp_df = valid_df[whatsapp_columns].copy()
    whatsapp_df.to_csv(WHATSAPP_CSV, index=False)

    # Export JSON for bulk tools
    bulk_data = []
    for _, row in valid_df.iterrows():
        bulk_data.append({
            "name": row["contact_name"],
            "phone": row["e164_phone"],
            "message": row["message_template"],
            "priority": row["priority"],
            "scheduled_date": row["first_contact_date"]
        })
    
    with open(WHATSAPP_JSON, 'w', encoding='utf-8') as f:
        json.dump(bulk_data, f, indent=2, ensure_ascii=False)

    # Export CRM format
    crm_columns = [
        "contact_name", "e164_phone", "email", "business_name",
        "category", "website", "address", "rating", "priority", "tags"
    ]
    crm_columns = [col for col in crm_columns if col in valid_df.columns]
    crm_df = valid_df[crm_columns].copy()
    crm_df = crm_df.rename(columns={
        "e164_phone": "Phone",
        "contact_name": "Contact Name",
        "business_name": "Company"
    })
    crm_df.to_csv(CRM_IMPORT, index=False)

    # Save rejected
    if len(invalid_df) > 0:
        invalid_df.to_csv(REJECTED_FILE, index=False)

    # Statistics
    logger.info("\n" + "=" * 70)
    logger.info("✅ PROCESSING COMPLETE")
    logger.info("=" * 70)
    
    priority_counts = valid_df["priority"].value_counts().to_dict()
    logger.info("\n📊 PRIORITY BREAKDOWN:")
    for priority, count in sorted(priority_counts.items()):
        logger.info(f"   {priority}: {count} leads")
    
    if "carrier" in valid_df.columns:
        carrier_counts = valid_df["carrier"].value_counts().head(5).to_dict()
        logger.info("\n📱 TOP CARRIERS:")
        for carrier_name, count in carrier_counts.items():
            logger.info(f"   {carrier_name or 'Unknown'}: {count}")
    
    success_rate = len(valid_df) / len(df) * 100
    logger.info(f"\n📈 SUCCESS METRICS:")
    logger.info(f"   Total input: {len(df)}")
    logger.info(f"   Valid mobile: {len(valid_df)}")
    logger.info(f"   Success rate: {success_rate:.1f}%")
    logger.info(f"   Avg score: {valid_df['outreach_score'].mean():.1f}/100")
    
    if len(invalid_df) > 0:
        top_rejections = invalid_df["rejection_reason"].value_counts().head(3).to_dict()
        logger.info("\n❌ TOP REJECTION REASONS:")
        for reason, count in top_rejections.items():
            logger.info(f"   {reason}: {count}")
    
    logger.info(f"\n📁 OUTPUT FILES:")
    logger.info(f"   WhatsApp CSV: {WHATSAPP_CSV}")
    logger.info(f"   Bulk JSON: {WHATSAPP_JSON}")
    logger.info(f"   CRM Import: {CRM_IMPORT}")
    logger.info(f"   Rejected: {REJECTED_FILE}")
    
    logger.info("\n✅ Ready for outreach!")
    
    return WHATSAPP_CSV

if __name__ == "__main__":
    prepare_whatsapp_leads()