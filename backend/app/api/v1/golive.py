"""
AQ COMPANIES — Go-Live & Release Readiness API Router
Exposes comprehensive readiness checklist, baseline difference reports,
production data verification, and release control endpoints.
"""
from typing import Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.golive.golive_service import GoLiveService

router = APIRouter(prefix="/golive", tags=["Go-Live & Production Readiness"])


@router.get("/checklist")
def get_golive_checklist(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Retrieves full 14-section Go-Live readiness checklist with release gate status."""
    return GoLiveService.generate_golive_checklist(db)


@router.get("/baseline-report")
def get_baseline_difference_report(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Retrieves authoritative accounting baseline difference report."""
    return GoLiveService.get_baseline_difference_report(db)


@router.get("/production-data")
def get_production_data_audit(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Audits current real database record counts and flags data discrepancies."""
    return GoLiveService.audit_production_data(db)


@router.get("/release-notes")
def get_release_notes() -> Dict[str, Any]:
    """Returns official production release notes and known operational disclosures."""
    return GoLiveService.get_release_notes()


@router.post("/run-audit")
def run_live_audit(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Executes on-demand comprehensive go-live validation audit."""
    checklist = GoLiveService.generate_golive_checklist(db)
    baselines = GoLiveService.get_baseline_difference_report(db)
    data_audit = GoLiveService.audit_production_data(db)
    return {
        "status": checklist["release_gate"]["status"],
        "ready_for_review": checklist["release_gate"]["ready_for_review"],
        "checklist": checklist,
        "baselines": baselines,
        "production_data": data_audit,
    }
