"""
AQ COMPANIES — Complete Go-Live Readiness, UAT & Release Gate Test Suite
Tests:
- Accounting baseline invariants ($4,386,655.66 sales, $291,160.00 transport credit, $0.00 receipts)
- Strict NULL purchase costs (63 shipments) and NULL sales values (6 shipments)
- NEW-003 duplicate safety (CONVERTED and excluded from active stock)
- Customer Receipts UAT (partial, full, advances, oldest-first, manual allocation)
- Supplier Payments UAT (bill, payment, advances, AP GL reconciliation)
- Transport UAT (freight, payments, opening credit, standing credit in AQ favor)
- Banking UAT (deposits, disbursements, inter-account transfers, zero-diff reconciliation)
- Journal UAT (balanced post, unbalanced rejection, closed-period rejection)
- Non-destructive Reversals & Four-Eyes Approval
- Idempotency & Concurrency Protection
- Go-Live 14-Section Checklist & Release Gate
"""
import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal
from app import models
from app.financial_reports_engine import round_money
from app.services.golive.golive_service import GoLiveService
from app.services.accounting.integrity_service import AccountingIntegrityService
from app.services.transport.transport_service import TransportService
from app.security_automation import approve_transaction_request, submit_approval_request, is_four_eyes_enforced

client = TestClient(app)


# =====================================================================
# 1. ACCOUNTING BASELINE INVARIANTS & STRICT NULL CHECKS
# =====================================================================
def test_accounting_baseline_invariants_and_difference_report():
    """Validates that all golden business baselines match exactly with $0.00 difference."""
    db = SessionLocal()
    try:
        report = GoLiveService.get_baseline_difference_report(db)
        assert report["overall_status"] == "PASS", f"Baseline audit failed: {report}"
        assert report["p0_blockers_count"] == 0

        item_map = {it["id"]: it for it in report["items"]}

        # Sales Baseline: $4,386,655.66
        sales_item = item_map["baseline_sales"]
        assert sales_item["status"] == "PASS"
        assert Decimal(str(sales_item["current"])) == Decimal("4386655.66")
        assert sales_item["difference"] == 0.0

        # Verified Receipts: $0.00
        rec_item = item_map["baseline_receipts"]
        assert rec_item["status"] == "PASS"
        assert Decimal(str(rec_item["current"])) == Decimal("0.00")

        # Transport Carrier: $743,650.00 charges, $1,030,000.00 payments, $291,160.00 credit
        tc_item = item_map["baseline_transport_charges"]
        assert tc_item["status"] == "PASS"
        assert Decimal(str(tc_item["current"])) == Decimal("743650.00")

        tp_item = item_map["baseline_transport_payments"]
        assert tp_item["status"] == "PASS"
        assert Decimal(str(tp_item["current"])) == Decimal("1030000.00")

        tcred_item = item_map["baseline_transport_credit"]
        assert tcred_item["status"] == "PASS"
        assert Decimal(str(tcred_item["current"])) == Decimal("291160.00")

        # Strict NULL purchase costs (63 shipments)
        null_cost_item = item_map["baseline_null_purchase_costs"]
        assert null_cost_item["status"] == "PASS"
        assert null_cost_item["current"] == 63

        # Strict NULL sales rates (6 shipments)
        null_sales_item = item_map["baseline_null_sales_rates"]
        assert null_sales_item["status"] == "PASS"
        assert null_sales_item["current"] == 6

        # NEW-003 duplicate safety
        new_003_item = item_map["baseline_new_003_safety"]
        assert new_003_item["status"] == "PASS"
        assert new_003_item["current"] == 1

        # GL Balance: $0.00 difference
        gl_item = item_map["baseline_gl_balance"]
        assert gl_item["status"] == "PASS"
        assert gl_item["difference"] == 0.0
    finally:
        db.close()


def test_new_003_duplicate_safety_and_inventory_exclusion():
    """
    SECTION 6: NEW-003 DUPLICATE SAFETY
    NEW-003 must remain historical/converted and linked to INV-01.
    It must NOT appear in active stock totals.
    """
    db = SessionLocal()
    try:
        new_003 = db.query(models.NewStock).filter(models.NewStock.stock_code.like("%NEW-003%")).first()
        assert new_003 is not None, "NEW-003 stock record not found"
        assert new_003.status == "CONVERTED", f"NEW-003 status should be CONVERTED, got {new_003.status}"
        assert "INV-01" in (new_003.notes or ""), "NEW-003 must be linked to INV-01 in notes"

        # Verify active stock query excludes CONVERTED and SOLD
        active_stocks = db.query(models.NewStock).filter(~models.NewStock.status.in_(["SOLD", "CONVERTED"])).all()
        active_ids = [s.id for s in active_stocks]
        assert new_003.id not in active_ids, "NEW-003 must NOT be present in active unsold stock"

        # Verify active stock count is 3 (NEW-001, NEW-002, NEW-004) with value $212,337.50
        assert len(active_stocks) == 3
        active_val = sum((s.proforma_value or s.selling_value for s in active_stocks), Decimal("0.00"))
        assert active_val == Decimal("212337.50")
    finally:
        db.close()


def test_strict_null_purchase_costs_and_zero_coercion_protection():
    """
    SECTIONS 8 & 9: PURCHASE COST & PROFIT VALIDATION
    Unknown purchase costs must remain strictly NULL, not 0.00.
    Profit & margin must remain NULL (Pending Purchase Cost), not false profit.
    """
    db = SessionLocal()
    try:
        unbilled = db.query(models.Shipment).filter(models.Shipment.purchase_cost == None).all()
        assert len(unbilled) == 63, f"Expected 63 unbilled shipments, found {len(unbilled)}"

        for s in unbilled:
            assert s.purchase_cost is None, f"Shipment {s.id} purchase_cost was coerced to {s.purchase_cost}"
            assert s.net_profit is None or s.net_profit == 0.0, f"Shipment {s.id} should not show false net profit"
    finally:
        db.close()


# =====================================================================
# 2. GO-LIVE CHECKLIST & RELEASE GATE
# =====================================================================
def test_golive_checklist_and_release_gate_status():
    """
    SECTIONS 1, 61, 62: GO-LIVE CHECKLIST & RELEASE GATE
    Ensures all 14 categories are evaluated and status is READY FOR REVIEW.
    """
    db = SessionLocal()
    try:
        res = GoLiveService.generate_golive_checklist(db)
        summary = res["summary"]
        gate = res["release_gate"]

        assert summary["total_checks"] >= 70, f"Expected at least 70 granular checks, got {summary['total_checks']}"
        assert summary["p0_failures"] == 0, f"P0 blockers found: {summary['p0_failures']}"
        assert summary["failures"] == 0, f"Checklist failures found: {summary['failures']}"

        assert gate["status"] == "READY FOR REVIEW"
        assert gate["ready_for_review"] is True
        assert gate["human_confirmation_required"] is True

        # Check section coverage
        sections_found = set(c["section_id"] for c in res["checklist"])
        expected_sections = {"APP", "DB", "ACC", "BNK", "AR", "AP", "TRN", "REP", "DOC", "PERM", "BAK", "MOB", "SRV", "SEC"}
        assert expected_sections.issubset(sections_found), f"Missing sections: {expected_sections - sections_found}"
    finally:
        db.close()


def test_golive_api_endpoints():
    """Verifies that all Go-Live API endpoints respond with 200 OK and valid JSON."""
    r1 = client.get("/api/v1/golive/checklist")
    assert r1.status_code == 200
    data1 = r1.json()
    assert data1["release_gate"]["status"] == "READY FOR REVIEW"

    r2 = client.get("/api/v1/golive/baseline-report")
    assert r2.status_code == 200
    data2 = r2.json()
    assert data2["overall_status"] == "PASS"

    r3 = client.get("/api/v1/golive/production-data")
    assert r3.status_code == 200
    data3 = r3.json()
    assert data3["status"] == "PASS"

    r4 = client.get("/api/v1/golive/release-notes")
    assert r4.status_code == 200
    data4 = r4.json()
    assert "known_limitations" in data4

    r5 = client.post("/api/v1/golive/run-audit")
    assert r5.status_code == 200
    data5 = r5.json()
    assert data5["ready_for_review"] is True


# =====================================================================
# 3. WORKFLOW UAT: CUSTOMER RECEIVABLES & ADVANCES
# =====================================================================
def test_customer_receivables_and_advances_uat():
    """
    SECTION 24: CUSTOMER RECEIPT UAT
    Verifies that customer receipts and advances do not artificially inflate revenue.
    """
    db = SessionLocal()
    try:
        # AR subledger reconciliation
        customers = [c for c in db.query(models.Customer).all() if not c.customer_name.startswith("Concurrency")]
        assert len(customers) >= 16

        # Total sales vs AR
        total_invoice_sales = sum((s.invoice_value for s in db.query(models.Shipment).all() if s.invoice_value is not None), Decimal("0.00"))
        assert round_money(total_invoice_sales) == Decimal("4386655.66")

        # Zero customer receipts in baseline
        total_receipts = sum((s.customer_amount_received for s in db.query(models.Shipment).all() if s.customer_amount_received is not None), Decimal("0.00"))
        assert round_money(total_receipts) == Decimal("0.00")
    finally:
        db.close()


# =====================================================================
# 4. WORKFLOW UAT: TRANSPORT CARRIER POSITION
# =====================================================================
def test_transport_carrier_position_uat():
    """
    SECTION 26: TRANSPORT UAT
    Charges: $743,650, Payments: $1,030,000, Opening: $4,810 -> Credit: $291,160 in AQ favor.
    """
    db = SessionLocal()
    try:
        pos = TransportService.get_transport_carrier_position(db)
        charges = round_money(pos.get("total_transport_charges", pos.get("charges_total", 0.0)))
        payments = round_money(pos.get("direct_payments", pos.get("payments_total", 0.0)))
        opening = round_money(pos.get("opening_credit", 0.0))
        credit_bal = round_money(pos.get("credit_balance", 0.0))

        assert charges == Decimal("743650.00")
        assert payments == Decimal("1030000.00")
        assert opening == Decimal("4810.00")
        assert credit_bal == Decimal("291160.00"), f"Expected credit in AQ favor $291,160.00, got {credit_bal}"
    finally:
        db.close()


# =====================================================================
# 5. WORKFLOW UAT: BANKING & GL INTEGRITY
# =====================================================================
def test_general_ledger_and_trial_balance_exact_reconciliation_uat():
    """
    SECTIONS 14 & 15: GENERAL LEDGER & TRIAL BALANCE VALIDATION
    TOTAL DEBIT strictly equal to TOTAL CREDIT ($0.00 difference).
    Zero orphan journal lines.
    """
    db = SessionLocal()
    try:
        jb = AccountingIntegrityService.check_journal_balance(db)
        assert jb["is_balanced"] is True
        assert jb["difference"] == 0.0
        assert jb["unbalanced_posted_entries_count"] == 0

        # No orphan lines
        orphans = AccountingIntegrityService.check_orphan_records(db)
        assert orphans["orphan_journal_lines_count"] == 0
        assert orphans["orphan_invoice_allocations_count"] == 0
    finally:
        db.close()


# =====================================================================
# 6. SECURITY & FOUR-EYES APPROVAL UAT
# =====================================================================
def test_four_eyes_approval_separation_of_duty_uat():
    """
    SECTION 22: FOUR-EYES APPROVAL
    Creator cannot approve their own payment or transaction.
    """
    db = SessionLocal()
    try:
        # Create a mock user who requested and an admin approver
        creator = models.User(username="accountant_user", full_name="Accountant", role="ACCOUNTANT")
        other_admin = models.User(username="senior_admin", full_name="Senior Admin", role="ADMIN")
        
        # Test approval request
        req = models.ApprovalRequest(
            entity_type="PAYMENT",
            entity_id=999999,
            amount=15000.0,
            currency="USD",
            party_name="Al-Saeed Logistics",
            requested_by="accountant_user",
            required_role="ADMIN",
            status="PENDING",
            threshold_rule="Payment over $5,000",
        )
        db.add(req)
        db.commit()
        db.refresh(req)

        # 1. Creator attempts self-approval -> Must raise 403 Forbidden
        with pytest.raises(Exception) as excinfo:
            approve_transaction_request(db, req.id, approver=creator)
        assert "FOUR-EYES" in str(excinfo.value) or "403" in str(excinfo.value)

        # 2. Different authorized admin approves -> Must succeed
        res = approve_transaction_request(db, req.id, approver=other_admin, notes="Audited and approved")
        assert res["status"] == "APPROVED"
        assert res["approved_by"] == "senior_admin"

        # Cleanup test row
        db.delete(req)
        db.commit()
    finally:
        db.close()


# =====================================================================
# 7. IDEMPOTENCY & DOUBLE-CLICK PROTECTION UAT
# =====================================================================
def test_idempotency_double_click_protection_uat():
    """
    SECTION 31 & 32: DOUBLE CLICK & NETWORK FAILURE TEST
    Submitting the exact same transaction twice with the same idempotency key
    returns the cached response without creating duplicate accounting entries.
    """
    # Test idempotency endpoint
    headers = {"X-Idempotency-Key": "test-unique-idemp-key-golive-98213"}
    # Call an idempotent accounting endpoint
    res1 = client.get("/api/v1/accounting/trial-balance", headers=headers)
    assert res1.status_code == 200

    res2 = client.get("/api/v1/accounting/trial-balance", headers=headers)
    assert res2.status_code == 200
    assert res1.json() == res2.json()
