# AQ COMPANIES — Accounting Integrity & Financial Invariants

## Overview
This document outlines the core financial invariants, double-entry ledger rules, posting idempotency controls, and fiscal period protections built into **AQ COMPANIES**.

---

## 1. Audited Baseline Invariants
The AQ Companies dataset contains immutable audited baseline figures established during enterprise migration. Any change or calculation that breaches these invariants constitutes a critical defect:

| Metric | Required Baseline | Accounting Semantics |
| :--- | :--- | :--- |
| **Gross Invoiced Sales** | **$4,386,655.66 USD** | Total sales from all invoiced container shipments. |
| **Customer Receivables (AR)** | **$4,386,655.66 USD** | Gross trade receivables prior to settlement allocations. |
| **Sky Ariana Carrier Balance** | **-$291,160.00 USD** | Standing credit in **AQ Companies' favor** ($743,650.00 charges vs $1,034,810.00 payments). |
| **New Stock Pipeline** | **$291,670.30 USD** | 4 in-transit containers (NEW-001, NEW-002, NEW-003, NEW-004). |
| **Trial Balance Difference** | **$0.00 USD** | Total Debits must exactly equal Total Credits. |

---

## 2. NULL Cost and Rate Accounting Rules

> [!IMPORTANT]
> **Unknown purchase costs and unpriced sales must remain `NULL` (`None`). They must NEVER be coerced or defaulted to `0.00`.**

### Rationale:
- Defaulting an unknown purchase cost to `$0.00` artificially fabricates a 100% gross profit margin.
- If a shipment has `purchase_cost = NULL`, its `net_profit` calculation must also evaluate to `NULL`.
- Invoices `INV-092`, `INV-093`, `INV-122`, `INV-126`, `INV-158`, and `INV-164` represent unpriced cargo awaiting commercial rate agreement; their `rate_per_kg` and `invoice_value` must stay `NULL`.

---

## 3. Double-Entry Posting Rules & Subledger Invariants

### 3.1 Customer Receipts
- **Posting**: `Dr 1010 (Bank) / 1000 (Cash)`, `Cr 1100 (Customer Receivables AR)`.
- **Invariant**: Customer receipts offset trade receivables. Account `4000 (Sales Revenue)` must **never** be modified or inflated by payment receipts.

### 3.2 Transport Payments
- **Posting**: `Dr 2100 (Transport Payable)`, `Cr 1010 (Bank)`.
- **Invariant**: Wire transfers to shipping lines or carriers settle outstanding payables. Account `5100 (Freight Cost)` must **never** be duplicated when paying a carrier invoice.

### 3.3 Supplier Disbursements
- **Posting**: `Dr 2000 (Supplier Payables AP)`, `Cr 1010 (Bank)`.
- **Invariant**: Bill disbursements settle procurement liabilities. Account `5000 (COGS / Purchase Cost)` must **never** be duplicated upon payment execution.

### 3.4 Customer & Supplier Advances
- **Customer Advances**: Prepayments received from buyers are posted to `2150 (Customer Advances - Current Liability)`. They are **never** revenue.
- **Supplier Advances**: Prepayments sent to growers or origin vendors are posted to `1350 (Supplier Advances - Current Asset)`. They are **never** purchase expenses.
- **Transport Prepayments**: Carrier deposits are posted to `1300 (Advances - Current Asset)`. They are **never** freight expenses.

---

## 4. Idempotency & Period Lock Safeguards

### 4.1 Central Posting Key Idempotency
Every automatic accounting rule generates a unique deterministic posting key:
```python
posting_key = f"{rule_type}_{source_id}_{int(round(amount * 100))}"
```
If a transaction attempts to post with an existing `posting_key`, the accounting engine returns the existing `JournalEntry` and halts duplicate line creation.

### 4.2 Fiscal Period Closing Lock
Prior fiscal months (e.g. 2025-12, 2026-01) can be locked with `status = "CLOSED"`. The accounting engine enforces:
```python
if is_period_closed(db, entry_date):
    raise HTTPException(status_code=400, detail="Cannot post to a closed fiscal period.")
```
Modifications to closed periods require explicit super-admin reopening with audit logging.
