from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.repositories.query_repository import QueryRepository

router = APIRouter(tags=["Global Search"])


@router.get("/search")
def global_search(
    q: str = Query(..., min_length=1, description="Search query across invoices, containers, customers, journals"),
    company_id: Optional[int] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """
    Unified global search across:
    Invoices, Customers, Suppliers, Containers, BL numbers, Trucks, Bank references, and Journals.
    """
    return QueryRepository.global_search(db, query_str=q, company_id=company_id, limit=limit)
