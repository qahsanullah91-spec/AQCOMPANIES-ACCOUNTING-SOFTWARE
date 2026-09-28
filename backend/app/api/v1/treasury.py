from datetime import date
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app import schemas
from app.services.treasury.treasury_service import TreasuryService

router = APIRouter(prefix="/treasury", tags=["Central Treasury & Intercompany"])


@router.get("/overview")
def get_treasury_overview(
    company_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Retrieves central treasury cash, bank accounts, Sarafi funds, and multi-currency reserves."""
    return TreasuryService.get_group_treasury_overview(db, company_id=company_id)


@router.get("/intercompany")
def get_intercompany_reconciliation(db: Session = Depends(get_db)):
    """Retrieves pair-wise intercompany reconciliation matrix and verifies Due To == Due From."""
    return TreasuryService.get_intercompany_reconciliation(db)


@router.get("/intercompany/aging")
def get_intercompany_aging(db: Session = Depends(get_db)):
    """Retrieves aging schedule for open intercompany transactions."""
    return TreasuryService.get_intercompany_aging(db)


@router.post("/intercompany/transfer")
def create_intercompany_transfer(
    payload: schemas.IntercompanyTransferRequest,
    db: Session = Depends(get_db),
):
    """Creates a balanced dual-sided intercompany transaction between two distinct group entities."""
    tx = TreasuryService.create_intercompany_transfer(
        db=db,
        from_company_id=payload.from_company_id,
        to_company_id=payload.to_company_id,
        amount=payload.amount,
        currency=payload.currency,
        exchange_rate=payload.exchange_rate,
        purpose=payload.purpose,
        tx_date=payload.tx_date,
    )
    return {
        "status": "SUCCESS",
        "transaction_code": tx.transaction_code,
        "amount": float(tx.amount),
        "from_journal_id": tx.from_journal_entry_id,
        "to_journal_id": tx.to_journal_entry_id,
    }


@router.post("/intercompany/{tx_id}/settle")
def settle_intercompany_transfer(tx_id: int, db: Session = Depends(get_db)):
    """Marks an intercompany transaction as settled."""
    tx = TreasuryService.settle_intercompany_transfer(db, tx_id=tx_id)
    return {"status": "SUCCESS", "message": f"Transaction {tx.transaction_code} settled."}


@router.post("/intercompany/{tx_id}/reverse")
def reverse_intercompany_transfer(
    tx_id: int,
    payload: schemas.ReversalRequest,
    db: Session = Depends(get_db),
):
    """Reverses both sides of an intercompany transaction atomically."""
    tx = TreasuryService.reverse_intercompany_transfer(db, tx_id=tx_id, reason=payload.reason)
    return {"status": "SUCCESS", "message": f"Transaction {tx.transaction_code} reversed."}
