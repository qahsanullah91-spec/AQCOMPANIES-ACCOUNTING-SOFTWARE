from datetime import date
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.payables.payable_service import PayableService
from app.services.reporting.financial_reports_service import FinancialReportsService

router = APIRouter(prefix="/payables", tags=["Payables & Supplier Accounts"])


@router.get("/summary")
def get_payables_summary(
    company_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Summarizes confirmed supplier obligations and reports pending supplier bills."""
    return PayableService.get_payables_summary(db, company_id=company_id)


@router.get("/suppliers/{supplier_id}")
def get_supplier_payable(
    supplier_id: int,
    company_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Calculates supplier payable balance and counts purchases with pending purchase cost."""
    return PayableService.get_supplier_outstanding(db, supplier_id=supplier_id, company_id=company_id)


@router.get("/aging")
def get_payables_aging(
    as_of_date: Optional[date] = Query(None),
    company_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Calculates supplier payable aging brackets and lists pending cargo purchases."""
    return FinancialReportsService.get_ap_aging(db, as_of_date=as_of_date, company_id=company_id)
