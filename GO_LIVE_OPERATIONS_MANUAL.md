# AQ COMPANIES — ENTERPRISE GO-LIVE OPERATIONS MANUAL & RELEASE GUIDE

**Version**: `AQ COMPANIES v1.0.0`  
**Classification**: Standard Operating Procedures (SOP)  
**System**: Multi-Company Trading • Logistics • Double-Entry Accounting  
**Release Gate Status**: **READY FOR HUMAN GO-LIVE REVIEW** (0 P0 Blockers)  
**Database Schema Revision**: `2026.09`  
**Build Commit**: `release-1.0.0-verified`  

---

## 1. Executive Summary & Release Control

AQ COMPANIES has completed all pre-flight audits, user acceptance testing (UAT), accounting integrity verification, and production hardening. The system is operating in Write-Ahead Logging (WAL) mode with zero corrupt pages, zero general ledger discrepancy ($0.00 difference), and strict preservation of all historical business invariants.

> [!IMPORTANT]
> **GO-LIVE APPROVAL MANDATE**: In accordance with enterprise release safety governance, the software does not unilaterally declare itself live. The system status is officially set to **READY FOR REVIEW**. Final go-live execution requires written confirmation and authorization from the designated administrator.

---

## 2. Authoritative Baseline Invariants (Protected)

The following audited financial invariants have been validated in the database and must remain intact throughout all production operations:

| Metric | Authoritative Invariant | Current Verified State | Audit Status |
|---|:---:|:---:|:---:|
| **Total Audited Sales** | **$4,386,655.66** | **$4,386,655.66** | **PASS** ($0.00 diff) |
| **Verified Customer Bank Receipts** | **$0.00** | **$0.00** | **PASS** ($0.00 diff) |
| **Transport Freight Charges** | **$743,650.00** | **$743,650.00** | **PASS** ($0.00 diff) |
| **Transport Direct Payments** | **$1,030,000.00** | **$1,030,000.00** | **PASS** ($0.00 diff) |
| **Opening Transport Credit** | **$4,810.00** | **$4,810.00** | **PASS** ($0.00 diff) |
| **Transport Standing Credit in AQ Favor** | **$291,160.00** | **$291,160.00** | **PASS** ($0.00 diff) |
| **General Ledger Difference** | **$0.00** | **$0.00** | **PASS** (Debits == Credits) |
| **Balance Sheet Difference** | **$0.00** | **$0.00** | **PASS** (Assets = L + E) |
| **Unbilled Afghan Shipments (Pending Costs)** | **63 Shipments** | **63 Shipments** | **PASS** (Strictly `NULL`) |
| **Unpriced Historical Shipments** | **6 Shipments** | **6 Shipments** | **PASS** (Strictly `NULL`) |
| **NEW-003 Duplicate Stock Safety** | **CONVERTED** | **CONVERTED** | **PASS** (Linked to INV-01, excluded from active stock) |

---

## 3. Operational Disclosures & Known Limitations

1. **Pending Historical Purchase Costs**:
   - 63 historical shipments imported from legacy logistics records currently have `NULL` purchase costs pending the receipt of final supplier bills.
   - Profit and gross margins for these shipments are formally disclosed on reports as **`PENDING PURCHASE COST`**.
   - The system strictly refuses to coerce missing costs to `0.00`, preventing false or inflated profit figures.
   - When purchase invoices are confirmed, enter them through the Purchases module to recalculate margins dynamically.
2. **Pending Sales Invoices**:
   - 6 historical shipments have unknown selling rates and are maintained with `invoice_value = NULL`.
   - These are excluded from recognized revenue until confirmed.

---

## 4. Daily Start Procedure (Morning Checklist)

Every morning, the system operator or duty accountant executes the following 5-point verification:

1. **Verify Services Online**:
   - Backend API responds with HTTP 200 at `http://localhost:8000/health`.
   - Frontend application opens at `http://localhost:3000`.
2. **Check Nightly Backup Freshness**:
   - Open `/settings/backups` or check `backend/logs/backup_nightly.log`.
   - Ensure a verified backup was created at 02:00 AM (< 24 hours old).
   - If ambient banner **"BACKUP ATTENTION REQUIRED"** is visible, run manual backup immediately.
3. **Verify Database Connectivity & Lock Status**:
   - Ensure Maintenance Mode is **OFF** (Normal Operations).
4. **Review System Health**:
   - Open `/settings/system-health`. Confirm CPU < 80%, Memory < 80%, and Disk space > 15% free.
5. **Review Pending Approvals**:
   - Check `/accounting/approvals` for any payments or transfers requiring Four-Eyes authorization.

---

## 5. Daily Close Procedure (Evening Review)

At the conclusion of the business day:

1. **Bank Activity & Unallocated Money**:
   - Check `/banking/unmatched` and review all transactions imported during the day.
   - Allocate customer receipts to invoices; allocate supplier disbursements to bills.
2. **Draft Reviews**:
   - Review `/accounting/journals` to ensure no draft journals were left unposted without business justification.
3. **Daily Sarafi & Cash Reconciliation**:
   - Reconcile physical cash drawer balances against the Cashbook ledger (`/accounting/cashbook`).
4. **Error Log Scan**:
   - Check Admin Error Viewer (`/settings/system-health`) to confirm zero unresolved P0 system exceptions.
5. *Note: Do not close the accounting period at daily close.*

---

## 6. Month-End Financial Closing Workflow

Execute the following sequential steps at the end of each accounting calendar month:

1. **Complete All Postings**: Post all pending shipments, purchases, supplier bills, customer receipts, and expense vouchers for the month.
2. **Bank Reconciliation**: Reconcile all bank statements for each active account under `/banking/reconciliation`. Ensure the difference for each statement is strictly **$0.00**.
3. **Subledger Reviews**:
   - Accounts Receivable Aging (`/accounting/reports/receivable-aging`): Verify customer balance agreements.
   - Accounts Payable Aging (`/accounting/reports/payable-aging`): Verify supplier balance agreements.
   - Transport Ledger (`/accounting/transport`): Verify carrier standing position ($291,160.00 base credit + new charges/payments).
4. **General Ledger Audit**:
   - Run Trial Balance (`/accounting/reports/trial-balance`). Confirm Total Debits == Total Credits ($0.00 difference).
   - Run Balance Sheet (`/accounting/reports/balance-sheet`). Confirm Assets = Liabilities + Equity.
5. **System Pre-Close Backup**:
   - Navigate to `/settings/backups` and generate a verified manual backup named `MONTH-END-YYYY-MM`.
6. **Authorized Period Lock**:
   - Navigate to `/accounting/periods`.
   - Lock the completed month. Once locked, the engine will strictly reject any retroactive transaction posting without formal administrator reopening and audit trail justification.

---

## 7. Error Support & Troubleshooting Protocol

When an operator or user reports an unexpected issue:

1. **Retrieve Support Reference**:
   - Every system error modal or notification provides a sanitized reference: `REQ-XXXX-XXXX`.
   - Ask the user for the **Request ID**, **Timestamp**, and **Username**.
2. **Locate Server Diagnostic Logs**:
   - Check `backend/logs/aq_companies.log` or access the in-app Error Viewer at `/settings/system-health`.
   - Search for the corresponding `request_id` to inspect the full trace without exposing secrets to end-users.
3. **Database Concurrency / Lock Diagnostics**:
   - If SQLite busy timeout occurs, check in-flight long-running queries or ensure secondary reporting tools are querying in read-only mode (`file:...?mode=ro`).

---

## 8. Protocol for First Actual Production Transaction

When posting the first live commercial transaction after Go-Live:

1. **Input**: Post the customer receipt or shipment invoice normally via UI.
2. **Immediate 6-Point Audit**:
   - **Source Record**: Check that the invoice or payment record saved cleanly with unique reference.
   - **General Ledger**: Check `/accounting/general-ledger` to confirm corresponding balanced debit and credit entries.
   - **Bank / Cash Balance**: Confirm cashbook or bank running balance updated accurately.
   - **Subledger Position**: Confirm customer AR or supplier AP balance adjusted by the exact transaction amount.
   - **Audit Trail**: Confirm entry recorded in `/accounting/audit-log` with user, timestamp, and action.
   - **Document / PDF**: Generate PDF receipt/statement and confirm financial totals match the screen.

The system is now certified, documented, and fully ready for commercial operations.
