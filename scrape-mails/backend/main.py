# backend/main.py
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import io
import csv
import uuid
from typing import Dict, Any
from scraper import process_row, ORIGINAL_COLUMNS, OUTPUT_COLUMNS

app = FastAPI()

# In-memory job storage — replace with Redis in production
jobs: Dict[str, Dict[str, Any]] = {}

class CSVUpload(BaseModel):
    csv_content: str

@app.post("/api/scrape")
async def scrape_emails(payload: CSVUpload):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "processing", "current": 0, "total": 0, "results": []}
    
    try:
        # Parse CSV
        f = io.StringIO(payload.csv_content)
        reader = csv.DictReader(f)
        rows = list(reader)

        # Validate columns
        missing = [col for col in ORIGINAL_COLUMNS if col not in reader.fieldnames]
        if missing:
            jobs[job_id] = {"status": "failed", "error": f"Missing columns: {missing}"}
            return JSONResponse({"job_id": job_id})

        total = len(rows)
        jobs[job_id]["total"] = total
        results = []

        # Process row-by-row and update progress
        for i, row in enumerate(rows):
            try:
                result = process_row(row.copy())
                results.append(result)
            except Exception as e:
                row['email'] = ""
                results.append(row)
            
            # Update progress
            jobs[job_id]["current"] = i + 1
            jobs[job_id]["results"] = results  # store partial results

        # Finalize
        output_buffer = io.StringIO()
        writer = csv.DictWriter(output_buffer, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(results)

        with_email = sum(1 for r in results if r.get('email', '').strip())
        jobs[job_id] = {
            "status": "completed",
            "csv": output_buffer.getvalue(),
            "total": total,
            "with_email": with_email
        }

    except Exception as e:
        jobs[job_id] = {"status": "failed", "error": str(e)}

    return JSONResponse({"job_id": job_id})

@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job