import pandas as pd
import re
import os

INPUT_FILE = "business_leads.csv"
OUTPUT_FILE = "output_business_leads.csv"

def clean_number(num):
    if pd.isna(num):
        return None
    s = re.sub(r'\D', '', str(num)).strip()
    if len(s) < 8 or len(s) > 15:
        return None
    return s

def prepare_csv(input_file=INPUT_FILE, output_file=OUTPUT_FILE):
    if not os.path.exists(input_file):
        print(f"✗ Error: File '{input_file}' not found in {os.getcwd()}")
        return

    df = pd.read_csv(input_file)
    print(f"✓ Loaded {len(df)} rows from '{input_file}'")
    print(f"📄 Columns found: {list(df.columns)}")

    # --- Phone column detection ---
    possible_phone_cols = ["whatsapp_number", "phone_number", "phone", "mobile", "contact", "whatsapp"]
    phone_col = next((col for col in possible_phone_cols if col in df.columns), None)
    if not phone_col:
        print(f"✗ Could not find phone column. Columns: {list(df.columns)}")
        return
    print(f"📞 Using phone column: {phone_col}")

    # --- Business name detection ---
    if "first_name" in df.columns and "last_name" in df.columns:
        df["business_name"] = df["first_name"].astype(str).str.strip() + " " + df["last_name"].astype(str).str.strip()
    else:
        possible_name_cols = ["business_name", "company", "name"]
        name_col = next((col for col in possible_name_cols if col in df.columns), None)
        if name_col:
            df["business_name"] = df[name_col].astype(str).str.strip()
        else:
            df["business_name"] = "Unknown Business"
    print(f"📝 Sample business names:\n{df['business_name'].head(5)}")

    # --- Clean numbers ---
    df["whatsapp_number"] = df[phone_col].apply(clean_number)
    print(f"📋 Sample cleaned numbers:\n{df['whatsapp_number'].head(5)}")

    # --- Drop invalid ---
    df = df.dropna(subset=["whatsapp_number", "business_name"])
    df = df[["whatsapp_number", "business_name"]].drop_duplicates()
    print(f"✅ Total valid contacts: {len(df)}")

    if len(df) == 0:
        print("⚠️ No valid contacts to export!")
        return

    # --- Save ---
    df.to_csv(output_file, index=False)
    print(f"✅ WhatsApp-ready file created: {output_file}")
    print(f"📁 Location: {os.path.abspath(output_file)}")
    print(f"\n📋 Sample Preview:\n{df.head(10).to_string(index=False)}")

    return output_file

# Run automatically
prepare_csv()
