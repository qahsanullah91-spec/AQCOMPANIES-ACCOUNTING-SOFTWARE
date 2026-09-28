"""
AQ COMPANIES — Security, Approvals, Reversals, Integrity & Backup Router
Provides APIs for permissions, approvals, reversals, health checks, tasks, notifications, and backups.
"""
import os
import json
from datetime import datetime, date as dt_date
from decimal import Decimal
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Body, status, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db, BASE_DIR
from app import models, schemas
from app.security_automation import (
    SYSTEM_ROLES,
    ROLE_PERMISSIONS_MAP,
    get_user_effective_permissions,
    check_user_permission,
    get_approval_thresholds,
    set_system_config,
    is_four_eyes_enforced,
    evaluate_transaction_approval_need,
    submit_approval_request,
    approve_transaction_request,
    reject_transaction_request,
    execute_reversal_workflow,
    execute_correction_workflow,
    log_audit_event,
    get_transaction_versions,
    run_accounting_health_check,
    run_daily_accounting_job,
    create_enterprise_backup,
    preview_backup_archive,
    restore_enterprise_backup,
    test_restore_in_temporary_database,
    generate_full_system_json_export,
    get_system_health_metrics,
    BACKUPS_DIR,
)

router = APIRouter(tags=["Security, Approvals, Backup & Integrity"])


# ---------------------------------------------------------------------
# 1. ROLES & PERMISSIONS
# ---------------------------------------------------------------------

@router.get("/api/security/roles")
def get_roles_and_permissions():
    """Returns available roles and the standard permission matrix."""
    return {
        "roles": SYSTEM_ROLES,
        "permissions_map": ROLE_PERMISSIONS_MAP,
    }


@router.get("/api/security/users")
def get_security_users(db: Session = Depends(get_db)):
    """Lists users with their roles and effective permissions."""
    users = db.query(models.User).order_by(models.User.id).all()
    results = []
    for u in users:
        results.append({
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "effective_permissions": get_user_effective_permissions(u),
            "created_at": u.created_at.isoformat() if u.created_at else None,
        })
    return results


@router.put("/api/security/users/{user_id}/role")
def update_user_role(
    user_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """Updates user role and optional custom permissions."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_role = payload.get("role", "").upper()
    if new_role not in SYSTEM_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {SYSTEM_ROLES}")

    old_role = user.role
    user.role = new_role
    if "permissions" in payload:
        user.permissions_json = json.dumps(payload["permissions"])

    log_audit_event(
        db,
        entity_type="User",
        entity_id=user.id,
        action="EDIT",
        old_val=old_role,
        new_val=new_role,
        user_name=payload.get("updated_by", "Admin"),
        reason=payload.get("reason", "Role updated"),
    )
    db.commit()
    return {"success": True, "user_id": user.id, "role": user.role}


# ---------------------------------------------------------------------
# 2. APPROVAL WORKFLOW & FOUR-EYES CONTROL
# ---------------------------------------------------------------------

class ApprovalDecisionPayload(BaseModel):
    user_name: str
    user_role: str = "ADMIN"
    reason: Optional[str] = None
    notes: Optional[str] = None


@router.get("/api/accounting/approvals")
def get_approval_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
):
    """Lists approval requests (pending, approved, rejected)."""
    q = db.query(models.ApprovalRequest)
    if status_filter:
        q = q.filter(models.ApprovalRequest.status == status_filter.upper())
    requests = q.order_by(desc(models.ApprovalRequest.id)).all()

    return [
        {
            "id": r.id,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "reference": r.reference,
            "amount": float(r.amount),
            "currency": r.currency,
            "party_name": r.party_name,
            "account_name": r.account_name,
            "supporting_document": r.supporting_document,
            "requested_by": r.requested_by,
            "status": r.status,
            "required_role": r.required_role,
            "threshold_rule": r.threshold_rule,
            "approved_by": r.approved_by,
            "approved_at": r.approved_at.isoformat() if r.approved_at else None,
            "rejection_reason": r.rejection_reason,
            "notes": r.notes,
            "created_at": r.created_at.isoformat(),
        }
        for r in requests
    ]


@router.post("/api/accounting/approvals/{approval_id}/approve")
def approve_request(
    approval_id: int,
    payload: ApprovalDecisionPayload,
    db: Session = Depends(get_db),
):
    """Approves request with Four-Eyes and threshold role validation."""
    user = db.query(models.User).filter(models.User.username == payload.user_name).first()
    if not user:
        user = models.User(username=payload.user_name, role=payload.user_role)

    return approve_transaction_request(db, approval_id, user, notes=payload.notes or payload.reason)


@router.post("/api/accounting/approvals/{approval_id}/reject")
def reject_request(
    approval_id: int,
    payload: ApprovalDecisionPayload,
    db: Session = Depends(get_db),
):
    """Rejects request with mandatory reason."""
    if not payload.reason:
        raise HTTPException(status_code=400, detail="Rejection reason is mandatory")
    user = db.query(models.User).filter(models.User.username == payload.user_name).first()
    if not user:
        user = models.User(username=payload.user_name, role=payload.user_role)

    return reject_transaction_request(db, approval_id, user, reason=payload.reason)


@router.get("/api/accounting/approvals/thresholds")
def get_threshold_settings(db: Session = Depends(get_db)):
    """Returns configured approval thresholds and four-eyes policy."""
    t1, t2 = get_approval_thresholds(db)
    four_eyes = is_four_eyes_enforced(db)
    return {
        "threshold_tier_1": float(t1),
        "threshold_tier_2": float(t2),
        "enforce_four_eyes": four_eyes,
    }


@router.put("/api/accounting/approvals/thresholds")
def update_threshold_settings(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """Updates approval thresholds and four-eyes enforcement."""
    if "threshold_tier_1" in payload:
        set_system_config(db, "threshold_tier_1", str(payload["threshold_tier_1"]), "Tier 1 Limit")
    if "threshold_tier_2" in payload:
        set_system_config(db, "threshold_tier_2", str(payload["threshold_tier_2"]), "Tier 2 Limit")
    if "enforce_four_eyes" in payload:
        set_system_config(db, "enforce_four_eyes", "true" if payload["enforce_four_eyes"] else "false", "Four-Eyes Control")
    return {"success": True, "message": "Approval settings updated successfully"}


# ---------------------------------------------------------------------
# 3. REVERSALS & CORRECTIONS WORKFLOW
# ---------------------------------------------------------------------

class ReversalPayload(BaseModel):
    entity_type: str  # "BankTransaction" or "JournalEntry"
    entity_id: int
    reason: str
    user_name: str = "Admin"


@router.post("/api/accounting/reversals")
def post_reversal(
    payload: ReversalPayload,
    db: Session = Depends(get_db),
):
    """Executes standard reversal with balanced opposite flow."""
    if not payload.reason or len(payload.reason.strip()) < 3:
        raise HTTPException(status_code=400, detail="A detailed reversal reason is required")
    return execute_reversal_workflow(
        db,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        reason=payload.reason,
        user_name=payload.user_name,
    )


class CorrectionPayload(BaseModel):
    entity_type: str
    entity_id: int
    reason: str
    corrected_data: Dict[str, Any]
    user_name: str = "Admin"


@router.post("/api/accounting/corrections")
def post_correction(
    payload: CorrectionPayload,
    db: Session = Depends(get_db),
):
    """Executes correction: Step 1: reverse original; Step 2: return status for posting corrected."""
    if not payload.reason:
        raise HTTPException(status_code=400, detail="Correction reason is required")
    return execute_correction_workflow(
        db,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        corrected_data=payload.corrected_data,
        reason=payload.reason,
        user_name=payload.user_name,
    )


# ---------------------------------------------------------------------
# 4. AUDIT LOGS & VERSION HISTORY
# ---------------------------------------------------------------------

@router.get("/api/accounting/audit-logs")
def query_audit_logs(
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    user_name: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Queries immutable audit logs."""
    q = db.query(models.AuditLog)
    if entity_type:
        q = q.filter(models.AuditLog.entity_type == entity_type)
    if action:
        q = q.filter(models.AuditLog.action == action.upper())
    if user_name:
        q = q.filter(models.AuditLog.user_name.ilike(f"%{user_name}%"))

    logs = q.order_by(desc(models.AuditLog.id)).limit(limit).all()
    return [
        {
            "id": l.id,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "action": l.action,
            "old_value": l.old_value_json,
            "new_value": l.new_value_json,
            "user_name": l.user_name,
            "reason": l.reason,
            "ip_address": l.ip_address,
            "timestamp": l.timestamp.isoformat(),
        }
        for l in logs
    ]


@router.get("/api/accounting/transactions/{entity_type}/{entity_id}/versions")
def get_transaction_version_history(
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db),
):
    """Returns version history for transaction."""
    return get_transaction_versions(db, entity_type, entity_id)


# ---------------------------------------------------------------------
# 5. INTEGRITY ENGINE & DAILY ACCOUNTING JOB
# ---------------------------------------------------------------------

@router.get("/api/accounting/health-check")
def accounting_health_check(db: Session = Depends(get_db)):
    """Runs full accounting integrity health check comparing subledgers to GL."""
    return run_accounting_health_check(db)


@router.get("/api/accounting/integrity")
def accounting_integrity_scan(db: Session = Depends(get_db)):
    """SECTIONS 17-20: Full accounting integrity scan."""
    from app.services.accounting.integrity_service import AccountingIntegrityService
    return AccountingIntegrityService.run_full_accounting_integrity_audit(db)


@router.post("/api/accounting/daily-job/run")
def trigger_daily_job(
    user_name: str = "Admin",
    db: Session = Depends(get_db),
):
    """Executes automated daily accounting checks and maintenance."""
    return run_daily_accounting_job(db, user_name=user_name)


# ---------------------------------------------------------------------
# 6. ENTERPRISE BACKUP & DISASTER RECOVERY
# ---------------------------------------------------------------------

@router.get("/api/backup/status")
def backup_status_endpoint(db: Session = Depends(get_db)):
    """SECTIONS 9 & 10: Last backup status and 24h attention required alert."""
    from app.services.backup.backup_service import BackupService
    return BackupService.get_last_backup_status(db)


@router.get("/api/backup/list")
def list_backups_endpoint(db: Session = Depends(get_db)):
    """Lists verified backups with manifest data."""
    logs = db.query(models.BackupLog).order_by(desc(models.BackupLog.created_at)).all()
    results = []
    for l in logs:
        rec_counts = {}
        if l.records_count_json:
            try:
                rec_counts = json.loads(l.records_count_json)
            except Exception:
                pass
        results.append({
            "id": l.id,
            "backup_code": l.backup_code,
            "filename": l.filename,
            "backup_type": l.backup_type,
            "size_bytes": l.size_bytes,
            "checksum_sha256": l.checksum_sha256,
            "status": l.status,
            "record_counts": rec_counts,
            "created_by": l.created_by,
            "created_at": l.created_at.isoformat(),
            "notes": l.notes,
        })
    return results


@router.post("/api/backup/create")
@router.post("/api/backup/now")
def create_backup_endpoint(
    backup_type: str = Query("MANUAL"),
    notes: Optional[str] = Query(None),
    user_name: str = Query("Admin"),
    db: Session = Depends(get_db),
):
    """Creates enterprise timestamped ZIP backup with SHA256 verification."""
    return create_enterprise_backup(db, backup_type=backup_type, user_name=user_name, notes=notes)


@router.get("/api/backup/preview/{filename}")
def preview_backup_endpoint(filename: str):
    """Inspects backup ZIP manifest before restoring."""
    safe_name = os.path.basename(filename)
    full_path = os.path.join(BACKUPS_DIR, safe_name)
    return preview_backup_archive(full_path)


@router.post("/api/backup/dry-run")
@router.get("/api/backup/dry-run/{filename}")
def dry_run_backup_endpoint(
    filename: Optional[str] = None,
    backup_filename: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """SECTION 15: Dry run restore validation without replacing production data."""
    target = filename or backup_filename
    if not target:
        raise HTTPException(status_code=400, detail="Missing backup filename parameter.")
    safe_name = os.path.basename(target)
    full_path = os.path.join(BACKUPS_DIR, safe_name)
    from app.services.backup.backup_service import BackupService
    return BackupService.dry_run_restore(full_path, db)


@router.post("/api/backup/restore-enterprise")
def restore_backup_endpoint(
    filename: Optional[str] = Body(None, embed=True),
    backup_filename: Optional[str] = Body(None, embed=True),
    user_name: str = Body("Admin", embed=True),
    db: Session = Depends(get_db),
):
    """Restores database with automatic pre-restore safety snapshot."""
    target = filename or backup_filename
    if not target:
        raise HTTPException(status_code=400, detail="Missing required backup filename.")
    safe_name = os.path.basename(target)
    full_path = os.path.join(BACKUPS_DIR, safe_name)
    return restore_enterprise_backup(db, full_path, user_name=user_name)


@router.post("/api/backup/test-restore/{filename}")
def test_restore_endpoint(filename: str, db: Session = Depends(get_db)):
    """Restores into temporary database, compares GL balance & record counts, and deletes temp DB."""
    safe_name = os.path.basename(filename)
    full_path = os.path.join(BACKUPS_DIR, safe_name)
    from app.services.backup.backup_service import BackupService
    return BackupService.dry_run_restore(full_path, db)


@router.get("/api/backup/export-json")
def export_full_system_json(db: Session = Depends(get_db)):
    """Full system JSON export."""
    data = generate_full_system_json_export(db)
    return JSONResponse(
        content=data,
        headers={"Content-Disposition": "attachment; filename=AQ_COMPANIES_FULL_EXPORT.json"},
    )


# ---------------------------------------------------------------------
# 7. LOCAL SERVER SAFETY & SYSTEM HEALTH (SECTIONS 39 & 40)
# ---------------------------------------------------------------------

@router.get("/api/system/health")
def system_health_endpoint(db: Session = Depends(get_db)):
    """Route: /settings/system-health."""
    return get_system_health_metrics(db)


@router.get("/api/system/diagnostics")
def system_diagnostics_endpoint(db: Session = Depends(get_db)):
    """SECTION 76: System Diagnostics Package Export."""
    from app.services.monitoring.system_monitor import SystemMonitor
    return SystemMonitor.get_diagnostics_package(db)


@router.get("/api/system/errors")
def system_errors_endpoint(limit: int = 50, unresolved_only: bool = False):
    """SECTION 35: System Error Viewer."""
    from app.core.logging import get_system_errors, get_unresolved_error_count
    return {
        "errors": get_system_errors(limit=limit, unresolved_only=unresolved_only),
        "unresolved_count": get_unresolved_error_count(),
    }


@router.post("/api/system/errors/resolve/{error_id}")
def resolve_error_endpoint(error_id: str):
    """Marks system error as resolved."""
    from app.core.logging import resolve_system_error
    ok = resolve_system_error(error_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Error ID not found.")
    return {"success": True, "error_id": error_id, "resolved": True}


# ---------------------------------------------------------------------
# 8. NOTIFICATIONS CENTER (SECTIONS 43 & 44)
# ---------------------------------------------------------------------

@router.get("/api/notifications")
def get_notifications(
    category: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """Route: /notifications."""
    q = db.query(models.Notification)
    if category:
        q = q.filter(models.Notification.category == category.upper())
    if status_filter:
        q = q.filter(models.Notification.status == status_filter.upper())
    notifs = q.order_by(desc(models.Notification.id)).limit(limit).all()

    return [
        {
            "id": n.id,
            "category": n.category,
            "title": n.title,
            "message": n.message,
            "link": n.link,
            "severity": n.severity,
            "status": n.status,
            "created_at": n.created_at.isoformat(),
        }
        for n in notifs
    ]


@router.put("/api/notifications/{id}/read")
def mark_notification_read(id: int, db: Session = Depends(get_db)):
    notif = db.query(models.Notification).filter(models.Notification.id == id).first()
    if notif:
        notif.status = "READ"
        notif.read_at = datetime.utcnow()
        db.commit()
    return {"success": True}


@router.put("/api/notifications/{id}/dismiss")
def dismiss_notification(id: int, db: Session = Depends(get_db)):
    notif = db.query(models.Notification).filter(models.Notification.id == id).first()
    if notif:
        notif.status = "DISMISSED"
        db.commit()
    return {"success": True}


# ---------------------------------------------------------------------
# 9. ACCOUNTING TASKS & WORK QUEUE (SECTIONS 45 & 46)
# ---------------------------------------------------------------------

@router.get("/api/accounting/tasks")
def get_accounting_tasks(
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Lists accounting tasks for work queue."""
    q = db.query(models.AccountingTask)
    if status_filter:
        q = q.filter(models.AccountingTask.status == status_filter.upper())
    if priority:
        q = q.filter(models.AccountingTask.priority == priority.upper())

    tasks = q.order_by(models.AccountingTask.due_date.asc(), desc(models.AccountingTask.id)).all()
    return [
        {
            "id": t.id,
            "task_name": t.task_name,
            "category": t.category,
            "priority": t.priority,
            "assigned_to": t.assigned_to,
            "due_date": str(t.due_date) if t.due_date else None,
            "entity_type": t.entity_type,
            "entity_id": t.entity_id,
            "status": t.status,
            "created_by": t.created_by,
            "created_at": t.created_at.isoformat(),
            "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        }
        for t in tasks
    ]


@router.post("/api/accounting/tasks")
def create_task(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    task = models.AccountingTask(
        task_name=payload["task_name"],
        category=payload.get("category", "ACCOUNTING"),
        priority=payload.get("priority", "MEDIUM"),
        assigned_to=payload.get("assigned_to", "Accountant"),
        due_date=dt_date.fromisoformat(payload["due_date"]) if payload.get("due_date") else None,
        entity_type=payload.get("entity_type"),
        entity_id=payload.get("entity_id"),
        status="PENDING",
        created_by=payload.get("created_by", "Admin"),
        created_at=datetime.utcnow(),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"success": True, "task_id": task.id}


@router.put("/api/accounting/tasks/{id}/complete")
def complete_task(
    id: int,
    user_name: str = Body("Admin", embed=True),
    db: Session = Depends(get_db),
):
    task = db.query(models.AccountingTask).filter(models.AccountingTask.id == id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = "COMPLETED"
    task.completed_at = datetime.utcnow()
    db.commit()
    return {"success": True, "task_id": task.id, "status": "COMPLETED"}
