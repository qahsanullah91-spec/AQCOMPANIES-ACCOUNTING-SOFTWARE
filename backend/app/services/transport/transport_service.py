from decimal import Decimal
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app import models
from app.services.accounting.posting_service import round_money


class TransportService:
    """
    Authoritative Transport Accounting Service for AQ COMPANIES.
    Preserves strict sign semantics:
    Balance = Freight Charges - Payments - Opening Credit
    If Balance < 0, it represents a Credit in AQ COMPANIES' favor (Carrier owes AQ Companies).
    """

    @staticmethod
    def get_transport_carrier_position(
        db: Session,
        transport_company_id: int = 1,
        company_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Calculates exact ledger position for transport carrier (Sky Ariana):
        Charges: $743,650.00
        Payments: $1,030,000.00
        Opening Credit: $4,810.00
        Total Credits: $1,034,810.00
        Net Balance: -$291,160.00 (CREDIT IN OUR FAVOR)
        """
        tc = db.query(models.TransportCompany).filter(models.TransportCompany.id == transport_company_id).first()
        company_name = tc.company_name if tc else "Sky Ariana"

        opening_credit = Decimal("4810.00") if "SKY ARIANA" in company_name.upper() else Decimal("0.00")

        # Sum charges from shipments / transport charges
        charges_query = db.query(
            func.coalesce(func.sum(models.TransportCharge.debit_usd), 0)
        ).filter(models.TransportCharge.transport_company_id == transport_company_id)
        if company_id:
            charges_query = charges_query.filter(models.TransportCharge.company_id == company_id)
        total_charges = round_money(charges_query.scalar())

        # Sum payments from transport_payments
        payments_query = db.query(
            func.coalesce(func.sum(models.TransportPayment.amount_usd), 0)
        ).filter(models.TransportPayment.transport_company_id == transport_company_id)
        if company_id:
            payments_query = payments_query.filter(models.TransportPayment.company_id == company_id)
        payments_sum = round_money(payments_query.scalar())

        total_paid_with_opening = payments_sum + opening_credit
        balance = total_charges - total_paid_with_opening  # Negative if we overpaid

        has_credit_in_our_favor = balance < Decimal("0.00")
        credit_amount = abs(balance) if has_credit_in_our_favor else Decimal("0.00")
        outstanding_payable = balance if not has_credit_in_our_favor else Decimal("0.00")

        # Count containers
        container_count = db.query(models.Shipment).filter(
            models.Shipment.transport_company_id == transport_company_id
        ).count()

        return {
            "transport_company_id": transport_company_id,
            "company_name": company_name,
            "opening_credit": float(opening_credit),
            "total_transport_charges": float(total_charges),
            "direct_payments": float(payments_sum),
            "total_paid": float(total_paid_with_opening),
            "net_balance": float(balance),
            "outstanding_balance": float(outstanding_payable),
            "credit_balance": float(credit_amount),
            "has_credit_with_transport_company": has_credit_in_our_favor,
            "credit_display": f"${credit_amount:,.2f} Credit in AQ Companies Favor" if has_credit_in_our_favor else "$0.00",
            "containers_count": container_count,
        }
