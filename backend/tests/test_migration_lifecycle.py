import os
import tempfile
import pytest
from alembic.config import Config
from alembic import command
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

from app.database import engine
from app import models


def test_current_database_has_hardened_tables():
    """Verifies that the primary database has the newly created tables and columns."""
    inspector = sa.inspect(engine)
    tables = inspector.get_table_names()
    assert "api_idempotency_keys" in tables
    assert "background_jobs" in tables

    # Verify idempotency table columns
    idemp_cols = {col["name"] for col in inspector.get_columns("api_idempotency_keys")}
    assert "key" in idemp_cols
    assert "request_hash" in idemp_cols
    assert "status" in idemp_cols
    assert "response_body" in idemp_cols

    # Verify background jobs table columns
    job_cols = {col["name"] for col in inspector.get_columns("background_jobs")}
    assert "job_id" in job_cols
    assert "job_type" in job_cols
    assert "status" in job_cols
    assert "progress" in job_cols


def test_alembic_upgrade_and_downgrade_lifecycle():
    """
    Spins up a temporary clean database and executes full Alembic lifecycle:
    upgrade to head -> downgrade -> upgrade back to head.
    """
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp_db_path = tmp.name

    try:
        tmp_url = f"sqlite:///{tmp_db_path}"
        alembic_cfg = Config("alembic.ini")
        alembic_cfg.set_main_option("sqlalchemy.url", tmp_url)

        # 1. Run upgrade to head
        command.upgrade(alembic_cfg, "head")
        tmp_engine = sa.create_engine(tmp_url)
        insp1 = sa.inspect(tmp_engine)
        tables1 = insp1.get_table_names()
        assert "api_idempotency_keys" in tables1
        assert "background_jobs" in tables1

        # 2. Run downgrade back to 1cea37c2cf4c
        command.downgrade(alembic_cfg, "1cea37c2cf4c")
        insp2 = sa.inspect(tmp_engine)
        tables2 = insp2.get_table_names()
        assert "api_idempotency_keys" not in tables2
        assert "background_jobs" not in tables2

        # 3. Re-upgrade to head
        command.upgrade(alembic_cfg, "head")
        insp3 = sa.inspect(tmp_engine)
        tables3 = insp3.get_table_names()
        assert "api_idempotency_keys" in tables3
        assert "background_jobs" in tables3

    finally:
        if os.path.exists(tmp_db_path):
            try:
                os.remove(tmp_db_path)
            except Exception:
                pass
