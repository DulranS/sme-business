"""
whatsapp_lead_preparer.py

🎯 STRATEGIC WHATSAPP LEAD PREPARER — Sri Lanka Focused
✅ Cleans & validates mobile numbers for WhatsApp  
✅ Filters out landlines & invalid formats  
✅ Builds personalized contact names  
✅ Adds 1-click wa.me links  
✅ Preserves lead quality & source  
✅ Exports CRM-ready + WhatsApp-ready files  

Designed for sales teams running WhatsApp outreach in Sri Lanka.
"""

import pandas as pd
import re
import os
import logging
from datetime import datetime

# ==============================
# 🔧 CONFIGURATION
# ==============================
INPUT_FILE = "b2b_leads.csv"
OUTPUT_FILE = "output_business_leads.csv"
INVALID_FILE = "invalid_or_landline_leads.csv"
LOG_FILE = "whatsapp_prep.log"

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

# Sri Lankan mobile prefixes (2024)
MOBILE_PREFIXES = {
    "70", "71", "72", "75", "76", "77", "78",
    "12", "13", "14", "15", "16", "17", "18", "19"
}
LANDLINE_PREFIXES = {"11", "31", "32", "33", "34", "35", "36", "37", "38", "41", "45", "47", "51", "52", "54", "55", "57", "63", "65", "66", "67"}

# ==============================
# 📞 PHONE NUMBER PROCESSING
# ==============================
def clean_and_classify_number(raw_num):
    """
    Returns: (cleaned_9_digit, is_valid_mobile, reason)
    """
    if pd.isna(raw_num) or raw_num == "":
        return None, False, "Empty"

    # Normalize: keep only digits
    digits = re.sub(r'\D', '', str(raw_num))
    
    # Handle international formats
    if digits.startswith("94"):
        digits = digits[2:]
    elif digits.startswith("+94"):
        digits = digits[3:]
    elif digits.startswith("0"):
        digits = digits[1:]
    elif len(digits) == 10 and digits.startswith("94"):
        digits = digits[2:]

    # Must be 9 digits for Sri Lankan mobile
    if len(digits) != 9:
        return None, False, f"Invalid length ({len(digits)})"

    prefix = digits[:2]
    
    # Check if it's a known mobile prefix
    if prefix in MOBILE_PREFIXES:
        return digits, True, "Valid Mobile"
    elif prefix in LANDLINE_PREFIXES:
        return digits, False, f"Landline ({prefix})"
    else:
        return digits, False, f"Unknown prefix ({prefix})"

def generate_wa_link(number):
    """Generate clickable WhatsApp link."""
    if number:
        return f"https://wa.me/94{number}"  # ✅ No spaces — just "94" + 9-digit number
    return ""

# ==============================
# 👤 NAME & PERSONALIZATION
# ==============================
def build_contact_name(row):
    """Build the best possible display name for outreach."""
    # Priority 1: Business name
    if pd.notna(row.get("business_name")) and str(row["business_name"]).strip() not in ["", "Unknown", "Unknown Business"]:
        return str(row["business_name"]).strip()
    
    # Priority 2: First + Last
    first = str(row.get("first_name", "")).strip() if pd.notna(row.get("first_name")) else ""
    last = str(row.get("last_name", "")).strip() if pd.notna(row.get("last_name")) else ""
    if first or last:
        return f"{first} {last}".strip()
    
    # Priority 3: Company or name fallback
    for col in ["company", "name", "place_name"]:
        if pd.notna(row.get(col)) and str(row[col]).strip() not in ["", "Unknown"]:
            return str(row[col]).strip()
    
    return "Prospect"

# ==============================
# 🚀 MAIN PROCESSING FUNCTION
# ==============================
def prepare_whatsapp_leads(
    input_file=INPUT_FILE,
    output_file=OUTPUT_FILE,
    invalid_file=INVALID_FILE
):
    logger.info("🚀 Starting WhatsApp Lead Preparation")
    logger.info("=" * 50)

    # --- Validate input ---
    if not os.path.exists(input_file):
        logger.error(f"❌ Input file not found: {os.path.abspath(input_file)}")
        return

    # --- Load data ---
    df = pd.read_csv(input_file)
    logger.info(f"📥 Loaded {len(df)} rows from '{input_file}'")
    logger.info(f"📄 Columns: {list(df.columns)}")

    # --- Detect phone column ---
    phone_cols = ["whatsapp_number", "phone_raw", "phone_number", "phone", "mobile", "contact", "formatted_phone_number"]
    phone_col = next((col for col in phone_cols if col in df.columns), None)
    
    if not phone_col:
        logger.error(f"❌ No phone column found. Available: {list(df.columns)}")
        return

    logger.info(f"📞 Using phone column: '{phone_col}'")

    # --- Build contact name ---
    df["contact_name"] = df.apply(build_contact_name, axis=1)
    logger.info(f"📝 Sample contact names:\n{df['contact_name'].head(5).to_string(index=False)}")

    # --- Process numbers ---
    results = df[phone_col].apply(clean_and_classify_number)
    df["cleaned_number"] = [r[0] for r in results]
    df["is_valid_mobile"] = [r[1] for r in results]
    df["rejection_reason"] = [r[2] for r in results]

    # --- Generate WhatsApp links ---
    df["whatsapp_link"] = df["cleaned_number"].apply(generate_wa_link)

    # --- Split valid vs invalid ---
    valid_df = df[df["is_valid_mobile"]].copy()
    invalid_df = df[~df["is_valid_mobile"]].copy()

    logger.info(f"✅ Valid mobile numbers: {len(valid_df)}")
    logger.info(f"❌ Invalid/Landline: {len(invalid_df)}")

    if len(valid_df) == 0:
        logger.warning("⚠️ No valid mobile numbers found!")
        invalid_df.to_csv(invalid_file, index=False)
        return

    # --- Final cleanup ---
    valid_df = valid_df.drop_duplicates(subset=["cleaned_number"])
    valid_df = valid_df.sort_values(by="contact_name", ascending=True)

    # --- Select & reorder output columns ---
    output_columns = []
    # Essential for WhatsApp
    output_columns.extend(["contact_name", "cleaned_number", "whatsapp_link"])
    # Contextual info
    for col in ["business_name", "category", "email", "website", "address", "lead_quality", "tags"]:
        if col in valid_df.columns:
            output_columns.append(col)
    # Keep original phone for reference
    output_columns.append(phone_col)

    # Ensure all columns exist
    final_df = valid_df.reindex(columns=output_columns, fill_value="")

    # Rename for clarity
    final_df = final_df.rename(columns={"cleaned_number": "mobile_9digit"})

    # --- Save outputs ---
    final_df.to_csv(output_file, index=False)
    invalid_df.to_csv(invalid_file, index=False)

    # --- Summary stats ---
    success_rate = len(valid_df) / len(df) * 100
    top_rejections = invalid_df["rejection_reason"].value_counts().head(3)

    logger.info(f"\n✅ SUCCESS: WhatsApp-ready file saved to: {os.path.abspath(output_file)}")
    logger.info(f"📁 Invalid/landline leads saved to: {os.path.abspath(invalid_file)}")
    logger.info(f"\n📊 FINAL STATS:")
    logger.info(f"   • Total input:        {len(df)}")
    logger.info(f"   • Valid mobile:       {len(valid_df)}")
    logger.info(f"   • Success rate:       {success_rate:.1f}%")
    logger.info(f"   • Top rejections:     {dict(top_rejections)}")

    # --- Preview ---
    logger.info(f"\n📋 PREVIEW (first 5 valid leads):")
    preview_cols = ["contact_name", "mobile_9digit", "whatsapp_link"]
    if "lead_quality" in final_df.columns:
        preview_cols.insert(1, "lead_quality")
    logger.info(f"\n{final_df[preview_cols].head().to_string(index=False)}")

    return output_file

# ==============================
# ▶️ EXECUTION
# ==============================
if __name__ == "__main__":
    prepare_whatsapp_leads()