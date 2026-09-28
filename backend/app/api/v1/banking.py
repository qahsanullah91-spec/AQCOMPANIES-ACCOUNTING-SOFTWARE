from datetime import date
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app import models, schemas
from app.services.banking.banking_service import BankingService
from app.services.banking.statement_import_service import StatementImportService
from app.services.reconciliation.reconciliation_service import ReconciliationService
from app.repositories.query_repository import QueryRepository

router = APIRouter(prefix="/banking", tags=["Banking Engine & Reconciliation"])


@router.get("/accounts")
def list_accounts(
    company_id: Optional[int] = Query(None),
    account_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Lists bank, cash vault, and Sarafi accounts with live running balances."""
    query = db.query(models.BankAccount).filter(models.BankAccount.status != "CLOSED")
    if company_id:
        query = query.filter(models.BankAccount.company_id == company_id)
    if account_type:
        query = query.filter(models.BankAccount.account_type == account_type.upper())

    accounts = query.order_by(models.BankAccount.id).all()
    return {
        "accounts": [
            {
                "id": a.id,
                "company_id": a.company_id,
                "bank_name": a.bank_name,
                "account_name": a.account_name,
                "account_number": a.account_number,
                "account_type": a.account_type,
                "currency": a.currency,
                "opening_balance": float(a.opening_balance),
                "current_balance": float(a.current_balance),
                "status": a.status,
            }
            for a in accounts
        ]
    }


@router.get("/transactions")
def list_transactions(
    bank_account_id: Optional[int] = Query(None),
    company_id: Optional[int] = Query(None),
    party_type: Optional[str] = Query(None),
    transaction_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Retrieves paginated bank transactions with server-side filters."""
    return QueryRepository.get_bank_transactions(
        db=db,
        bank_account_id=bank_account_id,
        company_id=company_id,
        party_type=party_type,
        transaction_type=transaction_type,
        status=status,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )


@router.post("/transfer")
def transfer_funds(
    payload: schemas.MoneyTransferRequest,
    db: Session = Depends(get_db),
):
    """Executes internal fund transfer between two accounts of the same entity."""
    tx = BankingService.execute_money_transfer(
        db=db,
        from_account_id=payload.from_account_id,
        to_account_id=payload.to_account_id,
        amount=payload.amount,
        transfer_date=payload.transfer_date,
        purpose=payload.purpose,
    )
    return {
        "status": "SUCCESS",
        "transfer_id": tx.id,
        "transfer_code": tx.transfer_code,
        "amount": float(tx.amount),
    }


@router.post("/statement/upload")
async def upload_bank_statement(
    bank_account_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Uploads and parses a bank statement (CSV, JSON, TXT) and checks for duplicates."""
    acc = db.query(models.BankAccount).filter(models.BankAccount.id == bank_account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Bank account not found.")

    content = await file.read()
    return StatementImportService.parse_statement(
        filename=file.filename or "statement.csv",
        content=content,
        bank_account_id=acc.id,
        bank_name=acc.bank_name,
        db=db,
    )


@router.post("/statement/commit")
def commit_statement_batch(
    bank_account_id: int = Query(...),
    batch_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Atomically commits a reviewed statement batch and updates bank ledger balances."""
    return StatementImportService.commit_batch(
        db=db,
        bank_account_id=bank_account_id,
        batch_id=batch_id,
    )


@router.post("/reconcile/match")
def confirm_reconciliation_match(
    statement_line_id: int = Query(...),
    match_type: str = Query(...),
    payload: Dict[str, Any] = None,
    db: Session = Depends(get_db),
):
    """Confirms and posts single bank statement match."""
    return ReconciliationService.confirm_and_post_match(
        db=db,
        statement_line_id=statement_line_id,
        match_type=match_type,
        match_data=payload or {},
    )
