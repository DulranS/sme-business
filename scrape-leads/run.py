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
from datetime import datetime

# ==============================
# 🔧 CONFIGURATION
# ==============================
LOG_FILE = "lead_pipeline.log"
SCRAPER_SCRIPT = "lean_business_scraper.py"
PREPARER_SCRIPT = "whatsapp_lead_preparer.py"

# Expected output from scraper → input for preparer
LEADS_FILE = "colombo_b2b_leads.csv"

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
def run_script(script_name):
    """Run a Python script as a subprocess with error capture."""
    logger.info(f"▶️ Launching: {script_name}")
    try:
        result = subprocess.run(
            [sys.executable, script_name],
            capture_output=True,
            text=True,
            cwd=os.getcwd()
        )
        if result.returncode != 0:
            logger.error(f"❌ {script_name} FAILED with exit code {result.returncode}")
            logger.error(f"STDERR: {result.stderr}")
            return False
        else:
            logger.info(f"✅ {script_name} completed successfully")
            return True
    except Exception as e:
        logger.exception(f"💥 Failed to execute {script_name}: {e}")
        return False

def main():
    logger.info("=" * 60)
    logger.info("🚀 STARTING END-TO-END B2B LEAD PIPELINE (Colombo → WhatsApp)")
    logger.info("=" * 60)

    # === PHASE 1: Scrape B2B Leads ===
    if not os.path.exists(SCRAPER_SCRIPT):
        logger.error(f"❌ Scraper script not found: {SCRAPER_SCRIPT}")
        return False

    success = run_script(SCRAPER_SCRIPT)
    if not success:
        logger.critical("🛑 Pipeline halted: Scraper failed.")
        return False

    # Verify leads file was created
    if not os.path.exists(LEADS_FILE):
        logger.warning(f"⚠️ Scraper ran but did not produce '{LEADS_FILE}'")
        logger.info("   → Proceeding to preparer anyway (it will handle missing file gracefully)")
    else:
        file_size = os.path.getsize(LEADS_FILE)
        if file_size == 0:
            logger.warning("EmptyEntries: Leads file is empty.")
        else:
            with open(LEADS_FILE, "r", encoding="utf-8") as f:
                line_count = sum(1 for _ in f)
            logger.info(f"📥 Scraper output: {line_count - 1} leads (excluding header)")

    # === PHASE 2: Prepare for WhatsApp ===
    if not os.path.exists(PREPARER_SCRIPT):
        logger.error(f"❌ Preparer script not found: {PREPARER_SCRIPT}")
        return False

    success = run_script(PREPARER_SCRIPT)
    if not success:
        logger.critical("🛑 Pipeline halted: WhatsApp preparer failed.")
        return False

    # Final check
    whatsapp_file = "whatsapp_ready_leads.csv"
    if os.path.exists(whatsapp_file):
        with open(whatsapp_file, "r", encoding="utf-8") as f:
            lines = sum(1 for _ in f)
        if lines > 1:
            logger.info(f"🎉 PIPELINE SUCCESS! WhatsApp-ready leads: {lines - 1}")
        else:
            logger.warning("📭 WhatsApp file exists but contains no leads.")
    else:
        logger.warning("⚠️ WhatsApp output file not found — check preparer logs.")

    logger.info("🔚 Lead pipeline completed.")
    return True

# ==============================
# ▶️ EXECUTION
# ==============================
if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)