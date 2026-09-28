from datetime import date
from decimal import Decimal
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app import models
from app.multi_company_engine import (
    get_central_treasury_summary,
    get_intercompany_reconciliation,
    get_intercompany_aging,
    create_intercompany_transaction,
    settle_intercompany_transaction,
    reverse_intercompany_transaction,
)


class TreasuryService:
    """
    Central Treasury & Multi-Company Liquidity Service.
    Integrates multi-currency positions across banks, vaults, and Sarafi accounts,
    and governs intercompany transactions and reconciliations.
    """

    @staticmethod
    def get_group_treasury_overview(db: Session, company_id: Optional[int] = None) -> Dict[str, Any]:
        return get_central_treasury_summary(db, company_id=company_id)

    @staticmethod
    def get_intercompany_reconciliation(db: Session) -> Dict[str, Any]:
        return get_intercompany_reconciliation(db)

    @staticmethod
    def get_intercompany_aging(db: Session) -> List[Dict[str, Any]]:
        return get_intercompany_aging(db)

    @staticmethod
    def create_intercompany_transfer(
        db: Session,
        from_company_id: int,
        to_company_id: int,
        amount: Decimal,
        currency: str = "USD",
        exchange_rate: Decimal = Decimal("1.0"),
        purpose: str = "Intercompany Working Capital Transfer",
        user_name: str = "Admin",
        tx_date: Optional[date] = None,
    ) -> models.IntercompanyTransaction:
        return create_intercompany_transaction(
            db=db,
            from_company_id=from_company_id,
            to_company_id=to_company_id,
            amount=amount,
            currency=currency,
            exchange_rate=exchange_rate,
            purpose=purpose,
            user_name=user_name,
            tx_date=tx_date,
        )

    @staticmethod
    def settle_intercompany_transfer(
        db: Session,
        tx_id: int,
        user_name: str = "Admin",
    ) -> models.IntercompanyTransaction:
        return settle_intercompany_transaction(db, tx_id, user_name=user_name)

    @staticmethod
    def reverse_intercompany_transfer(
        db: Session,
        tx_id: int,
        reason: str,
        user_name: str = "Admin",
    ) -> models.IntercompanyTransaction:
        return reverse_intercompany_transaction(db, tx_id, reason=reason, user_name=user_name)
