from datetime import date
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app import models, schemas
from app.services.accounting.posting_service import PostingService
from app.services.accounting.general_ledger_service import GeneralLedgerService
from app.services.accounting.reversal_service import ReversalService
from app.services.accounting.period_service import PeriodService

router = APIRouter(prefix="/accounting", tags=["Accounting Engine"])


@router.post("/journal", response_model=Dict[str, Any])
def create_journal(
    payload: schemas.JournalEntryCreate,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
):
    """Creates an authoritative double-entry journal entry with strict debit/credit validation."""
    lines_data = [l.model_dump() for l in payload.lines]
    journal = PostingService.create_journal_entry(
        db=db,
        company_id=payload.company_id,
        entry_date=payload.entry_date,
        entry_type=payload.entry_type,
        description=payload.description,
        lines=lines_data,
        reference=payload.reference,
        source_document_type=payload.source_document_type,
        source_document_id=payload.source_document_id,
        posting_key=payload.posting_key,
        idempotency_key=idempotency_key,
    )
    return {
        "status": "SUCCESS",
        "journal_id": journal.id,
        "entry_number": journal.entry_number,
        "total_debit": float(journal.total_debit),
        "total_credit": float(journal.total_credit),
    }


@router.get("/journal")
def list_journals(
    company_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Retrieves journal entries with server-side filtering and pagination."""
    query = db.query(models.JournalEntry)
    if company_id:
        query = query.filter(models.JournalEntry.company_id == company_id)
    if status:
        query = query.filter(models.JournalEntry.status == status.upper())
    if date_from:
        query = query.filter(models.JournalEntry.entry_date >= date_from)
    if date_to:
        query = query.filter(models.JournalEntry.entry_date <= date_to)

    total = query.count()
    items = (
        query.order_by(desc(models.JournalEntry.entry_date), desc(models.JournalEntry.id))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "page": page,
        "page_size": page_size,
        "total_count": total,
        "items": [
            {
                "id": j.id,
                "entry_number": j.entry_number,
                "entry_date": j.entry_date.isoformat() if j.entry_date else None,
                "entry_type": j.entry_type,
                "description": j.description,
                "reference": j.reference,
                "total_debit": float(j.total_debit),
                "total_credit": float(j.total_credit),
                "status": j.status,
                "reversed_entry_id": j.reversed_entry_id,
            }
            for j in items
        ],
    }


@router.get("/journal/{journal_id}")
def get_journal(journal_id: int, db: Session = Depends(get_db)):
    """Retrieves single journal entry and all individual debit/credit lines."""
    journal = db.query(models.JournalEntry).filter(models.JournalEntry.id == journal_id).first()
    if not journal:
        raise HTTPException(status_code=404, detail="Journal entry not found.")

    return {
        "id": journal.id,
        "entry_number": journal.entry_number,
        "entry_date": journal.entry_date.isoformat() if journal.entry_date else None,
        "entry_type": journal.entry_type,
        "description": journal.description,
        "reference": journal.reference,
        "total_debit": float(journal.total_debit),
        "total_credit": float(journal.total_credit),
        "status": journal.status,
        "reversed_entry_id": journal.reversed_entry_id,
        "reversal_reason": journal.reversal_reason,
        "lines": [
            {
                "id": l.id,
                "line_number": l.line_number,
                "account_id": l.account_id,
                "account_code": l.account.account_code if l.account else None,
                "account_name": l.account.account_name if l.account else None,
                "debit": float(l.debit),
                "credit": float(l.credit),
                "description": l.description,
                "party_type": l.party_type,
                "party_id": l.party_id,
            }
            for l in journal.lines
        ],
    }


@router.post("/journal/{journal_id}/reverse")
def reverse_journal(
    journal_id: int,
    payload: schemas.ReversalRequest,
    db: Session = Depends(get_db),
):
    """Executes atomic reversal workflow for a posted journal entry."""
    rev = ReversalService.reverse_journal_entry(
        db=db,
        journal_id=journal_id,
        reason=payload.reason,
    )
    return {
        "status": "SUCCESS",
        "message": f"Journal entry reversed successfully.",
        "reversal_journal_id": rev.id,
        "reversal_entry_number": rev.entry_number,
    }


@router.get("/trial-balance")
def get_trial_balance(
    as_of_date: Optional[date] = Query(None),
    company_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Generates authoritative Trial Balance directly from posted general ledger lines."""
    return GeneralLedgerService.get_trial_balance(db, as_of_date=as_of_date, company_id=company_id)


@router.get("/periods")
def list_periods(
    company_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Lists accounting periods and their lock/close status."""
    q = db.query(models.AccountingPeriod)
    if company_id:
        q = q.filter(models.AccountingPeriod.company_id == company_id)
    periods = q.order_by(desc(models.AccountingPeriod.period_year), desc(models.AccountingPeriod.period_month)).all()
    return {
        "periods": [
            {
                "id": p.id,
                "period_name": p.period_name,
                "year": p.period_year,
                "month": p.period_month,
                "status": p.status,
                "closed_at": p.closed_at.isoformat() if p.closed_at else None,
                "closed_by": p.closed_by,
            }
            for p in periods
        ]
    }


@router.post("/periods/{period_id}/close")
def close_period(
    period_id: int,
    payload: schemas.PeriodCloseRequest,
    db: Session = Depends(get_db),
):
    """Closes accounting period after checklist verification and captures financial snapshot."""
    p = PeriodService.close_period(db, period_id=period_id, notes=payload.notes)
    return {"status": "SUCCESS", "message": f"Period {p.period_name} is now CLOSED."}


@router.post("/periods/{period_id}/reopen")
def reopen_period(
    period_id: int,
    payload: schemas.PeriodReopenRequest,
    db: Session = Depends(get_db),
):
    """Reopens a closed accounting period with mandatory auditor justification."""
    p = PeriodService.reopen_period(db, period_id=period_id, reason=payload.reason)
    return {"status": "SUCCESS", "message": f"Period {p.period_name} is now REOPENED."}


# -------------------------------------------------------------
# ACCOUNTING INTEGRITY & RECONCILIATIONS (SECTIONS 17, 18, 19, 20)
# -------------------------------------------------------------
@router.get("/integrity")
def accounting_integrity_audit(db: Session = Depends(get_db)):
    """SECTIONS 17-20: Full accounting integrity scan."""
    from app.services.accounting.integrity_service import AccountingIntegrityService
    return AccountingIntegrityService.run_full_accounting_integrity_audit(db)


@router.get("/reconciliations")
def subledger_reconciliations(db: Session = Depends(get_db)):
    """SECTION 18: Subledger Reconciliations (AR, AP, Bank, Transport, Cash vs GL)."""
    from app.services.accounting.integrity_service import AccountingIntegrityService
    return AccountingIntegrityService.reconcile_subledgers(db)


@router.get("/baselines")
def golden_baselines_verification(db: Session = Depends(get_db)):
    """SECTIONS 69-71: Golden business baselines verification."""
    from app.services.accounting.integrity_service import AccountingIntegrityService
    return AccountingIntegrityService.verify_golden_baselines(db)

