import os
import re
import urllib.request
import urllib.error
import json

def scan_frontend_api_calls():
    frontend_app = "frontend/src/app"
    api_calls = {}
    
    for root, dirs, files in os.walk(frontend_app):
        for f in files:
            if f.endswith((".tsx", ".ts")):
                path = os.path.join(root, f)
                with open(path, "r", encoding="utf-8", errors="ignore") as fp:
                    content = fp.read()
                    # fetchApi matches
                    matches = re.findall(r'fetchApi[<(][^>]*[>(]?\([`\'"](/[^`\'"?$]+)', content)
                    for m in matches:
                        endpoint = m.strip()
                        api_calls.setdefault(endpoint, []).append(path)
                    # direct fetch matches
                    matches2 = re.findall(r'fetch\([`\'"](/api/[^`\'"?$]+)', content)
                    for m in matches2:
                        endpoint = m.strip()
                        api_calls.setdefault(endpoint, []).append(path)
                        
    return api_calls

def test_backend_endpoints(api_calls):
    print("==================================================")
    print("BACKEND API AUDIT FOR FRONTEND CALLS")
    print("==================================================")
    
    results = {"200": [], "404": [], "500": [], "other": []}
    
    for ep in sorted(api_calls.keys()):
        # Handle endpoints that might need /api prefix
        url = f"http://127.0.0.1:8000/api{ep}" if not ep.startswith("/api") else f"http://127.0.0.1:8000{ep}"
        status = None
        data = None
        error_detail = None
        
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=5) as res:
                status = res.status
                raw = res.read()
                try:
                    data = json.loads(raw)
                except Exception:
                    data = f"Non-JSON response ({len(raw)} bytes)"
                results["200"].append((ep, url, data))
                print(f"[200 OK] {ep}")
        except urllib.error.HTTPError as e:
            status = e.code
            try:
                err_content = e.read().decode('utf-8', errors='ignore')
            except Exception:
                err_content = str(e)
            if status == 404:
                results["404"].append((ep, url, err_content, api_calls[ep]))
                print(f"[404 NOT FOUND] {ep} (Called by {len(api_calls[ep])} files)")
            elif status == 500:
                results["500"].append((ep, url, err_content, api_calls[ep]))
                print(f"[500 SERVER ERROR] {ep}: {err_content}")
            else:
                results["other"].append((ep, url, status, err_content, api_calls[ep]))
                print(f"[{status}] {ep}: {err_content}")
        except Exception as e:
            results["other"].append((ep, url, "CONN_ERROR", str(e), api_calls[ep]))
            print(f"[CONN_ERROR] {ep}: {e}")

    return results

if __name__ == "__main__":
    calls = scan_frontend_api_calls()
    print(f"Discovered {len(calls)} endpoints called in frontend.")
    res = test_backend_endpoints(calls)
    print(f"\nSummary:")
    print(f"  200 OK: {len(res['200'])}")
    print(f"  404 Not Found: {len(res['404'])}")
    print(f"  500 Error: {len(res['500'])}")
    print(f"  Other: {len(res['other'])}")
    
    if res["404"]:
        print("\n--- 404 ENDPOINTS ---")
        for ep, url, err, callers in res["404"]:
            print(f"Endpoint: {ep}")
            for c in callers[:2]:
                print(f"  Caller: {c}")
    if res["500"]:
        print("\n--- 500 ENDPOINTS ---")
        for ep, url, err, callers in res["500"]:
            print(f"Endpoint: {ep} -> {err}")
