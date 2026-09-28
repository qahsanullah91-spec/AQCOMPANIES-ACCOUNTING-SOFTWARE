"""
AQ COMPANIES — Financial Statements & General Ledger PDF Reports
Generates authoritative double-entry reports for:
1. General Ledger (Account detail with running balance)
2. Trial Balance (Balanced Debits == Credits, Difference = $0.00)
3. Profit & Loss (With strict handling of pending purchase costs)
4. Balance Sheet (Assets = Liabilities + Equity)
5. Cash Flow Statement (Cash movement and breakdown)
"""

import io
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Dict, Any

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
)

from app.services.reports.pdf_base import (
    NumberedCanvas,
    format_money,
    get_corporate_styles,
    build_corporate_header,
    build_signature_block,
)


class FinancialPDFReports:
    @classmethod
    def general_ledger(
        cls,
        account_code: str,
        account_name: str,
        opening_balance: Decimal,
        lines: List[Dict[str, Any]],
        closing_balance: Decimal,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        currency: str = "USD",
        user_name: str = "Ahsanullah Qureshi",
    ) -> io.BytesIO:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=50,
        )
        st = get_corporate_styles()
        story = []

        period_str = f"{date_from or 'Initial'} to {date_to or 'Present'}"
        story.append(build_corporate_header(
            report_title=f"GENERAL LEDGER — {account_code}",
            doc_number=f"GL-{account_code}-{datetime.now().strftime('%Y%m')}",
            period_str=period_str,
            currency=currency,
        ))
        story.append(Spacer(1, 10))

        # Account Info Box
        meta_data = [
            [
                Paragraph(f"<b>GL Account:</b> {account_code} — {account_name}", st["table_td"]),
                Paragraph(f"<b>Opening Balance:</b> {format_money(opening_balance, currency)}", st["table_td"]),
                Paragraph(f"<b>Closing Balance:</b> <b>{format_money(closing_balance, currency)}</b>", st["table_td"]),
            ]
        ]
        meta_table = Table(meta_data, colWidths=[200, 160, 163.27])
        meta_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#CBD5E1")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ])
        )
        story.append(meta_table)
        story.append(Spacer(1, 12))

        table_rows = [
            [
                Paragraph("DATE", st["table_th"]),
                Paragraph("JOURNAL", st["table_th"]),
                Paragraph("REF", st["table_th"]),
                Paragraph("DESCRIPTION", st["table_th"]),
                Paragraph("DEBIT", st["table_th_right"]),
                Paragraph("CREDIT", st["table_th_right"]),
                Paragraph("BALANCE", st["table_th_right"]),
            ]
        ]

        tot_debit = Decimal("0.00")
        tot_credit = Decimal("0.00")

        table_rows.append([
            Paragraph(date_from or "—", st["table_td"]),
            Paragraph("OPENING", st["table_td"]),
            Paragraph("—", st["table_td"]),
            Paragraph("Forward Starting Balance", st["table_td"]),
            Paragraph("—", st["table_td_right"]),
            Paragraph("—", st["table_td_right"]),
            Paragraph(format_money(opening_balance, currency), st["table_th_right"]),
        ])

        for row in lines:
            d = Decimal(str(row.get("debit", 0) or 0))
            c = Decimal(str(row.get("credit", 0) or 0))
            bal = Decimal(str(row.get("running_balance", 0) or 0))
            tot_debit += d
            tot_credit += c

            table_rows.append([
                Paragraph(str(row.get("date", "—")), st["table_td"]),
                Paragraph(str(row.get("journal_number") or row.get("entry_number") or "—"), st["table_td"]),
                Paragraph(str(row.get("reference", "—")), st["table_td"]),
                Paragraph(str(row.get("description", "—")), st["table_td"]),
                Paragraph(format_money(d, currency) if d > 0 else "—", st["table_td_right"]),
                Paragraph(format_money(c, currency) if c > 0 else "—", st["table_td_right"]),
                Paragraph(format_money(bal, currency), st["table_td_right"]),
            ])

        table_rows.append([
            Paragraph("<b>TOTALS</b>", st["table_th"]),
            Paragraph("", st["table_th"]),
            Paragraph("", st["table_th"]),
            Paragraph("Cumulative Period Activity", st["table_th"]),
            Paragraph(f"<b>{format_money(tot_debit, currency)}</b>", st["table_th_right"]),
            Paragraph(f"<b>{format_money(tot_credit, currency)}</b>", st["table_th_right"]),
            Paragraph(f"<b>{format_money(closing_balance, currency)}</b>", st["table_th_right"]),
        ])

        gl_table = Table(
            table_rows,
            colWidths=[55, 70, 65, 153.27, 60, 60, 60],
            repeatRows=1,
        )
        gl_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
                ("LINEBELOW", (0, 0), (-1, 0), 1, colors.HexColor("#0F172A")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#F8FAFC")]),
                ("LINEABOVE", (0, -1), (-1, -1), 1, colors.HexColor("#0F172A")),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#F1F5F9")),
                ("LINEBELOW", (0, -1), (-1, -1), 1.5, colors.HexColor("#0F172A")),
            ])
        )
        story.append(gl_table)
        story.append(build_signature_block(prepared_by=user_name))

        doc.build(story, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer

    @classmethod
    def trial_balance(
        cls,
        accounts_data: List[Dict[str, Any]],
        total_debit: Decimal,
        total_credit: Decimal,
        difference: Decimal,
        as_of_date: Optional[str] = None,
        user_name: str = "Ahsanullah Qureshi",
    ) -> io.BytesIO:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=50,
        )
        st = get_corporate_styles()
        story = []

        is_balanced = abs(difference) == Decimal("0.00")
        story.append(build_corporate_header(
            report_title="OFFICIAL TRIAL BALANCE",
            doc_number=f"TB-{datetime.now().strftime('%Y%m%d')}",
            period_str=f"As of {as_of_date or datetime.now().strftime('%Y-%m-%d')}",
            currency="USD",
            is_draft=not is_balanced,
        ))
        story.append(Spacer(1, 10))

        # Status Banner
        if is_balanced:
            status_p = Paragraph(
                "<b>AUTHORITATIVE DOUBLE-ENTRY VALIDATION PASSED:</b> Total Debit equals Total Credit exactly. "
                "System General Ledger is in 100% mathematical balance (Variance = $0.00).",
                st["table_td"],
            )
            banner = Table([[status_p]], colWidths=[523.27])
            banner.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ECFDF5")),
                    ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#10B981")),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ])
            )
        else:
            status_p = Paragraph(
                f"<b>WARNING — IMBALANCE DETECTED:</b> Total Debit does NOT equal Total Credit. "
                f"Difference: <b>{format_money(difference)}</b>. Audit review required.",
                st["table_td"],
            )
            banner = Table([[status_p]], colWidths=[523.27])
            banner.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEE2E2")),
                    ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#EF4444")),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ])
            )
        story.append(banner)
        story.append(Spacer(1, 12))

        # Table
        table_rows = [
            [
                Paragraph("CODE", st["table_th"]),
                Paragraph("ACCOUNT NAME", st["table_th"]),
                Paragraph("TYPE", st["table_th"]),
                Paragraph("DEBIT BALANCE", st["table_th_right"]),
                Paragraph("CREDIT BALANCE", st["table_th_right"]),
            ]
        ]

        for acc in accounts_data:
            d = Decimal(str(acc.get("debit_balance", 0) or 0))
            c = Decimal(str(acc.get("credit_balance", 0) or 0))

            table_rows.append([
                Paragraph(f"<b>{acc.get('account_code')}</b>", st["table_td"]),
                Paragraph(str(acc.get("account_name")), st["table_td"]),
                Paragraph(str(acc.get("account_type")), st["table_td"]),
                Paragraph(format_money(d) if d > 0 else "—", st["table_td_right"]),
                Paragraph(format_money(c) if c > 0 else "—", st["table_td_right"]),
            ])

        table_rows.append([
            Paragraph("<b>TOTALS</b>", st["table_th"]),
            Paragraph("Cumulative General Ledger Balance", st["table_th"]),
            Paragraph("", st["table_th"]),
            Paragraph(f"<b>{format_money(total_debit)}</b>", st["table_th_right"]),
            Paragraph(f"<b>{format_money(total_credit)}</b>", st["table_th_right"]),
        ])

        table_rows.append([
            Paragraph("<b>VARIANCE / DIFFERENCE</b>", st["table_th"]),
            Paragraph("", st["table_th"]),
            Paragraph("", st["table_th"]),
            Paragraph(f"<b>{format_money(difference)}</b>", st["credit_highlight"] if is_balanced else st["badge_draft"]),
            Paragraph(f"<b>{format_money(difference)}</b>", st["credit_highlight"] if is_balanced else st["badge_draft"]),
        ])

        tb_table = Table(
            table_rows,
            colWidths=[60, 213.27, 90, 80, 80],
            repeatRows=1,
        )
        tb_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
                ("LINEBELOW", (0, 0), (-1, 0), 1, colors.HexColor("#0F172A")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("ROWBACKGROUNDS", (0, 1), (-1, -3), [colors.white, colors.HexColor("#F8FAFC")]),
                ("LINEABOVE", (0, -2), (-1, -2), 1, colors.HexColor("#0F172A")),
                ("BACKGROUND", (0, -2), (-1, -2), colors.HexColor("#F1F5F9")),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#ECFDF5") if is_balanced else colors.HexColor("#FEE2E2")),
                ("LINEBELOW", (0, -1), (-1, -1), 1.5, colors.HexColor("#0F172A")),
            ])
        )
        story.append(tb_table)
        story.append(build_signature_block(prepared_by=user_name))

        doc.build(story, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer

    @classmethod
    def profit_and_loss(
        cls,
        revenue_items: List[Dict[str, Any]],
        total_revenue: Decimal,
        cogs_items: List[Dict[str, Any]],
        total_cogs: Decimal,
        gross_profit: Decimal,
        expense_items: List[Dict[str, Any]],
        total_expenses: Decimal,
        net_profit: Decimal,
        has_pending_purchase_costs: bool = False,
        pending_costs_count: int = 0,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        user_name: str = "Ahsanullah Qureshi",
    ) -> io.BytesIO:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=50,
        )
        st = get_corporate_styles()
        story = []

        period_str = f"{date_from or 'Initial'} to {date_to or 'Present'}"
        story.append(build_corporate_header(
            report_title="PROFIT & LOSS STATEMENT",
            doc_number=f"PNL-{datetime.now().strftime('%Y%m')}",
            period_str=period_str,
            currency="USD",
            is_draft=has_pending_purchase_costs,
        ))
        story.append(Spacer(1, 10))

        if has_pending_purchase_costs:
            warn_p = Paragraph(
                f"<b>ACCOUNTING AUDIT WARNING — PROFIT INCOMPLETE:</b> {pending_costs_count} procurement batch(es) have "
                "<b>PENDING PURCHASE COSTS</b>. Per strict AQ Companies accounting principles, unpriced costs are NEVER assumed to be zero. "
                "Reported Gross Profit and Net Profit are interim audit values subject to final supplier pricing.",
                st["table_td"],
            )
            warn_table = Table([[warn_p]], colWidths=[523.27])
            warn_table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEF3C7")),
                    ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#F59E0B")),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ])
            )
            story.append(warn_table)
            story.append(Spacer(1, 10))

        # Statement Table
        table_rows = [
            [Paragraph("<b>FINANCIAL COMPONENT</b>", st["table_th"]), Paragraph("<b>AMOUNT (USD)</b>", st["table_th_right"])],
            # Revenue Section
            [Paragraph("<b>1. REVENUE / OPERATING INCOME</b>", st["table_th"]), Paragraph("", st["table_th_right"])],
        ]

        for item in revenue_items:
            table_rows.append([
                Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;{item.get('name')}", st["table_td"]),
                Paragraph(format_money(item.get("amount")), st["table_td_right"]),
            ])

        table_rows.append([
            Paragraph("<b>TOTAL REVENUE</b>", st["table_td"]),
            Paragraph(f"<b>{format_money(total_revenue)}</b>", st["table_th_right"]),
        ])

        # COGS Section
        table_rows.append([Paragraph("<b>2. COST OF GOODS SOLD (COGS)</b>", st["table_th"]), Paragraph("", st["table_th_right"])])
        for item in cogs_items:
            table_rows.append([
                Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;{item.get('name')}", st["table_td"]),
                Paragraph(format_money(item.get("amount")), st["table_td_right"]),
            ])

        table_rows.append([
            Paragraph("<b>TOTAL COST OF GOODS SOLD</b>", st["table_td"]),
            Paragraph(f"<b>{format_money(total_cogs)}</b>", st["table_th_right"]),
        ])

        # Gross Profit
        table_rows.append([
            Paragraph("<b>GROSS PROFIT</b>" + (" (INTERIM)" if has_pending_purchase_costs else ""), st["table_th"]),
            Paragraph(f"<b>{format_money(gross_profit)}</b>", st["table_th_right"]),
        ])

        # Operating Expenses
        table_rows.append([Paragraph("<b>3. OPERATING & ADMINISTRATIVE EXPENSES</b>", st["table_th"]), Paragraph("", st["table_th_right"])])
        for item in expense_items:
            table_rows.append([
                Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;{item.get('name')}", st["table_td"]),
                Paragraph(format_money(item.get("amount")), st["table_td_right"]),
            ])

        table_rows.append([
            Paragraph("<b>TOTAL OPERATING EXPENSES</b>", st["table_td"]),
            Paragraph(f"<b>{format_money(total_expenses)}</b>", st["table_th_right"]),
        ])

        # Net Profit
        net_label = "<b>NET PROFIT / (LOSS)</b>" + (" (PROFIT INCOMPLETE — PENDING COSTS)" if has_pending_purchase_costs else "")
        table_rows.append([
            Paragraph(net_label, st["table_th"]),
            Paragraph(f"<b>{format_money(net_profit)}</b>", st["credit_highlight"] if net_profit >= 0 else st["table_th_right"]),
        ])

        pnl_table = Table(table_rows, colWidths=[383.27, 140])
        pnl_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
                ("LINEBELOW", (0, 0), (-1, 0), 1, colors.HexColor("#0F172A")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("LINEBELOW", (0, 3), (-1, 3), 0.75, colors.HexColor("#CBD5E1")),
                ("BACKGROUND", (0, 3), (-1, 3), colors.HexColor("#F8FAFC")),
                ("LINEBELOW", (0, 6), (-1, 6), 0.75, colors.HexColor("#CBD5E1")),
                ("BACKGROUND", (0, 6), (-1, 6), colors.HexColor("#F8FAFC")),
                ("LINEBELOW", (0, 7), (-1, 7), 1, colors.HexColor("#0284C7")),
                ("BACKGROUND", (0, 7), (-1, 7), colors.HexColor("#F0F9FF")),
                ("LINEBELOW", (0, -2), (-1, -2), 0.75, colors.HexColor("#CBD5E1")),
                ("BACKGROUND", (0, -2), (-1, -2), colors.HexColor("#F8FAFC")),
                ("LINEABOVE", (0, -1), (-1, -1), 1.5, colors.HexColor("#0F172A")),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#ECFDF5") if net_profit >= 0 else colors.HexColor("#FEE2E2")),
                ("LINEBELOW", (0, -1), (-1, -1), 2, colors.HexColor("#0F172A")),
            ])
        )
        story.append(pnl_table)
        story.append(build_signature_block(prepared_by=user_name))

        doc.build(story, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer

    @classmethod
    def balance_sheet(
        cls,
        assets: List[Dict[str, Any]],
        total_assets: Decimal,
        liabilities: List[Dict[str, Any]],
        total_liabilities: Decimal,
        equity: List[Dict[str, Any]],
        total_equity: Decimal,
        as_of_date: Optional[str] = None,
        user_name: str = "Ahsanullah Qureshi",
    ) -> io.BytesIO:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=50,
        )
        st = get_corporate_styles()
        story = []

        is_balanced = total_assets == (total_liabilities + total_equity)
        story.append(build_corporate_header(
            report_title="OFFICIAL BALANCE SHEET",
            doc_number=f"BS-{datetime.now().strftime('%Y%m%d')}",
            period_str=f"As of {as_of_date or datetime.now().strftime('%Y-%m-%d')}",
            currency="USD",
            is_draft=not is_balanced,
        ))
        story.append(Spacer(1, 10))

        table_rows = [
            [Paragraph("<b>ACCOUNT CATEGORY / ITEM</b>", st["table_th"]), Paragraph("<b>AMOUNT (USD)</b>", st["table_th_right"])],
            [Paragraph("<b>1. ASSETS</b>", st["table_th"]), Paragraph("", st["table_th_right"])],
        ]

        for item in assets:
            table_rows.append([
                Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;{item.get('name')}", st["table_td"]),
                Paragraph(format_money(item.get("amount")), st["table_td_right"]),
            ])

        table_rows.append([
            Paragraph("<b>TOTAL ASSETS</b>", st["table_th"]),
            Paragraph(f"<b>{format_money(total_assets)}</b>", st["table_th_right"]),
        ])

        table_rows.append([Paragraph("<b>2. LIABILITIES</b>", st["table_th"]), Paragraph("", st["table_th_right"])])
        for item in liabilities:
            table_rows.append([
                Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;{item.get('name')}", st["table_td"]),
                Paragraph(format_money(item.get("amount")), st["table_td_right"]),
            ])

        table_rows.append([
            Paragraph("<b>TOTAL LIABILITIES</b>", st["table_th"]),
            Paragraph(f"<b>{format_money(total_liabilities)}</b>", st["table_th_right"]),
        ])

        table_rows.append([Paragraph("<b>3. EQUITY</b>", st["table_th"]), Paragraph("", st["table_th_right"])])
        for item in equity:
            table_rows.append([
                Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;{item.get('name')}", st["table_td"]),
                Paragraph(format_money(item.get("amount")), st["table_td_right"]),
            ])

        table_rows.append([
            Paragraph("<b>TOTAL EQUITY</b>", st["table_th"]),
            Paragraph(f"<b>{format_money(total_equity)}</b>", st["table_th_right"]),
        ])

        table_rows.append([
            Paragraph("<b>TOTAL LIABILITIES & EQUITY</b>", st["table_th"]),
            Paragraph(f"<b>{format_money(total_liabilities + total_equity)}</b>", st["table_th_right"]),
        ])

        bs_table = Table(table_rows, colWidths=[383.27, 140])
        bs_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
                ("LINEBELOW", (0, 0), (-1, 0), 1, colors.HexColor("#0F172A")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("LINEBELOW", (0, -1), (-1, -1), 2, colors.HexColor("#0F172A")),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#ECFDF5") if is_balanced else colors.HexColor("#FEE2E2")),
            ])
        )
        story.append(bs_table)
        story.append(build_signature_block(prepared_by=user_name))

        doc.build(story, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer

    @classmethod
    def cash_flow(
        cls,
        operating_items: List[Dict[str, Any]],
        total_operating: Decimal,
        investing_items: List[Dict[str, Any]],
        total_investing: Decimal,
        financing_items: List[Dict[str, Any]],
        total_financing: Decimal,
        opening_cash: Decimal,
        closing_cash: Decimal,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        user_name: str = "Ahsanullah Qureshi",
    ) -> io.BytesIO:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=50,
        )
        st = get_corporate_styles()
        story = []

        period_str = f"{date_from or 'Initial'} to {date_to or 'Present'}"
        story.append(build_corporate_header(
            report_title="CASH FLOW STATEMENT",
            doc_number=f"CF-{datetime.now().strftime('%Y%m')}",
            period_str=period_str,
            currency="USD",
        ))
        story.append(Spacer(1, 10))

        net_cash_movement = (closing_cash - opening_cash)

        table_rows = [
            [Paragraph("<b>CASH FLOW ACTIVITY</b>", st["table_th"]), Paragraph("<b>NET MOVEMENT (USD)</b>", st["table_th_right"])],
            [Paragraph("<b>1. OPERATING ACTIVITIES</b>", st["table_th"]), Paragraph("", st["table_th_right"])],
        ]

        for item in operating_items:
            table_rows.append([
                Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;{item.get('name')}", st["table_td"]),
                Paragraph(format_money(item.get("amount")), st["table_td_right"]),
            ])

        table_rows.append([
            Paragraph("<b>NET CASH FROM OPERATING ACTIVITIES</b>", st["table_td"]),
            Paragraph(f"<b>{format_money(total_operating)}</b>", st["table_th_right"]),
        ])

        table_rows.append([Paragraph("<b>2. INVESTING ACTIVITIES</b>", st["table_th"]), Paragraph("", st["table_th_right"])])
        for item in investing_items:
            table_rows.append([
                Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;{item.get('name')}", st["table_td"]),
                Paragraph(format_money(item.get("amount")), st["table_td_right"]),
            ])
        table_rows.append([
            Paragraph("<b>NET CASH FROM INVESTING ACTIVITIES</b>", st["table_td"]),
            Paragraph(f"<b>{format_money(total_investing)}</b>", st["table_th_right"]),
        ])

        table_rows.append([Paragraph("<b>3. FINANCING ACTIVITIES</b>", st["table_th"]), Paragraph("", st["table_th_right"])])
        for item in financing_items:
            table_rows.append([
                Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;{item.get('name')}", st["table_td"]),
                Paragraph(format_money(item.get("amount")), st["table_td_right"]),
            ])
        table_rows.append([
            Paragraph("<b>NET CASH FROM FINANCING ACTIVITIES</b>", st["table_td"]),
            Paragraph(f"<b>{format_money(total_financing)}</b>", st["table_th_right"]),
        ])

        # Summary Movement
        table_rows.append([
            Paragraph("<b>NET INCREASE / (DECREASE) IN CASH & EQUIVALENTS</b>", st["table_th"]),
            Paragraph(f"<b>{format_money(net_cash_movement)}</b>", st["credit_highlight"] if net_cash_movement >= 0 else st["table_th_right"]),
        ])
        table_rows.append([
            Paragraph("<b>CASH & EQUIVALENTS AT START OF PERIOD</b>", st["table_td"]),
            Paragraph(f"<b>{format_money(opening_cash)}</b>", st["table_td_right"]),
        ])
        table_rows.append([
            Paragraph("<b>CASH & EQUIVALENTS AT END OF PERIOD</b>", st["table_th"]),
            Paragraph(f"<b>{format_money(closing_cash)}</b>", st["table_th_right"]),
        ])

        cf_table = Table(table_rows, colWidths=[383.27, 140])
        cf_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
                ("LINEBELOW", (0, 0), (-1, 0), 1, colors.HexColor("#0F172A")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("LINEBELOW", (0, -1), (-1, -1), 2, colors.HexColor("#0F172A")),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#ECFDF5")),
            ])
        )
        story.append(cf_table)
        story.append(build_signature_block(prepared_by=user_name))

        doc.build(story, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer
