from datetime import date
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app import models
from app.core.exceptions import AccountingError, ValidationError
from app.services.accounting.posting_service import (
    PostingService,
    generate_journal_entry_number,
    round_money,
)


class ReversalService:
    """
    Standard Reversal Engine for AQ COMPANIES.
    Ensures posted records are never hard-deleted; instead creates perfect counter-entries
    and links reversed_entry_id bidirectionally.
    """

    @staticmethod
    def reverse_journal_entry(
        db: Session,
        journal_id: int,
        reason: str,
        user_name: str = "Admin",
        reversal_date: Optional[date] = None,
    ) -> models.JournalEntry:
        """
        Creates an exact inverted counter-journal entry and marks original as REVERSED.
        """
        original = db.query(models.JournalEntry).filter(models.JournalEntry.id == journal_id).first()
        if not original:
            raise AccountingError(f"Journal entry ID {journal_id} not found.")

        if original.status == "REVERSED":
            raise ValidationError(f"Journal entry {original.entry_number} is already REVERSED.")

        rev_date = reversal_date or date.today()
        comp = db.query(models.Company).filter(models.Company.id == original.company_id).first()
        comp_code = comp.company_code if comp else "AQ"
        rev_number = generate_journal_entry_number(db, rev_date, "REV", comp_code)

        # Build inverted lines (Swap debits and credits)
        counter_lines = []
        for line in original.lines:
            counter_lines.append(
                models.JournalLine(
                    account_id=line.account_id,
                    account_code=line.account_code,
                    account_name=line.account_name,
                    line_number=line.line_number,
                    debit=line.credit,  # Swap
                    credit=line.debit,  # Swap
                    description=f"Reversal of line {line.line_number}: {reason}",
                    party_type=line.party_type,
                    party_id=line.party_id,
                    party_name=line.party_name,
                    currency=line.currency,
                    exchange_rate=line.exchange_rate,
                    amount_currency=line.amount_currency,
                    amount_usd=line.amount_usd,
                    company_id=original.company_id,
                )
            )

        reversal_entry = models.JournalEntry(
            company_id=original.company_id,
            entry_number=rev_number,
            entry_date=rev_date,
            entry_type="REVERSAL",
            description=f"REVERSAL of {original.entry_number}: {reason}",
            reference=original.entry_number,
            source_document_type="JOURNAL_ENTRY",
            source_document_id=original.id,
            total_debit=original.total_credit,
            total_credit=original.total_debit,
            status="POSTED",
            reversed_entry_id=original.id,
            reversal_reason=reason,
            posting_key=f"REV:{original.entry_number}",
            version_id=1,
        )
        db.add(reversal_entry)
        db.flush()

        for cl in counter_lines:
            cl.journal_entry_id = reversal_entry.id
            db.add(cl)

        # Update original
        original.status = "REVERSED"
        original.reversed_entry_id = reversal_entry.id
        original.reversal_reason = reason

        # Log audit event
        audit = models.AuditLog(
            entity_type="JournalEntry",
            entity_id=original.id,
            action="REVERSE",
            user_name=user_name,
            reason=reason,
            old_value_json=f'{{"status": "POSTED"}}',
            new_value_json=f'{{"status": "REVERSED", "reversal_entry": "{reversal_entry.entry_number}"}}',
        )
        db.add(audit)
        db.commit()
        db.refresh(reversal_entry)
        return reversal_entry
