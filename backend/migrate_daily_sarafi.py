import sqlite3
import os
import sys
from datetime import datetime, date
from decimal import Decimal

# Ensure backend root is on sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from app.database import engine, Base, SessionLocal
from app import models

def run_migration():
    print("=" * 70)
    print("Starting Daily Accounting, Cash, Bank & Sarafi Migration...")
    print("=" * 70)

    db_path = os.path.join(BASE_DIR, "aq_companies.db")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # 1. Create tables with SQLAlchemy Base
    Base.metadata.create_all(bind=engine)
    print("[MIGRATION] Created new tables via SQLAlchemy Base.metadata.")

    # 2. Add contact_phone and gl_account_code to bank_accounts if missing
    c.execute("PRAGMA table_info(bank_accounts)")
    bank_acc_cols = {row[1] for row in c.fetchall()}

    if "contact_phone" not in bank_acc_cols:
        print("[MIGRATION] Adding column 'contact_phone' to bank_accounts...")
        c.execute("ALTER TABLE bank_accounts ADD COLUMN contact_phone VARCHAR(50)")

    if "gl_account_code" not in bank_acc_cols:
        print("[MIGRATION] Adding column 'gl_account_code' to bank_accounts...")
        c.execute("ALTER TABLE bank_accounts ADD COLUMN gl_account_code VARCHAR(20)")

    # 3. Add voucher_number to bank_transactions if missing
    c.execute("PRAGMA table_info(bank_transactions)")
    bank_tx_cols = {row[1] for row in c.fetchall()}

    if "voucher_number" not in bank_tx_cols:
        print("[MIGRATION] Adding column 'voucher_number' to bank_transactions...")
        c.execute("ALTER TABLE bank_transactions ADD COLUMN voucher_number VARCHAR(50)")

    conn.commit()
    conn.close()

    # 4. Provision Chart of Accounts & Seed Accounts via Session
    session = SessionLocal()
    try:
        # Check and add Account 4150 Sales Returns & Allowances
        acc_4150 = session.query(models.Account).filter(models.Account.account_code == "4150").first()
        if not acc_4150:
            print("[MIGRATION] Creating Account 4150 Sales Returns & Allowances...")
            acc_4150 = models.Account(
                account_code="4150",
                account_name="Sales Returns & Allowances",
                account_type="REVENUE",
                sub_type="Contra Revenue",
                description="Credit notes issued to buyers for quality claims, weight adjustments, or trade discounts",
                is_active=True,
                is_system=True,
                currency="USD",
            )
            session.add(acc_4150)

        # Check and add Account 6450 Cash Shortage / Overage
        acc_6450 = session.query(models.Account).filter(models.Account.account_code == "6450").first()
        if not acc_6450:
            print("[MIGRATION] Creating Account 6450 Cash Shortage / Overage...")
            acc_6450 = models.Account(
                account_code="6450",
                account_name="Cash Shortage / Overage",
                account_type="EXPENSE",
                sub_type="Operating Expense",
                description="Variance resulting from physical cash counts vs ledger cash balance",
                is_active=True,
                is_system=True,
                currency="USD",
            )
            session.add(acc_6450)

        session.commit()

        # 5. Provision standard Cash Accounts
        cash_accounts = [
            {
                "bank_name": "Cash Vault - USD",
                "account_name": "AQ Companies Main Cash USD",
                "account_number": "CASH-VAULT-USD",
                "currency": "USD",
                "account_type": "CASH",
                "gl_account_code": "1010",
                "branch": "Kabul Head Office",
            },
            {
                "bank_name": "Cash Vault - AFN",
                "account_name": "AQ Companies Main Cash AFN",
                "account_number": "CASH-VAULT-AFN",
                "currency": "AFN",
                "account_type": "CASH",
                "gl_account_code": "1020",
                "branch": "Kabul Head Office",
            },
            {
                "bank_name": "Cash Vault - AED",
                "account_name": "AQ Companies Trade Cash AED",
                "account_number": "CASH-VAULT-AED",
                "currency": "AED",
                "account_type": "CASH",
                "gl_account_code": "1010",
                "branch": "Dubai Trade Desk",
            },
            {
                "bank_name": "Cash Vault - INR",
                "account_name": "AQ Companies Local Cash INR",
                "account_number": "CASH-VAULT-INR",
                "currency": "INR",
                "account_type": "CASH",
                "gl_account_code": "1010",
                "branch": "Delhi / Khari Baoli Office",
            },
        ]

        for ca in cash_accounts:
            existing = session.query(models.BankAccount).filter(models.BankAccount.account_number == ca["account_number"]).first()
            if not existing:
                print(f"[MIGRATION] Creating Cash Account {ca['account_number']} ({ca['currency']})...")
                acc = models.BankAccount(
                    bank_name=ca["bank_name"],
                    account_name=ca["account_name"],
                    account_number=ca["account_number"],
                    currency=ca["currency"],
                    account_type=ca["account_type"],
                    gl_account_code=ca["gl_account_code"],
                    branch=ca["branch"],
                    opening_balance=Decimal("0.00"),
                    current_balance=Decimal("0.00"),
                    available_balance=Decimal("0.00"),
                    status="ACTIVE",
                    notes="Official Cash on Hand Account",
                )
                session.add(acc)
            else:
                existing.gl_account_code = ca["gl_account_code"]

        # 6. Provision standard Sarafi Accounts
        sarafi_accounts = [
            {
                "bank_name": "Omid Ehsan Sarafi - AFN",
                "account_name": "AQ Companies Hawala Desk (AFN)",
                "account_number": "SAR-OMID-EHSAN-AFN",
                "currency": "AFN",
                "account_type": "SARAFI",
                "gl_account_code": "1030",
                "branch": "Sarai Shahzada, Kabul",
                "phone": "+93 70 012 3456",
            },
            {
                "bank_name": "Omid Ehsan Sarafi - USD",
                "account_name": "AQ Companies Hawala Desk (USD)",
                "account_number": "SAR-OMID-EHSAN-USD",
                "currency": "USD",
                "account_type": "SARAFI",
                "gl_account_code": "1030",
                "branch": "Sarai Shahzada, Kabul",
                "phone": "+93 70 012 3456",
            },
            {
                "bank_name": "Kabul Shahzada General Exchange",
                "account_name": "AQ Companies Hawala Clearing Desk",
                "account_number": "SAR-SHAHZADA-AFN",
                "currency": "AFN",
                "account_type": "SARAFI",
                "gl_account_code": "1030",
                "branch": "Kabul Shahzada Market",
                "phone": "+93 79 988 7766",
            },
        ]

        for sa in sarafi_accounts:
            existing = session.query(models.BankAccount).filter(models.BankAccount.account_number == sa["account_number"]).first()
            if not existing:
                print(f"[MIGRATION] Creating Sarafi Account {sa['account_number']} ({sa['currency']})...")
                acc = models.BankAccount(
                    bank_name=sa["bank_name"],
                    account_name=sa["account_name"],
                    account_number=sa["account_number"],
                    currency=sa["currency"],
                    account_type=sa["account_type"],
                    gl_account_code=sa["gl_account_code"],
                    branch=sa["branch"],
                    contact_phone=sa["phone"],
                    opening_balance=Decimal("0.00"),
                    current_balance=Decimal("0.00"),
                    available_balance=Decimal("0.00"),
                    status="ACTIVE",
                    notes="Sarafi / Hawala Clearing Account",
                )
                session.add(acc)
            else:
                existing.gl_account_code = sa["gl_account_code"]
                existing.contact_phone = sa["phone"]

        # Backfill voucher_number on existing BankTransactions if empty
        txs = session.query(models.BankTransaction).filter(models.BankTransaction.voucher_number == None).all()
        for t in txs:
            # Map transaction_type to voucher numbering
            prefix = "BRV"
            if t.bank_account_rel and t.bank_account_rel.account_type == "CASH":
                prefix = "CRV" if t.money_in > 0 else "CPV"
            elif t.bank_account_rel and t.bank_account_rel.account_type == "SARAFI":
                prefix = "SRV" if t.money_in > 0 else "SPV"
            else:
                prefix = "BRV" if t.money_in > 0 else "BPV"

            t.voucher_number = f"{prefix}-{t.date.strftime('%Y')}-{t.id:06d}"

        session.commit()
        print("[MIGRATION] Successfully committed cash & sarafi accounts and voucher backfills!")

    finally:
        session.close()

    print("=" * 70)
    print("Daily Accounting & Sarafi Migration Complete!")
    print("=" * 70)

if __name__ == "__main__":
    run_migration()
