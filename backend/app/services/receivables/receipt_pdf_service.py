"""
AQ COMPANIES — Authoritative Customer Receipt & Payment Allocation PDF Generator
Generates enterprise-grade A4 financial PDFs for posted receipts and draft previews
using ReportLab with precise double-entry reconciliation details and signature blocks.
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
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

from app.accounting import round_money


def format_money(val: Any) -> str:
    if val is None:
        return "$0.00"
    try:
        d = Decimal(str(val))
        return f"${d:,.2f}"
    except Exception:
        return "$0.00"


class ReceiptPDFService:
    @classmethod
    def generate_receipt_pdf(
        cls,
        customer_name: str,
        bank_name: str,
        account_number: str,
        receipt_date: Any,
        amount: Decimal,
        currency: str = "USD",
        reference: Optional[str] = None,
        mt103_reference: Optional[str] = None,
        notes: Optional[str] = None,
        receipt_number: Optional[str] = None,
        journal_number: Optional[str] = None,
        is_posted: bool = True,
        allocations: Optional[List[Dict[str, Any]]] = None,
        user_name: str = "Ahsanullah Qureshi",
    ) -> io.BytesIO:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        styles = getSampleStyleSheet()

        # Custom typography styles
        brand_title = ParagraphStyle(
            "BrandTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#0F172A"),
        )
        brand_subtitle = ParagraphStyle(
            "BrandSubtitle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#0284C7"),
        )
        doc_heading = ParagraphStyle(
            "DocHeading",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            textColor=colors.HexColor("#0F172A"),
            alignment=2,  # Right-aligned
        )
        badge_style = ParagraphStyle(
            "BadgeStyle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#166534") if is_posted else colors.HexColor("#B45309"),
            alignment=2,
        )
        section_heading = ParagraphStyle(
            "SectionHeading",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#0F172A"),
        )
        body_text = ParagraphStyle(
            "BodyText",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#334155"),
        )
        body_bold = ParagraphStyle(
            "BodyBold",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#0F172A"),
        )
        table_header = ParagraphStyle(
            "TableHeader",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#334155"),
        )
        table_cell = ParagraphStyle(
            "TableCell",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#0F172A"),
        )
        table_cell_right = ParagraphStyle(
            "TableCellRight",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#0F172A"),
            alignment=2,
        )
        table_cell_bold_right = ParagraphStyle(
            "TableCellBoldRight",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#0F172A"),
            alignment=2,
        )

        story = []

        # -------------------------------------------------------------
        # 1. HEADER & BRANDING
        # -------------------------------------------------------------
        badge_text = "● POSTED & RECONCILED" if is_posted else "▲ DRAFT — NOT POSTED"
        r_num = receipt_number or "DRAFT-PREVIEW"

        header_data = [
            [
                Paragraph("<b>AQ COMPANIES</b>", brand_title),
                Paragraph("<b>CUSTOMER RECEIPT &amp; ALLOCATION</b>", doc_heading),
            ],
            [
                Paragraph("Trading • Logistics • Accounting", brand_subtitle),
                Paragraph(f"<b>Receipt No:</b> {r_num}", body_text),
            ],
            [
                Paragraph("Kabul • Dubai • New Delhi", body_text),
                Paragraph(f"<b>Date:</b> {str(receipt_date)}", body_text),
            ],
            [
                Paragraph("", body_text),
                Paragraph(badge_text, badge_style),
            ],
        ]
        header_table = Table(header_data, colWidths=[280, 240])
        header_table.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 1),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ])
        )
        story.append(header_table)
        story.append(Spacer(1, 10))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0284C7"), spaceAfter=12))

        # -------------------------------------------------------------
        # 2. RECEIPT & PARTY INFORMATION BOX
        # -------------------------------------------------------------
        info_data = [
            [
                Paragraph("<b>CUSTOMER INFORMATION</b>", section_heading),
                Paragraph("<b>TREASURY / RECEIVING ACCOUNT</b>", section_heading),
            ],
            [
                Paragraph(f"<b>Customer:</b> {customer_name}", body_text),
                Paragraph(f"<b>Bank / Vault:</b> {bank_name}", body_text),
            ],
            [
                Paragraph("<b>Account Type:</b> Trade Customer (AR Control 1100)", body_text),
                Paragraph(f"<b>Account Number:</b> {account_number}", body_text),
            ],
            [
                Paragraph(f"<b>Reference:</b> {reference or 'N/A'}", body_text),
                Paragraph(f"<b>Currency:</b> {currency} (Base USD)", body_text),
            ],
            [
                Paragraph(f"<b>MT103 Reference:</b> {mt103_reference or 'N/A'}", body_text),
                Paragraph(f"<b>Journal Entry:</b> {journal_number or 'Auto-assigned upon post'}", body_text),
            ],
        ]
        info_table = Table(info_data, colWidths=[260, 260])
        info_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F8FAFC")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#E2E8F0")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#F1F5F9")),
            ])
        )
        story.append(info_table)
        story.append(Spacer(1, 14))

        # -------------------------------------------------------------
        # 3. INVOICE ALLOCATION TABLE
        # -------------------------------------------------------------
        story.append(Paragraph("<b>INVOICE PAYMENT ALLOCATIONS</b>", section_heading))
        story.append(Spacer(1, 6))

        alloc_rows = [
            [
                Paragraph("Invoice #", table_header),
                Paragraph("Date", table_header),
                Paragraph("Invoice Total", table_header),
                Paragraph("Prev Received", table_header),
                Paragraph("Allocated Now", table_header),
                Paragraph("Remaining Due", table_header),
            ]
        ]

        total_allocated = Decimal("0.00")
        if allocations:
            for a in allocations:
                inv_no = a.get("invoice_number") or f"INV-{a.get('invoice_id', 'N/A')}"
                inv_date = str(a.get("invoice_date") or a.get("date") or "—")
                inv_tot = Decimal(str(a.get("total_amount") or 0))
                prev_rec = Decimal(str(a.get("previously_received") or a.get("received") or 0))
                alloc_now = Decimal(str(a.get("allocated_amount") or a.get("amount") or 0))
                rem_due = inv_tot - prev_rec - alloc_now
                if rem_due < 0:
                    rem_due = Decimal("0.00")

                total_allocated += alloc_now

                alloc_rows.append([
                    Paragraph(inv_no, table_cell),
                    Paragraph(inv_date, table_cell),
                    Paragraph(format_money(inv_tot), table_cell_right),
                    Paragraph(format_money(prev_rec), table_cell_right),
                    Paragraph(f"<b>{format_money(alloc_now)}</b>", table_cell_bold_right),
                    Paragraph(format_money(rem_due), table_cell_right),
                ])
        else:
            alloc_rows.append([
                Paragraph("No individual invoice allocations specified (Full receipt credited to Customer Advance).", table_cell),
                Paragraph("", table_cell),
                Paragraph("", table_cell),
                Paragraph("", table_cell),
                Paragraph("$0.00", table_cell_right),
                Paragraph("$0.00", table_cell_right),
            ])

        alloc_table = Table(alloc_rows, colWidths=[90, 75, 85, 85, 95, 90])
        alloc_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#CBD5E1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ])
        )
        story.append(alloc_table)
        story.append(Spacer(1, 12))

        # -------------------------------------------------------------
        # 4. RECONCILIATION SUMMARY BOX
        # -------------------------------------------------------------
        receipt_amt = round_money(amount)
        unallocated_amt = receipt_amt - round_money(total_allocated)
        if unallocated_amt < Decimal("0.00"):
            unallocated_amt = Decimal("0.00")

        summary_data = [
            [
                Paragraph("<b>Total Receipt Amount:</b>", body_text),
                Paragraph(f"<b>{format_money(receipt_amt)}</b>", table_cell_bold_right),
            ],
            [
                Paragraph("<b>Total Allocated to Invoices (Dr Bank / Cr AR 1100):</b>", body_text),
                Paragraph(f"<b>{format_money(total_allocated)}</b>", table_cell_bold_right),
            ],
            [
                Paragraph("<b>Customer Advance Credit (Cr Advance Liability 2150):</b>", body_text),
                Paragraph(f"<b>{format_money(unallocated_amt)}</b>", table_cell_bold_right),
            ],
        ]
        summary_table = Table(summary_data, colWidths=[360, 160])
        summary_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#0284C7")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ])
        )
        story.append(summary_table)

        if notes:
            story.append(Spacer(1, 8))
            story.append(Paragraph(f"<b>Notes:</b> {notes}", body_text))

        story.append(Spacer(1, 24))

        # -------------------------------------------------------------
        # 5. SIGNATURE & VERIFICATION AREA
        # -------------------------------------------------------------
        sig_data = [
            [
                Paragraph("<b>Prepared By</b>", body_bold),
                Paragraph("<b>Approved By (Treasury)</b>", body_bold),
                Paragraph("<b>Customer / Representative</b>", body_bold),
            ],
            [
                Spacer(1, 32),
                Spacer(1, 32),
                Spacer(1, 32),
            ],
            [
                Paragraph(f"__________________________<br/>{user_name}", body_text),
                Paragraph("__________________________<br/>Authorized Signatory", body_text),
                Paragraph("__________________________<br/>Acknowledgment", body_text),
            ],
        ]
        sig_table = Table(sig_data, colWidths=[173, 173, 174])
        sig_table.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ])
        )
        story.append(KeepTogether(sig_table))

        story.append(Spacer(1, 14))
        gen_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        story.append(
            Paragraph(
                f"<font size=7 color='#64748B'>AQ COMPANIES Management System • Generated on {gen_time} • Official Financial Record</font>",
                ParagraphStyle("Foot", parent=styles["Normal"], alignment=1),
            )
        )

        doc.build(story)
        buffer.seek(0)
        return buffer
