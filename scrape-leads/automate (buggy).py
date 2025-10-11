"""
whatsapp_sender.py

🎯 SAFE & RELIABLE WHATSAPP BULK SENDER — Sri Lanka Optimized
✅ Uses E.164 numbers (9477...)
✅ Resumes after crash
✅ Avoids ban with safe delays
✅ Works with output from whatsapp_lead_preparer.py
✅ Detects invalid numbers & timeouts

⚠️ Use responsibly: Max 80–100 messages/day per number.
"""

import os
import pandas as pd
import time
import json
import urllib.parse
import sys
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException

# ==============================
# 🔧 CONFIGURATION
# ==============================
CSV_FILE = "whatsapp_ready_leads.csv"  # Output from whatsapp_lead_preparer.py
LOG_FILE = "whatsapp_sender.log"

# Setup basic logging to file + console
import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("WhatsAppSender")

# ==============================
# 🌐 CHROME DRIVER SETUP
# ==============================
def setup_driver(headless=False):
    chrome_options = Options()
    
    if headless:
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--disable-gpu')
    
    # Stability & anti-detection
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-extensions')
    chrome_options.add_argument('--disable-notifications')
    chrome_options.add_argument('--disable-blink-features=AutomationControlled')
    chrome_options.add_argument('--start-maximized')
    chrome_options.add_experimental_option('excludeSwitches', ['enable-logging'])
    chrome_options.add_experimental_option('useAutomationExtension', False)

    # Temporary profile
    tmp_profile = os.path.join(os.path.expanduser("~"), "whatsapp_temp_profile")
    os.makedirs(tmp_profile, exist_ok=True)
    chrome_options.add_argument(f"--user-data-dir={tmp_profile}")

    try:
        driver = webdriver.Chrome(options=chrome_options)
        driver.set_page_load_timeout(30)
        # Anti-bot detection override
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        return driver
    except Exception as e:
        logger.error(f"Failed to start Chrome: {e}")
        raise

# ==============================
# 🔐 WAIT FOR LOGIN
# ==============================
def wait_for_whatsapp_login(driver, timeout=120):
    logger.info("⏳ Waiting for WhatsApp Web login... Scan QR code if needed.")
    try:
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, '[aria-label*="Chat list"], [data-testid="chat-list"]'))
        )
        logger.info("✅ Logged into WhatsApp Web!")
        return True
    except TimeoutException:
        logger.error("❌ Login timeout. Please scan QR code within 2 minutes.")
        return False

# ==============================
# 📤 SEND MESSAGE (SAFE & ROBUST)
# ==============================
def send_message_safe(driver, full_phone, message, wait_time=7):
    try:
        encoded_msg = urllib.parse.quote(message)
        url = f"https://web.whatsapp.com/send?phone={full_phone}&text={encoded_msg}"
        driver.get(url)
        time.sleep(2)  # Let page load

        # Check for invalid number error
        try:
            body_text = driver.find_element(By.TAG_NAME, "body").text.lower()
            if "phone number shared via url is invalid" in body_text:
                logger.warning(f"Invalid number: {full_phone}")
                return False
        except:
            pass  # Ignore if can't read

        # Wait for message input (try multiple known selectors)
        msg_box = None
        selectors = [
            'div[contenteditable="true"][data-tab="10"]',
            'div[contenteditable="true"][data-tab="6"]',
            '[data-testid="conversation-compose-box-input"]',
            'footer div[contenteditable="true"]'
        ]
        for selector in selectors:
            try:
                msg_box = WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                )
                break
            except TimeoutException:
                continue

        if not msg_box:
            logger.warning(f"Message box not found for {full_phone}")
            return False

        # Send
        msg_box.send_keys(Keys.ENTER)
        time.sleep(wait_time)  # Critical: wait before next
        return True

    except Exception as e:
        logger.debug(f"Send error for {full_phone}: {e}")
        return False

# ==============================
# 💾 PROGRESS TRACKING
# ==============================
def save_progress(csv_file, processed_indices):
    progress_file = csv_file.replace('.csv', '_progress.json')
    with open(progress_file, 'w') as f:
        json.dump({
            'processed': list(processed_indices),
            'last_updated': str(datetime.now())
        }, f)

def load_progress(csv_file):
    progress_file = csv_file.replace('.csv', '_progress.json')
    if os.path.exists(progress_file):
        try:
            with open(progress_file, 'r') as f:
                data = json.load(f)
                return set(data.get('processed', []))
        except:
            pass
    return set()

# ==============================
# 🚀 MAIN FUNCTION
# ==============================
def main():
    YOUR_NAME = os.getenv("YOUR_NAME", "Syndicate")
    MESSAGE_TEMPLATE = os.getenv(
        "MESSAGE",
        "Hi! I'm {your_name} from a digital marketing agency. Noticed {business_name} could benefit from online marketing. Interested in a free consultation? Reply STOP to opt-out."
    )
    WAIT_TIME = int(os.getenv("WAIT_TIME", "7"))          # Increased for safety
    BATCH_SIZE = int(os.getenv("BATCH_SIZE", "25"))       # Reduced batch
    BATCH_REST = int(os.getenv("BATCH_REST", "150"))      # 2.5 min rest
    HEADLESS = os.getenv("HEADLESS", "false").lower() == "true"

    # Load leads
    if not os.path.exists(CSV_FILE):
        logger.error(f"CSV file not found: {CSV_FILE}")
        return

    df = pd.read_csv(CSV_FILE)
    required_cols = ["mobile_9digit", "contact_name"]
    if not all(col in df.columns for col in required_cols):
        logger.error(f"CSV must contain: {required_cols}. Found: {list(df.columns)}")
        return

    df = df.dropna(subset=["mobile_9digit", "contact_name"]).reset_index(drop=True)
    logger.info(f"📥 Loaded {len(df)} leads from {CSV_FILE}")

    # Resume support
    processed = load_progress(CSV_FILE)
    if processed:
        logger.info(f"📂 Resuming: {len(processed)} sent, {len(df) - len(processed)} remaining")

    # Start browser
    driver = setup_driver(headless=HEADLESS)
    try:
        driver.get("https://web.whatsapp.com")
        if not wait_for_whatsapp_login(driver):
            return

        sent, failed, skipped = 0, 0, len(processed)
        start_time = time.time()

        for idx, row in df.iterrows():
            if idx in processed:
                continue

            business_name = str(row["contact_name"]).strip()
            local_num = str(row["mobile_9digit"]).strip()

            # Convert 9-digit → E.164 (94771234567)
            if len(local_num) == 9 and local_num.isdigit():
                full_phone = "94" + local_num
            elif local_num.startswith("94") and len(local_num) == 11:
                full_phone = local_num
            else:
                logger.warning(f"Skipping invalid number format: {local_num}")
                failed += 1
                processed.add(idx)
                continue

            message = MESSAGE_TEMPLATE.format(your_name=YOUR_NAME, business_name=business_name)
            logger.info(f"[{sent + skipped + 1}/{len(df)}] Sending to {business_name[:25]:<25} | {full_phone}")

            if send_message_safe(driver, full_phone, message, WAIT_TIME):
                sent += 1
                logger.info("✓ Sent")
            else:
                failed += 1
                logger.info("✗ Failed or invalid")

            processed.add(idx)

            # Save progress every 10 sends
            if len(processed) % 10 == 0:
                save_progress(CSV_FILE, processed)

            # Batch rest
            if sent % BATCH_SIZE == 0 and sent > 0:
                logger.info(f"\n⏸️ Batch of {BATCH_SIZE} sent. Resting {BATCH_REST} seconds...\n")
                time.sleep(BATCH_REST)

        # Final save
        save_progress(CSV_FILE, processed)

        # Summary
        elapsed = time.time() - start_time
        logger.info("\n" + "="*50)
        logger.info("✅ SENDING COMPLETE")
        logger.info(f"✓ Sent:     {sent}")
        logger.info(f"✗ Failed:   {failed}")
        logger.info(f"⏭️ Skipped: {skipped}")
        logger.info(f"⏱️ Time:    {int(elapsed // 60)}m {int(elapsed % 60)}s")
        logger.info("="*50)

    finally:
        driver.quit()
        logger.info("👋 Browser closed.")

# ==============================
# ▶️ RUN
# ==============================
if __name__ == "__main__":
    print("="*60)
    print("🚀 WhatsApp Bulk Sender — Sri Lanka Optimized")
    print("⚠️  Reminder: Stay under 100 messages/day to avoid bans")
    print("="*60)
    main()