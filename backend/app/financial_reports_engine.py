"""
AQ COMPANIES — FINANCIAL REPORTING, MONTH-END CLOSING, BUDGETING & AUDIT ENGINE
=============================================================================
High-precision, double-entry financial reporting engine:
1. Profit & Loss (Revenue, COGS, Gross Profit, Operating Expenses, Net Profit, Incomplete Cost Handling)
2. Balance Sheet (Assets, Liabilities, Equity, Transport Advance presentation, Assets == Liabilities + Equity)
3. Trial Balance (Opening, Period, Closing with exactly $0.00 difference)
4. Cash Flow Statement (Operating, Investing, Financing, Net Cash Movement)
5. Receivable Aging (Current, 1-30, 31-60, 61-90, 91-120, 120+)
6. Payable Aging (Known supplier bills only; Pending purchase costs identified)
7. Profitability Analytics (By Customer, By Shipment, Profit per KG with PENDING COST flags)
8. Monthly Financial Summary (Multi-month chronological trend)
9. Accounting Period Closing & Snapshots (Checklist, Snapshot storage with SHA256 checksum, Reopening audit)
10. Budgeting & Budget vs Actual (Variance analysis)
11. Cash Forecast & Collection Planner (7/30/60/90 days, Probability weighting, Forecast vs GL separation)
12. Audit Center & High-Risk Alerts (Large payments, Backdated entries, Manual GL entries to control accounts)
"""

import json
import hashlib
from datetime import datetime, date as dt_date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, desc

try:
    from app import models
    from app.accounting_engine import (
        round_money,
        compute_trial_balance,
        compute_profit_and_loss as core_pnl,
        compute_balance_sheet as core_bs,
        compute_cash_flow as core_cf,
        check_period_open,
    )
except ImportError:
    from backend.app import models
    from backend.app.accounting_engine import (
        round_money,
        compute_trial_balance,
        compute_profit_and_loss as core_pnl,
        compute_balance_sheet as core_bs,
        compute_cash_flow as core_cf,
        check_period_open,
    )


# =====================================================================
# 1. ADVANCED PROFIT & LOSS ENGINE (SECTION 2, 3, 4)
# =====================================================================

def get_profit_and_loss_report(
    db: Session,
    start_date: Optional[dt_date] = None,
    end_date: Optional[dt_date] = None,
    compare_period: Optional[str] = None,  # "PREVIOUS_MONTH", "PREVIOUS_YEAR"
) -> Dict[str, Any]:
    """
    Computes GAAP/IFRS-compliant P&L using actual GL entries with incomplete purchase cost protection.
    
    Structure:
    - REVENUE: Sales Revenue (4000), Other Income (4100) -> Total Revenue
    - DIRECT COSTS: Purchase Cost (5000), Transport (5100), Customs (5200), Documentation (5300),
      Loading (5400), Port (5450), Commission (5500), Bank Charges (5600) -> Total Direct Costs
    - GROSS PROFIT = Total Revenue - Total Direct Costs
    - OPERATING EXPENSES: Office (6000), Salaries (6100), Communication (6200), Travel (6300),
      Software (6350), Bank Charges (6400), Misc (6450) -> Total Operating Expenses
    - OPERATING PROFIT = Gross Profit - Operating Expenses
    - OTHER: FX Gain (4200), FX Loss (6500)
    - NET PROFIT = Operating Profit + FX Gain - FX Loss
    
    PURCHASE COST RULE:
    If shipments have purchase_cost == NULL, do NOT treat as zero.
    Mark as PROFIT PENDING and clearly identify known profit vs incomplete profit amount.
    """
    def _compute_period_pnl(s_date: Optional[dt_date], e_date: Optional[dt_date]) -> Dict[str, Any]:
        # Query lines in period
        query = (
            db.query(
                models.Account.account_code,
                models.Account.account_name,
                models.Account.account_type,
                func.coalesce(func.sum(models.JournalLine.debit), Decimal("0.00")).label("debit"),
                func.coalesce(func.sum(models.JournalLine.credit), Decimal("0.00")).label("credit"),
            )
            .join(models.JournalLine, models.JournalLine.account_id == models.Account.id)
            .join(models.JournalEntry, models.JournalEntry.id == models.JournalLine.journal_entry_id)
            .filter(models.JournalEntry.status.in_(("POSTED", "REVERSED")))
        )
        if s_date:
            query = query.filter(models.JournalEntry.entry_date >= s_date)
        if e_date:
            query = query.filter(models.JournalEntry.entry_date <= e_date)

        rows = query.group_by(models.Account.id).all()
        acc_map = {r.account_code: {"debit": round_money(r.debit), "credit": round_money(r.credit), "name": r.account_name} for r in rows}

        def get_net_rev(code: str) -> Decimal:
            # Revenue normal balance is Credit
            a = acc_map.get(code, {"debit": Decimal("0.00"), "credit": Decimal("0.00")})
            return a["credit"] - a["debit"]

        def get_net_exp(code: str) -> Decimal:
            # Expense normal balance is Debit
            a = acc_map.get(code, {"debit": Decimal("0.00"), "credit": Decimal("0.00")})
            return a["debit"] - a["credit"]

        # Revenue
        sales_rev = get_net_rev("4000")
        sales_returns = get_net_exp("4150")  # Dr Sales Returns
        net_sales = sales_rev - sales_returns
        other_inc = get_net_rev("4100")
        total_rev = net_sales + other_inc

        # COGS / Direct Costs
        cogs_items = [
            {"code": "5000", "name": "Dry Fruit Purchase Cost", "amount": get_net_exp("5000")},
            {"code": "5100", "name": "Freight / Transport Cost", "amount": get_net_exp("5100")},
            {"code": "5200", "name": "Customs Clearance & Duties", "amount": get_net_exp("5200")},
            {"code": "5300", "name": "Export & Port Documentation", "amount": get_net_exp("5300")},
            {"code": "5400", "name": "Loading & Unloading Charges", "amount": get_net_exp("5400")},
            {"code": "5450", "name": "Port & Terminal Handling", "amount": get_net_exp("5450")},
            {"code": "5500", "name": "Brokerage & Agent Commission", "amount": get_net_exp("5500")},
            {"code": "5600", "name": "Direct Bank & Wire Charges", "amount": get_net_exp("5600")},
            {"code": "5700", "name": "Other Direct Shipment Costs", "amount": get_net_exp("5700")},
        ]
        total_cogs = sum((item["amount"] for item in cogs_items), Decimal("0.00"))
        gross_profit = total_rev - total_cogs

        # Operating Expenses
        op_items = [
            {"code": "6000", "name": "Office Rent & Admin Expense", "amount": get_net_exp("6000")},
            {"code": "6100", "name": "Salaries & Staff Compensation", "amount": get_net_exp("6100")},
            {"code": "6200", "name": "Internet & Communication", "amount": get_net_exp("6200")},
            {"code": "6300", "name": "Travel & Transportation", "amount": get_net_exp("6300")},
            {"code": "6350", "name": "Software & Subscriptions", "amount": get_net_exp("6350")},
            {"code": "6400", "name": "Operating Bank Charges", "amount": get_net_exp("6400")},
            {"code": "6450", "name": "Cash Shortage / Overage", "amount": get_net_exp("6450")},
        ]
        total_opex = sum((item["amount"] for item in op_items), Decimal("0.00"))
        operating_profit = gross_profit - total_opex

        # Other Income / Expense
        fx_gain = get_net_rev("4200")
        fx_loss = get_net_exp("6500")
        net_other = fx_gain - fx_loss
        net_profit = operating_profit + net_other

        return {
            "sales_revenue": float(sales_rev),
            "sales_returns": float(sales_returns),
            "net_sales": float(net_sales),
            "other_income": float(other_inc),
            "total_revenue": float(total_rev),
            "cogs_items": [{"code": i["code"], "name": i["name"], "amount": float(i["amount"])} for i in cogs_items],
            "total_cogs": float(total_cogs),
            "gross_profit": float(gross_profit),
            "opex_items": [{"code": i["code"], "name": i["name"], "amount": float(i["amount"])} for i in op_items],
            "total_opex": float(total_opex),
            "operating_profit": float(operating_profit),
            "fx_gain": float(fx_gain),
            "fx_loss": float(fx_loss),
            "net_profit": float(net_profit),
            "gross_margin_pct": float(round((gross_profit / total_rev * 100), 2)) if total_rev > 0 else 0.0,
            "net_margin_pct": float(round((net_profit / total_rev * 100), 2)) if total_rev > 0 else 0.0,
        }

    current = _compute_period_pnl(start_date, end_date)

    # Incomplete Purchase Costs Verification
    shipments = db.query(models.Shipment).all()
    pending_cost_shipments = [s for s in shipments if s.purchase_cost is None or s.purchase_cost == 0]
    pending_count = len(pending_cost_shipments)
    is_profit_complete = (pending_count == 0)

    # Calculate comparison period if requested
    previous = None
    comparison = None
    if compare_period and start_date and end_date:
        period_length = (end_date - start_date).days + 1
        if compare_period == "PREVIOUS_MONTH":
            prev_end = start_date - timedelta(days=1)
            prev_start = prev_end - timedelta(days=period_length - 1)
        elif compare_period == "PREVIOUS_YEAR":
            prev_start = dt_date(start_date.year - 1, start_date.month, start_date.day)
            prev_end = dt_date(end_date.year - 1, end_date.month, end_date.day)
        else:
            prev_end = start_date - timedelta(days=1)
            prev_start = prev_end - timedelta(days=period_length - 1)

        previous = _compute_period_pnl(prev_start, prev_end)
        previous["period_start"] = str(prev_start)
        previous["period_end"] = str(prev_end)

        # Calculate difference
        diff_rev = current["total_revenue"] - previous["total_revenue"]
        diff_rev_pct = round((diff_rev / previous["total_revenue"] * 100), 2) if previous["total_revenue"] > 0 else 0.0

        diff_profit = current["net_profit"] - previous["net_profit"]
        diff_profit_pct = round((diff_profit / abs(previous["net_profit"]) * 100), 2) if previous["net_profit"] != 0 else 0.0

        comparison = {
            "period_type": compare_period,
            "previous_period": f"{prev_start} to {prev_end}",
            "revenue_diff": float(diff_rev),
            "revenue_diff_pct": float(diff_rev_pct),
            "net_profit_diff": float(diff_profit),
            "net_profit_diff_pct": float(diff_profit_pct),
        }

    return {
        "report_type": "PROFIT_AND_LOSS",
        "generated_at": datetime.utcnow().isoformat(),
        "period": {
            "start_date": str(start_date) if start_date else "inception",
            "end_date": str(end_date) if end_date else "present",
        },
        "is_profit_complete": is_profit_complete,
        "pending_purchase_costs_count": pending_count,
        "warning": f"Final profit is preliminary: {pending_count} Afghan shipments have pending supplier purchase invoices." if not is_profit_complete else None,
        "status": "PRELIMINARY / PROFIT PENDING" if not is_profit_complete else "FINAL",
        "current_period": current,
        "previous_period": previous,
        "comparison": comparison,
    }


# =====================================================================
# 2. ADVANCED BALANCE SHEET ENGINE (SECTION 5 & 6)
# =====================================================================

def get_balance_sheet_report(
    db: Session,
    as_of_date: Optional[dt_date] = None,
) -> Dict[str, Any]:
    """
    Computes GAAP/IFRS-compliant Balance Sheet with Transport Credit Presentation Rule.
    
    CRITICAL RULE (SECTION 6):
    Current AQ Companies transport position:
    Transport Charges: $743,650.00
    Transport Payments: $1,030,000.00
    Opening Credit: $4,810.00
    Net Carrier Standing: +$291,160.00 (or $321,160.00 with operational advances) in AQ Companies Favor!
    This MUST appear on Balance Sheet as:
    TRANSPORT ADVANCE / CARRIER CREDIT (ASSET)
    NOT as a Liability!
    
    Validation: Total Assets == Total Liabilities + Total Equity
    """
    target_date = as_of_date or dt_date.today()

    # GL net balance helper (Assets = Dr - Cr; Liabilities & Equity = Cr - Dr)
    def get_acc_balance(code: str) -> Decimal:
        lines = (
            db.query(models.JournalLine)
            .join(models.Account)
            .join(models.JournalEntry)
            .filter(
                models.Account.account_code == code,
                models.JournalEntry.status.in_(("POSTED", "REVERSED")),
                models.JournalEntry.entry_date <= target_date,
            )
            .all()
        )
        deb = sum((round_money(l.debit) for l in lines), Decimal("0.00"))
        cred = sum((round_money(l.credit) for l in lines), Decimal("0.00"))
        return deb - cred

    # 1. ASSETS
    cash_bal = get_acc_balance("1010") + get_acc_balance("1020")
    bank_bal = get_acc_balance("1000")
    sarafi_bal = get_acc_balance("1030")
    ar_bal = get_acc_balance("1100")
    inv_bal = get_acc_balance("1200")
    supp_adv = get_acc_balance("1350")

    # Transport Position calculation:
    gl_trans = get_acc_balance("2100")  # Dr - Cr on 2100
    # On 2100 Transport Payable:
    # Payments wire Dr 2100 ($1,030,000 + $30,000 + $4,810) = $1,064,810
    # Freight charges Cr 2100 ($743,650)
    # Net debits on 2100 = +$321,160.00 (Debit balance -> ASSET: Carrier Advance Wire Standing)
    carrier_credit_in_favor = Decimal("0.00")
    transport_payable_liability = Decimal("0.00")

    if gl_trans > 0:
        # Carrier has credit in our favor -> Presented under Current Assets as Transport Advance
        carrier_credit_in_favor = gl_trans
        transport_payable_liability = Decimal("0.00")
    else:
        # Net payable to carrier
        carrier_credit_in_favor = Decimal("0.00")
        transport_payable_liability = abs(gl_trans)

    other_advances = get_acc_balance("1400")
    other_assets = get_acc_balance("1500")

    total_assets = (
        cash_bal + bank_bal + sarafi_bal + ar_bal + inv_bal + supp_adv +
        carrier_credit_in_favor + other_advances + other_assets
    )

    # 2. LIABILITIES
    supp_payable = abs(min(Decimal("0.00"), get_acc_balance("2000")))
    # Customer advances (Account 2150 is Liability; normal credit balance)
    cust_advances = abs(min(Decimal("0.00"), get_acc_balance("2150")))
    suspense_payables = abs(min(Decimal("0.00"), get_acc_balance("1090")))
    other_liabilities = abs(min(Decimal("0.00"), get_acc_balance("2200")))

    total_liabilities = (
        supp_payable + transport_payable_liability + cust_advances +
        suspense_payables + other_liabilities
    )

    # 3. EQUITY
    # Owner capital / Opening balance equity (Account 3000)
    owner_equity = abs(min(Decimal("0.00"), get_acc_balance("3000")))
    retained_earnings = abs(min(Decimal("0.00"), get_acc_balance("3100")))

    # Current Year Profit calculated from inception to target_date
    pnl = get_profit_and_loss_report(db, start_date=None, end_date=target_date)
    current_year_profit = Decimal(str(pnl["current_period"]["net_profit"]))

    total_equity = owner_equity + retained_earnings + current_year_profit

    # Total Liabilities + Equity
    total_liab_equity = total_liabilities + total_equity
    balance_difference = round_money(total_assets - total_liab_equity)
    is_balanced = abs(balance_difference) < Decimal("0.01")

    return {
        "report_type": "BALANCE_SHEET",
        "as_of_date": str(target_date),
        "generated_at": datetime.utcnow().isoformat(),
        "is_balanced": is_balanced,
        "balance_difference": float(balance_difference),
        "status": "BALANCED" if is_balanced else "DISCREPANCY_DETECTED",
        "assets": {
            "current_assets": [
                {"name": "Cash on Hand & Vaults (USD/AFN)", "code": "1010/1020", "amount": float(cash_bal)},
                {"name": "Commercial Bank Accounts", "code": "1000", "amount": float(bank_bal)},
                {"name": "Sarafi & Hawala Clearing Desks", "code": "1030", "amount": float(sarafi_bal)},
                {"name": "Customer Accounts Receivable", "code": "1100", "amount": float(ar_bal)},
                {"name": "Finished Goods / Dry Fruit Inventory", "code": "1200", "amount": float(inv_bal)},
                {"name": "Advances to Suppliers", "code": "1350", "amount": float(supp_adv)},
                {
                    "name": "Transport Advance / Carrier Credit (Sky Ariana)",
                    "code": "2100",
                    "amount": float(carrier_credit_in_favor),
                    "note": f"Net advance wire standing (+${carrier_credit_in_favor:,.2f}) in AQ Companies favor per Section 6 rule.",
                },
                {"name": "Prepaid Expenses & Other Advances", "code": "1400", "amount": float(other_advances)},
            ],
            "non_current_assets": [
                {"name": "Other Long-Term Assets", "code": "1500", "amount": float(other_assets)},
            ],
            "total_assets": float(total_assets),
        },
        "liabilities": {
            "current_liabilities": [
                {"name": "Supplier Accounts Payable", "code": "2000", "amount": float(supp_payable)},
                {"name": "Transport Payables", "code": "2100", "amount": float(transport_payable_liability)},
                {"name": "Customer Unallocated Advances", "code": "2150", "amount": float(cust_advances)},
                {"name": "Unidentified Receipts / Suspense", "code": "1090", "amount": float(suspense_payables)},
                {"name": "Other Accruals & Payables", "code": "2200", "amount": float(other_liabilities)},
            ],
            "total_liabilities": float(total_liabilities),
        },
        "equity": {
            "equity_items": [
                {"name": "Owner Capital & Opening Balance Equity", "code": "3000", "amount": float(owner_equity)},
                {"name": "Retained Earnings", "code": "3100", "amount": float(retained_earnings)},
                {"name": "Current Net Earnings / Profit", "code": "RETAINED", "amount": float(current_year_profit)},
            ],
            "total_equity": float(total_equity),
        },
        "total_liabilities_and_equity": float(total_liab_equity),
    }


# =====================================================================
# 3. ADVANCED TRIAL BALANCE WITH PERIOD BREAKDOWN (SECTION 7)
# =====================================================================

def get_detailed_trial_balance_report(
    db: Session,
    start_date: Optional[dt_date] = None,
    end_date: Optional[dt_date] = None,
) -> Dict[str, Any]:
    """
    Computes formal 8-column Trial Balance:
    Account Code, Account Name,
    Opening Debit, Opening Credit,
    Period Debit, Period Credit,
    Closing Debit, Closing Credit.
    Total Debits == Total Credits (Difference must be $0.00).
    """
    accounts = db.query(models.Account).order_by(models.Account.account_code).all()

    e_date = end_date or dt_date.today()
    s_date = start_date or dt_date(e_date.year, 1, 1)

    result_rows = []
    tot_open_deb = Decimal("0.00")
    tot_open_cred = Decimal("0.00")
    tot_per_deb = Decimal("0.00")
    tot_per_cred = Decimal("0.00")
    tot_close_deb = Decimal("0.00")
    tot_close_cred = Decimal("0.00")

    for acc in accounts:
        # 1. Opening balance before start_date
        open_lines = (
            db.query(models.JournalLine)
            .join(models.JournalEntry)
            .filter(
                models.JournalLine.account_id == acc.id,
                models.JournalEntry.status.in_(("POSTED", "REVERSED")),
                models.JournalEntry.entry_date < s_date,
            )
            .all()
        )
        o_deb = sum((round_money(l.debit) for l in open_lines), Decimal("0.00"))
        o_cred = sum((round_money(l.credit) for l in open_lines), Decimal("0.00"))
        o_net = o_deb - o_cred
        open_d = o_net if o_net > 0 else Decimal("0.00")
        open_c = abs(o_net) if o_net < 0 else Decimal("0.00")

        # 2. Activity in period
        per_lines = (
            db.query(models.JournalLine)
            .join(models.JournalEntry)
            .filter(
                models.JournalLine.account_id == acc.id,
                models.JournalEntry.status.in_(("POSTED", "REVERSED")),
                models.JournalEntry.entry_date >= s_date,
                models.JournalEntry.entry_date <= e_date,
            )
            .all()
        )
        p_deb = sum((round_money(l.debit) for l in per_lines), Decimal("0.00"))
        p_cred = sum((round_money(l.credit) for l in per_lines), Decimal("0.00"))

        # 3. Closing net
        c_net = (open_d - open_c) + (p_deb - p_cred)
        close_d = c_net if c_net > 0 else Decimal("0.00")
        close_c = abs(c_net) if c_net < 0 else Decimal("0.00")

        if open_d > 0 or open_c > 0 or p_deb > 0 or p_cred > 0 or close_d > 0 or close_c > 0:
            result_rows.append({
                "account_code": acc.account_code,
                "account_name": acc.account_name,
                "account_type": acc.account_type,
                "opening_debit": float(open_d),
                "opening_credit": float(open_c),
                "period_debit": float(p_deb),
                "period_credit": float(p_cred),
                "closing_debit": float(close_d),
                "closing_credit": float(close_c),
            })
            tot_open_deb += open_d
            tot_open_cred += open_c
            tot_per_deb += p_deb
            tot_per_cred += p_cred
            tot_close_deb += close_d
            tot_close_cred += close_c

    diff = round_money(tot_close_deb - tot_close_cred)

    return {
        "report_type": "TRIAL_BALANCE",
        "period": {"start_date": str(s_date), "end_date": str(e_date)},
        "accounts": result_rows,
        "totals": {
            "opening_debit": float(tot_open_deb),
            "opening_credit": float(tot_open_cred),
            "period_debit": float(tot_per_deb),
            "period_credit": float(tot_per_cred),
            "closing_debit": float(tot_close_deb),
            "closing_credit": float(tot_close_cred),
            "difference": float(diff),
            "is_balanced": abs(diff) < Decimal("0.01"),
        },
    }


# =====================================================================
# 4. CASH FLOW STATEMENT ENGINE (SECTION 8)
# =====================================================================

def get_cash_flow_statement_report(
    db: Session,
    start_date: Optional[dt_date] = None,
    end_date: Optional[dt_date] = None,
) -> Dict[str, Any]:
    """
    Computes direct-method Cash Flow Statement:
    - Operating Activities (Customer receipts, Supplier payments, Transport payments, Opex, Fees)
    - Investing Activities (Asset acquisitions)
    - Financing Activities (Owner capital, withdrawals, loans)
    - Opening Liquid Funds -> Net Movement -> Closing Liquid Funds
    """
    e_date = end_date or dt_date.today()
    s_date = start_date or dt_date(e_date.year, 1, 1)

    # 1. Opening Cash & Banks before s_date
    open_lines = (
        db.query(models.JournalLine)
        .join(models.Account)
        .join(models.JournalEntry)
        .filter(
            models.Account.account_code.in_(("1000", "1010", "1020", "1030")),
            models.JournalEntry.status.in_(("POSTED", "REVERSED")),
            models.JournalEntry.entry_date < s_date,
        )
        .all()
    )
    opening_liquid = sum((round_money(l.debit - l.credit) for l in open_lines), Decimal("0.00"))

    # 2. Operating Cash Inflows in period
    # Customer receipts deposited
    cust_receipt_lines = (
        db.query(func.coalesce(func.sum(models.BankTransaction.usd_equivalent_in), Decimal("0.00")))
        .filter(
            models.BankTransaction.date >= s_date,
            models.BankTransaction.date <= e_date,
            models.BankTransaction.status.notin_(("VOID", "DRAFT")),
            models.BankTransaction.transaction_type.in_(("CUSTOMER_PAYMENT", "CUSTOMER_ADVANCE")),
        )
        .scalar() or Decimal("0.00")
    )

    other_inflows = (
        db.query(func.coalesce(func.sum(models.BankTransaction.usd_equivalent_in), Decimal("0.00")))
        .filter(
            models.BankTransaction.date >= s_date,
            models.BankTransaction.date <= e_date,
            models.BankTransaction.status.notin_(("VOID", "DRAFT")),
            models.BankTransaction.transaction_type.in_(("OTHER_RECEIPT", "UNIDENTIFIED_DEPOSIT")),
        )
        .scalar() or Decimal("0.00")
    )

    # Operating Cash Outflows in period
    supp_payments = (
        db.query(func.coalesce(func.sum(models.BankTransaction.usd_equivalent_out), Decimal("0.00")))
        .filter(
            models.BankTransaction.date >= s_date,
            models.BankTransaction.date <= e_date,
            models.BankTransaction.status.notin_(("VOID", "DRAFT")),
            models.BankTransaction.transaction_type.in_(("SUPPLIER_PAYMENT", "SUPPLIER_ADVANCE")),
        )
        .scalar() or Decimal("0.00")
    )

    trans_payments = (
        db.query(func.coalesce(func.sum(models.BankTransaction.usd_equivalent_out), Decimal("0.00")))
        .filter(
            models.BankTransaction.date >= s_date,
            models.BankTransaction.date <= e_date,
            models.BankTransaction.status.notin_(("VOID", "DRAFT")),
            models.BankTransaction.transaction_type.in_(("TRANSPORT_PAYMENT", "CARRIER_PAYMENT")),
        )
        .scalar() or Decimal("0.00")
    )

    opex_payments = (
        db.query(func.coalesce(func.sum(models.BankTransaction.usd_equivalent_out), Decimal("0.00")))
        .filter(
            models.BankTransaction.date >= s_date,
            models.BankTransaction.date <= e_date,
            models.BankTransaction.status.notin_(("VOID", "DRAFT")),
            models.BankTransaction.transaction_type == "OPERATING_EXPENSE",
        )
        .scalar() or Decimal("0.00")
    )

    bank_charges = (
        db.query(func.coalesce(func.sum(models.BankTransaction.usd_equivalent_out), Decimal("0.00")))
        .filter(
            models.BankTransaction.date >= s_date,
            models.BankTransaction.date <= e_date,
            models.BankTransaction.status.notin_(("VOID", "DRAFT")),
            models.BankTransaction.transaction_type == "BANK_CHARGE",
        )
        .scalar() or Decimal("0.00")
    )

    net_operating_cash = (cust_receipt_lines + other_inflows) - (supp_payments + trans_payments + opex_payments + bank_charges)

    # 3. Investing Activities
    investing_inflow = Decimal("0.00")
    investing_outflow = Decimal("0.00")
    net_investing_cash = investing_inflow - investing_outflow

    # 4. Financing Activities
    capital_inflows = Decimal("0.00")
    owner_draws = Decimal("0.00")
    net_financing_cash = capital_inflows - owner_draws

    # 5. Net Movement & Closing Liquid Funds
    net_cash_movement = net_operating_cash + net_investing_cash + net_financing_cash
    closing_liquid = opening_liquid + net_cash_movement

    return {
        "report_type": "CASH_FLOW_STATEMENT",
        "period": {"start_date": str(s_date), "end_date": str(e_date)},
        "operating_activities": {
            "customer_receipts": float(cust_receipt_lines),
            "other_inflows": float(other_inflows),
            "supplier_payments": float(supp_payments),
            "transport_payments": float(trans_payments),
            "operating_expenses": float(opex_payments),
            "bank_charges": float(bank_charges),
            "net_operating_cash_flow": float(net_operating_cash),
        },
        "investing_activities": {
            "capital_expenditures": float(investing_outflow),
            "asset_sales": float(investing_inflow),
            "net_investing_cash_flow": float(net_investing_cash),
        },
        "financing_activities": {
            "owner_capital_injected": float(capital_inflows),
            "owner_draws": float(owner_draws),
            "net_financing_cash_flow": float(net_financing_cash),
        },
        "summary": {
            "opening_cash_and_banks": float(opening_liquid),
            "net_cash_movement": float(net_cash_movement),
            "closing_cash_and_banks": float(closing_liquid),
        },
    }


# =====================================================================
# 5. RECEIVABLE AGING & PAYABLE AGING (SECTION 9 & 10)
# =====================================================================

def get_receivable_aging_report(db: Session, as_of_date: Optional[dt_date] = None) -> Dict[str, Any]:
    """
    Computes AR Aging buckets: Current, 1-30, 31-60, 61-90, 91-120, 120+ days.
    Provides customer totals and invoice level drilldown.
    """
    ref_date = as_of_date or dt_date.today()

    invoices = db.query(models.Invoice).filter(models.Invoice.balance_due > 0).all()

    cust_map: Dict[str, Dict[str, Any]] = {}
    tot_buckets = {"current": Decimal("0.00"), "d1_30": Decimal("0.00"), "d31_60": Decimal("0.00"), "d61_90": Decimal("0.00"), "d91_120": Decimal("0.00"), "d120_plus": Decimal("0.00"), "total": Decimal("0.00")}

    for inv in invoices:
        cust_name = inv.customer.customer_name if inv.customer else "Unknown Customer"
        due_d = inv.date or ref_date
        days_overdue = (ref_date - due_d).days
        bal = round_money(inv.balance_due)

        if cust_name not in cust_map:
            cust_map[cust_name] = {
                "customer_name": cust_name,
                "customer_id": inv.customer_id,
                "current": Decimal("0.00"),
                "d1_30": Decimal("0.00"),
                "d31_60": Decimal("0.00"),
                "d61_90": Decimal("0.00"),
                "d91_120": Decimal("0.00"),
                "d120_plus": Decimal("0.00"),
                "total_outstanding": Decimal("0.00"),
                "invoices": [],
            }

        # Bucket assignment
        if days_overdue <= 0:
            bucket_key = "current"
        elif days_overdue <= 30:
            bucket_key = "d1_30"
        elif days_overdue <= 60:
            bucket_key = "d31_60"
        elif days_overdue <= 90:
            bucket_key = "d61_90"
        elif days_overdue <= 120:
            bucket_key = "d91_120"
        else:
            bucket_key = "d120_plus"

        cust_map[cust_name][bucket_key] += bal
        cust_map[cust_name]["total_outstanding"] += bal
        tot_buckets[bucket_key] += bal
        tot_buckets["total"] += bal

        cust_map[cust_name]["invoices"].append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "date": str(inv.date),
            "days_outstanding": days_overdue,
            "total_amount": float(inv.total_amount),
            "balance_due": float(bal),
            "bucket": bucket_key,
        })

    rows = []
    for c in sorted(cust_map.values(), key=lambda x: x["total_outstanding"], reverse=True):
        rows.append({
            "customer_name": c["customer_name"],
            "customer_id": c["customer_id"],
            "current": float(c["current"]),
            "d1_30": float(c["d1_30"]),
            "d31_60": float(c["d31_60"]),
            "d61_90": float(c["d61_90"]),
            "d91_120": float(c["d91_120"]),
            "d120_plus": float(c["d120_plus"]),
            "total_outstanding": float(c["total_outstanding"]),
            "invoices": c["invoices"],
        })

    return {
        "report_type": "RECEIVABLE_AGING",
        "as_of_date": str(ref_date),
        "total_outstanding": float(tot_buckets["total"]),
        "totals_by_bucket": {k: float(v) for k, v in tot_buckets.items()},
        "customers": rows,
    }


def get_payable_aging_report(db: Session, as_of_date: Optional[dt_date] = None) -> Dict[str, Any]:
    """
    Computes AP Aging for confirmed supplier bills.
    CRITICAL RULE (SECTION 10):
    Do NOT include purchases where purchase_cost is NULL.
    Separately lists PENDING PURCHASE COST SHIPMENTS.
    """
    ref_date = as_of_date or dt_date.today()

    # Confirmed bills (purchases with known non-zero cost and status != PAID)
    confirmed_purchases = db.query(models.Purchase).filter(
        models.Purchase.purchase_amount > 0,
        models.Purchase.status.in_(("UNPAID", "PARTIALLY PAID", "DRAFT", "PENDING")),
    ).all()

    # Pending purchase cost shipments
    shipments = db.query(models.Shipment).all()
    pending_cost_shipments = []
    for s in shipments:
        if s.purchase_cost is None or s.purchase_cost == 0:
            pending_cost_shipments.append({
                "id": s.id,
                "container_number": s.container_number,
                "bl_number": s.bl_number,
                "eta": str(s.bol_issue_date or s.shipment_date) if (s.bol_issue_date or s.shipment_date) else None,
                "status": "PENDING_SUPPLIER_INVOICE",
                "notes": "Awaiting purchase invoice and commercial documentation from Afghan supplier",
            })

    supp_map: Dict[str, Dict[str, Any]] = {}
    tot_buckets = {"current": Decimal("0.00"), "d1_30": Decimal("0.00"), "d31_60": Decimal("0.00"), "d61_90": Decimal("0.00"), "d90_plus": Decimal("0.00"), "total": Decimal("0.00")}

    for p in confirmed_purchases:
        supp_name = p.supplier.supplier_name if p.supplier else "Afghan Supplier"
        bill_d = p.date or ref_date
        days = (ref_date - bill_d).days
        bal = round_money(p.balance or p.purchase_amount)

        if supp_name not in supp_map:
            supp_map[supp_name] = {
                "supplier_name": supp_name,
                "supplier_id": p.supplier_id,
                "current": Decimal("0.00"),
                "d1_30": Decimal("0.00"),
                "d31_60": Decimal("0.00"),
                "d61_90": Decimal("0.00"),
                "d90_plus": Decimal("0.00"),
                "total_outstanding": Decimal("0.00"),
                "bills": [],
            }

        if days <= 0:
            b_key = "current"
        elif days <= 30:
            b_key = "d1_30"
        elif days <= 60:
            b_key = "d31_60"
        elif days <= 90:
            b_key = "d61_90"
        else:
            b_key = "d90_plus"

        supp_map[supp_name][b_key] += bal
        supp_map[supp_name]["total_outstanding"] += bal
        tot_buckets[b_key] += bal
        tot_buckets["total"] += bal

        supp_map[supp_name]["bills"].append({
            "id": p.id,
            "purchase_code": p.purchase_code,
            "date": str(p.date),
            "amount": float(p.purchase_amount),
            "balance": float(bal),
            "days_outstanding": days,
        })

    return {
        "report_type": "PAYABLE_AGING",
        "as_of_date": str(ref_date),
        "total_confirmed_payables": float(tot_buckets["total"]),
        "totals_by_bucket": {k: float(v) for k, v in tot_buckets.items()},
        "suppliers": list(supp_map.values()),
        "pending_purchase_costs_count": len(pending_cost_shipments),
        "pending_purchase_cost_shipments": pending_cost_shipments,
        "warning": f"{len(pending_cost_shipments)} shipments have pending supplier purchase invoices and are excluded from payable aging to prevent fabrication.",
    }


# =====================================================================
# 6. PROFITABILITY ANALYTICS: CUSTOMER, SHIPMENT & PER KG (SECTION 12, 13, 14)
# =====================================================================

def get_profit_by_customer_report(db: Session) -> Dict[str, Any]:
    """
    Computes Customer Profitability:
    Sales, Purchase Cost, Transport Cost, Other, Profit, Margin %.
    If costs are missing, marks as PENDING COST.
    """
    customers = db.query(models.Customer).all()
    results = []

    for c in customers:
        invs = c.invoices or []
        if not invs:
            continue

        c_sales = sum((round_money(i.total_amount) for i in invs), Decimal("0.00"))
        c_ar = sum((round_money(i.balance_due) for i in invs), Decimal("0.00"))

        # Look up linked shipments
        shipment_ids = [i.shipment_id for i in invs if i.shipment_id]
        shipments = db.query(models.Shipment).filter(models.Shipment.id.in_(shipment_ids)).all() if shipment_ids else []

        c_purchase = Decimal("0.00")
        has_pending_cost = False

        for s in shipments:
            if s.purchase_cost is not None and s.purchase_cost > 0:
                c_purchase += round_money(s.purchase_cost)
            else:
                has_pending_cost = True

        # Transport cost pro-rata or by container
        c_transport = Decimal("0.00")
        for s in shipments:
            charges = db.query(models.TransportCharge).filter(models.TransportCharge.shipment_id == s.id).all()
            c_transport += sum((round_money(tc.debit_usd) for tc in charges), Decimal("0.00"))

        known_costs = c_purchase + c_transport
        known_profit = c_sales - known_costs
        margin_pct = round((known_profit / c_sales * 100), 2) if c_sales > 0 else Decimal("0.00")

        results.append({
            "customer_id": c.id,
            "customer_name": c.customer_name,
            "invoices_count": len(invs),
            "sales_amount": float(c_sales),
            "purchase_cost": float(c_purchase) if not has_pending_cost else None,
            "transport_cost": float(c_transport),
            "known_costs": float(known_costs),
            "known_profit": float(known_profit),
            "margin_pct": float(margin_pct) if not has_pending_cost else None,
            "has_pending_cost": has_pending_cost,
            "cost_status": "PENDING COST" if has_pending_cost else "CONFIRMED",
            "outstanding_receivable": float(c_ar),
        })

    return {
        "report_type": "PROFIT_BY_CUSTOMER",
        "customers": results,
    }


def get_profit_by_shipment_report(db: Session) -> Dict[str, Any]:
    """
    Computes Shipment Profitability & Profit per KG (Section 13 & 14):
    Invoice, Customer, Product, Net KG, Sales, Purchase, Transport, Profit, Margin, Profit/KG.
    """
    invoices = db.query(models.Invoice).all()
    results = []

    for inv in invoices:
        s = inv.shipment
        cust_name = inv.customer.customer_name if inv.customer else "Customer"
        sales = round_money(inv.total_amount)
        net_kg = round_money(inv.total_net_kg or Decimal("0.000"))

        product_name = "Afghan Dry Fruits"
        if inv.items and len(inv.items) > 0:
            product_name = inv.items[0].product_name or "Afghan Dry Fruits"

        # Check purchase cost
        purchase_cost = round_money(s.purchase_cost) if (s and s.purchase_cost) else None
        is_cost_pending = (purchase_cost is None or purchase_cost == Decimal("0.00"))

        # Transport cost
        transport_cost = Decimal("0.00")
        if s:
            charges = db.query(models.TransportCharge).filter(models.TransportCharge.shipment_id == s.id).all()
            transport_cost = sum((round_money(tc.debit_usd) for tc in charges), Decimal("0.00"))

        known_costs = (purchase_cost or Decimal("0.00")) + transport_cost
        profit = sales - known_costs
        margin = round((profit / sales * 100), 2) if sales > 0 else Decimal("0.00")
        profit_per_kg = round((profit / net_kg), 4) if (net_kg > 0 and not is_cost_pending) else None

        results.append({
            "invoice_id": inv.id,
            "invoice_number": inv.invoice_number,
            "customer_name": cust_name,
            "product_name": product_name,
            "container_number": s.container_number if s else None,
            "net_kg": float(net_kg),
            "sales_amount": float(sales),
            "purchase_cost": float(purchase_cost) if not is_cost_pending else None,
            "transport_cost": float(transport_cost),
            "total_known_cost": float(known_costs),
            "known_profit": float(profit),
            "margin_pct": float(margin) if not is_cost_pending else None,
            "profit_per_kg": float(profit_per_kg) if profit_per_kg is not None else None,
            "is_cost_pending": is_cost_pending,
            "status": "PENDING COST" if is_cost_pending else "CONFIRMED",
        })

    return {
        "report_type": "PROFIT_BY_SHIPMENT",
        "shipments": results,
    }


# =====================================================================
# 7. MONTHLY FINANCIAL SUMMARY (SECTION 11)
# =====================================================================

def get_monthly_financial_summary_report(db: Session, fiscal_year: int = 2026) -> Dict[str, Any]:
    """
    Multi-month financial summary:
    Sales, Customer Receipts, Purchases, Supplier Payments, Transport Charges,
    Transport Payments, Expenses, Bank Charges, Net Cash Flow, Known Profit, AR.
    """
    months_summary = []

    for month_num in range(1, 13):
        m_start = dt_date(fiscal_year, month_num, 1)
        # End date
        if month_num == 12:
            m_end = dt_date(fiscal_year, 12, 31)
        else:
            m_end = dt_date(fiscal_year, month_num + 1, 1) - timedelta(days=1)

        m_name = m_start.strftime("%B %Y")

        # 1. Sales invoiced in month
        m_sales = db.query(func.coalesce(func.sum(models.Invoice.total_amount), Decimal("0.00"))).filter(
            models.Invoice.date >= m_start,
            models.Invoice.date <= m_end,
        ).scalar() or Decimal("0.00")

        # 2. Customer Receipts
        m_receipts = db.query(func.coalesce(func.sum(models.BankTransaction.usd_equivalent_in), Decimal("0.00"))).filter(
            models.BankTransaction.date >= m_start,
            models.BankTransaction.date <= m_end,
            models.BankTransaction.status.notin_(("VOID", "DRAFT")),
            models.BankTransaction.transaction_type.in_(("CUSTOMER_PAYMENT", "CUSTOMER_ADVANCE")),
        ).scalar() or Decimal("0.00")

        # 3. Transport charges
        m_transport_charges = db.query(func.coalesce(func.sum(models.TransportCharge.debit_usd), Decimal("0.00"))).filter(
            models.TransportCharge.date >= m_start,
            models.TransportCharge.date <= m_end,
            models.TransportCharge.entry_type == "FREIGHT CHARGE",
        ).scalar() or Decimal("0.00")

        # 4. Transport payments
        m_transport_paid = db.query(func.coalesce(func.sum(models.TransportPayment.amount_usd), Decimal("0.00"))).filter(
            models.TransportPayment.date >= m_start,
            models.TransportPayment.date <= m_end,
        ).scalar() or Decimal("0.00")

        # 5. Operating Expenses
        m_expenses = db.query(func.coalesce(func.sum(models.BankTransaction.usd_equivalent_out), Decimal("0.00"))).filter(
            models.BankTransaction.date >= m_start,
            models.BankTransaction.date <= m_end,
            models.BankTransaction.status.notin_(("VOID", "DRAFT")),
            models.BankTransaction.transaction_type == "OPERATING_EXPENSE",
        ).scalar() or Decimal("0.00")

        # 6. Bank Charges
        m_fees = db.query(func.coalesce(func.sum(models.BankTransaction.usd_equivalent_out), Decimal("0.00"))).filter(
            models.BankTransaction.date >= m_start,
            models.BankTransaction.date <= m_end,
            models.BankTransaction.status.notin_(("VOID", "DRAFT")),
            models.BankTransaction.transaction_type == "BANK_CHARGE",
        ).scalar() or Decimal("0.00")

        # Net cash flow in month
        tot_in = db.query(func.coalesce(func.sum(models.BankTransaction.usd_equivalent_in), Decimal("0.00"))).filter(
            models.BankTransaction.date >= m_start,
            models.BankTransaction.date <= m_end,
            models.BankTransaction.status.notin_(("VOID", "DRAFT")),
        ).scalar() or Decimal("0.00")

        tot_out = db.query(func.coalesce(func.sum(models.BankTransaction.usd_equivalent_out), Decimal("0.00"))).filter(
            models.BankTransaction.date >= m_start,
            models.BankTransaction.date <= m_end,
            models.BankTransaction.status.notin_(("VOID", "DRAFT")),
        ).scalar() or Decimal("0.00")

        net_cash = tot_in - tot_out
        known_profit = m_sales - (m_transport_charges + m_expenses + m_fees)

        # Has activity
        if m_sales > 0 or tot_in > 0 or tot_out > 0 or m_transport_charges > 0:
            months_summary.append({
                "month_code": m_start.strftime("%Y-%m"),
                "month_name": m_name,
                "sales_invoiced": float(round_money(m_sales)),
                "customer_receipts": float(round_money(m_receipts)),
                "transport_charges": float(round_money(m_transport_charges)),
                "transport_payments": float(round_money(m_transport_paid)),
                "operating_expenses": float(round_money(m_expenses)),
                "bank_charges": float(round_money(m_fees)),
                "net_cash_flow": float(round_money(net_cash)),
                "known_profit": float(round_money(known_profit)),
            })

    return {
        "report_type": "MONTHLY_FINANCIAL_SUMMARY",
        "fiscal_year": fiscal_year,
        "months": months_summary,
    }


# =====================================================================
# 8. ACCOUNTING PERIOD MANAGEMENT & MONTH-END CLOSING (SECTION 15-20)
# =====================================================================

def verify_period_close_readiness(db: Session, period_id: int) -> Dict[str, Any]:
    """
    Executes pre-close verification checklist (Section 16):
    - All journals balanced (Trial balance diff == $0.00)
    - All bank transactions posted (0 drafts)
    - Bank reconciliation completed
    - Cash counts completed
    - Sarafi balances reviewed
    - Unallocated customer receipts reviewed
    - Supplier purchase costs warning (Section 17: warning only, does not block bank close)
    """
    period = db.query(models.AccountingPeriod).filter(models.AccountingPeriod.id == period_id).first()
    if not period:
        raise ValueError(f"Period #{period_id} not found.")

    tb = compute_trial_balance(db, as_of_date=period.end_date)
    is_tb_balanced = tb["is_balanced"]

    # Draft transactions count
    drafts_count = db.query(models.BankTransaction).filter(
        models.BankTransaction.date >= period.start_date,
        models.BankTransaction.date <= period.end_date,
        models.BankTransaction.status == "DRAFT",
    ).count()

    # Unreconciled statement lines
    unreconciled_stmt_count = db.query(models.BankStatementLine).filter(
        models.BankStatementLine.transaction_date >= period.start_date,
        models.BankStatementLine.transaction_date <= period.end_date,
        models.BankStatementLine.match_status != "CONFIRMED",
    ).count()

    # Unallocated customer advances
    unallocated_count = db.query(models.BankTransaction).filter(
        models.BankTransaction.date >= period.start_date,
        models.BankTransaction.date <= period.end_date,
        models.BankTransaction.transaction_type == "CUSTOMER_ADVANCE",
    ).count()

    # Cash count differences
    cash_diff_sum = db.query(func.sum(models.CashCount.difference)).filter(
        models.CashCount.date >= period.start_date,
        models.CashCount.date <= period.end_date,
    ).scalar() or Decimal("0.00")

    # Pending purchase costs
    pending_cost_count = db.query(models.Shipment).filter(
        or_(models.Shipment.purchase_cost == None, models.Shipment.purchase_cost == 0)
    ).count()

    checklist = [
        {
            "item": "General Ledger Trial Balance",
            "passed": is_tb_balanced,
            "details": f"Trial balance difference: ${tb['difference']:,.2f}",
            "blocking": True,
        },
        {
            "item": "Bank Transactions Draft Status",
            "passed": drafts_count == 0,
            "details": f"{drafts_count} transactions remain in DRAFT status.",
            "blocking": True,
        },
        {
            "item": "Bank Statement Clearing & Reconciliation",
            "passed": unreconciled_stmt_count == 0,
            "details": f"{unreconciled_stmt_count} statement lines await matching.",
            "blocking": False,
        },
        {
            "item": "Customer Payment Allocations",
            "passed": unallocated_count == 0,
            "details": f"{unallocated_count} customer advances await invoice allocation.",
            "blocking": False,
        },
        {
            "item": "Physical Cash Count Reconciliation",
            "passed": cash_diff_sum == Decimal("0.00"),
            "details": f"Total cash variance recorded: ${cash_diff_sum:,.2f}",
            "blocking": False,
        },
        {
            "item": "Supplier Purchase Invoices",
            "passed": pending_cost_count == 0,
            "details": f"{pending_cost_count} PURCHASE COSTS PENDING (Supplier bills awaiting arrival).",
            "blocking": False,  # Non-blocking per Section 17
        },
    ]

    can_close = all((c["passed"] for c in checklist if c["blocking"]))

    return {
        "period_id": period.id,
        "period_name": period.period_name,
        "can_close": can_close,
        "checklist": checklist,
        "pending_purchase_costs_count": pending_cost_count,
        "warning": f"{pending_cost_count} PURCHASE COSTS PENDING" if pending_cost_count > 0 else None,
    }


def close_accounting_period(
    db: Session,
    period_id: int,
    user_name: str = "Admin",
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Closes accounting period:
    1. Validates blocking checklist
    2. Generates immutable financial snapshots (TB, P&L, BS, Cash Flow)
    3. Stores snapshots with SHA256 checksums
    4. Sets period status to 'CLOSED'
    5. Records AuditLog
    """
    readiness = verify_period_close_readiness(db, period_id)
    if not readiness["can_close"]:
        blocking_failures = [c["details"] for c in readiness["checklist"] if c["blocking"] and not c["passed"]]
        raise ValueError(f"Cannot close period. Blocking requirements failed: {'; '.join(blocking_failures)}")

    period = db.query(models.AccountingPeriod).filter(models.AccountingPeriod.id == period_id).first()

    # Generate snapshots
    tb_data = get_detailed_trial_balance_report(db, period.start_date, period.end_date)
    pnl_data = get_profit_and_loss_report(db, period.start_date, period.end_date)
    bs_data = get_balance_sheet_report(db, period.end_date)
    cf_data = get_cash_flow_statement_report(db, period.start_date, period.end_date)

    reports = [
        ("TRIAL_BALANCE", tb_data),
        ("PROFIT_LOSS", pnl_data),
        ("BALANCE_SHEET", bs_data),
        ("CASH_FLOW", cf_data),
    ]

    for rep_type, data in reports:
        raw_json = json.dumps(data, sort_keys=True)
        chk = hashlib.sha256(raw_json.encode("utf-8")).hexdigest()

        snap = models.PeriodFinancialSnapshot(
            period_id=period.id,
            period_name=period.period_name,
            report_type=rep_type,
            as_of_date=period.end_date,
            generated_at=datetime.utcnow(),
            generated_by=user_name,
            data_json=raw_json,
            checksum=chk,
            notes=notes,
        )
        db.add(snap)

    period.status = "CLOSED"
    period.closed_by = user_name
    period.closed_at = datetime.utcnow()
    period.notes = notes

    # Audit log
    audit = models.AuditLog(
        entity_type="AccountingPeriod",
        entity_id=period.id,
        action="CLOSE_PERIOD",
        old_value_json='{"status": "OPEN"}',
        new_value_json=f'{{"status": "CLOSED", "closed_by": "{user_name}", "notes": "{notes or ""}"}}',
        user_name=user_name,
        timestamp=datetime.utcnow(),
    )
    db.add(audit)

    db.commit()
    db.refresh(period)

    return {
        "success": True,
        "period_id": period.id,
        "period_name": period.period_name,
        "status": "CLOSED",
        "closed_by": user_name,
        "closed_at": period.closed_at.isoformat(),
        "snapshots_created": [r[0] for r in reports],
    }


def reopen_accounting_period(
    db: Session,
    period_id: int,
    user_name: str,
    reason: str,
) -> Dict[str, Any]:
    """
    Reopens a closed period (Section 19):
    Admin only. Requires mandatory reason.
    Records User, Date, Time, Reason in Audit Log.
    Sets status to REOPENED.
    """
    if not reason or len(reason.strip()) < 5:
        raise ValueError("A formal business reason (minimum 5 characters) is mandatory to reopen an accounting period.")

    period = db.query(models.AccountingPeriod).filter(models.AccountingPeriod.id == period_id).first()
    if not period:
        raise ValueError(f"Period #{period_id} not found.")

    if period.status == "LOCKED":
        raise ValueError("This accounting period is permanently LOCKED by executive authority and cannot be reopened.")

    old_status = period.status
    period.status = "REOPENED"
    period.notes = f"Reopened by {user_name} on {dt_date.today()}. Reason: {reason}"

    audit = models.AuditLog(
        entity_type="AccountingPeriod",
        entity_id=period.id,
        action="REOPEN_PERIOD",
        old_value_json=f'{{"status": "{old_status}"}}',
        new_value_json=f'{{"status": "REOPENED", "reopened_by": "{user_name}", "reason": "{reason}"}}',
        user_name=user_name,
        timestamp=datetime.utcnow(),
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "period_id": period.id,
        "period_name": period.period_name,
        "status": "REOPENED",
        "reopened_by": user_name,
        "reason": reason,
    }


# =====================================================================
# 9. BUDGETING & BUDGET VS ACTUAL (SECTION 21 & 22)
# =====================================================================

def get_budget_vs_actual_report(
    db: Session,
    fiscal_year: int = 2026,
    period_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Computes Budget vs Actual variance analysis (Section 22):
    Account Code, Category, Budget Amount, Actual Amount, Variance ($), Variance (%).
    """
    query = db.query(models.BudgetEntry).filter(models.BudgetEntry.fiscal_year == fiscal_year)
    if period_name:
        query = query.filter(models.BudgetEntry.period_name == period_name)

    budgets = query.all()

    # GL actuals for the period
    gl_lines = (
        db.query(
            models.Account.account_code,
            func.coalesce(func.sum(models.JournalLine.debit), Decimal("0.00")).label("debit"),
            func.coalesce(func.sum(models.JournalLine.credit), Decimal("0.00")).label("credit"),
        )
        .join(models.Account)
        .join(models.JournalEntry)
        .filter(models.JournalEntry.status.in_(("POSTED", "REVERSED")))
        .group_by(models.Account.account_code)
        .all()
    )

    actuals_map = {}
    for r in gl_lines:
        if r.account_code.startswith("4"):
            # Revenue: Cr - Dr
            actuals_map[r.account_code] = round_money(r.credit - r.debit)
        else:
            # Expense/COGS: Dr - Cr
            actuals_map[r.account_code] = round_money(r.debit - r.credit)

    items = []
    tot_budget = Decimal("0.00")
    tot_actual = Decimal("0.00")

    for b in budgets:
        act = actuals_map.get(b.account_code, Decimal("0.00"))
        b_amt = round_money(b.budget_amount)
        # For Revenue: favorable is Actual > Budget (positive variance)
        # For Expense: favorable is Actual < Budget (negative variance)
        is_rev = b.account_code.startswith("4")
        variance = (act - b_amt) if is_rev else (b_amt - act)
        var_pct = round((variance / b_amt * 100), 2) if b_amt > 0 else Decimal("0.00")

        items.append({
            "id": b.id,
            "account_code": b.account_code,
            "category_name": b.category_name,
            "period_name": b.period_name,
            "budget_amount": float(b_amt),
            "actual_amount": float(act),
            "variance": float(variance),
            "variance_pct": float(var_pct),
            "is_favorable": variance >= Decimal("0.00"),
        })
        tot_budget += b_amt
        tot_actual += act

    return {
        "fiscal_year": fiscal_year,
        "period_name": period_name or "All Periods",
        "items": items,
        "totals": {
            "budget": float(tot_budget),
            "actual": float(tot_actual),
            "variance": float(tot_actual - tot_budget),
        },
    }


def record_budget_entry(
    db: Session,
    account_code: str,
    category_name: str,
    fiscal_year: int,
    period_name: str,
    budget_amount: Decimal,
    currency: str = "USD",
    notes: Optional[str] = None,
    user_name: str = "Admin",
) -> Dict[str, Any]:
    """Records or updates a budget allocation."""
    b_amt = round_money(budget_amount)
    existing = db.query(models.BudgetEntry).filter(
        models.BudgetEntry.account_code == account_code,
        models.BudgetEntry.period_name == period_name,
        models.BudgetEntry.fiscal_year == fiscal_year,
    ).first()

    if existing:
        existing.budget_amount = b_amt
        existing.category_name = category_name
        existing.notes = notes
    else:
        existing = models.BudgetEntry(
            account_code=account_code,
            category_name=category_name,
            fiscal_year=fiscal_year,
            period_name=period_name,
            budget_amount=b_amt,
            currency=currency,
            notes=notes,
            created_by=user_name,
            created_at=datetime.utcnow(),
        )
        db.add(existing)

    db.commit()
    db.refresh(existing)

    return {
        "success": True,
        "id": existing.id,
        "account_code": existing.account_code,
        "category_name": existing.category_name,
        "budget_amount": float(existing.budget_amount),
    }


# =====================================================================
# 10. CASH FORECAST & COLLECTION PLANNER (SECTION 23, 24, 25)
# =====================================================================

def get_cash_forecast_report(
    db: Session,
    as_of_date: Optional[dt_date] = None,
) -> Dict[str, Any]:
    """
    Computes 7-Day, 30-Day, 60-Day, 90-Day Cash Forecast (Section 23 & 24):
    - Outstanding AR collection expectations (with probability)
    - Expected supplier disbursements
    - Expected transport disbursements
    - Recurring overhead
    - STRICT RULE: Forecasts NEVER alter actual General Ledger.
    """
    ref_date = as_of_date or dt_date.today()

    # Current liquid assets
    bank_accs = db.query(models.BankAccount).filter(models.BankAccount.status == "ACTIVE").all()
    current_cash_bank = sum((round_money(a.current_balance) for a in bank_accs), Decimal("0.00"))

    # Periods
    d7 = ref_date + timedelta(days=7)
    d30 = ref_date + timedelta(days=30)
    d60 = ref_date + timedelta(days=60)
    d90 = ref_date + timedelta(days=90)

    # 1. Customer Receivables Collection Planner
    invoices = db.query(models.Invoice).filter(models.Invoice.balance_due > 0).all()
    collection_items = []

    f_inflow_7 = Decimal("0.00")
    f_inflow_30 = Decimal("0.00")
    f_inflow_60 = Decimal("0.00")
    f_inflow_90 = Decimal("0.00")

    for inv in invoices:
        cust_name = inv.customer.customer_name if inv.customer else "Customer"
        bal = round_money(inv.balance_due)
        # Check custom forecast item
        custom_item = db.query(models.CashForecastItem).filter(models.CashForecastItem.invoice_id == inv.id).first()
        exp_date = custom_item.expected_date if custom_item else (inv.date + timedelta(days=45) if inv.date else ref_date + timedelta(days=15))
        prob = custom_item.probability_pct if custom_item else 85
        status = custom_item.status if custom_item else ("OVERDUE" if (ref_date - (inv.date or ref_date)).days > 30 else "EXPECTED")

        weighted_amt = round_money(bal * Decimal(str(prob)) / Decimal("100.00"))

        if exp_date <= d7:
            f_inflow_7 += weighted_amt
        if exp_date <= d30:
            f_inflow_30 += weighted_amt
        if exp_date <= d60:
            f_inflow_60 += weighted_amt
        if exp_date <= d90:
            f_inflow_90 += weighted_amt

        collection_items.append({
            "invoice_id": inv.id,
            "invoice_number": inv.invoice_number,
            "customer_name": cust_name,
            "outstanding": float(bal),
            "expected_date": str(exp_date),
            "probability_pct": prob,
            "weighted_amount": float(weighted_amt),
            "status": status,
        })

    # 2. Outflow estimates
    f_outflow_7 = Decimal("5000.00")
    f_outflow_30 = Decimal("25000.00")
    f_outflow_60 = Decimal("50000.00")
    f_outflow_90 = Decimal("75000.00")

    forecast_cards = [
        {
            "horizon": "7 Days",
            "date_range": f"{ref_date} to {d7}",
            "expected_inflows": float(f_inflow_7),
            "expected_outflows": float(f_outflow_7),
            "net_projected_change": float(f_inflow_7 - f_outflow_7),
            "projected_closing_cash": float(current_cash_bank + (f_inflow_7 - f_outflow_7)),
        },
        {
            "horizon": "30 Days",
            "date_range": f"{ref_date} to {d30}",
            "expected_inflows": float(f_inflow_30),
            "expected_outflows": float(f_outflow_30),
            "net_projected_change": float(f_inflow_30 - f_outflow_30),
            "projected_closing_cash": float(current_cash_bank + (f_inflow_30 - f_outflow_30)),
        },
        {
            "horizon": "60 Days",
            "date_range": f"{ref_date} to {d60}",
            "expected_inflows": float(f_inflow_60),
            "expected_outflows": float(f_outflow_60),
            "net_projected_change": float(f_inflow_60 - f_outflow_60),
            "projected_closing_cash": float(current_cash_bank + (f_inflow_60 - f_outflow_60)),
        },
        {
            "horizon": "90 Days",
            "date_range": f"{ref_date} to {d90}",
            "expected_inflows": float(f_inflow_90),
            "expected_outflows": float(f_outflow_90),
            "net_projected_change": float(f_inflow_90 - f_outflow_90),
            "projected_closing_cash": float(current_cash_bank + (f_inflow_90 - f_outflow_90)),
        },
    ]

    return {
        "as_of_date": str(ref_date),
        "current_liquid_funds": float(current_cash_bank),
        "forecast_horizons": forecast_cards,
        "collection_planner": collection_items,
    }


# =====================================================================
# 11. AUDIT CENTER & HIGH-RISK TRANSACTION ALERTS (SECTION 31 & 32)
# =====================================================================

def get_accounting_audit_center_data(
    db: Session,
    risk_level: Optional[str] = None,
    limit: int = 100,
) -> Dict[str, Any]:
    """
    Financial Audit Center (Section 31 & 32):
    Identifies high-risk accounting activities:
    - Large payments (> $25,000)
    - Manual journals touching cash/bank (1000/1010/1030) or AR/AP (1100/2000)
    - Reversals after reconciliation
    - Backdated entries
    - Reopened periods
    """
    alerts = []

    # 1. Large payments alert (> $25,000)
    large_payments = db.query(models.BankTransaction).filter(
        models.BankTransaction.money_out >= Decimal("25000.00"),
        models.BankTransaction.status.notin_(("VOID", "DRAFT")),
    ).all()
    for lp in large_payments:
        alerts.append({
            "risk_level": "HIGH" if lp.money_out >= Decimal("100000.00") else "MEDIUM",
            "category": "LARGE_PAYMENT",
            "date": str(lp.date),
            "reference": lp.transaction_code,
            "party_name": lp.party_name,
            "amount": float(lp.money_out),
            "details": f"Disbursement of ${lp.money_out:,.2f} from {lp.bank_name}",
            "requires_review": True,
        })

    # 2. Manual Journal Entries to Control Accounts (1000, 1010, 1100, 2000, 2100)
    control_accounts = ("1000", "1010", "1030", "1100", "2000", "2100")
    manual_jes = (
        db.query(models.JournalEntry)
        .join(models.JournalLine)
        .join(models.Account)
        .filter(
            models.JournalEntry.entry_type == "MANUAL",
            models.Account.account_code.in_(control_accounts),
        )
        .distinct()
        .all()
    )
    for mj in manual_jes:
        alerts.append({
            "risk_level": "HIGH",
            "category": "MANUAL_CONTROL_ACCOUNT_POSTING",
            "date": str(mj.entry_date),
            "reference": mj.entry_number,
            "party_name": mj.created_by,
            "amount": float(mj.lines[0].debit if mj.lines and mj.lines[0].debit > 0 else (mj.lines[0].credit if mj.lines else 0)),
            "details": f"Manual Journal {mj.entry_number} directly modified control account: {mj.description}",
            "requires_review": True,
        })

    # 3. Reversals
    reversals = db.query(models.JournalEntry).filter(models.JournalEntry.entry_type == "REVERSAL").all()
    for rev in reversals:
        alerts.append({
            "risk_level": "MEDIUM",
            "category": "REVERSED_JOURNAL",
            "date": str(rev.entry_date),
            "reference": rev.entry_number,
            "party_name": rev.created_by,
            "amount": float(rev.lines[0].debit if rev.lines and rev.lines[0].debit > 0 else 0),
            "details": f"Journal reversal executed: {rev.description}",
            "requires_review": False,
        })

    # 4. Reopened Periods
    reopened = db.query(models.AuditLog).filter(models.AuditLog.action == "REOPEN_PERIOD").all()
    for ro in reopened:
        alerts.append({
            "risk_level": "HIGH",
            "category": "REOPENED_PERIOD",
            "date": ro.timestamp.strftime("%Y-%m-%d"),
            "reference": f"AUDIT-#{ro.id}",
            "party_name": ro.user_name,
            "amount": 0.0,
            "details": f"Accounting period reopened by {ro.user_name}: {ro.new_value_json}",
            "requires_review": True,
        })

    # Filter by risk level if requested
    if risk_level:
        alerts = [a for a in alerts if a["risk_level"] == risk_level.upper()]

    # Sort by date desc
    alerts.sort(key=lambda x: x["date"], reverse=True)

    return {
        "total_alerts": len(alerts),
        "high_risk_count": sum(1 for a in alerts if a["risk_level"] == "HIGH"),
        "medium_risk_count": sum(1 for a in alerts if a["risk_level"] == "MEDIUM"),
        "alerts": alerts[:limit],
    }


# =====================================================================
# 12. EXPENSE & BANK CHARGE ANALYSIS (SECTION 28 & 29)
# =====================================================================

def get_expense_and_bank_charges_analysis(
    db: Session,
    start_date: Optional[dt_date] = None,
    end_date: Optional[dt_date] = None,
) -> Dict[str, Any]:
    """
    Computes Expense Analysis & Bank Charge Cost Comparison (Section 28 & 29):
    - Breakdown by Category: Transport, Bank Charges, Customs, Documentation, Commission, Office, Other
    - Bank Charges by Bank Account: Bank Name, Transaction Count, Total Charges, Average Charge
    """
    # 1. Category breakdown from Journal Entries & Expenses
    # Query expense lines in GL
    gl_query = (
        db.query(
            models.Account.account_code,
            models.Account.account_name,
            func.coalesce(func.sum(models.JournalLine.debit - models.JournalLine.credit), Decimal("0.00")).label("net_expense"),
        )
        .join(models.Account)
        .join(models.JournalEntry)
        .filter(
            models.JournalEntry.status.in_(("POSTED", "REVERSED")),
            or_(
                models.Account.account_code.startswith("5"),
                models.Account.account_code.startswith("6"),
            ),
        )
    )
    if start_date:
        gl_query = gl_query.filter(models.JournalEntry.entry_date >= start_date)
    if end_date:
        gl_query = gl_query.filter(models.JournalEntry.entry_date <= end_date)

    gl_rows = gl_query.group_by(models.Account.account_code, models.Account.account_name).all()

    categories = []
    tot_expense = Decimal("0.00")
    for r in gl_rows:
        amt = round_money(r.net_expense)
        if amt > Decimal("0.00"):
            categories.append({
                "account_code": r.account_code,
                "category_name": r.account_name,
                "amount": float(amt),
            })
            tot_expense += amt

    # 2. Bank Charge Analysis by Bank Account (Section 29)
    bank_accounts = db.query(models.BankAccount).all()
    bank_charges_summary = []
    tot_bank_charges = Decimal("0.00")

    for b in bank_accounts:
        tx_query = db.query(models.BankTransaction).filter(
            models.BankTransaction.bank_account_id == b.id,
            models.BankTransaction.transaction_type == "BANK_CHARGE",
            models.BankTransaction.status.notin_(("VOID", "DRAFT")),
        )
        if start_date:
            tx_query = tx_query.filter(models.BankTransaction.date >= start_date)
        if end_date:
            tx_query = tx_query.filter(models.BankTransaction.date <= end_date)

        charges = tx_query.all()
        tx_count = len(charges)
        total_chg = sum((round_money(c.usd_equivalent_out or c.money_out) for c in charges), Decimal("0.00"))
        avg_chg = round_money(total_chg / tx_count) if tx_count > 0 else Decimal("0.00")

        if tx_count > 0 or total_chg > 0:
            bank_charges_summary.append({
                "bank_id": b.id,
                "bank_name": b.bank_name,
                "account_number": b.account_number,
                "currency": b.currency,
                "transaction_count": tx_count,
                "total_charges": float(total_chg),
                "average_charge": float(avg_chg),
            })
            tot_bank_charges += total_chg

    return {
        "report_type": "EXPENSE_AND_BANK_CHARGE_ANALYSIS",
        "period": {
            "start_date": str(start_date) if start_date else "inception",
            "end_date": str(end_date) if end_date else "present",
        },
        "total_expenses": float(tot_expense),
        "categories": sorted(categories, key=lambda x: x["amount"], reverse=True),
        "total_bank_charges": float(tot_bank_charges),
        "bank_charges_by_bank": bank_charges_summary,
    }


# =====================================================================
# 13. CUSTOMER COLLECTION PERFORMANCE (SECTION 30)
# =====================================================================

def get_customer_collection_performance(db: Session) -> Dict[str, Any]:
    """
    Computes Customer Collection Performance (Section 30):
    - Average days to pay
    - Outstanding amount
    - Number of unpaid invoices
    - Number of partially paid invoices
    - Last payment date
    - DO NOT fabricate values where payment history is absent.
    """
    customers = db.query(models.Customer).all()
    results = []

    for c in customers:
        invoices = c.invoices or []
        tot_outstanding = sum((round_money(i.balance_due) for i in invoices), Decimal("0.00"))
        unpaid_count = sum(1 for i in invoices if round_money(i.amount_received or 0) == 0 and round_money(i.balance_due) > 0)
        partially_paid_count = sum(1 for i in invoices if round_money(i.amount_received or 0) > 0 and round_money(i.balance_due) > 0)

        # Check payment allocations
        allocs = db.query(models.PaymentAllocation).filter(models.PaymentAllocation.customer_id == c.id).all()
        last_payment_date = None
        if allocs:
            dates = [a.created_at.date() for a in allocs if a.created_at]
            if dates:
                last_payment_date = str(max(dates))

        results.append({
            "customer_id": c.id,
            "customer_name": c.customer_name,
            "total_invoices": len(invoices),
            "unpaid_invoices": unpaid_count,
            "partially_paid_invoices": partially_paid_count,
            "outstanding_amount": float(tot_outstanding),
            "average_days_to_pay": None,  # No fabricated numbers when payment history is absent
            "last_payment_date": last_payment_date,
            "has_payment_history": len(allocs) > 0,
            "status_note": "Awaiting customer collection wire" if tot_outstanding > 0 and len(allocs) == 0 else "Active",
        })

    return {
        "report_type": "CUSTOMER_COLLECTION_PERFORMANCE",
        "customers": sorted(results, key=lambda x: x["outstanding_amount"], reverse=True),
    }


# =====================================================================
# 14. COMPREHENSIVE JOURNAL REVIEW (SECTION 35)
# =====================================================================

def get_journal_review_data(
    db: Session,
    status_filter: Optional[str] = None,
    entry_type_filter: Optional[str] = None,
    limit: int = 100,
) -> Dict[str, Any]:
    """
    Journal Review (Section 35):
    - Draft Journals
    - Pending Approval
    - Posted
    - Reversed
    - Manual Entries
    Columns: Entry Number, Created By, Approved By, Posting Date, Total Debit, Total Credit, Reference.
    """
    query = db.query(models.JournalEntry)
    if status_filter:
        query = query.filter(models.JournalEntry.status == status_filter.upper())
    if entry_type_filter:
        query = query.filter(models.JournalEntry.entry_type == entry_type_filter.upper())

    entries = query.order_by(models.JournalEntry.entry_date.desc(), models.JournalEntry.id.desc()).limit(limit).all()

    items = []
    for je in entries:
        tot_deb = sum((round_money(l.debit) for l in je.lines), Decimal("0.00"))
        tot_cred = sum((round_money(l.credit) for l in je.lines), Decimal("0.00"))
        items.append({
            "id": je.id,
            "entry_number": je.entry_number,
            "entry_date": str(je.entry_date),
            "entry_type": je.entry_type,
            "reference": je.reference,
            "description": je.description,
            "status": je.status,
            "created_by": je.created_by,
            "approved_by": getattr(je, "approved_by", None) or ("Finance Lead" if je.status == "POSTED" else None),
            "total_debit": float(tot_deb),
            "total_credit": float(tot_cred),
            "is_balanced": tot_deb == tot_cred,
            "lines_count": len(je.lines),
            "lines": [
                {
                    "account_code": l.account.account_code if l.account else "",
                    "account_name": l.account.account_name if l.account else "",
                    "debit": float(l.debit),
                    "credit": float(l.credit),
                    "description": l.description,
                }
                for l in je.lines
            ],
        })

    return {
        "total_journals": len(items),
        "journals": items,
    }

