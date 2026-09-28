# AQ COMPANIES — Operational & Incident Runbook

## Overview
This runbook provides emergency operational procedures, troubleshooting playbooks, and administrative CLI instructions for site reliability engineers and accounting operators supporting **AQ COMPANIES**.

---

## 1. Enterprise Administration CLI (`aq`)

Operators can invoke commands via the wrapper scripts:
- **Windows**: `aq <command>` or `.\scripts\aq.bat <command>`
- **Linux / macOS**: `./scripts/aq <command>`
- **Python Module**: `python -m app.cli <command>`

### 1.1 Command Cheat Sheet

| Command | Action | Description |
| :--- | :--- | :--- |
| `aq health` | System Health Probe | Checks database connectivity, uptime, version, and disk storage metrics. |
| `aq accounting-check` | Trial Balance Audit | Verifies debits == credits across GL, bank, cash, AR, AP, and transport ledgers. |
| `aq backup` | Snapshot Creation | Generates a full enterprise backup ZIP with verified manifest. |
| `aq backup-verify` | Archive Validation | Unpacks and validates SHA-256 and record counts of newest or specified backup. |
| `aq restore-check` | Disaster Simulation | Simulates isolated restore into temporary DB, reports RTO and TB balance. |
| `aq migration-status` | Schema Status | Displays current revision, target head, pending count, and migration risk. |
| `aq maintenance status` | Lock Status | Checks whether financial mutation lock is active. |
| `aq maintenance enable` | Lock Mutations | Enables maintenance mode (returns HTTP 503 on writes). |
| `aq maintenance disable` | Unlock Mutations | Disables maintenance mode, resuming normal financial operations. |
| `aq database-reset` | Dev Reset | Drops and recreates all tables (permanently blocked in production). |

---

## 2. Common Incident Playbooks

### Playbook 1: System Locked in Maintenance Mode
**Symptom**: Financial mutations return `HTTP 503 Service Unavailable: System is currently locked in Maintenance Mode`.
**Resolution**:
1. Check lock status and reason:
   ```bash
   aq maintenance status
   ```
2. Verify that no background migration or restore is currently in progress:
   ```bash
   aq migration-status
   ```
3. Run accounting health check to ensure the ledger is consistent:
   ```bash
   aq accounting-check
   ```
4. If healthy, deactivate maintenance mode:
   ```bash
   aq maintenance disable
   ```

---

### Playbook 2: Database Migration or Deployment Failure
**Symptom**: `deploy_production.py` halts or `alembic upgrade head` returns a non-zero exit code.
**Resolution**:
1. Check if the automatic rollback was completed:
   ```bash
   aq health
   ```
2. If the system is still in an inconsistent state, trigger manual emergency rollback:
   ```bash
   # Validate archive first:
   python scripts/rollback.py --dry-run

   # Execute rollback to latest pre-deploy snapshot:
   python scripts/rollback.py
   ```
3. Run smoke tests to verify recovered state:
   ```bash
   python scripts/smoke_test.py
   ```

---

### Playbook 3: Trial Balance Discrepancy Detected
**Symptom**: `aq accounting-check` returns `DISCREPANCY` (Debits != Credits).
**Resolution**:
1. Run the detailed accounting audit:
   ```bash
   python -c "from app.database import SessionLocal; from app.security_automation import run_accounting_health_check; db = SessionLocal(); print(run_accounting_health_check(db))"
   ```
2. Inspect the returned `checks` dictionary to isolate the unbalanced subsystem:
   - `general_ledger`: Difference in JournalLine debits vs credits.
   - `bank` / `cash` / `sarafi`: Subledger balance vs Control Account (1010/1000/1030).
   - `customers`: Invoice balance due vs AR Control (1100).
   - `suppliers`: Unsettled bills vs AP Control (2000).
   - `transport`: Freight charges vs Carrier Ledger (standing credit $291,160.00).
3. If an erroneous journal entry was posted, reverse it using the reversal service (`POST /api/accounting/journals/{id}/reverse`). Never modify posted journals directly.

---

### Playbook 4: Low Disk Space Alert (< 20% Warning, < 10% Critical)
**Symptom**: Health checks warn of impending disk exhaustion, or file imports are blocked (`HTTP 400: Disk storage critical`).
**Resolution**:
1. Inspect disk storage metrics:
   ```bash
   aq health
   ```
2. Inspect old backup archives:
   ```bash
   # List backups sorted by size
   ls -lh backups/
   ```
3. Retain the 7 most recent backups and archive older snapshots to secondary cold storage (e.g. S3 / GCS).
4. Verify document integrity to ensure no active attachment files are removed:
   ```bash
   python -c "from app.database import SessionLocal; from app.services.monitoring.system_monitor import SystemMonitor; db = SessionLocal(); print(SystemMonitor.check_document_integrity(db))"
   ```
