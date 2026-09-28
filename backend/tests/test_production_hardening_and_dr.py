import os
import json
import zipfile
import pytest
from decimal import Decimal
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.core.config import settings
from app.services.backup.backup_service import BackupService
from app.services.accounting.integrity_service import AccountingIntegrityService
from app.services.monitoring.system_monitor import SystemMonitor
from app.core.maintenance import set_maintenance_mode, is_maintenance_mode
from app.core.logging import record_system_error, get_system_errors, resolve_system_error, get_unresolved_error_count

client = TestClient(app)


def test_consistent_sqlite_backup_api():
    """
    SECTIONS 2, 3, 4, 8:
    Tests database-consistent SQLite online backup API snapshot,
    manifest generation, SHA256 checksums, and verification.
    """
    db = SessionLocal()
    try:
        res = BackupService.create_backup(db, backup_type="MANUAL", user_name="TestAdmin", notes="Automated QA Test")
        assert res["success"] is True
        assert res["status"] == "VERIFIED"
        assert res["verified"] is True
        assert os.path.exists(os.path.join(str(settings.BACKUP_PATH), res["filename"]))

        # Verify ZIP contents
        zip_path = os.path.join(str(settings.BACKUP_PATH), res["filename"])
        verif = BackupService.verify_backup_archive(zip_path)
        assert verif["is_verified"] is True
        assert verif["status"] == "VERIFIED"
        assert "aq_companies.db" in verif["manifest"]["database_file"]
        assert verif["manifest"]["software_version"] == "1.0.0 Enterprise"
        assert verif["manifest"]["checksum_sha256"] == res["database_sha256"]
    finally:
        db.close()


def test_backup_status_and_attention_required():
    """
    SECTIONS 9 & 10:
    Verifies Last Backup Status endpoint and attention required alert.
    """
    db = SessionLocal()
    try:
        status_data = BackupService.get_last_backup_status(db)
        assert status_data["has_backup"] is True
        assert status_data["verified"] is True
        assert status_data["status"] == "VERIFIED"
        assert status_data["destination"] == str(settings.BACKUP_PATH)
        assert isinstance(status_data["hours_since_last_backup"], (int, float))

        # API endpoint verification
        resp = client.get("/api/backup/status")
        assert resp.status_code == 200
        api_data = resp.json()
        assert api_data["status"] == "VERIFIED"
        assert api_data["verified"] is True
    finally:
        db.close()


def test_restore_dry_run_validation():
    """
    SECTION 15:
    Validates backup archive in isolated sandbox without replacing production data.
    """
    db = SessionLocal()
    try:
        # Get latest backup
        logs = BackupService.list_backups(db)
        assert len(logs) > 0
        latest_file = logs[0]["filename"]
        zip_path = os.path.join(str(settings.BACKUP_PATH), latest_file)

        dry_run = BackupService.dry_run_restore(zip_path, db)
        assert dry_run["status"] in ("VALID", "REQUIRES_MIGRATION")
        assert dry_run["can_restore"] is True
        assert dry_run["is_gl_balanced"] is True
        assert dry_run["gl_difference"] == 0.0

        # API endpoint verification
        resp = client.post("/api/backup/dry-run", params={"backup_filename": latest_file})
        assert resp.status_code == 200
        assert resp.json()["status"] in ("VALID", "REQUIRES_MIGRATION")
    finally:
        db.close()


def test_accounting_integrity_service_full_audit():
    """
    SECTIONS 17, 18, 19, 20:
    Comprehensive accounting integrity audit covering:
    - Debits = Credits
    - Orphan checks
    - Allocation limits
    - Company ownership
    - Subledger reconciliations
    - Balance Sheet equation
    - NULL financial rules
    """
    db = SessionLocal()
    try:
        audit = AccountingIntegrityService.run_full_accounting_integrity_audit(db)
        assert audit["overall_status"] in ("PASS", "WARNING")

        checks = audit["checks"]
        assert checks["journal_balance"]["status"] == "PASS"
        assert checks["journal_balance"]["is_balanced"] is True
        assert checks["journal_balance"]["difference"] == 0.0

        assert checks["orphan_records"]["status"] == "PASS"
        assert checks["orphan_records"]["has_orphans"] is False

        assert checks["allocation_limits"]["status"] == "PASS"
        assert checks["company_ownership"]["status"] == "PASS"

        assert checks["balance_sheet_equation"]["status"] == "PASS"
        assert checks["balance_sheet_equation"]["is_balanced"] is True

        assert checks["null_financial_rules"]["status"] == "PASS"
        assert checks["null_financial_rules"]["null_values_preserved"] is True

        # API endpoint verification
        resp = client.get("/api/accounting/integrity")
        assert resp.status_code == 200
        assert resp.json()["overall_status"] in ("PASS", "WARNING")
    finally:
        db.close()


def test_golden_business_baselines_strict_preservation():
    """
    SECTIONS 69, 70, 71:
    Verifies that all golden accounting baselines remain strictly preserved:
    - Sales: $4,386,655.66
    - Transport Credit in AQ favor: $291,160.00
    - Verified Receipts: $0.00
    - Unknown Purchase Costs: NULL
    """
    db = SessionLocal()
    try:
        baselines = AccountingIntegrityService.verify_golden_baselines(db)
        assert baselines["status"] == "PASS"
        assert baselines["baselines_reconciled"] is True

        m = baselines["metrics"]
        assert m["sales"]["expected"] == 4386655.66
        assert m["sales"]["actual"] == 4386655.66
        assert m["sales"]["match"] is True

        assert m["verified_receipts"]["expected"] == 0.00
        assert m["verified_receipts"]["actual"] == 0.00
        assert m["verified_receipts"]["match"] is True

        assert m["transport_credit_in_aq_favor"]["expected"] == 291160.00
        assert m["transport_credit_in_aq_favor"]["actual"] == 291160.00
        assert m["transport_credit_in_aq_favor"]["match"] is True
    finally:
        db.close()


def test_maintenance_mode_and_write_protection():
    """
    SECTIONS 29 & 30:
    Verifies that Maintenance Mode blocks financial mutations with 503,
    while allowing reads and bypassed requests.
    """
    try:
        set_maintenance_mode(enabled=True, reason="Unit testing maintenance lock", updated_by="Test")
        assert is_maintenance_mode() is True

        # Write request should be blocked with 503
        post_resp = client.post("/api/new-stock/items", json={"stock_code": "TEST-LOCKED"})
        assert post_resp.status_code == 503
        data = post_resp.json()
        assert data["error"]["code"] == "MAINTENANCE_MODE"
        assert "SYSTEM MAINTENANCE" in data["error"]["message"]

        # Read request should still succeed
        get_resp = client.get("/api/health")
        assert get_resp.status_code == 200

        # Bypassed write should succeed or pass maintenance filter
        bypass_resp = client.post(
            "/api/new-stock/items",
            json={"stock_code": "TEST-LOCKED"},
            headers={"X-Maintenance-Bypass": settings.MAINTENANCE_BYPASS_TOKEN},
        )
        assert bypass_resp.status_code != 503
    finally:
        set_maintenance_mode(enabled=False, reason="Normal ops resumed", updated_by="Test")
        assert is_maintenance_mode() is False


def test_system_diagnostics_and_security_hardening():
    """
    SECTIONS 35, 76:
    Verifies system diagnostics package export (excluding passwords/secrets)
    and admin system error viewer.
    """
    resp = client.get("/api/system/diagnostics")
    assert resp.status_code == 200
    diag = resp.json()
    assert "application" in diag
    assert "storage" in diag
    assert "last_backup" in diag
    assert "resources" in diag

    # Ensure no secrets leaked
    diag_str = json.dumps(diag).lower()
    assert "password" not in diag_str or "******" in diag_str
    assert "secret_key" not in diag_str

    # Test error tracking
    rec = record_system_error(
        request_id="REQ-TEST1234",
        module="TEST_MODULE",
        error="Sample transient warning",
        details={"sensitive_token": "SUPER_SECRET_TOKEN_XYZ"},
    )
    errs = get_system_errors(limit=10)
    assert any(e["request_id"] == "REQ-TEST1234" for e in errs)
    # Ensure sanitization
    target = [e for e in errs if e["request_id"] == "REQ-TEST1234"][0]
    assert target["details"]["sensitive_token"] == "******"

    # Test resolution
    ok = resolve_system_error(rec["id"])
    assert ok is True
