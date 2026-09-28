from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Header, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.maintenance import is_maintenance_mode, get_maintenance_info, set_maintenance_mode
from app.core.config import settings
from app.core.logging import get_system_errors, resolve_system_error, get_unresolved_error_count
from app.services.monitoring.system_monitor import SystemMonitor
from app.services.backup.backup_service import BackupService
from app.services.accounting.integrity_service import AccountingIntegrityService

router = APIRouter(prefix="/system", tags=["System & DevOps Management"])


class MaintenanceToggleRequest(BaseModel):
    enabled: bool
    reason: Optional[str] = "Deployment migration in progress"


@router.get("/maintenance")
def get_maintenance_status():
    """Returns current deployment maintenance mode lock status."""
    return get_maintenance_info()


@router.post("/maintenance/enable")
def enable_maintenance(
    payload: Optional[MaintenanceToggleRequest] = None,
    x_bypass_token: Optional[str] = Header(None, alias="X-Maintenance-Bypass"),
    x_user_role: Optional[str] = Header("ADMIN", alias="X-User-Role"),
):
    """Enables maintenance mode, blocking all financial mutations."""
    if x_bypass_token != settings.MAINTENANCE_BYPASS_TOKEN and (x_user_role or "").upper() not in ("ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=403, detail="Unauthorized: Maintenance lock requires ADMIN role or bypass key.")
    
    reason = payload.reason if payload and payload.reason else "Deployment migration in progress"
    info = set_maintenance_mode(enabled=True, reason=reason, updated_by="DevOpsAdmin", wait_for_active_writes=True)
    return {"message": "Maintenance mode successfully ENABLED. Financial mutations are locked.", "state": info}


@router.post("/maintenance/disable")
def disable_maintenance(
    x_bypass_token: Optional[str] = Header(None, alias="X-Maintenance-Bypass"),
    x_user_role: Optional[str] = Header("ADMIN", alias="X-User-Role"),
):
    """Disables maintenance mode, restoring normal operations."""
    if x_bypass_token != settings.MAINTENANCE_BYPASS_TOKEN and (x_user_role or "").upper() not in ("ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=403, detail="Unauthorized: Maintenance unlock requires ADMIN role or bypass key.")

    info = set_maintenance_mode(enabled=False, reason="Normal operations resumed", updated_by="DevOpsAdmin")
    return {"message": "Maintenance mode successfully DISABLED. Normal operations active.", "state": info}


@router.get("/health-summary")
@router.get("/health")
def system_health_summary(db: Session = Depends(get_db)):
    """
    SECTIONS 36, 37, 57, 58 & 65: SYSTEM HEALTH STATUS
    Returns comprehensive health for Desktop & iPhone Admin view:
    - Frontend: ONLINE
    - Backend: ONLINE
    - Database: CONNECTED
    - Accounting Engine: HEALTHY
    - Storage: AVAILABLE
    - Backup: VERIFIED
    - Unresolved Errors: Count
    """
    storage = SystemMonitor.get_storage_metrics()
    resources = SystemMonitor.get_system_resources()
    last_bak = BackupService.get_last_backup_status(db)
    accounting = AccountingIntegrityService.check_journal_balance(db)
    unresolved_errs = get_unresolved_error_count()

    is_healthy = (
        accounting["is_balanced"] and
        storage["status"] != "CRITICAL" and
        last_bak.get("status") in ("VERIFIED", "NO_BACKUP_EXISTS")
    )

    return {
        "status": "HEALTHY" if is_healthy else "WARNING",
        "frontend": "ONLINE",
        "backend": "ONLINE",
        "database": {
            "status": "CONNECTED",
            "engine": "SQLite WAL Mode",
            "size_mb": storage["database_file_mb"],
        },
        "accounting_engine": {
            "status": "HEALTHY" if accounting["is_balanced"] else "DISCREPANCY",
            "gl_balanced": accounting["is_balanced"],
            "gl_difference": accounting["difference"],
        },
        "storage": {
            "status": "AVAILABLE" if storage["status"] != "CRITICAL" else "CRITICAL",
            "free_percent": storage["free_disk_percent"],
            "free_gb": storage["free_disk_gb"],
            "total_gb": storage["total_disk_gb"],
            "uploads_mb": storage["uploads_dir_mb"],
            "backups_mb": storage["backups_dir_mb"],
        },
        "backup": {
            "status": last_bak["status"],
            "verified": last_bak["verified"],
            "last_backup_time": last_bak["last_backup_time"],
            "hours_ago": last_bak["hours_since_last_backup"],
            "attention_required": last_bak["attention_required"],
            "alert_message": last_bak["alert_message"],
        },
        "unresolved_errors": unresolved_errs,
        "resources": {
            "uptime": resources["uptime_formatted"],
            "cpu_percent": resources["cpu_percent"],
            "memory_percent": resources["memory"]["percent_used"],
        },
        "version": settings.VERSION,
    }


@router.get("/resources")
def system_resources():
    """SECTION 42: Server CPU, Memory, Disk, and Process Uptime."""
    return SystemMonitor.get_system_resources()


@router.get("/diagnostics")
def system_diagnostics(db: Session = Depends(get_db)):
    """SECTION 76: Safe System Diagnostics Export (no secrets, passwords or tokens)."""
    return SystemMonitor.get_diagnostics_package(db)


@router.get("/errors")
def list_system_errors(limit: int = 50, unresolved_only: bool = False):
    """SECTION 35: System Error Viewer for Admin."""
    return {
        "errors": get_system_errors(limit=limit, unresolved_only=unresolved_only),
        "unresolved_count": get_unresolved_error_count(),
    }


@router.post("/errors/resolve/{error_id}")
def mark_error_resolved(error_id: str):
    """Marks a system error as resolved."""
    ok = resolve_system_error(error_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Error ID not found.")
    return {"success": True, "error_id": error_id, "resolved": True}


@router.get("/documents/integrity")
def check_documents_integrity(db: Session = Depends(get_db)):
    """SECTION 61: Document Storage Integrity Scan."""
    return SystemMonitor.check_document_integrity(db)
