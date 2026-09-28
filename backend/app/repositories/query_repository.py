import base64
from datetime import date
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session, selectinload, joinedload
from sqlalchemy import or_, and_, desc, asc

from app import models
from app.core.exceptions import ValidationError


def apply_pagination(query, page: int = 1, page_size: int = 50) -> Tuple[Any, int, int]:
    """Applies safe server-side pagination returning (paginated_query, total_count, total_pages)."""
    p = max(1, page)
    ps = min(200, max(1, page_size))
    total_count = query.count()
    total_pages = (total_count + ps - 1) // ps if total_count > 0 else 1
    paginated_query = query.offset((p - 1) * ps).limit(ps)
    return paginated_query, total_count, total_pages


class QueryRepository:
    """
    Reusable Query Repository for AQ COMPANIES.
    Provides server-side filtering, whitelisted sorting, offset & keyset (cursor) pagination,
    and eager-loading optimizations to eliminate N+1 queries.
    """

    @staticmethod
    def get_invoices(
        db: Session,
        company_id: Optional[int] = None,
        customer_id: Optional[int] = None,
        payment_status: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        sort_by: str = "date",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """Fetches invoices with customer and shipment eagerly loaded to eliminate N+1 queries."""
        query = db.query(models.Invoice).options(
            selectinload(models.Invoice.customer),
            selectinload(models.Invoice.shipment),
        )

        if company_id:
            query = query.filter(models.Invoice.company_id == company_id)
        if customer_id:
            query = query.filter(models.Invoice.customer_id == customer_id)
        if payment_status:
            query = query.filter(models.Invoice.payment_status == payment_status.upper())
        if date_from:
            query = query.filter(models.Invoice.date >= date_from)
        if date_to:
            query = query.filter(models.Invoice.date <= date_to)

        if search:
            s = f"%{search.strip()}%"
            query = query.outerjoin(models.Invoice.shipment).filter(
                or_(
                    models.Invoice.invoice_number.ilike(s),
                    models.Shipment.container_number.ilike(s),
                    models.Shipment.bl_number.ilike(s),
                    models.Shipment.truck_number.ilike(s),
                )
            )

        # Whitelisted sorting
        allowed_sort = {
            "date": models.Invoice.date,
            "invoice_date": models.Invoice.date,
            "invoice_number": models.Invoice.invoice_number,
            "total_amount": models.Invoice.total_amount,
            "balance_due": models.Invoice.balance_due,
            "id": models.Invoice.id,
        }
        col = allowed_sort.get(sort_by, models.Invoice.date)
        query = query.order_by(desc(col) if sort_order.lower() == "desc" else asc(col))

        paginated, total, pages = apply_pagination(query, page, page_size)
        items = paginated.all()

        return {
            "page": page,
            "page_size": page_size,
            "total_count": total,
            "total_pages": pages,
            "items": [
                {
                    "id": inv.id,
                    "invoice_number": inv.invoice_number,
                    "date": inv.date.isoformat() if inv.date else None,
                    "customer_id": inv.customer_id,
                    "customer_name": (getattr(inv.customer, "customer_name", getattr(inv.customer, "name", "Unknown"))) if inv.customer else "Unknown",
                    "container_number": inv.shipment.container_number if inv.shipment else None,
                    "bl_number": inv.shipment.bl_number if inv.shipment else None,
                    "total_amount": float(inv.total_amount or 0),
                    "balance_due": float(inv.balance_due or 0),
                    "payment_status": inv.payment_status,
                    "company_id": inv.company_id,
                    "version_id": inv.version_id,
                }
                for inv in items
            ],
        }

    @staticmethod
    def get_bank_transactions(
        db: Session,
        bank_account_id: Optional[int] = None,
        company_id: Optional[int] = None,
        party_type: Optional[str] = None,
        transaction_type: Optional[str] = None,
        status: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Dict[str, Any]:
        """Fetches bank transactions with filtering and pagination."""
        query = db.query(models.BankTransaction)

        if bank_account_id:
            query = query.filter(models.BankTransaction.bank_account_id == bank_account_id)
        if company_id:
            query = query.filter(models.BankTransaction.company_id == company_id)
        if party_type:
            query = query.filter(models.BankTransaction.party_type == party_type.upper())
        if transaction_type:
            query = query.filter(models.BankTransaction.transaction_type == transaction_type.upper())
        if status:
            query = query.filter(models.BankTransaction.status == status.upper())
        if date_from:
            query = query.filter(models.BankTransaction.date >= date_from)
        if date_to:
            query = query.filter(models.BankTransaction.date <= date_to)

        query = query.order_by(desc(models.BankTransaction.date), desc(models.BankTransaction.id))
        paginated, total, pages = apply_pagination(query, page, page_size)
        items = paginated.all()

        return {
            "page": page,
            "page_size": page_size,
            "total_count": total,
            "total_pages": pages,
            "items": [
                {
                    "id": tx.id,
                    "transaction_code": tx.transaction_code,
                    "date": tx.date.isoformat() if tx.date else None,
                    "bank_account_id": tx.bank_account_id,
                    "bank_name": tx.bank_name,
                    "party_type": tx.party_type,
                    "party_name": tx.party_name,
                    "transaction_type": tx.transaction_type,
                    "money_in": float(tx.money_in),
                    "money_out": float(tx.money_out),
                    "status": tx.status,
                    "company_id": tx.company_id,
                }
                for tx in items
            ],
        }

    @staticmethod
    def get_ledger_cursor_paginated(
        db: Session,
        account_id: Optional[int] = None,
        company_id: Optional[int] = None,
        cursor_id: Optional[int] = None,
        limit: int = 50,
    ) -> Dict[str, Any]:
        """
        Keyset / cursor pagination for high-volume ledger transactions.
        Avoids database OFFSET overhead on large datasets.
        """
        lim = min(200, max(1, limit))
        query = db.query(models.JournalLine).options(
            joinedload(models.JournalLine.journal_entry)
        )

        if account_id:
            query = query.filter(models.JournalLine.account_id == account_id)
        if company_id:
            query = query.filter(models.JournalLine.company_id == company_id)

        if cursor_id:
            query = query.filter(models.JournalLine.id < cursor_id)

        query = query.order_by(desc(models.JournalLine.id)).limit(lim + 1)
        records = query.all()

        has_more = len(records) > lim
        items = records[:lim]
        next_cursor = str(items[-1].id) if (has_more and items) else None

        return {
            "items": [
                {
                    "id": jl.id,
                    "journal_entry_id": jl.journal_entry_id,
                    "entry_number": jl.journal_entry.entry_number if jl.journal_entry else None,
                    "entry_date": jl.journal_entry.entry_date.isoformat() if jl.journal_entry else None,
                    "account_code": jl.account_code,
                    "account_name": jl.account_name,
                    "debit": float(jl.debit),
                    "credit": float(jl.credit),
                    "party_type": jl.party_type,
                    "party_name": jl.party_name,
                    "description": jl.description,
                    "company_id": jl.company_id,
                }
                for jl in items
            ],
            "cursor": str(cursor_id) if cursor_id else None,
            "next_cursor": next_cursor,
            "has_more": has_more,
        }

    @staticmethod
    def global_search(db: Session, query_str: str, company_id: Optional[int] = None, limit: int = 10) -> Dict[str, Any]:
        """
        Global cross-entity search across:
        Invoices, Customers, Suppliers, Shipments/Containers, Bank references, Journals.
        """
        q = f"%{query_str.strip()}%"
        results: Dict[str, List[Any]] = {
            "invoices": [],
            "customers": [],
            "suppliers": [],
            "containers": [],
            "bank_transactions": [],
            "journals": [],
        }

        # 1. Invoices
        inv_q = db.query(models.Invoice).filter(models.Invoice.invoice_number.ilike(q))
        if company_id:
            inv_q = inv_q.filter(models.Invoice.company_id == company_id)
        for inv in inv_q.limit(limit).all():
            results["invoices"].append({
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "customer_name": (getattr(inv.customer, "customer_name", getattr(inv.customer, "name", "Customer"))) if inv.customer else "Customer",
                "total_amount": float(inv.total_amount or 0),
                "balance_due": float(inv.balance_due or 0),
                "payment_status": inv.payment_status or "OPEN",
            })

        # 2. Containers / Shipments
        shp_q = db.query(models.Shipment).filter(
            or_(
                models.Shipment.container_number.ilike(q),
                models.Shipment.bl_number.ilike(q),
                models.Shipment.truck_number.ilike(q),
                models.Shipment.shipment_code.ilike(q),
            )
        )
        if company_id:
            shp_q = shp_q.filter(models.Shipment.company_id == company_id)
        for shp in shp_q.limit(limit).all():
            results["containers"].append({
                "id": shp.id,
                "shipment_code": shp.shipment_code,
                "container_number": shp.container_number,
                "bl_number": shp.bl_number,
                "invoice_number": shp.invoice_number,
                "truck_number": shp.truck_number,
            })

        # 3. Customers
        cust_q = db.query(models.Customer).filter(
            or_(
                models.Customer.name.ilike(q),
                models.Customer.company_name.ilike(q),
            )
        )
        for cust in cust_q.limit(limit).all():
            results["customers"].append({
                "id": cust.id,
                "customer_name": cust.company_name or cust.name,
                "country": cust.country,
                "total_invoiced": float(cust.total_invoiced_usd or 0),
                "balance_due": float(cust.balance_due_usd or 0),
            })

        # 4. Suppliers
        for sup in db.query(models.Supplier).filter(models.Supplier.name.ilike(q)).limit(limit).all():
            results["suppliers"].append({
                "id": sup.id,
                "supplier_name": sup.name,
                "country": sup.country,
            })

        # 5. Bank Transactions
        tx_q = db.query(models.BankTransaction).filter(
            or_(
                models.BankTransaction.transaction_code.ilike(q),
                models.BankTransaction.party_name.ilike(q),
                models.BankTransaction.transaction_reference.ilike(q),
            )
        )
        if company_id:
            tx_q = tx_q.filter(models.BankTransaction.company_id == company_id)
        for tx in tx_q.limit(limit).all():
            results["bank_transactions"].append({
                "id": tx.id,
                "transaction_code": tx.transaction_code,
                "party_name": tx.party_name,
                "money_in": float(tx.money_in),
                "money_out": float(tx.money_out),
            })

        # 6. Journals
        j_q = db.query(models.JournalEntry).filter(
            or_(
                models.JournalEntry.entry_number.ilike(q),
                models.JournalEntry.reference.ilike(q),
                models.JournalEntry.description.ilike(q),
            )
        )
        if company_id:
            j_q = j_q.filter(models.JournalEntry.company_id == company_id)
        for j in j_q.limit(limit).all():
            results["journals"].append({
                "id": j.id,
                "entry_number": j.entry_number,
                "reference": j.reference,
                "description": j.description,
                "total_debit": float(j.total_debit),
            })

        return results
