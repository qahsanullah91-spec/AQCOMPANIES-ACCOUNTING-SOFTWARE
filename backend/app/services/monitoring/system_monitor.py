import os
import shutil
import zipfile
import json
import time
import tempfile
import hashlib
import platform
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
import sqlalchemy as sa
from sqlalchemy import text

from app.core.config import settings, BASE_DIR
from app import models
from app.core.logging import get_system_errors, get_unresolved_error_count
from app.services.backup.backup_service import BackupService, count_database_records

_process_start_time = time.time()


class SystemMonitor:
    """
    Observability, Storage, System Health & Disaster Recovery Coordinator for AQ COMPANIES.
    Implements:
    - Section 36-39: Storage, disk space & database size monitoring
    - Section 42: Server resource monitoring (CPU, memory, disk, uptime)
    - Section 61: Document storage and attachment integrity scan
    - Section 76: Safe diagnostics export (no passwords, secrets, or tokens)
    """

    @staticmethod
    def get_server_uptime_seconds() -> float:
        """Returns application process uptime in seconds."""
        return round(time.time() - _process_start_time, 1)

    @classmethod
    def get_system_resources(cls) -> Dict[str, Any]:
        """
        SECTION 42: SERVER RESOURCE MONITOR
        Gathers CPU, Memory, Disk and Process uptime without heavy external dependencies.
        """
        uptime_sec = cls.get_server_uptime_seconds()
        cpu_pct = None
        mem_pct = None
        mem_used_mb = None
        mem_total_mb = None

        try:
            import psutil
            cpu_pct = psutil.cpu_percent(interval=0.1)
            vm = psutil.virtual_memory()
            mem_pct = vm.percent
            mem_used_mb = round(vm.used / (1024 * 1024), 1)
            mem_total_mb = round(vm.total / (1024 * 1024), 1)
        except Exception:
            # Fallback if psutil is not available
            pass

        disk = cls.get_storage_metrics()

        return {
            "uptime_seconds": uptime_sec,
            "uptime_formatted": f"{int(uptime_sec // 3600)}h {int((uptime_sec % 3600) // 60)}m {int(uptime_sec % 60)}s",
            "cpu_percent": cpu_pct,
            "memory": {
                "used_mb": mem_used_mb,
                "total_mb": mem_total_mb,
                "percent_used": mem_pct,
            },
            "disk": {
                "total_gb": disk["total_disk_gb"],
                "free_gb": disk["free_disk_gb"],
                "used_gb": disk["used_disk_gb"],
                "free_percent": disk["free_disk_percent"],
                "status": disk["status"],
            },
            "platform": {
                "system": platform.system(),
                "release": platform.release(),
                "python_version": platform.python_version(),
            },
        }

    @staticmethod
    def get_storage_metrics() -> Dict[str, Any]:
        """
        SECTIONS 38 & 39: DISK SPACE & STORAGE ALLOCATION
        Calculates disk utilization and directory sizes.
        Enforces thresholds:
        - Free < 20%: WARNING
        - Free < 10%: CRITICAL (large imports should be blocked)
        """
        usage = shutil.disk_usage(BASE_DIR)
        total = usage.total
        used = usage.used
        free = usage.free
        free_pct = round((free / total) * 100, 2)

        if free_pct < settings.DISK_CRITICAL_THRESHOLD_PCT:
            status = "CRITICAL"
        elif free_pct < settings.DISK_WARNING_THRESHOLD_PCT:
            status = "WARNING"
        else:
            status = "HEALTHY"

        def get_dir_size(path: str) -> int:
            if not os.path.exists(path):
                return 0
            total_sz = 0
            for root, _, files in os.walk(path):
                for f in files:
                    try:
                        total_sz += os.path.getsize(os.path.join(root, f))
                    except Exception:
                        pass
            return total_sz

        db_path = os.path.join(BASE_DIR, "aq_companies.db")
        db_size = os.path.getsize(db_path) if os.path.exists(db_path) else 0

        return {
            "status": status,
            "free_disk_percent": free_pct,
            "total_disk_gb": round(total / (1024**3), 2),
            "free_disk_gb": round(free / (1024**3), 2),
            "used_disk_gb": round(used / (1024**3), 2),
            "database_file_bytes": db_size,
            "database_file_mb": round(db_size / (1024 * 1024), 2),
            "uploads_dir_bytes": get_dir_size(str(settings.UPLOAD_PATH)),
            "uploads_dir_mb": round(get_dir_size(str(settings.UPLOAD_PATH)) / (1024 * 1024), 2),
            "backups_dir_bytes": get_dir_size(str(settings.BACKUP_PATH)),
            "backups_dir_mb": round(get_dir_size(str(settings.BACKUP_PATH)) / (1024 * 1024), 2),
            "is_import_permitted": (status != "CRITICAL"),
            "warning_threshold_pct": settings.DISK_WARNING_THRESHOLD_PCT,
            "critical_threshold_pct": settings.DISK_CRITICAL_THRESHOLD_PCT,
        }

    @staticmethod
    def check_document_integrity(db: Session) -> Dict[str, Any]:
        """
        SECTION 61: DOCUMENT STORAGE INTEGRITY
        Verifies document files in storage against Document table in database.
        Detects missing files and orphaned storage files without deleting silently.
        """
        docs = db.query(models.Document).all()
        db_paths = set()
        missing_files = []

        for d in docs:
            p = d.file_path
            if not os.path.isabs(p):
                p = os.path.join(BASE_DIR, p)
            db_paths.add(os.path.abspath(p))

            if not os.path.exists(p):
                missing_files.append({
                    "document_id": d.id,
                    "title": d.title,
                    "expected_path": d.file_path,
                })

        orphan_files = []
        upload_dir = str(settings.UPLOAD_PATH)
        if os.path.exists(upload_dir):
            for root, _, files in os.walk(upload_dir):
                for f in files:
                    full_p = os.path.abspath(os.path.join(root, f))
                    if full_p not in db_paths:
                        orphan_files.append(os.path.relpath(full_p, BASE_DIR))

        return {
            "status": "HEALTHY" if not missing_files and not orphan_files else "ANOMALY_DETECTED",
            "total_documents_in_db": len(docs),
            "missing_files_count": len(missing_files),
            "orphan_files_count": len(orphan_files),
            "missing_files": missing_files[:20],
            "orphan_files": orphan_files[:20],
        }

    @classmethod
    def test_automated_restore(cls, zip_path: Optional[str] = None) -> Dict[str, Any]:
        """
        SECTION 16 & 68: AUTOMATED DISASTER RECOVERY RESTORE TEST
        Measures exact RTO and verifies GL balance without touching production database.
        """
        if not zip_path:
            backups_dir = str(settings.BACKUP_PATH)
            if not os.path.exists(backups_dir):
                raise RuntimeError(f"Backups directory '{backups_dir}' not found.")
            zips = [os.path.join(backups_dir, f) for f in os.listdir(backups_dir) if f.endswith(".zip")]
            if not zips:
                raise RuntimeError("No backup archives available for restore testing.")
            zips.sort(key=os.path.getmtime, reverse=True)
            zip_path = zips[0]

        start_time = time.perf_counter()
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            result = BackupService.dry_run_restore(zip_path, db)
            rto_sec = round(time.perf_counter() - start_time, 2)
            result["measured_rto_seconds"] = rto_sec
            return result
        finally:
            db.close()

    @classmethod
    def get_diagnostics_package(cls, db: Session) -> Dict[str, Any]:
        """
        SECTION 76: SYSTEM DIAGNOSTICS EXPORT
        Safe diagnostics package containing:
        - Application Version
        - Schema Version
        - Recent non-sensitive logs / errors
        - Health Results
        - Backup Status
        Excludes passwords, secrets, tokens, or private authentication keys.
        """
        from app.services.accounting.integrity_service import AccountingIntegrityService
        resources = cls.get_system_resources()
        storage = cls.get_storage_metrics()
        last_backup = BackupService.get_last_backup_status(db)
        audit_integrity = AccountingIntegrityService.run_full_accounting_integrity_audit(db)
        recent_errors = get_system_errors(limit=25)

        return {
            "application": {
                "name": settings.PROJECT_NAME,
                "version": settings.VERSION,
                "api_version": settings.API_VERSION,
                "environment": settings.ENVIRONMENT,
                "build_date": settings.BUILD_DATE,
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "uptime_seconds": resources["uptime_seconds"],
            "uptime_formatted": resources["uptime_formatted"],
            "resources": resources,
            "storage": storage,
            "last_backup": last_backup,
            "accounting_integrity_summary": {
                "status": audit_integrity["overall_status"],
                "journal_balanced": audit_integrity["checks"]["journal_balance"]["is_balanced"],
                "gl_difference": audit_integrity["checks"]["journal_balance"]["difference"],
                "baselines_pass": audit_integrity["checks"]["golden_baselines"]["baselines_reconciled"],
            },
            "recent_system_errors": recent_errors,
        }
