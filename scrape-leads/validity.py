import pandas as pd
import re
import os

# === CONFIG ===
INPUT_FILE = "business_leads.csv"      # <-- change this to your input CSV name
OUTPUT_FILE = "output_business_leads.csv"         # this is what WhatsApp sender expects
DEFAULT_COUNTRY_CODE = "94"             # change if not Sri Lanka (e.g., "1" for USA)

# === FUNCTIONS ===
def clean_number(num):
    """Convert number to WhatsApp-friendly E.164 format (+countrycodeXXXXXXXXX)"""
    if pd.isna(num):
        return None
    s = re.sub(r'\D', '', str(num))  # remove non-digits

    # Common patterns (adjusts to E.164)
    if s.startswith("00"):       # e.g., 0094...
        s = s[2:]
    elif s.startswith("0"):      # e.g., 071xxxxxxx
        s = DEFAULT_COUNTRY_CODE + s[1:]
    elif not s.startswith(DEFAULT_COUNTRY_CODE):
        # Add country code if missing
        s = DEFAULT_COUNTRY_CODE + s

    # Must be at least 10 digits after country code
    if len(s) < 10 or len(s) > 15:
        return None

    return "+" + s  # E.164 format

# === LOAD CSV ===
if not os.path.exists(INPUT_FILE):
    print(f"✗ Error: File '{INPUT_FILE}' not found in {os.getcwd()}")
    exit(1)

df = pd.read_csv(INPUT_FILE)
print(f"✓ Loaded {len(df)} rows from {INPUT_FILE}")
print(f"📄 Columns found: {list(df.columns)}\n")

# === FIND PHONE COLUMN ===
possible_phone_cols = ["whatsapp_number", "phone_number", "phone", "mobile", "contact", "whatsapp"]
phone_col = next((col for col in possible_phone_cols if col in df.columns), None)

if not phone_col:
    print("✗ Error: Could not find a phone column! Please include one of:")
    print(", ".join(possible_phone_cols))
    exit(1)

# === FIND BUSINESS NAME / FALLBACK ===
possible_name_cols = ["business_name", "company", "name", "first_name", "last_name"]
name_col = next((col for col in possible_name_cols if col in df.columns), None)

if "first_name" in df.columns and "last_name" in df.columns:
    df["business_name"] = df["first_name"].astype(str) + " " + df["last_name"].astype(str)
elif name_col:
    df["business_name"] = df[name_col].astype(str)
else:
    df["business_name"] = "Unknown Business"

# === CLEAN NUMBERS TO E.164 FORMAT ===
df["whatsapp_number"] = df[phone_col].apply(clean_number)

# === REMOVE INVALID ENTRIES ===
df = df.dropna(subset=["whatsapp_number", "business_name"])
df = df[["whatsapp_number", "business_name"]].drop_duplicates()

# === SAVE FINAL FILE ===
df.to_csv(OUTPUT_FILE, index=False)

print(f"✅ WhatsApp-ready file created: {OUTPUT_FILE}")
print(f"📁 Location: {os.path.abspath(OUTPUT_FILE)}")
print(f"📊 Total valid contacts: {len(df)}")
print(f"\n📋 Sample Preview:\n{df.head(10).to_string(index=False)}")
