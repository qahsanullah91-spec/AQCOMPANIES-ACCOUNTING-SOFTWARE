# AQ COMPANIES — Enterprise Backend Engine
**Trading • Logistics • Accounting**

High-performance, secure, double-entry transactional accounting engine built with FastAPI, SQLAlchemy 2.0, and Pydantic v2. Designed for strict accounting correctness, multi-company ledger consolidation, audit compliance, automated bank reconciliation, and enterprise data preservation.

---

## 1. Architecture & Directory Layout

```
backend/
├── app/
│   ├── core/                      # Core infrastructure & cross-cutting concerns
│   │   ├── config.py              # Environment settings (DB, JWT, CORS, Paths)
│   │   ├── database.py            # SQLAlchemy 2.x engine, SQLite WAL & Postgres pools
│   │   ├── exceptions.py          # Typed domain exceptions (UnbalancedJournal, etc.)
│   │   ├── security.py            # PBKDF2 password hashing & signed JWT tokens
│   │   ├── permissions.py         # Role-to-permission mapping (RBAC matrix)
│   │   ├── logging.py             # Structured JSON logger with data sanitization
│   │   └── middleware.py          # Request tracing (X-Request-ID) & execution timing
│   ├── models.py                  # Declarative SQLAlchemy ORM models (53 tables)
│   ├── schemas/                   # Pydantic v2 validation and transfer schemas
│   │   ├── accounting.py          # Journal, Ledger, Trial Balance schemas
│   │   ├── banking.py             # Bank accounts, transactions, transfers
│   │   ├── receivables.py         # Invoices, aging, allocations
│   │   ├── payables.py            # Bills, pending purchase costs, advances
│   │   ├── transport.py           # Carrier charges, advances, net position
│   │   ├── treasury.py            # Multi-company liquidity, currency positions
│   │   ├── reports.py             # P&L, Balance Sheet, Cash Flow
│   │   └── common.py              # Paginated responses, query filters
│   ├── services/                  # Authoritative business logic layer
│   │   ├── accounting/            # PostingService, GeneralLedger, Reversal, Period
│   │   ├── receivables/           # ReceivableService, Aging, PaymentAllocation
│   │   ├── payables/              # PayableService (NULL cost enforcement)
│   │   ├── transport/             # TransportService (-$291,160 credit semantics)
│   │   ├── banking/               # BankingService, StatementImport, MT103
│   │   ├── reconciliation/        # ReconciliationService
│   │   ├── treasury/              # TreasuryService, Intercompany transfers
│   │   ├── reporting/             # FinancialReportsService (8-col TB, P&L, BS)
│   │   ├── backup/                # BackupService (ZIP manifest + SHA256)
│   │   └── import_export/         # DataImportService (dry-run, duplicate check)
│   ├── repositories/              # Read-optimized queries & global search
│   │   └── query_repository.py    # Eager loading, whitelisted sorting, pagination
│   ├── api/v1/                    # Modern RESTful API v1 Routers
│   │   ├── __init__.py            # Master v1 router mount
│   │   ├── accounting.py          # Journals, ledger, trial balance endpoints
│   │   ├── banking.py             # Bank accounts, transactions, transfers
│   │   ├── receivables.py         # Customer invoices, aging buckets
│   │   ├── payables.py            # Supplier payables, unbilled cargo
│   │   ├── transport.py           # Carrier balances, credit position
│   │   ├── treasury.py            # Group treasury, multi-currency liquidity
│   │   ├── reports.py             # P&L, Balance Sheet, Cash Flow
│   │   ├── security.py            # Auth, login, users, approval workflows
│   │   ├── backup.py              # Automated enterprise backup & restore
│   │   ├── search.py              # Global cross-entity search
│   │   └── health.py              # Database & system health probes
│   ├── main.py                    # FastAPI application entry with lifespan
│   └── database.py                # Backwards-compatible database proxy
├── tests/                         # Comprehensive automated test suite
│   ├── test_backend_services.py   # Service unit & integration tests (11 tests)
│   ├── test_migration_and_integrity.py # Accounting integrity suite (6 tests)
│   ├── test_workflow.py           # End-to-end business workflows (4 tests)
│   ├── test_accounting.py         # Shipment & carrier metrics (3 tests)
│   └── test_api.py                # Health, KPIs, PDF endpoints (5 tests)
├── backups/                       # Enterprise ZIP backup repository
├── aq_companies.db                # SQLite database (WAL mode, foreign keys ON)
└── pyproject.toml                 # Project metadata and test configuration
```

---

## 2. Core Accounting & Business Rules

### Rule 1: Strict Double-Entry Balancing
All financial transactions are posted through `PostingService.create_journal_entry()`.
- Every journal entry must satisfy:
  $$\sum \text{Debit} = \sum \text{Credit}$$
- Any discrepancy $\ge \$0.01$ raises `UnbalancedJournalError` and is strictly rejected.
- Negative debits/credits or single-line debit+credit entries are strictly forbidden.
- Idempotency key protection ensures no duplicate journal entries can be created.

### Rule 2: NULL Accounting Rule for Unknown Purchase Costs
- When dry fruits and nuts cargo is shipped before final procurement invoices arrive from Afghanistan suppliers, `purchase_cost` and `purchase_rate` MUST remain `NULL`.
- Under NO circumstance may `NULL` be converted to `$0.00`.
- In all financial reports (Profit & Loss, Gross Margin, Net Profit), unpriced cargo is quarantined with badge `PRELIMINARY / PROFIT PENDING`.

### Rule 3: Transport Carrier Credit Balance Semantics
- Sky Ariana Limited freight ledger:
  - Transport Charges: $+\$743,650.00$ USD
  - Payments / Opening Advance: $+\$1,034,810.00$ USD
  - Net Position: $-\$291,160.00$ USD (Credit in AQ Companies' favor)
- On the Balance Sheet, this credit is correctly presented as a **Current Asset** (`1350 Transport Advance / Carrier Credit`), not a liability.

### Rule 4: Immutability, Reversals & Audit Trail
- Posted records (`JournalEntry`, `BankTransaction`, `Invoice`) CANNOT be directly modified or hard deleted.
- To correct a posted entry, `ReversalService` creates an exact inverted counter-journal with bidirectional links and audit event logging.
- All actions generate append-only entries in `audit_logs` tracking user, timestamp, before/after state, and business rationale.

### Rule 5: Four-Eyes Principle & Approval Thresholds
- Tier 1 ($<\$5,000$ USD): Auto-approved.
- Tier 2 ($\$5,000 - \$50,000$ USD): Requires Admin approval.
- Tier 3 ($>\$50,000$ USD): Requires Super Admin approval.
- The creator of a payment or transaction cannot approve their own entry (`FOUR-EYES CONTROL VIOLATION`).

---

## 3. API Versioning & Endpoints

The backend exposes two route namespaces simultaneously:
1. `/api/v1/...`: Clean, modular, type-safe RESTful API for new clients and integrations.
2. `/api/...`: 100% backwards-compatible endpoints supporting existing Next.js frontend pages.

### Key API v1 Endpoints:
- `POST /api/v1/auth/login`: Issue signed JWT access tokens.
- `GET /api/v1/accounting/trial-balance`: 8-column Trial Balance with zero-difference proof.
- `POST /api/v1/accounting/journals`: Authoritative balanced journal posting.
- `POST /api/v1/accounting/journals/{id}/reverse`: Safe journal reversal with counter-entry.
- `GET /api/v1/receivables/aging`: Customer receivables aging buckets (Current, 1-30, 31-60, 61-90, 90+).
- `GET /api/v1/payables/pending-purchases`: Uncosted cargo shipments awaiting supplier bills.
- `GET /api/v1/transport/carriers/{id}/position`: Transport carrier net position with sign semantics.
- `GET /api/v1/treasury/overview`: Group-wide multi-currency liquidity across banks, vaults, and Sarafi.
- `GET /api/v1/reports/profit-and-loss`: Factual P&L with pending cost quarantine.
- `GET /api/v1/reports/balance-sheet`: Balance sheet proving Assets = Liabilities + Equity.
- `POST /api/v1/backup/create`: Enterprise ZIP backup with manifest.json and SHA256 checksums.
- `GET /api/v1/search`: Global search across shipments, invoices, containers, customers, banks.
- `GET /api/v1/health`: System status, SQLite WAL checkpoints, and disk space monitoring.

---

## 4. Developer & Operational Commands

### Virtual Environment Setup:
```powershell
# Navigate to backend
cd backend

# Activate virtual environment
.\.venv\Scripts\Activate.ps1
```

### Running Automated Test Suites:
```powershell
# Run all 29 pytest automated tests
.\.venv\Scripts\pytest.exe -v

# Run multi-company & treasury verification (15 tests)
.\.venv\Scripts\python.exe verify_multi_company.py

# Run accounting automation, security & backup verification (15 tests)
.\.venv\Scripts\python.exe verify_accounting_automation.py

# Run financial reporting & period closing verification (14 tests)
.\.venv\Scripts\python.exe verify_financial_reporting.py
```

### Starting Backend Server:
```powershell
.\.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be available at `http://127.0.0.1:8000/docs`.

---

## 5. Database & PostgreSQL Readiness
- **Development Engine**: SQLite with `PRAGMA journal_mode=WAL`, `foreign_keys=ON`, and `synchronous=NORMAL`.
- **Production Engine**: Ready for PostgreSQL via setting `DATABASE_URL=postgresql://user:password@host:5432/aq_companies` in environment. Connection pooling configured with `pool_size=20`, `max_overflow=10`, `pool_recycle=3600`.
- All monetary arithmetic uses `Decimal(18, 2)` or `Decimal(18, 4)` to eliminate floating-point rounding errors.
