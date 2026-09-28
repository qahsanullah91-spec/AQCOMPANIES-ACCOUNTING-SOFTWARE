#!/usr/bin/env python3
"""
AQ COMPANIES - Safe Production Deployment Orchestrator
Executes the authoritative 9-step zero-downtime / maintenance-locked deployment pipeline:
1. Pre-Deployment Health & Readiness Check
2. Automated Pre-Deployment Backup Creation
3. Pre-Deployment Backup Verification (Manifest & SHA-256)
4. Enable Maintenance Mode Lock (HTTP 503 on mutations)
5. Migration Safety Inspection & Alembic Head Upgrade
6. Application Code Boot Verification
7. Post-Deploy Smoke Testing Suite
8. Central Accounting Health & Trial Balance Invariant Check
9. Disable Maintenance Mode (Re-opening normal financial operations)

Automatic Rollback Trigger:
If any step between 5 and 8 fails, this script automatically executes an emergency
database rollback from the verified pre-deploy backup before exiting with error.
"""

import os
import sys
import argparse
import subprocess
import time
from typing import Dict, Any

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings, validate_production_config
from app.core.maintenance import set_maintenance_mode, is_maintenance_mode
from app.database import SessionLocal
from app.tools.pre_deploy_backup import execute_pre_deploy_backup
from app.tools.migration_check import get_migration_status
from app.services.monitoring.system_monitor import SystemMonitor
from scripts.smoke_test import run_smoke_tests
from scripts.rollback import execute_emergency_rollback, verify_archive


def deploy_production(dry_run: bool = False, skip_migrations: bool = False) -> bool:
    print("=" * 75)
    print("AQ COMPANIES — ENTERPRISE PRODUCTION DEPLOYMENT ORCHESTRATOR")
    print(f"Version:      {settings.VERSION}")
    print(f"Environment:  {settings.ENVIRONMENT}")
    print(f"Timestamp:    {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}")
    print("=" * 75)
    start_total = time.perf_counter()

    # Step 0: Validate Production Environment Configuration
    print("\n[Step 0/9] Validating production configuration & security safeguards...")
    if settings.ENVIRONMENT == "production":
        validate_production_config(settings)
        print(" -> Production security configuration validated (Secret key safe, debugging off).")
    else:
        print(f" -> Non-production environment '{settings.ENVIRONMENT}' detected. Proceeding...")

    # Step 1: Pre-Deployment Health Check
    print("\n[Step 1/9] Performing pre-flight health & database readiness check...")
    db = SessionLocal()
    try:
        from app.security_automation import run_accounting_health_check
        initial_health = run_accounting_health_check(db)
        tb = initial_health.get("checks", {}).get("general_ledger", {})
        if tb.get("difference", 0.0) != 0.0:
            print(f"[FATAL] Cannot deploy! Pre-existing Trial Balance discrepancy: ${tb.get('difference')}", file=sys.stderr)
            return False
        print(f" -> System is Healthy. Pre-flight Trial Balance: {tb.get('status')} (Diff: $0.00).")
    finally:
        db.close()

    # Step 2: Automated Pre-Deployment Backup Creation
    print("\n[Step 2/9] Creating pre-deployment enterprise backup archive...")
    if dry_run:
        print(" -> [DRY RUN] Skipped backup creation. Simulating verified backup.")
        backup_archive_path = None
    else:
        try:
            backup_result = execute_pre_deploy_backup()
            backup_archive_path = backup_result["file_path"]
            print(f" -> Verified backup created: {os.path.basename(backup_archive_path)}")
        except Exception as exc:
            print(f"[FATAL] Pre-deploy backup failed: {exc}", file=sys.stderr)
            return False

    # Step 3: Pre-Deploy Backup Verification
    print("\n[Step 3/9] Verifying backup checksum and disaster recovery manifest...")
    if not dry_run and backup_archive_path:
        verif = verify_archive(backup_archive_path)
        if not verif.get("valid"):
            print(f"[FATAL] Backup archive failed verification: {verif.get('errors')}", file=sys.stderr)
            return False
        print(f" -> Backup SHA-256 and manifest validated: {verif.get('manifest_sha256')[:16]}...")
    else:
        print(" -> [DRY RUN] Manifest validation simulated.")

    if dry_run:
        print("\n" + "=" * 75)
        print("[DRY RUN COMPLETE] All pre-flight deployment gates PASSED.")
        print("Zero modifications were made to the live system.")
        print("=" * 75)
        return True

    # Step 4: Enable Maintenance Mode Lock
    print("\n[Step 4/9] Locking Maintenance Mode to block financial mutations...")
    set_maintenance_mode(
        enabled=True,
        reason=f"Production release deployment v{settings.VERSION}",
        updated_by="ProductionDeployOrchestrator",
    )
    print(" -> Maintenance mode ENABLED. Financial writes return HTTP 503 Service Unavailable.")

    # Step 5: Migration Safety Inspection & Alembic Head Upgrade
    print("\n[Step 5/9] Inspecting and applying database migrations...")
    try:
        mig_status = get_migration_status()
        print(f" -> Current Revision: {mig_status['current_revision']}")
        print(f" -> Target Revision:  {mig_status['target_revision']}")
        print(f" -> Pending Migrations: {mig_status['pending_count']}")

        if not skip_migrations and not mig_status["is_up_to_date"]:
            print(" -> Executing: alembic upgrade head ...")
            res = subprocess.run(
                [sys.executable, "-m", "alembic", "upgrade", "head"],
                cwd=backend_dir,
                capture_output=True,
                text=True,
            )
            if res.returncode != 0:
                print(f"[FATAL] Alembic upgrade head failed!\nSTDOUT: {res.stdout}\nSTDERR: {res.stderr}", file=sys.stderr)
                raise RuntimeError("Alembic database migration failed.")
            print(" -> Alembic upgrade head completed successfully.")
        else:
            print(" -> Database schema is already up to date.")
    except Exception as exc:
        print(f"\n[CRITICAL FAILURE IN STEP 5] {exc}", file=sys.stderr)
        print("[TRIGGERING AUTOMATIC ROLLBACK]...")
        execute_emergency_rollback(archive_path=backup_archive_path)
        return False

    # Step 6: Application Code Boot Verification
    print("\n[Step 6/9] Verifying application module boot and dependencies...")
    try:
        from app.main import app
        print(" -> FastAPI application instance compiled and verified.")
    except Exception as exc:
        print(f"\n[CRITICAL FAILURE IN STEP 6] Application failed to load: {exc}", file=sys.stderr)
        print("[TRIGGERING AUTOMATIC ROLLBACK]...")
        execute_emergency_rollback(archive_path=backup_archive_path)
        return False

    # Step 7: Post-Deploy Smoke Testing Suite
    print("\n[Step 7/9] Executing deployment smoke test suite...")
    smoke_success = run_smoke_tests()
    if not smoke_success:
        print("\n[CRITICAL FAILURE IN STEP 7] Smoke tests failed!", file=sys.stderr)
        print("[TRIGGERING AUTOMATIC ROLLBACK]...")
        execute_emergency_rollback(archive_path=backup_archive_path)
        return False
    print(" -> All 10 smoke checks passed.")

    # Step 8: Central Accounting Health & Invariant Check
    print("\n[Step 8/9] Auditing post-deployment accounting health...")
    db = SessionLocal()
    try:
        from app.security_automation import run_accounting_health_check
        final_health = run_accounting_health_check(db)
        tb = final_health.get("checks", {}).get("general_ledger", {})
        if tb.get("difference", 0.0) != 0.0 or tb.get("status") != "BALANCED":
            print(f"\n[CRITICAL FAILURE IN STEP 8] Trial Balance discrepancy detected: {tb.get('difference')}", file=sys.stderr)
            print("[TRIGGERING AUTOMATIC ROLLBACK]...")
            execute_emergency_rollback(archive_path=backup_archive_path)
            return False
        print(f" -> Post-deployment Trial Balance: BALANCED (Debits == Credits, Difference = $0.00).")
    finally:
        db.close()

    # Step 9: Disable Maintenance Mode
    print("\n[Step 9/9] Re-opening production traffic...")
    set_maintenance_mode(
        enabled=False,
        reason=f"Production deployment v{settings.VERSION} completed successfully",
        updated_by="ProductionDeployOrchestrator",
    )
    print(" -> Maintenance mode DISABLED. Normal financial operations restored.")

    total_duration = time.perf_counter() - start_total
    print("\n" + "=" * 75)
    print(f"[SUCCESS] PRODUCTION DEPLOYMENT v{settings.VERSION} COMPLETED IN {total_duration:.2f}s")
    print("Zero accounting discrepancies. Full release safety verified.")
    print("=" * 75)
    return True


def main():
    parser = argparse.ArgumentParser(
        description="AQ Companies - Automated Production Deployment Orchestrator"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate deployment gates without locking maintenance mode or altering database.",
    )
    parser.add_argument(
        "--skip-migrations",
        action="store_true",
        help="Skip Alembic migration execution step.",
    )
    args = parser.parse_args()

    success = deploy_production(
        dry_run=args.dry_run,
        skip_migrations=args.skip_migrations,
    )
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
