"""
run_lead_pipeline.py

🎯 END-TO-END B2B LEAD PIPELINE — Colombo → WhatsApp
✅ Runs scraper → preparer in sequence
✅ Validates handoff between stages
✅ Preserves audit trail & cost control
✅ Safe for scheduled execution (e.g., cron)

Designed for founders & sales teams in Sri Lanka who want:
   High-intent B2B leads → Ready-to-message on WhatsApp
"""

import os
import sys
import subprocess
import logging
import shutil
from datetime import datetime

# ==============================
# 🔧 CONFIGURATION
# ==============================
LOG_FILE = "lead_pipeline.log"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

SCRAPER_SCRIPT = os.path.join(SCRIPT_DIR, "lean_business_scraper.py")
PREPARER_SCRIPT = os.path.join(SCRIPT_DIR, "whatsapp_lead_preparer.py")

# Use a dedicated data directory for intermediate files
DATA_DIR = os.path.join(SCRIPT_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

# Intermediate file (scraper output → preparer input)
LEADS_FILE = os.path.join(DATA_DIR, "b2b_leads.csv")

# Final output from preparer
WHATSAPP_OUTPUT = os.path.join(DATA_DIR, "output_business_leads.csv")

# Frontend target (only for final, clean leads)
FRONTEND_LEADS_DIR = os.path.normpath(
    os.path.join(SCRIPT_DIR, "..", "frontend", "app", "api", "leads")
)
FRONTEND_FINAL_PATH = os.path.join(FRONTEND_LEADS_DIR, "whatsapp_leads.csv")

# Setup logging
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
# 🚀 EXECUTION FUNCTIONS
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
        else:
            logger.info(f"✅ Completed successfully")
            return True
    except Exception as e:
        logger.exception(f"💥 Execution failed: {e}")
        return False

def main():
    logger.info("=" * 60)
    logger.info("🚀 STARTING END-TO-END B2B LEAD PIPELINE (Colombo → WhatsApp)")
    logger.info("=" * 60)

    # === PHASE 1: Scrape B2B Leads ===
    if not os.path.exists(SCRAPER_SCRIPT):
        logger.error(f"❌ Scraper not found: {SCRAPER_SCRIPT}")
        return False

    # Tell scraper where to write
    success = run_script(SCRAPER_SCRIPT, env_vars={"LEADS_FILE": LEADS_FILE})
    if not success:
        logger.critical("🛑 Pipeline halted: Scraper failed.")
        return False

    # Verify scraper output
    if not os.path.exists(LEADS_FILE):
        logger.error(f"❌ Scraper did not produce expected file: {LEADS_FILE}")
        return False

    file_size = os.path.getsize(LEADS_FILE)
    if file_size == 0:
        logger.warning("EmptyEntries: Leads file is empty.")
    else:
        with open(LEADS_FILE, "r", encoding="utf-8") as f:
            line_count = sum(1 for _ in f)
        logger.info(f"📥 Scraper output: {line_count - 1} leads (excluding header)")

    # === PHASE 2: Prepare for WhatsApp ===
    if not os.path.exists(PREPARER_SCRIPT):
        logger.error(f"❌ Preparer not found: {PREPARER_SCRIPT}")
        return False

    # Tell preparer where to read from and write to
    success = run_script(
        PREPARER_SCRIPT,
        env_vars={
            "INPUT_FILE": LEADS_FILE,
            "OUTPUT_FILE": WHATSAPP_OUTPUT,
            "INVALID_FILE": os.path.join(DATA_DIR, "invalid_or_landline_leads.csv")
        }
    )
    if not success:
        logger.critical("🛑 Pipeline halted: WhatsApp preparer failed.")
        return False

    # Verify final output
    if not os.path.exists(WHATSAPP_OUTPUT):
        logger.error("❌ WhatsApp preparer did not produce output file.")
        return False

    with open(WHATSAPP_OUTPUT, "r", encoding="utf-8") as f:
        lines = sum(1 for _ in f)
    lead_count = max(0, lines - 1)  # minus header

    if lead_count == 0:
        logger.warning("📭 WhatsApp output exists but contains no leads.")
    else:
        logger.info(f"🎉 SUCCESS: {lead_count} WhatsApp-ready leads generated!")

    # === PHASE 3: Publish to Frontend (Optional) ===
    try:
        os.makedirs(FRONTEND_LEADS_DIR, exist_ok=True)
        shutil.copy2(WHATSAPP_OUTPUT, FRONTEND_FINAL_PATH)
        logger.info(f"📤 Published clean leads to frontend: {FRONTEND_FINAL_PATH}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to publish to frontend (non-fatal): {e}")

    logger.info("🔚 Lead pipeline completed successfully.")
    return True

# ==============================
# ▶️ EXECUTION
# ==============================
if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)