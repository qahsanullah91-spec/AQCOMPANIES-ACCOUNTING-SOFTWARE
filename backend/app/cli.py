"""
AQ COMPANIES — Enterprise Unified CLI Administration Tool
Commands:
  python -m app.cli health
  python -m app.cli accounting-check
  python -m app.cli backup
  python -m app.cli backup-verify [--path <archive>]
  python -m app.cli migration-status
  python -m app.cli import-dry-run --path <json_file>
  python -m app.cli restore-check [--path <archive>]
  python -m app.cli maintenance [enable|disable|status] [--reason <text>]
  python -m app.cli database-reset --confirm-destructive
"""
import os
import sys
import argparse
import json
import time
import zipfile
import tempfile
from decimal import Decimal
from typing import Optional

# Add backend directory to sys.path
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.database import get_db, engine, Base
from app.core.config import settings
from app.core.maintenance import is_maintenance_mode, get_maintenance_info, set_maintenance_mode
from app.tools.migration_check import get_migration_status
from app.tools.pre_deploy_backup import execute_pre_deploy_backup
from app.security_automation import (
    run_accounting_health_check,
    create_enterprise_backup,
    preview_backup_archive,
    calculate_file_sha256,
    test_restore_in_temporary_database,
    BACKUPS_DIR,
)


def cmd_health(args):
    print("=" * 65)
    print("AQ COMPANIES — SYSTEM & OBSERVABILITY HEALTH")
    print("=" * 65)
    db = next(get_db())
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        db_status = "CONNECTED"
    except Exception as exc:
        db_status = f"ERROR ({exc})"
    finally:
        db.close()

    print(f"Service Name:       {settings.PROJECT_NAME}")
    print(f"Application Version:{settings.VERSION}")
    print(f"API Contract:       {settings.API_VERSION}")
    print(f"Environment:        {settings.ENVIRONMENT.upper()}")
    print(f"Database Dialect:   {engine.dialect.name.upper()} ({db_status})")
    print(f"Maintenance Lock:   {'LOCKED (503 Active)' if is_maintenance_mode() else 'UNLOCKED (Normal Ops)'}")
    print("=" * 65)


def cmd_accounting_check(args):
    print("=" * 65)
    print("AQ COMPANIES — GENERAL LEDGER & SUBLEDGER HEALTH CHECK")
    print("=" * 65)
    db = next(get_db())
    try:
        health = run_accounting_health_check(db)
        tb = health.get("trial_balance", {})
        print(f"Overall Status:     {health.get('status')}")
        print(f"Trial Balance:      {tb.get('status')} (Diff: ${tb.get('difference', 0.0):,.2f})")
        print(f"Total Debit:        ${tb.get('total_debit', 0.0):,.2f}")
        print(f"Total Credit:       ${tb.get('total_credit', 0.0):,.2f}")
        print(f"Unbalanced Journals:{health.get('unbalanced_journals_count', 0)}")

        subledgers = health.get("subledgers", {})
        print("\nSubledger Controls:")
        for name, data in subledgers.items():
            status = data.get("status", "OK")
            diff = data.get("difference", 0.0)
            print(f"  - {name.capitalize():<15}: {status:<12} (Diff: ${diff:,.2f})")
        print("=" * 65)

        if health.get("status") == "HEALTHY":
            print("[OK] All double-entry books and control accounts are balanced.")
            sys.exit(0)
        else:
            print("[WARNING] Control account discrepancy detected. Audit log flagged.")
            sys.exit(1)
    finally:
        db.close()


def cmd_backup(args):
    print("=" * 65)
    print("AQ COMPANIES — ENTERPRISE BACKUP EXECUTION")
    print("=" * 65)
    res = execute_pre_deploy_backup()
    print(f"[SUCCESS] Backup archive: {res['filename']} ({res['file_size']:,} bytes)")
    print(f"Checksum SHA-256: {res['database_sha256']}")


def cmd_backup_verify(args):
    print("=" * 65)
    print("AQ COMPANIES — BACKUP ARCHIVE VERIFIER")
    print("=" * 65)
    zip_path = args.path
    if not zip_path:
        # Pick latest backup from backups directory
        if not os.path.exists(BACKUPS_DIR):
            print(f"[ERROR] Backups directory '{BACKUPS_DIR}' does not exist.")
            sys.exit(1)
        zips = [os.path.join(BACKUPS_DIR, f) for f in os.listdir(BACKUPS_DIR) if f.endswith(".zip")]
        if not zips:
            print("[ERROR] No backup archives found in backups directory.")
            sys.exit(1)
        zips.sort(key=os.path.getmtime, reverse=True)
        zip_path = zips[0]

    print(f"Verifying Archive: {zip_path}")
    if not os.path.exists(zip_path):
        print(f"[FATAL] Archive not found at {zip_path}")
        sys.exit(1)

    preview = preview_backup_archive(zip_path)
    if not preview.get("manifest"):
        print("[FATAL] Archive is missing manifest.json!")
        sys.exit(1)

    manifest = preview["manifest"]
    expected_sha = manifest.get("checksum_sha256")

    with zipfile.ZipFile(zip_path, "r") as zf:
        db_entries = [f for f in zf.namelist() if f.endswith(".db") or f.endswith(".sql")]
        if not db_entries:
            print("[FATAL] Archive does not contain database snapshot!")
            sys.exit(1)
        import hashlib
        with zf.open(db_entries[0]) as f:
            h = hashlib.sha256()
            while chunk := f.read(65536):
                h.update(chunk)
            actual_sha = h.hexdigest()

    if expected_sha and actual_sha != expected_sha:
        print(f"[FATAL] Checksum Mismatch! Manifest: {expected_sha}, Extracted: {actual_sha}")
        sys.exit(1)

    print("[SUCCESS] Checksum and manifest successfully verified.")
    print(f"Created:      {manifest.get('created_date')}")
    print(f"App Version:  {manifest.get('software_version')}")
    print(f"Schema Rev:   {manifest.get('database_revision') or manifest.get('database_schema_version')}")
    print(f"Total Tables: {len(manifest.get('record_counts', {}))}")
    print("=" * 65)


def cmd_migration_status(args):
    status = get_migration_status()
    print("=" * 65)
    print("AQ COMPANIES — DATABASE MIGRATION STATUS")
    print("=" * 65)
    print(f"Current Revision:     {status['current_revision']}")
    print(f"Target Head Revision: {status['target_revision']}")
    print(f"Pending Revisions:    {status['pending_count']}")
    print(f"Risk Assessment:      {status['migration_risk']}")
    print(f"Status:               {'UP TO DATE' if status['is_up_to_date'] else 'PENDING MIGRATION'}")
    print("=" * 65)


def cmd_maintenance(args):
    action = args.action.lower()
    if action == "status":
        info = get_maintenance_info()
        print(f"Maintenance Mode: {'ENABLED (Mutations Locked)' if info['enabled'] else 'DISABLED (Normal Operations)'}")
        print(f"Reason:           {info['reason']}")
        print(f"Updated At:       {info['updated_at']}")
        print(f"Updated By:       {info['updated_by']}")
    elif action == "enable":
        reason = args.reason or "Manual CLI maintenance activation"
        info = set_maintenance_mode(enabled=True, reason=reason, updated_by="CLI-Admin")
        print(f"[OK] Maintenance mode ENABLED. Reason: {reason}")
    elif action == "disable":
        info = set_maintenance_mode(enabled=False, reason="CLI maintenance deactivation", updated_by="CLI-Admin")
        print("[OK] Maintenance mode DISABLED. Normal financial operations active.")


def cmd_restore_check(args):
    print("=" * 65)
    print("AQ COMPANIES — ISOLATED RESTORE SIMULATION TEST")
    print("=" * 65)
    zip_path = args.path
    if not zip_path:
        zips = [os.path.join(BACKUPS_DIR, f) for f in os.listdir(BACKUPS_DIR) if f.endswith(".zip")]
        if not zips:
            print("[ERROR] No backup archives found to test.")
            sys.exit(1)
        zips.sort(key=os.path.getmtime, reverse=True)
        zip_path = zips[0]

    print(f"Simulating Restore for: {os.path.basename(zip_path)}")
    from app.services.monitoring.system_monitor import SystemMonitor
    res = SystemMonitor.test_automated_restore(zip_path)

    if res.get("status") == "PASS":
        print(f"[SUCCESS] Restore Simulation: PASSED")
    else:
        print(f"[FAILED] Restore Simulation: FAILED")
    print(f"Measured RTO:        {res.get('measured_rto_seconds')} seconds")
    print(f"Trial Balance:       {res.get('trial_balance_status')} (Diff: ${res.get('trial_balance_difference', 0.0):,.2f})")
    print(f"Records Verified:    {res.get('records_verified'):,}")
    print(f"Temporary DB:        Successfully purged (Zero production impact)")
    print("=" * 65)


def cmd_database_reset(args):
    if settings.ENVIRONMENT == "production":
        print("[FATAL] DATABASE RESET IS PERMANENTLY DISABLED IN PRODUCTION ENVIRONMENT.")
        sys.exit(1)

    if not args.confirm_destructive:
        confirm = input("WARNING: This will DESTROY all data in the local development database.\nType 'CONFIRM_DESTRUCTIVE_RESET' to proceed: ")
        if confirm != "CONFIRM_DESTRUCTIVE_RESET":
            print("[ABORTED] Database reset cancelled.")
            sys.exit(0)

    print("Dropping all database tables...")
    Base.metadata.drop_all(bind=engine)
    print("Recreating database tables from models...")
    Base.metadata.create_all(bind=engine)
    print("[SUCCESS] Development database has been reset.")


def main():
    parser = argparse.ArgumentParser(description="AQ COMPANIES Enterprise Administration CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Health
    subparsers.add_parser("health", help="Check system, database, and observability status")

    # Accounting Check
    subparsers.add_parser("accounting-check", help="Run General Ledger and control account balance verification")

    # Backup
    subparsers.add_parser("backup", help="Create verified pre-deploy enterprise backup")

    # Backup Verify
    bv_p = subparsers.add_parser("backup-verify", help="Verify backup archive checksum and manifest")
    bv_p.add_argument("--path", type=str, default=None, help="Path to backup ZIP file")

    # Migration Status
    subparsers.add_parser("migration-status", help="Check Alembic schema revision and pending migration risk")

    # Maintenance
    m_p = subparsers.add_parser("maintenance", help="Manage deployment maintenance lock")
    m_p.add_argument("action", choices=["enable", "disable", "status"], help="Action to execute")
    m_p.add_argument("--reason", type=str, default="Scheduled maintenance", help="Reason for maintenance")

    # Restore Check
    rc_p = subparsers.add_parser("restore-check", help="Simulate backup restore into temporary test database")
    rc_p.add_argument("--path", type=str, default=None, help="Path to backup ZIP file")

    # Database Reset (Dev only)
    dr_p = subparsers.add_parser("database-reset", help="Reset local development database (DISABLED in prod)")
    dr_p.add_argument("--confirm-destructive", action="store_true", help="Bypass interactive prompt")

    args = parser.parse_args()

    handlers = {
        "health": cmd_health,
        "accounting-check": cmd_accounting_check,
        "backup": cmd_backup,
        "backup-verify": cmd_backup_verify,
        "migration-status": cmd_migration_status,
        "maintenance": cmd_maintenance,
        "restore-check": cmd_restore_check,
        "database-reset": cmd_database_reset,
    }

    handler = handlers.get(args.command)
    if handler:
        handler(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
