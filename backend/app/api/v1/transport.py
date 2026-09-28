from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.transport.transport_service import TransportService

router = APIRouter(prefix="/transport", tags=["Transport Accounting"])


@router.get("/position")
def get_transport_position(
    carrier_id: int = Query(1, description="Transport company ID (defaults to Sky Ariana)"),
    company_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Retrieves carrier ledger balance preserving sign semantics:
    Charges: $743,650 | Payments: $1,030,000 | Opening Credit: $4,810 => Net: -$291,160.00
    (Meaning: $291,160.00 Credit in AQ Companies Favor).
    """
    return TransportService.get_transport_carrier_position(
        db=db,
        transport_company_id=carrier_id,
        company_id=company_id,
    )
