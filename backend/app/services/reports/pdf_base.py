"""
AQ COMPANIES — Authoritative PDF Report Engine (Base & Utilities)
Built on ReportLab with high-fidelity corporate styling, NumberedCanvas (Page X of Y),
dynamic company branding, and double-entry accounting presentation standards.
"""

import io
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Dict, Any

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and stamp exact total page count ('Page X of Y')
    along with authoritative timestamp and confidentiality notices.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_footer(num_pages)
            super().showPage()
        super().save()

    def draw_footer(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))

        # Footer divider line
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.75)
        self.line(36, 42, 595.27 - 36, 42)

        # Left: Timestamp and System Authority
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.drawString(36, 28, f"AQ COMPANIES ERP • Authoritative Ledger • Generated: {timestamp}")

        # Right: Exact Page Count
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(595.27 - 36, 28, page_str)

        # Center: Confidentiality notice
        self.drawCentredString(595.27 / 2.0, 16, "CONFIDENTIAL — STRICTLY FOR INTERNAL & AUTHORIZED AUDIT USE")

        self.restoreState()


def format_money(val: Any, currency: str = "USD") -> str:
    """Formats values with 2 decimal places and thousands separator, handling negative accounting balances."""
    if val is None:
        return "$0.00" if currency == "USD" else f"0.00 {currency}"
    try:
        d = Decimal(str(val))
        if currency == "USD":
            if d < 0:
                return f"-${abs(d):,.2f}"
            return f"${d:,.2f}"
        else:
            if d < 0:
                return f"-{abs(d):,.2f} {currency}"
            return f"{d:,.2f} {currency}"
    except Exception:
        return f"{val} {currency}"


def get_corporate_styles():
    """Generates standard styles sheet for corporate reports."""
    styles = getSampleStyleSheet()

    company_title = ParagraphStyle(
        "CompanyTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=colors.HexColor("#0F172A"),
    )

    company_subtitle = ParagraphStyle(
        "CompanySubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#0284C7"),
    )

    company_address = ParagraphStyle(
        "CompanyAddress",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#64748B"),
    )

    doc_title = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#0F172A"),
        alignment=2,  # Right
    )

    meta_label = ParagraphStyle(
        "MetaLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9,
        textColor=colors.HexColor("#64748B"),
        alignment=2,
    )

    meta_val = ParagraphStyle(
        "MetaVal",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0F172A"),
        alignment=2,
    )

    table_th = ParagraphStyle(
        "TableTH",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#0F172A"),
    )

    table_th_right = ParagraphStyle(
        "TableTHRight",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#0F172A"),
        alignment=2,
    )

    table_td = ParagraphStyle(
        "TableTD",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#1E293B"),
    )

    table_td_right = ParagraphStyle(
        "TableTDRight",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#1E293B"),
        alignment=2,
    )

    badge_posted = ParagraphStyle(
        "BadgePosted",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#047857"),
        alignment=2,
    )

    badge_draft = ParagraphStyle(
        "BadgeDraft",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#B45309"),
        alignment=2,
    )

    credit_highlight = ParagraphStyle(
        "CreditHighlight",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#047857"),
    )

    return {
        "styles": styles,
        "company_title": company_title,
        "company_subtitle": company_subtitle,
        "company_address": company_address,
        "doc_title": doc_title,
        "meta_label": meta_label,
        "meta_val": meta_val,
        "table_th": table_th,
        "table_th_right": table_th_right,
        "table_td": table_td,
        "table_td_right": table_td_right,
        "badge_posted": badge_posted,
        "badge_draft": badge_draft,
        "credit_highlight": credit_highlight,
    }


def build_corporate_header(
    report_title: str,
    doc_number: Optional[str] = None,
    period_str: Optional[str] = None,
    currency: str = "USD",
    is_draft: bool = False,
    company_name: str = "AQ COMPANIES",
    company_subtitle: str = "Dry Fruit Trading, Commercial Export & Logistics",
) -> Table:
    """Builds a standardized corporate header block spanning full width."""
    st = get_corporate_styles()

    left_block = [
        Paragraph(company_name, st["company_title"]),
        Spacer(1, 2),
        Paragraph(company_subtitle, st["company_subtitle"]),
        Spacer(1, 2),
        Paragraph("Kabul, Afghanistan • UAE • Mumbai / Delhi, India | Licensed Dry Fruit Commodity Operations", st["company_address"]),
    ]

    status_badge = (
        Paragraph("● DRAFT / AUDIT PREVIEW", st["badge_draft"])
        if is_draft
        else Paragraph("● AUTHORITATIVE / POSTED", st["badge_posted"])
    )

    right_block = [
        Paragraph(report_title.upper(), st["doc_title"]),
        Spacer(1, 3),
        status_badge,
        Spacer(1, 3),
    ]

    if doc_number:
        right_block.append(Paragraph(f"<b>Doc Ref:</b> {doc_number}", st["meta_val"]))
    if period_str:
        right_block.append(Paragraph(f"<b>Period:</b> {period_str}", st["meta_val"]))
    right_block.append(Paragraph(f"<b>Currency:</b> {currency}", st["meta_val"]))

    header_table = Table([[left_block, right_block]], colWidths=[330, 193.27])
    header_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ])
    )
    return header_table


def build_signature_block(prepared_by: str = "Ahsanullah Qureshi") -> KeepTogether:
    """Generates standard dual or triple authorization signature lines."""
    st = get_corporate_styles()
    sig_data = [
        [
            Paragraph(f"<b>Prepared By:</b> {prepared_by}<br/><font color='#64748B' size='7'>Chief Accountant / Controller</font>", st["table_td"]),
            Paragraph("<b>Verified By:</b> ___________________<br/><font color='#64748B' size='7'>Senior Financial Auditor</font>", st["table_td"]),
            Paragraph("<b>Approved By:</b> ___________________<br/><font color='#64748B' size='7'>Managing Director / Executive Board</font>", st["table_td"]),
        ],
        [
            Paragraph("Signature: ______________________", st["table_td"]),
            Paragraph("Signature: ______________________", st["table_td"]),
            Paragraph("Signature: ______________________", st["table_td"]),
        ],
    ]
    sig_table = Table(sig_data, colWidths=[174, 174, 175.27])
    sig_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("LINEABOVE", (0, 0), (-1, 0), 0.75, colors.HexColor("#CBD5E1")),
        ])
    )
    return KeepTogether([Spacer(1, 14), sig_table])
