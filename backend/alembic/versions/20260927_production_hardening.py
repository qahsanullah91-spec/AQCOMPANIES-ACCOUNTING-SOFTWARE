"""production_hardening_and_reliability

Revision ID: 20260927_prod_hardening
Revises: 1cea37c2cf4c
Create Date: 2026-09-27 08:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision: str = "20260927_prod_hardening"
down_revision: Union[str, Sequence[str], None] = "1cea37c2cf4c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    # 1. Create api_idempotency_keys table
    if "api_idempotency_keys" not in existing_tables:
        op.create_table(
            "api_idempotency_keys",
            sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
            sa.Column("key", sa.String(length=128), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("company_id", sa.Integer(), nullable=True),
            sa.Column("endpoint", sa.String(length=255), nullable=False),
            sa.Column("request_hash", sa.String(length=64), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="PROCESSING"),
            sa.Column("response_status", sa.Integer(), nullable=True),
            sa.Column("response_body", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_api_idempotency_keys_key", "api_idempotency_keys", ["key"], unique=True)
        op.create_index("ix_api_idempotency_keys_status", "api_idempotency_keys", ["status"])
        op.create_index("ix_api_idempotency_keys_created_at", "api_idempotency_keys", ["created_at"])
        op.create_index("ix_api_idempotency_keys_expires_at", "api_idempotency_keys", ["expires_at"])

    # 2. Create background_jobs table
    if "background_jobs" not in existing_tables:
        op.create_table(
            "background_jobs",
            sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
            sa.Column("job_id", sa.String(length=64), nullable=False),
            sa.Column("job_type", sa.String(length=64), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="QUEUED"),
            sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("error", sa.Text(), nullable=True),
            sa.Column("result_json", sa.Text(), nullable=True),
            sa.Column("created_by", sa.String(length=100), nullable=True, server_default="System"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_background_jobs_job_id", "background_jobs", ["job_id"], unique=True)
        op.create_index("ix_background_jobs_job_type", "background_jobs", ["job_type"])
        op.create_index("ix_background_jobs_status", "background_jobs", ["status"])
        op.create_index("ix_background_jobs_created_at", "background_jobs", ["created_at"])

    # Helper for checking if an index exists
    def safe_create_index(index_name: str, table_name: str, columns: list):
        if table_name in existing_tables:
            current_indexes = [ix["name"] for ix in inspector.get_indexes(table_name)]
            if index_name not in current_indexes:
                try:
                    op.create_index(index_name, table_name, columns)
                except Exception:
                    pass

    # 3. Add composite indexes for high-volume financial lookups
    safe_create_index("ix_shipments_comp_date", "shipments", ["company_id", "shipment_date"])
    safe_create_index("ix_shipments_comp_cust", "shipments", ["company_id", "customer_id"])
    safe_create_index("ix_purchases_comp_date", "purchases", ["company_id", "date"])
    safe_create_index("ix_purchases_comp_supp", "purchases", ["company_id", "supplier_id"])
    safe_create_index("ix_invoices_comp_invnum", "invoices", ["company_id", "invoice_number"])
    safe_create_index("ix_invoices_comp_cust_pay", "invoices", ["company_id", "customer_id", "payment_status"])
    safe_create_index("ix_invoices_cust_date", "invoices", ["customer_id", "date"])
    safe_create_index("ix_bank_tx_comp_date", "bank_transactions", ["company_id", "date"])
    safe_create_index("ix_bank_tx_acc_date", "bank_transactions", ["bank_account_id", "date"])
    safe_create_index("ix_bank_tx_party", "bank_transactions", ["party_type", "party_id"])
    safe_create_index("ix_alloc_cust_inv", "payment_allocations", ["customer_id", "invoice_id"])
    safe_create_index("ix_alloc_bank_tx", "payment_allocations", ["bank_transaction_id"])
    safe_create_index("ix_je_comp_date", "journal_entries", ["company_id", "entry_date"])
    safe_create_index("ix_je_comp_doc", "journal_entries", ["company_id", "source_document_type", "source_document_id"])
    safe_create_index("ix_jl_acc_comp", "journal_lines", ["account_id", "company_id"])
    safe_create_index("ix_jl_party", "journal_lines", ["party_type", "party_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    def safe_drop_index(index_name: str, table_name: str):
        if table_name in existing_tables:
            current_indexes = [ix["name"] for ix in inspector.get_indexes(table_name)]
            if index_name in current_indexes:
                try:
                    op.drop_index(index_name, table_name=table_name)
                except Exception:
                    pass

    safe_drop_index("ix_jl_party", "journal_lines")
    safe_drop_index("ix_jl_acc_comp", "journal_lines")
    safe_drop_index("ix_je_comp_doc", "journal_entries")
    safe_drop_index("ix_je_comp_date", "journal_entries")
    safe_drop_index("ix_alloc_bank_tx", "payment_allocations")
    safe_drop_index("ix_alloc_cust_inv", "payment_allocations")
    safe_drop_index("ix_bank_tx_party", "bank_transactions")
    safe_drop_index("ix_bank_tx_acc_date", "bank_transactions")
    safe_drop_index("ix_bank_tx_comp_date", "bank_transactions")
    safe_drop_index("ix_invoices_cust_date", "invoices")
    safe_drop_index("ix_invoices_comp_cust_pay", "invoices")
    safe_drop_index("ix_invoices_comp_invnum", "invoices")
    safe_drop_index("ix_purchases_comp_supp", "purchases")
    safe_drop_index("ix_purchases_comp_date", "purchases")
    safe_drop_index("ix_shipments_comp_cust", "shipments")
    safe_drop_index("ix_shipments_comp_date", "shipments")

    if "background_jobs" in existing_tables:
        op.drop_table("background_jobs")

    if "api_idempotency_keys" in existing_tables:
        op.drop_table("api_idempotency_keys")
