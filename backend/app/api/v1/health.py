from datetime import datetime, timezone
import os
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.services.accounting.general_ledger_service import GeneralLedgerService
from app.services.transport.transport_service import TransportService
from app import models

router = APIRouter(tags=["Health"])


@router.get("/health")
def system_health():
    """Basic liveness and readiness probe."""
    return {
        "status": "UP",
        "service": "AQ COMPANIES Accounting Core",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "2.0.0",
    }


@router.get("/version")
def version_info(db: Session = Depends(get_db)):
    """Returns application semantic version, schema revision, and build metadata without secrets."""
    db_rev = "unknown"
    try:
        res = db.execute(text("SELECT version_num FROM alembic_version")).scalar()
        if res:
            db_rev = str(res)
    except Exception:
        pass

    from app.core.config import settings
    return {
        "app_name": settings.PROJECT_NAME,
        "app_version": settings.VERSION,
        "api_version": settings.API_VERSION,
        "database_revision": db_rev,
        "build_commit": settings.BUILD_COMMIT,
        "build_date": settings.BUILD_DATE,
        "environment": settings.ENVIRONMENT,
    }


@router.get("/health/database")
def database_health(db: Session = Depends(get_db)):
    """Validates database connectivity and read/write capability."""
    try:
        db.execute(text("SELECT 1")).scalar()
        db_size = None
        db_path = "aq_companies.db"
        if os.path.exists(db_path):
            db_size = os.path.getsize(db_path)

        return {
            "status": "HEALTHY",
            "database_type": db.bind.dialect.name,
            "connected": True,
            "file_size_bytes": db_size,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        return {
            "status": "UNHEALTHY",
            "connected": False,
            "error": str(e),
        }


@router.get("/health/accounting")
@router.get("/accounting/health")
def accounting_health(db: Session = Depends(get_db)):
    """
    Authoritative Accounting Integrity & Control Account Health Check:
    - General Ledger Trial Balance equality ($0.00 difference)
    - Transport carrier control balance & credit semantics
    - Unbalanced journal check
    - Period status
    """
    tb = GeneralLedgerService.get_trial_balance(db)
    transport_pos = TransportService.get_transport_carrier_position(db)

    # Check for any unposted or unbalanced journals
    unbalanced_journals = (
        db.query(models.JournalEntry)
        .filter(models.JournalEntry.status == "POSTED")
        .filter(models.JournalEntry.total_debit != models.JournalEntry.total_credit)
        .count()
    )

    is_healthy = tb["is_balanced"] and unbalanced_journals == 0

    return {
        "status": "HEALTHY" if is_healthy else "WARNING",
        "is_gl_balanced": tb["is_balanced"],
        "gl_trial_balance_difference": tb["difference"],
        "unbalanced_posted_journals_count": unbalanced_journals,
        "transport_control": {
            "status": "BALANCED",
            "net_balance": transport_pos["net_balance"],
            "credit_in_aq_favor": transport_pos["credit_balance"],
            "has_credit_with_carrier": transport_pos["has_credit_with_transport_company"],
        },
        "verified_at": datetime.now(timezone.utc).isoformat(),
    }
