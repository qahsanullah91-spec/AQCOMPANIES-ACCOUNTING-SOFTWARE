import os
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, Query, HTTPException, Body
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.backup.backup_service import BackupService
from app.core.config import settings

router = APIRouter(prefix="/backup", tags=["Enterprise Backup & Recovery"])


@router.get("/status")
def backup_status(db: Session = Depends(get_db)):
    """
    SECTIONS 9 & 10: LAST BACKUP STATUS & ALERT
    Returns last backup time, size, status, destination, verified status,
    and whether attention is required.
    """
    return BackupService.get_last_backup_status(db)


@router.post("/now")
@router.post("/create")
def trigger_backup(
    backup_type: str = Query("MANUAL"),
    notes: Optional[str] = Query(None),
    user_name: str = Query("Admin"),
    db: Session = Depends(get_db),
):
    """
    SECTION 11: MANUAL BACKUP
    Creates enterprise timestamped ZIP:
    AQ-COMPANIES-BACKUP-YYYY-MM-DD-HHMMSS.zip using SQLite online backup API.
    """
    return BackupService.create_backup(db, backup_type=backup_type, user_name=user_name, notes=notes)


@router.get("/list")
def list_backups(db: Session = Depends(get_db)):
    """Lists all available backups with sizes and SHA256 verification status."""
    return BackupService.list_backups(db)


@router.get("/preview/{filename}")
def preview_backup(filename: str):
    """Inspects backup ZIP manifest and record counts before restoring."""
    safe_name = os.path.basename(filename)
    full_path = os.path.join(settings.BACKUP_PATH, safe_name)
    return BackupService.preview_backup(full_path)


@router.get("/verify/{filename}")
def verify_backup(filename: str):
    """SECTION 8: Explicit verification of backup ZIP, SQLite integrity and checksum."""
    safe_name = os.path.basename(filename)
    full_path = os.path.join(settings.BACKUP_PATH, safe_name)
    return BackupService.verify_backup_archive(full_path)


@router.post("/dry-run")
@router.get("/dry-run/{filename}")
def dry_run_backup_restore(
    filename: Optional[str] = None,
    backup_filename: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    SECTION 15: RESTORE DRY RUN
    Validates backup archive in isolated sandbox without replacing production data.
    Returns: VALID, INVALID, or REQUIRES_MIGRATION with trial balance report.
    """
    target = filename or backup_filename
    if not target:
        raise HTTPException(status_code=400, detail="Missing backup filename parameter.")
    safe_name = os.path.basename(target)
    full_path = os.path.join(settings.BACKUP_PATH, safe_name)
    return BackupService.dry_run_restore(full_path, db)


@router.post("/restore-enterprise")
def restore_backup(
    filename: Optional[str] = Query(None),
    user_name: str = Query("Admin"),
    payload: Optional[Dict[str, Any]] = Body(None),
    db: Session = Depends(get_db),
):
    """
    SECTIONS 13 & 14: ENTERPRISE SAFE RESTORE
    Restores database from verified backup with automated pre-restore rollback protection
    and maintenance mode transaction locks.
    """
    target_file = filename
    if not target_file and payload and "filename" in payload:
        target_file = payload["filename"]
    if not target_file:
        raise HTTPException(status_code=400, detail="Missing required backup filename.")

    safe_name = os.path.basename(target_file)
    full_path = os.path.join(settings.BACKUP_PATH, safe_name)
    return BackupService.restore_backup(db, full_path, user_name=user_name)
