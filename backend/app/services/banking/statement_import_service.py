from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.banking_automation import (
    parse_bank_statement_file,
    commit_statement_batch,
    match_statement_row,
)


class StatementImportService:
    """
    Bank Statement Import and Parsing Service.
    Parses CSV, JSON, XLSX, and TXT bank statements, computes SHA256 hashes,
    detects duplicates, and provides previews before user-approved posting.
    """

    @staticmethod
    def parse_statement(
        filename: str,
        content: bytes,
        bank_account_id: int,
        bank_name: str,
        db: Session,
    ) -> Dict[str, Any]:
        return parse_bank_statement_file(filename, content, bank_account_id, bank_name, db)

    @staticmethod
    def commit_batch(
        db: Session,
        bank_account_id: int,
        batch_id: int,
        user_name: str = "Admin",
    ) -> Dict[str, Any]:
        return commit_statement_batch(db, bank_account_id, batch_id, user_name)
