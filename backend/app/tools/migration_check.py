"""
AQ COMPANIES — Migration Safety & Pre-Flight Inspector
Command: python -m app.tools.migration_check
Evaluates current schema revision against target head, determines pending migrations,
assesses operational risk, and verifies pre-deploy backup prerequisites.
"""
import os
import sys
from typing import Dict, Any, List, Optional
from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext
import sqlalchemy as sa

# Add backend directory to sys.path
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.core.config import settings


def get_migration_status(db_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Programmatically inspects the current database revision and Alembic heads.
    Returns structured analysis of pending migrations and risk.
    """
    target_url = db_url or settings.DATABASE_URL
    alembic_ini_path = os.path.join(BACKEND_DIR, "alembic.ini")
    config = Config(alembic_ini_path)
    config.set_main_option("sqlalchemy.url", target_url)

    script = ScriptDirectory.from_config(config)
    head_rev = script.get_current_head()

    engine = sa.create_engine(target_url)
    with engine.connect() as conn:
        context = MigrationContext.configure(conn)
        current_rev = context.get_current_revision()

    # Determine pending migrations
    pending_revs: List[str] = []
    if current_rev != head_rev:
        # Traverse from head down to current
        for rev in script.walk_revisions(head_rev, current_rev):
            if rev.revision != current_rev:
                pending_revs.append(rev.revision)

    # Determine migration risk
    risk = "LOW"
    risk_reasons = []
    for rev_id in pending_revs:
        sc = script.get_revision(rev_id)
        if sc and sc.module:
            doc = sc.doc or ""
            # Inspect upgrade code for high-risk operations
            upgrade_src = getattr(sc.module, "upgrade", None)
            src_text = str(getattr(upgrade_src, "__code__", ""))
            if "drop_table" in doc.lower() or "drop_table" in src_text:
                risk = "HIGH"
                risk_reasons.append(f"Revision {rev_id} contains DROP TABLE")
            elif "drop_column" in doc.lower() or "drop_column" in src_text:
                risk = "HIGH"
                risk_reasons.append(f"Revision {rev_id} contains DROP COLUMN")
            elif "alter_column" in src_text:
                if risk != "HIGH":
                    risk = "MEDIUM"
                risk_reasons.append(f"Revision {rev_id} modifies column definitions")

    return {
        "current_revision": current_rev or "None (Empty Database)",
        "target_revision": head_rev,
        "is_up_to_date": (current_rev == head_rev),
        "pending_count": len(pending_revs),
        "pending_revisions": pending_revs,
        "migration_risk": risk,
        "risk_reasons": risk_reasons,
        "backup_required": len(pending_revs) > 0,
        "database_dialect": engine.dialect.name,
    }


def main():
    print("=" * 70)
    print("AQ COMPANIES — DATABASE MIGRATION PRE-FLIGHT CHECK")
    print("=" * 70)

    try:
        status = get_migration_status()
    except Exception as exc:
        print(f"[FATAL] Failed to inspect migration state: {exc}")
        sys.exit(1)

    print(f"Database Dialect:     {status['database_dialect'].upper()}")
    print(f"Current Revision:     {status['current_revision']}")
    print(f"Target Head Revision: {status['target_revision']}")
    print(f"Pending Migrations:   {status['pending_count']}")

    if status["pending_revisions"]:
        print("\nPending Revision List:")
        for idx, rev in enumerate(status["pending_revisions"], 1):
            print(f"  {idx}. {rev}")

    print("-" * 70)
    print(f"Migration Risk:       {status['migration_risk']}")
    if status["risk_reasons"]:
        for r in status["risk_reasons"]:
            print(f"  - Warning: {r}")
    print(f"Backup Required:      {'YES (MANDATORY)' if status['backup_required'] else 'NO (Schema is current)'}")
    print("=" * 70)

    if status["is_up_to_date"]:
        print("[OK] Database schema is fully up to date with head revision.")
        sys.exit(0)
    else:
        print("[WARNING] Migrations pending. Run pre-deploy backup before executing 'alembic upgrade head'.")
        sys.exit(2)


if __name__ == "__main__":
    main()
