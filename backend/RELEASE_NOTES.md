# Release Notes — AQ COMPANIES Backend v2.0.0
**Release Date:** September 27, 2026  
**Build Target:** Production Hardening, DevOps & Accounting Reliability  
**Compatibility:** Python 3.11+, PostgreSQL 16 (Recommended Production), SQLite 3.35+ (Local/Dev)

---

## 1. Executive Summary
AQ COMPANIES v2.0.0 delivers an enterprise-grade backend upgrade focused on zero data loss, financial concurrency protection, and automated deployment safety. All double-entry ledger operations are strictly atomic, audited, and protected by idempotency keys.

## 2. Key Capabilities Added
1. **Idempotency & Safe Financial Writes**: Clients provide an `Idempotency-Key` header on financial POST operations (`/api/v1/receivables/customer-receipts`). Identical requests replay cached responses without creating duplicate ledger or bank records.
2. **Optimistic Locking**: Invoices and bank records enforce `version_id` verification, rejecting concurrent conflicting updates with HTTP 409 Conflict.
3. **Deployment Maintenance Mode**: Allows DevOps engineers to lock the system into read-only mode during database migrations, rejecting financial modifications with HTTP 503 until verification is complete.
4. **Automated Migration Check Tool**: CLI tool `python -m app.tools.migration_check` assesses migration risks, pending revisions, and pre-deploy backup requirements.
5. **Keyset Cursor Pagination**: Enables sub-10ms paging across 50,000+ ledger entries.

## 3. Database Changes & Required Migration
- **Required Revision:** `20260927_prod_hardening`
- **Execution Command:** `python -m alembic upgrade head`
- **Tables Introduced:**
  - `api_idempotency_keys`
  - `background_jobs`
- **Index Additions:** Covering composite indexes across high-volume accounting lookup columns.

## 4. Accounting Logic & Baseline Guarantees
The following known AQ business truths are verified in automated regression suites:
- **Total Sales Invoiced:** Exactly `$4,386,655.66 USD`
- **Customer Receipts (Verified):** `$0.00 USD`
- **Transport Charges:** `$743,650.00 USD`
- **Transport Payments:** `$1,030,000.00 USD`
- **Opening Transport Credit:** `$4,810.00 USD`
- **Sky Ariana Net Balance:** `-$291,160.00 USD` (Credit in AQ Companies' favor)
- **Uncosted Shipments Rule:** Purchase cost and calculated net profit remain `NULL` if purchase costs have not been verified.

## 5. Rollback & Disaster Recovery Notes
- If an application failure occurs post-deploy:
  1. Roll back the Docker container image or git commit.
  2. If the database schema was downgraded, execute `python -m alembic downgrade <previous_revision>`.
  3. If schema changes were destructive, restore from the verified pre-deploy backup archive located in `/app/backups/pre_deploy/`.
