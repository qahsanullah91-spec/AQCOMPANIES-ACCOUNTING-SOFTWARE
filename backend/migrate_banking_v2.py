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
    print("Starting Banking v2 & MT103 Migration...")
    db_path = os.path.join(BASE_DIR, "aq_companies.db")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # 1. Create tables with SQLAlchemy Base
    Base.metadata.create_all(bind=engine)
    print("Created new tables via SQLAlchemy Base.metadata.")

    # 2. Check and migrate bank_statement_lines table columns if needed
    c.execute("PRAGMA table_info(bank_statement_lines)")
    existing_cols = {row[1] for row in c.fetchall()}

    new_cols = [
        ("batch_id", "INTEGER"),
        ("transaction_date", "DATE"),
        ("value_date", "DATE"),
        ("bank_reference", "VARCHAR(100)"),
        ("swift_reference", "VARCHAR(100)"),
        ("transaction_code", "VARCHAR(50)"),
        ("debit", "NUMERIC(18, 2) DEFAULT 0.00"),
        ("credit", "NUMERIC(18, 2) DEFAULT 0.00"),
        ("balance", "NUMERIC(18, 2) DEFAULT 0.00"),
        ("normalized_amount", "NUMERIC(18, 2) DEFAULT 0.00"),
        ("usd_amount", "NUMERIC(18, 2)"),
        ("counterparty_name", "VARCHAR(150)"),
        ("counterparty_account", "VARCHAR(100)"),
        ("confidence_score", "INTEGER DEFAULT 0"),
        ("matching_reasons", "TEXT"),
        ("suggested_type", "VARCHAR(50)"),
        ("suggested_party_type", "VARCHAR(30)"),
        ("suggested_party_id", "INTEGER"),
        ("suggested_party_name", "VARCHAR(150)"),
        ("suggested_invoice_id", "INTEGER"),
        ("suggested_invoice_number", "VARCHAR(80)"),
        ("raw_source_data", "TEXT"),
        ("created_at", "DATETIME"),
    ]

    for col_name, col_type in new_cols:
        if col_name not in existing_cols:
            print(f"Adding column '{col_name}' to bank_statement_lines...")
            c.execute(f"ALTER TABLE bank_statement_lines ADD COLUMN {col_name} {col_type}")

    # Backfill transaction_date from date, and debit/credit from money_out/money_in
    c.execute("UPDATE bank_statement_lines SET transaction_date = date WHERE transaction_date IS NULL AND date IS NOT NULL")
    c.execute("UPDATE bank_statement_lines SET debit = money_out WHERE debit = 0.0 AND money_out > 0")
    c.execute("UPDATE bank_statement_lines SET credit = money_in WHERE credit = 0.0 AND money_in > 0")
    c.execute("UPDATE bank_statement_lines SET normalized_amount = amount WHERE normalized_amount = 0.0 AND amount > 0")

    conn.commit()
    conn.close()

    # 3. Provision Account 1090 Unidentified Receipts in Chart of Accounts
    session = SessionLocal()
    try:
        acc_1090 = session.query(models.Account).filter(models.Account.account_code == "1090").first()
        if not acc_1090:
            print("Creating Account 1090 Unidentified Receipts (Suspense)...")
            acc_1090 = models.Account(
                account_code="1090",
                account_name="Unidentified Receipts & Suspense Account",
                account_type="LIABILITY",
                sub_type="Current Liability / Suspense",
                description="Temporary clearing suspense account for unverified incoming wire transfers prior to customer identification",
                is_active=True,
                is_system=True,
                currency="USD",
            )
            session.add(acc_1090)
            session.commit()

        # 4. Provision standard BankMappingProfiles
        profiles = [
            {
                "name": "AFGHAN UNITED BANK (AUB) USD",
                "date_col": "Date",
                "val_date_col": "Value Date",
                "desc_col": "Description",
                "debit_col": "Debit",
                "credit_col": "Credit",
                "bal_col": "Balance",
                "ref_col": "Reference",
                "fmt": "%Y-%m-%d",
            },
            {
                "name": "EMIRATES NBD AED / DUBAI",
                "date_col": "Transaction Date",
                "val_date_col": "Booking Date",
                "desc_col": "Narration",
                "debit_col": "Withdrawals",
                "credit_col": "Deposits",
                "bal_col": "Running Balance",
                "ref_col": "Cheque / Ref No",
                "fmt": "%d/%m/%Y",
            },
            {
                "name": "STANDARD CSV / GENERIC",
                "date_col": "Date",
                "val_date_col": "Value Date",
                "desc_col": "Description",
                "debit_col": "Debit",
                "credit_col": "Credit",
                "bal_col": "Balance",
                "ref_col": "Reference",
                "fmt": "%Y-%m-%d",
            },
        ]

        for p in profiles:
            exists = session.query(models.BankMappingProfile).filter(models.BankMappingProfile.profile_name == p["name"]).first()
            if not exists:
                prof = models.BankMappingProfile(
                    profile_name=p["name"],
                    date_column=p["date_col"],
                    value_date_column=p["val_date_col"],
                    description_column=p["desc_col"],
                    debit_column=p["debit_col"],
                    credit_column=p["credit_col"],
                    balance_column=p["bal_col"],
                    reference_column=p["ref_col"],
                    date_format=p["fmt"],
                )
                session.add(prof)

        # 5. Provision Smart Matching Rules
        rules = [
            {
                "name": "Sky Ariana Freight Transport",
                "pattern": "SKY ARIANA",
                "dir": "OUT",
                "party_type": "TRANSPORT",
                "tx_type": "TRANSPORT_PAYMENT",
                "code": "2100",
            },
            {
                "name": "Bank Transfer & SWIFT Fees",
                "pattern": "FEE",
                "dir": "OUT",
                "party_type": "EXPENSE",
                "tx_type": "BANK_CHARGE",
                "code": "5600",
            },
            {
                "name": "Bank Commission Deductions",
                "pattern": "COMMISSION",
                "dir": "OUT",
                "party_type": "EXPENSE",
                "tx_type": "BANK_CHARGE",
                "code": "5600",
            },
            {
                "name": "SWIFT Wire Charges",
                "pattern": "SWIFT CHARGE",
                "dir": "OUT",
                "party_type": "EXPENSE",
                "tx_type": "BANK_CHARGE",
                "code": "5600",
            },
        ]

        for r in rules:
            r_exists = session.query(models.BankMatchingRule).filter(models.BankMatchingRule.rule_name == r["name"]).first()
            if not r_exists:
                bmr = models.BankMatchingRule(
                    rule_name=r["name"],
                    pattern_type="CONTAINS",
                    pattern_value=r["pattern"],
                    direction=r["dir"],
                    target_party_type=r["party_type"],
                    target_transaction_type=r["tx_type"],
                    target_account_code=r["code"],
                    is_active=True,
                    created_by="System",
                )
                session.add(bmr)

        session.commit()
        print("Banking v2 migration & standard seeds completed successfully!")
    finally:
        session.close()

if __name__ == "__main__":
    run_migration()
