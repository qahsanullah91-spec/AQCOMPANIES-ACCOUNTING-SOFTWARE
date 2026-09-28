import time
import pytest
from decimal import Decimal
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy import func

from app.main import app
from app.database import get_db
from app import models, schemas
from app.services.currency.currency_service import RoundingPolicy, CurrencyService
from app.services.common.transaction_service import TransactionService, atomic_transaction
from app.services.common.idempotency_service import IdempotencyService
from app.services.jobs.job_service import JobService
from app.core.exceptions import (
    OptimisticLockError,
    ValidationError,
    PermissionDeniedError,
)

client = TestClient(app)


def test_decimal_rounding_policy_precision():
    """Validates exact Decimal precision and ROUND_HALF_UP policies across the system."""
    # Money: 2 decimals, ROUND_HALF_UP
    assert RoundingPolicy.round_money(Decimal("100.555")) == Decimal("100.56")
    assert RoundingPolicy.round_money(Decimal("100.554")) == Decimal("100.55")
    assert RoundingPolicy.round_money(Decimal("0.0001")) == Decimal("0.00")

    # Rates: 4 decimals
    assert RoundingPolicy.round_rate(Decimal("3.67254")) == Decimal("3.6725")
    assert RoundingPolicy.round_rate(Decimal("3.67256")) == Decimal("3.6726")

    # Weights: 3 decimals
    assert RoundingPolicy.round_weight(Decimal("1234.5678")) == Decimal("1234.568")

    # FX conversion
    base_usd = CurrencyService.convert_to_base(Decimal("1000.00"), currency="AED", fx_rate=Decimal("0.2723"))
    assert base_usd == Decimal("272.30")


def test_optimistic_concurrency_locking():
    """
    Verifies that simultaneous updates detect stale version numbers and reject concurrent overwrites.
    """
    db = next(get_db())
    try:
        # Create a test customer and invoice
        cust = models.Customer(
            customer_name=f"Concurrency Cust {int(time.time()*1000)}",
            company_id=1,
        )
        db.add(cust)
        db.flush()

        inv = models.Invoice(
            company_id=1,
            invoice_number=f"INV-TEST-CONC-{int(time.time()*1000)}",
            date=date.today(),
            customer_id=cust.id,
            total_amount=Decimal("5000.00"),
            amount_received=Decimal("0.00"),
            balance_due=Decimal("5000.00"),
            payment_status="UNPAID",
            version_id=1,
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)

        # Simulating check_optimistic_lock
        # 1. Matching version succeeds
        TransactionService.check_optimistic_lock(inv, expected_version=1, entity_name="Invoice")

        # 2. Increment version (simulating concurrent writer A)
        inv.version_id = 2
        db.commit()
        db.refresh(inv)

        # 3. Writer B with stale version 1 must raise OptimisticLockError
        with pytest.raises(OptimisticLockError) as exc_info:
            TransactionService.check_optimistic_lock(inv, expected_version=1, entity_name="Invoice")
        assert "CONFLICT" in str(exc_info.value.message)
    finally:
        db.close()


def test_idempotency_caching_and_replay():
    """
    Verifies that re-submitting a customer receipt with the same Idempotency-Key
    replays the cached response without creating duplicate bank transactions or ledger lines.
    """
    db = next(get_db())
    try:
        # Ensure we have a bank account and customer
        bank_acc = db.query(models.BankAccount).first()
        if not bank_acc:
            bank_acc = models.BankAccount(
                company_id=1,
                bank_name="Test Treasury Bank",
                account_number="ACC-TEST-001",
                currency="USD",
                running_balance=Decimal("100000.00"),
            )
            db.add(bank_acc)
            db.flush()

        cust = db.query(models.Customer).first()
        if not cust:
            cust = models.Customer(customer_name="Test Idemp Customer", company_id=1)
            db.add(cust)
            db.flush()

        inv = models.Invoice(
            company_id=1,
            invoice_number=f"INV-IDEMP-{int(time.time()*1000)}",
            date=date.today(),
            customer_id=cust.id,
            total_amount=Decimal("1200.00"),
            amount_received=Decimal("0.00"),
            balance_due=Decimal("1200.00"),
            payment_status="UNPAID",
            version_id=1,
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)

        idemp_key = f"IDEMP-KEY-{int(time.time() * 1000)}"
        payload = {
            "company_id": 1,
            "customer_id": cust.id,
            "bank_account_id": bank_acc.id,
            "receipt_amount": 500.00,
            "receipt_date": date.today().isoformat(),
            "allocations": [
                {"invoice_id": inv.id, "amount": 500.00}
            ],
            "voucher_number": f"VOUCH-{idemp_key}",
            "reference": "Idempotency Test Payment",
        }

        # First request
        resp1 = client.post(
            "/api/v1/receivables/customer-receipts",
            json=payload,
            headers={"Idempotency-Key": idemp_key},
        )
        assert resp1.status_code == 200, resp1.text
        data1 = resp1.json()
        assert data1["success"] is True
        bank_tx_id = data1["bank_transaction_id"]

        # Count bank transactions
        tx_count_1 = db.query(models.BankTransaction).filter(models.BankTransaction.id == bank_tx_id).count()
        assert tx_count_1 == 1

        # Second request with SAME Idempotency-Key
        resp2 = client.post(
            "/api/v1/receivables/customer-receipts",
            json=payload,
            headers={"Idempotency-Key": idemp_key},
        )
        assert resp2.status_code == 200
        data2 = resp2.json()
        # Verifying exact replay
        assert data2["bank_transaction_id"] == bank_tx_id
        assert data2["amount_received"] == 500.00

        # Verify NO duplicate bank transaction was created
        tx_count_2 = db.query(models.BankTransaction).filter(
            models.BankTransaction.transaction_code == data1["transaction_code"]
        ).count()
        assert tx_count_2 == 1

        # Third request with SAME key but DIFFERENT payload should be rejected with 422
        bad_payload = dict(payload)
        bad_payload["receipt_amount"] = 999.00
        resp3 = client.post(
            "/api/v1/receivables/customer-receipts",
            json=bad_payload,
            headers={"Idempotency-Key": idemp_key},
        )
        assert resp3.status_code == 422
        assert "IDEMPOTENCY_PAYLOAD_MISMATCH" in resp3.text

    finally:
        db.close()


def test_atomic_rollback_on_failure():
    """
    Verifies that when an allocation fails or exceeds balance,
    the entire transaction is rolled back cleanly with zero orphaned records.
    """
    db = next(get_db())
    try:
        bank_acc = db.query(models.BankAccount).first()
        cust = db.query(models.Customer).first()
        inv = models.Invoice(
            company_id=1,
            invoice_number=f"INV-ROLLBACK-{int(time.time()*1000)}",
            date=date.today(),
            customer_id=cust.id,
            total_amount=Decimal("100.00"),
            amount_received=Decimal("0.00"),
            balance_due=Decimal("100.00"),
            payment_status="UNPAID",
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)

        unique_ref = f"REF-ROLLBACK-TEST-{int(time.time()*1000)}"

        # Attempt to allocate $500 to a $100 invoice (exceeds balance)
        with pytest.raises(ValidationError):
            TransactionService.execute_customer_receipt_atomic(
                db=db,
                company_id=1,
                customer_id=cust.id,
                bank_account_id=bank_acc.id,
                receipt_amount=Decimal("500.00"),
                receipt_date=date.today(),
                allocations_data=[{"invoice_id": inv.id, "amount": Decimal("500.00")}],
                reference=unique_ref,
            )

        # Verify that no bank transaction was committed with this reference
        btx = db.query(models.BankTransaction).filter(
            models.BankTransaction.transaction_reference == unique_ref
        ).first()
        assert btx is None

        # Verify that invoice balance was unchanged
        db.refresh(inv)
        assert inv.balance_due == Decimal("100.00")
        assert inv.amount_received == Decimal("0.00")

    finally:
        db.close()


def test_multi_company_object_level_authorization():
    """
    Verifies that an accountant assigned to company 2 cannot read or write records of company 1.
    """
    db = next(get_db())
    try:
        # Find an invoice belonging to company 1
        inv1 = db.query(models.Invoice).filter(models.Invoice.company_id == 1).first()
        if inv1:
            # Request as user restricted to Company 2
            resp = client.get(
                f"/api/v1/receivables/invoices/{inv1.id}",
                headers={"X-User-Role": "ACCOUNTANT", "X-Company-Id": "2"},
            )
            assert resp.status_code == 403
            assert "COMPANY_ACCESS_DENIED" in resp.text

            # Super admin or Admin should be granted access
            admin_resp = client.get(
                f"/api/v1/receivables/invoices/{inv1.id}",
                headers={"X-User-Role": "ADMIN", "X-Company-Id": "2"},
            )
            assert admin_resp.status_code == 200
            data = admin_resp.json()
            assert data["id"] == inv1.id
    finally:
        db.close()


def test_background_jobs_lifecycle():
    """
    Verifies asynchronous task dispatch, polling, and status tracking via API.
    """
    def sample_task(worker_db, j_id):
        return {"records_processed": 42, "status": "COMPLETED"}

    job_id = JobService.dispatch(
        job_type="DATA_AUDIT_REPORT",
        task_func=sample_task,
        created_by="AutomatedTest",
    )
    assert job_id.startswith("JOB-")

    # Give worker a brief moment to finish
    time.sleep(0.5)

    resp = client.get(f"/api/v1/jobs/{job_id}")
    assert resp.status_code == 200
    job_data = resp.json()
    assert job_data["job_id"] == job_id
    assert job_data["status"] in ("RUNNING", "SUCCESS")
    if job_data["status"] == "SUCCESS":
        assert job_data["result"]["records_processed"] == 42


def test_production_baseline_financial_integrity():
    """
    Verifies that core business financial truths remain exact:
    - Total sales equals $4,386,655.66
    - Sky Ariana carrier credit is -$291,160.00
    - NULL purchase costs are strictly preserved for uncosted shipments
    """
    db = next(get_db())
    try:
        # 1. Total sales baseline (measuring true production invoices, excluding transient test items)
        sales_sum = db.query(func.sum(models.Invoice.total_amount)).filter(
            ~models.Invoice.invoice_number.ilike("%TEST%"),
            ~models.Invoice.invoice_number.ilike("%IDEMP%"),
            ~models.Invoice.invoice_number.ilike("%ROLLBACK%"),
        ).scalar()
        if sales_sum is not None:
            sales_dec = RoundingPolicy.round_money(Decimal(str(sales_sum)))
            assert sales_dec == Decimal("4386655.66"), f"Expected sales $4,386,655.66, got {sales_dec}"

        # 2. Sky Ariana Carrier Credit
        sky_carrier = db.query(models.Supplier).filter(
            models.Supplier.supplier_name.ilike("%Sky Ariana%")
        ).first()
        if sky_carrier:
            # Query carrier balance
            from app.services.payables.payable_service import PayableService
            ledger = PayableService.get_supplier_statement(db, sky_carrier.id)
            closing_bal = RoundingPolicy.round_money(Decimal(str(ledger.get("closing_balance", 0))))
            assert closing_bal == Decimal("-291160.00"), f"Expected carrier credit -$291,160.00, got {closing_bal}"

        # 3. NULL purchase cost preservation
        uncosted = db.query(models.Shipment).filter(
            models.Shipment.purchase_cost.is_(None)
        ).count()
        assert uncosted > 0, "Expected shipments with NULL purchase costs to remain uncosted"

    finally:
        db.close()
