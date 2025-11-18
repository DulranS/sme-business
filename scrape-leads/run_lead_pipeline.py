"""
run_lead_pipeline.py

🎯 END-TO-END B2B LEAD PIPELINE — Colombo → WhatsApp
Now supports weekly automation with 4 precise Monday week-start dates.

Arguments added:
    --week0    (current Monday)
    --week1    (1 week ago Monday)
    --week2    (2 weeks ago Monday)
    --week3    (3 weeks ago Monday)
"""

import os
import sys
import subprocess
import logging
import shutil
import argparse
from datetime import datetime


# ==============================
# 🔧 CONFIGURATION
# ==============================
LOG_FILE = "lead_pipeline.log"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

SCRAPER_SCRIPT = os.path.join(SCRIPT_DIR, "lean_business_scraper.py")
PREPARER_SCRIPT = os.path.join(SCRIPT_DIR, "whatsapp_lead_preparer.py")

# Temporary working data
DATA_DIR = os.path.join(SCRIPT_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

LEADS_FILE = os.path.join(DATA_DIR, "b2b_leads.csv")
WHATSAPP_OUTPUT = os.path.join(DATA_DIR, "output_business_leads.csv")

# Final publishing location
FRONTEND_LEADS_DIR = os.path.normpath(
    os.path.join(SCRIPT_DIR, "..", "frontend", "app", "api", "leads")
)
FRONTEND_FINAL_PATH = os.path.join(FRONTEND_LEADS_DIR, "whatsapp_leads.csv")


# ==============================
# 📝 LOGGING SETUP
# ==============================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("LeadPipeline")


# ==============================
# 🔧 Subprocess wrapper
# ==============================
def run_script(script_path, env_vars=None):
    """Run a Python script as a subprocess with error capture."""
    logger.info(f"▶️ Launching: {os.path.basename(script_path)}")

    try:
        env = os.environ.copy()
        if env_vars:
            env.update(env_vars)

        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            cwd=SCRIPT_DIR,
            env=env,
            timeout=300  # 5 minutes
        )

        if result.returncode != 0:
            logger.error(f"❌ FAILED with exit code {result.returncode}")
            logger.error(f"STDERR: {result.stderr}")
            return False

        logger.info(f"✅ Completed successfully")
        return True

    except Exception as e:
        logger.exception(f"💥 Execution failed: {e}")
        return False


# ==============================
# 🔍 Argument parsing
# ==============================
def parse_args():
    parser = argparse.ArgumentParser(description="Weekly B2B Lead Pipeline")

    parser.add_argument("--week0", type=str, help="Current Monday")
    parser.add_argument("--week1", type=str, help="Last Monday")
    parser.add_argument("--week2", type=str, help="Monday -2 weeks")
    parser.add_argument("--week3", type=str, help="Monday -3 weeks")

    return parser.parse_args()


# ==============================
# 🚀 MAIN PIPELINE
# ==============================
def main():
    args = parse_args()

    logger.info("=" * 60)
    logger.info("🚀 STARTING END-TO-END B2B LEAD PIPELINE (Colombo → WhatsApp)")
    logger.info("=" * 60)

    # Log week parameters (even if None)
    logger.info("📅 WEEK PARAMETERS RECEIVED:")
    logger.info(f"    WEEK0: {args.week0}")
    logger.info(f"    WEEK1: {args.week1}")
    logger.info(f"    WEEK2: {args.week2}")
    logger.info(f"    WEEK3: {args.week3}")

    # ==============================
    # 🔵 PHASE 1 — Scraper
    # ==============================
    if not os.path.exists(SCRAPER_SCRIPT):
        logger.error(f"❌ Scraper not found: {SCRAPER_SCRIPT}")
        return False

    # Send week data into scraper via environment variables
    scraper_env = {
        "LEADS_FILE": LEADS_FILE,
        "WEEK0": args.week0 or "",
        "WEEK1": args.week1 or "",
        "WEEK2": args.week2 or "",
        "WEEK3": args.week3 or "",
    }

    success = run_script(SCRAPER_SCRIPT, env_vars=scraper_env)
    if not success:
        logger.critical("🛑 Pipeline halted: Scraper failed.")
        return False

    # Validate scraper output
    if not os.path.exists(LEADS_FILE):
        logger.error(f"❌ Scraper did not create expected file: {LEADS_FILE}")
        return False

    try:
        with open(LEADS_FILE, "r", encoding="utf-8") as f:
            lines = sum(1 for _ in f)
        logger.info(f"📥 Scraper output: {max(0, lines - 1)} leads")
    except:
        logger.warning("⚠️ Failed to read scraper output file.")

    # ==============================
    # 🟢 PHASE 2 — Preparer
    # ==============================
    if not os.path.exists(PREPARER_SCRIPT):
        logger.error(f"❌ Preparer not found: {PREPARER_SCRIPT}")
        return False

    preparer_env = {
        "INPUT_FILE": LEADS_FILE,
        "OUTPUT_FILE": WHATSAPP_OUTPUT,
        "INVALID_FILE": os.path.join(DATA_DIR, "invalid_or_landline_leads.csv"),
        "WEEK0": args.week0 or "",
        "WEEK1": args.week1 or "",
        "WEEK2": args.week2 or "",
        "WEEK3": args.week3 or "",
    }

    success = run_script(PREPARER_SCRIPT, env_vars=preparer_env)
    if not success:
        logger.critical("🛑 Pipeline halted: Preparer failed.")
        return False

    if not os.path.exists(WHATSAPP_OUTPUT):
        logger.error("❌ Preparer did not produce final WhatsApp file.")
        return False

    # Count WhatsApp-ready leads
    try:
        with open(WHATSAPP_OUTPUT, "r", encoding="utf-8") as f:
            lines = sum(1 for _ in f)
        logger.info(f"🎉 Final WhatsApp-ready lead count: {max(0, lines - 1)}")
    except:
        logger.warning("⚠️ Could not count WhatsApp leads.")

    # ==============================
    # 🟣 PHASE 3 — Publish to frontend
    # ==============================
    try:
        os.makedirs(FRONTEND_LEADS_DIR, exist_ok=True)
        shutil.copy2(WHATSAPP_OUTPUT, FRONTEND_FINAL_PATH)
        logger.info(f"📤 Published clean leads to frontend: {FRONTEND_FINAL_PATH}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to publish to frontend: {e}")

    logger.info("🔚 Lead pipeline completed successfully.")
    return True


# ==============================
# ▶️ EXECUTION
# ==============================
if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
