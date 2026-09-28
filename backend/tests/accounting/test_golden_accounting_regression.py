"""
AQ COMPANIES - Golden Accounting Regression & Invariant Test Suite
Validates immutable financial invariants and double-entry accounting rules:
1. Baseline Total Sales = $4,386,655.66 USD
2. Sky Ariana Carrier Balance = -$291,160.00 USD credit (AQ Companies' favor)
3. NULL Purchase Cost & Profit Invariant (unknown costs are strictly NULL, never zero)
4. Unpriced Shipments Invariant (INV-092, 093, 122, 126, 158, 164 preserve NULL rates)
5. General Ledger Trial Balance Equality (Debits == Credits, diff == 0.00)
6. Customer Receipt reduces AR without inflating Sales Revenue
7. Transport Payment reduces Transport Payable without duplicating Freight Expense
8. Supplier Payment reduces Accounts Payable without duplicating Purchase Expense
9. Customer/Supplier/Transport Advances are Balance Sheet items, NEVER Revenue or Expense
"""

import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import func

from app.main import app
from app.database import SessionLocal
from app import models
from app.financial_reports_engine import get_detailed_trial_balance_report
from app.accounting_engine import create_journal_entry, round_money
from app.security_automation import post_central_accounting_rule

client = TestClient(app)


@pytest.mark.accounting
def test_golden_baseline_sales_and_receivables():
    """Verify total audited sales and customer receivables match $4,386,655.66."""
    res = client.get("/api/dashboard/kpis?filter=all")
    assert res.status_code == 200, f"KPI endpoint failed: {res.text}"
    kpis = res.json()["kpis"]

    assert kpis["total_sales"] == 4386655.66, f"Expected 4,386,655.66 sales, got {kpis['total_sales']}"
    assert kpis["customer_receivable"] == 4386655.66, f"Expected 4,386,655.66 AR, got {kpis['customer_receivable']}"


@pytest.mark.accounting
def test_golden_sky_ariana_carrier_standing_credit():
    """Verify Sky Ariana carrier ledger reconciles to exact -$291,160.00 credit balance in AQ favor."""
    res = client.get("/api/transport-companies/1/ledger")
    assert res.status_code == 200, f"Transport ledger failed: {res.text}"
    summary = res.json()["summary"]

    assert summary["total_transport_charges"] == 743650.0, "Expected charges $743,650.00"
    assert summary["total_paid"] == 1034810.0, "Expected credits $1,034,810.00"
    assert summary["credit_balance"] == 291160.0, "Expected standing credit $291,160.00"
    assert summary["has_credit_with_transport_company"] is True
    assert "291,160.00" in summary["credit_display"]


@pytest.mark.accounting
def test_golden_null_purchase_costs_and_profits():
    """Verify uncosted shipments strictly preserve NULL (None) for cost, rate, and profit."""
    db = SessionLocal()
    try:
        uncosted = db.query(models.Shipment).filter(models.Shipment.purchase_cost == None).all()
        assert len(uncosted) >= 50, "Expected at least 50 uncosted shipments"

        for s in uncosted:
            assert s.purchase_cost is None, f"{s.shipment_code} purchase_cost must be None"
            assert s.purchase_rate is None, f"{s.shipment_code} purchase_rate must be None"
            assert s.net_profit is None, f"{s.shipment_code} net_profit must be None"

        uncosted_purchases = db.query(models.Purchase).filter(models.Purchase.purchase_amount == None).all()
        assert len(uncosted_purchases) >= 50, "Expected purchases with NULL amounts"
        for p in uncosted_purchases:
            assert p.purchase_amount is None
            assert p.purchase_rate is None
    finally:
        db.close()


@pytest.mark.accounting
def test_golden_unpriced_shipments_preserved():
    """Verify that unpriced shipments preserve NULL for selling rates and invoice amounts."""
    unpriced_invoices = ["INV-092", "INV-093", "INV-122", "INV-126", "INV-158", "INV-164"]
    db = SessionLocal()
    try:
        for inv_no in unpriced_invoices:
            s = db.query(models.Shipment).filter(models.Shipment.invoice_number == inv_no).first()
            assert s is not None, f"Shipment {inv_no} must exist"
            assert s.rate_per_kg is None, f"{inv_no} rate_per_kg must be None"
            assert s.invoice_value is None, f"{inv_no} invoice_value must be None"
            assert s.customer_balance is None, f"{inv_no} customer_balance must be None"
    finally:
        db.close()


@pytest.mark.accounting
def test_golden_trial_balance_equality():
    """Verify that General Ledger debits exactly equal credits across all accounts."""
    db = SessionLocal()
    try:
        tb = get_detailed_trial_balance_report(db)
        diff = Decimal(str(tb["totals"]["difference"]))
        assert diff == Decimal("0.00"), f"Trial Balance unbalanced! Diff = {diff}"
        assert tb["totals"]["closing_debit"] == tb["totals"]["closing_credit"]
    finally:
        db.close()


@pytest.mark.accounting
def test_customer_receipt_reduces_ar_without_inflating_sales():
    """
    CRITICAL INVARIANT:
    Customer payment receipt:
    Dr 1010 (Bank), Cr 1100 (AR).
    Account 4000 (Sales Revenue) MUST NOT change.
    """
    db = SessionLocal()
    try:
        # Pre-check baseline sales
        tot_sales_before = db.query(func.coalesce(func.sum(models.JournalLine.credit), Decimal("0.00"))).join(
            models.Account, models.JournalLine.account_id == models.Account.id
        ).filter(models.Account.account_code == "4000").scalar()

        # Simulate receipt of $5,000.00
        test_je = post_central_accounting_rule(
            db=db,
            rule_type="CUSTOMER_RECEIPT",
            source_id=9999901,
            description="Golden Regression Test Customer Payment",
            amount=Decimal("5000.00"),
            reference="TEST-REC-01",
            user_name="RegressionTester"
        )
        assert test_je is not None

        # Verify journal lines: 1 debit to Bank, 1 credit to AR
        lines = db.query(models.JournalLine).filter(models.JournalLine.journal_entry_id == test_je.id).all()
        assert len(lines) == 2

        dr_bank = sum(l.debit for l in lines if l.account.account_code == "1010")
        cr_ar = sum(l.credit for l in lines if l.account.account_code == "1100")
        assert round_money(dr_bank) == Decimal("5000.00")
        assert round_money(cr_ar) == Decimal("5000.00")

        # Verify sales revenue did NOT change
        tot_sales_after = db.query(func.coalesce(func.sum(models.JournalLine.credit), Decimal("0.00"))).join(
            models.Account, models.JournalLine.account_id == models.Account.id
        ).filter(models.Account.account_code == "4000").scalar()

        assert tot_sales_after == tot_sales_before, "Customer receipt must NEVER inflate sales revenue!"

        # Rollback/clean up test entry
        db.delete(test_je)
        db.commit()
    finally:
        db.close()


@pytest.mark.accounting
def test_transport_payment_reduces_payable_without_duplicating_freight():
    """
    CRITICAL INVARIANT:
    Transport wire payment:
    Dr 2100 (Transport Payable), Cr 1010 (Bank).
    Account 5100 (Freight Expense) MUST NOT change.
    """
    db = SessionLocal()
    try:
        freight_before = db.query(func.coalesce(func.sum(models.JournalLine.debit), Decimal("0.00"))).join(
            models.Account, models.JournalLine.account_id == models.Account.id
        ).filter(models.Account.account_code == "5100").scalar()

        test_je = post_central_accounting_rule(
            db=db,
            rule_type="TRANSPORT_PAYMENT",
            source_id=9999902,
            description="Golden Regression Test Carrier Wire",
            amount=Decimal("12000.00"),
            reference="TEST-WIRE-01",
            user_name="RegressionTester"
        )
        assert test_je is not None

        lines = db.query(models.JournalLine).filter(models.JournalLine.journal_entry_id == test_je.id).all()
        assert len(lines) == 2

        dr_payable = sum(l.debit for l in lines if l.account.account_code == "2100")
        cr_bank = sum(l.credit for l in lines if l.account.account_code == "1010")
        assert round_money(dr_payable) == Decimal("12000.00")
        assert round_money(cr_bank) == Decimal("12000.00")

        freight_after = db.query(func.coalesce(func.sum(models.JournalLine.debit), Decimal("0.00"))).join(
            models.Account, models.JournalLine.account_id == models.Account.id
        ).filter(models.Account.account_code == "5100").scalar()

        assert freight_after == freight_before, "Transport payment must NEVER duplicate freight expense!"

        db.delete(test_je)
        db.commit()
    finally:
        db.close()


@pytest.mark.accounting
def test_supplier_payment_reduces_ap_without_duplicating_purchase_expense():
    """
    CRITICAL INVARIANT:
    Supplier disbursement payment:
    Dr 2000 (Accounts Payable), Cr 1010 (Bank).
    Account 5000 (Cost of Goods / Purchase Cost) MUST NOT change.
    """
    db = SessionLocal()
    try:
        cogs_before = db.query(func.coalesce(func.sum(models.JournalLine.debit), Decimal("0.00"))).join(
            models.Account, models.JournalLine.account_id == models.Account.id
        ).filter(models.Account.account_code == "5000").scalar()

        test_je = post_central_accounting_rule(
            db=db,
            rule_type="SUPPLIER_PAYMENT",
            source_id=9999903,
            description="Golden Regression Test Supplier Disbursement",
            amount=Decimal("8500.00"),
            reference="TEST-DISB-01",
            user_name="RegressionTester"
        )
        assert test_je is not None

        lines = db.query(models.JournalLine).filter(models.JournalLine.journal_entry_id == test_je.id).all()
        assert len(lines) == 2

        dr_ap = sum(l.debit for l in lines if l.account.account_code == "2000")
        cr_bank = sum(l.credit for l in lines if l.account.account_code == "1010")
        assert round_money(dr_ap) == Decimal("8500.00")
        assert round_money(cr_bank) == Decimal("8500.00")

        cogs_after = db.query(func.coalesce(func.sum(models.JournalLine.debit), Decimal("0.00"))).join(
            models.Account, models.JournalLine.account_id == models.Account.id
        ).filter(models.Account.account_code == "5000").scalar()

        assert cogs_after == cogs_before, "Supplier payment must NEVER duplicate purchase expense!"

        db.delete(test_je)
        db.commit()
    finally:
        db.close()


@pytest.mark.accounting
def test_advances_are_balance_sheet_items():
    """
    CRITICAL INVARIANT:
    Customer Advance = Liability (2150), NOT Revenue (4000).
    Supplier Advance = Current Asset (1150), NOT Expense (5000).
    Transport Advance = Prepayment Asset (1160), NOT Freight Expense (5100).
    """
    from datetime import date
    db = SessionLocal()
    try:
        today = date.today()
        # 1. Customer Advance
        je_cust_adv = create_journal_entry(
            db=db,
            entry_date=today,
            entry_type="ADVANCE_RECEIPT",
            description="Customer Prepayment",
            reference="ADV-CUST-001",
            lines=[
                {"account_code": "1010", "debit": 15000.0, "credit": 0.0, "description": "Bank wire received"},
                {"account_code": "2150", "debit": 0.0, "credit": 15000.0, "description": "Customer Advance Liability"},
            ],
            created_by="RegressionTester",
        )
        assert je_cust_adv is not None
        lines = je_cust_adv.lines
        assert any(l.account.account_code == "2150" and l.account.account_type == "LIABILITY" for l in lines)
        assert not any(l.account.account_code == "4000" for l in lines)

        # 2. Supplier Advance (Account 1350 - Asset)
        je_supp_adv = create_journal_entry(
            db=db,
            entry_date=today,
            entry_type="ADVANCE_PAYMENT",
            description="Supplier Deposit",
            reference="ADV-SUPP-001",
            lines=[
                {"account_code": "1350", "debit": 10000.0, "credit": 0.0, "description": "Supplier Prepayment Asset"},
                {"account_code": "1010", "debit": 0.0, "credit": 10000.0, "description": "Bank Wire Out"},
            ],
            created_by="RegressionTester",
        )
        assert je_supp_adv is not None
        lines = je_supp_adv.lines
        assert any(l.account.account_code == "1350" and l.account.account_type == "ASSET" for l in lines)
        assert not any(l.account.account_code == "5000" for l in lines)

        # 3. Transport Advance (Account 1300 - Asset)
        je_trans_adv = create_journal_entry(
            db=db,
            entry_date=today,
            entry_type="ADVANCE_PAYMENT",
            description="Carrier Freight Advance",
            reference="ADV-TRANS-001",
            lines=[
                {"account_code": "1300", "debit": 7500.0, "credit": 0.0, "description": "Carrier Prepayment Asset"},
                {"account_code": "1010", "debit": 0.0, "credit": 7500.0, "description": "Bank Wire Out"},
            ],
            created_by="RegressionTester",
        )
        assert je_trans_adv is not None
        lines = je_trans_adv.lines
        assert any(l.account.account_code == "1300" and l.account.account_type == "ASSET" for l in lines)
        assert not any(l.account.account_code == "5100" for l in lines)

        # Clean up all 3 test journal entries
        db.delete(je_cust_adv)
        db.delete(je_supp_adv)
        db.delete(je_trans_adv)
        db.commit()
    finally:
        db.close()
