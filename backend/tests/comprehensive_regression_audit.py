import urllib.request
import urllib.error
import json
import sys

def run_comprehensive_audit():
    print("=====================================================================")
    print("AQ COMPANIES -- GLOBAL HARDENING & REGRESSION AUDIT SUITE")
    print("=====================================================================")
    
    # 1. TEST BASELINE NUMBERS FROM BACKEND
    print("\n[SECTION 1] VALIDATING FINANCIAL BASELINE & ACCOUNTING INTEGRITY")
    
    # Balance sheet
    bs_url = "http://127.0.0.1:8000/api/accounting/balance-sheet"
    with urllib.request.urlopen(bs_url) as res:
        bs_data = json.loads(res.read())
    
    assert bs_data["is_balanced"] == True, "Balance Sheet not balanced!"
    assert bs_data["difference"] == 0.0, f"Difference not 0.0: {bs_data['difference']}"
    assert bs_data["total_assets"] == 3982180.66, f"Assets mismatch: {bs_data['total_assets']}"
    assert bs_data["total_liabilities_and_equity"] == 3982180.66, f"Liab+Equity mismatch: {bs_data['total_liabilities_and_equity']}"
    print(f"[PASS] Balance Sheet in 100% Equilibrium: ${bs_data['total_assets']:,.2f} = ${bs_data['total_liabilities_and_equity']:,.2f}")
    
    # P&L Null rule
    pl_url = "http://127.0.0.1:8000/api/profit-and-loss"
    with urllib.request.urlopen(pl_url) as res:
        pl_data = json.loads(res.read())
    
    assert pl_data["net_profit"] is None, "Net profit should be NULL due to pending Afghan costs!"
    assert pl_data["profit_margin_pct"] is None, "Profit margin should be NULL!"
    assert pl_data["gross_profit"] is None, "Gross profit should be NULL!"
    assert pl_data["pending_purchases_count"] == 63, f"Expected 63 pending purchases, got {pl_data['pending_purchases_count']}"
    print(f"[PASS] Accounting NULL Rule Verified: 63 Afghan costs preserved as NULL (profit={pl_data['net_profit']}, margin={pl_data['profit_margin_pct']})")
    
    # Transport Standing
    tp_url = "http://127.0.0.1:8000/api/accounting/transport/account"
    with urllib.request.urlopen(tp_url) as res:
        tp_data = json.loads(res.read())
        pos = tp_data.get("position", {})
    
    assert pos.get("total_freight_charges") == 743650.0, f"Freight charges: {pos.get('total_freight_charges')}"
    assert pos.get("total_payments") == 1030000.0, f"Transport payments: {pos.get('total_payments')}"
    assert pos.get("total_opening_credit") == 4810.0, f"Opening credit: {pos.get('total_opening_credit')}"
    assert pos.get("carrier_credit_in_our_favor") == 291160.0, f"Carrier credit: {pos.get('carrier_credit_in_our_favor')}"
    assert pos.get("has_carrier_credit") == True, "has_carrier_credit should be True"
    print(f"[PASS] Transport Standing Verified: Freight=${pos.get('total_freight_charges'):,.2f}, Paid=${pos.get('total_payments'):,.2f}, Credit in AQ Favor=${pos.get('carrier_credit_in_our_favor'):,.2f}")

    # 2. TEST PDF REPORTS GENERATION
    print("\n[SECTION 2] VALIDATING AUTHORITATIVE PDF GENERATION")
    pdf_endpoints = [
        "/api/v1/accounting/balance-sheet.pdf",
        "/api/v1/accounting/profit-loss.pdf",
        "/api/v1/accounting/trial-balance.pdf",
        "/api/v1/accounting/cash-flow.pdf",
        "/api/v1/accounting/general-ledger.pdf",
        "/api/v1/transport/statement.pdf",
    ]
    for ep in pdf_endpoints:
        url = f"http://127.0.0.1:8000{ep}"
        try:
            with urllib.request.urlopen(url, timeout=10) as res:
                content_type = res.headers.get("content-type")
                data_len = len(res.read())
                assert res.status == 200, f"Status {res.status}"
                assert "application/pdf" in content_type, f"Wrong content-type: {content_type}"
                assert data_len > 1000, f"PDF too small: {data_len} bytes"
                print(f"[PASS] PDF Generated 200 OK: {ep} ({data_len} bytes, {content_type})")
        except Exception as e:
            print(f"[FAIL] PDF Failed: {ep} -> {e}")
            raise

    # 3. TEST ALL FRONTEND ROUTES
    print("\n[SECTION 3] FRONTEND ROUTES DIRECT ACCESS & REFRESH SMOKE TEST")
    routes = [
        "/",
        "/dashboard",
        "/accounting",
        "/accounting/daily",
        "/accounting/general-ledger",
        "/accounting/trial-balance",
        "/accounting/profit-loss",
        "/accounting/balance-sheet",
        "/accounting/cash-flow",
        "/accounting/chart-of-accounts",
        "/accounting/journal",
        "/accounting/audit",
        "/banking",
        "/banking/accounts",
        "/banking/transactions",
        "/banking/reconciliation",
        "/banking/import",
        "/banking/unmatched",
        "/receivables",
        "/payables",
        "/transport/account",
        "/transport",
        "/expenses",
        "/reports",
        "/payments",
        "/customers",
        "/suppliers",
        "/shipments",
        "/new-stock",
        "/purchases",
        "/sales",
        "/settings",
    ]
    
    failed_routes = []
    for r in routes:
        url = f"http://localhost:3002{r}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as res:
                html = res.read().decode("utf-8", errors="ignore")
                if "Application error: a client-side exception" in html:
                    print(f"[FAIL] Client crash detected on {r}")
                    failed_routes.append(r)
                elif res.status == 200:
                    print(f"[PASS] 200 OK: {r}")
                else:
                    print(f"[?] Status {res.status}: {r}")
        except Exception as e:
            print(f"[FAIL] Request failed: {r} -> {e}")
            failed_routes.append(r)

    assert len(failed_routes) == 0, f"Routes failed: {failed_routes}"
    
    print("\n=====================================================================")
    print("ALL TESTS & AUDIT CHECKS PASSED WITH 100% SUCCESS!")
    print("=====================================================================")

if __name__ == "__main__":
    run_comprehensive_audit()
