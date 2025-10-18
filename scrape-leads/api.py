"""
api_lead_pipeline.py

🎯 B2B LEAD PIPELINE REST API — Colombo → WhatsApp
✅ Async execution with job isolation
✅ Status tracking & real-time logs
✅ Safe concurrent execution
✅ Download WhatsApp-ready leads

Install:
    pip install fastapi uvicorn python-multipart

Run:
    uvicorn api_lead_pipeline:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime
from enum import Enum
import asyncio
import subprocess
import sys
import os
import uuid
import shutil
import logging

# ==============================
# 🔧 CONFIGURATION
# ==============================
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCRAPER_SCRIPT = os.path.join(SCRIPT_DIR, "lean_business_scraper.py")
PREPARER_SCRIPT = os.path.join(SCRIPT_DIR, "whatsapp_lead_preparer.py")
JOBS_BASE_DIR = os.path.join(SCRIPT_DIR, "pipeline_jobs")
LOGS_DIR = os.path.join(JOBS_BASE_DIR, "logs")
OUTPUTS_DIR = os.path.join(JOBS_BASE_DIR, "outputs")

os.makedirs(LOGS_DIR, exist_ok=True)
os.makedirs(OUTPUTS_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s"
)
logger = logging.getLogger("LeadPipelineAPI")

# ==============================
# 📊 DATA MODELS
# ==============================
class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SCRAPING = "scraping"
    PREPARING = "preparing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class PipelineJob(BaseModel):
    job_id: str
    status: JobStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    current_phase: Optional[str] = None
    leads_scraped: int = 0
    leads_prepared: int = 0
    error_message: Optional[str] = None
    log_file: str
    output_dir: str

class JobResponse(BaseModel):
    job_id: str
    status: JobStatus
    message: str

class JobListResponse(BaseModel):
    total_jobs: int
    jobs: List[PipelineJob]

# ==============================
# 💾 JOB STORAGE
# ==============================
jobs_db: Dict[str, PipelineJob] = {}

# ==============================
# 🔄 PIPELINE EXECUTION
# ==============================
async def run_script_async(script_path: str, job_id: str, cwd: str, log_file: str) -> tuple[bool, str]:
    logger.info(f"[{job_id}] ▶️ Launching: {script_path} in {cwd}")
    try:
        process = await asyncio.create_subprocess_exec(
            sys.executable, script_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd
        )
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=600)  # 10 min

        with open(log_file, "a", encoding="utf-8") as f:
            f.write(f"\n=== STDOUT ===\n{stdout.decode() if stdout else ''}\n")
            f.write(f"\n=== STDERR ===\n{stderr.decode() if stderr else ''}\n")

        if process.returncode != 0:
            return False, (stderr.decode() if stderr else "Unknown error")
        return True, ""
    except asyncio.TimeoutError:
        return False, "Script execution timed out (10 minutes)"
    except Exception as e:
        return False, str(e)

async def execute_pipeline(job_id: str):
    job = jobs_db[job_id]
    log_file = job.log_file
    output_dir = job.output_dir

    try:
        with open(log_file, "w", encoding="utf-8") as f:
            f.write(f"{'=' * 60}\n")
            f.write(f"🚀 B2B LEAD PIPELINE JOB: {job_id}\n")
            f.write(f"Started: {job.started_at}\n")
            f.write(f"Output Dir: {output_dir}\n")
            f.write(f"{'=' * 60}\n\n")

        # === PHASE 1: Scraping ===
        job.status = JobStatus.SCRAPING
        job.current_phase = "Scraping B2B leads"
        success, error = await run_script_async(SCRAPER_SCRIPT, job_id, output_dir, log_file)
        if not success:
            raise Exception(f"Scraper failed: {error}")

        leads_file = os.path.join(output_dir, "b2b_leads.csv")
        if os.path.exists(leads_file):
            with open(leads_file, "r", encoding="utf-8") as f:
                job.leads_scraped = max(0, sum(1 for _ in f) - 1)

        # === PHASE 2: Preparing ===
        job.status = JobStatus.PREPARING
        job.current_phase = "Preparing leads for WhatsApp"
        success, error = await run_script_async(PREPARER_SCRIPT, job_id, output_dir, log_file)
        if not success:
            raise Exception(f"Preparer failed: {error}")

        whatsapp_file = os.path.join(output_dir, "whatsapp_ready_leads.csv")
        if os.path.exists(whatsapp_file):
            with open(whatsapp_file, "r", encoding="utf-8") as f:
                job.leads_prepared = max(0, sum(1 for _ in f) - 1)

        # === SUCCESS ===
        job.status = JobStatus.COMPLETED
        job.current_phase = "Pipeline completed"
        job.completed_at = datetime.now()

        with open(log_file, "a", encoding="utf-8") as f:
            f.write(f"\n{'=' * 60}\n🎉 SUCCESS!\nLeads: {job.leads_scraped} → {job.leads_prepared}\n{'=' * 60}\n")

    except Exception as e:
        job.status = JobStatus.FAILED
        job.error_message = str(e)
        job.completed_at = datetime.now()
        logger.exception(f"[{job_id}] 💥 Pipeline failed")

# ==============================
# 🌐 API SETUP
# ==============================
app = FastAPI(
    title="B2B Lead Pipeline API",
    description="Automated B2B lead generation pipeline for Colombo → WhatsApp",
    version="1.1.0"
)

@app.get("/")
async def root():
    return {
        "service": "B2B Lead Pipeline API",
        "status": "operational",
        "endpoints": {
            "start": "POST /pipeline/start",
            "status": "GET /pipeline/status/{job_id}",
            "logs": "GET /pipeline/logs/{job_id}",
            "download": "GET /pipeline/download/{job_id}",
            "jobs": "GET /pipeline/jobs",
            "cancel": "DELETE /pipeline/cancel/{job_id}"
        }
    }

@app.post("/pipeline/start", response_model=JobResponse)
async def start_pipeline(background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())[:8]
    job_dir = os.path.join(OUTPUTS_DIR, job_id)
    log_file = os.path.join(LOGS_DIR, f"job_{job_id}.log")
    os.makedirs(job_dir, exist_ok=True)

    job = PipelineJob(
        job_id=job_id,
        status=JobStatus.PENDING,
        started_at=datetime.now(),
        log_file=log_file,
        output_dir=job_dir
    )
    jobs_db[job_id] = job
    background_tasks.add_task(execute_pipeline, job_id)

    logger.info(f"[{job_id}] 🚀 New job started in {job_dir}")
    return JobResponse(
        job_id=job_id,
        status=JobStatus.PENDING,
        message=f"Job started. Track at /pipeline/status/{job_id}"
    )

@app.get("/pipeline/status/{job_id}", response_model=PipelineJob)
async def get_job_status(job_id: str):
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs_db[job_id]

@app.get("/pipeline/logs/{job_id}")
async def get_job_logs(job_id: str):
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    log_file = jobs_db[job_id].log_file
    if not os.path.exists(log_file):
        return {"job_id": job_id, "logs": "Log file not yet created."}
    with open(log_file, "r", encoding="utf-8") as f:
        logs = f.read()
    return {"job_id": job_id, "logs": logs}

@app.get("/pipeline/download/{job_id}")
async def download_leads(job_id: str):
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    job = jobs_db[job_id]
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail=f"Job not completed. Status: {job.status}")
    
    whatsapp_file = os.path.join(job.output_dir, "whatsapp_ready_leads.csv")
    if not os.path.exists(whatsapp_file):
        raise HTTPException(status_code=404, detail="WhatsApp leads file not found")
    
    return FileResponse(
        path=whatsapp_file,
        filename=f"whatsapp_leads_{job_id}.csv",
        media_type="text/csv"
    )

@app.get("/pipeline/jobs", response_model=JobListResponse)
async def list_jobs(status: Optional[JobStatus] = None, limit: int = 50):
    jobs = list(jobs_db.values())
    if status:
        jobs = [j for j in jobs if j.status == status]
    jobs.sort(key=lambda x: x.started_at, reverse=True)
    return JobListResponse(total_jobs=len(jobs), jobs=jobs[:limit])

@app.delete("/pipeline/cancel/{job_id}")
async def cancel_job(job_id: str):
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    job = jobs_db[job_id]
    if job.status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel job in state: {job.status}")
    job.status = JobStatus.CANCELLED
    job.completed_at = datetime.now()
    job.error_message = "Cancelled by user"
    return {"job_id": job_id, "status": "cancelled"}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "scraper_exists": os.path.exists(SCRAPER_SCRIPT),
        "preparer_exists": os.path.exists(PREPARER_SCRIPT),
        "active_jobs": len([j for j in jobs_db.values() if j.status in (JobStatus.RUNNING, JobStatus.SCRAPING, JobStatus.PREPARING)])
    }