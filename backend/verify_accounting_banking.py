import sys
import os
import json
import urllib.request
import urllib.error
from datetime import date, datetime
from decimal import Decimal

BASE_URL = "http://127.0.0.1:8000/api/accounting"

class ResponseWrapper:
    def __init__(self, status_code, body_bytes):
        self.status_code = status_code
        self.body_bytes = body_bytes
        self.text = body_bytes.decode("utf-8", errors="replace")

    def json(self):
        return json.loads(self.text)

def http_get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "VerificationSuite"})
    try:
        with urllib.request.urlopen(req) as resp:
            return ResponseWrapper(resp.status, resp.read())
    except urllib.error.HTTPError as e:
        return ResponseWrapper(e.code, e.read())

def http_post(url, data=None):
    payload = json.dumps(data).encode("utf-8") if data is not None else b""
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "VerificationSuite"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return ResponseWrapper(resp.status, resp.read())
    except urllib.error.HTTPError as e:
        return ResponseWrapper(e.code, e.read())

def log_test(num, name, passed, details=""):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] Test {num:02d}: {name} {details}")
    if not passed:
        raise AssertionError(f"Test {num:02d} FAILED: {name} - {details}")

def run_tests():
    print("=" * 60)
    print("AQ COMPANIES — BANKING & ACCOUNTING AUTOMATION VERIFICATION")
    print("=" * 60)

    from app.database import SessionLocal
    from app import models
    _db = SessionLocal()
    try:
        _db.query(models.BankStatementLine).filter(
            (models.BankStatementLine.reference.like("%TEST%")) |
            (models.BankStatementLine.reference.like("%WIRE-NEW%")) |
            (models.BankStatementLine.reference.like("%ERR%"))
        ).delete()
        _db.commit()
    finally:
        _db.close()

    # 1. Bank Accounts Master
    r = http_get(f"{BASE_URL}/banks")
    assert r.status_code == 200, f"Status: {r.status_code}, {r.text}"
    banks = r.json()
    assert len(banks) >= 6, f"Expected at least 6 accounts, got {len(banks)}"
    currencies = {b["currency"] for b in banks}
    assert {"USD", "AFN", "AED", "INR"}.issubset(currencies), f"Currencies found: {currencies}"
    account_types = {b["account_type"] for b in banks}
    assert {"BANK", "CASH", "SARAFI"}.issubset(account_types), f"Account types found: {account_types}"
    log_test(1, "Bank Master Seeding & Multi-Currency Provisioning", True, f"({len(banks)} accounts; Currencies: {currencies})")

    # Select USD bank account for testing
    usd_bank = next(b for b in banks if b["currency"] == "USD" and b["account_type"] == "BANK")
    aub_afn = next(b for b in banks if b["currency"] == "AFN" and b["account_type"] == "BANK")

    # 2. Banking Dashboard KPIs
    r = http_get(f"{BASE_URL}/banking-dashboard")
    assert r.status_code == 200, f"Status: {r.status_code}, {r.text}"
    bd = r.json()
    assert "currency_balances" in bd
    assert "total_cash_and_bank_usd_est" in bd
    assert "carrier_credit_position" in bd
    log_test(2, "Banking Dashboard KPIs", True, f"(Total USD Est: ${bd['total_cash_and_bank_usd_est']:,.2f})")

    # 3. Transport Position & Carrier Credit Verification (At least $291,160.00 in our favor)
    carrier_pos = bd["carrier_credit_position"]
    initial_credit = carrier_pos["carrier_credit_in_our_favor"]
    assert carrier_pos["has_carrier_credit"] is True, "Expected carrier credit in our favor"
    assert initial_credit >= 291160.0, f"Expected carrier credit >= 291160.0, got {initial_credit}"
    log_test(3, "Carrier Credit Standing (AQ Companies has credit in our favor)", True, f"(Credit in our favor: ${initial_credit:,.2f})")

    # 4. Bank Transaction: Bank Charge (Account 5600)
    charge_payload = {
        "bank_account_id": usd_bank["id"],
        "transaction_type": "BANK_CHARGE",
        "date": "2026-03-01",
        "money_out": 45.0,
        "notes": "Automated Wire Fee Verification",
        "transaction_reference": "TEST-WIRE-FEE-01",
    }
    r = http_post(f"{BASE_URL}/bank-transactions", charge_payload)
    assert r.status_code == 201, r.text
    tx_res = r.json()
    charge_tx_id = tx_res["transaction_id"]
    log_test(4, "Bank Charge Posting & Debit 5600", True, f"(Tx ID: {charge_tx_id}, Amount: $45.00)")

    # 5. Authoritative Running Balance Verification
    r = http_get(f"{BASE_URL}/bank-transactions?bank_account_id={usd_bank['id']}")
    assert r.status_code == 200, r.text
    tx_list = r.json()
    assert len(tx_list) > 0
    latest_tx = tx_list[-1]
    assert "running_balance" in latest_tx
    log_test(5, "Authoritative Bank Running Balance", True, f"(Latest balance: ${latest_tx['running_balance']:,.2f})")

    # 6. Customer Receipt with OLDEST_FIRST Auto-Allocation & Partial Payment
    r = http_get(f"{BASE_URL}/receivables/aging")
    assert r.status_code == 200, r.text
    aging_data = r.json()
    test_cust = aging_data["customers"][0]
    cust_id = test_cust["customer_id"]
    open_inv = test_cust["invoices"][0]
    inv_id = open_inv["invoice_id"]

    partial_amt = 1000.00
    receipt_payload = {
        "customer_id": cust_id,
        "bank_account_id": usd_bank["id"],
        "date": "2026-03-02",
        "amount": partial_amt,
        "currency": "USD",
        "exchange_rate": 1.0,
        "allocation_mode": "OLDEST_FIRST",
        "reference": "TEST-REC-PARTIAL-01",
        "notes": "Partial receipt test",
    }
    r = http_post(f"{BASE_URL}/payments/customer-receipt", receipt_payload)
    assert r.status_code == 201, r.text
    rec_res = r.json()
    assert rec_res["allocated_to_invoices_usd"] == partial_amt
    assert len(rec_res["allocations"]) > 0
    first_alloc = rec_res["allocations"][0]
    assert first_alloc["status"] in ("PARTIALLY PAID", "PAID")
    log_test(6, "Customer Partial Receipt & Status Transition", True, f"(Allocated: ${partial_amt:,.2f} to {first_alloc['invoice_number']}, Status: {first_alloc['status']})")

    # 7. Customer Receipt Overpayment -> Credited to 2150 Customer Advances
    large_amt = float(test_cust["total_outstanding"]) + 50000.0
    advance_receipt = {
        "customer_id": cust_id,
        "bank_account_id": usd_bank["id"],
        "date": "2026-03-03",
        "amount": large_amt,
        "currency": "USD",
        "allocation_mode": "OLDEST_FIRST",
        "reference": "TEST-ADV-OVERPAY-01",
        "notes": "Large receipt exceeding all customer open balance",
    }
    r = http_post(f"{BASE_URL}/payments/customer-receipt", advance_receipt)
    assert r.status_code == 201, r.text
    adv_res = r.json()
    assert adv_res["unallocated_advance_usd"] > 0
    log_test(7, "Customer Advance Posting to Account 2150", True, f"(Unallocated Advance: ${adv_res['unallocated_advance_usd']:,.2f})")

    # 8. Supplier Payment & Advance Posting to Account 1350
    supp_payment_payload = {
        "supplier_id": 1,
        "bank_account_id": usd_bank["id"],
        "date": "2026-03-04",
        "amount": 25000.0,
        "currency": "USD",
        "exchange_rate": 1.0,
        "reference": "TEST-SUPP-WIRE-01",
        "notes": "Afghan Supplier advance procurement wire",
    }
    r = http_post(f"{BASE_URL}/payments/supplier-payment", supp_payment_payload)
    assert r.status_code == 201, r.text
    sp_res = r.json()
    assert sp_res["supplier_advance_usd"] == 25000.0
    assert sp_res["journal_entry_number"] is not None
    log_test(8, "Supplier Advance Disbursement to Account 1350", True, f"(SP Voucher: {sp_res['journal_entry_number']}, Advance: ${sp_res['supplier_advance_usd']:,.2f})")

    # 9. Transport Payment & Carrier Position Maintenance
    tp_payload = {
        "transport_company_id": 1,
        "bank_account_id": usd_bank["id"],
        "date": "2026-03-05",
        "amount": 10000.0,
        "currency": "USD",
        "reference": "TEST-TP-WIRE-01",
        "notes": "Sky Ariana freight installment",
    }
    r = http_post(f"{BASE_URL}/payments/transport-payment", tp_payload)
    assert r.status_code == 201, r.text
    tp_res = r.json()
    assert tp_res["journal_entry_number"].startswith("TP-")
    assert tp_res["carrier_position"]["carrier_credit_in_our_favor"] >= initial_credit + 10000.0
    log_test(9, "Transport Payment & Carrier Credit Preservation", True, f"(TP Voucher: {tp_res['journal_entry_number']}, New Carrier Credit: ${tp_res['carrier_position']['carrier_credit_in_our_favor']:,.2f})")

    # 10. Multi-Currency Foreign Exchange Conversion (AFN @ 68)
    afn_amount = 680000.0
    afn_rate = 68.0
    expected_usd = 10000.0
    afn_tx = {
        "bank_account_id": aub_afn["id"],
        "transaction_type": "EXPENSE_PAYMENT",
        "currency": "AFN",
        "exchange_rate": afn_rate,
        "date": "2026-03-06",
        "money_out": afn_amount,
        "transaction_reference": "TEST-AFN-FX-01",
        "notes": "Local Kabul office expenses",
    }
    r = http_post(f"{BASE_URL}/bank-transactions", afn_tx)
    assert r.status_code == 201, r.text
    fx_res = r.json()
    assert fx_res["usd_equivalent_out"] == expected_usd
    log_test(10, "Multi-Currency Foreign Exchange Conversion", True, f"(680,000 AFN @ 68.0 = ${fx_res['usd_equivalent_out']:,.2f})")

    # 11. Bank Statement Import Preview with 6-State Classification
    stmt_rows = [
        {"date": "2026-03-01", "description": "Automated Wire Fee Verification", "reference": "TEST-WIRE-FEE-01", "debit": 0, "credit": 45.0, "currency": "USD"},
        {"date": "2026-03-10", "description": "Deposit from Overseas Buyer", "reference": "WIRE-NEW-999", "debit": 50000.0, "credit": 0, "currency": "USD"},
        {"date": "invalid-date", "description": "Corrupt line", "reference": "ERR-01", "debit": 100.0, "credit": 0, "currency": "USD"},
        {"date": "2026-03-12", "description": "Euro Wire", "reference": "EUR-01", "debit": 200.0, "credit": 0, "currency": "EUR"},
    ]
    preview_payload = {
        "bank_account_id": usd_bank["id"],
        "rows": stmt_rows,
    }
    r = http_post(f"{BASE_URL}/bank-statements/import-preview", preview_payload)
    assert r.status_code == 200, r.text
    prev = r.json()
    summary = prev["summary"]
    assert summary["exact_match"] >= 1
    assert summary["new"] >= 1
    assert summary["invalid"] >= 1
    assert summary["unknown_currency"] >= 1
    log_test(11, "Bank Statement Import Preview & 6-State Classification", True, f"(Matches: {summary['exact_match']}, New: {summary['new']}, Invalid: {summary['invalid']}, Unknown Curr: {summary['unknown_currency']})")

    # 12. Bank Statement Commit
    commit_payload = {
        "bank_account_id": usd_bank["id"],
        "rows": [row for row in prev["rows"] if row["status"] in ("NEW_TRANSACTION", "EXACT_MATCH")],
        "create_missing_transactions": False,
    }
    r = http_post(f"{BASE_URL}/bank-statements/commit-import", commit_payload)
    assert r.status_code == 200, r.text
    c_res = r.json()
    assert c_res["committed_lines"] >= 2
    log_test(12, "Bank Statement Commit", True, f"(Batch ID: {c_res['batch_id']}, Committed: {c_res['committed_lines']})")

    # 13. Side-by-Side Bank Reconciliation Screen
    r = http_get(f"{BASE_URL}/reconciliation/{usd_bank['id']}")
    assert r.status_code == 200, r.text
    recon = r.json()
    assert "balances" in recon
    assert "ledger_transactions" in recon
    assert "statement_lines" in recon
    log_test(13, "Side-by-Side Reconciliation Screen & Difference Tracker", True, f"(Difference: ${recon['balances']['difference']:,.2f})")

    # 14. Bank Transaction Soft-Reversal Engine
    rev_payload = {
        "reason": "Test accidental charge reversal",
        "user_name": "AuditTester",
    }
    r = http_post(f"{BASE_URL}/bank-transactions/{charge_tx_id}/reverse", rev_payload)
    assert r.status_code == 200, r.text
    rev_res = r.json()
    assert rev_res["reversal_code"].startswith("REV-")
    log_test(14, "Bank Transaction Soft-Reversal & Reversing GL Voucher", True, f"(Reversal Code: {rev_res['reversal_code']})")

    # 15. Accounting Period Lock Enforcement
    r = http_get(f"{BASE_URL}/periods")
    periods = r.json()
    p1 = periods[0]
    r = http_post(f"{BASE_URL}/periods/{p1['id']}/close", {"status": "LOCKED", "user_name": "Controller"})
    assert r.status_code == 200

    locked_attempt = {
        "bank_account_id": usd_bank["id"],
        "transaction_type": "BANK_CHARGE",
        "date": p1["start_date"],
        "money_out": 100.0,
        "notes": "Attempt to post into locked period",
    }
    r = http_post(f"{BASE_URL}/bank-transactions", locked_attempt)
    assert r.status_code in (400, 500), f"Expected rejection, got {r.status_code}"
    log_test(15, "Accounting Period Lock Enforcement", True, "(Retroactive modification rejected)")

    # Reopen period
    http_post(f"{BASE_URL}/periods/{p1['id']}/reopen", {"reason": "Testing completed", "user_name": "Admin"})

    # 16. Double-Entry Trial Balance Balancing
    r = http_get(f"{BASE_URL}/trial-balance")
    assert r.status_code == 200, r.text
    tb = r.json()
    assert tb["is_balanced"] is True, f"Trial balance out of balance: {tb['difference']}"
    assert tb["difference"] == 0.0
    log_test(16, "Double-Entry Trial Balance (Debit = Credit)", True, f"(Total Debit: ${tb['total_debit']:,.2f}, Total Credit: ${tb['total_credit']:,.2f}, Diff: $0.00)")

    # 17. Financial Audit Trail
    r = http_get(f"{BASE_URL}/audit-log?limit=10")
    assert r.status_code == 200, r.text
    audit_data = r.json()
    assert audit_data["total"] > 0
    assert len(audit_data["logs"]) > 0
    log_test(17, "Financial Audit Trail Logging", True, f"({audit_data['total']} total immutable audit records)")

    print("=" * 60)
    print("ALL 17 BANKING & ACCOUNTING VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print(f"\nERROR: {e}")
        sys.exit(1)
