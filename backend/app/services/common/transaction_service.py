from contextlib import contextmanager
import uuid
from typing import Generator, Optional, Any, Dict, List
from decimal import Decimal
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy.exc import DBAPIError, OperationalError

from app import models
from app.core.exceptions import (
    AccountingError,
    ValidationError,
    PeriodClosedError,
    OptimisticLockError,
)
from app.services.currency.currency_service import RoundingPolicy
from app.services.accounting.posting_service import PostingService
from app.services.banking.banking_service import BankingService


@contextmanager
def atomic_transaction(db: Session) -> Generator[Session, None, None]:
    """
    Context manager that ensures an explicit, atomic transaction boundary.
    Automatically commits on normal completion or rolls back completely on any exception.
    """
    try:
        yield db
        db.commit()
    except Exception as exc:
        db.rollback()
        raise exc


class TransactionService:
    """
    Enterprise Transaction Coordinator for AQ COMPANIES.
    Governs multi-step atomic financial writes, optimistic concurrency, and row-level locking.
    """

    @staticmethod
    def safe_row_lock(query: Any, db: Session) -> Any:
        """
        Applies SELECT ... FOR UPDATE row locking when running on PostgreSQL/MySQL,
        or graceful pass-through when running on SQLite (which locks at database/WAL level).
        """
        dialect = db.bind.dialect.name if db.bind else "sqlite"
        if dialect in ("postgresql", "postgres", "mysql"):
            return query.with_for_update()
        return query

    @staticmethod
    def check_optimistic_lock(
        record: Any,
        expected_version: Optional[int],
        entity_name: str = "Record",
    ) -> None:
        """
        Validates optimistic concurrency version. Raises 409 Conflict if record was updated concurrently.
        """
        if expected_version is not None and hasattr(record, "version_id"):
            current_ver = getattr(record, "version_id")
            if current_ver != expected_version:
                raise OptimisticLockError(
                    message=f"CONFLICT: {entity_name} has been modified by another transaction. Expected version {expected_version}, found {current_ver}. Please refresh.",
                    details={"entity": entity_name, "expected_version": expected_version, "current_version": current_ver}
                )

    @classmethod
    def execute_customer_receipt_atomic(
        cls,
        db: Session,
        company_id: int,
        customer_id: int,
        bank_account_id: int,
        receipt_amount: Decimal,
        receipt_date: date,
        allocations_data: List[Dict[str, Any]],
        voucher_number: Optional[str] = None,
        reference: Optional[str] = None,
        user_name: str = "Admin",
    ) -> Dict[str, Any]:
        """
        Executes a 100% atomic customer receipt operation:
        1. Validates input & bank account
        2. Row-locks affected invoices (Postgres) and verifies balances
        3. Creates BankTransaction (Money In, status POSTED)
        4. Creates PaymentAllocation records
        5. Updates Invoice amount_received, balance_due, payment_status, and increments version_id
        6. Generates authoritative double-entry journal entry:
           Dr Bank Account (1010/1020)
           Cr Customer Receivables (1100)
        7. Logs structured audit record
        8. Atomically commits all changes (or rolls back all on error)
        """
        amt = RoundingPolicy.round_money(receipt_amount)
        if amt <= 0:
            raise ValidationError("Customer receipt amount must be greater than zero.")

        with atomic_transaction(db):
            bank_acc = db.query(models.BankAccount).filter(
                models.BankAccount.id == bank_account_id
            ).first()
            if not bank_acc:
                raise AccountingError(f"Bank Account ID {bank_account_id} not found.")

            customer = db.query(models.Customer).filter(
                models.Customer.id == customer_id
            ).first()
            if not customer:
                raise AccountingError(f"Customer ID {customer_id} not found.")

            cust_name = getattr(customer, "customer_name", getattr(customer, "name", "Customer"))
            # 1. Create BankTransaction
            if voucher_number:
                tx_code = voucher_number
            else:
                suffix = uuid.uuid4().hex[:6].upper()
                tx_code = f"CRV-{receipt_date.strftime('%Y%m%d')}-{customer_id}-{suffix}"

            bank_tx = models.BankTransaction(
                company_id=company_id,
                transaction_code=tx_code,
                voucher_number=voucher_number or tx_code,
                date=receipt_date,
                bank_account_id=bank_acc.id,
                bank_name=bank_acc.bank_name,
                account_number=bank_acc.account_number,
                party_type="CUSTOMER",
                party_id=customer.id,
                party_name=cust_name,
                transaction_type="CUSTOMER_RECEIPT",
                money_in=amt,
                money_out=Decimal("0.00"),
                currency=bank_acc.currency,
                usd_equivalent_in=amt,
                transaction_reference=reference,
                notes=f"Customer receipt from {cust_name}",
                status="POSTED",
                created_by=user_name,
            )
            db.add(bank_tx)
            db.flush()

            # 2. Process Allocations
            total_allocated = Decimal("0.00")
            created_allocations = []
            for alloc in allocations_data:
                inv_id = alloc.get("invoice_id")
                alloc_amt = RoundingPolicy.round_money(alloc.get("amount", 0))
                if alloc_amt <= 0:
                    continue

                inv_query = db.query(models.Invoice).filter(models.Invoice.id == inv_id)
                inv = cls.safe_row_lock(inv_query, db).first()
                if not inv:
                    raise AccountingError(f"Invoice ID {inv_id} not found for allocation.")

                # Check expected version if provided
                if "expected_version" in alloc:
                    cls.check_optimistic_lock(inv, alloc["expected_version"], f"Invoice {inv.invoice_number}")

                current_bal = RoundingPolicy.round_money(inv.balance_due or inv.total_amount or 0)
                if alloc_amt > current_bal:
                    raise ValidationError(
                        f"Allocation ${alloc_amt} exceeds Invoice {inv.invoice_number} outstanding balance ${current_bal}."
                    )

                inv.amount_received = RoundingPolicy.round_money(inv.amount_received + alloc_amt)
                inv.balance_due = RoundingPolicy.round_money((inv.total_amount or 0) - inv.amount_received)
                if inv.balance_due <= Decimal("0.01"):
                    inv.balance_due = Decimal("0.00")
                    inv.payment_status = "PAID"
                else:
                    inv.payment_status = "PARTIALLY PAID"

                inv.version_id = (inv.version_id or 1) + 1

                p_alloc = models.PaymentAllocation(
                    bank_transaction_id=bank_tx.id,
                    customer_id=customer.id,
                    invoice_id=inv.id,
                    shipment_id=inv.shipment_id,
                    allocated_amount_usd=alloc_amt,
                    allocation_type="INVOICE_PAYMENT",
                    notes=f"Allocated to {inv.invoice_number}",
                )
                db.add(p_alloc)
                created_allocations.append(p_alloc)
                total_allocated += alloc_amt

            if total_allocated > amt:
                raise ValidationError(
                    f"Total allocated (${total_allocated}) cannot exceed receipt amount (${amt})."
                )

            # 3. Post Authoritative Journal Entry
            bank_gl_code = bank_acc.gl_account_code or ("1010" if bank_acc.account_type == "CASH" else "1020")
            journal_lines = [
                {
                    "account_code": bank_gl_code,
                    "debit": amt,
                    "credit": Decimal("0.00"),
                    "party_type": "BANK",
                    "party_id": bank_acc.id,
                    "party_name": bank_acc.bank_name,
                    "description": f"Receipt from {cust_name} via {bank_acc.bank_name}",
                },
            ]
            if total_allocated > Decimal("0.00"):
                journal_lines.append({
                    "account_code": "1100",  # Customer Receivables
                    "debit": Decimal("0.00"),
                    "credit": total_allocated,
                    "party_type": "CUSTOMER",
                    "party_id": customer.id,
                    "party_name": cust_name,
                    "description": f"AR credit for receipt {tx_code}",
                })
            advance_amt = amt - total_allocated
            if advance_amt > Decimal("0.00"):
                journal_lines.append({
                    "account_code": "2150",  # Customer Advances
                    "debit": Decimal("0.00"),
                    "credit": advance_amt,
                    "party_type": "CUSTOMER",
                    "party_id": customer.id,
                    "party_name": cust_name,
                    "description": f"Customer advance credit for receipt {tx_code}",
                })

            journal = PostingService.create_journal_entry(
                db=db,
                company_id=company_id,
                entry_date=receipt_date,
                entry_type="CUSTOMER_PAYMENT",
                description=f"Customer Receipt: {cust_name} - ${amt}",
                reference=reference or tx_code,
                source_document_type="BANK_TRANSACTION",
                source_document_id=bank_tx.id,
                lines=journal_lines,
                posting_key=f"REC:{tx_code}",
                auto_commit=False,
            )

            # 4. Update running balance
            BankingService.recalculate_account_running_balance(db, bank_acc.id)

            # 5. Audit Log
            audit = models.AuditLog(
                entity_type="CustomerReceipt",
                entity_id=bank_tx.id,
                action="CREATE",
                user_name=user_name,
                reason=f"Customer receipt for {cust_name} of ${amt}",
                new_value_json=f'{{"transaction_code": "{tx_code}", "amount": {float(amt)}, "allocations": {len(created_allocations)}}}',
            )
            db.add(audit)

        return {
            "success": True,
            "bank_transaction_id": bank_tx.id,
            "transaction_code": tx_code,
            "journal_entry_id": journal.id,
            "journal_number": journal.entry_number,
            "amount_received": float(amt),
            "allocated_amount": float(total_allocated),
            "unallocated_amount": float(amt - total_allocated),
        }
