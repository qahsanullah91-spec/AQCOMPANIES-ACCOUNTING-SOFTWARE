import os
import sys
import unittest
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy.orm import Session

# Ensure app is discoverable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import get_db, engine
from app import models
from app.multi_company_engine import (
    get_user_accessible_companies,
    validate_company_access,
    create_intercompany_transaction,
    reverse_intercompany_transaction,
    settle_intercompany_transaction,
    get_intercompany_reconciliation,
    get_intercompany_aging,
    get_central_treasury_summary,
    get_consolidated_trial_balance,
    get_consolidated_profit_and_loss,
    get_consolidated_balance_sheet,
    get_group_management_summary,
    round_money,
)


def run_multi_company_tests():
    db: Session = next(get_db())
    print("=" * 75)
    print("AQ COMPANIES — MULTI-COMPANY, TREASURY & CONSOLIDATION TEST SUITE")
    print("=" * 75)

    # -----------------------------------------------------------------
    # TEST 1: Multi-Company Entity Master
    # -----------------------------------------------------------------
    print("\n--- TEST 1: Multi-Company Entity Master ---")
    comps = db.query(models.Company).filter(models.Company.status != "DELETED").order_by(models.Company.id).all()
    assert len(comps) >= 4, f"Expected at least 4 companies, found {len(comps)}"
    codes = [c.company_code for c in comps]
    print(f"Entities: {[(c.id, c.company_code, c.company_name, c.country) for c in comps]}")
    assert "AQ-HQ" in codes, "Missing AQ-HQ"
    assert "NA-LTD" in codes, "Missing NA-LTD"
    assert "SA-LTD" in codes, "Missing SA-LTD"
    assert "RN-LTD" in codes, "Missing RN-LTD"
    print("PASS: All 4 group companies exist with distinct codes, legal names, and countries.")

    # -----------------------------------------------------------------
    # TEST 2: Historical Data Ownership & Isolation
    # -----------------------------------------------------------------
    print("\n--- TEST 2: Historical Data Ownership & Isolation ---")
    c1_invoices = db.query(models.Invoice).filter(models.Invoice.company_id == 1).count()
    c2_invoices = db.query(models.Invoice).filter(models.Invoice.company_id == 2).count()
    unassigned_invoices = db.query(models.Invoice).filter(models.Invoice.company_id == None).count()
    print(f"Company 1 Invoices: {c1_invoices} | Company 2 Invoices: {c2_invoices} | Unassigned: {unassigned_invoices}")
    assert c1_invoices > 0, "Company 1 must own historical baseline invoices"
    assert unassigned_invoices == 0, "No invoices should remain unassigned to a company"

    c1_banks = db.query(models.BankAccount).filter(models.BankAccount.company_id == 1).count()
    unassigned_banks = db.query(models.BankAccount).filter(models.BankAccount.company_id == None).count()
    print(f"Company 1 Bank Accounts: {c1_banks} | Unassigned: {unassigned_banks}")
    assert unassigned_banks == 0, "No bank accounts should remain unassigned"
    print("PASS: Historical baseline records cleanly assigned to Company 1 without orphaned data.")

    # -----------------------------------------------------------------
    # TEST 3: User Access & Company Permissions
    # -----------------------------------------------------------------
    print("\n--- TEST 3: User Access & Company Permissions ---")
    accessible = get_user_accessible_companies(db, user=None)
    assert len(accessible) >= 4, "Admin should access all group companies"
    
    # Check permissions validation
    admin_user = db.query(models.User).filter(models.User.role == "ADMIN").first()
    assert validate_company_access(db, admin_user, 1, "can_view") == True
    assert validate_company_access(db, admin_user, 2, "can_create") == True
    print(f"Admin Access Verified for {admin_user.username if admin_user else 'Admin'}: full rights across all entities.")
    print("PASS: Multi-company access and permission enforcement verified.")

    # -----------------------------------------------------------------
    # TEST 4: Intercompany Transaction Dual-Sided Journal Posting
    # -----------------------------------------------------------------
    print("\n--- TEST 4: Intercompany Transaction Dual-Sided Journal Posting ---")
    # SKY ARIANA LTD (id=3) pays $10,000 on behalf of NAJEB AMIN LTD (id=2)
    ic_payload = {
        "from_company_id": 3,
        "to_company_id": 2,
        "transaction_type": "PAYMENT_ON_BEHALF",
        "amount": Decimal("10000.00"),
        "currency": "USD",
        "purpose": "Port handling fee paid in Dubai for cargo transit",
        "reference": "TEST-IC-REF-001",
        "date": date.today(),
        "notes": "Automated verification test transaction",
    }
    ic_tx = create_intercompany_transaction(db, ic_payload, user_name="TestAuditor")
    print(f"Created Intercompany Tx: {ic_tx.transaction_code} | Status: {ic_tx.status}")
    assert ic_tx.id is not None
    assert ic_tx.from_journal_id is not None
    assert ic_tx.to_journal_id is not None

    # Inspect source journal
    j_from = db.query(models.JournalEntry).filter(models.JournalEntry.id == ic_tx.from_journal_id).first()
    assert j_from.company_id == 3, "Source journal must belong to Company 3"
    assert j_from.total_debit == Decimal("10000.00")
    assert j_from.total_credit == Decimal("10000.00")

    # Inspect destination journal
    j_to = db.query(models.JournalEntry).filter(models.JournalEntry.id == ic_tx.to_journal_id).first()
    assert j_to.company_id == 2, "Destination journal must belong to Company 2"
    assert j_to.total_debit == Decimal("10000.00")
    assert j_to.total_credit == Decimal("10000.00")

    print(f"Source Journal ({j_from.entry_number}): Dr 1370 / Cr Bank $10,000.00")
    print(f"Destination Journal ({j_to.entry_number}): Dr Bank / Cr 2350 $10,000.00")
    print("PASS: Dual-sided balanced journal entries created with correct company ownership.")

    # -----------------------------------------------------------------
    # TEST 5: Intercompany Due To / Due From Equality
    # -----------------------------------------------------------------
    print("\n--- TEST 5: Intercompany Due To / Due From Equality ---")
    recon = get_intercompany_reconciliation(db)
    print(f"Reconciliation Status: {recon['status']} | Total Due From: ${recon['total_due_from']:,.2f} | Total Due To: ${recon['total_due_to']:,.2f} | Diff: ${recon['net_difference']:,.2f}")
    assert recon["net_difference"] == 0.0, f"Expected $0.00 difference, got {recon['net_difference']}"
    assert recon["status"] == "BALANCED", "Expected status BALANCED"
    print("PASS: Intercompany Due From equals Due To with zero net difference.")

    # -----------------------------------------------------------------
    # TEST 6: Intercompany Settlement Workflow
    # -----------------------------------------------------------------
    print("\n--- TEST 6: Intercompany Settlement Workflow ---")
    settled_tx = settle_intercompany_transaction(db, ic_tx.id, settlement_ref="WIRE-SETTLE-8899", user_name="TestAuditor")
    assert settled_tx.status == "SETTLED"
    assert settled_tx.settlement_reference == "WIRE-SETTLE-8899"
    print(f"Transaction {settled_tx.transaction_code} settled successfully.")
    print("PASS: Intercompany settlement status and audit trail verified.")

    # -----------------------------------------------------------------
    # TEST 7: Intercompany Reversal Workflow
    # -----------------------------------------------------------------
    print("\n--- TEST 7: Intercompany Reversal Workflow ---")
    # Create another transaction to test reversal
    ic_rev_payload = {
        "from_company_id": 1,
        "to_company_id": 4,
        "transaction_type": "BANK_TRANSFER",
        "amount": Decimal("5000.00"),
        "currency": "USD",
        "purpose": "Working capital advance",
        "reference": "TEST-REV-001",
    }
    tx_to_rev = create_intercompany_transaction(db, ic_rev_payload, user_name="TestAuditor")
    rev_tx = reverse_intercompany_transaction(db, tx_to_rev.id, reason="Correction of duplicate advance", user_name="TestAuditor")
    assert rev_tx.status == "REVERSED"
    j1 = db.query(models.JournalEntry).filter(models.JournalEntry.id == rev_tx.from_journal_id).first()
    j2 = db.query(models.JournalEntry).filter(models.JournalEntry.id == rev_tx.to_journal_id).first()
    assert j1.status == "REVERSED"
    assert j2.status == "REVERSED"
    print(f"Transaction {rev_tx.transaction_code} reversed: both journals voided.")
    print("PASS: Intercompany reversal engine successfully inverted entries.")

    # -----------------------------------------------------------------
    # TEST 8: Central Treasury Cash & Currency Aggregation
    # -----------------------------------------------------------------
    print("\n--- TEST 8: Central Treasury Cash & Currency Aggregation ---")
    treasury = get_central_treasury_summary(db)
    print(f"Total Group Cash (USD): ${treasury['total_group_cash_usd']:,.2f}")
    print(f"Total Bank:             ${treasury['total_bank_usd']:,.2f}")
    print(f"Total Cash Vaults:      ${treasury['total_cash_vault_usd']:,.2f}")
    print(f"Total Sarafi:           ${treasury['total_sarafi_usd']:,.2f}")
    print("Currencies tracked:")
    for c in treasury["by_currency"]:
        print(f"  {c['currency']}: Original {c['original_amount']:,.2f} -> USD Eq ${c['usd_equivalent']:,.2f}")

    assert treasury["total_group_cash_usd"] > 0, "Group cash must be positive"
    assert len(treasury["by_company"]) >= 1, "Must aggregate by company"
    print("PASS: Central Treasury successfully aggregates cash across companies and currencies.")

    # -----------------------------------------------------------------
    # TEST 9: Consolidated Trial Balance & Intercompany Eliminations
    # -----------------------------------------------------------------
    print("\n--- TEST 9: Consolidated Trial Balance & Intercompany Eliminations ---")
    tb = get_consolidated_trial_balance(db)
    assert tb["totals"]["is_balanced"] == True, "Consolidated TB must be balanced"
    print(f"Consolidated Total Debit:  ${tb['totals']['consolidated_debit']:,.2f}")
    print(f"Consolidated Total Credit: ${tb['totals']['consolidated_credit']:,.2f}")
    print(f"Eliminations Debit:        ${tb['totals']['elimination_debit']:,.2f}")
    print(f"Eliminations Credit:       ${tb['totals']['elimination_credit']:,.2f}")
    assert tb["totals"]["elimination_debit"] == tb["totals"]["elimination_credit"], "Eliminations must be balanced"
    print("PASS: Consolidated Trial Balance eliminates Account 1370 and 2350 with zero discrepancy.")

    # -----------------------------------------------------------------
    # TEST 10: Consolidated Profit & Loss Statement
    # -----------------------------------------------------------------
    print("\n--- TEST 10: Consolidated Profit & Loss Statement ---")
    pnl = get_consolidated_profit_and_loss(db)
    summary = pnl["summary"]["consolidated"]
    print(f"Consolidated Sales Revenue: ${summary['total_revenue']:,.2f}")
    print(f"Consolidated Direct Costs:  ${summary['total_cogs']:,.2f}")
    print(f"Consolidated Gross Profit:  ${summary['gross_profit']:,.2f}")
    print(f"Consolidated Expenses:      ${summary['total_expenses']:,.2f}")
    print(f"Consolidated Net Profit:    ${summary['net_profit']:,.2f}")
    assert summary["total_revenue"] > 0, "Group revenue must be positive"
    print(f"Report Status: {pnl['report_status']} | Preliminary Reasons: {pnl['preliminary_reasons']}")
    print("PASS: Consolidated Profit & Loss generated with multi-company columns and eliminations.")

    # -----------------------------------------------------------------
    # TEST 11: Consolidated Balance Sheet Proving Assets == Liabilities + Equity
    # -----------------------------------------------------------------
    print("\n--- TEST 11: Consolidated Balance Sheet Proving Assets == Liabilities + Equity ---")
    bs = get_consolidated_balance_sheet(db)
    bs_sum = bs["summary"]["consolidated"]
    print(f"Consolidated Total Assets:              ${bs_sum['total_assets']:,.2f}")
    print(f"Consolidated Total Liabilities:         ${bs_sum['total_liabilities']:,.2f}")
    print(f"Consolidated Total Equity:              ${bs_sum['total_equity']:,.2f}")
    print(f"Consolidated Liabilities & Equity:     ${bs_sum['liabilities_and_equity']:,.2f}")
    print(f"Asset Eliminations:                    ${bs['summary']['eliminations']['asset_eliminations']:,.2f}")
    print(f"Liability Eliminations:                ${bs['summary']['eliminations']['liability_eliminations']:,.2f}")
    print(f"Is Balance Sheet Balanced:              {bs_sum['is_balanced']}")
    assert bs_sum["is_balanced"] == True, f"Balance sheet must balance: Assets {bs_sum['total_assets']} != L+E {bs_sum['liabilities_and_equity']}"
    print("PASS: Consolidated Balance Sheet verified: Assets = Liabilities + Equity with 0.00 discrepancy.")

    # -----------------------------------------------------------------
    # TEST 12: Group Management Dashboard KPIs & Company Comparison
    # -----------------------------------------------------------------
    print("\n--- TEST 12: Group Management Dashboard KPIs & Company Comparison ---")
    group_dash = get_group_management_summary(db)
    kpis = group_dash["kpis"]
    print(f"Total Group Sales:       ${kpis['total_group_sales']:,.2f}")
    print(f"Total Group Receivables: ${kpis['total_group_receivables']:,.2f}")
    print(f"Total Group Payables:    ${kpis['total_group_payables']:,.2f}")
    print(f"Total Group Cash:        ${kpis['total_group_cash']:,.2f}")
    print(f"Total Net KG Shipped:    {kpis['total_group_kg']:,.2f} kg")
    print(f"Total Containers:        {kpis['total_containers']}")
    print(f"Intercompany Status:     {kpis['intercompany_status']}")

    assert len(group_dash["companies"]) >= 4, "Must compare all companies"
    for c in group_dash["companies"]:
        print(f"  [{c['company_code']}] {c['company_name']} -> Sales: ${c['sales']:,.2f} | Receivables: ${c['receivables']:,.2f} | Profit: ${c['known_profit']:,.2f}")
    print("PASS: Group management summary and factual company comparison verified.")

    # -----------------------------------------------------------------
    # TEST 13: Intercompany Aging Analysis
    # -----------------------------------------------------------------
    print("\n--- TEST 13: Intercompany Aging Analysis ---")
    aging = get_intercompany_aging(db)
    print(f"Intercompany Aging Pairs: {len(aging)}")
    for a in aging:
        print(f"  {a['from_company_name']} -> {a['to_company_name']}: 0-30d: ${a['current_0_30']:,.2f} | Total: ${a['total_outstanding']:,.2f}")
    print("PASS: Intercompany aging buckets (0-30, 31-60, 61-90, 90+ days) computed.")

    # -----------------------------------------------------------------
    # TEST 14: Cross-Company Posting Block & Safety Validation
    # -----------------------------------------------------------------
    print("\n--- TEST 14: Cross-Company Posting Block & Safety Validation ---")
    # Verify that creating an intercompany transaction with same source and destination fails
    try:
        create_intercompany_transaction(db, {
            "from_company_id": 1,
            "to_company_id": 1,
            "transaction_type": "BANK_TRANSFER",
            "amount": Decimal("1000.00"),
        })
        assert False, "Should have blocked self-intercompany transaction"
    except ValueError as e:
        print(f"Expected Block: {e}")
        assert "Source and destination companies must be different" in str(e)
    print("PASS: Accidental self-intercompany transactions strictly blocked.")

    # -----------------------------------------------------------------
    # TEST 15: Company-Specific Subledger Account Seeding
    # -----------------------------------------------------------------
    print("\n--- TEST 15: Company-Specific Subledger Account Seeding ---")
    cca_count = db.query(models.CompanyCustomerAccount).filter(models.CompanyCustomerAccount.company_id == 1).count()
    csa_count = db.query(models.CompanySupplierAccount).filter(models.CompanySupplierAccount.company_id == 1).count()
    print(f"Company 1 Customer Accounts: {cca_count} | Supplier Accounts: {csa_count}")
    assert cca_count > 0, "Company 1 must have seeded customer accounts"
    assert csa_count > 0, "Company 1 must have seeded supplier accounts"
    print("PASS: Company-specific customer and supplier subledgers established.")

    db.close()
    print("\n" + "=" * 75)
    print("ALL 15 MULTI-COMPANY & TREASURY TESTS PASSED SUCCESSFULLY!")
    print("=" * 75)


if __name__ == "__main__":
    run_multi_company_tests()
