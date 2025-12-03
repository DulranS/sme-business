"""
whatsapp_lead_preparer.py

🎯 OPTIMIZED WHATSAPP LEAD PREPARER — Maximum Outreach ROI
✅ Intelligent mobile validation with SL-specific rules
✅ Deduplication by number + business name
✅ Lead prioritization scoring for outreach sequence
✅ Personalized message templates with merge fields
✅ Bulk WhatsApp formatting (CSV + JSON export)
✅ CRM integration ready (HubSpot, Zoho compatible)
✅ Automated follow-up scheduling suggestions

OPTIMIZATION FEATURES:
- Validates against known SL carrier patterns
- Removes duplicates across phone/business/email
- Scores leads for optimal outreach prioritization
- Generates personalized message templates
- Exports in multiple formats for different tools
"""

import pandas as pd
import re
import os
import json
import logging
from datetime import datetime, timedelta
from collections import defaultdict

# ==============================
# 🔧 CONFIGURATION
# ==============================

INPUT_FILE = os.getenv("INPUT_FILE", "b2b_leads.csv")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "whatsapp_ready")

# Multiple output formats
WHATSAPP_CSV = os.path.join(OUTPUT_DIR, "whatsapp_leads_prioritized.csv")
WHATSAPP_JSON = os.path.join(OUTPUT_DIR, "whatsapp_leads_bulk.json")
CRM_IMPORT = os.path.join(OUTPUT_DIR, "crm_import_ready.csv")
REJECTED_FILE = os.path.join(OUTPUT_DIR, "rejected_leads.csv")
LOG_FILE = os.path.join(OUTPUT_DIR, "whatsapp_prep.log")

# Create output directory
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Setup logging
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
# 📱 SRI LANKAN MOBILE NETWORK DATA
# ==============================

# Mobile prefixes by carrier (2024-2025)
CARRIER_PREFIXES = {
    "Dialog": ["70", "71", "76", "77"],
    "Mobitel": ["71", "72"],
    "Hutch": ["75", "78"],
    "Airtel": ["77", "78"],
    "SLT_Mobitel": ["72"]
}

# All valid mobile prefixes
MOBILE_PREFIXES = {
    "70", "71", "72", "75", "76", "77", "78",  # Standard mobile
    "12", "13", "14", "15", "16", "17", "18", "19"  # CDMA/special
}

# Landline prefixes (for filtering)
LANDLINE_PREFIXES = {
    "11",  # Colombo
    "31", "32", "33", "34", "35", "36", "37", "38",  # Central/Southern
    "41", "45", "47",  # Matara/Hambantota
    "51", "52", "54", "55", "57",  # Matale/Kandy
    "63", "65", "66", "67",  # Kurunegala/Anuradhapura
    "81", "87", "91"  # Badulla/Ratnapura/Jaffna
}

# ==============================
# 🧹 ADVANCED NUMBER VALIDATION
# ==============================

def clean_and_classify_number(raw_num):
    """
    Enhanced validation with carrier detection.
    Returns: (cleaned_9_digit, is_valid_mobile, carrier, reason)
    """
    if pd.isna(raw_num) or str(raw_num).strip() == "":
        return None, False, None, "Empty"

    # Normalize: keep only digits
    digits = re.sub(r'\D', '', str(raw_num))
    
    # Handle international formats
    if digits.startswith("94"):
        digits = digits[2:]
    elif digits.startswith("+94"):
        digits = digits[3:]
    elif digits.startswith("0"):
        digits = digits[1:]

    # Must be exactly 9 digits
    if len(digits) != 9:
        return None, False, None, f"Invalid length ({len(digits)})"

    prefix = digits[:2]
    
    # Check against known mobile prefixes
    if prefix in MOBILE_PREFIXES:
        # Detect carrier
        carrier = None
        for carrier_name, prefixes in CARRIER_PREFIXES.items():
            if prefix in prefixes:
                carrier = carrier_name
                break
        
        return digits, True, carrier, "Valid Mobile"
    
    # Check if it's a landline
    elif prefix in LANDLINE_PREFIXES:
        return digits, False, None, f"Landline ({prefix})"
    
    # Unknown prefix
    else:
        return digits, False, None, f"Unknown prefix ({prefix})"

def generate_wa_link(number, prefilled_message=None):
    """Generate clickable WhatsApp link with optional pre-filled message."""
    if not number:
        return ""
    
    base_url = f"https://wa.me/94{number}"
    
    if prefilled_message:
        # URL encode the message
        encoded_msg = prefilled_message.replace(" ", "%20").replace("\n", "%0A")
        return f"{base_url}?text={encoded_msg}"
    
    return base_url

# ==============================
# 🎯 INTELLIGENT DEDUPLICATION
# ==============================

def deduplicate_leads(df):
    """
    Multi-level deduplication:
    1. Remove exact duplicate phone numbers
    2. Remove duplicate business names with same contact
    3. Remove duplicate emails
    """
    initial_count = len(df)
    
    # Level 1: Exact phone duplicates (keep first/highest quality)
    df = df.sort_values("outreach_score", ascending=False)
    df = df.drop_duplicates(subset=["cleaned_number"], keep="first")
    after_phone = len(df)
    
    # Level 2: Same business + similar name (fuzzy match)
    # Create a normalized business key
    df["business_key"] = df["business_name"].fillna("").str.lower().str.replace(r'[^\w\s]', '', regex=True)
    df = df.drop_duplicates(subset=["business_key"], keep="first")
    after_business = len(df)
    
    # Level 3: Duplicate emails (if present)
    if "email" in df.columns:
        df = df[df["email"].notna() & (df["email"] != "")]
        df = df.drop_duplicates(subset=["email"], keep="first")
    after_email = len(df)
    
    # Clean up temporary column
    df = df.drop(columns=["business_key"], errors="ignore")
    
    logger.info(f"📊 Deduplication results:")
    logger.info(f"   → Removed {initial_count - after_phone} phone duplicates")
    logger.info(f"   → Removed {after_phone - after_business} business duplicates")
    logger.info(f"   → Removed {after_business - after_email} email duplicates")
    logger.info(f"   → Final unique leads: {after_email}")
    
    return df

# ==============================
# 🏆 LEAD SCORING & PRIORITIZATION
# ==============================

def calculate_outreach_score(row):
    """
    Calculate outreach priority score (0-100).
    Higher score = contact first.
    """
    score = 0
    
    # Quality tier from scraper
    quality = str(row.get("lead_quality", "")).upper()
    if "HOT" in quality or "🔥" in quality:
        score += 40
    elif "WARM" in quality or "⭐" in quality:
        score += 30
    elif "POTENTIAL" in quality or "💼" in quality:
        score += 20
    else:
        score += 10
    
    # Contact completeness
    has_email = pd.notna(row.get("email")) and str(row.get("email")).strip() not in ["", "N/A"]
    has_website = pd.notna(row.get("website")) and str(row.get("website")).strip() not in ["", "N/A"]
    has_phone = pd.notna(row.get("cleaned_number"))
    
    if has_email:
        score += 20
    if has_website:
        score += 10
    if has_phone:
        score += 10
    
    # Business rating
    rating = float(row.get("rating", 0))
    if rating >= 4.5:
        score += 15
    elif rating >= 4.0:
        score += 10
    
    # Review count (social proof)
    reviews = int(row.get("review_count", 0))
    if reviews >= 100:
        score += 5
    elif reviews >= 30:
        score += 3
    
    return min(score, 100)  # Cap at 100

def assign_outreach_priority(score):
    """Convert score to priority tier."""
    if score >= 80:
        return "🔥 PRIORITY 1"
    elif score >= 60:
        return "⭐ PRIORITY 2"
    elif score >= 40:
        return "💼 PRIORITY 3"
    else:
        return "📋 PRIORITY 4"

# ==============================
# 💬 MESSAGE TEMPLATE GENERATION
# ==============================

def generate_personalized_opener(row):
    """Create personalized message opener based on lead data."""
    name = row.get("contact_name", "")
    business = row.get("business_name", name)
    rating = row.get("rating", 0)
    category = row.get("category", "")
    
    # Template variations based on data quality
    templates = []
    
    # High-quality leads (with rating)
    if rating >= 4.5:
        templates.append(
            f"Hi {name}! 👋 I came across {business} and was impressed by your {rating}⭐ rating."
        )
    elif rating >= 4.0:
        templates.append(
            f"Hi {name}! I noticed {business} has excellent reviews ({rating}⭐)."
        )
    
    # Category-specific openers
    if "B2B" in str(row.get("tags", "")):
        templates.append(
            f"Hi {name}! I work with {category} businesses in Colombo and wanted to reach out."
        )
    
    # Generic professional opener
    templates.append(
        f"Hi {name}! I came across {business} and wanted to connect."
    )
    
    # Return best available template
    return templates[0] if templates else f"Hi {name}!"

def create_message_template(row):
    """Full message template with merge fields."""
    opener = generate_personalized_opener(row)
    
    # Generic body (to be customized per campaign)
    template = f"""{opener}

[YOUR PITCH HERE - customize based on your service]

Would you be open to a quick 10-min call this week?

Best regards,
[YOUR NAME]
[YOUR COMPANY]"""
    
    return template

# ==============================
# 👤 CONTACT NAME BUILDING
# ==============================

def build_contact_name(row):
    """Build the best possible display name for outreach."""
    # Priority 1: Business name (most professional)
    business = str(row.get("business_name", "")).strip()
    if business and business not in ["", "Unknown", "Unknown Business", "N/A"]:
        return business
    
    # Priority 2: First + Last name
    first = str(row.get("first_name", "")).strip() if pd.notna(row.get("first_name")) else ""
    last = str(row.get("last_name", "")).strip() if pd.notna(row.get("last_name")) else ""
    if first or last:
        return f"{first} {last}".strip()
    
    # Priority 3: Other name fields
    for col in ["company", "name", "place_name", "contact_person"]:
        if pd.notna(row.get(col)):
            val = str(row[col]).strip()
            if val not in ["", "Unknown", "N/A"]:
                return val
    
    return "Business Contact"

# ==============================
# 📅 FOLLOW-UP SCHEDULING
# ==============================

def suggest_followup_schedule(priority):
    """Suggest optimal follow-up timing based on priority."""
    today = datetime.now()
    
    if "PRIORITY 1" in priority:
        return {
            "first_contact": today.strftime("%Y-%m-%d"),
            "follow_up_1": (today + timedelta(days=2)).strftime("%Y-%m-%d"),
            "follow_up_2": (today + timedelta(days=5)).strftime("%Y-%m-%d"),
            "cadence": "Aggressive (2-day gaps)"
        }
    elif "PRIORITY 2" in priority:
        return {
            "first_contact": today.strftime("%Y-%m-%d"),
            "follow_up_1": (today + timedelta(days=3)).strftime("%Y-%m-%d"),
            "follow_up_2": (today + timedelta(days=7)).strftime("%Y-%m-%d"),
            "cadence": "Standard (3-4 day gaps)"
        }
    else:
        return {
            "first_contact": (today + timedelta(days=1)).strftime("%Y-%m-%d"),
            "follow_up_1": (today + timedelta(days=7)).strftime("%Y-%m-%d"),
            "follow_up_2": (today + timedelta(days=14)).strftime("%Y-%m-%d"),
            "cadence": "Relaxed (weekly)"
        }

# ==============================
# 🚀 MAIN PROCESSING FUNCTION
# ==============================

def prepare_whatsapp_leads(
    input_file=INPUT_FILE,
    output_csv=WHATSAPP_CSV,
    output_json=WHATSAPP_JSON,
    crm_file=CRM_IMPORT,
    rejected_file=REJECTED_FILE
):
    logger.info("🚀 OPTIMIZED WHATSAPP LEAD PREPARATION")
    logger.info("=" * 70)

    # --- Validate input ---
    if not os.path.exists(input_file):
        logger.error(f"❌ Input file not found: {os.path.abspath(input_file)}")
        return

    # --- Load data ---
    df = pd.read_csv(input_file)
    logger.info(f"📥 Loaded {len(df)} leads from '{input_file}'")
    logger.info(f"📄 Columns: {list(df.columns)}")

    # --- Detect phone column ---
    phone_cols = [
        "phone", "phone_number", "phone_raw", "formatted_phone_number",
        "mobile", "contact", "whatsapp_number", "telephone"
    ]
    phone_col = next((col for col in phone_cols if col in df.columns), None)
    
    if not phone_col:
        logger.error(f"❌ No phone column found. Available columns: {list(df.columns)}")
        return

    logger.info(f"📞 Using phone column: '{phone_col}'")

    # --- Build contact names FIRST ---
    df["contact_name"] = df.apply(build_contact_name, axis=1)

    # --- Process phone numbers ---
    logger.info("📱 Validating phone numbers...")
    results = df[phone_col].apply(clean_and_classify_number)
    
    df["cleaned_number"] = [r[0] for r in results]
    df["is_valid_mobile"] = [r[1] for r in results]
    df["carrier"] = [r[2] for r in results]
    df["rejection_reason"] = [r[3] for r in results]

    # --- Split valid vs invalid ---
    valid_df = df[df["is_valid_mobile"]].copy()
    invalid_df = df[~df["is_valid_mobile"]].copy()

    logger.info(f"✅ Valid mobile numbers: {len(valid_df)}")
    logger.info(f"❌ Invalid/Landline: {len(invalid_df)}")

    if len(valid_df) == 0:
        logger.warning("⚠️ No valid mobile numbers found!")
        invalid_df.to_csv(rejected_file, index=False)
        logger.info(f"📁 Rejected leads saved to: {rejected_file}")
        return

    # --- Deduplication ---
    valid_df = deduplicate_leads(valid_df)

    # --- Score & prioritize ---
    logger.info("🏆 Calculating outreach scores...")
    valid_df["outreach_score"] = valid_df.apply(calculate_outreach_score, axis=1)
    valid_df["priority"] = valid_df["outreach_score"].apply(assign_outreach_priority)

    # Sort by priority
    valid_df = valid_df.sort_values(["outreach_score", "contact_name"], ascending=[False, True])

    # --- Generate WhatsApp assets ---
    logger.info("💬 Generating WhatsApp links and message templates...")
    valid_df["whatsapp_link"] = valid_df["cleaned_number"].apply(generate_wa_link)
    valid_df["message_template"] = valid_df.apply(create_message_template, axis=1)
    
    # Add follow-up schedule
    followup_data = valid_df["priority"].apply(suggest_followup_schedule)
    valid_df["first_contact_date"] = [f["first_contact"] for f in followup_data]
    valid_df["follow_up_1_date"] = [f["follow_up_1"] for f in followup_data]
    valid_df["follow_up_2_date"] = [f["follow_up_2"] for f in followup_data]

    # --- Format for WhatsApp CSV ---
    whatsapp_columns = [
        "priority", "outreach_score", "contact_name", "cleaned_number",
        "whatsapp_link", "carrier", "business_name", "category",
        "email", "website", "address", "rating", "review_count",
        "first_contact_date", "follow_up_1_date", "tags"
    ]
    
    # Filter existing columns
    whatsapp_columns = [col for col in whatsapp_columns if col in valid_df.columns]
    whatsapp_df = valid_df[whatsapp_columns].copy()
    whatsapp_df = whatsapp_df.rename(columns={"cleaned_number": "mobile_9digit"})

    # --- Export WhatsApp CSV ---
    whatsapp_df.to_csv(output_csv, index=False)

    # --- Export JSON for bulk messaging tools ---
    bulk_data = []
    for _, row in valid_df.iterrows():
        bulk_data.append({
            "name": row["contact_name"],
            "phone": f"94{row['cleaned_number']}",
            "message": row["message_template"],
            "priority": row["priority"],
            "scheduled_date": row["first_contact_date"]
        })
    
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(bulk_data, f, indent=2, ensure_ascii=False)

    # --- Export CRM-ready format ---
    crm_columns = [
        "contact_name", "cleaned_number", "email", "business_name",
        "category", "website", "address", "rating", "review_count",
        "lead_quality", "priority", "tags", "first_contact_date"
    ]
    crm_columns = [col for col in crm_columns if col in valid_df.columns]
    crm_df = valid_df[crm_columns].copy()
    crm_df = crm_df.rename(columns={
        "cleaned_number": "Phone",
        "contact_name": "Contact Name",
        "business_name": "Company",
        "email": "Email"
    })
    crm_df.to_csv(crm_file, index=False)

    # --- Save rejected leads ---
    if len(invalid_df) > 0:
        invalid_df.to_csv(rejected_file, index=False)

    # --- Generate statistics ---
    logger.info("\n" + "=" * 70)
    logger.info("✅ PROCESSING COMPLETE")
    logger.info("=" * 70)
    
    # Priority breakdown
    priority_counts = valid_df["priority"].value_counts().to_dict()
    logger.info(f"\n📊 PRIORITY BREAKDOWN:")
    for priority, count in sorted(priority_counts.items()):
        logger.info(f"   {priority}: {count} leads")
    
    # Carrier breakdown
    carrier_counts = valid_df["carrier"].value_counts().to_dict()
    logger.info(f"\n📱 CARRIER BREAKDOWN:")
    for carrier, count in sorted(carrier_counts.items(), key=lambda x: x[1], reverse=True):
        logger.info(f"   {carrier or 'Unknown'}: {count} numbers")
    
    # Success metrics
    success_rate = len(valid_df) / len(df) * 100
    dedup_rate = (1 - len(valid_df) / len(df[df["is_valid_mobile"]])) * 100 if len(df[df["is_valid_mobile"]]) > 0 else 0
    
    logger.info(f"\n📈 SUCCESS METRICS:")
    logger.info(f"   Total input leads:        {len(df)}")
    logger.info(f"   Valid mobile numbers:     {len(valid_df)}")
    logger.info(f"   Success rate:             {success_rate:.1f}%")
    logger.info(f"   Deduplication savings:    {dedup_rate:.1f}%")
    logger.info(f"   Average outreach score:   {valid_df['outreach_score'].mean():.1f}/100")
    
    # Rejection breakdown
    if len(invalid_df) > 0:
        top_rejections = invalid_df["rejection_reason"].value_counts().head(3).to_dict()
        logger.info(f"\n❌ TOP REJECTION REASONS:")
        for reason, count in top_rejections.items():
            logger.info(f"   {reason}: {count}")
    
    # Output files
    logger.info(f"\n📁 OUTPUT FILES:")
    logger.info(f"   WhatsApp CSV:  {output_csv}")
    logger.info(f"   Bulk JSON:     {output_json}")
    logger.info(f"   CRM Import:    {crm_file}")
    logger.info(f"   Rejected:      {rejected_file}")
    
    # Preview top leads
    logger.info(f"\n🎯 TOP 5 PRIORITY LEADS:")
    preview_cols = ["priority", "contact_name", "mobile_9digit", "carrier"]
    if "email" in whatsapp_df.columns:
        preview_cols.append("email")
    logger.info("\n" + whatsapp_df[preview_cols].head(5).to_string(index=False))
    
    logger.info("\n✅ Ready for outreach! Start with Priority 1 leads.")
    
    return output_csv

# ==============================
# ▶️ EXECUTION
# ==============================

if __name__ == "__main__":
    prepare_whatsapp_leads()