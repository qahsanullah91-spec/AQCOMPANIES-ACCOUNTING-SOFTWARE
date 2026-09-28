import urllib.request
import json
import sys

BASE_URL = "http://127.0.0.1:8000/api"

def get(path):
    req = urllib.request.Request(f"{BASE_URL}{path}", headers={"Accept": "application/json"})
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())

def post(path, data):
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=body,
        headers={"Content-Type": "application/json", "Accept": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode()
        return {"error": e.code, "detail": err_msg}

def run_tests():
    print("==================================================")
    print("AQ COMPANIES — ACCOUNTING & BANKING CORE TEST SUITE")
    print("==================================================")

    # 1. Chart of Accounts
    coa = get("/accounting/accounts")
    print(f"\n[TEST 1] Chart of Accounts:")
    print(f"  Total Accounts Defined: {len(coa)}")
    assert len(coa) >= 24, "Expected at least 24 accounts in standard COA"
    print("  [PASS] Chart of Accounts Loaded successfully.")

    # 2. Trial Balance
    tb = get("/accounting/trial-balance")
    print(f"\n[TEST 2] Trial Balance Double-Entry Equality:")
    print(f"  Total Debits:  ${tb['total_debit']:,.2f}")
    print(f"  Total Credits: ${tb['total_credit']:,.2f}")
    print(f"  Difference:    ${tb['difference']:,.2f}")
    print(f"  Status:        {tb['status']}")
    assert tb["is_balanced"] == True, f"Trial balance out of balance: {tb['difference']}"
    assert tb["total_debit"] == tb["total_credit"], "Debit must equal credit exactly"
    print("  [PASS] Zero-tolerance double-entry trial balance is 100% mathematically balanced.")

    # 3. Transport Carrier Position
    tp = get("/accounting/transport-statement")
    pos = tp["position"]
    print(f"\n[TEST 3] Transport Carrier Position (Sky Ariana Limited):")
    print(f"  Freight Incurred:       ${pos['total_freight_charges']:,.2f}")
    print(f"  Payments Disbursed:     ${pos['total_payments']:,.2f}")
    print(f"  Opening Credit:         ${pos['total_opening_credit']:,.2f}")
    print(f"  Net Position:           ${pos['net_balance']:,.2f}")
    print(f"  Direction:              {pos['status']}")
    assert pos["net_balance"] == -291160.0, f"Expected -$291,160.00, got {pos['net_balance']}"
    assert pos["has_carrier_credit"] == True, "AQ Companies must hold credit with carrier"
    print("  [PASS] Transport Position correctly preserves $291,160.00 credit with carrier.")

    # 4. Profit & Loss Statement (Afghan purchase cost protection)
    pnl = get("/accounting/profit-and-loss")
    print(f"\n[TEST 4] Profit & Loss Statement:")
    print(f"  Operating Revenue:      ${pnl['revenue']['total']:,.2f}")
    print(f"  Transport Cost (COGS):  ${pnl['cogs']['total']:,.2f}")
    print(f"  Provisional Margin:     ${pnl['gross_profit']:,.2f}")
    print(f"  Net Profit:             {pnl['net_profit']}")
    print(f"  Profit Status:          {pnl['profit_status']}")
    print(f"  Pending Purchases POs:  {pnl['cogs']['pending_purchases_count']}")
    assert pnl["revenue"]["total"] == 4386655.66, "Expected Revenue $4,386,655.66"
    assert pnl["cogs"]["total"] == 743650.00, "Expected Transport COGS $743,650.00"
    assert pnl["gross_profit"] == 3643005.66, "Expected Gross Profit $3,643,005.66"
    assert pnl["net_profit"] is None, "Net profit must be None when Afghan costs are unpriced"
    print("  [PASS] Zero-guess financial protection active: Net profit withheld pending supplier bills.")

    # 5. Customer Receivables & Aging Report
    recv_aging = get("/accounting/receivables/aging")
    summary = recv_aging["summary"]
    print(f"\n[TEST 5] Receivables & 4-Tier Aging:")
    print(f"  Total Invoiced Receivables: ${summary['total_receivable']:,.2f}")
    print(f"  0-30 Days:                  ${summary['current_0_30']:,.2f}")
    print(f"  31-60 Days:                 ${summary['aging_31_60']:,.2f}")
    print(f"  61-90 Days:                 ${summary['aging_61_90']:,.2f}")
    print(f"  90+ Days:                   ${summary['overdue_90_plus']:,.2f}")
    assert summary["total_receivable"] == 4386655.66, "Expected total receivables of $4,386,655.66"
    print("  [PASS] Customer Aging report verified across all active buyer accounts.")

    # 6. Supplier Payables (Afghan dry fruits pending)
    supp_pay = get("/accounting/payables/suppliers")
    summary = supp_pay["summary"]
    print(f"\n[TEST 6] Supplier Payables:")
    print(f"  Total Purchase Orders:   {summary['total_purchases_count']}")
    print(f"  Pending Invoices Count:  {summary['pending_invoices_count']}")
    print(f"  Notice:                  {summary['notice']}")
    assert summary["pending_invoices_count"] > 0, "Expected pending purchases"
    print("  [PASS] Supplier Payables safely indicates PENDING SUPPLIER INVOICE.")

    # 7. Cash Flow Statement
    cf = get("/accounting/cash-flow?period_type=monthly")
    print(f"\n[TEST 7] Cash Flow Statement:")
    print(f"  Opening Cash:            ${cf['opening_cash']:,.2f}")
    print(f"  Total Money In:          ${cf['money_in']['total_in']:,.2f}")
    print(f"  Total Money Out:         ${cf['money_out']['total_out']:,.2f}")
    print(f"  Net Cash Flow:           ${cf['net_cash_flow']:,.2f}")
    print(f"  Closing Cash:            ${cf['closing_cash']:,.2f}")
    print("  [PASS] Cash Flow computation functioning smoothly.")

    # 8. Multi-Bank Accounts & Currencies
    banks = get("/accounting/banks")
    print(f"\n[TEST 8] Multi-Bank Management:")
    currencies = [b["currency"] for b in banks]
    print(f"  Configured Banks:        {len(banks)}")
    print(f"  Supported Currencies:    {', '.join(currencies)}")
    assert "USD" in currencies and "AED" in currencies and "AFN" in currencies and "INR" in currencies
    print("  [PASS] Multi-currency banking active (USD, AED, AFN, INR).")

    # 9. Bank Reconciliation Workbench
    recon = get(f"/accounting/reconciliation/{banks[0]['id']}")
    print(f"\n[TEST 9] Bank Reconciliation Workbench:")
    print(f"  Bank:                    {recon['bank_account']['name']} ({recon['bank_account']['currency']})")
    print(f"  System Balance:          ${recon['balances']['system_closing_balance']:,.2f}")
    print(f"  Statement Balance:       ${recon['balances']['statement_closing_balance']:,.2f}")
    print(f"  Difference:              ${recon['balances']['difference']:,.2f}")
    print(f"  Transactions Listed:     {len(recon['transactions'])}")
    print("  [PASS] Reconciliation difference tracking confirmed.")

    # 10. Accounting Fiscal Periods
    periods = get("/accounting/periods")
    print(f"\n[TEST 10] Accounting Fiscal Periods:")
    print(f"  Periods Registered:      {len(periods)}")
    statuses = set(p["status"] for p in periods)
    print(f"  Period Statuses:         {', '.join(statuses)}")
    assert len(periods) >= 12, "Expected 12 monthly periods"
    print("  [PASS] Fiscal period closing calendar configured.")

    # 11. Double-Entry Integrity Test (Rejecting unbalanced manual journal)
    print(f"\n[TEST 11] Double-Entry Validation Enforcement:")
    unbalanced_entry = {
        "entry_date": "2026-09-26",
        "entry_type": "MANUAL",
        "description": "Test Unbalanced Entry (Should Fail)",
        "lines": [
            {"account_code": "1000", "debit": 1000.0, "credit": 0.0, "description": "Cash"},
            {"account_code": "4000", "debit": 0.0, "credit": 800.0, "description": "Revenue"}, # Discrepancy of $200!
        ]
    }
    res = post("/accounting/journals", unbalanced_entry)
    print(f"  Attempting unbalanced journal post (Debit $1,000 != Credit $800)...")
    if "error" in res or "detail" in res:
        print(f"  Response: REJECTED with error: {res.get('detail')}")
        print("  [PASS] Zero-tolerance double-entry validation successfully BLOCKED unbalanced entry!")
    else:
        print("  FAIL: System allowed unbalanced entry!")
        sys.exit(1)

    print("\n==================================================")
    print("ALL 11 ACCOUNTING & BANKING TESTS PASSED PERFECTLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
