import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "aq_companies.db")

def add_column_if_not_exists(cursor, table, column, col_type):
    cursor.execute(f"PRAGMA table_info({table})")
    cols = [row[1] for row in cursor.fetchall()]
    if column not in cols:
        print(f"Adding column '{column}' ({col_type}) to table '{table}'...")
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
    else:
        print(f"Column '{column}' already exists in table '{table}'.")

def migrate():
    print(f"Connecting to database at {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. bank_accounts
    add_column_if_not_exists(cursor, "bank_accounts", "account_type", "VARCHAR(30) DEFAULT 'BANK'")
    add_column_if_not_exists(cursor, "bank_accounts", "iban", "VARCHAR(100)")
    add_column_if_not_exists(cursor, "bank_accounts", "swift", "VARCHAR(100)")
    add_column_if_not_exists(cursor, "bank_accounts", "opening_balance_date", "DATE")
    add_column_if_not_exists(cursor, "bank_accounts", "available_balance", "NUMERIC(18, 2) DEFAULT 0.00")
    add_column_if_not_exists(cursor, "bank_accounts", "status", "VARCHAR(30) DEFAULT 'ACTIVE'")

    # 2. bank_transactions
    add_column_if_not_exists(cursor, "bank_transactions", "document_date", "DATE")
    add_column_if_not_exists(cursor, "bank_transactions", "posting_date", "DATE")
    add_column_if_not_exists(cursor, "bank_transactions", "due_date", "DATE")
    add_column_if_not_exists(cursor, "bank_transactions", "bank_reference", "VARCHAR(100)")
    add_column_if_not_exists(cursor, "bank_transactions", "swift_reference", "VARCHAR(100)")
    add_column_if_not_exists(cursor, "bank_transactions", "mt103_reference", "VARCHAR(100)")
    add_column_if_not_exists(cursor, "bank_transactions", "sarafi_reference", "VARCHAR(100)")
    add_column_if_not_exists(cursor, "bank_transactions", "cheque_number", "VARCHAR(100)")
    add_column_if_not_exists(cursor, "bank_transactions", "fx_gain_loss", "NUMERIC(18, 2) DEFAULT 0.00")
    add_column_if_not_exists(cursor, "bank_transactions", "approval_status", "VARCHAR(30) DEFAULT 'POSTED'")
    add_column_if_not_exists(cursor, "bank_transactions", "is_reversed", "BOOLEAN DEFAULT 0")
    add_column_if_not_exists(cursor, "bank_transactions", "reversal_of_id", "INTEGER")
    add_column_if_not_exists(cursor, "bank_transactions", "reversed_by_id", "INTEGER")
    add_column_if_not_exists(cursor, "bank_transactions", "approved_by", "VARCHAR(50)")
    add_column_if_not_exists(cursor, "bank_transactions", "approved_at", "DATETIME")
    add_column_if_not_exists(cursor, "bank_transactions", "reversal_reason", "TEXT")

    # 3. payment_allocations
    add_column_if_not_exists(cursor, "payment_allocations", "allocation_type", "VARCHAR(30) DEFAULT 'INVOICE_PAYMENT'")
    add_column_if_not_exists(cursor, "payment_allocations", "notes", "TEXT")

    # 4. bank_statement_lines
    add_column_if_not_exists(cursor, "bank_statement_lines", "bank_account_id", "INTEGER")
    add_column_if_not_exists(cursor, "bank_statement_lines", "batch_id", "VARCHAR(50)")

    conn.commit()
    conn.close()
    print("Database migration completed successfully!")

if __name__ == "__main__":
    migrate()
