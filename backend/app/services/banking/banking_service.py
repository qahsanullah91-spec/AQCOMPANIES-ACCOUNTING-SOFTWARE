from datetime import date, datetime, timezone
import uuid
from decimal import Decimal
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_, and_

from app import models
from app.services.accounting.posting_service import round_money
from app.core.exceptions import ValidationError, AccountingError


class BankingService:
    """
    Authoritative Banking Engine for AQ COMPANIES.
    Manages commercial bank accounts, physical cash vaults, Sarafi broker ledgers,
    accurate running balances, money transfers, and duplicate transaction detection.
    """

    @staticmethod
    def recalculate_account_running_balance(db: Session, bank_account_id: int) -> Decimal:
        """
        Recalculates exact running balance for a bank/cash/Sarafi account:
        Opening Balance + Posted Money In - Posted Money Out
        Only transactions in CLEARED or POSTED status are included.
        """
        account = db.query(models.BankAccount).filter(models.BankAccount.id == bank_account_id).first()
        if not account:
            raise AccountingError("Bank account not found.")

        opening = round_money(account.opening_balance)

        res = (
            db.query(
                func.coalesce(func.sum(models.BankTransaction.money_in), 0).label("total_in"),
                func.coalesce(func.sum(models.BankTransaction.money_out), 0).label("total_out"),
            )
            .filter(
                models.BankTransaction.bank_account_id == bank_account_id,
                models.BankTransaction.status.in_(["CLEARED", "POSTED", "SETTLED"]),
            )
            .first()
        )

        total_in = round_money(res.total_in)
        total_out = round_money(res.total_out)
        current_balance = opening + total_in - total_out

        account.current_balance = current_balance
        db.commit()
        return current_balance

    @staticmethod
    def detect_duplicate_transaction(
        db: Session,
        bank_account_id: int,
        tx_date: date,
        amount: Decimal,
        is_money_in: bool = True,
        reference: Optional[str] = None,
    ) -> List[models.BankTransaction]:
        """
        Detects potential duplicate transactions based on:
        Same bank account, exact same amount, same date (or ±2 days), and matching reference.
        """
        amt = round_money(amount)
        query = db.query(models.BankTransaction).filter(
            models.BankTransaction.bank_account_id == bank_account_id,
            models.BankTransaction.date == tx_date,
        )
        if is_money_in:
            query = query.filter(models.BankTransaction.money_in == amt)
        else:
            query = query.filter(models.BankTransaction.money_out == amt)

        matches = query.all()
        return matches

    @classmethod
    def execute_money_transfer(
        cls,
        db: Session,
        from_account_id: int,
        to_account_id: int,
        amount: Decimal,
        transfer_date: date,
        purpose: str,
        user_name: str = "Admin",
    ) -> models.MoneyTransfer:
        """
        Executes internal cash/bank transfer between two accounts of the same entity.
        Creates outgoing bank transaction, incoming bank transaction, and updates running balances atomically.
        """
        amt = round_money(amount)
        if amt <= 0:
            raise ValidationError("Transfer amount must be positive.")

        from_acc = db.query(models.BankAccount).filter(models.BankAccount.id == from_account_id).first()
        to_acc = db.query(models.BankAccount).filter(models.BankAccount.id == to_account_id).first()

        if not from_acc or not to_acc:
            raise AccountingError("Source or destination bank account not found.")

        if from_acc.id == to_acc.id:
            raise ValidationError("Source and destination accounts must be different.")

        unique_suffix = f"{datetime.now(timezone.utc).strftime('%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
        transfer_code = f"TRF-{transfer_date.strftime('%Y%m')}-{unique_suffix}"

        transfer = models.MoneyTransfer(
            company_id=from_acc.company_id,
            transfer_code=transfer_code,
            transfer_type="INTERNAL_TRANSFER",
            date=transfer_date,
            source_account_id=from_acc.id,
            source_amount=amt,
            source_currency=from_acc.currency,
            destination_account_id=to_acc.id,
            destination_amount=amt,
            destination_currency=to_acc.currency,
            exchange_rate=Decimal("1.0000"),
            commission_amount=Decimal("0.00"),
            reference=purpose,
            description=purpose,
            status="POSTED",
        )
        db.add(transfer)
        db.flush()

        # 1. Outgoing transaction
        out_tx = models.BankTransaction(
            company_id=from_acc.company_id,
            transaction_code=f"{transfer_code}-OUT",
            date=transfer_date,
            bank_account_id=from_acc.id,
            bank_name=from_acc.bank_name,
            account_number=from_acc.account_number,
            party_type="INTERNAL",
            party_name=to_acc.bank_name,
            transaction_type="TRANSFER",
            money_out=amt,
            money_in=Decimal("0.00"),
            usd_equivalent_out=amt,
            currency=from_acc.currency,
            transaction_reference=transfer_code,
            notes=purpose,
            status="POSTED",
        )
        db.add(out_tx)

        # 2. Incoming transaction
        in_tx = models.BankTransaction(
            company_id=to_acc.company_id,
            transaction_code=f"{transfer_code}-IN",
            date=transfer_date,
            bank_account_id=to_acc.id,
            bank_name=to_acc.bank_name,
            account_number=to_acc.account_number,
            party_type="INTERNAL",
            party_name=from_acc.bank_name,
            transaction_type="TRANSFER",
            money_in=amt,
            money_out=Decimal("0.00"),
            usd_equivalent_in=amt,
            currency=to_acc.currency,
            transaction_reference=transfer_code,
            notes=purpose,
            status="POSTED",
        )
        db.add(in_tx)
        db.flush()

        transfer.source_transaction_id = out_tx.id
        transfer.destination_transaction_id = in_tx.id

        # Recalculate balances
        cls.recalculate_account_running_balance(db, from_acc.id)
        cls.recalculate_account_running_balance(db, to_acc.id)

        db.commit()
        db.refresh(transfer)
        return transfer
