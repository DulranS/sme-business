import pandas as pd
import re
import os

INPUT_FILE = "business_leads.csv"
OUTPUT_FILE = "output_business_leads.csv"

def clean_number(num):
    """Clean and validate phone numbers, removing country code 94"""
    if pd.isna(num):
        return None
    
    # Remove all non-digit characters
    s = re.sub(r'\D', '', str(num)).strip()
    
    # Remove country code 94 if present at the start
    if s.startswith('94'):
        s = s[2:]
    
    # Validate length (Sri Lankan numbers are typically 9-10 digits without country code)
    if len(s) < 9 or len(s) > 10:
        return None
    
    return s

def prepare_csv(input_file=INPUT_FILE, output_file=OUTPUT_FILE):
    if not os.path.exists(input_file):
        print(f"✗ Error: File '{input_file}' not found in {os.getcwd()}")
        return

    df = pd.read_csv(input_file)
    print(f"✓ Loaded {len(df)} rows from '{input_file}'")
    print(f"📄 Columns found: {list(df.columns)}")

    # --- Phone column detection (prioritize whatsapp_number, then phone_raw) ---
    possible_phone_cols = ["whatsapp_number", "phone_raw", "phone_number", "phone", "mobile", "contact"]
    phone_col = next((col for col in possible_phone_cols if col in df.columns), None)
    
    if not phone_col:
        print(f"✗ Could not find phone column. Columns: {list(df.columns)}")
        return
    
    print(f"📞 Using phone column: '{phone_col}'")

    # --- Business name handling ---
    if "business_name" in df.columns:
        df["clean_business_name"] = df["business_name"].astype(str).str.strip()
    elif "first_name" in df.columns and "last_name" in df.columns:
        df["clean_business_name"] = df["first_name"].astype(str).str.strip() + " " + df["last_name"].astype(str).str.strip()
    else:
        possible_name_cols = ["company", "name", "place_name"]
        name_col = next((col for col in possible_name_cols if col in df.columns), None)
        if name_col:
            df["clean_business_name"] = df[name_col].astype(str).str.strip()
        else:
            df["clean_business_name"] = "Unknown Business"
    
    print(f"📝 Sample business names:\n{df['clean_business_name'].head(5)}")

    # --- Clean numbers (remove country code 94) ---
    df["cleaned_whatsapp_number"] = df[phone_col].apply(clean_number)
    
    # Show before/after samples
    print(f"\n📋 Number Cleaning Preview:")
    sample_df = df[[phone_col, "cleaned_whatsapp_number"]].head(10)
    print(sample_df.to_string(index=False))

    # --- Count invalid numbers ---
    invalid_count = df["cleaned_whatsapp_number"].isna().sum()
    print(f"\n⚠️  Invalid numbers removed: {invalid_count}")

    # --- Drop invalid entries ---
    df = df.dropna(subset=["cleaned_whatsapp_number", "clean_business_name"])
    
    # Remove entries with "Unknown Business" or empty names
    df = df[df["clean_business_name"].str.strip() != ""]
    df = df[df["clean_business_name"] != "Unknown Business"]
    
    # Create final output with just the two columns needed
    output_df = df[["cleaned_whatsapp_number", "clean_business_name"]].copy()
    output_df.columns = ["whatsapp_number", "business_name"]
    
    # Remove duplicates
    output_df = output_df.drop_duplicates()
    
    print(f"\n✅ Total valid contacts: {len(output_df)}")

    if len(output_df) == 0:
        print("⚠️ No valid contacts to export!")
        return

    # --- Save ---
    output_df.to_csv(output_file, index=False)
    print(f"\n✅ WhatsApp-ready file created: '{output_file}'")
    print(f"📁 Location: {os.path.abspath(output_file)}")
    print(f"\n📋 Final Preview (first 10 rows):")
    print(output_df.head(10).to_string(index=False))
    
    # Show stats
    print(f"\n📊 Statistics:")
    print(f"   • Original rows: {len(df) + invalid_count}")
    print(f"   • Valid contacts: {len(output_df)}")
    print(f"   • Success rate: {len(output_df)/(len(df) + invalid_count)*100:.1f}%")

    return output_file

# Run automatically
if __name__ == "__main__":
    prepare_csv()