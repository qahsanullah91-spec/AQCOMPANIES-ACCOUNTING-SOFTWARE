"""
AQ COMPANIES - Independent Post-Migration Reconciliation & Integrity Verifier
Validates all migrated database figures against master Excel workbook numbers.
"""

import sys
import os
from decimal import Decimal

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app import models

def run_verification():
    db = SessionLocal()
    try:
        print("=" * 85)
        print("AQ COMPANIES — POST-MIGRATION INDEPENDENT RECONCILIATION VERIFICATION")
        print("=" * 85)

        # 1. Shipments count & totals
        shipments = db.query(models.Shipment).all()
        total_shipments = len(shipments)
        total_net_kg = sum(s.net_weight_kg for s in shipments)
        total_packages = sum(s.packages for s in shipments)
        total_cartons = sum(s.cartons for s in shipments)
        total_bags = sum(s.bags or 0 for s in shipments)
        priced_sales = sum((s.invoice_value for s in shipments if s.invoice_value is not None), Decimal("0.00"))
        unpriced_count = sum(1 for s in shipments if s.invoice_value is None)
        pending_cost_count = sum(1 for s in shipments if s.purchase_cost is None)

        # 2. Invoices & Customers
        invoices = db.query(models.Invoice).all()
        customers = db.query(models.Customer).all()
        cust_receivables = sum((s.customer_balance for s in shipments if s.customer_balance is not None), Decimal("0.00"))
        cust_receipts = sum((s.customer_amount_received for s in shipments), Decimal("0.00"))

        # 3. Transport charges & payments
        transport_charges = db.query(models.TransportCharge).all()
        freight_charges = [tc for tc in transport_charges if tc.entry_type == "FREIGHT CHARGE"]
        total_freight = sum(tc.debit_usd for tc in freight_charges)
        opening_credit_entry = next((tc for tc in transport_charges if tc.entry_type == "OPENING CREDIT"), None)
        opening_credit = opening_credit_entry.credit_usd if opening_credit_entry else Decimal("0.00")

        transport_payments = db.query(models.TransportPayment).all()
        total_wire_payments = sum(tp.amount_usd for tp in transport_payments)
        total_credits = total_wire_payments + opening_credit
        net_carrier_position = total_freight - total_credits

        # 4. New stock
        active_stocks = db.query(models.NewStock).filter(models.NewStock.status == "NEW").all()
        converted_stocks = db.query(models.NewStock).filter(models.NewStock.status == "CONVERTED").all()

        # 5. Data conflicts
        conflicts = db.query(models.DataConflict).all()

        # Benchmark expectations
        benchmarks = [
            ("Total Shipments", total_shipments, 63, "Records"),
            ("Total Net Weight", total_net_kg, Decimal("1422978.000"), "KG"),
            ("Total Packages (CTNS + BAGS)", total_packages, 90884, "Packages"),
            ("Total Cartons (CTNS)", total_cartons, 90041, "CTNS"),
            ("Total Bags (BAGS)", total_bags, 843, "BAGS"),
            ("Total Invoiced Sales", priced_sales, Decimal("4386655.66"), "USD"),
            ("Unpriced Shipments (NULL)", unpriced_count, 6, "Records"),
            ("Pending Purchase Cost (NULL)", pending_cost_count, 63, "Records"),
            ("Total Registered Customers", len(customers), 16, "Accounts"),
            ("Customer Receivables", cust_receivables, Decimal("4386655.66"), "USD"),
            ("Customer Receipts to Date", cust_receipts, Decimal("0.00"), "USD"),
            ("Total Freight Charges", total_freight, Decimal("743650.00"), "USD"),
            ("Opening Carrier Credit", opening_credit, Decimal("4810.00"), "USD"),
            ("Total Carrier Wire Payments", total_wire_payments, Decimal("1030000.00"), "USD"),
            ("Total Carrier Credits", total_credits, Decimal("1034810.00"), "USD"),
            ("Carrier Net Balance (Adv Credit)", net_carrier_position, Decimal("-291160.00"), "USD"),
            ("Active New Stock Containers", len(active_stocks), 3, "Containers"),
            ("Converted Stock (NEW-003->INV-01)", len(converted_stocks), 1, "Container"),
            ("Documented Data Conflicts", len(conflicts), 7, "Audit Items"),
        ]

        print(f"\n{'METRIC':<36} | {'ACTUAL DB':<18} | {'EXCEL / AUDIT':<18} | {'VARIANCE':<12} | {'STATUS'}")
        print("-" * 105)

        all_passed = True
        for name, actual, expected, unit in benchmarks:
            if isinstance(actual, (int, str)):
                diff = actual - expected if isinstance(actual, int) else 0
                diff_str = str(diff)
                match = (actual == expected)
            else:
                diff = actual - expected
                diff_str = f"${diff:,.2f}" if unit == "USD" else f"{diff:,.3f} {unit}"
                match = (abs(diff) < Decimal("0.001"))

            if not match:
                all_passed = False

            act_str = f"${actual:,.2f}" if unit == "USD" else f"{actual} {unit}"
            exp_str = f"${expected:,.2f}" if unit == "USD" else f"{expected} {unit}"
            status = "MATCH (OK)" if match else "MISMATCH"

            print(f"{name:<36} | {act_str:<18} | {exp_str:<18} | {diff_str:<12} | {status}")

        print("-" * 105)
        if all_passed:
            print(">>> 100% RECONCILIATION VERIFIED: EXACT $0.00 FINANCIAL VARIANCE ACROSS ALL METRICS! <<<")
        else:
            print(">>> CRITICAL WARNING: Reconciliation discrepancies found! <<<")

        print("\n--- NEW STOCK STATUS BREAKDOWN ---")
        for st in db.query(models.NewStock).all():
            link = f"-> Converted to Shipment {st.converted_shipment.shipment_code} ({st.converted_shipment.invoice_number})" if st.converted_shipment else "(Unallocated Pipeline)"
            val = st.proforma_value or st.selling_value
            print(f"  [{st.status:<9}] {st.stock_code:<12} | {st.cartons:>5} CTNS | {st.net_kg:>9.2f} KG | ${float(val):>10,.2f} | {link}")

        print("\n--- DOCUMENTED AUDIT CONFLICTS ---")
        for cf in conflicts:
            print(f"  * {cf.entity_code:<16} | Type: {cf.conflict_type:<24} | Status: {cf.status:<8} | Resolution: {cf.chosen_value}")

        print("=" * 85)
        return all_passed
    finally:
        db.close()

if __name__ == "__main__":
    success = run_verification()
    sys.exit(0 if success else 1)
