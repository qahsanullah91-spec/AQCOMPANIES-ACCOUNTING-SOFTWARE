import uuid
import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Callable
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session

from app import models
from app.core.database import SessionLocal
from app.core.exceptions import ValidationError

executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="aq_bg_worker")


class JobService:
    """
    Background Task Coordinator for AQ COMPANIES.
    Executes heavy read, validation, snapshot, and backup operations without blocking API responses.
    """

    @staticmethod
    def create_job(
        db: Session,
        job_type: str,
        created_by: str = "System",
    ) -> models.BackgroundJob:
        job_id = f"JOB-{uuid.uuid4().hex[:12].upper()}"
        job = models.BackgroundJob(
            job_id=job_id,
            job_type=job_type,
            status="QUEUED",
            progress=0,
            created_by=created_by,
            created_at=datetime.now(timezone.utc),
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    @staticmethod
    def update_job(
        db: Session,
        job_id: str,
        status: str,
        progress: int = 0,
        error: Optional[str] = None,
        result: Optional[Dict[str, Any]] = None,
    ) -> Optional[models.BackgroundJob]:
        job = db.query(models.BackgroundJob).filter(models.BackgroundJob.job_id == job_id).first()
        if not job:
            return None
        job.status = status
        job.progress = progress
        now_dt = datetime.now(timezone.utc)
        if status == "RUNNING" and not job.started_at:
            job.started_at = now_dt
        elif status in ("SUCCESS", "FAILED", "CANCELLED"):
            job.completed_at = now_dt

        if error:
            job.error = error
        if result:
            job.result_json = json.dumps(result, default=str)

        db.commit()
        db.refresh(job)
        return job

    @staticmethod
    def get_job(db: Session, job_id: str) -> Optional[Dict[str, Any]]:
        job = db.query(models.BackgroundJob).filter(models.BackgroundJob.job_id == job_id).first()
        if not job:
            return None
        return {
            "job_id": job.job_id,
            "job_type": job.job_type,
            "status": job.status,
            "progress": job.progress,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "error": job.error,
            "created_by": job.created_by,
            "result": json.loads(job.result_json) if job.result_json else None,
            "created_at": job.created_at.isoformat(),
        }

    @staticmethod
    def list_jobs(
        db: Session,
        job_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        query = db.query(models.BackgroundJob)
        if job_type:
            query = query.filter(models.BackgroundJob.job_type == job_type)
        if status:
            query = query.filter(models.BackgroundJob.status == status)
        jobs = query.order_by(models.BackgroundJob.created_at.desc()).limit(limit).all()
        return [
            {
                "job_id": j.job_id,
                "job_type": j.job_type,
                "status": j.status,
                "progress": j.progress,
                "started_at": j.started_at.isoformat() if j.started_at else None,
                "completed_at": j.completed_at.isoformat() if j.completed_at else None,
                "error": j.error,
                "created_by": j.created_by,
                "result": json.loads(j.result_json) if j.result_json else None,
                "created_at": j.created_at.isoformat(),
            }
            for j in jobs
        ]

    @classmethod
    def cancel_job(cls, db: Session, job_id: str) -> bool:
        job = db.query(models.BackgroundJob).filter(models.BackgroundJob.job_id == job_id).first()
        if not job:
            return False
        if job.status in ("SUCCESS", "FAILED", "CANCELLED"):
            return False
        job.status = "CANCELLED"
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        return True

    @classmethod
    def dispatch(
        cls,
        job_type: str,
        task_func: Callable[[Session, str, Any], Dict[str, Any]],
        created_by: str = "System",
        *args: Any,
        **kwargs: Any,
    ) -> str:
        """
        Dispatches background job to thread pool. Returns job_id immediately.
        """
        db = SessionLocal()
        try:
            job = cls.create_job(db, job_type=job_type, created_by=created_by)
            job_id = job.job_id
        finally:
            db.close()

        def _worker():
            worker_db = SessionLocal()
            try:
                cls.update_job(worker_db, job_id, status="RUNNING", progress=10)
                result = task_func(worker_db, job_id, *args, **kwargs)
                cls.update_job(worker_db, job_id, status="SUCCESS", progress=100, result=result)
            except Exception as exc:
                cls.update_job(worker_db, job_id, status="FAILED", progress=100, error=str(exc))
            finally:
                worker_db.close()

        executor.submit(_worker)
        return job_id

