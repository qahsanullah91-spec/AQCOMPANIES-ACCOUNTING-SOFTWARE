"""
AQ COMPANIES — Unified Accounting Reports & PDF REST Router
Authoritative PDF Generation Endpoints for Statements, Financial Ledgers, and Vouchers.
"""

import re
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException, Query, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from app.database import get_db
from app import models
from app.services.reports import (
    StatementPDFReports,
    FinancialPDFReports,
    VoucherPDFReports,
)
from app.accounting_engine import (
    compute_trial_balance,
    recalculate_bank_running_balance,
)
from app.accounting_router import compute_transport_position
from app.services.reporting.financial_reports_service import FinancialReportsService


router = APIRouter(tags=["Authoritative Financial Reports & PDF Export"])


def sanitize_filename(name: str) -> str:
    """Removes invalid characters for clean, standard filenames."""
    clean = re.sub(r'[^a-zA-Z0-9_-]', '_', name)
    return clean.strip('_')


# =====================================================================
# 1. CUSTOMER STATEMENT PDF
# =====================================================================
@router.get("/api/v1/customers/{customer_id}/statement.pdf")
@router.get("/api/reports/customers/{customer_id}/statement.pdf")
@router.get("/api/customers/{customer_id}/statement.pdf")
def get_customer_statement_pdf(
    customer_id: int,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
):
    cust = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found.")

    invoices = (
        db.query(models.Invoice)
        .filter(models.Invoice.customer_id == customer_id)
        .order_by(models.Invoice.date.asc())
        .all()
    )
    allocations = (
        db.query(models.PaymentAllocation)
        .filter(models.PaymentAllocation.customer_id == customer_id)
        .order_by(models.PaymentAllocation.created_at.asc())
        .all()
    )

    lines = []
    for inv in invoices:
        lines.append({
            "date": str(inv.date),
            "reference": inv.invoice_number,
            "description": f"Sales Invoice {inv.invoice_number}",
            "debit": float(inv.total_amount or 0),
            "credit": 0.0,
        })

    for a in allocations:
        inv_no = a.invoice.invoice_number if a.invoice else "Advance"
        lines.append({
            "date": str(a.created_at.date() if a.created_at else date.today()),
            "reference": f"ALLOC-{a.id}",
            "description": f"Payment allocated to {inv_no}",
            "debit": 0.0,
            "credit": float(a.allocated_amount_usd),
        })

    lines.sort(key=lambda x: x["date"])

    running = Decimal("0.00")
    for l in lines:
        running += Decimal(str(l["debit"])) - Decimal(str(l["credit"]))
        l["running_balance"] = float(running)

    clean_name = sanitize_filename(cust.customer_name)[:20]
    period_str = datetime.now().strftime("%Y-%m")
    filename = f"AQ-Customer-Statement-{clean_name}-{period_str}.pdf"

    buf = StatementPDFReports.customer_statement(
        customer_name=cust.customer_name,
        customer_code=f"CUST-{cust.id:03d}",
        opening_balance=Decimal("0.00"),
        lines=lines,
        closing_balance=running,
        date_from=date_from,
        date_to=date_to,
    )

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =====================================================================
# 2. SUPPLIER STATEMENT PDF
# =====================================================================
@router.get("/api/v1/suppliers/{supplier_id}/statement.pdf")
@router.get("/api/reports/suppliers/{supplier_id}/statement.pdf")
@router.get("/api/suppliers/{supplier_id}/statement.pdf")
def get_supplier_statement_pdf(
    supplier_id: int,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
):
    supp = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not supp:
        raise HTTPException(status_code=404, detail="Supplier not found.")

    purchases = (
        db.query(models.Purchase)
        .filter(models.Purchase.supplier_id == supplier_id)
        .order_by(models.Purchase.date.asc())
        .all()
    )
    payments = (
        db.query(models.BankTransaction)
        .filter(
            models.BankTransaction.party_type == "SUPPLIER",
            models.BankTransaction.party_id == supplier_id,
        )
        .order_by(models.BankTransaction.date.asc())
        .all()
    )

    lines = []
    pending_costs = 0
    for p in purchases:
        is_pending = p.purchase_cost_usd is None or p.unit_price_usd is None
        if is_pending:
            pending_costs += 1
            credit_val = 0.0
        else:
            credit_val = float(p.purchase_cost_usd or 0)

        lines.append({
            "date": str(p.date),
            "reference": p.purchase_order_number or f"PO-{p.id}",
            "description": f"Purchase: {p.product_name or 'Commodity'} ({p.bags_count or 0} bags)",
            "debit": 0.0,
            "credit": credit_val,
            "is_pending_cost": is_pending,
        })

    for pay in payments:
        lines.append({
            "date": str(pay.date),
            "reference": pay.voucher_number or pay.transaction_code,
            "description": f"Disbursement via {pay.bank_name}",
            "debit": float(pay.usd_equivalent_out or pay.money_out),
            "credit": 0.0,
            "is_pending_cost": False,
        })

    lines.sort(key=lambda x: x["date"])

    running = Decimal("0.00")
    for l in lines:
        running += Decimal(str(l["credit"])) - Decimal(str(l["debit"]))
        l["running_balance"] = float(running)

    clean_name = sanitize_filename(supp.supplier_name)[:20]
    period_str = datetime.now().strftime("%Y-%m")
    filename = f"AQ-Supplier-Statement-{clean_name}-{period_str}.pdf"

    buf = StatementPDFReports.supplier_statement(
        supplier_name=supp.supplier_name,
        supplier_code=f"SUPP-{supp.id:03d}",
        opening_balance=Decimal("0.00"),
        lines=lines,
        closing_balance=running,
        pending_purchase_costs_count=pending_costs,
        date_from=date_from,
        date_to=date_to,
    )

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =====================================================================
# 3. TRANSPORT STATEMENT PDF
# =====================================================================
@router.get("/api/v1/transport/{transport_id}/statement.pdf")
@router.get("/api/v1/transport/statement.pdf")
@router.get("/api/reports/transport/statement.pdf")
@router.get("/api/accounting/transport/statement.pdf")
def get_transport_statement_pdf(
    transport_id: int = 1,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Authoritative Transport Company Statement PDF:
    Freight Charges: $743,650.00
    Direct Payments: $1,030,000.00
    Opening Credit: $4,810.00
    Closing Position: -$291,160.00 (CREDIT IN AQ COMPANIES FAVOR)
    """
    tc = db.query(models.TransportCompany).filter(models.TransportCompany.id == transport_id).first()
    carrier_name = tc.company_name if tc else "SKY ARIANA LIMITED"

    pos = compute_transport_position(db, transport_id)

    charges = (
        db.query(models.TransportCharge)
        .filter(models.TransportCharge.transport_company_id == transport_id)
        .order_by(models.TransportCharge.date.asc(), models.TransportCharge.id.asc())
        .all()
    )
    payments = (
        db.query(models.TransportPayment)
        .filter(models.TransportPayment.transport_company_id == transport_id)
        .order_by(models.TransportPayment.date.asc(), models.TransportPayment.id.asc())
        .all()
    )

    combined = []
    for c in charges:
        combined.append({
            "date": str(c.date),
            "reference": c.invoice_no or f"TC-{c.id}",
            "container_no": c.container_no,
            "truck_no": c.truck_no,
            "description": c.description,
            "debit": float(c.debit_usd),
            "credit": float(c.credit_usd),
        })

    for p in payments:
        combined.append({
            "date": str(p.date),
            "reference": f"WIRE-{p.id}",
            "container_no": None,
            "truck_no": None,
            "description": f"Carrier freight payment via {p.payment_method}",
            "debit": 0.0,
            "credit": float(p.amount_usd),
        })

    combined.sort(key=lambda x: x["date"])

    running = Decimal("0.00")
    for row in combined:
        running += Decimal(str(row["debit"])) - Decimal(str(row["credit"]))
        row["running_balance"] = float(running)

    clean_name = sanitize_filename(carrier_name)[:20]
    period_str = datetime.now().strftime("%Y-%m")
    filename = f"AQ-Transport-Statement-{clean_name}-{period_str}.pdf"

    buf = StatementPDFReports.transport_statement(
        carrier_name=carrier_name,
        position_data=pos,
        ledger_lines=combined,
        date_from=date_from,
        date_to=date_to,
    )

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =====================================================================
# 4. BANK STATEMENT PDF
# =====================================================================
@router.get("/api/v1/banking/accounts/{account_id}/statement.pdf")
@router.get("/api/reports/banking/{account_id}/statement.pdf")
@router.get("/api/accounting/banks/{account_id}/statement.pdf")
def get_bank_statement_pdf(
    account_id: int,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
):
    b = db.query(models.BankAccount).filter(models.BankAccount.id == account_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Bank account not found.")

    txs = (
        db.query(models.BankTransaction)
        .filter(models.BankTransaction.bank_account_id == account_id)
        .order_by(models.BankTransaction.date.asc(), models.BankTransaction.id.asc())
        .all()
    )

    lines = []
    tot_in = Decimal("0.00")
    tot_out = Decimal("0.00")
    for t in txs:
        m_in = Decimal(str(t.money_in or 0))
        m_out = Decimal(str(t.money_out or 0))
        tot_in += m_in
        tot_out += m_out

        lines.append({
            "date": str(t.date),
            "voucher_number": t.voucher_number or t.transaction_code,
            "party_name": t.party_name,
            "transaction_type": t.transaction_type,
            "bank_reference": t.bank_reference or t.transaction_reference,
            "notes": t.notes,
            "money_in": float(m_in),
            "money_out": float(m_out),
            "running_balance": float(t.running_balance or 0),
        })

    opening = Decimal(str(b.opening_balance or 0))
    closing = Decimal(str(b.current_balance or 0))

    clean_bank = sanitize_filename(b.bank_name)[:15]
    period_str = datetime.now().strftime("%Y-%m")
    filename = f"AQ-Bank-Statement-{clean_bank}-{b.currency}-{period_str}.pdf"

    buf = StatementPDFReports.bank_statement(
        bank_name=b.bank_name,
        account_number=b.account_number,
        currency=b.currency,
        opening_balance=opening,
        transactions=lines,
        closing_balance=closing,
        date_from=date_from,
        date_to=date_to,
    )

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =====================================================================
# 5. GENERAL LEDGER PDF
# =====================================================================
@router.get("/api/v1/accounting/general-ledger.pdf")
@router.get("/api/reports/accounting/general-ledger.pdf")
@router.get("/api/accounting/general-ledger.pdf")
def get_general_ledger_pdf(
    account_code: str = Query("1000", description="GL Account Code"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
):
    acc = db.query(models.Account).filter(models.Account.account_code == account_code).first()
    acc_name = acc.account_name if acc else "General Ledger Account"

    j_lines = (
        db.query(models.JournalLine)
        .join(models.JournalEntry)
        .filter(models.JournalLine.account_code == account_code)
        .order_by(models.JournalEntry.entry_date.asc(), models.JournalLine.id.asc())
        .all()
    )

    lines = []
    tot_debit = Decimal("0.00")
    tot_credit = Decimal("0.00")
    running = Decimal("0.00")

    for jl in j_lines:
        entry = jl.journal_entry
        d = Decimal(str(jl.debit or 0))
        c = Decimal(str(jl.credit or 0))
        tot_debit += d
        tot_credit += c
        running += (d - c)

        lines.append({
            "date": str(entry.entry_date if entry else "—"),
            "journal_number": entry.entry_number if entry else "—",
            "reference": entry.reference if entry else "—",
            "description": jl.description or (entry.description if entry else ""),
            "debit": float(d),
            "credit": float(c),
            "running_balance": float(running),
        })

    period_str = datetime.now().strftime("%Y-%m")
    filename = f"AQ-General-Ledger-{account_code}-{period_str}.pdf"

    buf = FinancialPDFReports.general_ledger(
        account_code=account_code,
        account_name=acc_name,
        opening_balance=Decimal("0.00"),
        lines=lines,
        closing_balance=running,
        date_from=date_from,
        date_to=date_to,
    )

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =====================================================================
# 6. TRIAL BALANCE PDF
# =====================================================================
@router.get("/api/v1/accounting/trial-balance.pdf")
@router.get("/api/reports/accounting/trial-balance.pdf")
@router.get("/api/accounting/trial-balance.pdf")
def get_trial_balance_pdf(
    as_of_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    tb = compute_trial_balance(db)
    accounts = tb.get("accounts", [])
    tot_debit = Decimal(str(tb.get("total_debit", "0.00")))
    tot_credit = Decimal(str(tb.get("total_credit", "0.00")))
    diff = Decimal(str(tb.get("difference", "0.00")))

    period_str = datetime.now().strftime("%Y-%m-%d")
    filename = f"AQ-Trial-Balance-{period_str}.pdf"

    buf = FinancialPDFReports.trial_balance(
        accounts_data=accounts,
        total_debit=tot_debit,
        total_credit=tot_credit,
        difference=diff,
        as_of_date=as_of_date,
    )

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =====================================================================
# 7. PROFIT & LOSS PDF
# =====================================================================
@router.get("/api/v1/accounting/profit-loss.pdf")
@router.get("/api/reports/accounting/profit-loss.pdf")
@router.get("/api/accounting/profit-loss.pdf")
def get_profit_loss_pdf(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    pnl = FinancialReportsService.get_profit_and_loss(db, start_date=start_date, end_date=end_date)

    revenue_items = []
    rev = pnl.get("revenue", {})
    if isinstance(rev, dict):
        for k, v in rev.get("breakdown", {}).items():
            revenue_items.append({"name": k.replace("_", " ").title(), "amount": Decimal(str(v or 0))})
    if not revenue_items:
        revenue_items = [{"name": "Sales Revenue — Export Commodities", "amount": Decimal(str(rev.get("total_revenue", 0) or 0))}]

    cogs_items = []
    cogs = pnl.get("cost_of_goods_sold", {})
    if isinstance(cogs, dict):
        for k, v in cogs.get("breakdown", {}).items():
            cogs_items.append({"name": k.replace("_", " ").title(), "amount": Decimal(str(v or 0))})
    if not cogs_items:
        cogs_items = [{"name": "Procurement & Direct Logistics Cost", "amount": Decimal(str(cogs.get("total_cogs", 0) or 0))}]

    exp_items = []
    exps = pnl.get("operating_expenses", {})
    if isinstance(exps, dict):
        for k, v in exps.get("breakdown", {}).items():
            exp_items.append({"name": k.replace("_", " ").title(), "amount": Decimal(str(v or 0))})
    if not exp_items:
        exp_items = [{"name": "Administrative & Operational Expenses", "amount": Decimal(str(exps.get("total_expenses", 0) or 0))}]

    has_pending = pnl.get("has_unverified_purchase_costs", False)
    pending_count = pnl.get("unverified_shipments_count", 0)

    period_str = datetime.now().strftime("%Y-%m")
    filename = f"AQ-Profit-Loss-{period_str}.pdf"

    buf = FinancialPDFReports.profit_and_loss(
        revenue_items=revenue_items,
        total_revenue=Decimal(str(pnl.get("revenue", {}).get("total_revenue", 0) or 0)),
        cogs_items=cogs_items,
        total_cogs=Decimal(str(pnl.get("cost_of_goods_sold", {}).get("total_cogs", 0) or 0)),
        gross_profit=Decimal(str(pnl.get("gross_profit", {}).get("gross_profit", 0) or 0)),
        expense_items=exp_items,
        total_expenses=Decimal(str(pnl.get("operating_expenses", {}).get("total_expenses", 0) or 0)),
        net_profit=Decimal(str(pnl.get("net_profit", {}).get("net_profit", 0) or 0)),
        has_pending_purchase_costs=has_pending,
        pending_costs_count=pending_count,
        date_from=str(start_date) if start_date else None,
        date_to=str(end_date) if end_date else None,
    )

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =====================================================================
# 8. BALANCE SHEET PDF
# =====================================================================
@router.get("/api/v1/accounting/balance-sheet.pdf")
@router.get("/api/reports/accounting/balance-sheet.pdf")
@router.get("/api/accounting/balance-sheet.pdf")
def get_balance_sheet_pdf(
    as_of_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    bs = FinancialReportsService.get_balance_sheet(db, as_of_date=as_of_date)

    assets_list = []
    for k, v in bs.get("assets", {}).get("breakdown", {}).items():
        assets_list.append({"name": k.replace("_", " ").title(), "amount": Decimal(str(v or 0))})

    liabilities_list = []
    for k, v in bs.get("liabilities", {}).get("breakdown", {}).items():
        liabilities_list.append({"name": k.replace("_", " ").title(), "amount": Decimal(str(v or 0))})

    equity_list = []
    for k, v in bs.get("equity", {}).get("breakdown", {}).items():
        equity_list.append({"name": k.replace("_", " ").title(), "amount": Decimal(str(v or 0))})

    period_str = datetime.now().strftime("%Y-%m-%d")
    filename = f"AQ-Balance-Sheet-{period_str}.pdf"

    buf = FinancialPDFReports.balance_sheet(
        assets=assets_list,
        total_assets=Decimal(str(bs.get("assets", {}).get("total_assets", 0) or 0)),
        liabilities=liabilities_list,
        total_liabilities=Decimal(str(bs.get("liabilities", {}).get("total_liabilities", 0) or 0)),
        equity=equity_list,
        total_equity=Decimal(str(bs.get("equity", {}).get("total_equity", 0) or 0)),
        as_of_date=str(as_of_date) if as_of_date else None,
    )

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =====================================================================
# 9. CASH FLOW PDF
# =====================================================================
@router.get("/api/v1/accounting/cash-flow.pdf")
@router.get("/api/reports/accounting/cash-flow.pdf")
@router.get("/api/accounting/cash-flow.pdf")
def get_cash_flow_pdf(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    cf = FinancialReportsService.get_cash_flow(db, start_date=start_date, end_date=end_date)

    operating_list = []
    for k, v in cf.get("operating_activities", {}).get("breakdown", {}).items():
        operating_list.append({"name": k.replace("_", " ").title(), "amount": Decimal(str(v or 0))})

    investing_list = []
    for k, v in cf.get("investing_activities", {}).get("breakdown", {}).items():
        investing_list.append({"name": k.replace("_", " ").title(), "amount": Decimal(str(v or 0))})

    financing_list = []
    for k, v in cf.get("financing_activities", {}).get("breakdown", {}).items():
        financing_list.append({"name": k.replace("_", " ").title(), "amount": Decimal(str(v or 0))})

    period_str = datetime.now().strftime("%Y-%m")
    filename = f"AQ-Cash-Flow-{period_str}.pdf"

    buf = FinancialPDFReports.cash_flow(
        operating_items=operating_list,
        total_operating=Decimal(str(cf.get("operating_activities", {}).get("net_operating_cash", 0) or 0)),
        investing_items=investing_list,
        total_investing=Decimal(str(cf.get("investing_activities", {}).get("net_investing_cash", 0) or 0)),
        financing_items=financing_list,
        total_financing=Decimal(str(cf.get("financing_activities", {}).get("net_financing_cash", 0) or 0)),
        opening_cash=Decimal(str(cf.get("summary", {}).get("opening_cash_balance", 0) or 0)),
        closing_cash=Decimal(str(cf.get("summary", {}).get("closing_cash_balance", 0) or 0)),
        date_from=str(start_date) if start_date else None,
        date_to=str(end_date) if end_date else None,
    )

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =====================================================================
# 10. REUSABLE VOUCHER PDF (CUSTOMER, SUPPLIER, TRANSPORT, BANK, CASH)
# =====================================================================
@router.get("/api/v1/vouchers/{voucher_type}/{voucher_id}/pdf")
@router.get("/api/reports/vouchers/{voucher_type}/{voucher_id}/pdf")
@router.get("/api/vouchers/{voucher_type}/{voucher_id}/pdf")
def get_voucher_pdf(
    voucher_type: str,
    voucher_id: int,
    db: Session = Depends(get_db),
):
    vt = voucher_type.upper()

    tx = db.query(models.BankTransaction).filter(models.BankTransaction.id == voucher_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction voucher not found.")

    v_no = tx.voucher_number or tx.transaction_code or f"VOUCH-{tx.id}"
    v_title = f"{vt.replace('_', ' ')} VOUCHER"

    allocs = []
    if tx.allocations:
        for a in tx.allocations:
            allocs.append({
                "invoice_number": a.invoice.invoice_number if a.invoice else "Advance",
                "date": str(a.invoice.date) if a.invoice and a.invoice.date else str(tx.date),
                "total_amount": float(a.invoice.total_amount) if a.invoice and a.invoice.total_amount else 0,
                "previously_received": float(a.invoice.amount_received or 0) if a.invoice else 0,
                "allocated_amount": float(a.allocated_amount_usd or 0),
            })

    amt = Decimal(str(tx.usd_equivalent_in if tx.usd_equivalent_in and tx.usd_equivalent_in > 0 else (tx.usd_equivalent_out or tx.money_in or tx.money_out or 0)))

    filename = f"AQ-Voucher-{v_no}.pdf"

    buf = VoucherPDFReports.generate_voucher(
        voucher_type=v_title,
        voucher_number=v_no,
        voucher_date=tx.date,
        party_name=tx.party_name,
        party_type=tx.party_type,
        amount=amt,
        currency=tx.currency,
        account_name=f"{tx.bank_name} ({tx.account_number})",
        reference=tx.bank_reference or tx.transaction_reference,
        description=tx.notes,
        allocations=allocs,
        is_posted=tx.status == "POSTED",
    )

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
