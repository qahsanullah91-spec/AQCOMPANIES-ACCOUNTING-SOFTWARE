from datetime import date
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.reporting.financial_reports_service import FinancialReportsService
from app.multi_company_engine import (
    get_consolidated_profit_and_loss,
    get_consolidated_balance_sheet,
)

router = APIRouter(prefix="/reports", tags=["Financial Reports & Consolidation"])


@router.get("/profit-loss")
def get_profit_and_loss(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    company_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Generates Profit & Loss Statement with strict quarantine on unverified purchase costs."""
    return FinancialReportsService.get_profit_and_loss(
        db=db,
        start_date=start_date,
        end_date=end_date,
        company_id=company_id,
    )


@router.get("/balance-sheet")
def get_balance_sheet(
    as_of_date: Optional[date] = Query(None),
    company_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Generates Balance Sheet enforcing Assets = Liabilities + Equity with Transport Advances in Assets."""
    return FinancialReportsService.get_balance_sheet(
        db=db,
        as_of_date=as_of_date,
        company_id=company_id,
    )


@router.get("/cash-flow")
def get_cash_flow(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    company_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Generates Cash Flow Statement directly from cleared bank transactions."""
    return FinancialReportsService.get_cash_flow(
        db=db,
        start_date=start_date,
        end_date=end_date,
        company_id=company_id,
    )


@router.get("/trial-balance")
def get_trial_balance(
    as_of_date: Optional[date] = Query(None),
    company_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Generates 8-Column Trial Balance."""
    return FinancialReportsService.get_trial_balance(
        db=db,
        as_of_date=as_of_date,
        company_id=company_id,
    )


@router.get("/consolidated/profit-loss")
def get_consolidated_pnl(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """Generates multi-column Consolidated Profit & Loss with intercompany eliminations."""
    return get_consolidated_profit_and_loss(db, start_date=start_date, end_date=end_date)


@router.get("/consolidated/balance-sheet")
def get_consolidated_bs(
    as_of_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """Generates Consolidated Balance Sheet eliminating Due To/From and verifying equation balance."""
    return get_consolidated_balance_sheet(db, as_of_date=as_of_date)


@router.get("/monthly-summary")
def get_monthly_summary(
    year: Optional[int] = Query(None),
    company_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Generates monthly group financial performance summary."""
    return FinancialReportsService.get_monthly_summary(db, year=year, company_id=company_id)
