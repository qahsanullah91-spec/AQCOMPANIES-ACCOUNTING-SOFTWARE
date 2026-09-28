"""
AQ COMPANIES — Official Receipt & Payment Voucher Generator
Supports:
- Customer Receipt Voucher (CRV)
- Supplier Payment Voucher (SPV)
- Transport Payment Voucher (TPV)
- Cash Receipt / Payment Voucher (CRV / CPV)
- Bank Receipt / Payment Voucher (BRV / BPV)
- Sarafi Receipt / Payment Voucher (SRV / SPV)
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
)


def number_to_words(number: Decimal) -> str:
    """Simple number-to-words for financial currency vouchers."""
    try:
        units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
        teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
        tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
        thousands = ["", "Thousand", "Million", "Billion"]

        num = int(abs(number))
        cents = int((abs(number) - num) * 100)

        if num == 0:
            words = "Zero"
        else:
            def convert_chunk(n):
                chunk = ""
                h = n // 100
                r = n % 100
                if h > 0:
                    chunk += f"{units[h]} Hundred "
                if r >= 20:
                    chunk += f"{tens[r // 10]} {units[r % 10]} "
                elif r >= 10:
                    chunk += f"{teens[r - 10]} "
                elif r > 0:
                    chunk += f"{units[r]} "
                return chunk.strip()

            parts = []
            chunk_idx = 0
            while num > 0:
                chunk = num % 1000
                if chunk > 0:
                    chunk_words = convert_chunk(chunk)
                    unit = thousands[chunk_idx]
                    parts.insert(0, f"{chunk_words} {unit}".strip())
                num = num // 1000
                chunk_idx += 1
            words = " ".join(parts)

        return f"{words} and {cents:02d}/100 Cents Only"
    except Exception:
        return f"{number:,.2f}"


class VoucherPDFReports:
    @classmethod
    def generate_voucher(
        cls,
        voucher_type: str,
        voucher_number: str,
        voucher_date: Any,
        party_name: str,
        party_type: str,
        amount: Decimal,
        currency: str = "USD",
        account_name: str = "Main Operating Bank",
        reference: Optional[str] = None,
        description: Optional[str] = None,
        journal_number: Optional[str] = None,
        allocations: Optional[List[Dict[str, Any]]] = None,
        is_posted: bool = True,
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

        date_str = str(voucher_date) if voucher_date else datetime.now().strftime("%Y-%m-%d")
        story.append(build_corporate_header(
            report_title=voucher_type,
            doc_number=voucher_number,
            period_str=date_str,
            currency=currency,
            is_draft=not is_posted,
        ))
        story.append(Spacer(1, 14))

        words = number_to_words(amount)

        # Voucher Main Particulars Table
        grid_data = [
            [
                Paragraph("<b>VOUCHER NUMBER:</b>", st["table_td"]),
                Paragraph(f"<b>{voucher_number}</b>", st["table_td"]),
                Paragraph("<b>DATE OF ISSUE:</b>", st["table_td"]),
                Paragraph(f"<b>{date_str}</b>", st["table_td"]),
            ],
            [
                Paragraph(f"<b>{party_type.upper()}:</b>", st["table_td"]),
                Paragraph(f"<b>{party_name}</b>", st["table_td"]),
                Paragraph("<b>JOURNAL REF:</b>", st["table_td"]),
                Paragraph(str(journal_number or "AUTO-POSTED"), st["table_td"]),
            ],
            [
                Paragraph("<b>ACCOUNT / METHOD:</b>", st["table_td"]),
                Paragraph(str(account_name), st["table_td"]),
                Paragraph("<b>REFERENCE / NO:</b>", st["table_td"]),
                Paragraph(str(reference or "N/A"), st["table_td"]),
            ],
            [
                Paragraph("<b>AMOUNT IN WORDS:</b>", st["table_td"]),
                Paragraph(f"<i>{words}</i>", st["table_td"]),
                Paragraph("<b>NET AMOUNT:</b>", st["table_th"]),
                Paragraph(f"<font size='10'><b>{format_money(amount, currency)}</b></font>", st["table_th_right"]),
            ],
            [
                Paragraph("<b>MEMO / DESCRIPTION:</b>", st["table_td"]),
                Paragraph(str(description or "Official settlement transaction entered in AQ Companies ledger."), st["table_td"]),
                Paragraph("<b>POSTING STATUS:</b>", st["table_td"]),
                Paragraph(f"<b>{'POSTED & FINAL' if is_posted else 'DRAFT'}</b>", st["credit_highlight"] if is_posted else st["badge_draft"]),
            ],
        ]

        voucher_table = Table(grid_data, colWidths=[120, 160, 120, 123.27])
        voucher_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#0284C7")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("BACKGROUND", (2, 3), (3, 3), colors.HexColor("#ECFDF5")),
            ])
        )
        story.append(voucher_table)
        story.append(Spacer(1, 14))

        # Itemized Allocations Table if present
        if allocations and len(allocations) > 0:
            alloc_title = Paragraph("<b>ITEMIZED INVOICE / SETTLEMENT ALLOCATIONS:</b>", st["table_th"])
            story.append(alloc_title)
            story.append(Spacer(1, 4))

            alloc_rows = [
                [
                    Paragraph("INVOICE NO", st["table_th"]),
                    Paragraph("DATE", st["table_th"]),
                    Paragraph("INVOICE TOTAL", st["table_th_right"]),
                    Paragraph("PREV RECEIVED", st["table_th_right"]),
                    Paragraph("ALLOCATED NOW", st["table_th_right"]),
                ]
            ]

            for a in allocations:
                inv_total = Decimal(str(a.get("total_amount", 0) or 0))
                prev_rec = Decimal(str(a.get("previously_received", 0) or 0))
                alloc_amt = Decimal(str(a.get("allocated_amount", 0) or 0))

                alloc_rows.append([
                    Paragraph(str(a.get("invoice_number", "—")), st["table_td"]),
                    Paragraph(str(a.get("date", "—")), st["table_td"]),
                    Paragraph(format_money(inv_total, currency), st["table_td_right"]),
                    Paragraph(format_money(prev_rec, currency), st["table_td_right"]),
                    Paragraph(f"<b>{format_money(alloc_amt, currency)}</b>", st["table_th_right"]),
                ])

            alloc_table = Table(alloc_rows, colWidths=[110, 80, 110, 110, 113.27])
            alloc_table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
                    ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#CBD5E1")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ])
            )
            story.append(alloc_table)
            story.append(Spacer(1, 14))

        # Voucher Signatures (Prepared, Approved, Received)
        sig_data = [
            [
                Paragraph(f"<b>PREPARED BY:</b><br/>{user_name}<br/><font color='#64748B' size='7'>Accounts Officer</font>", st["table_td"]),
                Paragraph("<b>APPROVED BY:</b><br/>___________________<br/><font color='#64748B' size='7'>Finance Controller</font>", st["table_td"]),
                Paragraph(f"<b>RECEIVED BY:</b><br/>{party_name}<br/><font color='#64748B' size='7'>Beneficiary / Authorized Agent</font>", st["table_td"]),
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
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("LINEABOVE", (0, 0), (-1, 0), 1, colors.HexColor("#CBD5E1")),
            ])
        )
        story.append(KeepTogether([Spacer(1, 10), sig_table]))

        doc.build(story, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer
