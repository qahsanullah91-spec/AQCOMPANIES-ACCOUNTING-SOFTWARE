import os
import shutil
import sqlite3
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import text

try:
    from app.database import engine, get_db, Base
    from app import models
except ImportError:
    from backend.app.database import engine, get_db, Base
    from backend.app import models

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BACKEND_DIR, "aq_companies.db")
BACKUPS_DIR = os.path.join(BACKEND_DIR, "backups")

COMPANIES_SEED_DATA = [
    {
        "id": 1,
        "company_code": "AQ-HQ",
        "company_name": "AQ COMPANIES",
        "legal_name": "AQ Companies Trading LLC",
        "trade_license_no": "TL-DXB-98421",
        "tax_number": "TAX-AE-1002948",
        "country": "UAE",
        "address": "Deira, Dubai, United Arab Emirates",
        "phone": "+971 4 223 8900",
        "email": "accounts@aqcompanies.com",
        "base_currency": "USD",
        "color_accent": "#2563eb",
        "status": "ACTIVE",
    },
    {
        "id": 2,
        "company_code": "NA-LTD",
        "company_name": "NAJEB AMIN LTD",
        "legal_name": "Najeb Amin Commercial Ltd",
        "trade_license_no": "TL-KBL-44102",
        "tax_number": "TAX-AF-89104",
        "country": "Afghanistan",
        "address": "Shahzada Market, Kabul, Afghanistan",
        "phone": "+93 79 123 4567",
        "email": "accounts@najebamin.com",
        "base_currency": "USD",
        "color_accent": "#16a34a",
        "status": "ACTIVE",
    },
    {
        "id": 3,
        "company_code": "SA-LTD",
        "company_name": "SKY ARIANA LTD",
        "legal_name": "Sky Ariana Logistics Ltd",
        "trade_license_no": "TL-DXB-55319",
        "tax_number": "TAX-AE-3004812",
        "country": "UAE",
        "address": "Al Garhoud, Dubai, UAE / Kabul",
        "phone": "+971 4 881 2300",
        "email": "finance@skyariana.com",
        "base_currency": "USD",
        "color_accent": "#d97706",
        "status": "ACTIVE",
    },
    {
        "id": 4,
        "company_code": "RN-LTD",
        "company_name": "RAHMAT NAZAR LTD",
        "legal_name": "Rahmat Nazar Trading Ltd",
        "trade_license_no": "TL-KBL-66291",
        "tax_number": "TAX-AF-99201",
        "country": "Afghanistan",
        "address": "Kabul, Afghanistan",
        "phone": "+93 70 882 1122",
        "email": "accounts@rahmatnazar.com",
        "base_currency": "USD",
        "color_accent": "#9333ea",
        "status": "ACTIVE",
    },
]

TABLES_NEEDING_COMPANY_ID = [
    "customers",
    "suppliers",
    "shipments",
    "purchases",
    "invoices",
    "bank_accounts",
    "bank_transactions",
    "expenses",
    "documents",
    "transport_charges",
    "transport_payments",
    "customer_payments",
    "supplier_payments",
    "journal_entries",
    "journal_lines",
    "bank_reconciliations",
    "bank_import_batches",
    "accounting_periods",
    "money_transfers",
    "cash_counts",
    "daily_closes",
    "accounting_notes",
    "opening_balance_entries",
    "period_financial_snapshots",
    "budget_entries",
    "cash_forecast_items",
    "approval_requests",
]


def backup_database_before_migration() -> str:
    """Safely checkpoints WAL and creates a timestamped pre-migration backup."""
    os.makedirs(BACKUPS_DIR, exist_ok=True)
    if os.path.exists(DB_PATH):
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            conn.close()
        except Exception as e:
            print(f"[Migration Warning] Checkpoint warning: {e}")

        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        backup_file = os.path.join(BACKUPS_DIR, f"aq_companies_before_multicompany_{ts}.db")
        shutil.copy2(DB_PATH, backup_file)
        print(f"[Migration] Safe pre-migration backup created: {backup_file}")
        return backup_file
    return ""


def run_multi_company_migration(db: Session = None):
    """Executes database schema migration, table creation, column additions, and data backfilling."""
    print("[Migration] Starting Multi-Company Migration...")
    backup_database_before_migration()

    # 1. Create any missing tables defined in Base.metadata
    Base.metadata.create_all(bind=engine)

    # 2. Add company_id column to existing tables using raw SQLite connection
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    for table_name in TABLES_NEEDING_COMPANY_ID:
        try:
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = [row[1] for row in cursor.fetchall()]
            if columns and "company_id" not in columns:
                print(f"[Migration] Adding company_id to {table_name}...")
                cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN company_id INTEGER REFERENCES companies(id);")
                cursor.execute(f"CREATE INDEX IF NOT EXISTS ix_{table_name}_company_id ON {table_name}(company_id);")
        except Exception as err:
            print(f"[Migration Error] Could not alter table {table_name}: {err}")

    conn.commit()
    conn.close()

    # 3. Seed Companies and backfill historical data using SQLAlchemy session
    close_db_at_end = False
    if db is None:
        db = next(get_db())
        close_db_at_end = True

    try:
        # Seed Companies
        for c_data in COMPANIES_SEED_DATA:
            comp = db.query(models.Company).filter(models.Company.company_code == c_data["company_code"]).first()
            if not comp:
                comp = models.Company(
                    id=c_data["id"],
                    company_code=c_data["company_code"],
                    company_name=c_data["company_name"],
                    legal_name=c_data["legal_name"],
                    trade_license_no=c_data["trade_license_no"],
                    tax_number=c_data["tax_number"],
                    country=c_data["country"],
                    address=c_data["address"],
                    phone=c_data["phone"],
                    email=c_data["email"],
                    base_currency=c_data["base_currency"],
                    color_accent=c_data["color_accent"],
                    status=c_data["status"],
                )
                db.add(comp)
                db.commit()
                print(f"[Migration] Seeded company: {c_data['company_name']} ({c_data['company_code']})")

        # Seed User Company Access for all active users
        users = db.query(models.User).all()
        companies = db.query(models.Company).all()
        for u in users:
            for c in companies:
                access = db.query(models.UserCompanyAccess).filter(
                    models.UserCompanyAccess.user_id == u.id,
                    models.UserCompanyAccess.company_id == c.id
                ).first()
                if not access:
                    is_admin = (u.role == "ADMIN")
                    access = models.UserCompanyAccess(
                        user_id=u.id,
                        company_id=c.id,
                        role="ADMIN" if is_admin else "ACCOUNTANT",
                        can_view=True,
                        can_create=True,
                        can_edit=True,
                        can_post=True,
                        can_approve=is_admin,
                    )
                    db.add(access)
        db.commit()

        # Seed Intercompany Accounts in Chart of Accounts
        intercompany_accounts = [
            {
                "account_code": "1370",
                "account_name": "Due From Related Companies",
                "account_type": "ASSET",
                "sub_type": "Current Assets",
                "description": "Intercompany receivable due from related group entities",
            },
            {
                "account_code": "2350",
                "account_name": "Due To Related Companies",
                "account_type": "LIABILITY",
                "sub_type": "Current Liabilities",
                "description": "Intercompany payable due to related group entities",
            },
        ]
        for acc_info in intercompany_accounts:
            existing_acc = db.query(models.Account).filter(models.Account.account_code == acc_info["account_code"]).first()
            if not existing_acc:
                new_acc = models.Account(
                    account_code=acc_info["account_code"],
                    account_name=acc_info["account_name"],
                    account_type=acc_info["account_type"],
                    sub_type=acc_info["sub_type"],
                    description=acc_info["description"],
                    is_active=True,
                    is_system=True,
                    currency="USD",
                )
                db.add(new_acc)
                print(f"[Migration] Seeded Intercompany Account: {acc_info['account_code']} - {acc_info['account_name']}")
        db.commit()

        # Backfill existing data with company_id = 1 (AQ COMPANIES)
        # We do this cleanly via raw SQL updates so every historical table is populated
        for table_name in TABLES_NEEDING_COMPANY_ID:
            try:
                res = db.execute(text(f"UPDATE {table_name} SET company_id = 1 WHERE company_id IS NULL"))
                if res.rowcount > 0:
                    print(f"[Migration] Assigned {res.rowcount} records in '{table_name}' to company_id = 1 (AQ COMPANIES)")
            except Exception as e:
                print(f"[Migration Warning] Update company_id on {table_name}: {e}")
        db.commit()

        # Seed CompanyCustomerAccount and CompanySupplierAccount for Company 1
        all_customers = db.query(models.Customer).all()
        for cust in all_customers:
            cust_acc = db.query(models.CompanyCustomerAccount).filter(
                models.CompanyCustomerAccount.company_id == 1,
                models.CompanyCustomerAccount.customer_id == cust.id
            ).first()
            if not cust_acc:
                cust_acc = models.CompanyCustomerAccount(
                    company_id=1,
                    customer_id=cust.id,
                    opening_balance=Decimal("0.00"),
                    credit_limit=Decimal("0.00"),
                    notes="Baseline entity customer ledger"
                )
                db.add(cust_acc)

        all_suppliers = db.query(models.Supplier).all()
        for sup in all_suppliers:
            sup_acc = db.query(models.CompanySupplierAccount).filter(
                models.CompanySupplierAccount.company_id == 1,
                models.CompanySupplierAccount.supplier_id == sup.id
            ).first()
            if not sup_acc:
                sup_acc = models.CompanySupplierAccount(
                    company_id=1,
                    supplier_id=sup.id,
                    opening_balance=Decimal("0.00"),
                    notes="Baseline entity supplier ledger"
                )
                db.add(sup_acc)

        db.commit()
        print("[Migration] Multi-Company Migration finished successfully!")

    finally:
        if close_db_at_end:
            db.close()


if __name__ == "__main__":
    run_multi_company_migration()
