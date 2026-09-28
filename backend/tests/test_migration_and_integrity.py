"""
AQ COMPANIES - Automated Migration & Accounting Integrity Verification Suite
Ensures strict adherence to core business rules:
1. Unknown purchase costs must be NULL, never zero.
2. Selling rates must be strictly separate from purchase rates.
3. Sky Ariana Limited carrier balance must reconcile to -$291,160.00 (credit in AQ Companies' favor).
4. Customer receivables must total $4,386,655.66.
5. Unpriced shipments must preserve NULL for rate and invoice value.
6. New stock pipeline must reflect 4 containers ($291,670.30 proforma value).
"""

from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app import models

client = TestClient(app)


def test_unknown_purchase_costs_are_strictly_null():
    """Verify that purchase costs and rates for uncosted shipments are strictly None / NULL."""
    db = SessionLocal()
    try:
        # Query shipments that were migrated without procurement bills
        shipments = db.query(models.Shipment).filter(models.Shipment.purchase_cost == None).all()
        assert len(shipments) >= 50, f"Expected at least 50 shipments with NULL purchase cost, found {len(shipments)}"

        for s in shipments:
            assert s.purchase_cost is None, f"Shipment {s.shipment_code} purchase_cost should be None, found {s.purchase_cost}"
            assert s.purchase_rate is None, f"Shipment {s.shipment_code} purchase_rate should be None, found {s.purchase_rate}"
            assert s.net_profit is None, f"Shipment {s.shipment_code} net_profit should be None, found {s.net_profit}"

        # Verify in purchases table as well
        purchases = db.query(models.Purchase).filter(models.Purchase.purchase_amount == None).all()
        assert len(purchases) >= 50, f"Expected purchases with NULL amount, found {len(purchases)}"
        for p in purchases:
            assert p.purchase_rate is None
            assert p.purchase_amount is None
    finally:
        db.close()


def test_selling_rates_are_separate_from_purchase_rates():
    """Verify that selling rates are populated while purchase rates remain decoupled and NULL."""
    db = SessionLocal()
    try:
        # Priced shipments should have positive selling rate and NULL purchase rate
        sample_priced = db.query(models.Shipment).filter(
            models.Shipment.rate_per_kg != None,
            models.Shipment.rate_per_kg > Decimal("0.0000")
        ).all()
        assert len(sample_priced) >= 50, "Priced shipments should exist"

        for s in sample_priced:
            assert s.rate_per_kg is not None and s.rate_per_kg > 0
            assert s.purchase_rate is None
            assert s.invoice_value is not None and s.invoice_value > 0
            assert s.purchase_cost is None
    finally:
        db.close()


def test_carrier_ledger_reconciliation_exact():
    """Verify that Sky Ariana carrier ledger reconciles to exact -$291,160.00 credit balance."""
    res = client.get("/api/transport-companies/1/ledger")
    assert res.status_code == 200, f"Failed: {res.text}"
    data = res.json()
    summary = data["summary"]

    assert summary["total_transport_charges"] == 743650.0, f"Expected charges 743,650.0, got {summary['total_transport_charges']}"
    assert summary["total_paid"] == 1034810.0, f"Expected credits 1,034,810.0, got {summary['total_paid']}"
    assert summary["outstanding_balance"] == 0.0
    assert summary["credit_balance"] == 291160.0
    assert summary["has_credit_with_transport_company"] is True
    assert "291,160.00" in summary["credit_display"]


def test_customer_receivables_total():
    """Verify customer receivables match audited figure of $4,386,655.66."""
    res = client.get("/api/dashboard/kpis?filter=all")
    assert res.status_code == 200, f"Failed: {res.text}"
    kpis = res.json()["kpis"]

    assert kpis["total_sales"] == 4386655.66
    assert kpis["customer_receivable"] == 4386655.66
    assert kpis["customer_money_received"] == 0.0


def test_unpriced_shipments_remain_null():
    """Verify that the 6 unpriced shipments have NULL for rate and invoice value."""
    unpriced_invoices = ["INV-092", "INV-093", "INV-122", "INV-126", "INV-158", "INV-164"]
    db = SessionLocal()
    try:
        for inv_no in unpriced_invoices:
            s = db.query(models.Shipment).filter(models.Shipment.invoice_number == inv_no).first()
            assert s is not None, f"Shipment {inv_no} should exist"
            assert s.rate_per_kg is None, f"{inv_no} rate_per_kg should be None"
            assert s.invoice_value is None, f"{inv_no} invoice_value should be None"
            assert s.customer_balance is None, f"{inv_no} customer_balance should be None"
    finally:
        db.close()


def test_new_stock_pipeline_containers():
    """Verify that all 4 new stock pipeline containers exist with correct proforma values."""
    res = client.get("/api/new-stock")
    assert res.status_code == 200
    stocks = res.json()
    assert len(stocks) == 4

    total_proforma = sum(float(s["selling_value"] or s["proforma_value"] or 0) for s in stocks)
    assert round(total_proforma, 2) == 291670.30

    codes = [s["stock_code"] for s in stocks]
    for expected in ["NEW-STOCK-NEW-001", "NEW-STOCK-NEW-002", "NEW-STOCK-NEW-003", "NEW-STOCK-NEW-004"]:
        assert any(expected in c for c in codes), f"Missing {expected}"
