import os
import pandas as pd
import time
from datetime import datetime
import re
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import urllib.parse

def format_whatsapp_number(number):
    """Format phone number to WhatsApp format (E.164)"""
    cleaned = re.sub(r'\D', '', str(number))
    
    # Adjust country code based on length
    if len(cleaned) == 10:  # US number
        cleaned = '1' + cleaned
    elif len(cleaned) == 9:  # Sri Lankan number
        cleaned = '94' + cleaned
    
    return cleaned  # No + sign for WhatsApp Web URL

def setup_driver(headless=True):
    """Setup Chrome driver with optimal settings for background operation"""
    chrome_options = Options()
    
    if headless:
        chrome_options.add_argument('--headless=new')
    
    # Performance optimizations
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-blink-features=AutomationControlled')
    chrome_options.add_argument('--disable-extensions')
    chrome_options.add_argument('--disable-images')  # Don't load images for speed
    chrome_options.add_argument('--disable-notifications')
    
    # Keep user data to stay logged in
    user_data_dir = os.path.join(os.getcwd(), 'chrome_profile')
    chrome_options.add_argument(f'--user-data-dir={user_data_dir}')
    
    # Suppress logs
    chrome_options.add_experimental_option('excludeSwitches', ['enable-logging'])
    
    driver = webdriver.Chrome(options=chrome_options)
    driver.set_page_load_timeout(30)
    
    return driver

def wait_for_whatsapp_login(driver, timeout=60):
    """Wait for user to scan QR code and login"""
    print("\n⏳ Waiting for WhatsApp Web login...")
    print("📱 Please scan QR code if not already logged in")
    
    try:
        # Wait for chat list to load (sign that we're logged in)
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, '[aria-label*="Chat list"]'))
        )
        print("✓ Successfully logged into WhatsApp Web!\n")
        return True
    except TimeoutException:
        print("✗ Login timeout. Please try again.")
        return False

def send_message_fast(driver, phone_number, message, wait_time=3):
    """Send WhatsApp message using direct URL method (fastest)"""
    try:
        # Encode message for URL
        encoded_message = urllib.parse.quote(message)
        
        # Use WhatsApp Web API URL (fastest method)
        url = f'https://web.whatsapp.com/send?phone={phone_number}&text={encoded_message}'
        driver.get(url)
        
        # Wait for message box to load
        try:
            message_box = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, 'div[contenteditable="true"][data-tab="10"]'))
            )
            time.sleep(0.5)  # Brief pause for stability
        except TimeoutException:
            # Try alternative selector
            message_box = WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.XPATH, '//div[@contenteditable="true"][@data-tab="10"]'))
            )
        
        # Send message (Enter key)
        message_box.send_keys(Keys.ENTER)
        
        # Minimal wait for message to send
        time.sleep(wait_time)
        
        return True
        
    except TimeoutException:
        print(f"    ⚠️ Invalid number or number not on WhatsApp")
        return False
    except Exception as e:
        print(f"    ✗ Error: {str(e)[:50]}")
        return False

def save_progress(csv_file, processed_indices):
    """Save progress to resume later if interrupted"""
    progress_file = csv_file.replace('.csv', '_progress.json')
    with open(progress_file, 'w') as f:
        json.dump({'processed': list(processed_indices), 'last_updated': str(datetime.now())}, f)

def load_progress(csv_file):
    """Load previous progress"""
    progress_file = csv_file.replace('.csv', '_progress.json')
    if os.path.exists(progress_file):
        with open(progress_file, 'r') as f:
            data = json.load(f)
            return set(data.get('processed', []))
    return set()

def main():
    # Configuration
    CSV_FILE = "./business_leads.csv"  # Explicit relative path
    YOUR_NAME = os.getenv("YOUR_NAME", "Syndicate")
    MESSAGE_TEMPLATE = os.getenv("MESSAGE", 
        "Hi! I'm {your_name} from a digital marketing agency. Noticed {business_name} could benefit from online marketing. Interested in a free consultation? Reply STOP to opt-out.")
    
    # Optimal timing (faster while staying under limits)
    WAIT_TIME = int(os.getenv("WAIT_TIME", "3"))  # 3 seconds = ~20 msgs/min (safe rate)
    BATCH_SIZE = int(os.getenv("BATCH_SIZE", "50"))  # Rest after every 50 messages
    BATCH_REST = int(os.getenv("BATCH_REST", "60"))  # 1 minute rest between batches
    HEADLESS = os.getenv("HEADLESS", "true").lower() == "true"
    
    # Debug: Print current directory and CSV path
    current_dir = os.getcwd()
    csv_path = os.path.abspath(CSV_FILE)
    print(f"🔍 Current directory: {current_dir}")
    print(f"🔍 Looking for CSV at: {csv_path}")
    print(f"🔍 File exists check: {os.path.exists(csv_path)}")
    print(f"🔍 File exists (direct): {os.path.exists('business_leads.csv')}")
    
    # List all files in directory
    all_files = os.listdir(current_dir)
    csv_files = [f for f in all_files if f.endswith('.csv')]
    print(f"🔍 All files in directory: {all_files[:10]}")  # First 10 files
    print(f"🔍 CSV files found: {csv_files}\n")
    
    # Try different path variations
    possible_paths = [
        CSV_FILE,
        os.path.join(current_dir, CSV_FILE),
        os.path.abspath(CSV_FILE)
    ]
    
    csv_found = None
    for path in possible_paths:
        if os.path.exists(path):
            csv_found = path
            print(f"✓ Found CSV at: {path}")
            break
    
    if not csv_found:
        print(f"✗ Could not find {CSV_FILE} in any location!")
        print(f"✗ Please ensure the file is in: {current_dir}")
        return
    
    # Read CSV
    try:
        df = pd.read_csv(csv_found)
        print(f"✓ Loaded {len(df)} contacts from {CSV_FILE}")
    except FileNotFoundError:
        print(f"✗ Error: CSV file '{CSV_FILE}' not found!")
        return
    except Exception as e:
        print(f"✗ Error reading CSV: {str(e)}")
        return
    
    # Validate columns
    if 'whatsapp_number' not in df.columns or 'business_name' not in df.columns:
        print("✗ Error: CSV must contain 'whatsapp_number' and 'business_name' columns")
        print(f"   Found columns: {', '.join(df.columns)}")
        return
    
    # Clean data
    df = df.dropna(subset=['whatsapp_number', 'business_name'])
    df = df.reset_index(drop=True)
    
    # Load progress
    processed = load_progress(CSV_FILE)
    remaining = len(df) - len(processed)
    
    if processed:
        print(f"📂 Resuming: {len(processed)} already sent, {remaining} remaining")
    
    # Setup driver
    print("\n🚀 Starting Chrome WebDriver...")
    driver = setup_driver(headless=HEADLESS)
    
    try:
        # Open WhatsApp Web
        driver.get('https://web.whatsapp.com')
        
        # Wait for login
        if not wait_for_whatsapp_login(driver):
            return
        
        # Stats
        sent_count = 0
        failed_count = 0
        skipped_count = len(processed)
        start_time = time.time()
        
        print(f"📱 Sending to {remaining} contacts...")
        print(f"⚡ Rate: ~{60//WAIT_TIME} messages/minute")
        print(f"📦 Batch size: {BATCH_SIZE} messages")
        print(f"⏱️  Est. time: {(remaining * WAIT_TIME + (remaining // BATCH_SIZE) * BATCH_REST) // 60} minutes\n")
        
        # Send messages
        for idx, row in df.iterrows():
            # Skip if already processed
            if idx in processed:
                continue
            
            business_name = row['business_name']
            phone_number = format_whatsapp_number(row['whatsapp_number'])
            
            # Personalize message
            message = MESSAGE_TEMPLATE.format(
                your_name=YOUR_NAME,
                business_name=business_name
            )
            
            # Progress indicator
            total_sent = sent_count + skipped_count
            print(f"[{total_sent + 1}/{len(df)}] {business_name[:30]:<30} | {phone_number}", end=' ')
            
            # Send message
            if send_message_fast(driver, phone_number, message, WAIT_TIME):
                print("✓")
                sent_count += 1
                processed.add(idx)
                
                # Save progress every 10 messages
                if sent_count % 10 == 0:
                    save_progress(CSV_FILE, processed)
                
                # Batch rest
                if sent_count % BATCH_SIZE == 0:
                    elapsed = time.time() - start_time
                    rate = sent_count / (elapsed / 60)
                    print(f"\n⏸️  Batch complete! Resting for {BATCH_REST}s... (Rate: {rate:.1f} msg/min)")
                    time.sleep(BATCH_REST)
                    print("▶️  Resuming...\n")
            else:
                failed_count += 1
        
        # Final save
        save_progress(CSV_FILE, processed)
        
        # Summary
        elapsed = time.time() - start_time
        print("\n" + "="*60)
        print("📊 SUMMARY")
        print("="*60)
        print(f"✓ Successfully sent: {sent_count}")
        print(f"✗ Failed: {failed_count}")
        print(f"⏭️  Skipped (already sent): {skipped_count}")
        print(f"📝 Total in CSV: {len(df)}")
        print(f"⏱️  Total time: {elapsed//60:.0f}m {elapsed%60:.0f}s")
        print(f"⚡ Average rate: {sent_count/(elapsed/60):.1f} messages/minute")
        print("="*60)
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user. Progress saved!")
        save_progress(CSV_FILE, processed)
    except Exception as e:
        print(f"\n✗ Error: {str(e)}")
        save_progress(CSV_FILE, processed)
    finally:
        driver.quit()
        print("\n👋 Browser closed. Done!")

if __name__ == "__main__":
    print("="*60)
    print("WhatsApp Automated DM Sender - Fast & Background Mode")
    print("="*60)
    main()