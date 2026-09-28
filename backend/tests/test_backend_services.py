import pytest
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app import models
from app.core.exceptions import (
    UnbalancedJournalError,
    PeriodClosedError,
    ValidationError,
    AccountingError,
)
from app.services.accounting.posting_service import PostingService, round_money
from app.services.accounting.general_ledger_service import GeneralLedgerService
from app.services.accounting.reversal_service import ReversalService
from app.services.accounting.period_service import PeriodService
from app.services.receivables.receivable_service import ReceivableService
from app.services.payables.payable_service import PayableService
from app.services.transport.transport_service import TransportService
from app.services.banking.banking_service import BankingService
from app.services.treasury.treasury_service import TreasuryService
from app.services.backup.backup_service import BackupService
from app.services.import_export.data_import_service import DataImportService
from app.core.permissions import user_has_permission, require_permission, PermissionDeniedError
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token


@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    yield db
    db.close()


# =====================================================================
# 1. ACCOUNTING POSTING ENGINE & DOUBLE ENTRY
# =====================================================================

def test_unbalanced_journal_rejection(db_session: Session):
    """Verify that an unbalanced journal entry is strictly rejected with UnbalancedJournalError."""
    lines = [
        {"account_code": "1100", "debit": Decimal("1000.00"), "credit": Decimal("0.00")},
        {"account_code": "4000", "debit": Decimal("0.00"), "credit": Decimal("900.00")},  # Diff $100
    ]
    with pytest.raises(UnbalancedJournalError) as exc_info:
        PostingService.create_journal_entry(
            db=db_session,
            company_id=1,
            entry_date=date.today(),
            entry_type="MANUAL",
            description="Test Unbalanced Entry",
            lines=lines,
        )
    assert "DOUBLE-ENTRY VIOLATION" in str(exc_info.value.message)


def test_balanced_journal_creation_and_idempotency(db_session: Session):
    """Verify that balanced double-entry creates journal and second posting returns same journal idempotently."""
    key = f"IDEMPOTENCY-TEST-{date.today().isoformat()}"
    lines = [
        {"account_code": "1010", "debit": Decimal("250.00"), "credit": Decimal("0.00")},
        {"account_code": "3000", "debit": Decimal("0.00"), "credit": Decimal("250.00")},
    ]

    j1 = PostingService.create_journal_entry(
        db=db_session,
        company_id=1,
        entry_date=date.today(),
        entry_type="MANUAL",
        description="Owner Capital Injection Test",
        lines=lines,
        posting_key=key,
    )
    assert j1.id is not None
    assert j1.total_debit == Decimal("250.00")
    assert j1.total_credit == Decimal("250.00")

    # Idempotent second call
    j2 = PostingService.create_journal_entry(
        db=db_session,
        company_id=1,
        entry_date=date.today(),
        entry_type="MANUAL",
        description="Owner Capital Injection Test Duplicate",
        lines=lines,
        posting_key=key,
    )
    assert j1.id == j2.id, "Second posting must return identical journal without duplicate lines"


# =====================================================================
# 2. NULL ACCOUNTING RULE: UNKNOWN PURCHASE COSTS
# =====================================================================

def test_null_accounting_rule_preservation(db_session: Session):
    """
    CRITICAL RULE:
    Unknown purchase costs must remain NULL and NEVER convert into $0.00.
    Supplier bill posting must return None for unverified purchases.
    """
    # Create test unverified purchase
    test_purchase = models.Purchase(
        company_id=1,
        purchase_code="TEST-PUR-NULL-01",
        date=date.today(),
        supplier_id=1,
        product_name="Test Dry Figs",
        purchase_amount=None,  # Unknown!
        status="DRAFT",
    )
    db_session.add(test_purchase)
    db_session.flush()

    # Attempt posting
    journal = PostingService.post_supplier_bill(db_session, test_purchase)
    assert journal is None, "Supplier bill must not post to general ledger when purchase_amount is NULL."

    # Verify PayableService reports this as pending bill
    out = PayableService.get_supplier_outstanding(db_session, supplier_id=1)
    assert out["pending_cost_purchases_count"] >= 1
    assert out["status"] == "PENDING_SUPPLIER_BILLS"

    db_session.rollback()


# =====================================================================
# 3. TRANSPORT CARRIER SIGN SEMANTICS
# =====================================================================

def test_transport_carrier_credit_semantics(db_session: Session):
    """
    Verify transport ledger preserving sign semantics:
    Freight: $743,650.00, Payments: $1,030,000.00, Opening: $4,810.00 => Net: -$291,160.00
    Credit in AQ Companies Favor: $291,160.00
    """
    pos = TransportService.get_transport_carrier_position(db_session, transport_company_id=1)
    assert pos["total_transport_charges"] == 743650.0
    assert pos["total_paid"] == 1034810.0
    assert pos["net_balance"] == -291160.0
    assert pos["credit_balance"] == 291160.0
    assert pos["has_credit_with_transport_company"] is True
    assert "Credit in AQ Companies Favor" in pos["credit_display"]


# =====================================================================
# 4. REVERSAL WORKFLOW
# =====================================================================

def test_reversal_service_workflow(db_session: Session):
    """Verify that reversing a journal creates inverted lines and links entries."""
    lines = [
        {"account_code": "1100", "debit": Decimal("500.00"), "credit": Decimal("0.00")},
        {"account_code": "4000", "debit": Decimal("0.00"), "credit": Decimal("500.00")},
    ]
    orig = PostingService.create_journal_entry(
        db=db_session,
        company_id=1,
        entry_date=date.today(),
        entry_type="MANUAL",
        description="Entry To Be Reversed",
        lines=lines,
    )

    rev = ReversalService.reverse_journal_entry(
        db=db_session,
        journal_id=orig.id,
        reason="Testing Automated Reversal Engine",
    )
    assert rev.status == "POSTED"
    assert rev.entry_type == "REVERSAL"
    assert rev.reversed_entry_id == orig.id
    assert orig.status == "REVERSED"
    assert rev.total_debit == orig.total_credit
    assert rev.total_credit == orig.total_debit


# =====================================================================
# 5. BANKING RUNNING BALANCES & MONEY TRANSFERS
# =====================================================================

def test_banking_running_balance_and_transfer(db_session: Session):
    """Verify bank account running balances and internal fund transfers."""
    acc1 = db_session.query(models.BankAccount).filter(models.BankAccount.account_type == "BANK").first()
    acc2 = db_session.query(models.BankAccount).filter(models.BankAccount.id != acc1.id).first()

    bal1_before = BankingService.recalculate_account_running_balance(db_session, acc1.id)
    bal2_before = BankingService.recalculate_account_running_balance(db_session, acc2.id)

    transfer = BankingService.execute_money_transfer(
        db=db_session,
        from_account_id=acc1.id,
        to_account_id=acc2.id,
        amount=Decimal("100.00"),
        transfer_date=date.today(),
        purpose="Automated Test Transfer",
    )
    assert transfer.id is not None

    bal1_after = BankingService.recalculate_account_running_balance(db_session, acc1.id)
    bal2_after = BankingService.recalculate_account_running_balance(db_session, acc2.id)

    assert bal1_after == bal1_before - Decimal("100.00")
    assert bal2_after == bal2_before + Decimal("100.00")

    # Clean up test transfer & restore balances
    out_id = transfer.source_transaction_id
    in_id = transfer.destination_transaction_id
    db_session.delete(transfer)
    db_session.commit()
    if out_id or in_id:
        db_session.query(models.BankTransaction).filter(models.BankTransaction.id.in_([i for i in (out_id, in_id) if i])).delete()
        db_session.commit()
    BankingService.recalculate_account_running_balance(db_session, acc1.id)
    BankingService.recalculate_account_running_balance(db_session, acc2.id)
    db_session.commit()


# =====================================================================
# 6. CENTRAL TREASURY & INTERCOMPANY
# =====================================================================

def test_treasury_multi_currency_and_reconciliation(db_session: Session):
    """Verify group central treasury liquidity and pair-wise reconciliation."""
    treasury = TreasuryService.get_group_treasury_overview(db_session)
    assert "total_group_cash_usd" in treasury
    assert "by_currency" in treasury
    assert any(c["currency"] == "USD" for c in treasury["by_currency"])

    rec = TreasuryService.get_intercompany_reconciliation(db_session)
    assert rec["status"] in ("BALANCED", "UNBALANCED")
    assert "total_due_from" in rec
    assert "total_due_to" in rec


# =====================================================================
# 7. SECURITY & PERMISSION MATRIX
# =====================================================================

def test_permissions_matrix():
    """Verify role permission enforcement."""
    assert user_has_permission("ADMIN", "accounting.post") is True
    assert user_has_permission("VIEW_ONLY", "accounting.post") is False
    assert user_has_permission("ACCOUNTANT", "accounting.post") is True
    assert user_has_permission("ACCOUNTANT", "period.close") is False

    with pytest.raises(PermissionDeniedError):
        require_permission("VIEW_ONLY", "accounting.post")


def test_jwt_token_creation_and_verification():
    """Verify signed access token lifecycle."""
    token = create_access_token({"sub": "test_user", "user_id": 99, "role": "ACCOUNTANT"})
    payload = decode_access_token(token)
    assert payload["sub"] == "test_user"
    assert payload["user_id"] == 99
    assert payload["role"] == "ACCOUNTANT"


# =====================================================================
# 8. DATA IMPORT SERVICE DRY RUN
# =====================================================================

def test_data_import_service_dry_run(db_session: Session):
    """Verify data import service dry-run without modifying the database."""
    test_batch = [
        {
            "invoice_number": "INV-DRYRUN-001",
            "customer_name": "Test Dry Run Customer",
            "container_number": "MSKU9999999",
            "total_amount": 5000.00,
        },
        {
            "invoice_number": "",  # Invalid: missing invoice number
            "customer_name": "Invalid Row",
            "total_amount": 1000.00,
        },
    ]

    res = DataImportService.process_import(db_session, test_batch, dry_run=True)
    assert res["status"] == "VALIDATED"
    assert res["dry_run"] is True
    assert res["records_to_create"] == 1
    assert res["rejected_count"] == 1

    # Verify no record was inserted
    inv = db_session.query(models.Invoice).filter(models.Invoice.invoice_number == "INV-DRYRUN-001").first()
    assert inv is None, "Dry run must NOT persist records into the database."


# =====================================================================
# 9. BACKUP SERVICE CREATION & PREVIEW
# =====================================================================

def test_backup_service_creation_and_preview(db_session: Session):
    """Verify enterprise backup archive generation and manifest preview."""
    res = BackupService.create_backup(db_session, backup_type="TEST", user_name="PytestRunner")
    assert res["success"] is True
    assert "AQ-COMPANIES-BACKUP-" in res["filename"]
    assert res["size_bytes"] > 0
    assert "checksum_sha256" in res

    backups = BackupService.list_backups(db_session)
    assert len(backups) > 0
    assert any(b["filename"] == res["filename"] for b in backups)
