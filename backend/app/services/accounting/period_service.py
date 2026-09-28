from datetime import date, datetime, timezone
import hashlib
import json
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app import models
from app.core.exceptions import PeriodClosedError, ValidationError, AccountingError
from app.services.accounting.general_ledger_service import GeneralLedgerService


class PeriodService:
    """
    Accounting Period Control Service.
    Enforces OPEN, CLOSED, and LOCKED states, performs pre-closing audits,
    and captures immutable period financial snapshots.
    """

    @staticmethod
    def get_or_create_period(db: Session, period_date: date, company_id: Optional[int] = 1) -> models.AccountingPeriod:
        """Retrieves existing period or seeds OPEN period for month/year."""
        period_name = period_date.strftime("%B %Y")
        period = db.query(models.AccountingPeriod).filter(
            models.AccountingPeriod.period_name == period_name,
            models.AccountingPeriod.company_id == company_id,
        ).first()

        if not period:
            period = models.AccountingPeriod(
                company_id=company_id,
                period_name=period_name,
                period_year=period_date.year,
                period_month=period_date.month,
                status="OPEN",
            )
            db.add(period)
            db.commit()
            db.refresh(period)

        return period

    @staticmethod
    def validate_pre_close_checklist(db: Session, period: models.AccountingPeriod) -> Dict[str, Any]:
        """Runs thorough pre-closing checks before sealing a financial period."""
        # 1. Trial Balance Check
        tb = GeneralLedgerService.get_trial_balance(db, company_id=period.company_id)
        tb_passed = tb["is_balanced"]

        # 2. Draft Bank Transactions Check
        draft_txs = db.query(models.BankTransaction).filter(
            models.BankTransaction.status == "DRAFT",
            models.BankTransaction.company_id == period.company_id,
        ).count()

        # 3. Unallocated Payments Check
        unalloc = db.query(models.BankTransaction).filter(
            models.BankTransaction.party_type == "CUSTOMER",
            models.BankTransaction.status == "CLEARED",
            models.BankTransaction.invoice_id == None,
            models.BankTransaction.company_id == period.company_id,
        ).count()

        checklist = [
            {
                "item": "General Ledger Trial Balance",
                "status": "PASS" if tb_passed else "FAIL",
                "details": f"Difference: ${tb['difference']:.2f}",
                "is_blocking": True,
            },
            {
                "item": "Draft Bank Transactions",
                "status": "PASS" if draft_txs == 0 else "FAIL",
                "details": f"{draft_txs} transactions pending clearance",
                "is_blocking": True,
            },
            {
                "item": "Customer Payment Allocations",
                "status": "PASS" if unalloc == 0 else "WARNING",
                "details": f"{unalloc} unallocated customer receipts",
                "is_blocking": False,
            },
        ]

        can_close = all(c["status"] == "PASS" for c in checklist if c["is_blocking"])
        return {
            "period_name": period.period_name,
            "can_close": can_close,
            "checklist": checklist,
        }

    @classmethod
    def close_period(
        cls,
        db: Session,
        period_id: int,
        user_name: str = "Admin",
        notes: Optional[str] = None,
    ) -> models.AccountingPeriod:
        """Closes accounting period after checklist validation and takes immutable financial snapshot."""
        period = db.query(models.AccountingPeriod).filter(models.AccountingPeriod.id == period_id).first()
        if not period:
            raise AccountingError("Period not found.")

        if period.status in ("CLOSED", "LOCKED"):
            raise ValidationError(f"Period {period.period_name} is already {period.status}.")

        check = cls.validate_pre_close_checklist(db, period)
        if not check["can_close"]:
            raise ValidationError(
                f"Cannot close period {period.period_name}: Blocking checklist items failed."
            )

        # Generate snapshot of Trial Balance
        tb = GeneralLedgerService.get_trial_balance(db, company_id=period.company_id)
        tb_json = json.dumps(tb, sort_keys=True)
        tb_hash = hashlib.sha256(tb_json.encode()).hexdigest()

        snapshot = models.PeriodFinancialSnapshot(
            accounting_period_id=period.id,
            snapshot_type="TRIAL_BALANCE",
            financial_data_json=tb_json,
            checksum_sha256=tb_hash,
            created_by=user_name,
        )
        db.add(snapshot)

        period.status = "CLOSED"
        period.closed_at = datetime.now(timezone.utc)
        period.closed_by = user_name
        period.close_notes = notes

        # Audit log
        db.add(models.AuditLog(
            company_id=period.company_id,
            table_name="accounting_periods",
            record_id=period.id,
            action="PERIOD_CLOSE",
            user=user_name,
            new_value=f"Closed {period.period_name}. Snapshot checksum: {tb_hash[:16]}",
        ))

        db.commit()
        db.refresh(period)
        return period

    @classmethod
    def reopen_period(
        cls,
        db: Session,
        period_id: int,
        reason: str,
        user_name: str = "Admin",
    ) -> models.AccountingPeriod:
        """Reopens a closed period with mandatory auditor reason and high-risk security audit logging."""
        if not reason or len(reason.strip()) < 10:
            raise ValidationError("A detailed reason (at least 10 characters) is required to reopen an accounting period.")

        period = db.query(models.AccountingPeriod).filter(models.AccountingPeriod.id == period_id).first()
        if not period:
            raise AccountingError("Period not found.")

        if period.status != "CLOSED":
            raise ValidationError(f"Cannot reopen period: Status is {period.status} (must be CLOSED).")

        period.status = "REOPENED"

        # Log high-risk audit alert
        db.add(models.AuditLog(
            company_id=period.company_id,
            table_name="accounting_periods",
            record_id=period.id,
            action="PERIOD_REOPEN",
            user=user_name,
            new_value=json.dumps({"status": "REOPENED", "reopened_by": user_name, "reason": reason}),
        ))

        db.commit()
        db.refresh(period)
        return period
