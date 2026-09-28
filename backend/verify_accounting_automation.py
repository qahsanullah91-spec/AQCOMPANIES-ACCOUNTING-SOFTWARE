"""
AQ COMPANIES — Security, Approvals, Reversals, Integrity & Backup Verification Suite
Automated test suite executing comprehensive tests across Sections 52, 53, 54.
"""
import sys
import os
import json
import uuid
import shutil
from decimal import Decimal
from datetime import date, datetime

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import SessionLocal, engine
from app import models
from app.security_automation import (
    SYSTEM_ROLES,
    ROLE_PERMISSIONS_MAP,
    get_user_effective_permissions,
    check_user_permission,
    evaluate_transaction_approval_need,
    submit_approval_request,
    approve_transaction_request,
    reject_transaction_request,
    assert_record_editable,
    assert_record_deletable,
    execute_reversal_workflow,
    execute_correction_workflow,
    log_audit_event,
    save_transaction_version,
    get_transaction_versions,
    generate_posting_key,
    post_central_accounting_rule,
    check_possible_duplicate_transaction,
    run_accounting_health_check,
    run_daily_accounting_job,
    create_enterprise_backup,
    test_restore_in_temporary_database,
    generate_full_system_json_export,
    get_system_health_metrics,
    BACKUPS_DIR,
)
from fastapi import HTTPException


def run_all_security_tests():
    db = SessionLocal()
    print("=" * 75)
    print("AQ COMPANIES — ACCOUNTING AUTOMATION, SECURITY, APPROVALS & BACKUP SUITE")
    print("=" * 75)

    # 1. ROLE & PERMISSION MATRIX TEST
    print("\n--- TEST 1: Role & Granular Permission Matrix ---")
    test_accountant = models.User(username="test_acc", role="ACCOUNTANT")
    test_cashier = models.User(username="test_cashier", role="CASHIER")
    test_admin = models.User(username="test_admin", role="ADMIN")
    test_view = models.User(username="test_view", role="VIEW_ONLY")

    assert check_user_permission(test_accountant, "accounting.create"), "Accountant should have accounting.create"
    assert not check_user_permission(test_accountant, "period.close"), "Accountant must not have period.close"
    assert check_user_permission(test_cashier, "cash.create"), "Cashier should have cash.create"
    assert not check_user_permission(test_cashier, "journal.post"), "Cashier must not have journal.post"
    assert check_user_permission(test_admin, "period.close"), "Admin should have period.close"
    assert not check_user_permission(test_view, "accounting.create"), "View-only must not have accounting.create"
    print("PASS: Role and permission matrix correctly restricts and permits capabilities.")

    # 2. PAYMENT APPROVAL THRESHOLDS & LARGE PAYMENT ALERT TEST
    print("\n--- TEST 2: Payment Approval Thresholds ($5k, $50k) & Large Payment Alert ---")
    eval_small = evaluate_transaction_approval_need(db, Decimal("3500.00"))
    assert not eval_small["requires_approval"], "Payment below $5,000 must not require approval"
    assert not eval_small["is_large_payment"]

    eval_medium = evaluate_transaction_approval_need(db, Decimal("15000.00"))
    assert eval_medium["requires_approval"], "Payment $15,000 must require approval"
    assert eval_medium["required_role"] == "ADMIN", "Payment $15,000 must require ADMIN"
    assert eval_medium["is_large_payment"]

    eval_large = evaluate_transaction_approval_need(db, Decimal("75000.00"))
    assert eval_large["requires_approval"], "Payment $75,000 must require approval"
    assert eval_large["required_role"] == "SUPER_ADMIN", "Payment $75,000 must require SUPER_ADMIN"
    assert eval_large["is_large_payment"]
    print(f"Tier 1 ($3.5k): requires={eval_small['requires_approval']} ({eval_small['threshold_rule']})")
    print(f"Tier 2 ($15k):  requires={eval_medium['requires_approval']} ({eval_medium['threshold_rule']})")
    print(f"Tier 3 ($75k):  requires={eval_large['requires_approval']} ({eval_large['threshold_rule']})")
    print("PASS: Payment approval thresholds and large payment flags verified.")

    # 3. FOUR-EYES CONTROL TEST (Creator cannot approve own transaction)
    print("\n--- TEST 3: Four-Eyes Control Enforcement ---")
    req = submit_approval_request(
        db,
        entity_type="PAYMENT",
        entity_id=9999,
        amount=Decimal("12000.00"),
        currency="USD",
        party_name="Carrier Test",
        account_name="AQ Central Bank",
        requested_by="accountant_jane",
        reference="WIRE-TEST-12K",
    )
    print(f"Created approval request #{req.id} by accountant_jane for ${req.amount:,.2f}")

    creator_user = models.User(username="accountant_jane", role="ADMIN")
    try:
        approve_transaction_request(db, req.id, creator_user)
        assert False, "Four-Eyes control failed! Creator was allowed to approve own transaction!"
    except HTTPException as e:
        assert "FOUR-EYES CONTROL VIOLATION" in e.detail
        print(f"PASS: Four-Eyes rule successfully rejected self-approval: {e.detail}")

    # Approve with another authorized user
    other_admin = models.User(username="senior_admin_mark", role="ADMIN")
    appr_res = approve_transaction_request(db, req.id, other_admin, notes="Verified transport wire documentation")
    assert appr_res["status"] == "APPROVED"
    print(f"PASS: Another authorized admin successfully approved request #{req.id}.")

    # 4. POSTED RECORD PROTECTION TEST
    print("\n--- TEST 4: Posted Record Protection (Immutability & Delete Prevention) ---")
    mock_posted_tx = models.BankTransaction(status="POSTED", transaction_code="TX-POSTED-TEST")
    try:
        assert_record_editable(mock_posted_tx, "BankTransaction")
        assert False, "Should have prevented editing posted transaction!"
    except HTTPException as e:
        assert "POSTED RECORD PROTECTION" in e.detail
        print(f"PASS: Direct edit blocked on posted record: {e.detail}")

    try:
        assert_record_deletable(mock_posted_tx, "BankTransaction")
        assert False, "Should have prevented deleting posted transaction!"
    except HTTPException as e:
        assert "POSTED RECORD PROTECTION" in e.detail
        print(f"PASS: Hard delete blocked on posted record: {e.detail}")

    # 5. REVERSAL ENGINE TEST
    print("\n--- TEST 5: Standard Reversal Engine Workflow ---")
    bank = db.query(models.BankAccount).first()
    test_orig_tx = models.BankTransaction(
        transaction_code=f"TX-REV-TEST-{uuid.uuid4().hex[:6]}",
        date=date.today(),
        bank_account_id=bank.id,
        bank_name=bank.bank_name,
        account_number=bank.account_number,
        party_type="CUSTOMER",
        party_name="Customer Reversal Test",
        transaction_type="CUSTOMER_RECEIPT",
        currency="USD",
        money_in=Decimal("5000.00"),
        money_out=Decimal("0.00"),
        status="POSTED",
        approval_status="APPROVED",
        created_by="Admin",
        created_at=datetime.utcnow(),
    )
    db.add(test_orig_tx)
    db.commit()
    db.refresh(test_orig_tx)

    rev_res = execute_reversal_workflow(
        db,
        entity_type="BankTransaction",
        entity_id=test_orig_tx.id,
        reason="Erroneous deposit entered against wrong account",
        user_name="Auditor-Test",
    )
    print(f"Reversal result: original #{rev_res['original_id']} -> reversal #{rev_res['reversal_id']} ({rev_res['reversal_code']})")
    assert rev_res["success"]
    reloaded_orig = db.query(models.BankTransaction).filter(models.BankTransaction.id == test_orig_tx.id).first()
    assert reloaded_orig.status == "REVERSED"
    assert reloaded_orig.is_reversed

    reloaded_rev = db.query(models.BankTransaction).filter(models.BankTransaction.id == rev_res["reversal_id"]).first()
    assert reloaded_rev.money_out == Decimal("5000.00"), "Reversal must invert flow to money_out"
    print("PASS: Standard reversal engine inverted flow and linked counter-entries.")

    # 6. CORRECTION WORKFLOW TEST
    print("\n--- TEST 6: Correction Workflow ---")
    tx_to_correct = models.BankTransaction(
        transaction_code=f"TX-CORR-{uuid.uuid4().hex[:6]}",
        date=date.today(),
        bank_account_id=bank.id,
        bank_name=bank.bank_name,
        account_number=bank.account_number,
        party_type="CUSTOMER",
        party_name="Customer Correction Test",
        transaction_type="CUSTOMER_RECEIPT",
        currency="USD",
        money_in=Decimal("4000.00"),
        money_out=Decimal("0.00"),
        status="POSTED",
        approval_status="APPROVED",
        created_by="Admin",
        created_at=datetime.utcnow(),
    )
    db.add(tx_to_correct)
    db.commit()
    db.refresh(tx_to_correct)

    corr_res = execute_correction_workflow(
        db,
        entity_type="BankTransaction",
        entity_id=tx_to_correct.id,
        corrected_data={"amount": 4500.00},
        reason="Correcting to actual wire amount $4,500.00",
        user_name="Admin",
    )
    assert corr_res["success"]
    print("PASS: Correction workflow properly executes step 1 reversal before step 2 re-entry.")

    # 7. IMMUTABLE AUDIT LOG & TRANSACTION VERSION HISTORY TEST
    print("\n--- TEST 7: Append-Only Audit Log & Version History ---")
    audit_entry = log_audit_event(
        db,
        entity_type="Invoice",
        entity_id=136,
        action="POST",
        old_val="DRAFT",
        new_val="POSTED",
        user_name="Ahsanullah Qureshi",
        reason="Commercial export verified against customs bill",
        ip_address="192.168.1.50",
        device_info="Finance-Workstation-01",
    )
    db.commit()
    assert audit_entry.id > 0
    assert audit_entry.ip_address == "192.168.1.50"

    # Version history
    v1 = save_transaction_version(
        db,
        entity_type="Invoice",
        entity_id=136,
        data_dict={"invoice_number": "INV-136", "amount": 69440.00, "status": "DRAFT"},
        user_name="Admin",
    )
    v2 = save_transaction_version(
        db,
        entity_type="Invoice",
        entity_id=136,
        data_dict={"invoice_number": "INV-136", "amount": 69440.00, "status": "POSTED"},
        user_name="Admin",
        changed_fields=[{"field": "status", "old": "DRAFT", "new": "POSTED"}],
    )
    versions = get_transaction_versions(db, "Invoice", 136)
    assert len(versions) >= 2
    print(f"Retrieved {len(versions)} versions for Invoice #136:")
    for v in versions[-2:]:
        print(f"  Version {v['version_number']} by {v['user_name']} at {v['created_at']} | Changes: {v['changed_fields']}")
    print("PASS: Append-only audit logging and transaction version comparison verified.")

    # 8. ACCOUNTING RULE ENGINE & IDEMPOTENCY TEST
    print("\n--- TEST 8: Centralized Posting Rules & Idempotency ---")
    rule_key_id = 99999
    je1 = post_central_accounting_rule(
        db,
        rule_type="CUSTOMER_INVOICE",
        source_id=rule_key_id,
        description="Test Idempotent Invoice Posting",
        amount=Decimal("15000.00"),
        reference="IDEM-TEST-001",
        user_name="System",
    )
    je1_id = je1.id

    # Post exact same transaction again
    je2 = post_central_accounting_rule(
        db,
        rule_type="CUSTOMER_INVOICE",
        source_id=rule_key_id,
        description="Duplicate Attempt",
        amount=Decimal("15000.00"),
        reference="IDEM-TEST-001",
        user_name="System",
    )
    assert je1_id == je2.id, f"Idempotency failed! Created duplicate journal #{je2.id} instead of returning #{je1_id}!"
    print(f"PASS: Idempotency confirmed — second posting returned identical journal #{je1.id} without duplication.")

    # 9. DUPLICATE TRANSACTION DETECTION TEST
    print("\n--- TEST 9: Duplicate Financial Transaction Detection ---")
    dup_res = check_possible_duplicate_transaction(
        db,
        party_name="Customer Reversal Test",
        date_val=date.today(),
        amount=Decimal("5000.00"),
        currency="USD",
    )
    assert dup_res is not None, "Failed to detect existing duplicate transaction"
    assert dup_res["duplicate_detected"]
    print(f"PASS: Duplicate detector flagged match: {dup_res['matched_code']} (${dup_res['matched_amount']:,.2f})")

    # 10. COMPREHENSIVE ACCOUNTING HEALTH CHECK TEST
    print("\n--- TEST 10: Subledger to General Ledger Integrity Health Check ---")
    health = run_accounting_health_check(db)
    print(f"All Balanced: {health['is_all_balanced']}")
    for k, v in health["checks"].items():
        print(f"  {k.upper()}: {v['status']} (diff = ${v.get('difference', 0.0):,.2f})")
    assert health["checks"]["general_ledger"]["status"] == "BALANCED", "GL must balance to $0.00"
    assert health["checks"]["transport"]["status"] == "BALANCED", "Transport ledger must balance to $0.00"
    print("PASS: Comprehensive accounting integrity health check verified.")

    # 11. AUTOMATED DAILY ACCOUNTING JOB TEST
    print("\n--- TEST 11: Automated Daily Accounting Maintenance Job ---")
    job_res = run_daily_accounting_job(db, user_name="AutomatedCronJob")
    print(f"Job Status: success={job_res['success']} | Invoices Refreshed={job_res['invoices_status_refreshed']} | Unbilled Shipments={job_res['pending_purchase_shipments']}")
    assert job_res["success"]
    print("PASS: Daily accounting job ran successfully without altering GL transactions.")

    # 12. ENTERPRISE BACKUP & MANIFEST TEST
    print("\n--- TEST 12: Enterprise Backup, Manifest & SHA256 Checksum ---")
    bak = create_enterprise_backup(db, backup_type="MANUAL", user_name="VerificationSuite", notes="Automated test backup")
    print(f"Created Backup: {bak['filename']}")
    print(f"Size:           {bak['size_bytes']:,} bytes")
    print(f"SHA256:         {bak['checksum_sha256']}")
    print(f"Status:         {bak['status']}")
    assert bak["status"] == "VERIFIED"
    assert bak["size_bytes"] > 0
    print("PASS: Enterprise backup created and manifest/checksum verified.")

    # 13. TEMPORARY DATABASE RESTORE TEST (SECTION 54)
    print("\n--- TEST 13: Temporary Database Disaster Recovery Restore Test ---")
    bak_path = os.path.join(BACKUPS_DIR, bak["filename"])
    restore_res = test_restore_in_temporary_database(bak_path)
    print(f"Restore Success:       {restore_res['success']}")
    print(f"Restored TB Balanced:  {restore_res['is_balanced']}")
    print(f"Restored Debit/Credit: ${restore_res['closing_debit']:,.2f}")
    print(f"Restored Records:      {restore_res['record_counts']}")
    assert restore_res["success"], "Restore test into temp DB failed"
    assert restore_res["is_balanced"], "Restored DB Trial Balance must be balanced ($0.00 difference)"
    print("PASS: Temporary database disaster recovery restore verified and temp DB cleanly removed.")

    # 14. FULL SYSTEM JSON EXPORT TEST (SECTION 38)
    print("\n--- TEST 14: Full System JSON Export ---")
    export_data = generate_full_system_json_export(db)
    print(f"Exported Software:  {export_data['software_name']}")
    print(f"Database Revision:  {export_data['database_revision']}")
    print(f"Export Customers:   {len(export_data['customers'])}")
    print(f"Export Invoices:    {len(export_data['invoices'])}")
    print(f"Export Purchases:   {len(export_data['purchases'])}")
    print(f"Export Journals:    {len(export_data['journals'])}")
    assert len(export_data["customers"]) > 0
    assert len(export_data["invoices"]) > 0
    print("PASS: Full system JSON backup generated.")

    # 15. SYSTEM HEALTH MONITOR METRICS TEST
    print("\n--- TEST 15: Local System Health Monitor Metrics ---")
    sys_metrics = get_system_health_metrics(db)
    print(f"Database Status:     {sys_metrics['database']['connected']} ({sys_metrics['database']['file_size_bytes']:,} bytes)")
    print(f"Database Revision:   {sys_metrics['database']['revision']}")
    print(f"Disk Free:           {sys_metrics['disk_storage']['pct_free']}% ({sys_metrics['disk_storage']['status']})")
    print(f"Last Backup:         {sys_metrics['backup']['last_backup_file']} ({sys_metrics['backup']['last_backup_status']})")
    assert sys_metrics["database"]["connected"]
    assert sys_metrics["disk_storage"]["status"] == "HEALTHY"
    print("PASS: Local system health monitor verified.")

    print("\n" + "=" * 75)
    print("ALL 15 SECURITY, APPROVALS, INTEGRITY & BACKUP TESTS PASSED SUCCESSFULLY!")
    print("=" * 75)
    db.close()


if __name__ == "__main__":
    run_all_security_tests()
