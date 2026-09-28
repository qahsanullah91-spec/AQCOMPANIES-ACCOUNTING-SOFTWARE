from datetime import date
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.financial_reports_engine import (
    get_detailed_trial_balance_report,
    get_balance_sheet_report,
    get_profit_and_loss_report,
    get_cash_flow_statement_report,
    get_receivable_aging_report,
    get_payable_aging_report,
    get_monthly_financial_summary_report,
)


class FinancialReportsService:
    """
    Comprehensive Financial Reporting Engine for AQ COMPANIES.
    Generates audited GAAP/IFRS financial statements, ledger reconciliations,
    and aging schedules with strict adherence to the NULL accounting rule.
    """

    @staticmethod
    def get_trial_balance(db: Session, as_of_date: Optional[date] = None, company_id: Optional[int] = None) -> Dict[str, Any]:
        return get_detailed_trial_balance_report(db, as_of_date=as_of_date)

    @staticmethod
    def get_balance_sheet(db: Session, as_of_date: Optional[date] = None, company_id: Optional[int] = None) -> Dict[str, Any]:
        return get_balance_sheet_report(db, as_of_date=as_of_date)

    @staticmethod
    def get_profit_and_loss(
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        company_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        return get_profit_and_loss_report(db, start_date=start_date, end_date=end_date)

    @staticmethod
    def get_cash_flow(
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        company_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        return get_cash_flow_statement_report(db, start_date=start_date, end_date=end_date)

    @staticmethod
    def get_ar_aging(db: Session, as_of_date: Optional[date] = None, company_id: Optional[int] = None) -> Dict[str, Any]:
        return get_receivable_aging_report(db, as_of_date=as_of_date)

    @staticmethod
    def get_ap_aging(db: Session, as_of_date: Optional[date] = None, company_id: Optional[int] = None) -> Dict[str, Any]:
        return get_payable_aging_report(db, as_of_date=as_of_date)

    @staticmethod
    def get_monthly_summary(db: Session, year: Optional[int] = None, company_id: Optional[int] = None) -> Dict[str, Any]:
        return get_monthly_financial_summary_report(db, fiscal_year=year or 2026)
