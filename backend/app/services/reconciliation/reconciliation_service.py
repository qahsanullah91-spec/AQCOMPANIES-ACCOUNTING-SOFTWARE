from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.banking_automation import atomic_confirm_and_post_match
from app import models
from app.services.accounting.posting_service import round_money
from app.core.exceptions import ValidationError, AccountingError


class ReconciliationService:
    """
    Bank Reconciliation Service for AQ COMPANIES.
    Supports 1-to-1, 1-to-many, and many-to-1 statement matching.
    Enforces that a bank reconciliation statement can only be finalized when difference is $0.00.
    """

    @staticmethod
    def confirm_and_post_match(
        db: Session,
        statement_line_id: int,
        match_type: str,
        match_data: Dict[str, Any],
        user_name: str = "Admin",
    ) -> Dict[str, Any]:
        return atomic_confirm_and_post_match(db, statement_line_id, match_type, match_data, user_name)

    @staticmethod
    def get_reconciliation_summary(db: Session, bank_account_id: int) -> Dict[str, Any]:
        """Calculates bank ledger vs statement closing difference."""
        acc = db.query(models.BankAccount).filter(models.BankAccount.id == bank_account_id).first()
        if not acc:
            raise AccountingError("Bank account not found.")

        ledger_bal = round_money(acc.current_balance)

        # Unmatched statement lines
        unmatched_lines = db.query(models.BankStatementLine).filter(
            models.BankStatementLine.bank_account_id == bank_account_id,
            models.BankStatementLine.reconciliation_status != "MATCHED",
        ).all()

        unmatched_in = sum((round_money(l.money_in) for l in unmatched_lines), Decimal("0.00"))
        unmatched_out = sum((round_money(l.money_out) for l in unmatched_lines), Decimal("0.00"))

        adjusted_statement = ledger_bal + unmatched_in - unmatched_out
        diff = abs(ledger_bal - adjusted_statement)

        return {
            "bank_account_id": bank_account_id,
            "bank_name": acc.bank_name,
            "ledger_balance": float(ledger_bal),
            "unmatched_count": len(unmatched_lines),
            "unmatched_in": float(unmatched_in),
            "unmatched_out": float(unmatched_out),
            "difference": float(diff),
            "can_close_reconciliation": diff == Decimal("0.00") and len(unmatched_lines) == 0,
        }
