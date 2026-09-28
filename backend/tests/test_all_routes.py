import urllib.request
import urllib.error
import sys

routes_to_test = [
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
    "/settings"
]

def test_routes():
    print("==================================================")
    print("TESTING ALL REQUESTED FRONTEND ROUTES")
    print("==================================================")
    
    passed = []
    failed = []
    
    for r in routes_to_test:
        url = f"http://localhost:3002{r}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                content = res.read().decode('utf-8', errors='ignore')
                # Check if Next.js returned an error page
                if "Application error: a client-side exception" in content:
                    print(f"[CLIENT CRASH] {r} -> Application error detected in HTML")
                    failed.append((r, "Client exception in HTML"))
                elif res.status == 200:
                    print(f"[200 OK] {r} ({len(content)} bytes)")
                    passed.append(r)
                else:
                    print(f"[{res.status}] {r}")
                    passed.append(r)
        except urllib.error.HTTPError as e:
            print(f"[{e.code} FAIL] {r} -> {e}")
            failed.append((r, f"HTTP {e.code}"))
        except Exception as e:
            print(f"[ERR FAIL] {r} -> {e}")
            failed.append((r, str(e)))
            
    print(f"\nSummary:")
    print(f"Passed: {len(passed)} / {len(routes_to_test)}")
    print(f"Failed: {len(failed)} / {len(routes_to_test)}")
    if failed:
        for r, err in failed:
            print(f"  FAILED: {r} -> {err}")

if __name__ == "__main__":
    test_routes()
