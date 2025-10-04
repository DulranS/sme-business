import os
import pandas as pd
import time
from datetime import datetime
import re
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException
import urllib.parse

def format_whatsapp_number(number):
    """Format phone number to WhatsApp format (E.164)"""
    cleaned = re.sub(r'\D', '', str(number))
    
    # Adjust country code based on length
    if len(cleaned) == 10:  # US number
        cleaned = '1' + cleaned
    elif len(cleaned) == 9:  # Sri Lankan number
        cleaned = '94' + cleaned
    
    return '+' + cleaned

def setup_driver(headless=False):
    """Setup Chrome driver"""
    chrome_options = Options()
    
    if headless:
        chrome_options.add_argument('--headless=new')
    
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-blink-features=AutomationControlled')
    chrome_options.add_argument('--disable-extensions')
    chrome_options.add_argument('--disable-notifications')
    chrome_options.add_argument('--remote-debugging-port=9223')  # Different port
    
    # Keep user data to stay logged in
    user_data_dir = os.path.join(os.getcwd(), 'whatsapp_validator_profile')
    if not os.path.exists(user_data_dir):
        os.makedirs(user_data_dir)
    chrome_options.add_argument(f'--user-data-dir={user_data_dir}')
    
    chrome_options.add_experimental_option('excludeSwitches', ['enable-logging'])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    
    driver = webdriver.Chrome(options=chrome_options)
    driver.set_page_load_timeout(30)
    
    return driver

def wait_for_whatsapp_login(driver, timeout=60):
    """Wait for user to scan QR code and login"""
    print("\n⏳ Waiting for WhatsApp Web login...")
    print("📱 Please scan QR code if not already logged in")
    
    try:
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, '[aria-label*="Chat list"]'))
        )
        print("✓ Successfully logged into WhatsApp Web!\n")
        return True
    except TimeoutException:
        print("✗ Login timeout. Please try again.")
        return False

def validate_whatsapp_number(driver, phone_number, check_delay=2):
    """
    Check if a WhatsApp number is valid by trying to open chat
    Returns: True if valid, False if invalid
    """
    try:
        # Navigate to the number
        url = f'https://web.whatsapp.com/send?phone={phone_number}'
        driver.get(url)
        
        # Wait a bit for page to load
        time.sleep(check_delay)
        
        # Check for "Phone number shared via url is invalid" alert
        try:
            invalid_alert = driver.find_element(By.XPATH, '//*[contains(text(), "Phone number shared via url is invalid")]')
            if invalid_alert:
                return False
        except:
            pass
        
        # Check if we can find the message input box (means number is valid)
        try:
            WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, 'div[contenteditable="true"][data-tab="10"]'))
            )
            return True
        except TimeoutException:
            # Alternative check: look for "Invalid number" or similar messages
            try:
                page_text = driver.find_element(By.TAG_NAME, 'body').text.lower()
                if 'invalid' in page_text or 'not found' in page_text:
                    return False
            except:
                pass
            
            # If no message box found and no error, assume invalid
            return False
            
    except Exception as e:
        print(f"      Error checking: {str(e)[:50]}")
        return False

def main():
    # Configuration
    INPUT_CSV = "business_leads.csv"
    OUTPUT_CSV = "business_leads_valid.csv"
    CHECK_DELAY = int(os.getenv("CHECK_DELAY", "2"))  # Seconds per number check
    HEADLESS = os.getenv("HEADLESS", "false").lower() == "true"
    
    print("="*60)
    print("WhatsApp Number Validator")
    print("="*60)
    
    # Read CSV
    try:
        df = pd.read_csv(INPUT_CSV)
        print(f"✓ Loaded {len(df)} contacts from {INPUT_CSV}")
    except FileNotFoundError:
        print(f"✗ Error: CSV file '{INPUT_CSV}' not found!")
        return
    except Exception as e:
        print(f"✗ Error reading CSV: {str(e)}")
        return
    
    # Validate columns
    if 'whatsapp_number' not in df.columns:
        print("✗ Error: CSV must contain 'whatsapp_number' column")
        print(f"   Found columns: {', '.join(df.columns)}")
        return
    
    # Clean data
    df = df.dropna(subset=['whatsapp_number'])
    df = df.reset_index(drop=True)
    
    print(f"\n🔍 Validating {len(df)} phone numbers...")
    print(f"⏱️  Check delay: {CHECK_DELAY} seconds per number")
    print(f"⏱️  Estimated time: {(len(df) * CHECK_DELAY) // 60} minutes\n")
    
    # Setup driver
    print("🚀 Starting Chrome WebDriver...")
    driver = setup_driver(headless=HEADLESS)
    
    try:
        # Open WhatsApp Web
        driver.get('https://web.whatsapp.com')
        
        # Wait for login
        if not wait_for_whatsapp_login(driver):
            return
        
        # Track results
        valid_numbers = []
        invalid_numbers = []
        start_time = time.time()
        
        # Validate each number
        for idx, row in df.iterrows():
            phone_number = format_whatsapp_number(row['whatsapp_number'])
            
            # Get business name if available
            business_name = row.get('business_name', 'N/A')
            if pd.isna(business_name):
                business_name = 'N/A'
            
            print(f"[{idx + 1}/{len(df)}] {business_name[:30]:<30} | {phone_number:<15}", end=' ')
            
            # Validate number
            if validate_whatsapp_number(driver, phone_number, CHECK_DELAY):
                print("✓ Valid")
                valid_numbers.append(idx)
            else:
                print("✗ Invalid")
                invalid_numbers.append(idx)
        
        # Create filtered dataframe with only valid numbers
        df_valid = df.iloc[valid_numbers].copy()
        
        # Save to new CSV
        df_valid.to_csv(OUTPUT_CSV, index=False)
        
        # Summary
        elapsed = time.time() - start_time
        print("\n" + "="*60)
        print("📊 VALIDATION SUMMARY")
        print("="*60)
        print(f"✓ Valid numbers: {len(valid_numbers)}")
        print(f"✗ Invalid numbers: {len(invalid_numbers)}")
        print(f"📝 Total checked: {len(df)}")
        print(f"📈 Success rate: {(len(valid_numbers)/len(df)*100):.1f}%")
        print(f"⏱️  Total time: {elapsed//60:.0f}m {elapsed%60:.0f}s")
        print(f"\n💾 Valid numbers saved to: {OUTPUT_CSV}")
        print("="*60)
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user!")
    except Exception as e:
        print(f"\n✗ Error: {str(e)}")
    finally:
        driver.quit()
        print("\n👋 Browser closed. Done!")

if __name__ == "__main__":
    main()