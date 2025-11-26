"""
run_lead_pipeline.py

🎯 END-TO-END B2B LEAD PIPELINE — Colombo → WhatsApp
High-leverage, auditable, failure-resilient pipeline for revenue-critical lead gen.

🧠 Strategic Features:
- Auto-infers current Monday if no --week0 provided
- Validates date formats
- Measures funnel conversion (scraped → WhatsApp-ready)
- Outputs structured success/failure report
- Safe for CI/CD, manual runs, and scheduled automation
- Ready for monitoring/alerting integration

Arguments:
    --week0    (current Monday, YYYY-MM-DD) → auto-filled if missing
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
import json
from datetime import datetime, timedelta
from pathlib import Path


# ==============================
# 🔧 CONFIGURATION
# ==============================
SCRIPT_DIR = Path(__file__).parent.resolve()
LOG_FILE = SCRIPT_DIR / "lead_pipeline.log"
METRICS_FILE = SCRIPT_DIR / "last_run_metrics.json"  # For dashboards

SCRAPER_SCRIPT = SCRIPT_DIR / "lean_business_scraper.py"
PREPARER_SCRIPT = SCRIPT_DIR / "whatsapp_lead_preparer.py"

DATA_DIR = SCRIPT_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

LEADS_FILE = DATA_DIR / "b2b_leads.csv"
WHATSAPP_OUTPUT = DATA_DIR / "output_business_leads.csv"
INVALID_LEADS_FILE = DATA_DIR / "invalid_or_landline_leads.csv"

FRONTEND_LEADS_DIR = SCRIPT_DIR.parent / "frontend" / "app" / "api" / "leads"
FRONTEND_FINAL_PATH = FRONTEND_LEADS_DIR / "whatsapp_leads.csv"


# ==============================
# 📝 LOGGING SETUP
# ==============================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("LeadPipeline")


# ==============================
# 🗓️ Utility: Auto-detect current Monday
# ==============================
def get_monday_of_week(dt: datetime) -> str:
    """Return Monday of the week (ISO) as YYYY-MM-DD string."""
    monday = dt - timedelta(days=dt.weekday())
    return monday.strftime("%Y-%m-%d")


def parse_and_validate_date(date_str: str, name: str) -> str:
    """Parse and return YYYY-MM-DD, or raise ValueError."""
    if not date_str:
        return ""
    try:
        parsed = datetime.strptime(date_str, "%Y-%m-%d")
        # Ensure it's a Monday
        if parsed.weekday() != 0:
            raise ValueError(f"{name} must be a Monday (weekday=0), got {date_str} (weekday={parsed.weekday()})")
        return date_str
    except ValueError as e:
        raise ValueError(f"Invalid {name} date '{date_str}': {e}")


# ==============================
# 🔧 Subprocess runner with diagnostics
# ==============================
def run_script(script_path: Path, env_vars=None):
    script_name = script_path.name
    logger.info(f"▶️ Launching: {script_name}")

    if not script_path.is_file():
        logger.error(f"❌ Script not found: {script_path}")
        return False

    try:
        env = os.environ.copy()
        if env_vars:
            env.update({k: str(v) for k, v in env_vars.items()})

        result = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True,
            text=True,
            cwd=SCRIPT_DIR,
            env=env,
            timeout=300  # 5 minutes
        )

        if result.stdout.strip():
            for line in result.stdout.strip().split('\n'):
                logger.debug(f"[{script_name} STDOUT] {line}")
        if result.stderr.strip():
            for line in result.stderr.strip().split('\n'):
                logger.warning(f"[{script_name} STDERR] {line}")

        if result.returncode != 0:
            logger.error(f"❌ FAILED with exit code {result.returncode}")
            return False

        logger.info(f"✅ Completed: {script_name}")
        return True

    except subprocess.TimeoutExpired:
        logger.exception(f"💥 Execution timed out after 5 minutes")
        return False
    except Exception as e:
        logger.exception(f"💥 Unexpected execution error: {e}")
        return False


# ==============================
# 📊 Count CSV rows (excluding header)
# ==============================
def count_csv_rows(filepath: Path) -> int:
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return max(0, sum(1 for _ in f) - 1)
    except Exception:
        return 0


# ==============================
# 🔍 Argument parsing with smart defaults
# ==============================
def parse_args():
    parser = argparse.ArgumentParser(description="Strategic B2B Lead Pipeline")

    parser.add_argument("--week0", type=str, help="Current Monday (YYYY-MM-DD)")
    parser.add_argument("--week1", type=str, help="Last Monday")
    parser.add_argument("--week2", type=str, help="Monday -2 weeks")
    parser.add_argument("--week3", type=str, help="Monday -3 weeks")

    args = parser.parse_args()

    # Auto-fill week0 if missing
    if not args.week0:
        args.week0 = get_monday_of_week(datetime.now())
        logger.info(f"📅 Auto-filled week0 (current Monday): {args.week0}")

    # Validate all provided dates
    try:
        args.week0 = parse_and_validate_date(args.week0, "week0")
        args.week1 = parse_and_validate_date(args.week1, "week1") if args.week1 else ""
        args.week2 = parse_and_validate_date(args.week2, "week2") if args.week2 else ""
        args.week3 = parse_and_validate_date(args.week3, "week3") if args.week3 else ""
    except ValueError as e:
        logger.error(f"❌ Date validation error: {e}")
        sys.exit(1)

    return args


# ==============================
# 📤 Optional: Send alert (uncomment & configure if needed)
# ==============================
def send_failure_alert(message: str):
    """
    Example: Post to Slack/Discord webhook on critical failure.
    Replace with your actual alerting logic.
    """
    # import requests
    # webhook_url = os.getenv("ALERT_WEBHOOK_URL")
    # if webhook_url:
    #     requests.post(webhook_url, json={"text": f"[LEAD PIPELINE FAILED] {message}"})
    pass


# ==============================
# 🚀 MAIN PIPELINE — Business-Ready
# ==============================
def main():
    start_time = datetime.now()
    args = parse_args()

    logger.info("=" * 60)
    logger.info("🚀 STRATEGIC B2B LEAD PIPELINE — Colombo → WhatsApp")
    logger.info(f"⏱️  Started at: {start_time.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    logger.info("=" * 60)

    logger.info("📅 WEEK PARAMETERS:")
    logger.info(f"    WEEK0: {args.week0} (current)")
    logger.info(f"    WEEK1: {args.week1}")
    logger.info(f"    WEEK2: {args.week2}")
    logger.info(f"    WEEK3: {args.week3}")

    metrics = {
        "run_id": start_time.isoformat(),
        "week0": args.week0,
        "week1": args.week1,
        "week2": args.week2,
        "week3": args.week3,
        "scraped_leads": 0,
        "whatsapp_ready_leads": 0,
        "invalid_leads": 0,
        "success": False,
        "error": None,
        "runtime_seconds": 0,
    }

    try:
        # ==============================
        # 🔵 PHASE 1 — Scraper
        # ==============================
        scraper_env = {
            "LEADS_FILE": str(LEADS_FILE),
            "WEEK0": args.week0,
            "WEEK1": args.week1,
            "WEEK2": args.week2,
            "WEEK3": args.week3,
        }

        if not run_script(SCRAPER_SCRIPT, env_vars=scraper_env):
            raise RuntimeError("Scraper failed to execute or crashed.")

        if not LEADS_FILE.exists():
            raise FileNotFoundError(f"Scraper did not produce {LEADS_FILE}")

        metrics["scraped_leads"] = count_csv_rows(LEADS_FILE)
        logger.info(f"📥 Scraped {metrics['scraped_leads']} leads")

        if metrics["scraped_leads"] == 0:
            logger.warning("⚠️  Zero leads scraped — check data sources or week filters.")

        # ==============================
        # 🟢 PHASE 2 — Preparer
        # ==============================
        preparer_env = {
            "INPUT_FILE": str(LEADS_FILE),
            "OUTPUT_FILE": str(WHATSAPP_OUTPUT),
            "INVALID_FILE": str(INVALID_LEADS_FILE),
            "WEEK0": args.week0,
            "WEEK1": args.week1,
            "WEEK2": args.week2,
            "WEEK3": args.week3,
        }

        if not run_script(PREPARER_SCRIPT, env_vars=preparer_env):
            raise RuntimeError("Preparer failed.")

        if not WHATSAPP_OUTPUT.exists():
            raise FileNotFoundError("Preparer did not generate WhatsApp output.")

        metrics["whatsapp_ready_leads"] = count_csv_rows(WHATSAPP_OUTPUT)
        metrics["invalid_leads"] = count_csv_rows(INVALID_LEADS_FILE)

        logger.info(f"📱 WhatsApp-ready: {metrics['whatsapp_ready_leads']}")
        logger.info(f"🗑️  Invalid/landline: {metrics['invalid_leads']}")

        # Funnel efficiency
        if metrics["scraped_leads"] > 0:
            efficiency = (metrics["whatsapp_ready_leads"] / metrics["scraped_leads"]) * 100
            logger.info(f"📊 Funnel efficiency: {efficiency:.1f}%")

        # ==============================
        # 🟣 PHASE 3 — Publish
        # ==============================
        FRONTEND_LEADS_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(WHATSAPP_OUTPUT, FRONTEND_FINAL_PATH)

        # Verify copy
        if not FRONTEND_FINAL_PATH.exists():
            raise RuntimeError("Failed to publish to frontend — file missing after copy.")

        logger.info(f"📤 Published to: {FRONTEND_FINAL_PATH}")

        # ✅ SUCCESS
        metrics["success"] = True
        logger.info("✅ PIPELINE COMPLETED SUCCESSFULLY — leads ready for sales outreach!")

    except Exception as e:
        error_msg = str(e)
        logger.error(f"💥 PIPELINE FAILED: {error_msg}")
        metrics["error"] = error_msg
        send_failure_alert(error_msg)
        return False
    finally:
        # Finalize metrics
        runtime = (datetime.now() - start_time).total_seconds()
        metrics["runtime_seconds"] = round(runtime, 2)

        # Save structured metrics for BI/dashboards
        try:
            with open(METRICS_FILE, "w", encoding="utf-8") as f:
                json.dump(metrics, f, indent=2)
            logger.debug(f"📊 Metrics saved to: {METRICS_FILE}")
        except Exception as e:
            logger.warning(f"⚠️  Failed to save metrics: {e}")

        # Summary log
        if metrics["success"]:
            logger.info(
                f"📈 BUSINESS IMPACT: {metrics['whatsapp_ready_leads']} new leads ready for WhatsApp outreach."
            )
        else:
            logger.info("📉 BUSINESS IMPACT: Pipeline failure — no new leads generated.")

    return metrics["success"]


# ==============================
# ▶️ EXECUTION
# ==============================
if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.info("🛑 Pipeline interrupted by user.")
        sys.exit(1)
    except Exception as e:
        logger.exception(f"💥 Unhandled crash: {e}")
        sys.exit(1)