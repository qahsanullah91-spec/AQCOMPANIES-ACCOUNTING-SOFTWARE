"""
AQ COMPANIES — Pre-Deploy Automated Backup & Verification Tool
Command: python -m app.tools.pre_deploy_backup
Ensures that an authoritative, verified backup exists before any production migration or code release.
"""
import os
import sys
import zipfile
import json
import hashlib
from typing import Dict, Any

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.database import get_db
from app.core.config import settings
from app.security_automation import (
    create_enterprise_backup,
    preview_backup_archive,
    BACKUPS_DIR,
)


def execute_pre_deploy_backup() -> Dict[str, Any]:
    """
    Creates an enterprise pre-deployment backup and verifies its checksum and structure.
    Raises RuntimeError if backup creation or validation fails.
    """
    db = next(get_db())
    try:
        print(">> [1/3] Generating pre-deployment database & file backup...")
        backup_res = create_enterprise_backup(
            db=db,
            backup_type="PRE_DEPLOYMENT",
            user_name="DevOps-Deploy-Bot",
            notes="Automated pre-deployment safety snapshot before migration",
        )

        filename = backup_res["filename"]
        zip_path = os.path.join(BACKUPS_DIR, filename)
        if not os.path.exists(zip_path):
            raise RuntimeError(f"Backup file not found at {zip_path}")

        file_size = backup_res.get("size_bytes", os.path.getsize(zip_path))
        print(f"   [SUCCESS] Created backup archive: {filename} ({file_size:,} bytes)")

        # 2. Verify archive integrity
        print(">> [2/3] Verifying backup ZIP integrity and manifest...")
        preview = preview_backup_archive(zip_path)
        if not preview.get("manifest"):
            raise RuntimeError("Backup archive is missing manifest.json!")

        manifest = preview["manifest"]
        expected_db_sha = manifest.get("checksum_sha256")
        
        # 3. Test extraction and checksum verification
        print(">> [3/3] Validating database checksum against manifest...")
        with zipfile.ZipFile(zip_path, "r") as zf:
            db_entry = [f for f in zf.namelist() if f.endswith(".db") or f.endswith(".sql") or f.endswith(".dump")]
            if not db_entry:
                raise RuntimeError("Backup ZIP does not contain database dump file!")

            # Calculate SHA-256 of the extracted content
            with zf.open(db_entry[0]) as f:
                h = hashlib.sha256()
                while chunk := f.read(65536):
                    h.update(chunk)
                extracted_sha = h.hexdigest()

        if expected_db_sha and extracted_sha != expected_db_sha:
            raise RuntimeError(f"Checksum mismatch! Manifest: {expected_db_sha}, Extracted: {extracted_sha}")

        print(f"   [SUCCESS] Database SHA-256 verified: {extracted_sha[:16]}...")
        return {
            "success": True,
            "filename": filename,
            "file_path": zip_path,
            "backup_code": backup_res.get("backup_code", "UNKNOWN"),
            "file_size": file_size,
            "database_sha256": extracted_sha,
            "record_counts": manifest.get("record_counts", {}),
            "schema_version": manifest.get("database_revision") or manifest.get("database_schema_version"),
        }
    finally:
        db.close()


def main():
    print("=" * 70)
    print("AQ COMPANIES — PRE-DEPLOY BACKUP & VERIFICATION")
    print("=" * 70)
    try:
        res = execute_pre_deploy_backup()
        print("\n" + "=" * 70)
        print("PRE-DEPLOY BACKUP STATUS: VERIFIED & SAFE FOR DEPLOYMENT")
        print(f"Archive:       {res['filename']}")
        print(f"Size:          {res['file_size']:,} bytes")
        print(f"Schema Rev:    {res['schema_version']}")
        print(f"Total Records: {sum(res['record_counts'].values())} rows")
        print("=" * 70)
        sys.exit(0)
    except Exception as exc:
        print(f"\n[FATAL] Pre-deploy backup failed: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
