#!/usr/bin/env python3
"""
AQ COMPANIES - Production Smoke Testing Suite
Validates that a live or local deployment is operational, database is connected,
all critical API endpoints respond with HTTP 200, and accounting invariants hold.
"""

import os
import sys
import argparse
import time
from typing import Dict, Any, Tuple

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)


def run_smoke_tests(base_url: str = None) -> bool:
    print("=" * 70)
    print("AQ COMPANIES — DEPLOYMENT SMOKE TEST SUITE")
    print("=" * 70)

    if base_url:
        import httpx
        client = httpx.Client(base_url=base_url.rstrip("/"), timeout=15.0)
        mode_desc = f"Remote/Live Server ({base_url})"
    else:
        from fastapi.testclient import TestClient
        from app.main import app
        client = TestClient(app)
        mode_desc = "Local In-Process TestClient"

    print(f"Target Environment: {mode_desc}")
    print("Executing pre-flight API and accounting smoke tests...\n")

    test_cases = [
        ("GET", "/health", 200, "Liveness Probe"),
        ("GET", "/ready", 200, "Database Readiness Probe"),
        ("GET", "/version", 200, "Semantic Versioning & Revision Metadata"),
        ("GET", "/api/v1/system/maintenance", 200, "Maintenance Lock Status"),
        ("GET", "/api/dashboard/kpis?filter=all", 200, "Audited Sales & Receivables KPIs"),
        ("GET", "/api/transport-companies/1/ledger", 200, "Sky Ariana Carrier Ledger Balance"),
        ("GET", "/api/customers", 200, "Customer Directory Subledger"),
        ("GET", "/api/bank-accounts", 200, "Treasury Bank & Cash Accounts"),
        ("GET", "/api/invoices", 200, "Accounts Receivable Invoice Register"),
        ("GET", "/api/reports/trial-balance", 200, "General Ledger Trial Balance Report"),
    ]

    all_passed = True
    start_total = time.perf_counter()

    for method, path, expected_status, description in test_cases:
        t0 = time.perf_counter()
        try:
            if method == "GET":
                res = client.get(path)
            else:
                res = client.post(path)

            elapsed_ms = (time.perf_counter() - t0) * 1000

            if res.status_code == expected_status:
                extra_info = ""
                # Extra validation checks for critical endpoints
                if path == "/version":
                    v_data = res.json()
                    extra_info = f" (v{v_data.get('app_version', v_data.get('version'))}, rev: {v_data.get('database_revision')})"
                elif path == "/api/dashboard/kpis?filter=all":
                    kpis = res.json().get("kpis", {})
                    sales = kpis.get("total_sales", 0.0)
                    if sales != 4386655.66:
                        all_passed = False
                        print(f" [FAIL] {path:35} -> Sales invariant breached: {sales} != 4386655.66")
                        continue
                    extra_info = f" (Sales: ${sales:,.2f})"
                elif path == "/api/transport-companies/1/ledger":
                    summary = res.json().get("summary", {})
                    credit = summary.get("credit_balance", 0.0)
                    if credit != 291160.0:
                        all_passed = False
                        print(f" [FAIL] {path:35} -> Carrier credit breached: {credit} != 291160.0")
                        continue
                    extra_info = f" (Standing Credit: ${credit:,.2f})"

                print(f" [PASS] {path:35} -> {res.status_code} ({elapsed_ms:.1f}ms){extra_info}")
            else:
                all_passed = False
                print(f" [FAIL] {path:35} -> Expected {expected_status}, Got {res.status_code} ({elapsed_ms:.1f}ms)")
                print(f"        Detail: {res.text[:120]}")
        except Exception as exc:
            all_passed = False
            elapsed_ms = (time.perf_counter() - t0) * 1000
            print(f" [ERROR] {path:34} -> Connection/Execution error: {exc} ({elapsed_ms:.1f}ms)")

    total_time_ms = (time.perf_counter() - start_total) * 1000
    print("-" * 70)
    print(f"Total Smoke Test Execution Time: {total_time_ms:.1f}ms")

    if all_passed:
        print("[SUCCESS] All 10 smoke checks passed. Deployment is fully healthy and verified.")
        print("=" * 70)
        return True
    else:
        print("[FAILURE] One or more smoke checks failed! Do not route production traffic.")
        print("=" * 70)
        return False


def main():
    parser = argparse.ArgumentParser(description="AQ Companies Smoke Testing Utility")
    parser.add_argument(
        "--url",
        "-u",
        type=str,
        default=None,
        help="Base URL for target server (e.g. http://127.0.0.1:8000). If omitted, tests in-process.",
    )
    args = parser.parse_args()
    success = run_smoke_tests(base_url=args.url)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
