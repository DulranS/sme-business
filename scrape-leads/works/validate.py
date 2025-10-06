import pandas as pd
import re
import os

# === Configuration ===
INPUT_FILE = "business_leads.csv"
OUTPUT_FILE = "output_business_leads.csv"
INVALID_FILE = "invalid_numbers.csv"


# === Helper: Clean and validate phone numbers ===
def clean_number(num):
    """Clean and validate phone numbers, removing country code 94"""
    if pd.isna(num):
        return None

    # Remove non-digit characters
    s = re.sub(r'\D', '', str(num)).strip()

    # Remove country code 94 if present
    if s.startswith('94'):
        s = s[2:]

    # Sri Lankan numbers usually 9–10 digits long
    if len(s) < 9 or len(s) > 10:
        return None

    return s


# === Core Function ===
def prepare_csv(input_file=INPUT_FILE, output_file=OUTPUT_FILE, invalid_file=INVALID_FILE):
    # --- Check file existence ---
    if not os.path.exists(input_file):
        print(f"✗ Error: File '{input_file}' not found in {os.getcwd()}")
        return

    # --- Load CSV ---
    df = pd.read_csv(input_file)
    print(f"✓ Loaded {len(df)} rows from '{input_file}'")
    print(f"📄 Columns found: {list(df.columns)}")

    # --- Detect phone column ---
    possible_phone_cols = ["whatsapp_number", "phone_raw", "phone_number", "phone", "mobile", "contact"]
    phone_col = next((col for col in possible_phone_cols if col in df.columns), None)

    if not phone_col:
        print(f"✗ Could not find phone column. Columns: {list(df.columns)}")
        return

    print(f"📞 Using phone column: '{phone_col}'")

    # --- Handle business name ---
    if "business_name" in df.columns:
        df["clean_business_name"] = df["business_name"].astype(str).str.strip()
    elif "first_name" in df.columns and "last_name" in df.columns:
        df["clean_business_name"] = (
            df["first_name"].astype(str).str.strip() + " " + df["last_name"].astype(str).str.strip()
        )
    else:
        possible_name_cols = ["company", "name", "place_name"]
        name_col = next((col for col in possible_name_cols if col in df.columns), None)
        if name_col:
            df["clean_business_name"] = df[name_col].astype(str).str.strip()
        else:
            df["clean_business_name"] = "Unknown Business"

    print(f"📝 Sample business names:\n{df['clean_business_name'].head(5)}")

    # --- Clean numbers ---
    df["cleaned_whatsapp_number"] = df[phone_col].apply(clean_number)

    print(f"\n📋 Number Cleaning Preview:")
    sample_df = df[[phone_col, "cleaned_whatsapp_number"]].head(10)
    print(sample_df.to_string(index=False))

    # --- Separate valid and invalid ---
    invalid_df = df[df["cleaned_whatsapp_number"].isna()].copy()
    valid_df = df.dropna(subset=["cleaned_whatsapp_number", "clean_business_name"]).copy()

    print(f"\n⚠️ Invalid numbers removed: {len(invalid_df)}")

    # --- Clean valid data ---
    valid_df = valid_df[valid_df["clean_business_name"].str.strip() != ""]
    valid_df = valid_df[valid_df["clean_business_name"] != "Unknown Business"]

    # Replace original columns with cleaned versions
    valid_df["whatsapp_number"] = valid_df["cleaned_whatsapp_number"]
    valid_df["business_name"] = valid_df["clean_business_name"]

    # Drop helper columns
    valid_df = valid_df.drop(columns=["cleaned_whatsapp_number", "clean_business_name"], errors="ignore")
    invalid_df = invalid_df.drop(columns=["cleaned_whatsapp_number", "clean_business_name"], errors="ignore")

    # --- Deduplicate ---
    valid_df = valid_df.drop_duplicates(subset=["whatsapp_number", "business_name"])

    # --- Sort alphabetically ---
    valid_df = valid_df.sort_values(by="business_name", ascending=True)

    print(f"\n✅ Total valid contacts: {len(valid_df)}")

    if len(valid_df) == 0:
        print("⚠️ No valid contacts to export!")
        return

    # --- Save cleaned and invalid files ---
    valid_df.to_csv(output_file, index=False)
    invalid_df.to_csv(invalid_file, index=False)

    print(f"\n✅ WhatsApp-ready file created: '{output_file}'")
    print(f"📁 Location: {os.path.abspath(output_file)}")

    print(f"\n⚠️ Invalid contacts saved to: '{invalid_file}'")

    # --- Preview ---
    print(f"\n📋 Final Preview (first 10 rows):")
    print(valid_df.head(10).to_string(index=False))

    # --- Stats ---
    print(f"\n📊 Statistics:")
    print(f"   • Original rows: {len(df)}")
    print(f"   • Valid contacts: {len(valid_df)}")
    print(f"   • Invalid contacts: {len(invalid_df)}")
    print(f"   • Success rate: {len(valid_df)/(len(df))*100:.1f}%")

    return output_file


# === Auto-run ===
if __name__ == "__main__":
    prepare_csv()
