from datetime import date
from decimal import Decimal
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app import models
from app.services.accounting.posting_service import round_money, PostingService


class PayableService:
    """
    Authoritative Supplier Payables Service.
    Enforces the NULL Accounting Rule: Unverified purchase costs remain NULL and do not create fake payables.
    """

    @staticmethod
    def get_supplier_outstanding(db: Session, supplier_id: int, company_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Calculates supplier payable balance:
        Confirmed Bills - Payments - Applied Advances
        Also counts pending/unverified purchases with NULL cost.
        """
        query_bills = db.query(
            func.coalesce(func.sum(models.Purchase.purchase_amount), 0).label("bills"),
            func.coalesce(func.sum(models.Purchase.amount_paid), 0).label("paid"),
            func.coalesce(func.sum(models.Purchase.balance), 0).label("balance"),
        ).filter(
            models.Purchase.supplier_id == supplier_id,
            models.Purchase.purchase_amount != None,
        )
        if company_id:
            query_bills = query_bills.filter(models.Purchase.company_id == company_id)

        bill_res = query_bills.first()
        total_bills = round_money(bill_res.bills)
        total_paid = round_money(bill_res.paid)
        balance = round_money(bill_res.balance)

        # Count shipments awaiting purchase cost
        query_pending = db.query(models.Purchase).filter(
            models.Purchase.supplier_id == supplier_id,
            models.Purchase.purchase_amount == None,
        )
        if company_id:
            query_pending = query_pending.filter(models.Purchase.company_id == company_id)

        pending_count = query_pending.count()

        return {
            "supplier_id": supplier_id,
            "total_bills": float(total_bills),
            "total_paid": float(total_paid),
            "outstanding_balance": float(balance),
            "pending_cost_purchases_count": pending_count,
            "status": "PENDING_SUPPLIER_BILLS" if pending_count > 0 else "UP_TO_DATE",
        }

    @staticmethod
    def get_payables_summary(db: Session, company_id: Optional[int] = None) -> Dict[str, Any]:
        """Summarizes group-wide supplier payables and pending bills."""
        query = db.query(models.Purchase)
        if company_id:
            query = query.filter(models.Purchase.company_id == company_id)

        purchases = query.all()

        confirmed_payables = Decimal("0.00")
        pending_count = 0

        for p in purchases:
            if p.purchase_amount is None:
                pending_count += 1
            else:
                confirmed_payables += round_money(p.balance or 0)

        return {
            "company_id": company_id,
            "confirmed_payables": float(confirmed_payables),
            "pending_supplier_bills_count": pending_count,
            "has_unverified_costs": pending_count > 0,
        }
