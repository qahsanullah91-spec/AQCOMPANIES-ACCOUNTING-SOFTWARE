# AQ COMPANIES — ENTERPRISE DISASTER RECOVERY & BUSINESS CONTINUITY RUNBOOK

**Classification**: Confidential / Operations  
**System**: AQ COMPANIES (Trading • Logistics • Accounting)  
**Platform**: Windows Server / Ubuntu Linux  
**Target RPO (Recovery Point Objective)**: < 24 Hours (Nightly Automated + On-Demand Snapshots)  
**Target RTO (Recovery Time Objective)**: < 5 Minutes (Zero-downtime Dry-Run + Atomic Hot Restore)  

---

## 1. System Architecture & Recovery Foundation

AQ COMPANIES is built on an enterprise-hardened accounting foundation:
- **Database Engine**: SQLite 3 with Write-Ahead Logging (`PRAGMA journal_mode=WAL;`), synchronous normal, foreign key constraints enabled, and busy timeout configured to 30,000ms.
- **Backup Mechanism**: Native SQLite Online Backup API (`sqlite3_backup`) with passive WAL checkpointing. This guarantees **zero torn pages**, zero locked-out readers, and 100% transactional consistency without stopping the server.
- **Backup Package Structure**: Timestamped ZIP archive (`AQ-COMPANIES-BACKUP-YYYY-MM-DD-HHMMSS.zip`) containing:
  - `database.db`: Physically verified snapshot of the live SQLite database.
  - `manifest.json`: Full metadata including software version, schema revision, record counts across all 13 core entities, SHA256 hashes, creation timestamps, and author.
  - `documents/`: Complete mirror of all uploaded transaction receipts, bills of lading, and payment vouchers.
- **Accounting Invariants**:
  - General Ledger Debits == Credits strictly ($0.00 difference).
  - Balance Sheet: Assets = Liabilities + Equity (exact reconciliation, zero fake plugs).
  - Sales Baseline: **$4,386,655.66**
  - Transport Credit in AQ favor: **$291,160.00**
  - Verified Receipts: **$0.00**
  - Unknown Purchase Costs: strictly **NULL** (never coerced to 0.00).

---

## 2. Emergency Operational Scenarios

### Scenario 1: Sudden Power Outage / Server Restart
**Symptom**: Windows Server restarts unexpectedly due to power surge or system reboot.
**Recovery Procedure**:
1. Automatic recovery occurs via Windows Task Scheduler (`AQ_Companies_Backend` and `AQ_Companies_Frontend`).
2. SQLite WAL recovery automatically replays committed transactions from `aq_companies.db-wal` into `aq_companies.db` on initial boot.
3. Pre-flight checks in `scripts\windows\start_backend.bat` run Alembic schema verification and accounting integrity scans before accepting HTTP traffic.
4. Verify system status:
   ```cmd
   cd backend
   .venv\Scripts\python scripts\verify_integrity_cli.py
   ```

### Scenario 2: Database File Corruption (`database disk image is malformed`)
**Symptom**: SQLite errors reporting malformed disk image or I/O failure.
**Recovery Procedure**:
1. **Immediately activate Maintenance Mode** (prevents any writes):
   ```cmd
   curl -X POST http://localhost:8000/api/system/maintenance/enable
   ```
2. Locate the newest verified backup in `backend/backups/` or secondary replication path (`SECONDARY_BACKUP_PATH`):
   ```cmd
   dir /o-d backend\backups\*.zip
   ```
3. Execute **Dry-Run Validation** against candidate backup:
   ```cmd
   curl -X POST "http://localhost:8000/api/backup/dry-run?filename=AQ-COMPANIES-BACKUP-XXXX.zip"
   ```
   *Verify response indicates `status: "VALID"`, `is_gl_balanced: true`, `gl_difference: 0.0`.*
4. Execute **Safe Restore**:
   ```cmd
   curl -X POST "http://localhost:8000/api/backup/restore?filename=AQ-COMPANIES-BACKUP-XXXX.zip"
   ```
   *Note: The restore engine automatically creates a timestamped `PRE_RESTORE` safety snapshot of the corrupted file before overwriting.*
5. Run full integrity audit:
   ```cmd
   .venv\Scripts\python scripts\verify_integrity_cli.py
   ```
6. Deactivate Maintenance Mode:
   ```cmd
   curl -X POST http://localhost:8000/api/system/maintenance/disable
   ```

### Scenario 3: Bad Software Update or Regression
**Symptom**: Application fails after git pull or software release.
**Recovery Procedure**:
1. Stop backend and frontend services.
2. Roll back code repository to previous stable release tag or commit:
   ```cmd
   git status
   git checkout <LAST_STABLE_COMMIT_OR_TAG>
   ```
3. Run database downgrade if Alembic migrations were executed:
   ```cmd
   cd backend
   .venv\Scripts\python -m alembic downgrade -1
   ```
   *(Or restore database from pre-update backup snapshot).*
4. Restart services using `scripts\windows\start_production.bat`.

### Scenario 4: Bare-Metal Hard Drive Failure / Moving to a New Server
**Symptom**: Primary hard drive failed completely; restoring onto brand new hardware.
**Recovery Procedure**:
1. **Install Prerequisites on New Machine**:
   - Python 3.11+ (ensure added to PATH)
   - Node.js 18+ LTS
   - Git for Windows
2. **Clone / Extract Project Files**:
   ```cmd
   git clone <REPO_URL> "D:\SOFTWARES-APPS\AQ-COMPANIES-ACCOUNT-SOFTWARE"
   cd "D:\SOFTWARES-APPS\AQ-COMPANIES-ACCOUNT-SOFTWARE"
   ```
3. **Setup Virtual Environments & Dependencies**:
   ```cmd
   cd backend
   python -m venv .venv
   .venv\Scripts\pip install -r requirements.txt
   
   cd ..\frontend
   npm install
   npm run build
   ```
4. **Copy Latest Backup Archive**:
   - Retrieve latest `AQ-COMPANIES-BACKUP-YYYY-MM-DD-HHMMSS.zip` from secondary NAS / cloud / external drive.
   - Place into `D:\SOFTWARES-APPS\AQ-COMPANIES-ACCOUNT-SOFTWARE\backend\backups\`.
5. **Execute Bare-Metal Restore**:
   - Unzip backup archive into temporary folder.
   - Copy `database.db` to `backend\aq_companies.db`.
   - Copy contents of `documents/` to `backend\uploads\`.
6. **Verify Restored Accounting Ledger**:
   ```cmd
   cd ..\backend
   .venv\Scripts\python scripts\verify_integrity_cli.py
   ```
   *Ensure all debits == credits and golden invariants match.*
7. **Configure Windows Tasks for Auto-Start**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File ..\scripts\windows\install_service.ps1
   ```

---

## 3. Scheduled Automated Backups & Monitoring

### Nightly Scheduled Backup Routine
- **Trigger**: Every night at 02:00 AM via Windows Task Scheduler task `AQ_Companies_NightlyBackup`.
- **Script**: `scripts\windows\backup_nightly.bat` -> executes `backend\scripts\run_backup.py`.
- **Log Location**: `backend\logs\backup_nightly.log`.
- **Integrity Guarantee**: Each generated backup is immediately verified in memory with `PRAGMA integrity_check`, manifest parsing, and SHA256 checksum matching before being marked `VERIFIED`.

### 24-Hour Backup Attention Alert
- If no verified backup has been created in the last 24 hours (or if the last backup failed), the system:
  1. Sets `attention_required: true` on the `/api/backup/last-status` API.
  2. Displays an ambient **"BACKUP ATTENTION REQUIRED"** warning banner on the Admin Backup Control Center (`/settings/backups`).
  3. Records a system error in the central Error Viewer.

### Retention & Disk Safety Policy
- Configured via `BACKUP_RETENTION_DAYS` (default: 30 days).
- Backups older than 30 days are automatically pruned, **EXCEPT**:
  - The system **always preserves at least the last 5 backups**.
  - The system **never deletes the latest valid/verified backup**, regardless of age.
- Disk usage warning threshold: 85% full; critical threshold: 95% full.

---

## 4. Disaster Recovery Testing & Drills

Operations personnel should run a quarterly DR simulation using the non-destructive dry-run API:

```cmd
cd D:\SOFTWARES-APPS\AQ-COMPANIES-ACCOUNT-SOFTWARE\backend
.venv\Scripts\python -c "
from app.database import SessionLocal
from app.services.backup.backup_service import BackupService
import os

db = SessionLocal()
latest = BackupService.get_last_backup_status(db)
print('Latest Backup:', latest['filename'])
res = BackupService.dry_run_restore(db, latest['filename'])
print('Dry Run Result:', res['status'], 'GL Balanced:', res['is_gl_balanced'])
"
```

A passing drill prints `status: VALID` and `GL Balanced: True`.
