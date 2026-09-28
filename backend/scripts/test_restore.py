#!/usr/bin/env python3
"""
AQ COMPANIES - Automated Disaster Recovery & Restore Test Script
Verifies that enterprise backups can be extracted into an isolated sandbox,
migrated to latest schema head, and passed through all accounting integrity checks.
Measures Recovery Time Objective (RTO) and cleans up temporary sandboxes automatically.
"""

import os
import sys
import argparse
import json
import time

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.services.monitoring.system_monitor import SystemMonitor


def main():
    parser = argparse.ArgumentParser(
        description="AQ Companies - Automated Disaster Recovery and Restore Verification"
    )
    parser.add_argument(
        "--archive",
        "-a",
        type=str,
        default=None,
        help="Path to specific backup ZIP archive to test. Defaults to newest in backup directory.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON for automated CI/CD pipelines.",
    )
    args = parser.parse_args()

    backups_dir = str(settings.BACKUP_PATH)
    archive_path = args.archive

    if not archive_path:
        if not os.path.exists(backups_dir):
            print(f"[ERROR] Backup directory '{backups_dir}' does not exist.", file=sys.stderr)
            sys.exit(1)
        zips = [os.path.join(backups_dir, f) for f in os.listdir(backups_dir) if f.endswith(".zip")]
        if not zips:
            print(f"[ERROR] No backup archives found in '{backups_dir}'.", file=sys.stderr)
            sys.exit(1)
        zips.sort(key=os.path.getmtime, reverse=True)
        archive_path = zips[0]

    if not os.path.exists(archive_path):
        print(f"[ERROR] Specified backup archive not found: {archive_path}", file=sys.stderr)
        sys.exit(1)

    if not args.json:
        print("=" * 70)
        print("AQ COMPANIES — AUTOMATED RESTORE VERIFICATION TEST")
        print("=" * 70)
        print(f"Archive:       {os.path.basename(archive_path)}")
        print(f"Full Path:     {archive_path}")
        print("Starting isolated disaster recovery simulation...")

    start_perf = time.perf_counter()
    try:
        results = SystemMonitor.test_automated_restore(archive_path)
    except Exception as exc:
        if args.json:
            print(json.dumps({"status": "ERROR", "error": str(exc)}, indent=2))
        else:
            print(f"\n[FATAL] Restore test crashed: {exc}", file=sys.stderr)
        sys.exit(1)

    total_rto = time.perf_counter() - start_perf
    results["measured_total_time_seconds"] = round(total_rto, 2)

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        status = results.get("status")
        print("\n" + "-" * 70)
        print(f"Restore Status:              {status}")
        print(f"Measured RTO:                {results.get('measured_rto_seconds')} seconds")
        print(f"Trial Balance Status:        {results.get('trial_balance_status')}")
        print(f"Trial Balance Difference:    ${results.get('trial_balance_difference', 0.0):,.2f}")
        print(f"Records Verified:            {results.get('records_verified'):,}")
        print(f"Manifest Schema Version:     {results.get('manifest_schema_version')}")
        print("-" * 70)

        if status == "PASS":
            print("[SUCCESS] Disaster recovery simulation PASSED. Database is fully recoverable.")
            print("[CLEANUP] Temporary test database purged cleanly.")
            print("=" * 70)
            sys.exit(0)
        else:
            print("[FAILURE] Restore verification FAILED! Accounting integrity compromised.")
            if results.get("count_mismatches"):
                print(f"Mismatches: {results.get('count_mismatches')}")
            print("=" * 70)
            sys.exit(1)


if __name__ == "__main__":
    main()
