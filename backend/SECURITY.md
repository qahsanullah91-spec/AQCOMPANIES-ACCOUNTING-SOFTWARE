# AQ COMPANIES — Security & Compliance Architecture

## Overview
This document outlines the security architecture, authentication standards, access control policies, and audit trails implemented in **AQ COMPANIES**.

---

## 1. Production Configuration Safeguards

When `ENVIRONMENT=production` or `APP_ENV=production`, the application executes startup validation:
```python
validate_production_config(settings)
```
The application will **refuse to boot** if:
1. `DEBUG` is set to `True`.
2. `SECRET_KEY` equals any default placeholder or is shorter than 32 characters.
3. `DATABASE_URL` uses SQLite instead of a hardened PostgreSQL instance.
4. CORS allows universal wildcards (`*`).
5. Backup or upload paths do not have at least 10% free disk storage available.

---

## 2. Authentication & Authorization

### 2.1 Password Hashing
User passwords are encrypted using `bcrypt` (or PBKDF2/SHA-256 with crypt salt) via `app.core.security.hash_password()`. Plaintext passwords are never stored or logged.

### 2.2 Role-Based Access Control (RBAC)
AQ Companies enforces four standardized operational roles:

| Role | Permissions | Financial Capabilities |
| :--- | :--- | :--- |
| **ADMIN** | Full administrative access (`*`) | Can configure users, reopen periods, perform database backups, and override locks. |
| **ACCOUNTANT** | Accounting read & write | Can record invoices, post journal entries, reconcile bank statements, and allocate payments. |
| **AUDITOR** | Read-only compliance | Can view general ledger, trial balance, and audit logs. Mutation access is forbidden. |
| **VIEWER** | Read-only operational | Can inspect shipments, stocks, and carrier balances without accessing accounting books. |

---

## 3. Maintenance Mode & Deployment Locking
To protect accounting data during database migrations and releases, the system provides deployment locking:
- **Interceptor Middleware**: Blocks mutating HTTP methods (`POST`, `PUT`, `DELETE`, `PATCH`) with `HTTP 503 Service Unavailable`.
- **Exemptions**: Liveness probes (`/health`, `/ready`, `/version`) remain operational.
- **Bypass Header**: Deployment orchestrators pass `X-Maintenance-Bypass: <token>` to perform migrations, health audits, and smoke tests without opening the system to public financial updates.

---

## 4. Multi-Company Ledger Isolation
All transactions and subledgers require a valid `company_id`.
- Queries are automatically scoped by `models.Model.company_id`.
- Intercompany transactions generate reciprocal mirrored entries between parent and subsidiary books.
- Users without permissions for a specific company receive `HTTP 403 Forbidden`.

---

## 5. Structured Audit Logging
Every financial mutation produces an immutable record in the `audit_logs` table:
- **Timestamp & User**: ISO 8601 UTC timestamp and authenticated `user_name` / `user_id`.
- **Entity & Action**: Target entity (`Invoice`, `JournalEntry`, etc.) and action (`CREATE`, `UPDATE`, `REVERSE`, `DELETE`).
- **State Diffs**: JSON payload recording exact before-and-after values.
- **Correlation ID**: Unique `X-Request-ID` tracing each API call from ingress to database.
