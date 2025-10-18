"""
api_lead_pipeline.py

🎯 B2B LEAD PIPELINE REST API — Colombo → WhatsApp
✅ Async execution with status tracking
✅ Job queue management
✅ Real-time progress monitoring
✅ Download ready leads via endpoint

Install dependencies:
    pip install fastapi uvicorn python-multipart

Run the API:
    uvicorn api_lead_pipeline:app --reload --host 0.0.0.0 --port 8000

Endpoints:
    POST   /pipeline/start          - Start new pipeline job
    GET    /pipeline/status/{job_id} - Check job status
    GET    /pipeline/logs/{job_id}   - Get job logs
    GET    /pipeline/download/{job_id} - Download WhatsApp-ready leads
    GET    /pipeline/jobs           - List all jobs
    DELETE /pipeline/cancel/{job_id} - Cancel running job
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
import logging

# ==============================
# 🔧 CONFIGURATION
# ==============================
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCRAPER_SCRIPT = os.path.join(SCRIPT_DIR, "lean_business_scraper.py")
PREPARER_SCRIPT = os.path.join(SCRIPT_DIR, "whatsapp_lead_preparer.py")
LEADS_FILE = "b2b_leads.csv"
WHATSAPP_FILE = "whatsapp_ready_leads.csv"
LOGS_DIR = "pipeline_logs"

os.makedirs(LOGS_DIR, exist_ok=True)

# Setup logging
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
async def run_script_async(script_name: str, job_id: str, log_file: str) -> tuple[bool, str]:
    """Run a Python script asynchronously with logging."""
    logger.info(f"[{job_id}] ▶️ Launching: {script_name}")
    
    try:
        process = await asyncio.create_subprocess_exec(
            sys.executable, script_name,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=os.getcwd()
        )
        
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=600)
        
        # Log output
        with open(log_file, "a", encoding="utf-8") as f:
            if stdout:
                f.write(f"\n=== STDOUT ===\n{stdout.decode()}\n")
            if stderr:
                f.write(f"\n=== STDERR ===\n{stderr.decode()}\n")
        
        if process.returncode != 0:
            error_msg = stderr.decode() if stderr else "Unknown error"
            logger.error(f"[{job_id}] ❌ {script_name} failed: {error_msg}")
            return False, error_msg
        
        logger.info(f"[{job_id}] ✅ {script_name} completed")
        return True, ""
        
    except asyncio.TimeoutError:
        return False, "Script execution timed out (10 minutes)"
    except Exception as e:
        logger.exception(f"[{job_id}] 💥 Failed to execute {script_name}")
        return False, str(e)

async def execute_pipeline(job_id: str):
    """Execute the full pipeline: scraper → preparer."""
    job = jobs_db[job_id]
    log_file = job.log_file
    
    try:
        # Write header to log
        with open(log_file, "w", encoding="utf-8") as f:
            f.write(f"{'=' * 60}\n")
            f.write(f"🚀 B2B LEAD PIPELINE JOB: {job_id}\n")
            f.write(f"Started: {job.started_at}\n")
            f.write(f"{'=' * 60}\n\n")
        
        # === PHASE 1: Scraping ===
        job.status = JobStatus.SCRAPING
        job.current_phase = "Scraping B2B leads from sources"
        
        success, error = await run_script_async(SCRAPER_SCRIPT, job_id, log_file)
        if not success:
            job.status = JobStatus.FAILED
            job.error_message = f"Scraper failed: {error}"
            job.completed_at = datetime.now()
            return
        
        # Count scraped leads
        if os.path.exists(LEADS_FILE):
            with open(LEADS_FILE, "r", encoding="utf-8") as f:
                job.leads_scraped = max(0, sum(1 for _ in f) - 1)
        
        # === PHASE 2: Preparing ===
        job.status = JobStatus.PREPARING
        job.current_phase = "Preparing leads for WhatsApp"
        
        success, error = await run_script_async(PREPARER_SCRIPT, job_id, log_file)
        if not success:
            job.status = JobStatus.FAILED
            job.error_message = f"Preparer failed: {error}"
            job.completed_at = datetime.now()
            return
        
        # Count prepared leads
        if os.path.exists(WHATSAPP_FILE):
            with open(WHATSAPP_FILE, "r", encoding="utf-8") as f:
                job.leads_prepared = max(0, sum(1 for _ in f) - 1)
        
        # === SUCCESS ===
        job.status = JobStatus.COMPLETED
        job.current_phase = "Pipeline completed successfully"
        job.completed_at = datetime.now()
        
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(f"\n{'=' * 60}\n")
            f.write(f"🎉 PIPELINE SUCCESS!\n")
            f.write(f"Leads scraped: {job.leads_scraped}\n")
            f.write(f"Leads prepared: {job.leads_prepared}\n")
            f.write(f"Completed: {job.completed_at}\n")
            f.write(f"{'=' * 60}\n")
        
        logger.info(f"[{job_id}] 🎉 Pipeline completed successfully")
        
    except Exception as e:
        job.status = JobStatus.FAILED
        job.error_message = f"Unexpected error: {str(e)}"
        job.completed_at = datetime.now()
        logger.exception(f"[{job_id}] 💥 Pipeline failed")

# ==============================
# 🌐 API SETUP
# ==============================
app = FastAPI(
    title="B2B Lead Pipeline API",
    description="Automated B2B lead generation pipeline for Colombo → WhatsApp",
    version="1.0.0"
)

# ==============================
# 📍 ENDPOINTS
# ==============================
@app.get("/")
async def root():
    """API health check and info."""
    return {
        "service": "B2B Lead Pipeline API",
        "status": "operational",
        "endpoints": {
            "start_pipeline": "POST /pipeline/start",
            "check_status": "GET /pipeline/status/{job_id}",
            "view_logs": "GET /pipeline/logs/{job_id}",
            "download_leads": "GET /pipeline/download/{job_id}",
            "list_jobs": "GET /pipeline/jobs",
            "cancel_job": "DELETE /pipeline/cancel/{job_id}"
        }
    }

@app.post("/pipeline/start", response_model=JobResponse)
async def start_pipeline(background_tasks: BackgroundTasks):
    """Start a new lead pipeline job."""
    job_id = str(uuid.uuid4())[:8]
    log_file = os.path.join(LOGS_DIR, f"job_{job_id}.log")
    
    job = PipelineJob(
        job_id=job_id,
        status=JobStatus.PENDING,
        started_at=datetime.now(),
        log_file=log_file
    )
    
    jobs_db[job_id] = job
    background_tasks.add_task(execute_pipeline, job_id)
    
    logger.info(f"[{job_id}] 🚀 New pipeline job started")
    
    return JobResponse(
        job_id=job_id,
        status=JobStatus.PENDING,
        message=f"Pipeline job started. Track progress at /pipeline/status/{job_id}"
    )

@app.get("/pipeline/status/{job_id}", response_model=PipelineJob)
async def get_job_status(job_id: str):
    """Get the status of a pipeline job."""
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return jobs_db[job_id]

@app.get("/pipeline/logs/{job_id}")
async def get_job_logs(job_id: str):
    """Retrieve logs for a specific job."""
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = jobs_db[job_id]
    
    if not os.path.exists(job.log_file):
        raise HTTPException(status_code=404, detail="Log file not found")
    
    with open(job.log_file, "r", encoding="utf-8") as f:
        logs = f.read()
    
    return {"job_id": job_id, "logs": logs}

@app.get("/pipeline/download/{job_id}")
async def download_leads(job_id: str):
    """Download the WhatsApp-ready leads CSV."""
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = jobs_db[job_id]
    
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400, 
            detail=f"Job not completed yet. Current status: {job.status}"
        )
    
    if not os.path.exists(WHATSAPP_FILE):
        raise HTTPException(status_code=404, detail="WhatsApp leads file not found")
    
    return FileResponse(
        path=WHATSAPP_FILE,
        filename=f"whatsapp_leads_{job_id}.csv",
        media_type="text/csv"
    )

@app.get("/pipeline/jobs", response_model=JobListResponse)
async def list_jobs(status: Optional[JobStatus] = None, limit: int = 50):
    """List all pipeline jobs with optional status filter."""
    filtered_jobs = list(jobs_db.values())
    
    if status:
        filtered_jobs = [j for j in filtered_jobs if j.status == status]
    
    # Sort by started_at descending
    filtered_jobs.sort(key=lambda x: x.started_at, reverse=True)
    
    return JobListResponse(
        total_jobs=len(filtered_jobs),
        jobs=filtered_jobs[:limit]
    )

@app.delete("/pipeline/cancel/{job_id}")
async def cancel_job(job_id: str):
    """Cancel a running job (mark as cancelled, actual termination not implemented)."""
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = jobs_db[job_id]
    
    if job.status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot cancel job with status: {job.status}"
        )
    
    job.status = JobStatus.CANCELLED
    job.completed_at = datetime.now()
    job.error_message = "Job cancelled by user"
    
    logger.info(f"[{job_id}] 🛑 Job cancelled")
    
    return {"job_id": job_id, "status": "cancelled"}

# ==============================
# 🏥 HEALTH CHECK
# ==============================
@app.get("/health")
async def health_check():
    """Check if required scripts exist."""
    return {
        "status": "healthy",
        "scraper_exists": os.path.exists(SCRAPER_SCRIPT),
        "preparer_exists": os.path.exists(PREPARER_SCRIPT),
        "active_jobs": len([j for j in jobs_db.values() if j.status == JobStatus.RUNNING])
    }

# ==============================
# ▶️ RUN SERVER
# ==============================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)