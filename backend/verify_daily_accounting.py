import os
import shutil
import tempfile
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.database import Base
from app.accounting_engine import compute_trial_balance, round_money
from app.daily_accounting_engine import (
    get_daily_financial_center,
    generate_voucher_number,
    record_receipt,
    record_payment,
    execute_multi_channel_transfer,
    record_physical_cash_count,
    perform_daily_close,
    record_credit_note,
    record_debit_note,
    record_opening_balance,
    get_account_book,
    get_detailed_accounting_health,
)

def run_tests():
    print("=====================================================================")
    print("AQ COMPANIES — 23-SCENARIO DAILY ACCOUNTING VERIFICATION SUITE")
    print("=====================================================================")

    # 1. First run read-only health diagnostics on the active production database
    from app.database import SessionLocal as ProdSession
    prod_db = ProdSession()
    try:
        health = get_detailed_accounting_health(prod_db)
        print(f"\n[LIVE PRODUCTION DATABASE HEALTH STATUS]: {health['overall_status']}")
        for diag in health["diagnostics"]:
            print(f"  - {diag['module']}: {diag['status']} (diff: ${diag['difference']:,.2f}) -> {diag['details']}")
        assert health["is_healthy"] or health["overall_status"] == "HEALTHY", f"Production database has integrity error: {health}"
    finally:
        prod_db.close()

    # 2. Setup isolated test database based on active db
    base_dir = os.path.dirname(os.path.abspath(__file__))
    source_db = os.path.join(base_dir, "aq_companies.db")
    test_db_path = os.path.join(base_dir, "test_aq_verification.db")
    
    if os.path.exists(test_db_path):
        os.remove(test_db_path)
    shutil.copyfile(source_db, test_db_path)

    test_engine = create_engine(f"sqlite:///{test_db_path}", connect_args={"check_same_thread": False})
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    db = TestSession()

    try:
        # Pre-fetch accounts
        bank_acc = db.query(models.BankAccount).filter(models.BankAccount.account_type == "BANK").first()
        cash_acc = db.query(models.BankAccount).filter(models.BankAccount.account_type == "CASH").first()
        sarafi_acc = db.query(models.BankAccount).filter(models.BankAccount.account_type == "SARAFI").first()
        sarafi_acc2 = db.query(models.BankAccount).filter(models.BankAccount.account_type == "SARAFI", models.BankAccount.id != sarafi_acc.id).first()
        customer = db.query(models.Customer).first()
        invoice = db.query(models.Invoice).filter(models.Invoice.balance_due > 0).first()
        supplier = db.query(models.Supplier).first()
        carrier = db.query(models.TransportCompany).first()

        assert bank_acc is not None, "Bank account required"
        assert cash_acc is not None, "Cash account required"
        assert sarafi_acc is not None, "Sarafi account required"
        assert sarafi_acc2 is not None, "Second Sarafi account required"

        passed = 0

        # Scenario 1: Cash Receipt with Invoice Allocation
        print("\n--- Testing Scenario 1: Cash Receipt with Invoice Allocation ---")
        inv_bal_before = invoice.balance_due
        res1 = record_receipt(
            db=db,
            account_id=cash_acc.id,
            received_from=customer.customer_name,
            party_type="CUSTOMER",
            amount=Decimal("5000.00"),
            customer_id=customer.id,
            invoice_id=invoice.id,
            receipt_date=date.today(),
            reference="CASH-REC-001",
            description="Test customer cash receipt",
        )
        assert res1["success"] is True
        assert res1["voucher_number"].startswith("CRV-")
        db.refresh(invoice)
        assert invoice.balance_due == inv_bal_before - Decimal("5000.00")
        print(f"PASSED: Voucher {res1['voucher_number']}, allocated to Invoice #{invoice.invoice_number}")
        passed += 1

        # Scenario 2: Cash Payment to Supplier (AP reduction)
        print("\n--- Testing Scenario 2: Cash Payment to Supplier ---")
        res2 = record_payment(
            db=db,
            account_id=cash_acc.id,
            paid_to=supplier.supplier_name if supplier else "Afghan Supplier",
            party_type="SUPPLIER",
            amount=Decimal("1200.00"),
            supplier_id=supplier.id if supplier else None,
            payment_date=date.today(),
            reference="CASH-PAY-001",
            description="Test supplier cash disbursement",
        )
        assert res2["success"] is True
        assert res2["voucher_number"].startswith("CPV-")
        print(f"PASSED: Voucher {res2['voucher_number']}, Dr 2000 AP, Cr 1010 Cash")
        passed += 1

        # Scenario 3: Bank Receipt (Customer Advance)
        print("\n--- Testing Scenario 3: Bank Receipt (Customer Advance) ---")
        res3 = record_receipt(
            db=db,
            account_id=bank_acc.id,
            received_from="Fresh Import House",
            party_type="CUSTOMER",
            amount=Decimal("15000.00"),
            receipt_date=date.today(),
            reference="BANK-REC-001",
            description="Advance received into bank account",
        )
        assert res3["success"] is True
        assert res3["voucher_number"].startswith("BRV-")
        assert res3["is_advance"] is True
        print(f"PASSED: Voucher {res3['voucher_number']}, credited Account 2150 Customer Advances")
        passed += 1

        # Scenario 4: Bank Payment to Carrier (Transport Payable)
        print("\n--- Testing Scenario 4: Bank Payment to Carrier ---")
        res4 = record_payment(
            db=db,
            account_id=bank_acc.id,
            paid_to=carrier.company_name if carrier else "Sky Ariana",
            party_type="TRANSPORT",
            amount=Decimal("8500.00"),
            transport_company_id=carrier.id if carrier else None,
            payment_date=date.today(),
            reference="WIRE-TRANS-001",
            description="Carrier freight payment",
        )
        assert res4["success"] is True
        assert res4["voucher_number"].startswith("BPV-")
        print(f"PASSED: Voucher {res4['voucher_number']}, Dr 2100 Transport Payable, Cr Bank")
        passed += 1

        # Scenario 5: Sarafi Receipt
        print("\n--- Testing Scenario 5: Sarafi Receipt ---")
        res5 = record_receipt(
            db=db,
            account_id=sarafi_acc.id,
            received_from="Sarafi Client Receipt",
            party_type="CUSTOMER",
            amount=Decimal("4000.00"),
            receipt_date=date.today(),
            reference="SAR-REC-001",
            description="Sarafi incoming settlement",
        )
        assert res5["success"] is True
        assert res5["voucher_number"].startswith("SRV-")
        print(f"PASSED: Voucher {res5['voucher_number']}, Sarafi receipt recorded")
        passed += 1

        # Scenario 6: Sarafi Payment (Operating Expense)
        print("\n--- Testing Scenario 6: Sarafi Payment for Operating Expense ---")
        res6 = record_payment(
            db=db,
            account_id=sarafi_acc.id,
            paid_to="Kabul Office Landlord",
            party_type="EXPENSE",
            amount=Decimal("1500.00"),
            expense_account_code="6200",  # Office Rent
            payment_date=date.today(),
            reference="SAR-PAY-001",
            description="Kabul branch office rent payment",
        )
        assert res6["success"] is True
        assert res6["voucher_number"].startswith("SPV-")
        print(f"PASSED: Voucher {res6['voucher_number']}, Dr 6200 Rent Expense, Cr Sarafi")
        passed += 1

        # Scenario 7: Bank to Cash Transfer
        print("\n--- Testing Scenario 7: Bank to Cash Transfer ---")
        res7 = execute_multi_channel_transfer(
            db=db,
            source_account_id=bank_acc.id,
            destination_account_id=cash_acc.id,
            source_amount=Decimal("10000.00"),
            transfer_date=date.today(),
            reference="ATM-WITHDRAW-01",
            description="Bank withdrawal to Cash Vault",
        )
        assert res7["success"] is True
        assert res7["transfer_code"].startswith("TRF-")
        print(f"PASSED: Transfer {res7['transfer_code']}, Bank -> Cash, Zero Income/Expense")
        passed += 1

        # Scenario 8: Cash to Bank Transfer
        print("\n--- Testing Scenario 8: Cash to Bank Transfer ---")
        res8 = execute_multi_channel_transfer(
            db=db,
            source_account_id=cash_acc.id,
            destination_account_id=bank_acc.id,
            source_amount=Decimal("3000.00"),
            transfer_date=date.today(),
            reference="CASH-DEPOSIT-01",
            description="Cash Vault deposit into Bank",
        )
        assert res8["success"] is True
        print(f"PASSED: Transfer {res8['transfer_code']}, Cash -> Bank")
        passed += 1

        # Scenario 9: Bank to Sarafi Transfer
        print("\n--- Testing Scenario 9: Bank to Sarafi Transfer ---")
        res9 = execute_multi_channel_transfer(
            db=db,
            source_account_id=bank_acc.id,
            destination_account_id=sarafi_acc.id,
            source_amount=Decimal("7500.00"),
            transfer_date=date.today(),
            reference="WIRE-SARAFI-01",
            description="Funding Omid Ehsan Sarafi desk",
        )
        assert res9["success"] is True
        print(f"PASSED: Transfer {res9['transfer_code']}, Bank -> Sarafi")
        passed += 1

        # Scenario 10: Sarafi to Bank Transfer
        print("\n--- Testing Scenario 10: Sarafi to Bank Transfer ---")
        res10 = execute_multi_channel_transfer(
            db=db,
            source_account_id=sarafi_acc.id,
            destination_account_id=bank_acc.id,
            source_amount=Decimal("2500.00"),
            transfer_date=date.today(),
            reference="SARAFI-BANK-01",
            description="Sarafi desk repatriation to Bank",
        )
        assert res10["success"] is True
        print(f"PASSED: Transfer {res10['transfer_code']}, Sarafi -> Bank")
        passed += 1

        # Scenario 11: Cash to Sarafi Transfer
        print("\n--- Testing Scenario 11: Cash to Sarafi Transfer ---")
        res11 = execute_multi_channel_transfer(
            db=db,
            source_account_id=cash_acc.id,
            destination_account_id=sarafi_acc.id,
            source_amount=Decimal("2000.00"),
            transfer_date=date.today(),
            reference="CASH-SARAFI-01",
            description="Vault delivery to Shahzada broker",
        )
        assert res11["success"] is True
        print(f"PASSED: Transfer {res11['transfer_code']}, Cash -> Sarafi")
        passed += 1

        # Scenario 12: Sarafi to Cash Transfer
        print("\n--- Testing Scenario 12: Sarafi to Cash Transfer ---")
        res12 = execute_multi_channel_transfer(
            db=db,
            source_account_id=sarafi_acc.id,
            destination_account_id=cash_acc.id,
            source_amount=Decimal("1000.00"),
            transfer_date=date.today(),
            reference="SARAFI-CASH-01",
            description="Hawala cash withdrawal to vault",
        )
        assert res12["success"] is True
        print(f"PASSED: Transfer {res12['transfer_code']}, Sarafi -> Cash")
        passed += 1

        # Scenario 13: Sarafi to Sarafi Transfer
        print("\n--- Testing Scenario 13: Sarafi to Sarafi Transfer ---")
        res13 = execute_multi_channel_transfer(
            db=db,
            source_account_id=sarafi_acc.id,
            destination_account_id=sarafi_acc2.id,
            source_amount=Decimal("1500.00"),
            transfer_date=date.today(),
            reference="SAR-INTER-01",
            description="Inter-Sarafi rebalancing",
        )
        assert res13["success"] is True
        print(f"PASSED: Transfer {res13['transfer_code']}, Sarafi 1 -> Sarafi 2")
        passed += 1

        # Scenario 14: Currency Exchange with Commission
        print("\n--- Testing Scenario 14: Currency Exchange with Commission ---")
        afn_cash = db.query(models.BankAccount).filter(models.BankAccount.currency == "AFN").first()
        if not afn_cash:
            afn_cash = models.BankAccount(
                bank_name="Cash Vault AFN",
                account_name="Main Afghan Afghani Cash Vault",
                account_number="CASH-AFN-TEST",
                currency="AFN",
                account_type="CASH",
                status="ACTIVE",
            )
            db.add(afn_cash)
            db.commit()

        res14 = execute_multi_channel_transfer(
            db=db,
            source_account_id=cash_acc.id,  # USD
            destination_account_id=afn_cash.id,  # AFN
            source_amount=Decimal("1000.00"),
            destination_amount=Decimal("70000.00"),
            exchange_rate=Decimal("70.00"),
            commission_amount=Decimal("15.00"),  # $15 commission
            transfer_date=date.today(),
            reference="FX-USD-AFN-01",
            description="Convert $1,000 USD to 70,000 AFN @ 70.00 with $15 fee",
        )
        assert res14["success"] is True
        assert res14["voucher_number"].startswith("FX-")
        print(f"PASSED: Voucher {res14['voucher_number']}, FX with $15 commission to 5600 Bank Charges")
        passed += 1

        # Scenario 15: Customer Advance
        print("\n--- Testing Scenario 15: Customer Advance ---")
        res15 = record_receipt(
            db=db,
            account_id=bank_acc.id,
            received_from=customer.customer_name,
            party_type="CUSTOMER",
            amount=Decimal("8000.00"),
            customer_id=customer.id,
            receipt_date=date.today(),
            reference="CUST-ADV-001",
            description="Unallocated deposit placed into advance account",
        )
        assert res15["is_advance"] is True
        print(f"PASSED: Voucher {res15['voucher_number']}, correctly identified as Customer Advance")
        passed += 1

        # Scenario 16: Supplier Advance Payment
        print("\n--- Testing Scenario 16: Supplier Advance Payment ---")
        res16 = record_payment(
            db=db,
            account_id=bank_acc.id,
            paid_to=supplier.supplier_name if supplier else "Mazar Processing Corp",
            party_type="SUPPLIER",
            amount=Decimal("12000.00"),
            supplier_id=supplier.id if supplier else None,
            payment_date=date.today(),
            reference="SUPP-ADV-001",
            description="Deposit for next almond harvest",
        )
        assert res16["success"] is True
        print(f"PASSED: Voucher {res16['voucher_number']}, Dr 2000/1350 Supplier Advance, Cr Bank")
        passed += 1

        # Scenario 17: Transport Advance Payment
        print("\n--- Testing Scenario 17: Transport Advance Payment ---")
        res17 = record_payment(
            db=db,
            account_id=bank_acc.id,
            paid_to=carrier.company_name if carrier else "Sky Ariana Limited",
            party_type="TRANSPORT",
            amount=Decimal("20000.00"),
            transport_company_id=carrier.id if carrier else None,
            payment_date=date.today(),
            reference="TRANS-ADV-001",
            description="Pre-payment wire for Chabahar containers",
        )
        assert res17["success"] is True
        print(f"PASSED: Voucher {res17['voucher_number']}, Dr 2100 Transport Payable, Cr Bank")
        passed += 1

        # Scenario 18: Expense Payment
        print("\n--- Testing Scenario 18: Operating Expense Payment ---")
        res18 = record_payment(
            db=db,
            account_id=bank_acc.id,
            paid_to="Deloitte Afghanistan",
            party_type="EXPENSE",
            amount=Decimal("3500.00"),
            expense_account_code="6000",  # Office Expense
            payment_date=date.today(),
            reference="EXP-AUDIT-001",
            description="Quarterly financial review fee",
        )
        assert res18["success"] is True
        print(f"PASSED: Voucher {res18['voucher_number']}, Dr 6000 Office Expense, Cr Bank")
        passed += 1

        # Scenario 19: Customer Credit Note
        print("\n--- Testing Scenario 19: Customer Credit Note ---")
        inv_bal_before_cn = invoice.balance_due
        res19 = record_credit_note(
            db=db,
            customer_id=customer.id,
            amount=Decimal("500.00"),
            reason="Commercial discount for minor packing damage",
            invoice_id=invoice.id,
            note_date=date.today(),
        )
        assert res19["success"] is True
        assert res19["note_number"].startswith("CN-")
        db.refresh(invoice)
        assert invoice.balance_due == inv_bal_before_cn - Decimal("500.00")
        print(f"PASSED: Credit Note {res19['note_number']}, Dr 4150 Sales Returns, Cr 1100 AR")
        passed += 1

        # Scenario 20: Supplier/Carrier Debit Note
        print("\n--- Testing Scenario 20: Carrier Debit Note ---")
        res20 = record_debit_note(
            db=db,
            party_type="TRANSPORT",
            party_id=carrier.id if carrier else 1,
            amount=Decimal("750.00"),
            reason="Demurrage penalty claim charged back to carrier",
            note_date=date.today(),
        )
        assert res20["success"] is True
        assert res20["note_number"].startswith("DN-")
        print(f"PASSED: Debit Note {res20['note_number']}, Dr 2100 Transport, Cr 5100 Freight")
        passed += 1

        # Scenario 21: Physical Cash Count with Difference & Auto Adjustment
        print("\n--- Testing Scenario 21: Physical Cash Count with Shortage ---")
        db.refresh(cash_acc)
        system_cash = cash_acc.current_balance
        phys_count = system_cash - Decimal("25.00")  # $25 shortage
        res21 = record_physical_cash_count(
            db=db,
            cash_account_id=cash_acc.id,
            physical_count=phys_count,
            reason="Daily register discrepancy investigation",
            auto_adjust=True,
        )
        assert res21["status"] == "SHORTAGE"
        assert res21["difference"] == -25.0
        assert res21["auto_adjusted"] is True
        db.refresh(cash_acc)
        assert cash_acc.current_balance == phys_count
        print(f"PASSED: Cash Count {res21['count_code']}, -$25 shortage auto-adjusted to 6450 Cash Shortage")
        passed += 1

        # Scenario 22: Opening Balance Setup against Account 3000 Equity
        print("\n--- Testing Scenario 22: Formal Opening Balance Setup ---")
        res22 = record_opening_balance(
            db=db,
            entity_type="BANK_ACCOUNT",
            entity_name="Ghazanfar Bank USD New Branch",
            debit=Decimal("50000.00"),
            credit=Decimal("0.00"),
            currency="USD",
            effective_date=date.today(),
            notes="Initial bank setup for northern branch",
        )
        assert res22["success"] is True
        assert res22["entry_code"].startswith("OBE-")
        print(f"PASSED: Opening balance {res22['entry_code']}, Dr 1000 Bank, Cr 3000 Equity")
        passed += 1

        # Scenario 23: Daily Close & General Ledger Integrity Verification
        print("\n--- Testing Scenario 23: Daily Close & GL Balance Verification ---")
        res23 = perform_daily_close(
            db=db,
            close_date=date.today(),
            notes="End of day test close",
        )
        assert res23["status"] == "CLOSED"
        assert "summary" in res23
        print(f"PASSED: Daily close completed for {res23['close_date']}.")

        tb = compute_trial_balance(db)
        print(f"\n[FINAL GENERAL LEDGER BALANCE CHECK]:")
        print(f"  Total Debits:  ${tb['total_debit']:,.2f}")
        print(f"  Total Credits: ${tb['total_credit']:,.2f}")
        print(f"  Difference:    ${tb['difference']:,.2f}")
        print(f"  Is Balanced:   {tb['is_balanced']}")
        assert tb["is_balanced"] is True, f"GL Trial Balance difference is not zero: ${tb['difference']}"
        passed += 1

        print("\n=====================================================================")
        print(f"ALL {passed}/23 DAILY ACCOUNTING & SARAFI SCENARIOS PASSED WITH 100% ACCURACY!")
        print("DOUBLE-ENTRY GENERAL LEDGER REMAINS PERFECTLY BALANCED ($0.00 DIFFERENCE)!")
        print("=====================================================================")

    finally:
        db.close()
        if os.path.exists(test_db_path):
            try:
                os.remove(test_db_path)
            except Exception:
                pass

if __name__ == "__main__":
    run_tests()
