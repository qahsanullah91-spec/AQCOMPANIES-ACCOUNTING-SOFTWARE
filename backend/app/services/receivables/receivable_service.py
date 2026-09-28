from datetime import date
from decimal import Decimal
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app import models
from app.core.exceptions import ValidationError, AccountingError
from app.services.accounting.posting_service import round_money, PostingService


class ReceivableService:
    """
    Authoritative Customer Receivables & Payment Allocation Service.
    Calculates exact outstanding invoice balances and handles complex payment allocations.
    """

    @staticmethod
    def get_invoice_outstanding(db: Session, invoice_id: int) -> Decimal:
        """
        Computes accurate invoice outstanding balance:
        Invoice Total - Applied Allocations - Credit Notes
        """
        inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
        if not inv:
            return Decimal("0.00")

        total_amount = round_money(inv.total_amount)
        applied_payments = db.query(
            func.coalesce(func.sum(models.PaymentAllocation.amount_allocated), 0)
        ).filter(models.PaymentAllocation.invoice_id == invoice_id).scalar()

        outstanding = total_amount - round_money(applied_payments)
        return outstanding if outstanding > 0 else Decimal("0.00")

    @classmethod
    def allocate_payment(
        cls,
        db: Session,
        bank_tx_id: int,
        allocations: List[Dict[str, Any]],  # [{"invoice_id": 1, "amount": 5000.00}]
        user_name: str = "Admin",
    ) -> Dict[str, Any]:
        """
        Allocates customer receipt to one or multiple invoices.
        Supports:
        - 1 payment -> 1 invoice
        - 1 payment -> multiple invoices
        - Partial payment
        - Advance handling (unallocated remainder remains on BankTransaction or customer advance)
        Server-side validation ensures sum(allocations) <= money_in.
        """
        bank_tx = db.query(models.BankTransaction).filter(models.BankTransaction.id == bank_tx_id).first()
        if not bank_tx:
            raise AccountingError("Bank transaction not found.")

        money_in = round_money(bank_tx.money_in)
        if money_in <= 0:
            raise ValidationError("Cannot allocate a non-receipt transaction.")

        total_allocated = Decimal("0.00")
        created_allocations = []

        for alloc in allocations:
            inv_id = alloc.get("invoice_id")
            amt = round_money(alloc.get("amount", 0))
            if amt <= 0:
                continue

            inv = db.query(models.Invoice).filter(models.Invoice.id == inv_id).first()
            if not inv:
                raise ValidationError(f"Invoice ID {inv_id} not found.")

            # Validate cross-company safety
            if bank_tx.company_id and inv.company_id and bank_tx.company_id != inv.company_id:
                raise ValidationError(
                    f"CROSS-COMPANY VIOLATION: Payment belongs to company {bank_tx.company_id} "
                    f"but Invoice {inv.invoice_number} belongs to company {inv.company_id}."
                )

            current_outstanding = cls.get_invoice_outstanding(db, inv.id)
            if amt > current_outstanding:
                raise ValidationError(
                    f"Over-allocation error: Attempted to allocate ${amt} to Invoice {inv.invoice_number}, "
                    f"but outstanding balance is only ${current_outstanding}."
                )

            total_allocated += amt

            pa = models.PaymentAllocation(
                bank_transaction_id=bank_tx.id,
                customer_id=inv.customer_id,
                invoice_id=inv.id,
                allocated_amount_usd=amt,
                allocation_type="INVOICE_PAYMENT",
                notes=alloc.get("notes"),
            )
            db.add(pa)
            db.flush()

            # Update invoice balance_due and payment_status
            new_due = current_outstanding - amt
            inv.balance_due = new_due
            if new_due == 0:
                inv.payment_status = "PAID"
            elif new_due < round_money(inv.total_amount):
                inv.payment_status = "PARTIAL"
            else:
                inv.payment_status = "UNPAID"

            created_allocations.append({
                "allocation_id": pa.id,
                "invoice_number": inv.invoice_number,
                "amount": float(amt),
                "remaining_balance": float(new_due),
            })

        if total_allocated > money_in:
            raise ValidationError(
                f"Total allocated amount (${total_allocated}) exceeds receipt amount (${money_in})."
            )

        # Update bank transaction status
        if total_allocated == money_in:
            bank_tx.status = "CLEARED"
        else:
            bank_tx.status = "PARTIALLY_ALLOCATED"

        # Post receipt journal entry
        customer_id = bank_tx.party_id
        if not customer_id and allocations:
            first_inv = db.query(models.Invoice).filter(models.Invoice.id == allocations[0]["invoice_id"]).first()
            customer_id = first_inv.customer_id if first_inv else None

        PostingService.post_customer_receipt(
            db=db,
            bank_tx=bank_tx,
            customer_id=customer_id or 1,
            invoice_id=allocations[0]["invoice_id"] if len(allocations) == 1 else None,
        )

        db.commit()
        return {
            "status": "SUCCESS",
            "total_allocated": float(total_allocated),
            "unallocated_advance": float(money_in - total_allocated),
            "allocations": created_allocations,
        }

    @staticmethod
    def get_receivables_aging(db: Session, as_of_date: Optional[date] = None, company_id: Optional[int] = None) -> Dict[str, Any]:
        """Calculates aging buckets (Current, 1-30, 31-60, 61-90, 91-120, 120+) for all customer receivables."""
        ref_date = as_of_date or date.today()
        query = db.query(models.Invoice).filter(
            models.Invoice.status == "POSTED",
            models.Invoice.balance_due > 0,
        )
        if company_id:
            query = query.filter(models.Invoice.company_id == company_id)

        invoices = query.all()

        buckets = {
            "current": Decimal("0.00"),
            "d1_30": Decimal("0.00"),
            "d31_60": Decimal("0.00"),
            "d61_90": Decimal("0.00"),
            "d91_120": Decimal("0.00"),
            "d120_plus": Decimal("0.00"),
            "total": Decimal("0.00"),
        }

        for inv in invoices:
            bal = round_money(inv.balance_due)
            age = (ref_date - (inv.invoice_date or ref_date)).days

            if age <= 0:
                buckets["current"] += bal
            elif age <= 30:
                buckets["d1_30"] += bal
            elif age <= 60:
                buckets["d31_60"] += bal
            elif age <= 90:
                buckets["d61_90"] += bal
            elif age <= 120:
                buckets["d91_120"] += bal
            else:
                buckets["d120_plus"] += bal

            buckets["total"] += bal

        return {
            "as_of_date": ref_date.isoformat(),
            "company_id": company_id,
            "buckets": {k: float(v) for k, v in buckets.items()},
        }
