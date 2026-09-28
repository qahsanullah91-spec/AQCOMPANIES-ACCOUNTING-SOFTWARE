"""
AQ COMPANIES — Accounting Integrity & Golden Baseline Verification CLI
Used by Windows maintenance jobs or pre-deployment checks to guarantee
zero discrepancy and protect financial invariants.
Exits 0 if healthy, 1 if any discrepancy detected.
"""
import sys
import os

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.database import SessionLocal
from app.services.accounting.integrity_service import AccountingIntegrityService

def main():
    print("=" * 70)
    print("AQ COMPANIES — COMPLETE ACCOUNTING INTEGRITY AUDIT")
    print("=" * 70)
    
    db = SessionLocal()
    try:
        report = AccountingIntegrityService.run_full_accounting_integrity_audit(db)
        checks = report["checks"]
        
        print(f"Audit Timestamp:       {report['as_of_date']}")
        print(f"Overall Status:        {report['overall_status']}")
        
        jb = checks["journal_balance"]
        print(f"Total Debits:          ${jb['total_debit']:,.2f}")
        print(f"Total Credits:         ${jb['total_credit']:,.2f}")
        print(f"General Ledger Diff:   ${jb['difference']:,.2f} -> {jb['status']}")
        
        orphans = checks["orphan_records"]
        orphan_allocs = orphans.get("orphan_invoice_allocations_count", 0) + orphans.get("orphan_transaction_allocations_count", 0)
        print(f"Orphan Journal Lines:  {orphans['orphan_journal_lines_count']} -> {orphans['status']}")
        print(f"Orphan Allocations:    {orphan_allocs}")
        
        bs = checks["balance_sheet_equation"]
        print(f"Balance Sheet Check:   Assets = Liab + Equity (Diff: ${bs['difference']:,.2f}) -> {bs['status']}")
        
        nulls = checks["null_financial_rules"]
        print(f"NULL Cost Invariant:   {nulls['pending_supplier_cost_shipments_count']} unbilled preserved -> {nulls['status']}")
        
        print("\n>> Golden Baseline Invariants:")
        baselines = checks["golden_baselines"]["metrics"]
        sales = baselines["sales"]
        print(f"  Sales Baseline:      ${sales['actual']:,.2f} (Expected ${sales['expected']:,.2f}) -> {'PASS' if sales['match'] else 'FAIL'}")
        
        tc = baselines["transport_credit_in_aq_favor"]
        print(f"  Transport Credit:    ${tc['actual']:,.2f} (Expected ${tc['expected']:,.2f}) -> {'PASS' if tc['match'] else 'FAIL'}")
        
        vr = baselines["verified_receipts"]
        print(f"  Verified Receipts:   ${vr['actual']:,.2f} (Expected ${vr['expected']:,.2f}) -> {'PASS' if vr['match'] else 'FAIL'}")
        
        if report["overall_status"] in ("PASS", "HEALTHY"):
            print("\n>> [ALL CHECKS PASSED] System is 100% sound, balanced, and production ready.")
            sys.exit(0)
        else:
            print(f"\n>> [ATTENTION REQUIRED] Overall status: {report['overall_status']}")
            sys.exit(1)
            
    except Exception as exc:
        print(f"[FATAL] Integrity verification crashed: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
