"""
AQ COMPANIES — Post-Go-Live Stabilization & Live Operations API Router
Exposes stabilization dashboard, daily reviews, error tracking,
support issue management, missing purchase costs, and month-end readiness.
"""
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.logging import get_system_errors, resolve_system_error
from app.services.stabilization.stabilization_service import StabilizationService

router = APIRouter(prefix="/stabilization", tags=["Post-Go-Live Stabilization & Month-End Readiness"])


class SupportIssueCreate(BaseModel):
    user_name: str = Field(default="Operator", description="User reporting the issue")
    page: str = Field(..., description="Application page or route")
    description: str = Field(..., description="Detailed issue description")
    priority: str = Field(default="P2", description="P0, P1, P2, P3")
    category: str = Field(default="BUG", description="BUG, USABILITY, MISSING_REPORT, PERFORMANCE, FEATURE_REQUEST")
    company_id: Optional[int] = Field(default=None)
    transaction_number: Optional[str] = Field(default=None)
    request_id: Optional[str] = Field(default=None)


class ResolvePayload(BaseModel):
    notes: str = Field(default="Issue verified and resolved in production.")


@router.get("/dashboard")
def get_stabilization_dashboard(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Aggregates real-time post-go-live health metrics and exit gate status."""
    return StabilizationService.get_stabilization_dashboard(db)


@router.get("/daily-review")
def get_daily_operational_reviews(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Returns daily operational reviews for banking, receivables, payables, and transport."""
    return StabilizationService.get_daily_operational_reviews(db)


@router.get("/missing-purchase-costs")
def get_missing_purchase_costs_report(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Itemized list of shipments where purchase cost is strictly pending."""
    return StabilizationService.get_missing_purchase_costs_report(db)


@router.get("/profit-readiness")
def get_profit_readiness_report(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Distinguishes verified profit from incomplete profit due to pending costs."""
    return StabilizationService.get_profit_readiness_report(db)


@router.get("/month-end-readiness")
def get_month_end_readiness(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Pre-close accounting checklist and required report package status."""
    return StabilizationService.get_month_end_readiness(db)


@router.get("/exit-criteria")
def get_stabilization_exit_criteria(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Evaluates 7-point criteria for safely exiting post-go-live stabilization."""
    return StabilizationService.get_stabilization_exit_criteria(db)


@router.get("/errors")
def get_production_errors(
    limit: int = Query(50, ge=1, le=200),
    unresolved_only: bool = Query(False),
    severity: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    """Returns real production errors collected from Frontend, FastAPI, DB, and Mobile."""
    return get_system_errors(limit=limit, unresolved_only=unresolved_only, severity=severity, source=source)


@router.post("/errors/{error_id}/resolve")
def resolve_error(error_id: str) -> Dict[str, Any]:
    """Marks a production error as resolved by admin."""
    success = resolve_system_error(error_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Error {error_id} not found in buffer.")
    return {"success": True, "error_id": error_id, "status": "RESOLVED"}


@router.get("/support-issues")
def get_support_issues(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    """Retrieves list of internal support issues."""
    return StabilizationService.get_support_issues(status=status, category=category, priority=priority)


@router.post("/support-issues")
def submit_support_issue(payload: SupportIssueCreate) -> Dict[str, Any]:
    """Submits an internal support issue or routes feature requests to backlog."""
    return StabilizationService.record_support_issue(
        user_name=payload.user_name,
        page=payload.page,
        description=payload.description,
        priority=payload.priority,
        category=payload.category,
        company_id=payload.company_id,
        transaction_number=payload.transaction_number,
        request_id=payload.request_id,
    )


@router.post("/support-issues/{issue_id}/resolve")
def resolve_support_issue(issue_id: str, payload: ResolvePayload) -> Dict[str, Any]:
    """Resolves an internal support issue with resolution notes."""
    success = StabilizationService.resolve_support_issue(issue_id, payload.notes)
    if not success:
        raise HTTPException(status_code=404, detail=f"Support issue {issue_id} not found.")
    return {"success": True, "issue_id": issue_id, "status": "RESOLVED"}


@router.get("/feature-backlog")
def get_feature_backlog() -> List[Dict[str, Any]]:
    """Returns future feature requests segregated from stabilization mode."""
    return StabilizationService.get_feature_backlog()
