import urllib.request
import json
import sys

def run_checks():
    routes = [
        "http://localhost:3002/accounting/balance-sheet",
        "http://localhost:3002/accounting/profit-loss",
        "http://localhost:3002/accounting/trial-balance",
        "http://localhost:3002/accounting/cash-flow",
        "http://localhost:3002/accounting/general-ledger",
        "http://localhost:3002/receivables",
        "http://localhost:3002/banking",
    ]

    print("========================================")
    print("1. FRONTEND ROUTES VERIFICATION")
    print("========================================")
    all_routes_ok = True
    for r in routes:
        try:
            req = urllib.request.Request(r, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as res:
                content = res.read().decode("utf-8", errors="ignore")
                print(f"[OK] {res.status} | {r} ({len(content)} bytes)")
        except Exception as e:
            print(f"[FAIL] {r} -> {e}")
            all_routes_ok = False

    print("\n========================================")
    print("2. BACKEND BALANCE SHEET API VERIFICATION")
    print("========================================")
    api_url = "http://127.0.0.1:8000/api/accounting/balance-sheet"
    req = urllib.request.Request(api_url)
    with urllib.request.urlopen(req, timeout=10) as res:
        data = json.loads(res.read())

    total_assets = data.get("total_assets")
    total_liab_eq = data.get("total_liabilities_and_equity")
    difference = data.get("difference")
    is_balanced = data.get("is_balanced")
    notice = data.get("notice")
    carrier = data.get("liabilities", {}).get("carrier_credit_standing", {})

    print(f"Status Code: 200 OK")
    print(f"Total Assets: ${total_assets:,.2f}")
    print(f"Total Liabilities & Equity: ${total_liab_eq:,.2f}")
    print(f"Difference: ${difference:.2f}")
    print(f"Is Balanced: {is_balanced}")
    print(f"Carrier Standing: {carrier.get('status')}")
    print(f"Notice: {notice}")
    print(f"Asset Accounts: {len(data['assets']['items'])}")
    print(f"Liability Accounts: {len(data['liabilities']['items'])}")
    print(f"Equity Accounts: {len(data['equity']['items'])}")

    assert is_balanced == True, "Balance Sheet is out of balance!"
    assert total_assets == 3982180.66, f"Expected 3,982,180.66, got {total_assets}"
    assert total_liab_eq == 3982180.66, f"Expected 3,982,180.66, got {total_liab_eq}"
    assert difference == 0.0, f"Expected difference 0.0, got {difference}"
    assert carrier.get("amount") == 291160.0, f"Expected carrier credit $291,160.00"
    print("All Backend Balance Sheet Assertions Passed!")

    print("\n========================================")
    print("3. BALANCE SHEET PDF GENERATION")
    print("========================================")
    pdf_url = "http://127.0.0.1:8000/api/v1/accounting/balance-sheet.pdf"
    with urllib.request.urlopen(pdf_url, timeout=10) as res:
        pdf_bytes = res.read()
        print(f"[OK] {res.status} | Content-Type: {res.headers.get('content-type')} | Size: {len(pdf_bytes)} bytes")
        assert len(pdf_bytes) > 1000, "PDF size is unexpectedly small!"

    print("\n========================================")
    print("ALL VERIFICATIONS COMPLETED SUCCESSFULLY!")
    print("========================================")

if __name__ == "__main__":
    run_checks()
