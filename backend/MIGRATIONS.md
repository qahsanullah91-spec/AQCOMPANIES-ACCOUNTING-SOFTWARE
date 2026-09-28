# AQ COMPANIES — Database Migration Runbook

## Overview
This runbook establishes strict rules for authoring, testing, and applying Alembic database migrations in **AQ COMPANIES**. The primary directive is: **Zero Financial Data Loss**.

---

## 1. Pre-Flight Migration Inspection
Before executing any migration on staging or production:
1. Run the migration pre-flight checker:
   ```bash
   python -m app.tools.migration_check
   # or
   aq migration-status
   ```
2. The pre-flight tool inspects:
   - **Current Database Revision**: Read directly from the `alembic_version` table.
   - **Target Head Revision**: Read from Alembic script directory.
   - **Pending Migrations**: Sequence of revisions waiting to be applied.
   - **Risk Assessment**: `LOW` (additive columns/indexes) vs `HIGH` (destructive drops/modifications).
   - **Backup Required Flag**: `True` if any pending migrations exist.

---

## 2. Safe Schema Modification Rules

> [!CAUTION]
> Never drop columns, drop tables, or rename active financial columns in a single migration.

### 2.1 Allowed (Low Risk)
- `ADD COLUMN` with `nullable=True`.
- `ADD COLUMN` with `server_default` specified.
- `CREATE INDEX` (using `CONCURRENTLY` in PostgreSQL).
- Creating new auxiliary tables.

### 2.2 Prohibited in Production Migrations
- `DROP TABLE` or `DROP COLUMN` without a prior release deprecation window.
- Altering column types from string to integer or numeric without an explicit data conversion script.
- Removing foreign key constraints or primary keys without approval.
- Modifying core accounting tables (`journal_entries`, `journal_lines`, `accounts`, `invoices`, `transport_charges`) without financial regression test sign-off.

---

## 3. Migration Lifecycle Verification
All new migrations must pass the **Migration Lifecycle Test** in CI/CD before merging:
```bash
python -m pytest tests/test_migration_lifecycle.py -v
```
This test:
1. Creates an isolated temporary SQLite database.
2. Applies all migrations up to `head`.
3. Validates table structures and constraints.
4. Downgrades schema back to `base` (ensuring `downgrade()` is fully implemented).
5. Re-applies all migrations back to `head`.

---

## 4. Applying Migrations in Production

Migrations are applied exclusively during the Maintenance Window:
```bash
# 1. Take a verified pre-deploy backup
python -m app.tools.pre_deploy_backup

# 2. Lock maintenance mode
python -m app.cli maintenance enable --reason "Database migration"

# 3. Apply migration to head
alembic upgrade head

# 4. Run accounting integrity check
python -m app.cli accounting-check

# 5. Unlock maintenance mode
python -m app.cli maintenance disable
```
Or simply use the unified orchestrator which automates all 5 steps:
```bash
python scripts/deploy_production.py
```
