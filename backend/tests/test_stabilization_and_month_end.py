"""
AQ COMPANIES — Post-Go-Live Stabilization & Month-End Readiness Automated Test Suite

Covers:
1. Stabilization Dashboard & Live Telemetry
2. Daily Operational Reviews (Banking, Receivables, Payables, Transport, Anomaly Scanner)
3. Strict Missing Purchase Costs Disclosures (63 shipments with NULL purchase cost)
4. Profit Readiness & Segregated Margin Disclosures
5. Month-End Accounting Readiness & Report Package Checks
6. 7-Point Stabilization Exit Gate Evaluation
7. Support Ticket Submission, Auto-Backlog Segregation for Feature Requests, and Resolution
8. Error Buffer Logging, Filtering, and Admin Resolution
"""
import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal
from app import models
from app.core.logging import record_system_error, get_system_errors, resolve_system_error
from app.services.stabilization.stabilization_service import StabilizationService

client = TestClient(app)


# =====================================================================
# 1. STABILIZATION DASHBOARD & LIVE TELEMETRY
# =====================================================================
def test_stabilization_dashboard_endpoint():
    """Tests /api/v1/stabilization/dashboard and validates GL invariant & telemetry."""
    response = client.get("/api/v1/stabilization/dashboard")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()

    assert data["mode"] == "POST_GO_LIVE_STABILIZATION"
    assert "P0" in data["change_freeze_policy"]
    assert "exit_gate" in data

    # GL Balance Invariant: Difference MUST be 0.00
    gl = data["gl_balance"]
    assert gl["is_balanced"] is True
    assert gl["difference"] == 0.0
    assert gl["formatted_diff"] == "$0.00"

    # Backup & WAL Status
    assert "backup_freshness" in data
    assert data["wal_status"]["mode"] in ["wal", "WAL Mode Active", "WAL"]

    # System Resources
    res = data["system_resources"]
    assert "cpu_percent" in res
    assert "memory_percent" in res
    assert "disk_free_gb" in res

    # Missing purchase costs strictly tracked
    assert data["missing_purchase_costs"] == 63


def test_stabilization_dashboard_backwards_compatible_mount():
    """Tests /api/stabilization/dashboard directly mounted under /api."""
    response = client.get("/api/stabilization/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert data["gl_balance"]["is_balanced"] is True


# =====================================================================
# 2. DAILY OPERATIONAL REVIEWS & ANOMALY SCANNER
# =====================================================================
def test_daily_operational_reviews():
    """Validates daily reviews for Banking, Receivables, Payables, Transport and Anomaly Scanner."""
    response = client.get("/api/v1/stabilization/daily-review")
    assert response.status_code == 200
    data = response.json()

    # Banking Review
    banking = data["banking_review"]
    assert "bank_accounts_count" in banking["metrics"]
    assert "total_bank_balance" in banking["metrics"]
    assert banking["status"] in ["NORMAL", "ACTION_REQUIRED"]

    # Receivables Review
    receivables = data["receivables_review"]
    assert "total_receivables" in receivables["metrics"]
    assert receivables["metrics"]["verified_receipts_baseline"] == 0.0
    assert receivables["status"] in ["NORMAL", "ACTION_REQUIRED"]

    # Payables Review
    payables = data["payables_review"]
    assert "total_payables" in payables["metrics"]
    assert payables["metrics"]["missing_cost_shipments"] == 63

    # Transport Review — Standing Credit in AQ Companies Favor: $291,160.00
    transport = data["transport_review"]
    assert Decimal(str(transport["metrics"]["transport_account_balance"])) == Decimal("291160.00")
    assert transport["metrics"]["interpretation"] == "CREDIT IN AQ FAVOR"
    assert transport["status"] == "NORMAL"

    # Deterministic Anomaly Scanner
    scanner = data["anomaly_scanner"]
    assert scanner["status"] == "CLEAN"
    assert scanner["anomalies_found"] == 0
    assert any("Zero negative cash" in d for d in scanner["details"])
    assert any("General Ledger entries strictly balanced" in d for d in scanner["details"])
    assert any("NEW-003 converted stock excluded" in d for d in scanner["details"])


# =====================================================================
# 3. STRICT MISSING PURCHASE COSTS DISCLOSURE (63 SHIPMENTS)
# =====================================================================
def test_missing_purchase_costs_report():
    """Validates that exactly 63 unbilled shipments are disclosed with NULL purchase cost."""
    response = client.get("/api/v1/stabilization/missing-purchase-costs")
    assert response.status_code == 200
    data = response.json()

    assert data["total_missing_cost_shipments"] == 63
    assert len(data["items"]) == 63

    # Verify that EVERY item has purchase_amount == None and purchase_cost_display == "PENDING PURCHASE COST"
    for item in data["items"]:
        assert item["purchase_amount"] is None, f"Shipment {item['shipment_code']} must have NULL purchase amount!"
        assert item["purchase_cost_display"] == "PENDING PURCHASE COST"
        assert item["total_kg"] > 0
        assert item["sales_amount"] >= 0


# =====================================================================
# 4. PROFIT READINESS & SEGREGATED MARGIN DISCLOSURE
# =====================================================================
def test_profit_readiness_report():
    """Validates profit readiness report segregates verified vs pending sales revenue."""
    response = client.get("/api/v1/stabilization/profit-readiness")
    assert response.status_code == 200
    data = response.json()

    assert data["missing_cost_shipments_count"] == 63
    assert data["verified_gross_profit"] == data["verified_sales_revenue"] - data["verified_cogs"]
    assert data["unverified_sales_revenue"] > 0
    assert "PENDING PURCHASE COST" in data["disclosure"]


# =====================================================================
# 5. MONTH-END ACCOUNTING READINESS & REPORT PACKAGE
# =====================================================================
def test_month_end_readiness():
    """Validates month-end checklist and required financial report packages."""
    response = client.get("/api/v1/stabilization/month-end-readiness")
    assert response.status_code == 200
    data = response.json()

    checklist_map = {item["category"]: item for item in data["checklist"]}
    assert "VOUCHER_STATUS" in checklist_map
    assert checklist_map["VOUCHER_STATUS"]["status"] == "PASS"

    assert "GL_BALANCE" in checklist_map
    assert checklist_map["GL_BALANCE"]["status"] == "PASS"

    assert "MISSING_COST_DISCLOSURE" in checklist_map
    assert checklist_map["MISSING_COST_DISCLOSURE"]["status"] == "PASS"

    # Required Reports Package
    report_names = [rep["report_name"] for rep in data["required_reports_package"]]
    assert "General Ledger" in report_names
    assert "Trial Balance" in report_names
    assert "Balance Sheet" in report_names
    assert "Profit & Loss" in report_names
    assert "Accounts Receivable Aging" in report_names
    assert "Accounts Payable Aging" in report_names
    assert "Transport Carrier Account" in report_names


# =====================================================================
# 6. STABILIZATION EXIT CRITERIA
# =====================================================================
def test_stabilization_exit_criteria():
    """Validates the 7-point exit criteria evaluation."""
    response = client.get("/api/v1/stabilization/exit-criteria")
    assert response.status_code == 200
    data = response.json()

    assert len(data["criteria"]) == 7
    crit_map = {c["id"]: c for c in data["criteria"]}

    # GL balance must be met
    assert crit_map["crit_gl_balanced"]["met"] is True
    assert crit_map["crit_gl_balanced"]["criticality"] == "BLOCKER"

    # Missing costs disclosure must be met
    assert crit_map["crit_missing_costs_disclosed"]["met"] is True
    assert crit_map["crit_missing_costs_disclosed"]["criticality"] == "BLOCKER"


# =====================================================================
# 7. SUPPORT TICKETS, FEATURE BACKLOG SEGREGATION & RESOLUTION
# =====================================================================
def test_support_issues_and_feature_backlog_segregation():
    """Validates support ticket tracking and automatic segregation of feature requests."""
    # 1. Submit normal bug ticket
    bug_payload = {
        "user_name": "Accountant_1",
        "page": "/accounting/receivables",
        "description": "Customer filter debounce lag when searching fast",
        "priority": "P2",
        "category": "BUG",
        "transaction_number": "INV-01",
    }
    bug_res = client.post("/api/v1/stabilization/support-issues", json=bug_payload)
    assert bug_res.status_code == 200
    bug_data = bug_res.json()
    bug_id = bug_data["issue_id"]
    assert bug_data["status"] == "OPEN"
    assert bug_data["category"] == "BUG"

    # 2. Submit feature request -> MUST be segregated into BACKLOG
    feat_payload = {
        "user_name": "SalesDirector",
        "page": "/sales",
        "description": "Add 3D barcode scanning for container weigh-in receipts",
        "priority": "P3",
        "category": "FEATURE_REQUEST",
    }
    feat_res = client.post("/api/v1/stabilization/support-issues", json=feat_payload)
    assert feat_res.status_code == 200
    feat_data = feat_res.json()
    assert feat_data["status"] == "BACKLOG"
    assert "Segregated into Post-Stabilization Feature Backlog" in feat_data["resolution_notes"]

    # 3. Verify feature request appears in /api/v1/stabilization/feature-backlog
    backlog_res = client.get("/api/v1/stabilization/feature-backlog")
    assert backlog_res.status_code == 200
    backlog_items = backlog_res.json()
    assert any(it["issue_id"] == feat_data["issue_id"] for it in backlog_items)

    # 4. Resolve the bug ticket
    resolve_res = client.post(
        f"/api/v1/stabilization/support-issues/{bug_id}/resolve",
        json={"notes": "Debounce optimized to 300ms in hotfix patch."},
    )
    assert resolve_res.status_code == 200
    assert resolve_res.json()["status"] == "RESOLVED"

    # Verify bug is now resolved in support issues list
    issues_res = client.get("/api/v1/stabilization/support-issues")
    assert issues_res.status_code == 200
    resolved_bug = next(it for it in issues_res.json() if it["issue_id"] == bug_id)
    assert resolved_bug["status"] == "RESOLVED"
    assert resolved_bug["resolution_notes"] == "Debounce optimized to 300ms in hotfix patch."


# =====================================================================
# 8. ERROR BUFFER LOGGING, FILTERING & RESOLUTION
# =====================================================================
def test_error_buffer_recording_and_resolution():
    """Validates system error recording, severity filtering, and admin resolution."""
    # Record a test error
    test_error = record_system_error(
        source="Frontend",
        message="Simulated non-critical UI toast timeout",
        user_name="QA_Inspector",
        company_id=1,
        route="/accounting/bankbook",
        action="CLICK_REFRESH",
        severity="P2",
    )
    error_id = test_error["error_id"]

    # Fetch errors
    errors_res = client.get("/api/v1/stabilization/errors?severity=P2")
    assert errors_res.status_code == 200
    errors_list = errors_res.json()
    target = next((e for e in errors_list if e["error_id"] == error_id), None)
    assert target is not None
    assert target["resolved"] is False

    # Resolve error
    resolve_res = client.post(f"/api/v1/stabilization/errors/{error_id}/resolve")
    assert resolve_res.status_code == 200
    assert resolve_res.json()["status"] == "RESOLVED"

    # Verify error is resolved
    errors_res2 = client.get("/api/v1/stabilization/errors")
    resolved_target = next(e for e in errors_res2.json() if e["error_id"] == error_id)
    assert resolved_target["resolved"] is True
