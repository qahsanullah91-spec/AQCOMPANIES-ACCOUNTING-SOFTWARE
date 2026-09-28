from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict, Any
import io
import csv
import json
import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, Query, Body, status, UploadFile, File, Form
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, desc

try:
    from app.database import get_db
    from app import models, schemas
    from app.accounting_engine import (
        round_money,
        seed_chart_of_accounts,
        get_account_by_code,
        create_journal_entry,
        reverse_journal_entry,
        compute_trial_balance,
        compute_profit_and_loss,
        compute_cash_flow,
        compute_receivables_aging,
        allocate_customer_payment,
        compute_transport_position,
        post_invoice_journal,
        post_customer_payment_journal,
        post_customer_advance_allocation_journal,
        post_purchase_journal,
        post_supplier_payment_journal,
        post_transport_charge_journal,
        post_transport_payment_journal,
        post_bank_charge_journal,
        recalculate_bank_running_balance,
        reverse_bank_transaction,
        preview_bank_statement,
        check_period_open,
        compute_balance_sheet,
        verify_accounting_consistency,
        get_accounting_work_queue,
        get_daily_summary,
        search_financial_records,
    )
    from app.banking_automation import (
        parse_bank_statement_file,
        commit_statement_batch,
        atomic_confirm_and_post_match,
        parse_swift_mt103,
        record_swift_mt103,
        execute_internal_bank_transfer,
    )
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
    from app.financial_reports_engine import (
        get_profit_and_loss_report,
        get_balance_sheet_report,
        get_detailed_trial_balance_report,
        get_cash_flow_statement_report,
        get_receivable_aging_report,
        get_payable_aging_report,
        get_profit_by_customer_report,
        get_profit_by_shipment_report,
        get_monthly_financial_summary_report,
        verify_period_close_readiness,
        close_accounting_period as engine_close_period,
        reopen_accounting_period as engine_reopen_period,
        get_budget_vs_actual_report,
        record_budget_entry,
        get_cash_forecast_report,
        get_accounting_audit_center_data,
        get_expense_and_bank_charges_analysis,
        get_customer_collection_performance,
        get_journal_review_data,
    )
except ImportError:
    from backend.app.database import get_db
    from backend.app import models, schemas
    from backend.app.accounting_engine import (
        round_money,
        seed_chart_of_accounts,
        get_account_by_code,
        create_journal_entry,
        reverse_journal_entry,
        compute_trial_balance,
        compute_profit_and_loss,
        compute_cash_flow,
        compute_receivables_aging,
        allocate_customer_payment,
        compute_transport_position,
        post_invoice_journal,
        post_customer_payment_journal,
        post_customer_advance_allocation_journal,
        post_purchase_journal,
        post_supplier_payment_journal,
        post_transport_charge_journal,
        post_transport_payment_journal,
        post_bank_charge_journal,
        recalculate_bank_running_balance,
        reverse_bank_transaction,
        preview_bank_statement,
        check_period_open,
        compute_balance_sheet,
        verify_accounting_consistency,
        get_accounting_work_queue,
        get_daily_summary,
        search_financial_records,
    )
    from backend.app.banking_automation import (
        parse_bank_statement_file,
        commit_statement_batch,
        atomic_confirm_and_post_match,
        parse_swift_mt103,
        record_swift_mt103,
        execute_internal_bank_transfer,
    )
    from backend.app.daily_accounting_engine import (
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
    from backend.app.financial_reports_engine import (
        get_profit_and_loss_report,
        get_balance_sheet_report,
        get_detailed_trial_balance_report,
        get_cash_flow_statement_report,
        get_receivable_aging_report,
        get_payable_aging_report,
        get_profit_by_customer_report,
        get_profit_by_shipment_report,
        get_monthly_financial_summary_report,
        verify_period_close_readiness,
        close_accounting_period as engine_close_period,
        reopen_accounting_period as engine_reopen_period,
        get_budget_vs_actual_report,
        record_budget_entry,
        get_cash_forecast_report,
        get_accounting_audit_center_data,
        get_expense_and_bank_charges_analysis,
        get_customer_collection_performance,
        get_journal_review_data,
    )

router = APIRouter(prefix="/api/accounting", tags=["Accounting & Banking"])


# =====================================================================
# 1. ACCOUNTING EXECUTIVE DASHBOARD & KPIS
# =====================================================================

@router.get("/dashboard")
def get_accounting_dashboard(
    target_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """
    Executive Financial Control Center Dashboard:
    - 15 Top KPI cards with real subledger & general ledger backing
    - Real-time Double-Entry Trial Balance Health
    - Financial Health Status Panel
    - Today's Accounting Work Queue
    - Daily Accounting Summary
    - Subledger vs GL Consistency Reconciliations
    """
    tb = compute_trial_balance(db)
    pl = compute_profit_and_loss(db)
    cf = compute_cash_flow(db)
    aging = compute_receivables_aging(db)
    tp = compute_transport_position(db)
    bs = compute_balance_sheet(db)
    consistency = verify_accounting_consistency(db)
    work_queue = get_accounting_work_queue(db)
    daily = get_daily_summary(db, target_date)

    # Invoices & Receivables
    inv_totals = db.query(
        func.coalesce(func.sum(models.Invoice.total_amount), Decimal("0.00")),
        func.coalesce(func.sum(models.Invoice.amount_received), Decimal("0.00")),
        func.coalesce(func.sum(models.Invoice.balance_due), Decimal("0.00")),
        func.count(models.Invoice.id),
    ).first()

    total_sales = float(inv_totals[0])
    total_received = float(inv_totals[1])
    total_receivable = float(inv_totals[2])

    # Unallocated Customer Advances (Account 2150)
    unallocated_advances = (
        db.query(func.coalesce(func.sum(models.PaymentAllocation.allocated_amount_usd), Decimal("0.00")))
        .filter(models.PaymentAllocation.allocation_type == "ADVANCE")
        .scalar()
    )

    # Unpriced purchases check
    unpriced_purchases = db.query(models.Purchase).filter(models.Purchase.purchase_amount == None).count()
    priced_purchase_sum = db.query(
        func.coalesce(func.sum(models.Purchase.purchase_amount), Decimal("0.00"))
    ).scalar()

    # Total Bank Balance
    bank_balances = db.query(
        func.coalesce(func.sum(models.BankAccount.current_balance), Decimal("0.00"))
    ).scalar()

    # Unreconciled bank tx count
    unreconciled_count = (
        db.query(models.BankTransaction)
        .filter(models.BankTransaction.status != "RECONCILED")
        .count()
    )

    # Operating expenses
    op_expenses = pl["operating_expenses"]["total"]

    return {
        "kpis": {
            # 1. Total Sales
            "total_sales": total_sales,
            # 2. Customer Receivables
            "customer_receivables": total_receivable,
            # 3. Customer Receipts
            "customer_receipts": total_received,
            # 4. Purchase Cost
            "purchase_cost_known": float(priced_purchase_sum),
            "purchase_cost_status": "PENDING (63 Afghan POs Awaiting Rates)" if unpriced_purchases > 0 else "CONFIRMED",
            # 5. Supplier Payables
            "supplier_payables": float(priced_purchase_sum),
            "supplier_payables_status": "PENDING SUPPLIER INVOICE" if unpriced_purchases > 0 else "CONFIRMED",
            # 6. Transport Charges
            "transport_charges": tp["total_freight_charges"],
            # 7. Transport Payments
            "transport_payments": tp["total_payments"],
            # 8. Transport Credit / Payable
            "transport_opening_credit": tp["total_opening_credit"],
            "transport_net_position": tp["net_balance"],
            "carrier_credit_in_favor": tp["carrier_credit_in_our_favor"],
            "has_carrier_credit": tp["has_carrier_credit"],
            "transport_status": tp["status"],
            # 9. Other Expenses
            "other_expenses": op_expenses,
            # 10. Total Bank Balance
            "total_bank_balance": float(bank_balances),
            # 11. Net Cash Flow
            "money_in": cf["money_in"]["total_in"],
            "money_out": cf["money_out"]["total_out"],
            "net_cash_flow": cf["net_cash_flow"],
            # 12. Gross Profit
            "cogs_total": pl["cogs"]["total"],
            "gross_profit": pl["gross_profit"],
            # 13. Net Profit
            "net_profit": pl["net_profit"],
            "profit_margin_pct": pl["profit_margin_pct"],
            "profit_status": pl["profit_status"],
            # 14. Unreconciled Bank Transactions
            "unreconciled_transactions_count": unreconciled_count,
            # 15. Pending Purchase Costs
            "pending_purchase_costs_count": unpriced_purchases,
            # Controls & Integrity
            "unallocated_customer_advances": float(unallocated_advances),
            "trial_balance_status": tb["status"],
            "trial_balance_balanced": tb["is_balanced"],
            "total_assets": bs["total_assets"],
            "total_liabilities_and_equity": bs["total_liabilities_and_equity"],
            "balance_sheet_balanced": bs["is_balanced"],
        },
        "financial_health": {
            "receivable_outstanding": total_receivable,
            "payable_outstanding": float(priced_purchase_sum),
            "cash_bank_position": float(bank_balances),
            "carrier_credit_in_favor": tp["carrier_credit_in_our_favor"],
            "pending_purchase_costs": unpriced_purchases,
            "unreconciled_transactions": unreconciled_count,
            "unposted_draft_transactions": db.query(models.JournalEntry).filter(models.JournalEntry.status == "DRAFT").count(),
            "open_accounting_conflicts": 0 if consistency["all_consistent"] else 1,
            "consistency_status": consistency["status"],
        },
        "aging_summary": aging["summary"],
        "transport_position": tp,
        "cash_flow": cf,
        "work_queue": work_queue,
        "consistency": consistency,
        "daily_summary": daily,
    }


# =====================================================================
# 1.1 BALANCE SHEET ENDPOINT
# =====================================================================

@router.get("/balance-sheet")
def get_balance_sheet(
    as_of_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """Returns official double-entry Balance Sheet (Assets = Liabilities + Equity)."""
    return compute_balance_sheet(db, as_of_date)


# =====================================================================
# 1.2 CONSISTENCY VERIFICATION ENDPOINT
# =====================================================================

@router.get("/consistency")
def get_accounting_consistency(db: Session = Depends(get_db)):
    """Verifies Subledger balances against General Ledger Control Accounts."""
    return verify_accounting_consistency(db)


# =====================================================================
# 1.3 ACCOUNTING WORK QUEUE ENDPOINT
# =====================================================================

@router.get("/work-queue")
def get_work_queue_endpoint(db: Session = Depends(get_db)):
    """Returns current actionable accounting work queue items."""
    return get_accounting_work_queue(db)


# =====================================================================
# 1.4 DAILY ACCOUNTING SUMMARY ENDPOINT
# =====================================================================

@router.get("/daily-summary")
def get_daily_summary_endpoint(
    target_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """Returns business transaction summary for a specific calendar date."""
    return get_daily_summary(db, target_date)


# =====================================================================
# 1.5 GLOBAL FINANCIAL SEARCH ENDPOINT
# =====================================================================

@router.get("/search")
def financial_search_endpoint(
    q: str = Query(..., min_length=1, description="Search term for financial records"),
    limit: int = 10,
    db: Session = Depends(get_db),
):
    """Global search across invoices, transactions, journals, parties, and transport."""
    return search_financial_records(db, q, limit)


# =====================================================================
# 1.6 TRANSACTION DETAIL DRAWER ENDPOINT
# =====================================================================

@router.get("/transaction-detail/{tx_id}")
def get_transaction_detail(tx_id: int, db: Session = Depends(get_db)):
    """
    Returns complete transaction details for side drawer:
    metadata, multi-currency values, double-entry journal lines, allocations, and audit history.
    """
    tx = db.query(models.BankTransaction).filter(models.BankTransaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Bank transaction not found.")

    # Find linked Journal Entry
    je = (
        db.query(models.JournalEntry)
        .filter(
            models.JournalEntry.source_document_type == "BANK_TRANSACTION",
            models.JournalEntry.source_document_id == tx.id,
        )
        .first()
    )

    accounting_lines = []
    if je:
        for l in sorted(je.lines, key=lambda x: x.line_number):
            accounting_lines.append({
                "account_code": l.account_code,
                "account_name": l.account_name,
                "debit": float(l.debit),
                "credit": float(l.credit),
                "party_name": l.party_name,
                "description": l.description,
            })

    # Allocations
    allocations = (
        db.query(models.PaymentAllocation)
        .filter(models.PaymentAllocation.bank_transaction_id == tx.id)
        .all()
    )
    alloc_list = [
        {
            "id": a.id,
            "invoice_number": a.invoice.invoice_number if a.invoice else "N/A (Advance)",
            "allocated_amount_usd": float(a.allocated_amount_usd),
            "allocation_type": a.allocation_type,
            "notes": a.notes,
        }
        for a in allocations
    ]

    # Audit history
    audits = (
        db.query(models.AuditLog)
        .filter(
            models.AuditLog.entity_type == "BankTransaction",
            models.AuditLog.entity_id == tx.id,
        )
        .order_by(models.AuditLog.timestamp.desc())
        .all()
    )
    audit_list = [
        {
            "action": a.action,
            "user_name": a.user_name,
            "timestamp": a.timestamp.isoformat() if a.timestamp else None,
            "detail": a.new_value_json,
        }
        for a in audits
    ]

    return {
        "transaction": {
            "id": tx.id,
            "code": tx.transaction_code,
            "date": str(tx.date),
            "document_date": str(tx.document_date) if tx.document_date else str(tx.date),
            "posting_date": str(tx.posting_date) if tx.posting_date else str(tx.date),
            "due_date": str(tx.due_date) if tx.due_date else None,
            "bank_account_id": tx.bank_account_id,
            "bank_name": tx.bank_name,
            "account_number": tx.account_number,
            "party_type": tx.party_type,
            "party_id": tx.party_id,
            "party_name": tx.party_name,
            "transaction_type": tx.transaction_type,
            "currency": tx.currency,
            "money_in": float(tx.money_in or 0),
            "money_out": float(tx.money_out or 0),
            "exchange_rate": float(tx.exchange_rate or 1.0),
            "usd_equivalent_in": float(tx.usd_equivalent_in or tx.money_in or 0),
            "usd_equivalent_out": float(tx.usd_equivalent_out or tx.money_out or 0),
            "transaction_reference": tx.transaction_reference,
            "bank_reference": tx.bank_reference,
            "swift_reference": tx.swift_reference,
            "mt103_reference": tx.mt103_reference,
            "sarafi_reference": tx.sarafi_reference,
            "cheque_number": tx.cheque_number,
            "payment_method": tx.payment_method,
            "status": tx.status,
            "approval_status": tx.approval_status,
            "is_reversed": bool(tx.is_reversed),
            "reversal_of_id": tx.reversal_of_id,
            "reversed_by_id": tx.reversed_by_id,
            "reversal_reason": tx.reversal_reason,
            "notes": tx.notes,
            "created_by": tx.created_by,
        },
        "journal_entry": {
            "entry_number": je.entry_number if je else None,
            "total_debit": float(je.total_debit) if je else 0.0,
            "total_credit": float(je.total_credit) if je else 0.0,
            "status": je.status if je else None,
            "lines": accounting_lines,
        } if je else None,
        "payment_allocations": alloc_list,
        "audit_trail": audit_list,
    }


# =====================================================================
# 1.7 RECEIVABLES CENTER SUMMARY ENDPOINT
# =====================================================================

@router.get("/receivables/summary")
def get_receivables_center_summary(db: Session = Depends(get_db)):
    """
    Aggregated Customer Receivables summary:
    - Total Invoiced ($4,386,655.66)
    - Total Received ($0.00)
    - Total Outstanding ($4,386,655.66)
    - Overdue Amount
    - Unallocated Customer Advances
    - Per-customer drill-down table with aging
    """
    inv_totals = db.query(
        func.coalesce(func.sum(models.Invoice.total_amount), Decimal("0.00")),
        func.coalesce(func.sum(models.Invoice.amount_received), Decimal("0.00")),
        func.coalesce(func.sum(models.Invoice.balance_due), Decimal("0.00")),
    ).first()

    unallocated_adv = (
        db.query(func.coalesce(func.sum(models.PaymentAllocation.allocated_amount_usd), Decimal("0.00")))
        .filter(models.PaymentAllocation.allocation_type == "ADVANCE")
        .scalar()
    )

    customers = db.query(models.Customer).order_by(models.Customer.customer_name.asc()).all()
    today = date.today()

    cust_rows = []
    for c in customers:
        invoices = db.query(models.Invoice).filter(models.Invoice.customer_id == c.id).all()
        if not invoices:
            continue
        c_inv_total = sum(Decimal(str(i.total_amount or 0)) for i in invoices)
        c_rec_total = sum(Decimal(str(i.amount_received or 0)) for i in invoices)
        c_bal_total = sum(Decimal(str(i.balance_due or 0)) for i in invoices)

        oldest_due = None
        oldest_days = 0
        for i in invoices:
            bal_val = Decimal(str(i.balance_due or 0))
            if bal_val > 0 and i.date:
                days = (today - i.date).days
                if days > oldest_days:
                    oldest_days = days
                    oldest_due = str(i.date)

        status = "CURRENT"
        if oldest_days > 90:
            status = "CRITICAL_OVERDUE"
        elif oldest_days > 60:
            status = "OVERDUE_60+"
        elif oldest_days > 30:
            status = "OVERDUE_30+"

        cust_rows.append({
            "customer_id": c.id,
            "customer_name": c.customer_name,
            "invoices_count": len(invoices),
            "total_sales": float(c_inv_total),
            "total_received": float(c_rec_total),
            "total_outstanding": float(c_bal_total),
            "oldest_invoice_date": oldest_due,
            "oldest_days_aged": oldest_days,
            "status": status,
            "contact_person": c.contact_person,
            "phone": c.phone,
        })

    # Sort by outstanding desc
    cust_rows.sort(key=lambda x: x["total_outstanding"], reverse=True)

    return {
        "summary": {
            "total_invoiced": float(inv_totals[0]),
            "total_received": float(inv_totals[1]),
            "total_outstanding": float(inv_totals[2]),
            "unallocated_advances": float(unallocated_adv),
            "active_customers_count": len(cust_rows),
        },
        "customers": cust_rows,
    }


# =====================================================================
# 1.8 PAYABLES CENTER SUMMARY ENDPOINT
# =====================================================================

@router.get("/payables/summary")
def get_payables_center_summary(db: Session = Depends(get_db)):
    """
    Accounts Payable Center:
    - Supplier Payables (with PENDING BILLS warning for Afghan POs)
    - Transport Payables / Carrier Credit Position (+$291,160.00 in our favor)
    - Other Operating Payables
    """
    suppliers = db.query(models.Supplier).order_by(models.Supplier.supplier_name.asc()).all()
    tp_pos = compute_transport_position(db)

    supp_rows = []
    total_known_purchase = Decimal("0.00")
    total_known_paid = Decimal("0.00")
    total_known_payable = Decimal("0.00")
    total_pending_pos = 0

    for s in suppliers:
        pos = db.query(models.Purchase).filter(models.Purchase.supplier_id == s.id).all()
        s_known_amt = Decimal("0.00")
        s_paid = Decimal("0.00")
        s_bal = Decimal("0.00")
        s_pending = 0

        for p in pos:
            if p.purchase_amount is None:
                s_pending += 1
            else:
                amt = Decimal(str(p.purchase_amount or 0))
                paid = Decimal(str(p.amount_paid or 0))
                bal = Decimal(str(p.balance or amt))
                s_known_amt += amt
                s_paid += paid
                s_bal += bal

        total_known_purchase += s_known_amt
        total_known_paid += s_paid
        total_known_payable += s_bal
        total_pending_pos += s_pending

        # Supplier advance check
        adv_allocated = (
            db.query(func.coalesce(func.sum(models.SupplierPayment.amount_usd), Decimal("0.00")))
            .filter(models.SupplierPayment.supplier_id == s.id)
            .scalar()
        )

        supp_rows.append({
            "supplier_id": s.id,
            "supplier_name": s.supplier_name,
            "known_purchase_amount": float(s_known_amt),
            "amount_paid": float(s_paid),
            "outstanding_payable": float(s_bal),
            "advances_held": float(adv_allocated),
            "pending_invoices_count": s_pending,
            "cost_status": "PURCHASE COST PENDING" if s_pending > 0 else "CONFIRMED",
            "country": s.country,
        })

    return {
        "summary": {
            "supplier_payables_known": float(total_known_payable),
            "supplier_pending_orders_count": total_pending_pos,
            "transport_position": {
                "opening_credit": tp_pos["total_opening_credit"],
                "freight_charges": tp_pos["total_freight_charges"],
                "transport_payments": tp_pos["total_payments"],
                "carrier_credit_in_our_favor": tp_pos["carrier_credit_in_our_favor"],
                "status": tp_pos["status"],
            },
            "other_payables": 0.0,
            "notice": "Unknown purchase costs must not generate arbitrary payables. Afghan purchases remain parked as 'PURCHASE COST PENDING'.",
        },
        "suppliers": supp_rows,
    }



# =====================================================================
# 2. CHART OF ACCOUNTS
# =====================================================================

@router.get("/accounts")
@router.get("/chart-of-accounts")
def list_accounts(db: Session = Depends(get_db)):
    """Returns Chart of Accounts grouped by category."""
    seed_chart_of_accounts(db)
    accounts = db.query(models.Account).order_by(models.Account.account_code.asc()).all()

    # Calculate current balance for each account from posted journal lines
    balances = (
        db.query(
            models.JournalLine.account_id,
            func.coalesce(func.sum(models.JournalLine.debit), Decimal("0.00")).label("sum_debit"),
            func.coalesce(func.sum(models.JournalLine.credit), Decimal("0.00")).label("sum_credit"),
        )
        .join(models.JournalEntry, models.JournalEntry.id == models.JournalLine.journal_entry_id)
        .filter(models.JournalEntry.status == "POSTED")
        .group_by(models.JournalLine.account_id)
        .all()
    )
    balance_map = {b.account_id: (b.sum_debit, b.sum_credit) for b in balances}

    result = []
    for acc in accounts:
        d, c = balance_map.get(acc.id, (Decimal("0.00"), Decimal("0.00")))
        if acc.account_type in ("ASSET", "COGS", "EXPENSE"):
            net = d - c
        else:
            net = c - d

        result.append({
            "id": acc.id,
            "account_code": acc.account_code,
            "account_name": acc.account_name,
            "account_type": acc.account_type,
            "sub_type": acc.sub_type,
            "description": acc.description,
            "is_active": acc.is_active,
            "is_system": acc.is_system,
            "currency": acc.currency,
            "total_debit": float(d),
            "total_credit": float(c),
            "current_balance": float(net),
        })
    return result


@router.post("/accounts", status_code=201)
def create_account(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Creates a new user-defined account in Chart of Accounts."""
    code = str(payload.get("account_code", "")).strip()
    name = str(payload.get("account_name", "")).strip()
    a_type = str(payload.get("account_type", "")).upper()

    if not code or not name or not a_type:
        raise HTTPException(status_code=400, detail="account_code, account_name, and account_type are required.")

    if a_type not in ("ASSET", "LIABILITY", "EQUITY", "REVENUE", "COGS", "EXPENSE"):
        raise HTTPException(status_code=400, detail=f"Invalid account_type '{a_type}'.")

    existing = db.query(models.Account).filter(models.Account.account_code == code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Account code '{code}' already exists.")

    acc = models.Account(
        account_code=code,
        account_name=name,
        account_type=a_type,
        sub_type=payload.get("sub_type"),
        description=payload.get("description"),
        is_active=payload.get("is_active", True),
        is_system=False,
        currency=payload.get("currency", "USD"),
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return acc


@router.put("/accounts/{account_id}")
def update_account(account_id: int, payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Updates account code, name, description, active status."""
    acc = db.query(models.Account).filter(models.Account.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found.")

    new_code = payload.get("account_code")
    if new_code and new_code != acc.account_code:
        conflict = db.query(models.Account).filter(models.Account.account_code == new_code).first()
        if conflict:
            raise HTTPException(status_code=400, detail=f"Account code '{new_code}' is already taken.")
        acc.account_code = str(new_code).strip()

    if "account_name" in payload:
        acc.account_name = str(payload["account_name"]).strip()
    if "sub_type" in payload:
        acc.sub_type = payload["sub_type"]
    if "description" in payload:
        acc.description = payload["description"]
    if "is_active" in payload:
        acc.is_active = bool(payload["is_active"])

    db.commit()
    db.refresh(acc)
    return acc


# =====================================================================
# 3. GENERAL LEDGER
# =====================================================================

@router.get("/general-ledger")
def get_general_ledger(
    account_code: Optional[str] = None,
    party_type: Optional[str] = None,
    party_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = 200,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """
    Query individual debit and credit entries with running balances and audit details.
    """
    query = (
        db.query(models.JournalLine)
        .join(models.JournalEntry, models.JournalEntry.id == models.JournalLine.journal_entry_id)
        .filter(models.JournalEntry.status == "POSTED")
    )

    if account_code:
        query = query.filter(models.JournalLine.account_code == account_code)
    if party_type:
        query = query.filter(models.JournalLine.party_type == party_type)
    if party_id:
        query = query.filter(models.JournalLine.party_id == party_id)
    if start_date:
        query = query.filter(models.JournalEntry.entry_date >= start_date)
    if end_date:
        query = query.filter(models.JournalEntry.entry_date <= end_date)

    total_count = query.count()
    lines = (
        query.order_by(models.JournalEntry.entry_date.asc(), models.JournalLine.id.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    result = []
    running_balance = Decimal("0.00")

    for l in lines:
        d = round_money(l.debit)
        c = round_money(l.credit)
        running_balance += (d - c)

        result.append({
            "id": l.id,
            "entry_number": l.journal_entry.entry_number,
            "date": str(l.journal_entry.entry_date),
            "entry_type": l.journal_entry.entry_type,
            "account_code": l.account_code,
            "account_name": l.account_name,
            "party_type": l.party_type,
            "party_name": l.party_name,
            "debit": float(d),
            "credit": float(c),
            "currency": l.currency,
            "amount_currency": float(l.amount_currency),
            "exchange_rate": float(l.exchange_rate),
            "running_balance": float(running_balance),
            "invoice_ref": l.invoice_ref,
            "shipment_ref": l.shipment_ref,
            "bank_ref": l.bank_ref,
            "description": l.description or l.journal_entry.description,
            "created_by": l.journal_entry.created_by,
            "created_at": l.journal_entry.created_at.isoformat() if l.journal_entry.created_at else None,
        })

    return {
        "total_records": total_count,
        "offset": offset,
        "limit": limit,
        "entries": result,
    }


# =====================================================================
# 4. JOURNAL ENTRIES
# =====================================================================

@router.get("/journals")
def list_journals(
    entry_type: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """List Journal Entries with line summaries."""
    query = db.query(models.JournalEntry)
    if entry_type:
        query = query.filter(models.JournalEntry.entry_type == entry_type)
    if status:
        query = query.filter(models.JournalEntry.status == status)
    if start_date:
        query = query.filter(models.JournalEntry.entry_date >= start_date)
    if end_date:
        query = query.filter(models.JournalEntry.entry_date <= end_date)

    total = query.count()
    jes = query.order_by(models.JournalEntry.entry_date.desc(), models.JournalEntry.id.desc()).offset(offset).limit(limit).all()

    items = []
    for j in jes:
        items.append({
            "id": j.id,
            "entry_number": j.entry_number,
            "entry_date": str(j.entry_date),
            "entry_type": j.entry_type,
            "description": j.description,
            "reference": j.reference,
            "source_document_type": j.source_document_type,
            "source_document_id": j.source_document_id,
            "total_debit": float(j.total_debit),
            "total_credit": float(j.total_credit),
            "status": j.status,
            "lines_count": len(j.lines),
            "created_by": j.created_by,
            "created_at": j.created_at.isoformat() if j.created_at else None,
        })

    return {"total": total, "entries": items}


@router.get("/journals/{journal_id}")
def get_journal_detail(journal_id: int, db: Session = Depends(get_db)):
    """Returns single journal entry with all line items."""
    je = db.query(models.JournalEntry).filter(models.JournalEntry.id == journal_id).first()
    if not je:
        raise HTTPException(status_code=404, detail="Journal entry not found.")

    lines = []
    for l in sorted(je.lines, key=lambda x: x.line_number):
        lines.append({
            "line_number": l.line_number,
            "account_code": l.account_code,
            "account_name": l.account_name,
            "party_type": l.party_type,
            "party_name": l.party_name,
            "debit": float(l.debit),
            "credit": float(l.credit),
            "currency": l.currency,
            "amount_currency": float(l.amount_currency),
            "exchange_rate": float(l.exchange_rate),
            "invoice_ref": l.invoice_ref,
            "shipment_ref": l.shipment_ref,
            "bank_ref": l.bank_ref,
            "description": l.description,
        })

    return {
        "id": je.id,
        "entry_number": je.entry_number,
        "entry_date": str(je.entry_date),
        "entry_type": je.entry_type,
        "description": je.description,
        "reference": je.reference,
        "total_debit": float(je.total_debit),
        "total_credit": float(je.total_credit),
        "status": je.status,
        "reversed_entry_id": je.reversed_entry_id,
        "reversal_reason": je.reversal_reason,
        "created_by": je.created_by,
        "created_at": je.created_at.isoformat() if je.created_at else None,
        "lines": lines,
    }


@router.post("/journals", status_code=201)
def create_manual_journal(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Creates and posts a balanced manual journal entry.
    Enforces SUM(Debit) == SUM(Credit) > 0.
    """
    try:
        e_date = datetime.strptime(payload.get("entry_date", str(date.today())), "%Y-%m-%d").date()
    except Exception:
        e_date = date.today()

    desc = payload.get("description", "Manual Journal Entry")
    ref = payload.get("reference")
    raw_lines = payload.get("lines", [])

    if not raw_lines or len(raw_lines) < 2:
        raise HTTPException(
            status_code=400,
            detail="Journal entry must contain at least 2 lines (at least one Debit and one Credit).",
        )

    try:
        je = create_journal_entry(
            db=db,
            entry_date=e_date,
            entry_type="MANUAL",
            description=desc,
            reference=ref,
            lines=raw_lines,
            created_by=payload.get("created_by", "Admin"),
        )
        return {
            "status": "SUCCESS",
            "journal_id": je.id,
            "entry_number": je.entry_number,
            "total_debit": float(je.total_debit),
            "total_credit": float(je.total_credit),
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.post("/journals/{journal_id}/reverse")
def reverse_journal(
    journal_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """Reverses a posted journal entry, creating balanced offset lines."""
    reason = payload.get("reason", "User requested reversal")
    user_name = payload.get("user_name", "Admin")

    try:
        rev_je = reverse_journal_entry(db, journal_id, reason, user_name)
        return {
            "status": "SUCCESS",
            "message": f"Journal Entry reversed successfully by {rev_je.entry_number}",
            "reversal_journal_id": rev_je.id,
            "reversal_entry_number": rev_je.entry_number,
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


# =====================================================================
# 5. TRIAL BALANCE REPORT
# =====================================================================

@router.get("/trial-balance")
def get_trial_balance(
    as_of_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """Returns double-entry Trial Balance with Debit = Credit verification."""
    return compute_trial_balance(db, as_of_date)


# =====================================================================
# 6. PROFIT & LOSS STATEMENT
# =====================================================================

@router.get("/profit-and-loss")
def get_profit_and_loss(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """Returns official Profit & Loss with null-safe Afghan purchase cost protection."""
    return compute_profit_and_loss(db, start_date, end_date)


# =====================================================================
# 7. CASH FLOW STATEMENT
# =====================================================================

@router.get("/cash-flow")
def get_cash_flow(
    period_type: str = Query("monthly", pattern="^(daily|weekly|monthly|yearly)$"),
    as_of_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """Returns Cash Flow statement (Money In, Money Out, Opening & Closing Cash)."""
    return compute_cash_flow(db, period_type, as_of_date)


# =====================================================================
# 8. CUSTOMER RECEIVABLES & AGING
# =====================================================================

@router.get("/receivables")
def list_receivables(
    customer_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List customer invoices with outstanding balance, days aged, and payment status."""
    query = db.query(models.Invoice).order_by(models.Invoice.date.asc())
    if customer_id:
        query = query.filter(models.Invoice.customer_id == customer_id)
    if status and status != "ALL":
        query = query.filter(models.Invoice.payment_status == status)

    invoices = query.all()
    today = date.today()

    rows = []
    for inv in invoices:
        days = (today - inv.date).days if inv.date else 0
        rows.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "date": str(inv.date),
            "customer_id": inv.customer_id,
            "customer_name": inv.customer.customer_name if inv.customer else "Unknown",
            "total_amount": float(inv.total_amount or 0),
            "amount_received": float(inv.amount_received or 0),
            "balance_due": float(inv.balance_due or 0),
            "days_outstanding": days,
            "payment_status": inv.payment_status,
            "payment_terms": inv.payment_terms,
            "shipment_id": inv.shipment_id,
        })
    return rows


@router.get("/receivables/aging")
def get_receivables_aging(
    as_of_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """Returns Customer Aging report (0-30, 31-60, 61-90, 90+ days)."""
    return compute_receivables_aging(db, as_of_date)


# =====================================================================
# 9. PAYMENT ALLOCATION
# =====================================================================

@router.post("/payments/allocate")
def allocate_payment(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Allocates a customer bank receipt across one or more invoices.
    Recalculates balances and updates invoice statuses (UNPAID, PARTIALLY PAID, PAID).
    """
    bank_tx_id = payload.get("bank_transaction_id")
    customer_id = payload.get("customer_id")
    allocations = payload.get("allocations", [])
    user_name = payload.get("user_name", "Admin")

    if not bank_tx_id or not customer_id or not allocations:
        raise HTTPException(
            status_code=400,
            detail="bank_transaction_id, customer_id, and allocations array are required.",
        )

    try:
        res = allocate_customer_payment(
            db=db,
            bank_tx_id=int(bank_tx_id),
            customer_id=int(customer_id),
            allocations=allocations,
            user_name=user_name,
        )
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


# =====================================================================
# 10. SUPPLIER PAYABLES
# =====================================================================

@router.get("/payables/suppliers")
def get_supplier_payables(db: Session = Depends(get_db)):
    """
    Returns supplier payables list.
    Safely renders 'PENDING SUPPLIER INVOICE' for Afghan origin purchases with missing cost.
    """
    purchases = db.query(models.Purchase).order_by(models.Purchase.date.desc()).all()

    items = []
    total_confirmed_payable = Decimal("0.00")
    pending_count = 0

    for p in purchases:
        supp_name = p.supplier.supplier_name if p.supplier else "Afghan Dry Fruit Supplier"
        if p.purchase_amount is None:
            pending_count += 1
            cost_display = "PENDING SUPPLIER INVOICE"
            amt = None
            bal = None
        else:
            amt = float(p.purchase_amount)
            paid = float(p.amount_paid or 0)
            bal = float(p.balance or amt)
            cost_display = f"${amt:,.2f}"
            total_confirmed_payable += Decimal(str(bal))

        items.append({
            "id": p.id,
            "purchase_code": p.purchase_code,
            "date": str(p.date),
            "supplier_id": p.supplier_id,
            "supplier_name": supp_name,
            "product_name": p.product_name,
            "packages": p.packages,
            "net_kg": float(p.net_kg or 0),
            "purchase_amount": amt,
            "amount_paid": float(p.amount_paid or 0),
            "balance": bal,
            "cost_display": cost_display,
            "status": "PENDING INVOICE" if p.purchase_amount is None else p.status,
            "shipment_invoice": p.shipment_invoice,
        })

    return {
        "summary": {
            "total_purchases_count": len(purchases),
            "pending_invoices_count": pending_count,
            "confirmed_payable_usd": float(total_confirmed_payable),
            "notice": "Afghan origin purchase costs remain PENDING until supplier invoices are verified.",
        },
        "purchases": items,
    }


# =====================================================================
# 11. TRANSPORT POSITION & STATEMENT
# =====================================================================

@router.get("/transport-statement")
@router.get("/transport/account")
def get_transport_statement(
    transport_company_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    Official Transport Company Accounting Statement:
    Charges: $743,650
    Payments: $1,030,000
    Opening Credit: $4,810
    Closing Position: -$291,160 (AQ COMPANIES HAS CREDIT WITH CARRIER)
    """
    tp = compute_transport_position(db, transport_company_id)

    # Detailed chronological ledger
    charges = (
        db.query(models.TransportCharge)
        .order_by(models.TransportCharge.date.asc(), models.TransportCharge.id.asc())
        .all()
    )
    payments = (
        db.query(models.TransportPayment)
        .order_by(models.TransportPayment.date.asc(), models.TransportPayment.id.asc())
        .all()
    )

    combined = []
    for c in charges:
        combined.append({
            "date": str(c.date),
            "type": c.entry_type,
            "reference": c.invoice_no or f"TC-{c.id}",
            "description": c.description,
            "debit": float(c.debit_usd),
            "credit": float(c.credit_usd),
            "container_no": c.container_no,
            "truck_no": c.truck_no,
            "bl_no": c.bl_no,
        })

    for p in payments:
        combined.append({
            "date": str(p.date),
            "type": "PAYMENT",
            "reference": f"WIRE-{p.id}",
            "description": f"Payment to carrier via {p.payment_method}",
            "debit": 0.0,
            "credit": float(p.amount_usd),
            "container_no": None,
            "truck_no": None,
            "bl_no": None,
        })

    # Sort combined by date
    combined.sort(key=lambda x: x["date"])

    running = Decimal("0.00")
    for row in combined:
        running += Decimal(str(row["debit"])) - Decimal(str(row["credit"]))
        row["running_balance"] = float(running)

    return {
        "position": tp,
        "ledger_lines": combined,
    }


# =====================================================================
# 12. BANK MASTER & MULTI-CURRENCY BANKING ENGINE
# =====================================================================

DEFAULT_BANK_ACCOUNTS = [
    {
        "bank_name": "AQ Central Wire Settlement Account",
        "account_name": "AQ COMPANIES CENTRAL",
        "account_number": "AQ-WIRE-USD-01",
        "account_type": "BANK",
        "currency": "USD",
        "opening_balance": 0.0,
        "opening_balance_date": "2026-01-01",
        "swift": "EBILAEADXXX",
        "iban": "AE440260000123456789010",
        "branch": "Dubai / Kabul Settlement Hub",
        "status": "ACTIVE",
        "notes": "Main wire transfer and settlement clearing account",
    },
    {
        "bank_name": "Afghan United Bank (AUB) - USD",
        "account_name": "AQ COMPANIES",
        "account_number": "AUB-USD-00129482",
        "account_type": "BANK",
        "currency": "USD",
        "opening_balance": 0.0,
        "opening_balance_date": "2026-01-01",
        "swift": "AFUNAFK1XXX",
        "iban": "AF38AFUN00000000129482",
        "branch": "Shahre Naw, Kabul",
        "status": "ACTIVE",
        "notes": "USD corporate commercial account for international and domestic wires",
    },
    {
        "bank_name": "Afghan United Bank (AUB) - AFN",
        "account_name": "AQ COMPANIES",
        "account_number": "AUB-AFN-00129483",
        "account_type": "BANK",
        "currency": "AFN",
        "opening_balance": 0.0,
        "opening_balance_date": "2026-01-01",
        "swift": "AFUNAFK1XXX",
        "iban": "AF38AFUN00000000129483",
        "branch": "Shahre Naw, Kabul",
        "status": "ACTIVE",
        "notes": "AFN operating account for local vendor & payroll disbursements",
    },
    {
        "bank_name": "Cash Vault - USD",
        "account_name": "AQ COMPANIES CASH VAULT",
        "account_number": "CASH-VAULT-USD",
        "account_type": "CASH",
        "currency": "USD",
        "opening_balance": 0.0,
        "opening_balance_date": "2026-01-01",
        "swift": "N/A",
        "iban": "N/A",
        "branch": "Main Office Safe, Kabul",
        "status": "ACTIVE",
        "notes": "Physical cash vault on premise in USD",
    },
    {
        "bank_name": "Cash Vault - AFN",
        "account_name": "AQ COMPANIES CASH VAULT AFN",
        "account_number": "CASH-VAULT-AFN",
        "account_type": "CASH",
        "currency": "AFN",
        "opening_balance": 0.0,
        "opening_balance_date": "2026-01-01",
        "swift": "N/A",
        "iban": "N/A",
        "branch": "Main Office Safe, Kabul",
        "status": "ACTIVE",
        "notes": "Physical cash vault on premise in Afghan Afghanis",
    },
    {
        "bank_name": "Omid Ehsan Sarafi - Trade Desk",
        "account_name": "AQ COMPANIES (OMID EHSAN)",
        "account_number": "SAR-OMID-EHSAN-01",
        "account_type": "SARAFI",
        "currency": "AFN",
        "opening_balance": 0.0,
        "opening_balance_date": "2026-01-01",
        "swift": "N/A",
        "iban": "N/A",
        "branch": "Shahzada Money Market, Kabul",
        "status": "ACTIVE",
        "notes": "Sarafi broker trade balance for quick money transfers & dry fruit procurement",
    },
    {
        "bank_name": "Emirates NBD Dubai - Trade Account",
        "account_name": "AQ COMPANIES LLC",
        "account_number": "AE440260000123456789012",
        "account_type": "BANK",
        "currency": "AED",
        "opening_balance": 0.0,
        "opening_balance_date": "2026-01-01",
        "swift": "EBILAEADXXX",
        "iban": "AE440260000123456789012",
        "branch": "Deira Branch, Dubai",
        "status": "ACTIVE",
        "notes": "UAE Dirham corporate trading account",
    },
    {
        "bank_name": "HDFC Trade & INR Settlement Account",
        "account_name": "AQ COMPANIES (INDIA DESK)",
        "account_number": "50200012345678",
        "account_type": "BANK",
        "currency": "INR",
        "opening_balance": 0.0,
        "opening_balance_date": "2026-01-01",
        "swift": "HDFCINBBXXX",
        "iban": "IN50200012345678",
        "branch": "Fort Branch, Mumbai",
        "status": "ACTIVE",
        "notes": "Indian Rupee trading account for export proceeds and direct port costs",
    },
]


def seed_standard_bank_accounts(db: Session):
    """Ensures all standard bank, cash, and Sarafi accounts are provisioned."""
    for d in DEFAULT_BANK_ACCOUNTS:
        exists = db.query(models.BankAccount).filter(models.BankAccount.account_number == d["account_number"]).first()
        if not exists:
            op_d = datetime.strptime(d["opening_balance_date"], "%Y-%m-%d").date()
            b = models.BankAccount(
                bank_name=d["bank_name"],
                account_name=d["account_name"],
                account_number=d["account_number"],
                account_type=d.get("account_type", "BANK"),
                currency=d["currency"],
                opening_balance=Decimal(str(d["opening_balance"])),
                opening_balance_date=op_d,
                current_balance=Decimal(str(d["opening_balance"])),
                available_balance=Decimal(str(d["opening_balance"])),
                swift=d.get("swift"),
                iban=d.get("iban"),
                swift_iban=d.get("iban") or d.get("swift"),
                branch=d["branch"],
                status=d.get("status", "ACTIVE"),
                notes=d["notes"],
            )
            db.add(b)
    db.commit()


@router.get("/banks")
def list_bank_accounts(db: Session = Depends(get_db)):
    """Lists all Bank, Cash, and Sarafi accounts with authoritative running balance."""
    accounts = db.query(models.BankAccount).order_by(models.BankAccount.id.asc()).all()
    if len(accounts) < len(DEFAULT_BANK_ACCOUNTS):
        seed_standard_bank_accounts(db)
        accounts = db.query(models.BankAccount).order_by(models.BankAccount.id.asc()).all()

    results = []
    for a in accounts:
        # Check running balance
        running = recalculate_bank_running_balance(db, a.id)
        results.append({
            "id": a.id,
            "bank_name": a.bank_name,
            "account_name": a.account_name,
            "account_number": a.account_number,
            "account_type": a.account_type or "BANK",
            "currency": a.currency,
            "opening_balance": float(a.opening_balance or 0),
            "opening_balance_date": str(a.opening_balance_date) if a.opening_balance_date else None,
            "current_balance": float(running),
            "available_balance": float(running),
            "iban": a.iban or a.swift_iban,
            "swift": a.swift or a.swift_iban,
            "branch": a.branch,
            "status": a.status or "ACTIVE",
            "notes": a.notes,
        })
    return results


@router.post("/banks", status_code=201)
def create_bank_account(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Creates a new Bank, Cash Vault, or Sarafi account."""
    b_name = payload.get("bank_name")
    acc_num = payload.get("account_number")
    curr = payload.get("currency", "USD").upper()

    if not b_name or not acc_num:
        raise HTTPException(status_code=400, detail="bank_name and account_number are required.")

    if curr not in ("USD", "AFN", "AED", "INR"):
        raise HTTPException(status_code=400, detail="Currency must be one of USD, AFN, AED, INR.")

    existing = db.query(models.BankAccount).filter(models.BankAccount.account_number == acc_num).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Bank account with number '{acc_num}' already exists.")

    op_bal = round_money(payload.get("opening_balance", 0))
    op_date_str = payload.get("opening_balance_date")
    op_date = datetime.strptime(op_date_str, "%Y-%m-%d").date() if op_date_str else date.today()

    acc = models.BankAccount(
        bank_name=b_name,
        account_name=payload.get("account_name", "AQ COMPANIES"),
        account_number=acc_num,
        account_type=payload.get("account_type", "BANK").upper(),
        currency=curr,
        opening_balance=op_bal,
        opening_balance_date=op_date,
        current_balance=op_bal,
        available_balance=op_bal,
        iban=payload.get("iban"),
        swift=payload.get("swift"),
        swift_iban=payload.get("iban") or payload.get("swift"),
        branch=payload.get("branch"),
        status=payload.get("status", "ACTIVE").upper(),
        notes=payload.get("notes"),
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)

    audit = models.AuditLog(
        entity_type="BankAccount",
        entity_id=acc.id,
        action="CREATE",
        new_value_json=f'{{"bank_name": "{acc.bank_name}", "account_number": "{acc.account_number}", "currency": "{acc.currency}", "opening_balance": {float(op_bal)}}}',
        user_name=payload.get("user_name", "Admin"),
        timestamp=datetime.utcnow(),
    )
    db.add(audit)
    db.commit()

    return acc


@router.put("/banks/{bank_id}")
def update_bank_account(bank_id: int, payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Updates bank account master settings."""
    acc = db.query(models.BankAccount).filter(models.BankAccount.id == bank_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Bank account not found.")

    if "bank_name" in payload:
        acc.bank_name = payload["bank_name"]
    if "account_name" in payload:
        acc.account_name = payload["account_name"]
    if "account_type" in payload:
        acc.account_type = payload["account_type"].upper()
    if "iban" in payload:
        acc.iban = payload["iban"]
        acc.swift_iban = payload["iban"]
    if "swift" in payload:
        acc.swift = payload["swift"]
    if "branch" in payload:
        acc.branch = payload["branch"]
    if "status" in payload:
        acc.status = payload["status"].upper()
    if "notes" in payload:
        acc.notes = payload["notes"]

    db.commit()
    return acc


# =====================================================================
# 13. BANK TRANSACTIONS & UNIVERSAL LEDGER ENGINE
# =====================================================================

@router.get("/bank-transactions")
def list_bank_transactions(
    bank_account_id: Optional[int] = None,
    transaction_type: Optional[str] = None,
    status: Optional[str] = None,
    approval_status: Optional[str] = None,
    party_type: Optional[str] = None,
    party_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Universal Bank Ledger with authoritative running balances, multi-currency conversions,
    and audit tracking.
    """
    query = db.query(models.BankTransaction).order_by(
        models.BankTransaction.date.asc(),
        models.BankTransaction.created_at.asc(),
        models.BankTransaction.id.asc(),
    )

    if bank_account_id:
        query = query.filter(models.BankTransaction.bank_account_id == bank_account_id)
    if transaction_type and transaction_type != "ALL":
        query = query.filter(models.BankTransaction.transaction_type == transaction_type)
    if status and status != "ALL":
        query = query.filter(models.BankTransaction.status == status)
    if approval_status and approval_status != "ALL":
        query = query.filter(models.BankTransaction.approval_status == approval_status)
    if party_type and party_type != "ALL":
        query = query.filter(models.BankTransaction.party_type == party_type)
    if party_id:
        query = query.filter(models.BankTransaction.party_id == party_id)
    if start_date:
        query = query.filter(models.BankTransaction.date >= start_date)
    if end_date:
        query = query.filter(models.BankTransaction.date <= end_date)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                models.BankTransaction.transaction_code.ilike(search_filter),
                models.BankTransaction.party_name.ilike(search_filter),
                models.BankTransaction.transaction_reference.ilike(search_filter),
                models.BankTransaction.bank_reference.ilike(search_filter),
                models.BankTransaction.swift_reference.ilike(search_filter),
                models.BankTransaction.notes.ilike(search_filter),
            )
        )

    txs = query.all()
    rows = []
    running = Decimal("0.00")

    for t in txs:
        usd_in = round_money(t.usd_equivalent_in or t.money_in)
        usd_out = round_money(t.usd_equivalent_out or t.money_out)
        if t.status not in ("VOID", "DRAFT"):
            running += (usd_in - usd_out)

        rows.append({
            "id": t.id,
            "transaction_code": t.transaction_code,
            "date": str(t.date),
            "document_date": str(t.document_date) if t.document_date else str(t.date),
            "posting_date": str(t.posting_date) if t.posting_date else str(t.date),
            "due_date": str(t.due_date) if t.due_date else None,
            "bank_account_id": t.bank_account_id,
            "bank_name": t.bank_name,
            "account_number": t.account_number,
            "party_type": t.party_type,
            "party_id": t.party_id,
            "party_name": t.party_name,
            "transaction_type": t.transaction_type,
            "currency": t.currency,
            "money_in": float(t.money_in or 0),
            "money_out": float(t.money_out or 0),
            "exchange_rate": float(t.exchange_rate or 1.0),
            "usd_equivalent_in": float(usd_in),
            "usd_equivalent_out": float(usd_out),
            "running_balance": float(running),
            "transaction_reference": t.transaction_reference,
            "bank_reference": t.bank_reference,
            "swift_reference": t.swift_reference,
            "mt103_reference": t.mt103_reference,
            "sarafi_reference": t.sarafi_reference,
            "cheque_number": t.cheque_number,
            "payment_method": t.payment_method,
            "status": t.status,
            "approval_status": t.approval_status or "POSTED",
            "is_reversed": bool(t.is_reversed),
            "reversal_of_id": t.reversal_of_id,
            "reversed_by_id": t.reversed_by_id,
            "reversal_reason": t.reversal_reason,
            "notes": t.notes,
            "created_by": t.created_by,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        })
    return rows


@router.post("/bank-transactions", status_code=201)
def create_bank_transaction(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Creates a general bank transaction:
    CUSTOMER_RECEIPT, SUPPLIER_PAYMENT, TRANSPORT_PAYMENT, BANK_CHARGE, EXPENSE_PAYMENT, TRANSFER, OTHER.
    Validates period lock, updates running balance, and automatically posts balanced GL journal!
    """
    bank_id = payload.get("bank_account_id")
    b_acc = db.query(models.BankAccount).filter(models.BankAccount.id == bank_id).first()
    if not b_acc:
        raise HTTPException(status_code=400, detail="Invalid bank_account_id.")

    t_type = payload.get("transaction_type")
    if not t_type:
        raise HTTPException(status_code=400, detail="transaction_type is required.")

    curr = payload.get("currency", b_acc.currency).upper()
    fx_rate = Decimal(str(payload.get("exchange_rate", "1.0000")))
    m_in = round_money(payload.get("money_in", 0))
    m_out = round_money(payload.get("money_out", 0))

    if m_in == Decimal("0.00") and m_out == Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Either money_in or money_out must be greater than zero.")

    try:
        t_date = datetime.strptime(payload.get("date", str(date.today())), "%Y-%m-%d").date()
    except Exception:
        t_date = date.today()

    check_period_open(db, t_date)

    # Multi-currency conversion: 1 USD = fx_rate local currency
    if curr == "USD":
        usd_in = m_in
        usd_out = m_out
    else:
        usd_in = round_money(m_in / fx_rate) if fx_rate > Decimal("0.00") else Decimal("0.00")
        usd_out = round_money(m_out / fx_rate) if fx_rate > Decimal("0.00") else Decimal("0.00")

    # Transaction Sequence Code
    seq_tag = "BTX"
    if "CUSTOMER" in t_type:
        seq_tag = "CR"
    elif "SUPPLIER" in t_type:
        seq_tag = "SP"
    elif "TRANSPORT" in t_type:
        seq_tag = "TP"
    elif "CHARGE" in t_type:
        seq_tag = "BC"

    count = db.query(models.BankTransaction).filter(models.BankTransaction.transaction_code.like(f"{seq_tag}-{t_date.year}-%")).count()
    tx_code = f"{seq_tag}-{t_date.year}-{count + 1:06d}"

    tx = models.BankTransaction(
        transaction_code=tx_code,
        date=t_date,
        document_date=t_date,
        posting_date=t_date,
        bank_account_id=b_acc.id,
        bank_name=b_acc.bank_name,
        account_number=b_acc.account_number,
        party_type=payload.get("party_type", "OTHER"),
        party_id=payload.get("party_id"),
        party_name=payload.get("party_name", "General"),
        transaction_type=t_type,
        currency=curr,
        money_in=m_in,
        money_out=m_out,
        exchange_rate=fx_rate,
        usd_equivalent_in=usd_in,
        usd_equivalent_out=usd_out,
        transaction_reference=payload.get("transaction_reference"),
        bank_reference=payload.get("bank_reference"),
        swift_reference=payload.get("swift_reference"),
        mt103_reference=payload.get("mt103_reference"),
        sarafi_reference=payload.get("sarafi_reference"),
        cheque_number=payload.get("cheque_number"),
        payment_method=payload.get("payment_method", "Bank Wire"),
        status=payload.get("status", "CLEARED"),
        approval_status=payload.get("approval_status", "POSTED"),
        notes=payload.get("notes"),
        created_by=payload.get("created_by", "Admin"),
    )
    db.add(tx)
    db.flush()

    # Automatic Journal Entry creation
    if t_type == "BANK_CHARGE":
        post_bank_charge_journal(db, tx)
    elif t_type == "CUSTOMER_RECEIPT" and payload.get("party_id"):
        post_customer_payment_journal(db, tx, payload["party_id"])
    elif t_type == "SUPPLIER_PAYMENT" and payload.get("party_id"):
        post_supplier_payment_journal(db, tx, payload["party_id"])
    elif t_type == "TRANSPORT_PAYMENT" and payload.get("party_id"):
        tp = models.TransportPayment(
            date=t_date,
            bank_transaction_id=tx.id,
            transport_company_id=payload["party_id"],
            payment_method=tx.payment_method,
            amount_usd=usd_out,
            notes=tx.notes,
        )
        db.add(tp)
        db.flush()
        post_transport_payment_journal(db, tp)

    # Recalculate authoritative bank running balance
    new_bal = recalculate_bank_running_balance(db, b_acc.id)

    # Financial Audit Log
    audit = models.AuditLog(
        entity_type="BankTransaction",
        entity_id=tx.id,
        action="CREATE",
        new_value_json=f'{{"code": "{tx.transaction_code}", "type": "{t_type}", "usd_in": {float(usd_in)}, "usd_out": {float(usd_out)}}}',
        user_name=payload.get("created_by", "Admin"),
        timestamp=datetime.utcnow(),
    )
    db.add(audit)
    db.commit()
    db.refresh(tx)

    return {
        "status": "SUCCESS",
        "transaction_id": tx.id,
        "transaction_code": tx.transaction_code,
        "usd_equivalent_in": float(usd_in),
        "usd_equivalent_out": float(usd_out),
        "bank_new_balance": float(new_bal),
    }


@router.post("/bank-transactions/{tx_id}/reverse")
def reverse_transaction_endpoint(tx_id: int, payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Soft-reverses a posted bank transaction, creating offset ledger line and reversing GL entry."""
    reason = payload.get("reason")
    if not reason:
        raise HTTPException(status_code=400, detail="A valid reason is required for reversal.")

    user_name = payload.get("user_name", "Admin")
    try:
        rev_tx = reverse_bank_transaction(db, tx_id, reason, user_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "status": "SUCCESS",
        "original_transaction_id": tx_id,
        "reversal_transaction_id": rev_tx.id,
        "reversal_code": rev_tx.transaction_code,
        "message": f"Transaction #{tx_id} successfully reversed.",
    }


# =====================================================================
# 14. DEDICATED PAYMENT & RECEIPT WORKBENCHES
# =====================================================================

@router.post("/payments/customer-receipt", status_code=201)
def process_customer_receipt(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """
    CUSTOMER RECEIPT & PAYMENT ALLOCATION:
    - Supports allocation modes: 'OLDEST_FIRST' or 'MANUAL'.
    - Partial payments transition invoice UNPAID -> PARTIALLY PAID.
    - Full payments transition to PAID.
    - Unallocated receipt is strictly credited to 2150 Customer Advances (NEVER duplicate revenue).
    - Multi-currency conversion: 1 USD = exchange_rate local.
    - Posts balanced double-entry journal (CR-YYYY-XXXXXX).
    - Recalculates bank running balance.
    """
    cust_id = payload.get("customer_id")
    bank_id = payload.get("bank_account_id")
    raw_amt = payload.get("amount")

    if not cust_id or not bank_id or raw_amt is None:
        raise HTTPException(status_code=400, detail="customer_id, bank_account_id, and amount are required.")

    cust = db.query(models.Customer).filter(models.Customer.id == cust_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found.")

    b_acc = db.query(models.BankAccount).filter(models.BankAccount.id == bank_id).first()
    if not b_acc:
        raise HTTPException(status_code=404, detail="Bank account not found.")

    try:
        r_date = datetime.strptime(payload.get("date", str(date.today())), "%Y-%m-%d").date()
    except Exception:
        r_date = date.today()

    check_period_open(db, r_date)

    curr = (payload.get("currency") or b_acc.currency).upper()
    fx_rate = Decimal(str(payload.get("exchange_rate", "1.0000")))
    amount_orig = round_money(raw_amt)
    if amount_orig <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Receipt amount must be greater than zero.")

    # Calculate USD equivalent
    if curr == "USD":
        usd_amount = amount_orig
    else:
        usd_amount = round_money(amount_orig / fx_rate) if fx_rate > Decimal("0.00") else Decimal("0.00")

    # Prepare invoice allocation list
    alloc_mode = payload.get("allocation_mode", "OLDEST_FIRST").upper()
    manual_allocs = payload.get("manual_allocations") or []
    
    invoices_to_allocate: List[Dict[str, Any]] = []
    remaining_to_allocate = usd_amount

    if alloc_mode == "MANUAL" and manual_allocs:
        for m in manual_allocs:
            inv_id = m.get("invoice_id")
            alloc_usd = round_money(m.get("amount", 0))
            if alloc_usd <= Decimal("0.00"):
                continue
            inv = db.query(models.Invoice).filter(models.Invoice.id == inv_id, models.Invoice.customer_id == cust_id).first()
            if not inv:
                raise HTTPException(status_code=400, detail=f"Invoice #{inv_id} not found for this customer.")
            if alloc_usd > round_money(inv.balance_due):
                raise HTTPException(
                    status_code=400,
                    detail=f"Allocation ${alloc_usd:,.2f} exceeds balance due ${inv.balance_due:,.2f} of Invoice {inv.invoice_number}."
                )
            invoices_to_allocate.append({"invoice": inv, "amount": alloc_usd})
            remaining_to_allocate -= alloc_usd
    else:
        # OLDEST_FIRST: query invoices with outstanding balance
        open_invoices = (
            db.query(models.Invoice)
            .filter(models.Invoice.customer_id == cust_id, models.Invoice.balance_due > Decimal("0.00"))
            .order_by(models.Invoice.date.asc(), models.Invoice.id.asc())
            .all()
        )
        for inv in open_invoices:
            if remaining_to_allocate <= Decimal("0.00"):
                break
            due = round_money(inv.balance_due)
            alloc_usd = min(due, remaining_to_allocate)
            invoices_to_allocate.append({"invoice": inv, "amount": alloc_usd})
            remaining_to_allocate -= alloc_usd

    unallocated_advance = max(Decimal("0.00"), remaining_to_allocate)
    total_allocated_to_ar = usd_amount - unallocated_advance

    # 1. Create BankTransaction
    count = db.query(models.BankTransaction).filter(models.BankTransaction.transaction_code.like(f"CR-{r_date.year}-%")).count()
    tx_code = f"CR-{r_date.year}-{count + 1:06d}"

    bank_tx = models.BankTransaction(
        transaction_code=tx_code,
        date=r_date,
        document_date=r_date,
        posting_date=r_date,
        bank_account_id=b_acc.id,
        bank_name=b_acc.bank_name,
        account_number=b_acc.account_number,
        party_type="CUSTOMER",
        party_id=cust.id,
        party_name=cust.customer_name,
        transaction_type="CUSTOMER_RECEIPT",
        currency=curr,
        money_in=amount_orig,
        money_out=Decimal("0.00"),
        exchange_rate=fx_rate,
        usd_equivalent_in=usd_amount,
        usd_equivalent_out=Decimal("0.00"),
        transaction_reference=payload.get("reference") or payload.get("transaction_reference"),
        bank_reference=payload.get("bank_reference"),
        swift_reference=payload.get("swift_reference"),
        payment_method=payload.get("payment_method", "Bank Wire"),
        status="CLEARED",
        approval_status="POSTED",
        notes=payload.get("notes") or f"Customer receipt from {cust.customer_name}",
        created_by=payload.get("user_name", "Admin"),
    )
    db.add(bank_tx)
    db.flush()

    # 2. Update Invoices & Create PaymentAllocations
    allocations_detail = []
    for item in invoices_to_allocate:
        inv = item["invoice"]
        amt = item["amount"]
        new_rec = round_money(Decimal(str(inv.amount_received or 0)) + amt)
        new_due = round_money(Decimal(str(inv.total_amount or 0)) - new_rec)

        inv.amount_received = new_rec
        inv.balance_due = new_due
        if new_rec <= Decimal("0.00"):
            inv.payment_status = "UNPAID"
        elif new_rec < Decimal(str(inv.total_amount or 0)):
            inv.payment_status = "PARTIALLY PAID"
        else:
            inv.payment_status = "PAID"

        pa = models.PaymentAllocation(
            bank_transaction_id=bank_tx.id,
            customer_id=cust.id,
            invoice_id=inv.id,
            shipment_id=inv.shipment_id,
            allocated_amount_usd=amt,
            allocation_type="INVOICE_SETTLEMENT",
            notes=f"Receipt {bank_tx.transaction_code} applied to {inv.invoice_number}",
            created_at=datetime.utcnow(),
        )
        db.add(pa)
        allocations_detail.append({
            "invoice_id": inv.id,
            "invoice_number": inv.invoice_number,
            "allocated_usd": float(amt),
            "remaining_balance": float(new_due),
            "status": inv.payment_status,
        })

    # If unallocated advance exists, record allocation record
    if unallocated_advance > Decimal("0.00"):
        pa_adv = models.PaymentAllocation(
            bank_transaction_id=bank_tx.id,
            customer_id=cust.id,
            invoice_id=None,
            shipment_id=None,
            allocated_amount_usd=unallocated_advance,
            allocation_type="ADVANCE",
            notes=f"Unallocated advance credited to Account 2150",
            created_at=datetime.utcnow(),
        )
        db.add(pa_adv)

    # 3. Create CustomerPayment audit record
    cp = models.CustomerPayment(
        bank_transaction_id=bank_tx.id,
        customer_id=cust.id,
        invoice_id=invoices_to_allocate[0]["invoice"].id if invoices_to_allocate else None,
        amount_usd=usd_amount,
        payment_date=r_date,
        payment_method=bank_tx.payment_method,
        notes=bank_tx.notes,
    )
    db.add(cp)

    # 4. Post Balanced Double-Entry Journal Entry
    # Debit: 1000 Cash & Bank (Total USD)
    # Credit: 1100 Customer Receivables (Allocated to AR)
    # Credit: 2150 Customer Advances (Unallocated excess)
    je = post_customer_payment_journal(
        db=db,
        bank_tx=bank_tx,
        customer_id=cust.id,
        allocated_invoices=[{"amount": i["amount"]} for i in invoices_to_allocate],
    )

    # 5. Authoritative Bank Running Balance Recalculation
    new_bal = recalculate_bank_running_balance(db, b_acc.id)

    db.commit()
    db.refresh(bank_tx)

    return {
        "status": "SUCCESS",
        "receipt_id": bank_tx.id,
        "bank_transaction_id": bank_tx.id,
        "transaction_code": bank_tx.transaction_code,
        "journal_entry_number": je.entry_number if je else None,
        "total_receipt_usd": float(usd_amount),
        "allocated_to_invoices_usd": float(total_allocated_to_ar),
        "unallocated_advance_usd": float(unallocated_advance),
        "bank_new_balance": float(new_bal),
        "allocations": allocations_detail,
    }


@router.post("/payments/supplier-payment", status_code=201)
def process_supplier_payment(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """
    SUPPLIER PAYMENT & ADVANCE ENGINE:
    - Disburses wire to Afghan supplier from selected bank/cash/Sarafi account.
    - Allocates to purchases if provided.
    - Excess or unallocated payment is strictly credited to 1350 Supplier Advances (NEVER negative expense).
    - Multi-currency conversion: 1 USD = exchange_rate local.
    - Balanced GL Journal: Debit 2000 / 1350, Credit 1000.
    """
    supp_id = payload.get("supplier_id")
    bank_id = payload.get("bank_account_id")
    raw_amt = payload.get("amount")

    if not supp_id or not bank_id or raw_amt is None:
        raise HTTPException(status_code=400, detail="supplier_id, bank_account_id, and amount are required.")

    supp = db.query(models.Supplier).filter(models.Supplier.id == supp_id).first()
    if not supp:
        raise HTTPException(status_code=404, detail="Supplier not found.")

    b_acc = db.query(models.BankAccount).filter(models.BankAccount.id == bank_id).first()
    if not b_acc:
        raise HTTPException(status_code=404, detail="Bank account not found.")

    try:
        p_date = datetime.strptime(payload.get("date", str(date.today())), "%Y-%m-%d").date()
    except Exception:
        p_date = date.today()

    check_period_open(db, p_date)

    curr = (payload.get("currency") or b_acc.currency).upper()
    fx_rate = Decimal(str(payload.get("exchange_rate", "1.0000")))
    amount_orig = round_money(raw_amt)
    if amount_orig <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero.")

    if curr == "USD":
        usd_amount = amount_orig
    else:
        usd_amount = round_money(amount_orig / fx_rate) if fx_rate > Decimal("0.00") else Decimal("0.00")

    purchase_allocs = payload.get("purchase_allocations") or []
    allocated_sum = Decimal("0.00")
    for pa in purchase_allocs:
        allocated_sum += round_money(pa.get("amount", 0))

    if allocated_sum > usd_amount:
        allocated_sum = usd_amount
    advance_portion = usd_amount - allocated_sum

    count = db.query(models.BankTransaction).filter(models.BankTransaction.transaction_code.like(f"SP-{p_date.year}-%")).count()
    tx_code = f"SP-{p_date.year}-{count + 1:06d}"

    bank_tx = models.BankTransaction(
        transaction_code=tx_code,
        date=p_date,
        document_date=p_date,
        posting_date=p_date,
        bank_account_id=b_acc.id,
        bank_name=b_acc.bank_name,
        account_number=b_acc.account_number,
        party_type="SUPPLIER",
        party_id=supp.id,
        party_name=supp.supplier_name,
        transaction_type="SUPPLIER_PAYMENT",
        currency=curr,
        money_in=Decimal("0.00"),
        money_out=amount_orig,
        exchange_rate=fx_rate,
        usd_equivalent_in=Decimal("0.00"),
        usd_equivalent_out=usd_amount,
        transaction_reference=payload.get("reference") or payload.get("transaction_reference"),
        bank_reference=payload.get("bank_reference"),
        swift_reference=payload.get("swift_reference"),
        sarafi_reference=payload.get("sarafi_reference"),
        payment_method=payload.get("payment_method", "Bank Wire"),
        status="CLEARED",
        approval_status="POSTED",
        notes=payload.get("notes") or f"Disbursement to {supp.supplier_name}",
        created_by=payload.get("user_name", "Admin"),
    )
    db.add(bank_tx)
    db.flush()

    sp_rec = models.SupplierPayment(
        bank_transaction_id=bank_tx.id,
        supplier_id=supp.id,
        purchase_id=purchase_allocs[0].get("purchase_id") if purchase_allocs else None,
        amount_usd=usd_amount,
        payment_date=p_date,
        payment_method=bank_tx.payment_method,
        notes=bank_tx.notes,
    )
    db.add(sp_rec)

    je = post_supplier_payment_journal(db, bank_tx, supp.id, purchase_allocs)
    new_bal = recalculate_bank_running_balance(db, b_acc.id)

    db.commit()
    return {
        "status": "SUCCESS",
        "transaction_code": bank_tx.transaction_code,
        "journal_entry_number": je.entry_number if je else None,
        "total_disbursed_usd": float(usd_amount),
        "allocated_to_purchases_usd": float(allocated_sum),
        "supplier_advance_usd": float(advance_portion),
        "bank_new_balance": float(new_bal),
    }


@router.post("/payments/transport-payment", status_code=201)
def process_transport_payment(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """
    TRANSPORT PAYMENT & CARRIER CREDIT ENGINE:
    - Disburses freight payment to Sky Ariana or transport carrier.
    - Debit: 2100 Transport Payable, Credit: 1000 Cash & Bank.
    - Maintains and validates Carrier Credit in AQ Companies' favor ($291,160.00).
    - Recalculates bank running balance and updates transport position.
    """
    tc_id = payload.get("transport_company_id")
    bank_id = payload.get("bank_account_id")
    raw_amt = payload.get("amount")

    if not tc_id or not bank_id or raw_amt is None:
        raise HTTPException(status_code=400, detail="transport_company_id, bank_account_id, and amount are required.")

    t_co = db.query(models.TransportCompany).filter(models.TransportCompany.id == tc_id).first()
    if not t_co:
        raise HTTPException(status_code=404, detail="Transport company not found.")

    b_acc = db.query(models.BankAccount).filter(models.BankAccount.id == bank_id).first()
    if not b_acc:
        raise HTTPException(status_code=404, detail="Bank account not found.")

    try:
        t_date = datetime.strptime(payload.get("date", str(date.today())), "%Y-%m-%d").date()
    except Exception:
        t_date = date.today()

    check_period_open(db, t_date)

    curr = (payload.get("currency") or b_acc.currency).upper()
    fx_rate = Decimal(str(payload.get("exchange_rate", "1.0000")))
    amount_orig = round_money(raw_amt)
    if amount_orig <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero.")

    if curr == "USD":
        usd_amount = amount_orig
    else:
        usd_amount = round_money(amount_orig / fx_rate) if fx_rate > Decimal("0.00") else Decimal("0.00")

    count = db.query(models.BankTransaction).filter(models.BankTransaction.transaction_code.like(f"TP-{t_date.year}-%")).count()
    tx_code = f"TP-{t_date.year}-{count + 1:06d}"

    bank_tx = models.BankTransaction(
        transaction_code=tx_code,
        date=t_date,
        document_date=t_date,
        posting_date=t_date,
        bank_account_id=b_acc.id,
        bank_name=b_acc.bank_name,
        account_number=b_acc.account_number,
        party_type="TRANSPORT",
        party_id=t_co.id,
        party_name=t_co.company_name,
        transaction_type="TRANSPORT_PAYMENT",
        currency=curr,
        money_in=Decimal("0.00"),
        money_out=amount_orig,
        exchange_rate=fx_rate,
        usd_equivalent_in=Decimal("0.00"),
        usd_equivalent_out=usd_amount,
        transaction_reference=payload.get("reference") or payload.get("transaction_reference"),
        bank_reference=payload.get("bank_reference"),
        swift_reference=payload.get("swift_reference"),
        payment_method=payload.get("payment_method", "Bank Wire"),
        status="CLEARED",
        approval_status="POSTED",
        notes=payload.get("notes") or f"Freight payment to {t_co.company_name}",
        created_by=payload.get("user_name", "Admin"),
    )
    db.add(bank_tx)
    db.flush()

    tp_rec = models.TransportPayment(
        transport_company_id=t_co.id,
        bank_transaction_id=bank_tx.id,
        date=t_date,
        amount_usd=usd_amount,
        payment_method=bank_tx.payment_method,
        notes=bank_tx.notes,
    )
    db.add(tp_rec)
    db.flush()

    je = post_transport_payment_journal(db, tp_rec)
    new_bal = recalculate_bank_running_balance(db, b_acc.id)
    carrier_position = compute_transport_position(db, t_co.id)

    db.commit()
    return {
        "status": "SUCCESS",
        "transaction_code": bank_tx.transaction_code,
        "journal_entry_number": je.entry_number if je else None,
        "amount_usd": float(usd_amount),
        "bank_new_balance": float(new_bal),
        "carrier_position": carrier_position,
    }


@router.post("/payments/allocate-advance")
def allocate_advance_to_invoice(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Applies existing Customer Advance (Account 2150) against an unpaid sales invoice.
    Debit: 2150 Customer Advances, Credit: 1100 Customer Receivables.
    """
    cust_id = payload.get("customer_id")
    inv_id = payload.get("invoice_id")
    raw_amt = payload.get("amount")

    if not cust_id or not inv_id or raw_amt is None:
        raise HTTPException(status_code=400, detail="customer_id, invoice_id, and amount are required.")

    inv = db.query(models.Invoice).filter(models.Invoice.id == inv_id, models.Invoice.customer_id == cust_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found for this customer.")

    amt = round_money(raw_amt)
    if amt <= Decimal("0.00") or amt > round_money(inv.balance_due):
        raise HTTPException(status_code=400, detail=f"Allocation amount must be between 0.01 and invoice balance due ${inv.balance_due:,.2f}.")

    new_rec = round_money(Decimal(str(inv.amount_received or 0)) + amt)
    new_due = round_money(Decimal(str(inv.total_amount or 0)) - new_rec)

    inv.amount_received = new_rec
    inv.balance_due = new_due
    inv.payment_status = "PAID" if new_due <= Decimal("0.00") else "PARTIALLY PAID"

    pa = models.PaymentAllocation(
        customer_id=cust_id,
        invoice_id=inv.id,
        shipment_id=inv.shipment_id,
        allocated_amount_usd=amt,
        allocation_type="ADVANCE_APPLICATION",
        notes=payload.get("notes") or f"Applied Customer Advance to Invoice {inv.invoice_number}",
        created_at=datetime.utcnow(),
    )
    db.add(pa)

    je = post_customer_advance_allocation_journal(
        db=db,
        customer_id=cust_id,
        invoice_id=inv.id,
        amount=amt,
        reference=f"ADV-APP-{inv.invoice_number}",
    )

    db.commit()
    return {
        "status": "SUCCESS",
        "invoice_number": inv.invoice_number,
        "applied_amount_usd": float(amt),
        "new_balance_due": float(new_due),
        "payment_status": inv.payment_status,
        "journal_entry": je.entry_number if je else None,
    }


# =====================================================================
# 15. BANK STATEMENT IMPORT & CLASSIFICATION ENGINE
# =====================================================================

@router.post("/bank-statements/import-preview")
def preview_statement_import(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Parses and classifies bank statement rows prior to commitment:
    Flags each row as NEW_TRANSACTION, EXACT_MATCH, POSSIBLE_MATCH, DUPLICATE, INVALID_ROW, or UNKNOWN_CURRENCY.
    """
    bank_id = payload.get("bank_account_id")
    rows = payload.get("rows") or []

    if not bank_id or not rows:
        raise HTTPException(status_code=400, detail="bank_account_id and rows array are required.")

    try:
        preview_result = preview_bank_statement(db, bank_id, rows)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return preview_result


@router.post("/bank-statements/commit-import")
def commit_statement_import(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Commits reviewed statement lines to bank_statement_lines table.
    Optionally creates and reconciles corresponding BankTransactions.
    """
    bank_id = payload.get("bank_account_id")
    b_acc = db.query(models.BankAccount).filter(models.BankAccount.id == bank_id).first()
    if not b_acc:
        raise HTTPException(status_code=404, detail="Bank account not found.")

    rows = payload.get("rows") or []
    create_txs = payload.get("create_missing_transactions", False)
    user_name = payload.get("user_name", "Admin")

    batch_id = f"STMT-{date.today().strftime('%Y%m%d')}-{datetime.utcnow().strftime('%H%M%S')}"
    committed_count = 0
    auto_created_txs = 0

    for r in rows:
        status_val = r.get("status")
        if status_val in ("INVALID_ROW", "UNKNOWN_CURRENCY", "DUPLICATE"):
            continue

        try:
            r_date = datetime.strptime(str(r.get("date")), "%Y-%m-%d").date()
        except Exception:
            continue

        debit = round_money(r.get("debit", 0))
        credit = round_money(r.get("credit", 0))
        ref = r.get("reference")
        desc = r.get("description", "")

        matched_tx_id = r.get("matched_tx_id")

        if not matched_tx_id and create_txs:
            # Auto-create BankTransaction for NEW_TRANSACTION
            tx_type = "CUSTOMER_RECEIPT" if debit > 0 else "EXPENSE_PAYMENT"
            count = db.query(models.BankTransaction).count()
            new_tx = models.BankTransaction(
                transaction_code=f"STMT-TX-{r_date.year}-{count + 1:05d}",
                date=r_date,
                bank_account_id=b_acc.id,
                bank_name=b_acc.bank_name,
                account_number=b_acc.account_number,
                party_type="OTHER",
                party_name=desc[:50] or "Statement Entry",
                transaction_type=tx_type,
                currency=b_acc.currency,
                money_in=debit,
                money_out=credit,
                exchange_rate=Decimal("1.0000"),
                usd_equivalent_in=debit,
                usd_equivalent_out=credit,
                transaction_reference=ref,
                status="CLEARED",
                approval_status="POSTED",
                notes=f"Auto-imported from statement batch {batch_id}",
                created_by=user_name,
            )
            db.add(new_tx)
            db.flush()
            matched_tx_id = new_tx.id
            auto_created_txs += 1

        stmt_line = models.BankStatementLine(
            bank_account_id=b_acc.id,
            batch_id=batch_id,
            date=r_date,
            description=desc,
            reference=ref,
            money_in=debit,
            money_out=credit,
            matched_status="MATCHED" if matched_tx_id else "UNMATCHED",
            matched_bank_transaction_id=matched_tx_id,
        )
        db.add(stmt_line)
        committed_count += 1

    recalculate_bank_running_balance(db, b_acc.id)
    db.commit()

    return {
        "status": "SUCCESS",
        "batch_id": batch_id,
        "committed_lines": committed_count,
        "auto_created_transactions": auto_created_txs,
    }


# =====================================================================
# 16. BANK RECONCILIATION WORKBENCH & DIFFERENCE TRACKER
# =====================================================================

@router.get("/reconciliation/{bank_account_id}")
def get_reconciliation_screen(
    bank_account_id: int,
    statement_closing_balance: Optional[float] = None,
    db: Session = Depends(get_db),
):
    """
    Side-by-side reconciliation interface:
    System Ledger Transactions vs Imported Bank Statement Lines.
    Real-time difference tracker ($0.00 difference = fully reconciled).
    """
    b_acc = db.query(models.BankAccount).filter(models.BankAccount.id == bank_account_id).first()
    if not b_acc:
        raise HTTPException(status_code=404, detail="Bank account not found.")

    system_bal = float(recalculate_bank_running_balance(db, b_acc.id))
    stmt_bal = statement_closing_balance if statement_closing_balance is not None else system_bal
    diff = round(float(stmt_bal) - system_bal, 2)

    ledger_txs = (
        db.query(models.BankTransaction)
        .filter(models.BankTransaction.bank_account_id == bank_account_id)
        .order_by(models.BankTransaction.date.desc(), models.BankTransaction.id.desc())
        .all()
    )
    stmt_lines = (
        db.query(models.BankStatementLine)
        .filter(models.BankStatementLine.bank_account_id == bank_account_id)
        .order_by(models.BankStatementLine.date.desc(), models.BankStatementLine.id.desc())
        .all()
    )

    ledger_items = []
    for t in ledger_txs:
        ledger_items.append({
            "id": t.id,
            "code": t.transaction_code,
            "date": str(t.date),
            "party_name": t.party_name,
            "type": t.transaction_type,
            "money_in": float(t.usd_equivalent_in or t.money_in),
            "money_out": float(t.usd_equivalent_out or t.money_out),
            "reference": t.transaction_reference or t.bank_reference,
            "status": t.status,
            "approval_status": t.approval_status,
            "is_reversed": bool(t.is_reversed),
        })

    statement_items = []
    for s in stmt_lines:
        statement_items.append({
            "id": s.id,
            "batch_id": s.batch_id,
            "date": str(s.date),
            "description": s.description,
            "reference": s.reference,
            "debit": float(s.money_in),
            "credit": float(s.money_out),
            "matched_status": s.matched_status or "UNMATCHED",
            "matched_bank_transaction_id": s.matched_bank_transaction_id,
        })

    return {
        "bank_account": {
            "id": b_acc.id,
            "bank_name": b_acc.bank_name,
            "account_number": b_acc.account_number,
            "currency": b_acc.currency,
            "account_type": b_acc.account_type,
        },
        "balances": {
            "statement_closing_balance": float(stmt_bal),
            "system_closing_balance": system_bal,
            "difference": diff,
            "is_reconciled": abs(diff) < 0.01,
        },
        "ledger_transactions": ledger_items,
        "statement_lines": statement_items,
    }


@router.post("/reconciliation/match-action")
def apply_reconciliation_action(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Reconciliation matching action:
    'MATCH' -> links statement line to ledger transaction.
    'UNMATCH' -> unlinks statement line from ledger transaction.
    """
    action = payload.get("action", "MATCH").upper()
    stmt_line_id = payload.get("statement_line_id")
    tx_id = payload.get("transaction_id")
    user_name = payload.get("user_name", "Admin")

    stmt_line = db.query(models.BankStatementLine).filter(models.BankStatementLine.id == stmt_line_id).first()
    if not stmt_line:
        raise HTTPException(status_code=404, detail="Statement line not found.")

    if action == "MATCH":
        if not tx_id:
            raise HTTPException(status_code=400, detail="transaction_id is required to MATCH.")
        tx = db.query(models.BankTransaction).filter(models.BankTransaction.id == tx_id).first()
        if not tx:
            raise HTTPException(status_code=404, detail="Bank transaction not found.")

        stmt_line.matched_status = "MATCHED"
        stmt_line.matched_bank_transaction_id = tx.id
        tx.status = "RECONCILED"

        audit = models.AuditLog(
            entity_type="BankReconciliation",
            entity_id=stmt_line.id,
            action="MATCH",
            new_value_json=f'{{"statement_line_id": {stmt_line.id}, "transaction_id": {tx.id}}}',
            user_name=user_name,
            timestamp=datetime.utcnow(),
        )
        db.add(audit)

    elif action == "UNMATCH":
        if stmt_line.matched_bank_transaction_id:
            tx = db.query(models.BankTransaction).filter(models.BankTransaction.id == stmt_line.matched_bank_transaction_id).first()
            if tx and tx.status == "RECONCILED":
                tx.status = "CLEARED"

        stmt_line.matched_status = "UNMATCHED"
        stmt_line.matched_bank_transaction_id = None

        audit = models.AuditLog(
            entity_type="BankReconciliation",
            entity_id=stmt_line.id,
            action="UNMATCH",
            new_value_json=f'{{"statement_line_id": {stmt_line.id}, "unmatched": true}}',
            user_name=user_name,
            timestamp=datetime.utcnow(),
        )
        db.add(audit)

    db.commit()
    return {"status": "SUCCESS", "statement_line_id": stmt_line.id, "action": action}


# =====================================================================
# 17. BANKING DASHBOARD & FINANCIAL AUDIT LOG ENDPOINTS
# =====================================================================

@router.get("/banking-dashboard")
def get_banking_dashboard(db: Session = Depends(get_db)):
    """Executive Banking Dashboard: multi-currency balance cards, cash flow KPIs, carrier position."""
    accounts = db.query(models.BankAccount).order_by(models.BankAccount.id.asc()).all()
    if len(accounts) < len(DEFAULT_BANK_ACCOUNTS):
        seed_standard_bank_accounts(db)
        accounts = db.query(models.BankAccount).order_by(models.BankAccount.id.asc()).all()

    currency_totals = {"USD": 0.0, "AFN": 0.0, "AED": 0.0, "INR": 0.0}
    total_usd_equiv = 0.0
    account_cards = []

    for a in accounts:
        bal = float(recalculate_bank_running_balance(db, a.id))
        curr = a.currency.upper()
        if curr in currency_totals:
            currency_totals[curr] += bal

        # Rough conversion for card summary display (authoritative per tx is in db)
        fx_equiv = bal
        if curr == "AFN":
            fx_equiv = round(bal / 68.0, 2)
        elif curr == "AED":
            fx_equiv = round(bal / 3.67, 2)
        elif curr == "INR":
            fx_equiv = round(bal / 84.0, 2)
        total_usd_equiv += fx_equiv

        account_cards.append({
            "id": a.id,
            "bank_name": a.bank_name,
            "account_number": a.account_number,
            "account_type": a.account_type or "BANK",
            "currency": a.currency,
            "balance": bal,
            "balance_usd_est": fx_equiv,
            "status": a.status or "ACTIVE",
            "branch": a.branch,
        })

    # Flow KPIs
    cf = compute_cash_flow(db)
    transport_pos = compute_transport_position(db)

    # Reconciliation counts
    total_txs = db.query(models.BankTransaction).count()
    reconciled_txs = db.query(models.BankTransaction).filter(models.BankTransaction.status == "RECONCILED").count()
    unreconciled_txs = total_txs - reconciled_txs

    return {
        "currency_balances": currency_totals,
        "total_cash_and_bank_usd_est": round(total_usd_equiv, 2),
        "cash_flow": cf,
        "carrier_credit_position": transport_pos,
        "reconciliation_summary": {
            "total_transactions": total_txs,
            "reconciled": reconciled_txs,
            "unreconciled": unreconciled_txs,
            "reconciliation_rate_pct": round((reconciled_txs / total_txs * 100), 1) if total_txs > 0 else 100.0,
        },
        "accounts": account_cards,
    }


@router.get("/audit-log")
def get_financial_audit_trail(
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """Immutable Financial Audit Log viewer."""
    query = db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc())
    if entity_type and entity_type != "ALL":
        query = query.filter(models.AuditLog.entity_type == entity_type)
    if action and action != "ALL":
        query = query.filter(models.AuditLog.action == action)

    total = query.count()
    logs = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "logs": [
            {
                "id": l.id,
                "entity_type": l.entity_type,
                "entity_id": l.entity_id,
                "action": l.action,
                "old_value": l.old_value_json,
                "new_value": l.new_value_json,
                "user_name": l.user_name,
                "timestamp": l.timestamp.isoformat() if l.timestamp else None,
            }
            for l in logs
        ],
    }


# =====================================================================
# 14. ACCOUNT STATEMENTS (CUSTOMER, SUPPLIER, TRANSPORT, BANK)
# =====================================================================

@router.get("/statements/{party_type}/{party_id}")
def get_party_statement(
    party_type: str,  # customer, supplier, transport, bank
    party_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """
    Chronological statement for Customer, Supplier, Transport Company, or Bank Account.
    Columns: Date, Reference, Description, Debit, Credit, Running Balance.
    """
    pt = party_type.lower()
    title = ""
    lines = []
    running = Decimal("0.00")

    if pt == "customer":
        cust = db.query(models.Customer).filter(models.Customer.id == party_id).first()
        if not cust:
            raise HTTPException(status_code=404, detail="Customer not found.")
        title = cust.customer_name

        # Invoices (Debits) and Payments (Credits)
        invoices = db.query(models.Invoice).filter(models.Invoice.customer_id == party_id).all()
        for inv in invoices:
            lines.append({
                "date": str(inv.date),
                "reference": inv.invoice_number,
                "description": f"Sales Invoice {inv.invoice_number}",
                "debit": float(inv.total_amount or 0),
                "credit": 0.0,
            })

        allocs = db.query(models.PaymentAllocation).filter(models.PaymentAllocation.customer_id == party_id).all()
        for a in allocs:
            lines.append({
                "date": str(a.created_at.date() if a.created_at else date.today()),
                "reference": f"ALLOC-{a.id}",
                "description": f"Payment allocated to {a.invoice.invoice_number if a.invoice else 'Invoice'}",
                "debit": 0.0,
                "credit": float(a.allocated_amount_usd),
            })

    elif pt == "transport":
        tc_co = db.query(models.TransportCompany).filter(models.TransportCompany.id == party_id).first()
        title = tc_co.company_name if tc_co else "Transport Company"
        pos = compute_transport_position(db, party_id)

        # Charges & Payments
        charges = db.query(models.TransportCharge).filter(models.TransportCharge.transport_company_id == party_id).all()
        for c in charges:
            lines.append({
                "date": str(c.date),
                "reference": c.invoice_no or f"TC-{c.id}",
                "description": c.description,
                "debit": float(c.debit_usd),
                "credit": float(c.credit_usd),
            })
        payments = db.query(models.TransportPayment).filter(models.TransportPayment.transport_company_id == party_id).all()
        for p in payments:
            lines.append({
                "date": str(p.date),
                "reference": f"PAY-{p.id}",
                "description": f"Payment via {p.payment_method}",
                "debit": 0.0,
                "credit": float(p.amount_usd),
            })

    elif pt == "bank":
        b = db.query(models.BankAccount).filter(models.BankAccount.id == party_id).first()
        if not b:
            raise HTTPException(status_code=404, detail="Bank account not found.")
        title = f"{b.bank_name} ({b.currency})"
        txs = db.query(models.BankTransaction).filter(models.BankTransaction.bank_account_id == party_id).all()
        for t in txs:
            lines.append({
                "date": str(t.date),
                "reference": t.transaction_reference or t.transaction_code,
                "description": f"{t.transaction_type} - {t.party_name}",
                "debit": float(t.usd_equivalent_in or t.money_in),
                "credit": float(t.usd_equivalent_out or t.money_out),
            })

    # Sort chronological
    lines.sort(key=lambda x: x["date"])

    for l in lines:
        running += Decimal(str(l["debit"])) - Decimal(str(l["credit"]))
        l["balance"] = float(running)

    return {
        "party_type": pt.upper(),
        "party_id": party_id,
        "party_name": title,
        "closing_balance": float(running),
        "lines": lines,
    }


# =====================================================================
# 15. ACCOUNTING PERIOD CLOSING
# =====================================================================

@router.get("/periods")
def list_accounting_periods(db: Session = Depends(get_db)):
    """Lists accounting periods with OPEN, CLOSED, or LOCKED status."""
    periods = db.query(models.AccountingPeriod).order_by(models.AccountingPeriod.start_date.desc()).all()
    if not periods:
        # Seed 2026 monthly periods
        for m in range(1, 13):
            s_d = date(2026, m, 1)
            next_m = date(2026, m + 1, 1) if m < 12 else date(2027, 1, 1)
            e_d = next_m - timedelta(days=1)
            p = models.AccountingPeriod(
                period_name=s_d.strftime("%B %Y"),
                start_date=s_d,
                end_date=e_d,
                status="OPEN",
            )
            db.add(p)
        db.commit()
        periods = db.query(models.AccountingPeriod).order_by(models.AccountingPeriod.start_date.desc()).all()

    return [
        {
            "id": p.id,
            "period_name": p.period_name,
            "start_date": str(p.start_date),
            "end_date": str(p.end_date),
            "status": p.status,
            "closed_by": p.closed_by,
            "closed_at": p.closed_at.isoformat() if p.closed_at else None,
            "notes": p.notes,
        }
        for p in periods
    ]


@router.get("/periods/{period_id}/readiness")
def get_period_close_readiness(
    period_id: int,
    db: Session = Depends(get_db),
):
    """Executes pre-close verification checklist (Section 16)."""
    try:
        return verify_period_close_readiness(db=db, period_id=period_id)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))


@router.post("/periods/{period_id}/close")
def close_accounting_period_endpoint(
    period_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """
    Closes accounting period:
    1. Validates blocking checklist
    2. Generates immutable snapshots (TB, P&L, BS, CF) with SHA256 checksums
    3. Sets status to CLOSED
    """
    user_name = payload.get("user_name", "Admin")
    notes = payload.get("notes")
    try:
        return engine_close_period(db=db, period_id=period_id, user_name=user_name, notes=notes)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.post("/periods/{period_id}/reopen")
def reopen_accounting_period_endpoint(
    period_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """Admin-only reopen of a closed period with mandatory reason and audit trail."""
    user_name = payload.get("user_name", "Admin")
    reason = payload.get("reason", "")
    try:
        return engine_reopen_period(db=db, period_id=period_id, user_name=user_name, reason=reason)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.get("/periods/{period_id}/snapshots")
def get_period_snapshots(
    period_id: int,
    db: Session = Depends(get_db),
):
    """Retrieves immutable financial snapshots and checksums for a closed period."""
    snapshots = (
        db.query(models.PeriodFinancialSnapshot)
        .filter(models.PeriodFinancialSnapshot.period_id == period_id)
        .all()
    )
    return [
        {
            "id": s.id,
            "report_type": s.report_type,
            "as_of_date": str(s.as_of_date),
            "generated_at": s.generated_at.isoformat() if s.generated_at else None,
            "generated_by": s.generated_by,
            "checksum": s.checksum,
            "data": json.loads(s.data_json) if s.data_json else None,
            "notes": s.notes,
        }
        for s in snapshots
    ]


# =====================================================================
# 16. BANK IMPORT & DUPLICATE PREVENTION ENDPOINTS
# =====================================================================

@router.post("/bank-import/preview")
async def preview_bank_import_file(
    bank_account_id: int = Form(...),
    file: Optional[UploadFile] = File(None),
    mapping_profile_id: Optional[int] = Form(None),
    user_name: Optional[str] = Form("Admin"),
    db: Session = Depends(get_db),
):
    """
    Parses bank statement file (CSV, JSON, TXT):
    - Calculates SHA-256 hash to reject duplicate uploads.
    - Normalizes amounts, dates, and currencies.
    - Detects row-level duplicate transactions.
    - Runs matching scoring engine (+50 invoice, +20 customer, +20 amount, etc.).
    - Returns PREVIEW without committing to ledger.
    """
    if not file:
        raise HTTPException(status_code=400, detail="File is required for bank statement preview.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        preview = parse_bank_statement_file(
            db=db,
            bank_account_id=bank_account_id,
            file_bytes=content,
            file_name=file.filename or "statement.csv",
            mapping_profile_id=mapping_profile_id,
            user_name=user_name or "Admin",
        )
        return preview
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/bank-import/preview-json")
def preview_bank_import_json(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """JSON-based statement preview endpoint."""
    bank_id = payload.get("bank_account_id")
    file_name = payload.get("file_name", "imported_statement.json")
    rows = payload.get("rows", [])

    if not bank_id or not rows:
        raise HTTPException(status_code=400, detail="bank_account_id and rows array are required.")

    content = json.dumps(rows).encode("utf-8")
    try:
        preview = parse_bank_statement_file(
            db=db,
            bank_account_id=int(bank_id),
            file_bytes=content,
            file_name=file_name,
            user_name=payload.get("user_name", "Admin"),
        )
        return preview
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/bank-import/commit")
def commit_bank_import_batch_endpoint(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """
    Commits reviewed statement lines to staging tables under a new BankImportBatch.
    Staged lines are ready for interactive match confirmation or allocation.
    """
    bank_id = payload.get("bank_account_id")
    file_name = payload.get("file_name", "statement.csv")
    file_hash = payload.get("file_hash", "")
    rows = payload.get("rows", [])
    user_name = payload.get("user_name", "Admin")
    notes = payload.get("notes")

    if not bank_id or not rows:
        raise HTTPException(status_code=400, detail="bank_account_id and rows are required.")

    try:
        batch = commit_statement_batch(
            db=db,
            bank_account_id=int(bank_id),
            file_name=file_name,
            file_hash=file_hash or hashlib.sha256(json.dumps(rows).encode("utf-8")).hexdigest(),
            rows=rows,
            user_name=user_name,
            notes=notes,
        )
        return {
            "status": "SUCCESS",
            "batch_id": batch.id,
            "batch_number": batch.batch_number,
            "total_staged_lines": batch.total_rows,
            "message": f"Successfully staged Batch {batch.batch_number} with {batch.total_rows} lines for review.",
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/bank-import/batches")
def list_import_batches(
    bank_account_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Lists bank import batches with status, counts, and dates."""
    query = db.query(models.BankImportBatch).order_by(models.BankImportBatch.uploaded_at.desc())
    if bank_account_id:
        query = query.filter(models.BankImportBatch.bank_account_id == bank_account_id)

    batches = query.all()
    return [
        {
            "id": b.id,
            "batch_number": b.batch_number,
            "bank_account_id": b.bank_account_id,
            "bank_name": b.bank_account.bank_name if b.bank_account else "Bank",
            "file_name": b.file_name,
            "file_hash": b.file_hash,
            "statement_start_date": str(b.statement_start_date) if b.statement_start_date else None,
            "statement_end_date": str(b.statement_end_date) if b.statement_end_date else None,
            "currency": b.currency,
            "total_rows": b.total_rows,
            "status": b.status,
            "uploaded_by": b.uploaded_by,
            "uploaded_at": b.uploaded_at.isoformat() if b.uploaded_at else None,
            "notes": b.notes,
        }
        for b in batches
    ]


@router.get("/bank-import/batches/{batch_id}")
def get_batch_detail(batch_id: int, db: Session = Depends(get_db)):
    """Returns all statement lines under an import batch with their match status."""
    batch = db.query(models.BankImportBatch).filter(models.BankImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Import batch not found.")

    lines = (
        db.query(models.BankStatementLine)
        .filter(models.BankStatementLine.batch_id == batch.id)
        .order_by(models.BankStatementLine.transaction_date.asc(), models.BankStatementLine.id.asc())
        .all()
    )

    return {
        "batch": {
            "id": batch.id,
            "batch_number": batch.batch_number,
            "bank_account_id": batch.bank_account_id,
            "bank_name": batch.bank_account.bank_name if batch.bank_account else "Bank",
            "currency": batch.currency,
            "file_name": batch.file_name,
            "total_rows": batch.total_rows,
            "status": batch.status,
            "uploaded_at": batch.uploaded_at.isoformat() if batch.uploaded_at else None,
        },
        "lines": [
            {
                "id": l.id,
                "date": str(l.transaction_date),
                "description": l.description,
                "reference": l.reference,
                "currency": l.currency,
                "debit": float(l.debit),
                "credit": float(l.credit),
                "balance": float(l.balance) if l.balance is not None else None,
                "match_status": l.match_status,
                "confidence_score": l.confidence_score,
                "matching_reasons": json.loads(l.matching_reasons) if l.matching_reasons else [],
                "suggested_type": l.suggested_type,
                "suggested_party_type": l.suggested_party_type,
                "suggested_party_id": l.suggested_party_id,
                "suggested_party_name": l.suggested_party_name,
                "suggested_invoice_id": l.suggested_invoice_id,
                "suggested_invoice_number": l.suggested_invoice_number,
                "matched_transaction_id": l.matched_transaction_id,
            }
            for l in lines
        ],
    }


# =====================================================================
# 17. ATOMIC TRANSACTION MATCHING & CONFIRMATION
# =====================================================================

@router.post("/bank-matching/confirm")
def confirm_match_endpoint(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """
    Atomic posting of a matched bank transaction:
    - CONFIRM_MATCH
    - CUSTOMER_RECEIPT
    - CUSTOMER_ADVANCE
    - UNIDENTIFIED_SUSPENSE
    - TRANSPORT_PAYMENT
    - BANK_CHARGE
    - LINK_EXISTING
    Rolls back automatically if Debit != Credit!
    """
    stmt_line_id = payload.get("statement_line_id")
    action_type = payload.get("action_type", "CONFIRM_MATCH")

    if not stmt_line_id:
        raise HTTPException(status_code=400, detail="statement_line_id is required.")

    try:
        res = atomic_confirm_and_post_match(
            db=db,
            statement_line_id=int(stmt_line_id),
            action_type=action_type,
            customer_id=payload.get("customer_id"),
            invoice_allocations=payload.get("invoice_allocations"),
            existing_transaction_id=payload.get("existing_transaction_id"),
            user_name=payload.get("user_name", "Admin"),
            notes=payload.get("notes"),
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =====================================================================
# 18. UNMATCHED TRANSACTION QUEUE
# =====================================================================

@router.get("/unmatched-queue")
def get_unmatched_queue(
    bank_account_id: Optional[int] = None,
    sort_by: str = Query("amount", pattern="^(amount|date|confidence)$"),
    db: Session = Depends(get_db),
):
    """
    Returns un-reconciled bank statement lines:
    Sort by: highest amount, oldest date, highest confidence.
    """
    query = (
        db.query(models.BankStatementLine)
        .filter(models.BankStatementLine.match_status.in_(("UNMATCHED", "POSSIBLE_MATCH", "SUGGESTED", "HIGH_CONFIDENCE")))
    )

    if bank_account_id:
        query = query.filter(models.BankStatementLine.bank_account_id == bank_account_id)

    if sort_by == "amount":
        query = query.order_by(models.BankStatementLine.normalized_amount.desc())
    elif sort_by == "date":
        query = query.order_by(models.BankStatementLine.transaction_date.asc())
    elif sort_by == "confidence":
        query = query.order_by(models.BankStatementLine.confidence_score.desc())

    lines = query.all()
    today = date.today()

    results = []
    for l in lines:
        age_days = (today - l.transaction_date).days if l.transaction_date else 0
        b_name = l.bank_account.bank_name if l.bank_account else "Bank Account"

        results.append({
            "id": l.id,
            "date": str(l.transaction_date),
            "bank_account_id": l.bank_account_id,
            "bank_name": b_name,
            "description": l.description,
            "reference": l.reference,
            "currency": l.currency,
            "debit": float(l.debit),
            "credit": float(l.credit),
            "amount": float(l.normalized_amount),
            "type_direction": "MONEY_IN" if l.credit > 0 else "MONEY_OUT",
            "possible_party": l.suggested_party_name or "Unassigned",
            "possible_match": l.suggested_type or "OTHER",
            "confidence_score": l.confidence_score or 0,
            "matching_reasons": json.loads(l.matching_reasons) if l.matching_reasons else [],
            "suggested_invoice_id": l.suggested_invoice_id,
            "suggested_invoice_number": l.suggested_invoice_number,
            "age_days": age_days,
            "match_status": l.match_status,
        })

    return {
        "total_unmatched": len(results),
        "sort_by": sort_by,
        "items": results,
    }


# =====================================================================
# 19. SWIFT MT103 IMPORT & TRACKING ENDPOINTS
# =====================================================================

@router.post("/mt103/parse-and-record")
def parse_and_record_mt103_endpoint(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """
    Parses SWIFT MT103 wire confirmation:
    Extracts tags :20:, :23B:, :32A:, :50:, :52:, :53:, :54:, :56A:, :57A:, :59:, :70:, :71A:, :72:.
    Attempts auto-matching against customers and invoices.
    """
    raw_text = payload.get("raw_text") or payload.get("text")
    if not raw_text:
        raise HTTPException(status_code=400, detail="raw_text of MT103 message is required.")

    parsed = parse_swift_mt103(raw_text)
    user_name = payload.get("user_name", "Admin")

    try:
        mt_rec = record_swift_mt103(db, parsed, user_name)
        return {
            "status": "SUCCESS",
            "mt103_id": mt_rec.id,
            "transaction_reference": mt_rec.transaction_reference,
            "amount": float(mt_rec.amount),
            "currency": mt_rec.currency,
            "value_date": str(mt_rec.value_date),
            "ordering_customer": mt_rec.ordering_customer,
            "beneficiary": mt_rec.beneficiary,
            "linked_customer_id": mt_rec.linked_customer_id,
            "linked_invoice_id": mt_rec.linked_invoice_id,
            "proof_status": mt_rec.status,
            "message": f"MT103 {mt_rec.transaction_reference} successfully parsed and recorded.",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/mt103/records")
def list_mt103_records(db: Session = Depends(get_db)):
    """Lists recorded SWIFT MT103 proofs with current linking status."""
    records = db.query(models.SwiftMT103).order_by(models.SwiftMT103.value_date.desc(), models.SwiftMT103.id.desc()).all()
    return [
        {
            "id": r.id,
            "transaction_reference": r.transaction_reference,
            "value_date": str(r.value_date),
            "currency": r.currency,
            "amount": float(r.amount),
            "ordering_customer": r.ordering_customer,
            "beneficiary": r.beneficiary,
            "sender_bank": r.sender_bank,
            "receiver_bank": r.receiver_bank,
            "remittance_info": r.remittance_info,
            "linked_customer_id": r.linked_customer_id,
            "linked_customer_name": r.linked_customer.customer_name if r.linked_customer else None,
            "linked_invoice_id": r.linked_invoice_id,
            "linked_invoice_number": r.linked_invoice.invoice_number if r.linked_invoice else None,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]


# =====================================================================
# 20. INTERNAL BANK TRANSFERS
# =====================================================================

@router.post("/bank-transfers/internal")
def create_internal_transfer_endpoint(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """
    Executes internal transfer between own bank/cash/Sarafi accounts:
    Single accounting event: Debit destination bank, Credit source bank.
    """
    src_id = payload.get("source_bank_id")
    dst_id = payload.get("dest_bank_id")
    amt_src = payload.get("amount_source")

    if not src_id or not dst_id or amt_src is None:
        raise HTTPException(status_code=400, detail="source_bank_id, dest_bank_id, and amount_source are required.")

    t_date_str = payload.get("transfer_date")
    t_date = datetime.strptime(t_date_str, "%Y-%m-%d").date() if t_date_str else date.today()

    fx_rate = Decimal(str(payload.get("exchange_rate", "1.0000")))
    amt_dest = Decimal(str(payload.get("amount_dest"))) if payload.get("amount_dest") else None

    try:
        res = execute_internal_bank_transfer(
            db=db,
            source_bank_id=int(src_id),
            dest_bank_id=int(dst_id),
            amount_source=Decimal(str(amt_src)),
            amount_dest=amt_dest,
            exchange_rate=fx_rate,
            transfer_date=t_date,
            reference=payload.get("reference"),
            notes=payload.get("notes"),
            user_name=payload.get("user_name", "Admin"),
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =====================================================================
# 21. RECONCILIATION WORKSPACE ENDPOINTS
# =====================================================================

@router.get("/reconciliation-workspace/{bank_account_id}")
def get_reconciliation_workspace_data(
    bank_account_id: int,
    statement_closing_balance: Optional[float] = None,
    db: Session = Depends(get_db),
):
    """
    Full split reconciliation workspace interface:
    Left: Statement Transactions
    Right: AQ Ledger Transactions
    Summary: Statement Opening & Closing vs AQ Opening & Closing + Difference ($0.00 required)
    """
    b_acc = db.query(models.BankAccount).filter(models.BankAccount.id == bank_account_id).first()
    if not b_acc:
        raise HTTPException(status_code=404, detail="Bank account not found.")

    ledger_bal = float(recalculate_bank_running_balance(db, b_acc.id))
    op_bal = float(b_acc.opening_balance or 0)
    stmt_bal = statement_closing_balance if statement_closing_balance is not None else ledger_bal
    diff = round(stmt_bal - ledger_bal, 2)

    # 1. Statement lines for this account
    stmt_lines = (
        db.query(models.BankStatementLine)
        .filter(models.BankStatementLine.bank_account_id == bank_account_id)
        .order_by(models.BankStatementLine.transaction_date.desc(), models.BankStatementLine.id.desc())
        .all()
    )

    # 2. Ledger transactions for this account
    ledger_txs = (
        db.query(models.BankTransaction)
        .filter(models.BankTransaction.bank_account_id == bank_account_id)
        .order_by(models.BankTransaction.date.desc(), models.BankTransaction.id.desc())
        .all()
    )

    stmt_total_in = sum(float(l.credit) for l in stmt_lines)
    stmt_total_out = sum(float(l.debit) for l in stmt_lines)
    ledger_total_in = sum(float(t.money_in) for t in ledger_txs)
    ledger_total_out = sum(float(t.money_out) for t in ledger_txs)

    matched_count = sum(1 for l in stmt_lines if l.match_status in ("MATCHED", "RECONCILED"))
    unmatched_count = len(stmt_lines) - matched_count

    return {
        "bank_account": {
            "id": b_acc.id,
            "bank_name": b_acc.bank_name,
            "account_number": b_acc.account_number,
            "currency": b_acc.currency,
            "branch": b_acc.branch,
        },
        "balances": {
            "aq_opening_balance": op_bal,
            "aq_closing_balance": ledger_bal,
            "statement_opening_balance": op_bal,
            "statement_closing_balance": stmt_bal,
            "difference": diff,
            "is_reconciled": abs(diff) < 0.01 and unmatched_count == 0,
        },
        "summary": {
            "statement_lines_count": len(stmt_lines),
            "matched_lines_count": matched_count,
            "unmatched_lines_count": unmatched_count,
            "statement_total_in": round(stmt_total_in, 2),
            "statement_total_out": round(stmt_total_out, 2),
            "ledger_total_in": round(ledger_total_in, 2),
            "ledger_total_out": round(ledger_total_out, 2),
        },
        "statement_lines": [
            {
                "id": l.id,
                "date": str(l.transaction_date),
                "description": l.description,
                "reference": l.reference,
                "debit": float(l.debit),
                "credit": float(l.credit),
                "match_status": l.match_status,
                "confidence_score": l.confidence_score,
                "matched_transaction_id": l.matched_transaction_id,
                "suggested_party_name": l.suggested_party_name,
                "suggested_type": l.suggested_type,
            }
            for l in stmt_lines
        ],
        "ledger_transactions": [
            {
                "id": t.id,
                "code": t.transaction_code,
                "date": str(t.date),
                "party_name": t.party_name,
                "type": t.transaction_type,
                "money_in": float(t.money_in),
                "money_out": float(t.money_out),
                "reference": t.transaction_reference or t.bank_reference,
                "status": t.status,
            }
            for t in ledger_txs
        ],
    }


# =====================================================================
# 22. MAPPING PROFILES & MATCHING RULES ENDPOINTS
# =====================================================================

@router.get("/mapping-profiles")
def list_mapping_profiles(db: Session = Depends(get_db)):
    """Lists reusable bank CSV/XLSX column mapping profiles."""
    profs = db.query(models.BankMappingProfile).all()
    return [
        {
            "id": p.id,
            "profile_name": p.profile_name,
            "bank_account_id": p.bank_account_id,
            "date_column": p.date_column,
            "value_date_column": p.value_date_column,
            "description_column": p.description_column,
            "debit_column": p.debit_column,
            "credit_column": p.credit_column,
            "balance_column": p.balance_column,
            "reference_column": p.reference_column,
            "date_format": p.date_format,
        }
        for p in profs
    ]


@router.get("/matching-rules")
def list_matching_rules(db: Session = Depends(get_db)):
    """Lists smart matching rules."""
    rules = db.query(models.BankMatchingRule).all()
    return [
        {
            "id": r.id,
            "rule_name": r.rule_name,
            "pattern_type": r.pattern_type,
            "pattern_value": r.pattern_value,
            "direction": r.direction,
            "target_party_type": r.target_party_type,
            "target_transaction_type": r.target_transaction_type,
            "target_account_code": r.target_account_code,
            "is_active": r.is_active,
        }
        for r in rules
    ]


# =====================================================================
# 23. DAILY ACCOUNTING & SARAFI CONTROL SYSTEM (SECTION 1-54)
# =====================================================================

class ReceiptCreateRequest(BaseModel):
    account_id: int
    received_from: str
    party_type: str = "CUSTOMER"
    amount: Decimal
    currency: Optional[str] = None
    customer_id: Optional[int] = None
    invoice_id: Optional[int] = None
    receipt_date: Optional[date] = None
    reference: Optional[str] = None
    description: Optional[str] = None
    user_name: str = "Admin"


class PaymentCreateRequest(BaseModel):
    account_id: int
    paid_to: str
    party_type: str  # SUPPLIER, TRANSPORT, EXPENSE, OTHER
    amount: Decimal
    currency: Optional[str] = None
    supplier_id: Optional[int] = None
    transport_company_id: Optional[int] = None
    expense_account_code: Optional[str] = None
    payment_date: Optional[date] = None
    reference: Optional[str] = None
    description: Optional[str] = None
    user_name: str = "Admin"


class TransferCreateRequest(BaseModel):
    source_account_id: int
    destination_account_id: int
    source_amount: Decimal
    destination_amount: Optional[Decimal] = None
    exchange_rate: Optional[Decimal] = None
    commission_amount: Decimal = Decimal("0.00")
    transfer_date: Optional[date] = None
    reference: Optional[str] = None
    description: Optional[str] = None
    user_name: str = "Admin"


class CashCountCreateRequest(BaseModel):
    cash_account_id: int
    physical_count: Decimal
    reason: Optional[str] = None
    auto_adjust: bool = False
    user_name: str = "Admin"


class DailyCloseCreateRequest(BaseModel):
    close_date: date
    notes: Optional[str] = None
    user_name: str = "Admin"


class CreditNoteCreateRequest(BaseModel):
    customer_id: int
    amount: Decimal
    reason: str
    invoice_id: Optional[int] = None
    note_date: Optional[date] = None
    user_name: str = "Admin"


class DebitNoteCreateRequest(BaseModel):
    party_type: str  # SUPPLIER or TRANSPORT
    party_id: int
    amount: Decimal
    reason: str
    note_date: Optional[date] = None
    user_name: str = "Admin"


class OpeningBalanceCreateRequest(BaseModel):
    entity_type: str
    entity_name: str
    debit: Decimal = Decimal("0.00")
    credit: Decimal = Decimal("0.00")
    currency: str = "USD"
    effective_date: Optional[date] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    user_name: str = "Admin"


@router.get("/daily")
def get_daily_accounting_center_endpoint(
    target_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """
    Returns today's complete financial activity:
    - Opening/Closing Cash, Bank, Sarafi
    - Total Inflows & Outflows
    - Net Daily Cash Movement
    - Chronological Transactions
    """
    return get_daily_financial_center(db=db, target_date=target_date)


@router.post("/receipts")
def create_receipt_endpoint(
    req: ReceiptCreateRequest,
    db: Session = Depends(get_db),
):
    """
    Records a Cash, Bank, or Sarafi Receipt with double-entry GL posting:
    - Dr Cash/Bank/Sarafi Account
    - Cr 1100 AR (if invoice allocated) or Cr 2150 Customer Advances
    """
    try:
        return record_receipt(
            db=db,
            account_id=req.account_id,
            received_from=req.received_from,
            party_type=req.party_type,
            amount=req.amount,
            currency=req.currency,
            customer_id=req.customer_id,
            invoice_id=req.invoice_id,
            receipt_date=req.receipt_date,
            reference=req.reference,
            description=req.description,
            user_name=req.user_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/payments")
def create_payment_endpoint(
    req: PaymentCreateRequest,
    db: Session = Depends(get_db),
):
    """
    Records a Cash, Bank, or Sarafi Payment with double-entry GL posting:
    - Dr 2000 AP / 1350 Supplier Advance (Supplier)
    - Dr 2100 Transport Payable (Sky Ariana)
    - Dr 5xxx/6xxx (Operating Expense)
    - Cr Cash/Bank/Sarafi Account
    """
    try:
        return record_payment(
            db=db,
            account_id=req.account_id,
            paid_to=req.paid_to,
            party_type=req.party_type,
            amount=req.amount,
            currency=req.currency,
            supplier_id=req.supplier_id,
            transport_company_id=req.transport_company_id,
            expense_account_code=req.expense_account_code,
            payment_date=req.payment_date,
            reference=req.reference,
            description=req.description,
            user_name=req.user_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/transfers")
def create_multi_channel_transfer_endpoint(
    req: TransferCreateRequest,
    db: Session = Depends(get_db),
):
    """
    Executes balanced multi-channel transfer:
    Bank <-> Cash <-> Sarafi.
    Single business event. Zero revenue. Zero expense on principal.
    Optional commission posted to 5600 Bank Charges.
    """
    try:
        return execute_multi_channel_transfer(
            db=db,
            source_account_id=req.source_account_id,
            destination_account_id=req.destination_account_id,
            source_amount=req.source_amount,
            destination_amount=req.destination_amount,
            exchange_rate=req.exchange_rate,
            commission_amount=req.commission_amount,
            transfer_date=req.transfer_date,
            reference=req.reference,
            description=req.description,
            user_name=req.user_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cash-count")
def create_cash_count_endpoint(
    req: CashCountCreateRequest,
    db: Session = Depends(get_db),
):
    """
    Records physical cash count:
    Compares System Cash vs Physical Cash.
    Detects Shortage / Overage.
    If auto_adjust=True, creates GL adjustment journal (6450 / 4100).
    """
    try:
        return record_physical_cash_count(
            db=db,
            cash_account_id=req.cash_account_id,
            physical_count=req.physical_count,
            reason=req.reason,
            auto_adjust=req.auto_adjust,
            user_name=req.user_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/cash-counts")
def list_cash_counts_endpoint(
    cash_account_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """Lists recent cash counts."""
    query = db.query(models.CashCount)
    if cash_account_id:
        query = query.filter(models.CashCount.cash_account_id == cash_account_id)
    counts = query.order_by(models.CashCount.created_at.desc()).limit(limit).all()
    return [
        {
            "id": c.id,
            "count_code": c.count_code,
            "cash_account_id": c.cash_account_id,
            "date": str(c.date),
            "system_balance": float(c.system_balance),
            "physical_count": float(c.physical_count),
            "difference": float(c.difference),
            "status": c.status,
            "reason": c.reason,
            "auto_adjusted": c.auto_adjusted,
            "created_by": c.created_by,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in counts
    ]


@router.post("/daily-close")
def create_daily_close_endpoint(
    req: DailyCloseCreateRequest,
    db: Session = Depends(get_db),
):
    """
    Performs daily closing validation & creates closing snapshot:
    Checks for drafts, unbalanced trial balance, unallocated receipts, cash differences.
    """
    try:
        return perform_daily_close(
            db=db,
            close_date=req.close_date,
            user_name=req.user_name,
            notes=req.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/daily-closes")
def list_daily_closes_endpoint(
    limit: int = 30,
    db: Session = Depends(get_db),
):
    """Lists daily closing snapshots."""
    closes = db.query(models.DailyClose).order_by(models.DailyClose.close_date.desc()).limit(limit).all()
    return [
        {
            "id": c.id,
            "close_date": str(c.close_date),
            "closed_by": c.closed_by,
            "closed_at": c.closed_at.isoformat() if c.closed_at else None,
            "opening_cash_usd": float(c.opening_cash_usd),
            "opening_bank_usd": float(c.opening_bank_usd),
            "total_money_in_usd": float(c.total_money_in_usd),
            "total_money_out_usd": float(c.total_money_out_usd),
            "closing_cash_usd": float(c.closing_cash_usd),
            "closing_bank_usd": float(c.closing_bank_usd),
            "net_movement_usd": float(c.net_movement_usd),
            "draft_transactions_count": c.draft_transactions_count,
            "unbalanced_journals_count": c.unbalanced_journals_count,
            "unallocated_receipts_count": c.unallocated_receipts_count,
            "unreconciled_cash_diff": float(c.unreconciled_cash_diff),
            "status": c.status,
            "notes": c.notes,
        }
        for c in closes
    ]


@router.post("/credit-notes")
def create_credit_note_endpoint(
    req: CreditNoteCreateRequest,
    db: Session = Depends(get_db),
):
    """
    Records customer credit note:
    Dr 4150 Sales Returns & Allowances
    Cr 1100 Customer Receivables
    """
    try:
        return record_credit_note(
            db=db,
            customer_id=req.customer_id,
            amount=req.amount,
            reason=req.reason,
            invoice_id=req.invoice_id,
            note_date=req.note_date,
            user_name=req.user_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/debit-notes")
def create_debit_note_endpoint(
    req: DebitNoteCreateRequest,
    db: Session = Depends(get_db),
):
    """
    Records supplier or carrier debit note:
    Supplier: Dr 2000 AP, Cr 5000 Purchases
    Transport: Dr 2100 Transport Payable, Cr 5100 Freight
    """
    try:
        return record_debit_note(
            db=db,
            party_type=req.party_type,
            party_id=req.party_id,
            amount=req.amount,
            reason=req.reason,
            note_date=req.note_date,
            user_name=req.user_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/notes")
def list_accounting_notes_endpoint(
    note_type: Optional[str] = None,
    party_type: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """Lists Credit Notes and Debit Notes."""
    query = db.query(models.AccountingNote)
    if note_type:
        query = query.filter(models.AccountingNote.note_type == note_type)
    if party_type:
        query = query.filter(models.AccountingNote.party_type == party_type)
    notes = query.order_by(models.AccountingNote.created_at.desc()).limit(limit).all()
    return [
        {
            "id": n.id,
            "note_number": n.note_number,
            "note_type": n.note_type,
            "party_type": n.party_type,
            "party_id": n.party_id,
            "party_name": n.party_name,
            "date": str(n.date),
            "amount": float(n.amount),
            "currency": n.currency,
            "reason": n.reason,
            "invoice_id": n.invoice_id,
            "journal_entry_id": n.journal_entry_id,
            "status": n.status,
            "created_by": n.created_by,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notes
    ]


@router.post("/opening-balances")
def create_opening_balance_endpoint(
    req: OpeningBalanceCreateRequest,
    db: Session = Depends(get_db),
):
    """
    Initializes formal Opening Balance:
    Balanced against Account 3000 Opening Balance Equity.
    """
    try:
        return record_opening_balance(
            db=db,
            entity_type=req.entity_type,
            entity_name=req.entity_name,
            debit=req.debit,
            credit=req.credit,
            currency=req.currency,
            effective_date=req.effective_date,
            reference=req.reference,
            notes=req.notes,
            user_name=req.user_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/opening-balances")
def list_opening_balances_endpoint(
    db: Session = Depends(get_db),
):
    """Lists all opening balance entries."""
    entries = db.query(models.OpeningBalanceEntry).order_by(models.OpeningBalanceEntry.effective_date.desc()).all()
    return [
        {
            "id": e.id,
            "entry_code": e.entry_code,
            "entity_type": e.entity_type,
            "entity_name": e.entity_name,
            "opening_debit": float(e.opening_debit),
            "opening_credit": float(e.opening_credit),
            "currency": e.currency,
            "effective_date": str(e.effective_date),
            "reference": e.reference,
            "notes": e.notes,
            "journal_entry_id": e.journal_entry_id,
            "created_by": e.created_by,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in entries
    ]


@router.get("/cashbook")
def get_cashbook_endpoint(
    account_id: Optional[int] = None,
    currency: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    party: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Generates Cashbook with chronological running balances."""
    return get_account_book(
        db=db,
        account_type_filter="CASH",
        account_id=account_id,
        currency=currency,
        start_date=start_date,
        end_date=end_date,
        party=party,
    )


@router.get("/bankbook")
def get_bankbook_endpoint(
    account_id: Optional[int] = None,
    currency: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    party: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Generates Bankbook with chronological running balances and reconciliation flags."""
    return get_account_book(
        db=db,
        account_type_filter="BANK",
        account_id=account_id,
        currency=currency,
        start_date=start_date,
        end_date=end_date,
        party=party,
    )


@router.get("/sarafi-ledger")
def get_sarafi_ledger_endpoint(
    account_id: Optional[int] = None,
    currency: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    party: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Generates Sarafi Hawala Ledger with running balances and individual statements."""
    return get_account_book(
        db=db,
        account_type_filter="SARAFI",
        account_id=account_id,
        currency=currency,
        start_date=start_date,
        end_date=end_date,
        party=party,
    )


@router.get("/cash-accounts")
def list_cash_accounts_endpoint(
    db: Session = Depends(get_db),
):
    """Lists all active Cash Vault Accounts (USD, AFN, AED, INR)."""
    accs = db.query(models.BankAccount).filter(models.BankAccount.account_type == "CASH").all()
    return [
        {
            "id": a.id,
            "bank_name": a.bank_name,
            "account_name": a.account_name,
            "account_number": a.account_number,
            "currency": a.currency,
            "opening_balance": float(a.opening_balance),
            "current_balance": float(a.current_balance),
            "status": a.status,
            "notes": a.notes,
        }
        for a in accs
    ]


@router.get("/sarafi-accounts")
def list_sarafi_accounts_endpoint(
    db: Session = Depends(get_db),
):
    """Lists all active Sarafi / Hawala Accounts (Omid Ehsan, Kabul Shahzada, etc.)."""
    accs = db.query(models.BankAccount).filter(models.BankAccount.account_type == "SARAFI").all()
    return [
        {
            "id": a.id,
            "bank_name": a.bank_name,
            "account_name": a.account_name,
            "account_number": a.account_number,
            "currency": a.currency,
            "opening_balance": float(a.opening_balance),
            "current_balance": float(a.current_balance),
            "contact_phone": a.contact_phone,
            "status": a.status,
            "notes": a.notes,
        }
        for a in accs
    ]


@router.get("/health")
def get_accounting_health_endpoint(
    db: Session = Depends(get_db),
):
    """
    Subledger vs General Ledger Integrity Diagnostics:
    Verifies GL Trial Balance, AR, AP, Transport, Bank, Cash, and Sarafi subledgers.
    Provides mismatch drilldown when difference > $0.00.
    """
    return get_detailed_accounting_health(db=db)


# =====================================================================
# 20. ADVANCED FINANCIAL REPORTS & AUDIT CONTROLS
# =====================================================================

@router.get("/reports/profit-loss")
def get_advanced_profit_and_loss(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    compare_period: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    GAAP Profit & Loss report with strict Afghan purchase cost handling:
    Marks pending shipments as 'PROFIT PENDING', isolates known profit vs incomplete profit.
    """
    return get_profit_and_loss_report(db, start_date=start_date, end_date=end_date, compare_period=compare_period)


@router.get("/reports/balance-sheet")
def get_advanced_balance_sheet(
    as_of_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """
    Balance Sheet enforcing Section 6 Transport Advance presentation:
    Transport credit in our favor ($291,160.00 / current $321,160.00) is presented as Asset.
    Validates Assets == Liabilities + Equity.
    """
    return get_balance_sheet_report(db, as_of_date=as_of_date)


@router.get("/reports/trial-balance")
def get_advanced_trial_balance(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """
    8-Column Trial Balance:
    Account Code, Account Name, Type, Opening Dr/Cr, Period Dr/Cr, Closing Dr/Cr.
    Difference must be $0.00.
    """
    return get_detailed_trial_balance_report(db, start_date=start_date, end_date=end_date)


@router.get("/reports/cash-flow")
def get_advanced_cash_flow(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """
    Direct-method Cash Flow Statement:
    Operating, Investing, Financing activities, Net Cash Movement, Opening & Closing Cash.
    """
    return get_cash_flow_statement_report(db, start_date=start_date, end_date=end_date)


@router.get("/reports/receivable-aging")
def get_advanced_receivable_aging(
    as_of_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """
    Receivable Aging report with 6 standard buckets:
    Current, 1-30, 31-60, 61-90, 91-120, 120+ days.
    Drilldown to individual invoices.
    """
    return get_receivable_aging_report(db, as_of_date=as_of_date)


@router.get("/reports/payable-aging")
def get_advanced_payable_aging(
    as_of_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """
    Payable Aging report for confirmed supplier bills.
    Pending purchase cost shipments are isolated in a separate alert list.
    """
    return get_payable_aging_report(db, as_of_date=as_of_date)


@router.get("/reports/customer-profit")
def get_customer_profit_report(
    db: Session = Depends(get_db),
):
    """Profitability breakdown by customer with margin % and profit per KG."""
    return get_profit_by_customer_report(db)


@router.get("/reports/shipment-profit")
def get_shipment_profit_report(
    db: Session = Depends(get_db),
):
    """Shipment profitability with PENDING COST badges for incomplete supplier invoices."""
    return get_profit_by_shipment_report(db)


@router.get("/reports/monthly-summary")
def get_monthly_summary_report(
    fiscal_year: int = 2026,
    db: Session = Depends(get_db),
):
    """Chronological monthly financial summary across Sales, Receipts, Transport, Expenses, and Cash Flow."""
    return get_monthly_financial_summary_report(db, fiscal_year=fiscal_year)


# =====================================================================
# 21. BUDGETING & BUDGET VS ACTUAL
# =====================================================================

@router.get("/budgets")
def get_budgets_endpoint(
    fiscal_year: int = 2026,
    period_name: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Returns Budget vs Actual variance analysis (variance $ and %)."""
    return get_budget_vs_actual_report(db, fiscal_year=fiscal_year, period_name=period_name)


@router.post("/budgets")
def create_or_update_budget_endpoint(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """Records or updates a budget entry."""
    acc_code = payload.get("account_code")
    cat_name = payload.get("category_name", "General")
    fy = int(payload.get("fiscal_year", 2026))
    p_name = payload.get("period_name", "All Periods")
    raw_amt = payload.get("budget_amount", 0)
    curr = payload.get("currency", "USD")
    notes = payload.get("notes")
    user_name = payload.get("user_name", "Admin")

    if not acc_code:
        raise HTTPException(status_code=400, detail="account_code is required.")

    return record_budget_entry(
        db=db,
        account_code=acc_code,
        category_name=cat_name,
        fiscal_year=fy,
        period_name=p_name,
        budget_amount=Decimal(str(raw_amt)),
        currency=curr,
        notes=notes,
        user_name=user_name,
    )


# =====================================================================
# 22. CASH FORECAST & COLLECTION PLANNER
# =====================================================================

@router.get("/cash-forecast")
@router.get("/forecast")
def get_cash_forecast_endpoint(
    as_of_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """
    7, 30, 60, 90-day cash projection with probability-weighted receivables.
    Forecast never alters actual GL.
    """
    return get_cash_forecast_report(db, as_of_date=as_of_date)


@router.post("/cash-forecast")
@router.post("/forecast")
def update_forecast_item_endpoint(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """Updates expected collection date, probability percentage, and status for an invoice."""
    inv_id = payload.get("invoice_id")
    if not inv_id:
        raise HTTPException(status_code=400, detail="invoice_id is required.")

    item = db.query(models.CashForecastItem).filter(models.CashForecastItem.invoice_id == inv_id).first()
    exp_date_str = payload.get("expected_date")
    exp_date = datetime.strptime(exp_date_str, "%Y-%m-%d").date() if exp_date_str else date.today() + timedelta(days=30)
    prob = int(payload.get("probability_pct", 85))
    stat = payload.get("status", "EXPECTED")
    notes = payload.get("notes")

    if item:
        item.expected_date = exp_date
        item.probability_pct = prob
        item.status = stat
        item.notes = notes
    else:
        inv = db.query(models.Invoice).filter(models.Invoice.id == inv_id).first()
        item = models.CashForecastItem(
            invoice_id=inv_id,
            forecast_type="RECEIVABLE",
            amount=inv.balance_due if inv else Decimal("0.00"),
            expected_date=exp_date,
            probability_pct=prob,
            status=stat,
            notes=notes,
            created_at=datetime.utcnow(),
        )
        db.add(item)

    db.commit()
    db.refresh(item)
    return {"status": "SUCCESS", "id": item.id, "invoice_id": item.invoice_id, "probability_pct": item.probability_pct}


# =====================================================================
# 23. AUDIT CENTER & HIGH-RISK ALERTS
# =====================================================================

@router.get("/audit-center")
def get_audit_center_endpoint(
    risk_level: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Financial Audit Center: Large payments, manual control postings, reversals, reopened periods."""
    return get_accounting_audit_center_data(db, risk_level=risk_level, limit=limit)


# =====================================================================
# 24. EXPENSE ANALYSIS & BANK CHARGE COMPARISON (SECTION 28 & 29)
# =====================================================================

@router.get("/reports/expenses")
def get_expenses_report_endpoint(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """Expense breakdown by category and Bank Charge analysis by bank account."""
    return get_expense_and_bank_charges_analysis(db, start_date=start_date, end_date=end_date)


# =====================================================================
# 25. CUSTOMER COLLECTION PERFORMANCE (SECTION 30)
# =====================================================================

@router.get("/reports/customer-performance")
def get_customer_performance_endpoint(
    db: Session = Depends(get_db),
):
    """Customer collection performance: Outstanding, unpaid counts, payment history without fabrication."""
    return get_customer_collection_performance(db)


# =====================================================================
# 26. JOURNAL REVIEW (SECTION 35)
# =====================================================================

@router.get("/journal-review")
def get_journal_review_endpoint(
    status: Optional[str] = None,
    entry_type: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Journal review: Draft, pending approval, posted, reversed, and manual entries."""
    return get_journal_review_data(db, status_filter=status, entry_type_filter=entry_type, limit=limit)




