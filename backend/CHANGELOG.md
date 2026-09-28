# Changelog
All notable changes to the AQ COMPANIES Accounting & Management Platform are documented here.
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-09-27

### Added
- **Multi-Entity Company Support**: Complete multi-company database separation, company codes, and intercompany transactions.
- **Atomic Transaction Service (`TransactionService`)**: Implemented strict all-or-nothing database transactions with automatic rollback on error.
- **Optimistic Concurrency Control**: `version_id` verification preventing lost updates and concurrent overwrites (returns HTTP 409 Conflict).
- **Dialect-Aware Row-Level Locking (`safe_row_lock`)**: PostgreSQL `SELECT ... FOR UPDATE` support with seamless SQLite fallback.
- **Idempotency Engine (`IdempotencyService`)**: Deterministic SHA-256 payload hashing, preventing duplicate financial postings and replaying cached responses.
- **Background Worker & Jobs API**: Non-blocking `ThreadPoolExecutor` workers with job tracking, polling endpoint (`GET /api/v1/jobs/{job_id}`), and cancellation.
- **Keyset Cursor Pagination**: High-throughput $O(1)$ cursor pagination for 50,000+ general ledger lines.
- **Enterprise Maintenance Mode**: Deployment lock preventing financial mutations during schema migrations while preserving safe reads.
- **Alembic Migration Verifier & Safety Check**: Tool for detecting pending migrations, schema drift, and risk assessment prior to deployment.
- **Comprehensive DevOps & CI/CD Pipeline**: GitHub Actions workflow covering linting, type checks, PostgreSQL service tests, migration tests, and accounting regression.

### Changed
- **Centralized Precision Policy (`RoundingPolicy`)**: Replaced all floating-point math with exact `Decimal` precision (Money: 2 decimals, FX: 4 decimals, Weights: 3 decimals, `ROUND_HALF_UP`).
- **Query Loading Strategy**: Upgraded relationship loading from `joinedload` to `selectinload` to eliminate Cartesian joins on paginated results.
- **Observability Endpoints**: Added root `/version` and `/ready` probes reporting database dialect, revision, and runtime environment without leaking credentials.

### Fixed
- Replaced all legacy `datetime.utcnow()` deprecations with `datetime.now(timezone.utc)`.
- Resolved `PaymentAllocation` column naming compatibility (`allocated_amount_usd` with `amount_allocated` synonym).
- Unified `Customer` and `Supplier` entity naming accessors across the repository layer.

### Security
- Object-level company authorization (`require_company_access`) preventing unauthorized cross-entity record access.
- Pre-flight production configuration validation checking secret strength, debug flags, and database type.
- Strict `.env.example` templates and removal of hardcoded credentials.

### Database Migrations
- Applied `20260927_prod_hardening`:
  - Created `api_idempotency_keys` table.
  - Created `background_jobs` table.
  - Added covering composite indexes for `shipments`, `purchases`, `invoices`, `bank_transactions`, `payment_allocations`, `journal_entries`, and `journal_lines`.
  - Added CHECK constraints for non-negative financial amounts and weights.

### Accounting Rules & Invariants
- Preserved baseline sales invoiced: **$4,386,655.66 USD**.
- Preserved Sky Ariana carrier credit: **-$291,160.00 USD**.
- Preserved strict NULL purchase cost and profit rule for uncosted shipments.
