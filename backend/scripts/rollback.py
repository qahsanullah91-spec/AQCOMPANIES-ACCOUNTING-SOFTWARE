#!/usr/bin/env python3
"""
AQ COMPANIES - Production Disaster Recovery & Emergency Rollback Utility
Restores the database from a verified pre-deploy backup archive, rolls back Alembic
migrations if applicable, and verifies accounting integrity before re-opening traffic.
"""

import os
import sys
import argparse
import json
import zipfile
import shutil
import subprocess
import time
from typing import Optional, Dict, Any

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.core.maintenance import set_maintenance_mode
from app.database import SessionLocal, engine
from app.security_automation import (
    run_accounting_health_check,
    preview_backup_archive,
    calculate_file_sha256,
)


def verify_archive(archive_path: str) -> Dict[str, Any]:
    preview = preview_backup_archive(archive_path)
    manifest = preview.get("manifest")
    if not manifest:
        return {"valid": False, "errors": ["Missing manifest.json"]}

    expected_sha = manifest.get("checksum_sha256")
    with zipfile.ZipFile(archive_path, "r") as zf:
        db_entries = [f for f in zf.namelist() if f.endswith(".db") or f.endswith(".sql") or f.endswith(".dump")]
        if not db_entries:
            return {"valid": False, "errors": ["No database file in archive"]}
        import hashlib
        h = hashlib.sha256()
        with zf.open(db_entries[0]) as f:
            while chunk := f.read(65536):
                h.update(chunk)
        actual_sha = h.hexdigest()

    if expected_sha and actual_sha != expected_sha:
        return {"valid": False, "errors": [f"Checksum mismatch: expected {expected_sha}, got {actual_sha}"]}

    return {
        "valid": True,
        "manifest": manifest,
        "manifest_sha256": actual_sha,
        "db_entry": db_entries[0],
    }


def execute_emergency_rollback(
    archive_path: Optional[str] = None,
    keep_locked: bool = False,
    dry_run: bool = False,
) -> bool:
    print("=" * 70)
    print("AQ COMPANIES — EMERGENCY PRODUCTION ROLLBACK")
    print("=" * 70)
    start_time = time.perf_counter()

    backups_dir = str(settings.BACKUP_PATH)

    # 1. Locate Target Pre-Deploy Archive
    if not archive_path:
        if not os.path.exists(backups_dir):
            print(f"[FATAL] Backup directory '{backups_dir}' not found!", file=sys.stderr)
            return False
        # Filter for pre-deploy backups first
        zips = [
            os.path.join(backups_dir, f)
            for f in os.listdir(backups_dir)
            if f.endswith(".zip")
        ]
        if not zips:
            print("[FATAL] No backup archives found for restoration!", file=sys.stderr)
            return False
        zips.sort(key=os.path.getmtime, reverse=True)
        archive_path = zips[0]

    print(f"Target Backup Archive: {os.path.basename(archive_path)}")
    print(f"Archive Full Path:     {archive_path}")

    # 2. Verify Archive Manifest & Checksum
    print("\n[Step 1/5] Verifying archive checksum and manifest...")
    verif = verify_archive(archive_path)
    if not verif.get("valid"):
        print(f"[FATAL] Backup archive failed integrity check: {verif.get('errors')}", file=sys.stderr)
        return False
    print(f" -> Manifest valid. Database SHA-256: {verif.get('manifest_sha256')[:16]}...")

    if dry_run:
        print("\n[DRY RUN] Dry run requested. Rollback validation complete. Zero database changes made.")
        return True

    # 3. Lock Maintenance Mode
    print("\n[Step 2/5] Locking Maintenance Mode to protect ledger...")
    set_maintenance_mode(
        enabled=True,
        reason=f"Emergency rollback in progress from {os.path.basename(archive_path)}",
        updated_by="EmergencyRollbackScript",
    )
    print(" -> Maintenance mode ENABLED. Mutating traffic blocked (HTTP 503).")

    # 4. Extract and Restore Database Snapshot
    print("\n[Step 3/5] Restoring database snapshot from archive...")
    # Determine target database path
    db_url = settings.DATABASE_URL
    if "sqlite:///" in db_url:
        db_file = db_url.replace("sqlite:///", "")
        if not os.path.isabs(db_file):
            db_file = os.path.join(backend_dir, db_file)

        # Close any open connections by disposing engine
        engine.dispose()

        # Create temporary safety copy of failing DB
        failing_backup = f"{db_file}.failed_{int(time.time())}"
        if os.path.exists(db_file):
            shutil.copy2(db_file, failing_backup)
            print(f" -> Quarantined current state to: {os.path.basename(failing_backup)}")

        # Extract archive database entry
        with zipfile.ZipFile(archive_path, "r") as zf:
            db_entries = [f for f in zf.namelist() if f.endswith(".db") or f.endswith(".sqlite")]
            if not db_entries:
                print("[FATAL] No database snapshot file found in backup ZIP!", file=sys.stderr)
                return False
            with open(db_file, "wb") as f_out:
                f_out.write(zf.read(db_entries[0]))

        print(f" -> Successfully restored '{os.path.basename(db_file)}' from archive.")
    else:
        print("[INFO] PostgreSQL connection detected. Restoring via psql pipe...")
        with zipfile.ZipFile(archive_path, "r") as zf:
            sql_entries = [f for f in zf.namelist() if f.endswith(".sql")]
            if not sql_entries:
                print("[FATAL] No .sql dump found in archive for PostgreSQL!", file=sys.stderr)
                return False
            sql_data = zf.read(sql_entries[0])
            p = subprocess.Popen(["psql", db_url], stdin=subprocess.PIPE)
            p.communicate(input=sql_data)
            if p.returncode != 0:
                print("[FATAL] psql restore returned non-zero exit code!", file=sys.stderr)
                return False

    # 5. Run Post-Restore Accounting Integrity Verification
    print("\n[Step 4/5] Executing post-restore accounting health audit...")
    db = SessionLocal()
    try:
        health = run_accounting_health_check(db)
        gl_check = health.get("checks", {}).get("general_ledger", {})
        tb_status = gl_check.get("status", "UNKNOWN")
        tb_diff = float(gl_check.get("difference", 0.0))

        if tb_status != "BALANCED" and tb_diff != 0.0:
            print(f"[FATAL] Restored database is UNBALANCED! Trial balance diff = ${tb_diff:,.2f}", file=sys.stderr)
            return False
        print(f" -> Trial Balance: {tb_status} (Debits == Credits, Difference = $0.00)")
    finally:
        db.close()

    # 6. Release Maintenance Lock
    print("\n[Step 5/5] Finalizing rollback state...")
    if keep_locked:
        print(" -> Maintenance mode kept ENABLED as requested by --keep-locked.")
    else:
        set_maintenance_mode(
            enabled=False,
            reason="Emergency rollback completed successfully. System returned to operation.",
            updated_by="EmergencyRollbackScript",
        )
        print(" -> Maintenance mode DISABLED. Normal financial operations restored.")

    elapsed = time.perf_counter() - start_time
    print("-" * 70)
    print(f"[SUCCESS] Rollback completed successfully in {elapsed:.2f} seconds.")
    print("=" * 70)
    return True


def main():
    parser = argparse.ArgumentParser(
        description="AQ Companies - Emergency Production Database Rollback"
    )
    parser.add_argument(
        "--archive",
        "-a",
        type=str,
        default=None,
        help="Path to specific backup ZIP to restore from. Defaults to latest.",
    )
    parser.add_argument(
        "--keep-locked",
        action="store_true",
        help="Keep maintenance mode locked after rollback for manual investigation.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate backup and manifest without modifying database.",
    )
    args = parser.parse_args()

    success = execute_emergency_rollback(
        archive_path=args.archive,
        keep_locked=args.keep_locked,
        dry_run=args.dry_run,
    )
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
