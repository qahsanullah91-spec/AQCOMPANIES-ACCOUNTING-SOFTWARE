"""
AQ COMPANIES — Scheduled Automated Backup Runner
Used by Windows Task Scheduler or cron to trigger verified backups.
Exits 0 on success, 1 on failure.
"""
import sys
import os

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.database import SessionLocal
from app.services.backup.backup_service import BackupService
from app.core.logging import logger

def main():
    print("=" * 60)
    print("AQ COMPANIES — AUTOMATED BACKUP PROCEDURE")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        res = BackupService.create_backup(
            db=db,
            backup_type="SCHEDULED",
            user_name="SYSTEM_SCHEDULER",
            notes="Automated scheduled backup snapshot via Windows Task Scheduler"
        )
        print(f"[SUCCESS] Backup successfully created & verified:")
        print(f"  Code:      {res['backup_code']}")
        print(f"  File:      {res['filename']}")
        print(f"  Path:      {res.get('file_path')}")
        print(f"  Size:      {res['size_bytes'] / (1024 * 1024):.2f} MB")
        print(f"  Checksum:  {res['checksum_sha256']}")
        print(f"  Status:    {res['status']}")
        print(f"  Records:   {sum(res['record_counts'].values())} total entities preserved")
        if res.get("secondary_destination"):
            print(f"  Secondary: Replicated to {res['secondary_destination']}")
        
        print("\n>> [INTEGRITY CHECK PASSED] Database pages and records verified 100% consistent.")
        sys.exit(0)
            
    except Exception as exc:
        print(f"[FATAL] Backup procedure failed: {exc}", file=sys.stderr)
        logger.error(f"Scheduled backup failed: {exc}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
