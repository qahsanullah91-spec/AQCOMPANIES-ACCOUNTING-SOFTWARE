from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.jobs.job_service import JobService

router = APIRouter(prefix="/jobs", tags=["Background Tasks & Workers"])


@router.get("", response_model=List[Dict[str, Any]])
def list_background_jobs(
    job_type: Optional[str] = Query(None, description="Filter by job type"),
    status: Optional[str] = Query(None, description="Filter by status (QUEUED, RUNNING, SUCCESS, FAILED, CANCELLED)"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Lists asynchronous background tasks and execution status."""
    return JobService.list_jobs(db, job_type=job_type, status=status, limit=limit)


@router.get("/{job_id}")
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    """Retrieves real-time status, progress, and result payload of a background job."""
    job = JobService.get_job(db, job_id=job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Background job '{job_id}' not found.")
    return job


@router.post("/{job_id}/cancel")
def cancel_background_job(job_id: str, db: Session = Depends(get_db)):
    """Cancels a pending or running background job."""
    cancelled = JobService.cancel_job(db, job_id=job_id)
    if not cancelled:
        raise HTTPException(
            status_code=400,
            detail=f"Background job '{job_id}' could not be cancelled (it may be completed, failed, or non-existent).",
        )
    return {"message": f"Background job '{job_id}' successfully cancelled.", "job_id": job_id}
