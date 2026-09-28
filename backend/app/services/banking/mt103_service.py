from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.banking_automation import (
    parse_swift_mt103,
    record_swift_mt103,
)


class MT103Service:
    """
    SWIFT MT103 Document Parsing & Matching Engine.
    Extracts Field 20 (Sender's Reference), Field 32A (Value Date/Currency/Amount),
    Field 50K (Ordering Customer), Field 59 (Beneficiary), and Field 70 (Remittance Info).
    """

    @staticmethod
    def parse_raw_mt103(raw_text: str) -> Dict[str, Any]:
        return parse_swift_mt103(raw_text)

    @staticmethod
    def record_and_match_mt103(
        db: Session,
        raw_text: str,
        filename: Optional[str] = None,
        company_id: Optional[int] = 1,
    ) -> Dict[str, Any]:
        return record_swift_mt103(db, raw_text, filename=filename, company_id=company_id)
