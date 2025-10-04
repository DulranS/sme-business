import os
import pandas as pd
import time
from datetime import datetime
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException
import urllib.parse
import validate

# === Prepare CSV ===
print("\n⚙️ Preparing WhatsApp-formatted leads file...")
try:
    csv_path = validate.prepare_csv()  # outputs: output_business_leads.csv
    print("✓ CSV file ready for WhatsApp sender!\n")
except Exception as e:
    print(f"✗ Error preparing CSV: {str(e)}")
    exit(1)

CSV_FILE = "output_business_leads.csv"

# === Chrome WebDriver setup ===
def setup_driver(headless=False):
    """
    Setup Chrome WebDriver with Windows-friendly options.
    """
    chrome_options = Options()
    
    if headless:
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--disable-gpu')
    
    # Stability flags
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-extensions')
    chrome_options.add_argument('--disable-notifications')
    chrome_options.add_argument('--disable-blink-features=AutomationControlled')
    chrome_options.add_argument('--start-maximized')

    # Temporary user profile to avoid conflicts
    tmp_profile = os.path.join(os.path.expanduser("~"), "whatsapp_temp_profile")
    os.makedirs(tmp_profile, exist_ok=True)
    chrome_options.add_argument(f"--user-data-dir={tmp_profile}")

    # Suppress logs
    chrome_options.add_experimental_option('excludeSwitches', ['enable-logging'])
    chrome_options.add_experimental_option('useAutomationExtension', False)

    try:
        driver = webdriver.Chrome(options=chrome_options)
        driver.set_page_load_timeout(30)
        return driver
    except Exception as e:
        print(f"✗ Failed to start Chrome WebDriver: {e}")
        raise e

# === Wait for login ===
def wait_for_whatsapp_login(driver, timeout=60):
    print("\n⏳ Waiting for WhatsApp Web login... Scan QR code if needed.")
    try:
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, '[aria-label*="Chat list"]'))
        )
        print("✓ Logged into WhatsApp Web!\n")
        return True
    except TimeoutException:
        print("✗ Login timeout.")
        return False

# === Send message ===
def send_message_fast(driver, phone_number, message, wait_time=3):
    try:
        url = f"https://web.whatsapp.com/send?phone={phone_number}&text={urllib.parse.quote(message)}"
        driver.get(url)
        time.sleep(1)  # short pause

        # Invalid number check
        try:
            page_text = driver.find_element(By.TAG_NAME, 'body').text.lower()
            if 'phone number shared via url is invalid' in page_text:
                return False
        except:
            pass

        # Wait for message box
        try:
            msg_box = WebDriverWait(driver, 8).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, 'div[contenteditable="true"][data-tab="10"]'))
            )
        except TimeoutException:
            return False

        msg_box.send_keys(Keys.ENTER)
        time.sleep(wait_time)
        return True
    except:
        return False

# === Save/load progress ===
def save_progress(csv_file, processed_indices):
    progress_file = csv_file.replace('.csv', '_progress.json')
    with open(progress_file, 'w') as f:
        json.dump({'processed': list(processed_indices), 'last_updated': str(datetime.now())}, f)

def load_progress(csv_file):
    progress_file = csv_file.replace('.csv', '_progress.json')
    if os.path.exists(progress_file):
        with open(progress_file, 'r') as f:
            data = json.load(f)
            return set(data.get('processed', []))
    return set()

# === Main ===
def main():
    YOUR_NAME = os.getenv("YOUR_NAME", "Syndicate")
    MESSAGE_TEMPLATE = os.getenv("MESSAGE",
        "Hi! I'm {your_name} from a digital marketing agency. Noticed {business_name} could benefit from online marketing. Interested in a free consultation? Reply STOP to opt-out."
    )
    WAIT_TIME = int(os.getenv("WAIT_TIME", "3"))
    BATCH_SIZE = int(os.getenv("BATCH_SIZE", "50"))
    BATCH_REST = int(os.getenv("BATCH_REST", "60"))
    HEADLESS = os.getenv("HEADLESS", "false").lower() == "true"

    # Load CSV
    if not os.path.exists(CSV_FILE):
        print(f"✗ CSV file {CSV_FILE} not found.")
        return
    df = pd.read_csv(CSV_FILE)
    if 'whatsapp_number' not in df.columns or 'business_name' not in df.columns:
        print("✗ CSV must contain 'whatsapp_number' and 'business_name'")
        return
    df = df.dropna(subset=['whatsapp_number', 'business_name']).reset_index(drop=True)

    processed = load_progress(CSV_FILE)
    remaining = len(df) - len(processed)
    if processed:
        print(f"📂 Resuming: {len(processed)} already sent, {remaining} remaining")

    # Setup driver
    driver = setup_driver(headless=HEADLESS)
    driver.get("https://web.whatsapp.com")
    if not wait_for_whatsapp_login(driver):
        return

    sent_count = 0
    failed_count = 0
    skipped_count = len(processed)
    start_time = time.time()

    for idx, row in df.iterrows():
        if idx in processed:
            continue

        business_name = row['business_name']
        phone_number = str(row['whatsapp_number'])  # send as-is from CSV
        message = MESSAGE_TEMPLATE.format(your_name=YOUR_NAME, business_name=business_name)

        print(f"[{sent_count + skipped_count + 1}/{len(df)}] {business_name[:30]:<30} | {phone_number}", end=' ')
        if send_message_fast(driver, phone_number, message, WAIT_TIME):
            print("✓")
            sent_count += 1
        else:
            print("✗ Skipped")
            failed_count += 1

        processed.add(idx)

        if sent_count % 10 == 0:
            save_progress(CSV_FILE, processed)
        if sent_count % BATCH_SIZE == 0:
            print(f"\n⏸️ Batch complete. Resting {BATCH_REST}s...")
            time.sleep(BATCH_REST)

    save_progress(CSV_FILE, processed)

    elapsed = time.time() - start_time
    print("\n=== SUMMARY ===")
    print(f"✓ Sent: {sent_count}")
    print(f"✗ Failed: {failed_count}")
    print(f"⏭️ Skipped: {skipped_count}")
    print(f"📝 Total: {len(df)}")
    print(f"⏱️ Time: {elapsed//60:.0f}m {elapsed%60:.0f}s")
    driver.quit()
    print("👋 Browser closed. Done!")

if __name__ == "__main__":
    print("="*60)
    print("WhatsApp Automated DM Sender - Fast & Windows Friendly")
    print("="*60)
    main()
