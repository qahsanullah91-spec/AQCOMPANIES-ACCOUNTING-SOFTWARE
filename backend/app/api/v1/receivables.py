from datetime import date
from decimal import Decimal
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app import models, schemas
from app.services.receivables.receivable_service import ReceivableService
from app.services.common.transaction_service import TransactionService
from app.services.common.idempotency_service import IdempotencyService
from app.core.permissions import require_company_access
from app.repositories.query_repository import QueryRepository

router = APIRouter(prefix="/receivables", tags=["Receivables & Customer Allocations"])


@router.get("/invoices")
def list_invoices(
    company_id: Optional[int] = Query(None),
    customer_id: Optional[int] = Query(None),
    payment_status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sort_by: str = Query("invoice_date"),
    sort_order: str = Query("desc"),
    x_user_role: Optional[str] = Header("ADMIN", alias="X-User-Role"),
    x_company_id: Optional[int] = Header(None, alias="X-Company-Id"),
    db: Session = Depends(get_db),
):
    """Retrieves paginated invoices with eager-loaded customer names and server-side filtering."""
    if company_id is not None and x_company_id is not None:
        require_company_access(
            user_role=x_user_role,
            target_company_id=company_id,
            allowed_company_ids=[x_company_id],
        )

    return QueryRepository.get_invoices(
        db=db,
        company_id=company_id,
        customer_id=customer_id,
        payment_status=payment_status,
        search=search,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/invoices/{invoice_id}")
def get_invoice(
    invoice_id: int,
    x_user_role: Optional[str] = Header("ADMIN", alias="X-User-Role"),
    x_company_id: Optional[int] = Header(None, alias="X-Company-Id"),
    db: Session = Depends(get_db),
):
    """Retrieves invoice details, items, and historical payment allocations."""
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    if x_company_id is not None and x_user_role not in ("ADMIN", "SUPER_ADMIN"):
        require_company_access(
            user_role=x_user_role,
            target_company_id=inv.company_id,
            allowed_company_ids=[x_company_id],
        )

    outstanding = ReceivableService.get_invoice_outstanding(db, inv.id)
    allocations = (
        db.query(models.PaymentAllocation)
        .filter(models.PaymentAllocation.invoice_id == inv.id)
        .all()
    )

    return {
        "id": inv.id,
        "company_id": inv.company_id,
        "invoice_number": inv.invoice_number,
        "invoice_date": inv.date.isoformat() if getattr(inv, "date", None) else None,
        "customer_id": inv.customer_id,
        "customer_name": inv.customer.customer_name if inv.customer else "Unknown",
        "container_number": inv.shipment.container_number if getattr(inv, "shipment", None) else getattr(inv, "container_number", None),
        "total_amount": float(inv.total_amount or 0),
        "balance_due": float(outstanding or 0),
        "payment_status": inv.payment_status,
        "status": getattr(inv, "status", "ISSUED"),
        "version_id": getattr(inv, "version_id", 1),
        "allocations": [
            {
                "id": a.id,
                "amount": float(getattr(a, "allocated_amount_usd", 0) or 0),
                "date": a.created_at.isoformat() if getattr(a, "created_at", None) else None,
                "notes": getattr(a, "notes", None),
            }
            for a in allocations
        ],
    }


@router.post("/customer-receipts")
def create_customer_receipt(
    payload: schemas.CustomerReceiptRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    x_user_role: Optional[str] = Header("ADMIN", alias="X-User-Role"),
    x_user_name: Optional[str] = Header("Admin", alias="X-User-Name"),
    x_company_id: Optional[int] = Header(None, alias="X-Company-Id"),
    db: Session = Depends(get_db),
):
    """
    Executes an atomic customer receipt operation with optional Idempotency-Key support:
    - Creates BankTransaction (Money In, POSTED)
    - Allocates to invoices with optimistic locking
    - Updates invoice balances and payment statuses
    - Posts authoritative General Ledger journal entry (Dr Bank / Cr AR)
    - Updates bank running balances and logs audit record
    """
    if x_company_id is not None and x_user_role not in ("ADMIN", "SUPER_ADMIN"):
        require_company_access(
            user_role=x_user_role,
            target_company_id=payload.company_id,
            allowed_company_ids=[x_company_id],
        )

    # 1. Check idempotency if key provided
    if idempotency_key:
        is_cached, cached_res = IdempotencyService.process_key(
            db=db,
            key=idempotency_key,
            endpoint="/api/v1/receivables/customer-receipts",
            payload=payload.model_dump(),
            company_id=payload.company_id,
        )
        if is_cached and cached_res:
            return cached_res["data"]

    # 2. Execute atomic financial receipt
    allocations_data = [item.model_dump() for item in payload.allocations]
    result = TransactionService.execute_customer_receipt_atomic(
        db=db,
        company_id=payload.company_id,
        customer_id=payload.customer_id,
        bank_account_id=payload.bank_account_id,
        receipt_amount=payload.receipt_amount,
        receipt_date=payload.receipt_date,
        allocations_data=allocations_data,
        voucher_number=payload.voucher_number,
        reference=payload.reference,
        user_name=x_user_name or "Admin",
    )

    # 3. Save idempotency response if key provided
    if idempotency_key:
        IdempotencyService.save_response(
            db=db,
            key=idempotency_key,
            response_status=200,
            response_data=result,
        )

    return result


@router.post("/allocate")
def allocate_payment(
    payload: schemas.PaymentAllocationRequest,
    db: Session = Depends(get_db),
):
    """Allocates customer payment receipt to one or more invoices with server-side validation."""
    alloc_data = [item.model_dump() for item in payload.allocations]
    result = ReceivableService.allocate_payment(
        db=db,
        bank_tx_id=payload.bank_transaction_id,
        allocations=alloc_data,
    )
    return result


@router.get("/aging")
def get_receivables_aging(
    as_of_date: Optional[date] = Query(None),
    company_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Calculates customer receivable aging brackets (Current, 1-30, 31-60, 61-90, 91-120, 120+)."""
    return ReceivableService.get_receivables_aging(db, as_of_date=as_of_date, company_id=company_id)


@router.get("/receipts/{receipt_id}/pdf")
def get_customer_receipt_pdf(
    receipt_id: int,
    db: Session = Depends(get_db),
):
    """Generates authoritative A4 PDF for a posted customer receipt."""
    from fastapi.responses import StreamingResponse
    from app.services.receivables.receipt_pdf_service import ReceiptPDFService

    tx = db.query(models.BankTransaction).filter(models.BankTransaction.id == receipt_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Customer receipt not found.")

    customer = db.query(models.Customer).filter(models.Customer.id == tx.party_id).first() if tx.party_id else None
    cust_name = customer.customer_name if customer else (tx.party_name or "Valued Customer")

    bank_acc = db.query(models.BankAccount).filter(models.BankAccount.id == tx.bank_account_id).first()
    bank_name = bank_acc.bank_name if bank_acc else (tx.bank_name or "Central Bank")
    acct_num = bank_acc.account_number if bank_acc else (tx.account_number or "AQ-SETTLE-01")

    allocations = (
        db.query(models.PaymentAllocation)
        .filter(models.PaymentAllocation.bank_transaction_id == tx.id)
        .all()
    )
    alloc_list = []
    for a in allocations:
        inv = a.invoice
        inv_no = inv.invoice_number if inv else f"INV-{a.invoice_id}"
        inv_date = inv.date.isoformat() if inv and inv.date else "—"
        inv_tot = float(inv.total_amount) if inv else float(a.allocated_amount_usd)
        inv_rec = float(inv.amount_received) if inv else 0.0
        alloc_list.append({
            "invoice_id": a.invoice_id,
            "invoice_number": inv_no,
            "date": inv_date,
            "total_amount": inv_tot,
            "previously_received": inv_rec,
            "allocated_amount": float(a.allocated_amount_usd),
        })

    je = db.query(models.JournalEntry).filter(models.JournalEntry.reference == tx.transaction_code).first()
    j_num = je.entry_number if je else None

    pdf_buffer = ReceiptPDFService.generate_receipt_pdf(
        customer_name=cust_name,
        bank_name=bank_name,
        account_number=acct_num,
        receipt_date=tx.date,
        amount=tx.money_in,
        currency=tx.currency or "USD",
        reference=tx.transaction_reference,
        mt103_reference=tx.transaction_reference if "MT103" in (tx.transaction_reference or "") else None,
        notes=tx.notes,
        receipt_number=tx.transaction_code,
        journal_number=j_num,
        is_posted=True,
        allocations=alloc_list,
    )

    filename = f"AQ-COMPANIES-CUSTOMER-RECEIPT-{tx.transaction_code}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"},
    )


@router.post("/receipts/pdf-preview")
def preview_customer_receipt_pdf(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
):
    """Generates A4 DRAFT preview PDF for unposted receipt workbench."""
    from fastapi.responses import StreamingResponse
    from app.services.receivables.receipt_pdf_service import ReceiptPDFService

    cust_id = payload.get("customer_id")
    customer = db.query(models.Customer).filter(models.Customer.id == cust_id).first() if cust_id else None
    cust_name = customer.customer_name if customer else "Valued Customer"

    bank_id = payload.get("bank_account_id")
    bank_acc = db.query(models.BankAccount).filter(models.BankAccount.id == bank_id).first() if bank_id else None
    bank_name = bank_acc.bank_name if bank_acc else "Central Treasury Bank"
    acct_num = bank_acc.account_number if bank_acc else "AQ-SETTLE-01"

    allocs = payload.get("allocations", [])
    alloc_list = []
    for a in allocs:
        inv_id = a.get("invoice_id")
        inv = db.query(models.Invoice).filter(models.Invoice.id == inv_id).first() if inv_id else None
        inv_no = inv.invoice_number if inv else a.get("invoice_number", f"INV-{inv_id}")
        inv_date = inv.date.isoformat() if inv and inv.date else str(a.get("date", date.today()))
        inv_tot = float(inv.total_amount) if inv else float(a.get("total_amount", 0))
        inv_rec = float(inv.amount_received) if inv else float(a.get("previously_received", 0))
        alloc_amt = float(a.get("amount", a.get("allocated_amount", 0)))
        alloc_list.append({
            "invoice_id": inv_id,
            "invoice_number": inv_no,
            "date": inv_date,
            "total_amount": inv_tot,
            "previously_received": inv_rec,
            "allocated_amount": alloc_amt,
        })

    pdf_buffer = ReceiptPDFService.generate_receipt_pdf(
        customer_name=cust_name,
        bank_name=bank_name,
        account_number=acct_num,
        receipt_date=payload.get("receipt_date") or date.today(),
        amount=Decimal(str(payload.get("amount") or payload.get("receipt_amount", 0))),
        currency=payload.get("currency", "USD"),
        reference=payload.get("reference"),
        mt103_reference=payload.get("mt103_reference"),
        notes=payload.get("notes"),
        receipt_number="DRAFT-PREVIEW",
        journal_number=None,
        is_posted=False,
        allocations=alloc_list,
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=AQ-COMPANIES-CUSTOMER-RECEIPT-DRAFT.pdf"},
    )


