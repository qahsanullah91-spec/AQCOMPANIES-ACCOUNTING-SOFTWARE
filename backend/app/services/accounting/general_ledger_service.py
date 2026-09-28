from datetime import date
from decimal import Decimal
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app import models
from app.services.accounting.posting_service import round_money


class GeneralLedgerService:
    """
    Authoritative General Ledger Service.
    Derives account balances and trial balances directly from posted journal lines.
    """

    @staticmethod
    def get_account_balance(
        db: Session,
        account_id: int,
        as_of_date: Optional[date] = None,
        company_id: Optional[int] = None,
    ) -> Decimal:
        """Computes current balance for a single account based on normal balance debit/credit rules."""
        account = db.query(models.Account).filter(models.Account.id == account_id).first()
        if not account:
            return Decimal("0.00")

        query = (
            db.query(
                func.coalesce(func.sum(models.JournalLine.debit), 0).label("total_debit"),
                func.coalesce(func.sum(models.JournalLine.credit), 0).label("total_credit"),
            )
            .join(models.JournalEntry)
            .filter(
                models.JournalLine.account_id == account_id,
                models.JournalEntry.status == "POSTED",
            )
        )
        if as_of_date:
            query = query.filter(models.JournalEntry.entry_date <= as_of_date)
        if company_id:
            query = query.filter(models.JournalLine.company_id == company_id)

        res = query.first()
        dr = round_money(res.total_debit)
        cr = round_money(res.total_credit)

        if account.account_type in ("ASSET", "EXPENSE", "COGS"):
            return dr - cr
        else:  # LIABILITY, EQUITY, REVENUE
            return cr - dr

    @staticmethod
    def get_trial_balance(
        db: Session,
        as_of_date: Optional[date] = None,
        company_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Generates full Trial Balance summing all active accounts."""
        accounts = db.query(models.Account).filter(models.Account.is_active == True).order_by(models.Account.account_code).all()

        rows = []
        total_debit = Decimal("0.00")
        total_credit = Decimal("0.00")

        for acc in accounts:
            query = (
                db.query(
                    func.coalesce(func.sum(models.JournalLine.debit), 0).label("dr"),
                    func.coalesce(func.sum(models.JournalLine.credit), 0).label("cr"),
                )
                .join(models.JournalEntry)
                .filter(
                    models.JournalLine.account_id == acc.id,
                    models.JournalEntry.status == "POSTED",
                )
            )
            if as_of_date:
                query = query.filter(models.JournalEntry.entry_date <= as_of_date)
            if company_id:
                query = query.filter(models.JournalLine.company_id == company_id)

            res = query.first()
            dr = round_money(res.dr)
            cr = round_money(res.cr)

            if dr == 0 and cr == 0:
                continue

            # Normal balance net presentation
            if acc.account_type in ("ASSET", "EXPENSE", "COGS"):
                net = dr - cr
                line_dr = net if net > 0 else Decimal("0.00")
                line_cr = abs(net) if net < 0 else Decimal("0.00")
            else:
                net = cr - dr
                line_cr = net if net > 0 else Decimal("0.00")
                line_dr = abs(net) if net < 0 else Decimal("0.00")

            total_debit += line_dr
            total_credit += line_cr

            rows.append({
                "account_id": acc.id,
                "account_code": acc.account_code,
                "account_name": acc.account_name,
                "account_type": acc.account_type,
                "sub_type": acc.sub_type,
                "debit": float(line_dr),
                "credit": float(line_cr),
            })

        diff = abs(total_debit - total_credit)
        return {
            "as_of_date": as_of_date.isoformat() if as_of_date else date.today().isoformat(),
            "company_id": company_id,
            "total_debit": float(total_debit),
            "total_credit": float(total_credit),
            "difference": float(diff),
            "is_balanced": diff < Decimal("0.01"),
            "accounts": rows,
        }
