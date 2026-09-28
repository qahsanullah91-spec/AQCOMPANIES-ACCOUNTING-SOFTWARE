import os
import re
import csv
import json
import hashlib
from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, desc

from app import models
from app.accounting_engine import (
    round_money,
    create_journal_entry,
    recalculate_bank_running_balance,
    check_period_open,
    get_account_by_code,
)


# =====================================================================
# 1. FILE HASHING & DATA NORMALIZATION
# =====================================================================

def calculate_file_sha256(content: bytes) -> str:
    """Calculates SHA-256 hash of file bytes for duplicate file prevention."""
    return hashlib.sha256(content).hexdigest()


def normalize_amount_str(raw: Any) -> Decimal:
    """
    Safely normalizes varied money formats:
    - "$74,750.00" -> 74750.00
    - "74,750" -> 74750.00
    - "(500.00)" -> -500.00
    - "-$1,250.50" -> -1250.50
    """
    if raw is None:
        return Decimal("0.00")
    if isinstance(raw, (int, float, Decimal)):
        return round_money(raw)

    s = str(raw).strip()
    if not s:
        return Decimal("0.00")

    is_negative = False
    if s.startswith("(") and s.endswith(")"):
        is_negative = True
        s = s[1:-1].strip()
    elif s.startswith("-"):
        is_negative = True
        s = s[1:].strip()

    # Remove currency symbols and formatting commas
    s = re.sub(r"[^\d.]", "", s)
    if not s:
        return Decimal("0.00")

    try:
        val = Decimal(s)
        if is_negative:
            val = -val
        return round_money(val)
    except Exception:
        return Decimal("0.00")


def parse_flexible_date(date_str: str) -> date:
    """Parses various date formats: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, etc."""
    s = str(date_str).strip()
    formats = [
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%d-%m-%Y",
        "%d.%m.%Y",
        "%Y/%m/%d",
        "%b %d, %Y",
        "%d %b %Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    # Default fallback to today
    return date.today()


# =====================================================================
# 2. PARSE BANK STATEMENT FILE & DETECT DUPLICATES
# =====================================================================

def parse_bank_statement_file(
    db: Session,
    bank_account_id: int,
    file_bytes: bytes,
    file_name: str,
    mapping_profile_id: Optional[int] = None,
    user_name: str = "Admin",
) -> Dict[str, Any]:
    """
    Step 1: Check SHA-256 for file duplicate prevention.
    Step 2: Parse rows (CSV, JSON, TXT).
    Step 3: Detect row-level duplicates.
    Step 4: Suggest matches and confidence scores.
    Step 5: Return preview WITHOUT committing to accounting.
    """
    b_acc = db.query(models.BankAccount).filter(models.BankAccount.id == bank_account_id).first()
    if not b_acc:
        raise ValueError(f"Bank Account #{bank_account_id} not found.")

    file_hash = calculate_file_sha256(file_bytes)

    # Duplicate file check
    existing_batch = (
        db.query(models.BankImportBatch)
        .filter(models.BankImportBatch.file_hash == file_hash)
        .first()
    )
    if existing_batch:
        return {
            "is_duplicate_file": True,
            "error": f"DUPLICATE BANK STATEMENT FILE: File '{file_name}' was already imported under Batch {existing_batch.batch_number} on {existing_batch.uploaded_at.strftime('%Y-%m-%d %H:%M')}.",
            "existing_batch_number": existing_batch.batch_number,
            "file_hash": file_hash,
            "rows": [],
        }

    # Fetch mapping profile
    mapping = None
    if mapping_profile_id:
        mapping = db.query(models.BankMappingProfile).filter(models.BankMappingProfile.id == mapping_profile_id).first()

    # Raw row decoding
    text_content = ""
    for enc in ["utf-8-sig", "utf-8", "latin-1", "cp1252"]:
        try:
            text_content = file_bytes.decode(enc)
            break
        except UnicodeDecodeError:
            continue

    if not text_content:
        raise ValueError("Could not decode file content. Please check file encoding.")

    parsed_rows: List[Dict[str, Any]] = []

    # Detect JSON
    if text_content.strip().startswith("[") and text_content.strip().endswith("]"):
        try:
            json_data = json.loads(text_content)
            for r in json_data:
                parsed_rows.append(r)
        except Exception:
            pass

    # Detect CSV
    if not parsed_rows:
        try:
            reader = csv.DictReader(text_content.splitlines(), skipinitialspace=True)
            for row in reader:
                parsed_rows.append(row)
        except Exception as e:
            raise ValueError(f"Error parsing CSV rows: {str(e)}")

    if not parsed_rows:
        raise ValueError("No valid transaction rows found in uploaded statement.")

    # Process and classify rows
    processed_rows = []
    total_in = Decimal("0.00")
    total_out = Decimal("0.00")
    duplicate_rows_count = 0

    # Cache existing transactions and invoices for fast matching
    existing_txs = (
        db.query(models.BankTransaction)
        .filter(models.BankTransaction.bank_account_id == b_acc.id)
        .all()
    )
    open_invoices = (
        db.query(models.Invoice)
        .filter(models.Invoice.balance_due > Decimal("0.00"))
        .all()
    )
    customers = db.query(models.Customer).all()
    transport_cos = db.query(models.TransportCompany).all()
    rules = db.query(models.BankMatchingRule).filter(models.BankMatchingRule.is_active == True).all()

    for idx, r in enumerate(parsed_rows, start=1):
        # Apply mapping or key extraction
        date_raw = r.get("date") or r.get("Date") or r.get("transaction_date") or r.get("Transaction Date") or str(date.today())
        desc_raw = r.get("description") or r.get("Description") or r.get("Narration") or r.get("details") or ""
        ref_raw = r.get("reference") or r.get("Reference") or r.get("Ref") or r.get("Cheque No") or r.get("transaction_id") or ""
        debit_raw = r.get("debit") or r.get("Debit") or r.get("money_out") or r.get("Withdrawals") or 0
        credit_raw = r.get("credit") or r.get("Credit") or r.get("money_in") or r.get("Deposits") or 0
        bal_raw = r.get("balance") or r.get("Balance") or r.get("Running Balance")

        row_date = parse_flexible_date(date_raw)
        row_debit = normalize_amount_str(debit_raw)
        row_credit = normalize_amount_str(credit_raw)
        row_bal = normalize_amount_str(bal_raw) if bal_raw is not None else None

        # Handle signed amount column if debit/credit are zero
        if row_debit == 0 and row_credit == 0 and ("amount" in r or "Amount" in r):
            amt = normalize_amount_str(r.get("amount") or r.get("Amount"))
            if amt > 0:
                row_credit = amt
            else:
                row_debit = abs(amt)

        total_in += row_credit
        total_out += row_debit

        # Check row duplicate in existing bank_transactions or bank_statement_lines
        is_row_duplicate = False
        duplicate_reason = ""
        for tx in existing_txs:
            tx_in = round_money(tx.usd_equivalent_in or tx.money_in)
            tx_out = round_money(tx.usd_equivalent_out or tx.money_out)
            if (
                tx.date == row_date
                and tx_in == row_credit
                and tx_out == row_debit
                and ref_raw
                and tx.transaction_reference
                and ref_raw.strip().lower() == tx.transaction_reference.strip().lower()
            ):
                is_row_duplicate = True
                duplicate_reason = f"Duplicate of posted ledger transaction {tx.transaction_code} on {tx.date}"
                duplicate_rows_count += 1
                break

        # Run Transaction Matching Engine
        match_result = match_statement_row(
            db=db,
            b_acc=b_acc,
            row_date=row_date,
            description=desc_raw,
            reference=ref_raw,
            debit=row_debit,
            credit=row_credit,
            open_invoices=open_invoices,
            customers=customers,
            transport_cos=transport_cos,
            rules=rules,
            existing_txs=existing_txs,
            is_duplicate=is_row_duplicate,
        )

        processed_rows.append({
            "row_index": idx,
            "date": str(row_date),
            "description": desc_raw,
            "reference": ref_raw,
            "currency": b_acc.currency,
            "debit": float(row_debit),
            "credit": float(row_credit),
            "balance": float(row_bal) if row_bal is not None else None,
            "is_duplicate": is_row_duplicate,
            "duplicate_reason": duplicate_reason,
            "match_status": match_result.get("match_status", "UNMATCHED"),
            "confidence_score": match_result.get("confidence_score", 0),
            "matching_reasons": match_result.get("matching_reasons", []),
            "suggested_type": match_result.get("suggested_type", "OTHER"),
            "suggested_party_type": match_result.get("suggested_party_type"),
            "suggested_party_id": match_result.get("suggested_party_id"),
            "suggested_party_name": match_result.get("suggested_party_name"),
            "suggested_invoice_id": match_result.get("suggested_invoice_id"),
            "suggested_invoice_number": match_result.get("suggested_invoice_number"),
            "matched_transaction_id": match_result.get("matched_transaction_id"),
            "allocations_plan": match_result.get("allocations_plan", []),
            "raw_source_data": json.dumps(r),
        })

    return {
        "is_duplicate_file": False,
        "file_name": file_name,
        "file_hash": file_hash,
        "bank_account_id": b_acc.id,
        "bank_name": b_acc.bank_name,
        "currency": b_acc.currency,
        "total_rows": len(processed_rows),
        "total_money_in": float(round_money(total_in)),
        "total_money_out": float(round_money(total_out)),
        "duplicate_rows_detected": duplicate_rows_count,
        "rows": processed_rows,
    }


# =====================================================================
# 3. TRANSACTION MATCHING & CONFIDENCE SCORING ENGINE
# =====================================================================

def match_statement_row(
    db: Session,
    b_acc: models.BankAccount,
    row_date: date,
    description: str,
    reference: str,
    debit: Decimal,
    credit: Decimal,
    open_invoices: List[models.Invoice],
    customers: List[models.Customer],
    transport_cos: List[models.TransportCompany],
    rules: List[models.BankMatchingRule],
    existing_txs: List[models.BankTransaction],
    is_duplicate: bool = False,
) -> Dict[str, Any]:
    """
    Transparent scoring model according to Section 8 & 9:
    - Invoice number found in ref/desc: +50
    - Customer name matched: +20
    - Exact amount: +20
    - Date close to invoice: +5
    - Reference match: +20
    - Possible duplicate: -50
    - Outgoing payments: Sky Ariana transport match, bank charges, supplier matching.
    """
    score = 0
    reasons = []
    combined_text = f"{description} {reference}".upper()

    suggested_type = "OTHER"
    suggested_party_type = None
    suggested_party_id = None
    suggested_party_name = None
    suggested_invoice_id = None
    suggested_invoice_number = None
    matched_tx_id = None
    allocations_plan = []

    if is_duplicate:
        score -= 50
        reasons.append("Identified as probable duplicate transaction (-50)")

    # -------------------------------------------------------------
    # CASE A: MONEY IN (Customer Receipt / Advance / Incoming Wire)
    # -------------------------------------------------------------
    if credit > Decimal("0.00"):
        suggested_type = "CUSTOMER_RECEIPT"

        # Check existing BankTransactions for exact pre-recorded match
        for tx in existing_txs:
            tx_in = round_money(tx.usd_equivalent_in or tx.money_in)
            if tx_in == credit and abs((tx.date - row_date).days) <= 3:
                if reference and tx.transaction_reference and reference.strip().lower() in tx.transaction_reference.strip().lower():
                    matched_tx_id = tx.id
                    score = 98
                    reasons.append(f"Matched existing ledger receipt {tx.transaction_code} (+98)")
                    return {
                        "match_status": "EXACT_MATCH",
                        "confidence_score": 98,
                        "matching_reasons": reasons,
                        "suggested_type": "CUSTOMER_RECEIPT",
                        "suggested_party_type": tx.party_type,
                        "suggested_party_id": tx.party_id,
                        "suggested_party_name": tx.party_name,
                        "suggested_invoice_id": None,
                        "suggested_invoice_number": None,
                        "matched_transaction_id": tx.id,
                    }

        # 1. Look for Invoice Number in text (e.g. "INV-01", "001", "COMMERCIAL INVOICE")
        matched_invoice = None
        for inv in open_invoices:
            inv_clean = inv.invoice_number.strip().upper()
            if inv_clean in combined_text or (len(inv_clean) > 3 and inv_clean[-4:] in combined_text):
                matched_invoice = inv
                score += 50
                reasons.append(f"Invoice number '{inv.invoice_number}' detected in description/ref (+50)")
                break

        # 2. Look for Customer Name in text
        matched_customer = None
        for c in customers:
            # Check full name or key tokens (e.g. "JAYANTI", "MANIK", "ANAS", "BAJRANG")
            c_name = c.customer_name.strip().upper()
            tokens = [t for t in re.split(r"\s+", c_name) if len(t) > 3 and t not in ("LTD", "LIMITED", "PVT", "INDIA", "TRADERS", "COMPANY")]
            name_match = (c_name in combined_text) or any(t in combined_text for t in tokens)
            if name_match:
                matched_customer = c
                score += 20
                reasons.append(f"Customer name match '{c.customer_name}' (+20)")
                break

        # If invoice was found, infer customer
        if matched_invoice and not matched_customer:
            matched_customer = matched_invoice.customer

        # If customer found but not invoice, check exact balance_due among their invoices
        if matched_customer and not matched_invoice:
            cust_invoices = [i for i in open_invoices if i.customer_id == matched_customer.id]
            for i in cust_invoices:
                if round_money(i.balance_due) == credit:
                    matched_invoice = i
                    score += 30
                    reasons.append(f"Exact matching outstanding balance on invoice {i.invoice_number} (+30)")
                    break

        # 3. Check exact amount match
        if matched_invoice:
            if round_money(matched_invoice.balance_due) == credit:
                score += 20
                reasons.append(f"Exact payment amount matches invoice balance (${credit:,.2f}) (+20)")
            elif credit < round_money(matched_invoice.balance_due):
                score += 15
                reasons.append(f"Partial payment against invoice balance (${matched_invoice.balance_due:,.2f}) (+15)")
            else:
                score += 10
                reasons.append(f"Payment exceeds invoice balance (excess will credit Customer Advance) (+10)")

            # Check date proximity
            if matched_invoice.date and abs((row_date - matched_invoice.date).days) <= 15:
                score += 5
                reasons.append("Payment date is close to invoice billing date (+5)")

            suggested_party_type = "CUSTOMER"
            suggested_party_id = matched_customer.id if matched_customer else matched_invoice.customer_id
            suggested_party_name = matched_customer.customer_name if matched_customer else (matched_invoice.customer.customer_name if matched_invoice.customer else "Customer")
            suggested_invoice_id = matched_invoice.id
            suggested_invoice_number = matched_invoice.invoice_number

            # Suggest allocation plan
            alloc_amt = min(credit, round_money(matched_invoice.balance_due))
            excess = max(Decimal("0.00"), credit - alloc_amt)
            allocations_plan.append({
                "invoice_id": matched_invoice.id,
                "invoice_number": matched_invoice.invoice_number,
                "allocated_amount": float(alloc_amt),
                "type": "INVOICE_SETTLEMENT",
            })
            if excess > 0:
                allocations_plan.append({
                    "invoice_id": None,
                    "invoice_number": "CUSTOMER_ADVANCE (Account 2150)",
                    "allocated_amount": float(excess),
                    "type": "ADVANCE",
                })

        elif matched_customer:
            # Customer identified, but no single invoice matches
            suggested_party_type = "CUSTOMER"
            suggested_party_id = matched_customer.id
            suggested_party_name = matched_customer.customer_name
            cust_invoices = sorted(
                [i for i in open_invoices if i.customer_id == matched_customer.id],
                key=lambda x: x.date or dt_date.today()
            )
            if cust_invoices:
                score += 45
                reasons.append(f"Identified customer with {len(cust_invoices)} open invoice(s) (+45)")
            else:
                score += 30
                reasons.append("Identified customer with no open invoices -> Customer Advance (+30)")
            rem = credit
            for inv in cust_invoices:
                if rem <= 0:
                    break
                due = round_money(inv.balance_due)
                alloc = min(due, rem)
                allocations_plan.append({
                    "invoice_id": inv.id,
                    "invoice_number": inv.invoice_number,
                    "allocated_amount": float(alloc),
                    "type": "INVOICE_SETTLEMENT",
                })
                rem -= alloc

            if rem > 0:
                allocations_plan.append({
                    "invoice_id": None,
                    "invoice_number": "CUSTOMER_ADVANCE (Account 2150)",
                    "allocated_amount": float(rem),
                    "type": "ADVANCE",
                })
        else:
            # Unknown incoming money -> suggest Account 1090 Unidentified Receipts Suspense
            reasons.append("Unidentified counterparty. Suggest routing to Account 1090 (Suspense)")
            suggested_party_type = "UNKNOWN"
            suggested_party_name = "Unidentified Remitter"
            suggested_type = "SUSPENSE_RECEIPT"

    # -------------------------------------------------------------
    # CASE B: MONEY OUT (Disbursements, Transports, Suppliers, Fees)
    # -------------------------------------------------------------
    elif debit > Decimal("0.00"):
        # Check Smart Rules first
        for rule in rules:
            if rule.pattern_value.upper() in combined_text and rule.direction in ("OUT", "ANY"):
                score += 30
                reasons.append(f"Matched Smart Rule '{rule.rule_name}' (+30)")
                suggested_type = rule.target_transaction_type
                suggested_party_type = rule.target_party_type
                suggested_party_name = rule.target_party_name
                suggested_party_id = rule.target_party_id

        # 1. Transport payments (Sky Ariana)
        if "SKY ARIANA" in combined_text or "TRANSPORT" in combined_text or "FREIGHT" in combined_text:
            score += 40
            reasons.append("Transport carrier 'Sky Ariana Limited' matched in details (+40)")
            suggested_type = "TRANSPORT_PAYMENT"
            suggested_party_type = "TRANSPORT"
            if transport_cos:
                suggested_party_id = transport_cos[0].id
                suggested_party_name = transport_cos[0].company_name

            # Check existing transport payment in DB to PREVENT DUPLICATES!
            for tx in existing_txs:
                tx_out = round_money(tx.usd_equivalent_out or tx.money_out)
                if tx_out == debit and abs((tx.date - row_date).days) <= 30:
                    matched_tx_id = tx.id
                    score = 99
                    reasons.append(f"Exact match to recorded Transport Wire {tx.transaction_code} (${debit:,.2f}) — DO NOT DUPLICATE (+99)")
                    return {
                        "match_status": "EXACT_MATCH",
                        "confidence_score": 99,
                        "matching_reasons": reasons,
                        "suggested_type": "TRANSPORT_PAYMENT",
                        "suggested_party_type": "TRANSPORT",
                        "suggested_party_id": suggested_party_id,
                        "suggested_party_name": suggested_party_name,
                        "suggested_invoice_id": None,
                        "suggested_invoice_number": None,
                        "matched_transaction_id": tx.id,
                        "allocations_plan": [],
                    }

        # 2. Bank Charges & SWIFT Fees
        fee_keywords = ["FEE", "CHARGE", "COMMISSION", "SWIFT", "SERVICE CHG", "TRANSFER CHG", "BANK CHG"]
        if any(kw in combined_text for kw in fee_keywords):
            score += 45
            reasons.append("Bank fee/commission wording detected -> 5600 Bank Charges (+45)")
            suggested_type = "BANK_CHARGE"
            suggested_party_type = "BANK"
            suggested_party_name = b_acc.bank_name

        # 3. Supplier Matching
        suppliers = db.query(models.Supplier).all()
        for s in suppliers:
            s_name = s.supplier_name.strip().upper()
            if len(s_name) > 3 and s_name in combined_text:
                score += 35
                reasons.append(f"Supplier '{s.supplier_name}' recognized in wire transfer (+35)")
                suggested_type = "SUPPLIER_PAYMENT"
                suggested_party_type = "SUPPLIER"
                suggested_party_id = s.id
                suggested_party_name = s.supplier_name
                break

    # Determine status based on confidence score
    score = max(0, min(100, score))
    if matched_tx_id or score >= 90:
        match_status = "EXACT_MATCH"
    elif score >= 70:
        match_status = "HIGH_CONFIDENCE"
    elif score >= 35:
        match_status = "POSSIBLE_MATCH"
    else:
        match_status = "UNMATCHED"

    return {
        "match_status": match_status,
        "confidence_score": score,
        "matching_reasons": reasons,
        "suggested_type": suggested_type,
        "suggested_party_type": suggested_party_type,
        "suggested_party_id": suggested_party_id,
        "suggested_party_name": suggested_party_name,
        "suggested_invoice_id": suggested_invoice_id,
        "suggested_invoice_number": suggested_invoice_number,
        "matched_transaction_id": matched_tx_id,
        "allocations_plan": allocations_plan,
    }


# =====================================================================
# 4. COMMIT IMPORT BATCH & STAGE STATEMENT LINES
# =====================================================================

def commit_statement_batch(
    db: Session,
    bank_account_id: int,
    file_name: str,
    file_hash: str,
    rows: List[Dict[str, Any]],
    user_name: str = "Admin",
    notes: Optional[str] = None,
) -> models.BankImportBatch:
    """
    Saves parsed bank statement rows to `bank_statement_lines` staged under a new `BankImportBatch`.
    DOES NOT automatically post until review/confirmation!
    """
    b_acc = db.query(models.BankAccount).filter(models.BankAccount.id == bank_account_id).first()
    if not b_acc:
        raise ValueError(f"Bank Account #{bank_account_id} not found.")

    count = db.query(models.BankImportBatch).count()
    batch_num = f"BATCH-{date.today().strftime('%Y%m%d')}-{count + 1:04d}"

    start_date = None
    end_date = None
    dates = []
    for r in rows:
        try:
            d = datetime.strptime(str(r["date"]), "%Y-%m-%d").date()
            dates.append(d)
        except Exception:
            pass

    if dates:
        start_date = min(dates)
        end_date = max(dates)

    batch = models.BankImportBatch(
        batch_number=batch_num,
        bank_account_id=b_acc.id,
        file_name=file_name,
        file_hash=file_hash,
        statement_start_date=start_date,
        statement_end_date=end_date,
        opening_balance=b_acc.current_balance,
        currency=b_acc.currency,
        total_rows=len(rows),
        matched_rows=0,
        status="READY_FOR_REVIEW",
        uploaded_by=user_name,
        uploaded_at=datetime.utcnow(),
        notes=notes,
    )
    db.add(batch)
    db.flush()

    for r in rows:
        r_date = parse_flexible_date(r.get("date", str(date.today())))
        debit = round_money(r.get("debit", 0))
        credit = round_money(r.get("credit", 0))
        norm_amt = credit if credit > 0 else debit

        line = models.BankStatementLine(
            batch_id=batch.id,
            bank_account_id=b_acc.id,
            date=r_date,
            transaction_date=r_date,
            description=r.get("description", ""),
            reference=r.get("reference"),
            currency=b_acc.currency,
            debit=debit,
            credit=credit,
            money_in=credit,
            money_out=debit,
            amount=norm_amt,
            balance=round_money(r.get("balance", 0)) if r.get("balance") is not None else None,
            normalized_amount=norm_amt,
            match_status=r.get("match_status", "UNMATCHED"),
            confidence_score=r.get("confidence_score", 0),
            matching_reasons=json.dumps(r.get("matching_reasons", [])),
            suggested_type=r.get("suggested_type"),
            suggested_party_type=r.get("suggested_party_type"),
            suggested_party_id=r.get("suggested_party_id"),
            suggested_party_name=r.get("suggested_party_name"),
            suggested_invoice_id=r.get("suggested_invoice_id"),
            suggested_invoice_number=r.get("suggested_invoice_number"),
            raw_source_data=r.get("raw_source_data"),
            created_at=datetime.utcnow(),
        )
        db.add(line)

    db.commit()
    db.refresh(batch)
    return batch


# =====================================================================
# 5. ATOMIC CONFIRM & POST PAYMENT / RECONCILIATION MATCH
# =====================================================================

def atomic_confirm_and_post_match(
    db: Session,
    statement_line_id: int,
    action_type: str,  # CONFIRM_MATCH, CUSTOMER_RECEIPT, CUSTOMER_ADVANCE, UNIDENTIFIED_SUSPENSE, TRANSPORT_PAYMENT, BANK_CHARGE, LINK_EXISTING
    customer_id: Optional[int] = None,
    invoice_allocations: Optional[List[Dict[str, Any]]] = None,
    existing_transaction_id: Optional[int] = None,
    user_name: str = "Admin",
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Section 37: ATOMIC POSTING
    Wraps entire financial posting in a single database transaction:
    - Creates or links BankTransaction
    - Updates Invoices and creates PaymentAllocations
    - Posts balanced double-entry JournalEntry (Debit == Credit)
    - If Debit != Credit -> ROLLS BACK EVERYTHING
    - Recalculates authoritative bank running balance
    - Marks BankStatementLine as MATCHED / RECONCILED
    - Logs to immutable AuditLog
    """
    stmt_line = db.query(models.BankStatementLine).filter(models.BankStatementLine.id == statement_line_id).first()
    if not stmt_line:
        raise ValueError(f"Statement Line #{statement_line_id} not found.")

    b_acc = db.query(models.BankAccount).filter(models.BankAccount.id == stmt_line.bank_account_id).first()
    if not b_acc:
        raise ValueError("Bank Account linked to statement line not found.")

    check_period_open(db, stmt_line.transaction_date)

    credit_amt = round_money(stmt_line.credit)
    debit_amt = round_money(stmt_line.debit)

    # 1. ACTION: Link to already recorded transaction (e.g. historical transport payment)
    if action_type == "LINK_EXISTING" or existing_transaction_id:
        tx_id = existing_transaction_id or stmt_line.matched_transaction_id
        tx = db.query(models.BankTransaction).filter(models.BankTransaction.id == tx_id).first()
        if not tx:
            raise ValueError(f"Bank Transaction #{tx_id} not found to link.")

        stmt_line.matched_transaction_id = tx.id
        stmt_line.match_status = "MATCHED"
        tx.status = "RECONCILED"

        audit = models.AuditLog(
            entity_type="BankStatementLine",
            entity_id=stmt_line.id,
            action="LINK_RECONCILE",
            new_value_json=f'{{"statement_line_id": {stmt_line.id}, "linked_tx_id": {tx.id}, "tx_code": "{tx.transaction_code}"}}',
            user_name=user_name,
            timestamp=datetime.utcnow(),
        )
        db.add(audit)
        db.commit()

        return {
            "status": "SUCCESS",
            "message": f"Statement line matched and reconciled to existing transaction {tx.transaction_code}.",
            "statement_line_id": stmt_line.id,
            "bank_transaction_id": tx.id,
        }

    # 2. ACTION: Customer Receipt & Invoice Allocation
    if action_type in ("CONFIRM_MATCH", "CUSTOMER_RECEIPT", "CUSTOMER_ADVANCE"):
        if credit_amt <= 0:
            raise ValueError("Customer Receipt action requires Money In (Credit > 0).")

        cust_id = customer_id or stmt_line.suggested_party_id
        if not cust_id:
            raise ValueError("Customer must be selected for customer receipt confirmation.")

        cust = db.query(models.Customer).filter(models.Customer.id == cust_id).first()
        if not cust:
            raise ValueError(f"Customer #{cust_id} not found.")

        # Create BankTransaction
        count = db.query(models.BankTransaction).filter(models.BankTransaction.transaction_code.like(f"CR-{stmt_line.transaction_date.year}-%")).count()
        tx_code = f"CR-{stmt_line.transaction_date.year}-{count + 1:06d}"

        bank_tx = models.BankTransaction(
            transaction_code=tx_code,
            date=stmt_line.transaction_date,
            document_date=stmt_line.transaction_date,
            posting_date=stmt_line.transaction_date,
            bank_account_id=b_acc.id,
            bank_name=b_acc.bank_name,
            account_number=b_acc.account_number,
            party_type="CUSTOMER",
            party_id=cust.id,
            party_name=cust.customer_name,
            transaction_type="CUSTOMER_RECEIPT",
            currency=stmt_line.currency,
            money_in=credit_amt,
            money_out=Decimal("0.00"),
            exchange_rate=Decimal("1.0000"),
            usd_equivalent_in=credit_amt,
            usd_equivalent_out=Decimal("0.00"),
            transaction_reference=stmt_line.reference,
            bank_reference=stmt_line.bank_reference,
            payment_method="Bank Wire",
            status="RECONCILED",
            approval_status="POSTED",
            notes=notes or stmt_line.description,
            created_by=user_name,
        )
        db.add(bank_tx)
        db.flush()

        # Handle allocations
        alloc_items = invoice_allocations or []
        if not alloc_items and stmt_line.suggested_invoice_id:
            alloc_items = [{"invoice_id": stmt_line.suggested_invoice_id, "amount": float(credit_amt)}]

        allocated_ar = Decimal("0.00")
        for a in alloc_items:
            inv_id = a.get("invoice_id")
            amt = round_money(a.get("amount", 0))
            if not inv_id or amt <= 0:
                continue
            inv = db.query(models.Invoice).filter(models.Invoice.id == inv_id, models.Invoice.customer_id == cust.id).first()
            if inv:
                alloc_amt = min(amt, round_money(inv.balance_due))
                inv.amount_received = round_money(Decimal(str(inv.amount_received or 0)) + alloc_amt)
                inv.balance_due = round_money(Decimal(str(inv.total_amount or 0)) - inv.amount_received)
                inv.payment_status = "PAID" if inv.balance_due <= Decimal("0.00") else "PARTIALLY PAID"

                pa = models.PaymentAllocation(
                    bank_transaction_id=bank_tx.id,
                    customer_id=cust.id,
                    invoice_id=inv.id,
                    allocated_amount_usd=alloc_amt,
                    allocation_type="INVOICE_SETTLEMENT",
                    notes=f"Auto-matched from bank statement {stmt_line.reference or ''}",
                )
                db.add(pa)
                allocated_ar += alloc_amt

        unallocated_advance = credit_amt - allocated_ar
        if unallocated_advance > 0:
            pa_adv = models.PaymentAllocation(
                bank_transaction_id=bank_tx.id,
                customer_id=cust.id,
                invoice_id=None,
                allocated_amount_usd=unallocated_advance,
                allocation_type="ADVANCE",
                notes="Unallocated advance credited to Account 2150",
            )
            db.add(pa_adv)

        # Journal Entry
        # Dr 1000 Cash & Bank (Total Receipt)
        # Cr 1100 Customer Receivables (Allocated portion)
        # Cr 2150 Customer Advances (Unallocated advance portion)
        jl_lines = [
            {
                "account_code": "1000",
                "debit": credit_amt,
                "credit": Decimal("0.00"),
                "party_type": "CUSTOMER",
                "party_id": cust.id,
                "party_name": cust.customer_name,
                "description": f"Bank statement receipt: {stmt_line.description}",
            }
        ]
        if allocated_ar > 0:
            jl_lines.append({
                "account_code": "1100",
                "debit": Decimal("0.00"),
                "credit": allocated_ar,
                "party_type": "CUSTOMER",
                "party_id": cust.id,
                "party_name": cust.customer_name,
                "description": f"Invoice settlement for {cust.customer_name}",
            })
        if unallocated_advance > 0:
            jl_lines.append({
                "account_code": "2150",
                "debit": Decimal("0.00"),
                "credit": unallocated_advance,
                "party_type": "CUSTOMER",
                "party_id": cust.id,
                "party_name": cust.customer_name,
                "description": f"Customer advance credited to Account 2150",
            })

        je = create_journal_entry(
            db=db,
            entry_date=stmt_line.transaction_date,
            entry_type="CUSTOMER_RECEIPT",
            description=f"Bank Receipt Confirmed - {cust.customer_name} (${credit_amt:,.2f})",
            lines=jl_lines,
            reference=bank_tx.transaction_code,
            source_document_type="BANK_TRANSACTION",
            source_document_id=bank_tx.id,
            created_by=user_name,
        )

        stmt_line.matched_transaction_id = bank_tx.id
        stmt_line.match_status = "RECONCILED"
        recalculate_bank_running_balance(db, b_acc.id)

        db.commit()
        return {
            "status": "SUCCESS",
            "transaction_code": bank_tx.transaction_code,
            "journal_entry": je.entry_number,
            "allocated_ar": float(allocated_ar),
            "unallocated_advance": float(unallocated_advance),
        }

    # 3. ACTION: Unidentified Receipts (Route to Account 1090 Suspense)
    if action_type == "UNIDENTIFIED_SUSPENSE":
        if credit_amt <= 0:
            raise ValueError("Suspense receipt requires Money In (Credit > 0).")

        count = db.query(models.BankTransaction).count()
        tx_code = f"SUSP-{stmt_line.transaction_date.year}-{count + 1:06d}"

        bank_tx = models.BankTransaction(
            transaction_code=tx_code,
            date=stmt_line.transaction_date,
            bank_account_id=b_acc.id,
            bank_name=b_acc.bank_name,
            account_number=b_acc.account_number,
            party_type="UNKNOWN",
            party_name="Unidentified Remitter (Suspense)",
            transaction_type="CUSTOMER_RECEIPT",
            currency=stmt_line.currency,
            money_in=credit_amt,
            money_out=Decimal("0.00"),
            usd_equivalent_in=credit_amt,
            usd_equivalent_out=Decimal("0.00"),
            status="RECONCILED",
            approval_status="POSTED",
            notes=notes or f"Unidentified receipt routed to 1090 Suspense: {stmt_line.description}",
            created_by=user_name,
        )
        db.add(bank_tx)
        db.flush()

        # Dr 1000 Cash & Bank, Cr 1090 Unidentified Receipts
        jl_lines = [
            {
                "account_code": "1000",
                "debit": credit_amt,
                "credit": Decimal("0.00"),
                "description": f"Unidentified receipt received at {b_acc.bank_name}",
            },
            {
                "account_code": "1090",
                "debit": Decimal("0.00"),
                "credit": credit_amt,
                "description": f"Unidentified receipt held in Suspense: {stmt_line.description}",
            },
        ]
        je = create_journal_entry(
            db=db,
            entry_date=stmt_line.transaction_date,
            entry_type="MANUAL",
            description=f"Unidentified Receipt Parked in Suspense (${credit_amt:,.2f})",
            lines=jl_lines,
            reference=bank_tx.transaction_code,
            created_by=user_name,
        )

        stmt_line.matched_transaction_id = bank_tx.id
        stmt_line.match_status = "RECONCILED"
        recalculate_bank_running_balance(db, b_acc.id)

        db.commit()
        return {
            "status": "SUCCESS",
            "message": "Unidentified receipt safely posted to Account 1090 Suspense.",
            "transaction_code": bank_tx.transaction_code,
            "journal_entry": je.entry_number,
        }

    # 4. ACTION: Bank Charge Posting (Debit 5600, Credit 1000)
    if action_type == "BANK_CHARGE":
        if debit_amt <= 0:
            raise ValueError("Bank charge requires Money Out (Debit > 0).")

        count = db.query(models.BankTransaction).count()
        tx_code = f"BC-{stmt_line.transaction_date.year}-{count + 1:06d}"

        bank_tx = models.BankTransaction(
            transaction_code=tx_code,
            date=stmt_line.transaction_date,
            bank_account_id=b_acc.id,
            bank_name=b_acc.bank_name,
            account_number=b_acc.account_number,
            party_type="BANK",
            party_name=b_acc.bank_name,
            transaction_type="BANK_CHARGE",
            currency=stmt_line.currency,
            money_in=Decimal("0.00"),
            money_out=debit_amt,
            usd_equivalent_in=Decimal("0.00"),
            usd_equivalent_out=debit_amt,
            status="RECONCILED",
            approval_status="POSTED",
            notes=notes or stmt_line.description,
            created_by=user_name,
        )
        db.add(bank_tx)
        db.flush()

        jl_lines = [
            {
                "account_code": "5600",
                "debit": debit_amt,
                "credit": Decimal("0.00"),
                "description": f"Bank charge: {stmt_line.description}",
            },
            {
                "account_code": "1000",
                "debit": Decimal("0.00"),
                "credit": debit_amt,
                "description": f"Fee deducted from {b_acc.bank_name}",
            },
        ]
        je = create_journal_entry(
            db=db,
            entry_date=stmt_line.transaction_date,
            entry_type="BANK_CHARGE",
            description=f"Bank Fee - {b_acc.bank_name} (${debit_amt:,.2f})",
            lines=jl_lines,
            reference=bank_tx.transaction_code,
            created_by=user_name,
        )

        stmt_line.matched_transaction_id = bank_tx.id
        stmt_line.match_status = "RECONCILED"
        recalculate_bank_running_balance(db, b_acc.id)

        db.commit()
        return {
            "status": "SUCCESS",
            "transaction_code": bank_tx.transaction_code,
            "journal_entry": je.entry_number,
        }

    raise ValueError(f"Unsupported action_type '{action_type}'.")


# =====================================================================
# 6. SWIFT MT103 PARSER & PROCESSOR
# =====================================================================

def parse_swift_mt103(raw_text: str) -> Dict[str, Any]:
    """
    Parses SWIFT MT103 message text:
    Extracts tags :20:, :23B:, :32A:, :50:, :52:, :53:, :54:, :56A:, :57A:, :59:, :70:, :71A:, :72:.
    """
    fields: Dict[str, str] = {}
    current_tag = None
    lines = raw_text.splitlines()

    for line in lines:
        match = re.match(r"^:(\d{2}[A-Z]?):(.*)$", line.strip())
        if match:
            current_tag = match.group(1)
            fields[current_tag] = match.group(2).strip()
        elif current_tag:
            fields[current_tag] += " " + line.strip()

    # Field 20: Transaction Reference
    tx_ref = fields.get("20", "").strip()
    if not tx_ref:
        # Fallback to finding alphanumeric code
        alt_match = re.search(r":20:([A-Za-z0-9\-_/]+)", raw_text)
        if alt_match:
            tx_ref = alt_match.group(1).strip()
        else:
            tx_ref = f"MT103-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

    # Field 32A: Value Date, Currency, Amount (e.g. "260926USD74750,00" or "260926USD74750.00")
    val_date = date.today()
    currency = "USD"
    amount = Decimal("0.00")

    f32a = fields.get("32A", "")
    if f32a:
        # Format YYMMDD followed by 3-letter currency then amount with comma or dot
        m = re.match(r"^(\d{6})([A-Z]{3})([\d,.]+)", f32a.replace(" ", ""))
        if m:
            date_part = m.group(1)
            currency = m.group(2)
            amt_part = m.group(3).replace(",", ".")
            try:
                val_date = datetime.strptime(date_part, "%y%m%d").date()
            except Exception:
                val_date = date.today()
            amount = normalize_amount_str(amt_part)

    # Field 50: Ordering Customer
    ordering_cust = fields.get("50K") or fields.get("50A") or fields.get("50") or ""

    # Field 59: Beneficiary
    beneficiary = fields.get("59") or fields.get("59A") or ""

    return {
        "transaction_reference": tx_ref,
        "bank_operation_code": fields.get("23B"),
        "value_date": val_date,
        "currency": currency,
        "amount": amount,
        "ordering_customer": ordering_cust,
        "ordering_institution": fields.get("52A") or fields.get("52"),
        "sender_bank": fields.get("53A") or fields.get("53"),
        "receiver_bank": fields.get("54A") or fields.get("54"),
        "intermediary_bank": fields.get("56A") or fields.get("56"),
        "account_with_institution": fields.get("57A") or fields.get("57"),
        "beneficiary": beneficiary,
        "remittance_info": fields.get("70"),
        "charges_details": fields.get("71A", "OUR"),
        "sender_to_receiver_info": fields.get("72"),
        "raw_text": raw_text,
    }


def record_swift_mt103(
    db: Session,
    parsed: Dict[str, Any],
    user_name: str = "Admin",
) -> models.SwiftMT103:
    """Stores parsed MT103 record and attempts intelligent customer & invoice matching."""
    existing = db.query(models.SwiftMT103).filter(models.SwiftMT103.transaction_reference == parsed["transaction_reference"]).first()
    if existing:
        return existing

    # Attempt customer match
    matched_cust_id = None
    matched_inv_id = None

    all_text = f"{parsed['ordering_customer']} {parsed.get('remittance_info', '')}".upper()

    customers = db.query(models.Customer).all()
    for c in customers:
        if c.customer_name.strip().upper() in all_text:
            matched_cust_id = c.id
            break

    invoices = db.query(models.Invoice).all()
    for inv in invoices:
        if inv.invoice_number.strip().upper() in all_text:
            matched_inv_id = inv.id
            if not matched_cust_id:
                matched_cust_id = inv.customer_id
            break

    mt_rec = models.SwiftMT103(
        transaction_reference=parsed["transaction_reference"],
        bank_operation_code=parsed.get("bank_operation_code"),
        value_date=parsed["value_date"],
        currency=parsed["currency"],
        amount=parsed["amount"],
        ordering_customer=parsed.get("ordering_customer"),
        ordering_institution=parsed.get("ordering_institution"),
        sender_bank=parsed.get("sender_bank"),
        receiver_bank=parsed.get("receiver_bank"),
        intermediary_bank=parsed.get("intermediary_bank"),
        account_with_institution=parsed.get("account_with_institution"),
        beneficiary=parsed.get("beneficiary") or "AQ COMPANIES",
        remittance_info=parsed.get("remittance_info"),
        charges_details=parsed.get("charges_details", "OUR"),
        sender_to_receiver_info=parsed.get("sender_to_receiver_info"),
        linked_customer_id=matched_cust_id,
        linked_invoice_id=matched_inv_id,
        status="MT103 RECEIVED",
        raw_mt103=parsed["raw_text"],
        created_at=datetime.utcnow(),
    )
    db.add(mt_rec)
    db.commit()
    db.refresh(mt_rec)
    return mt_rec


# =====================================================================
# 7. INTERNAL BANK TRANSFERS & FX CONVERSIONS
# =====================================================================

def execute_internal_bank_transfer(
    db: Session,
    source_bank_id: int,
    dest_bank_id: int,
    amount_source: Decimal,
    amount_dest: Optional[Decimal] = None,
    exchange_rate: Decimal = Decimal("1.0000"),
    transfer_date: Optional[date] = None,
    reference: Optional[str] = None,
    notes: Optional[str] = None,
    user_name: str = "Admin",
) -> Dict[str, Any]:
    """
    Executes internal transfer between own bank/cash/Sarafi accounts:
    - Creates linked money out and money in records
    - Single accounting event: Dr Destination Account, Cr Source Account
    - Handles FX differences if multi-currency (e.g. USD to AFN)
    """
    t_date = transfer_date or date.today()
    check_period_open(db, t_date)

    b_src = db.query(models.BankAccount).filter(models.BankAccount.id == source_bank_id).first()
    b_dst = db.query(models.BankAccount).filter(models.BankAccount.id == dest_bank_id).first()

    if not b_src or not b_dst:
        raise ValueError("Source and destination bank accounts must be valid.")

    if b_src.id == b_dst.id:
        raise ValueError("Source and destination bank accounts cannot be the same account.")

    amt_src = round_money(amount_source)
    if amt_src <= 0:
        raise ValueError("Transfer amount must be greater than zero.")

    # Calculate destination amount
    if b_src.currency == b_dst.currency:
        amt_dst = amt_src
    else:
        if amount_dest and amount_dest > 0:
            amt_dst = round_money(amount_dest)
        else:
            amt_dst = round_money(amt_src * exchange_rate)

    ref_code = reference or f"XFR-{t_date.strftime('%Y%m%d')}-{b_src.currency}-{b_dst.currency}"

    # 1. Source Account BankTransaction (Money Out)
    count = db.query(models.BankTransaction).count()
    tx_src = models.BankTransaction(
        transaction_code=f"TRF-OUT-{t_date.year}-{count + 1:05d}",
        date=t_date,
        bank_account_id=b_src.id,
        bank_name=b_src.bank_name,
        account_number=b_src.account_number,
        party_type="INTERNAL",
        party_name=b_dst.bank_name,
        transaction_type="TRANSFER",
        currency=b_src.currency,
        money_in=Decimal("0.00"),
        money_out=amt_src,
        exchange_rate=Decimal("1.0000"),
        usd_equivalent_in=Decimal("0.00"),
        usd_equivalent_out=amt_src if b_src.currency == "USD" else round_money(amt_src / exchange_rate),
        transaction_reference=ref_code,
        status="RECONCILED",
        approval_status="POSTED",
        notes=notes or f"Internal transfer to {b_dst.bank_name}",
        created_by=user_name,
    )
    db.add(tx_src)
    db.flush()

    # 2. Destination Account BankTransaction (Money In)
    tx_dst = models.BankTransaction(
        transaction_code=f"TRF-IN-{t_date.year}-{count + 2:05d}",
        date=t_date,
        bank_account_id=b_dst.id,
        bank_name=b_dst.bank_name,
        account_number=b_dst.account_number,
        party_type="INTERNAL",
        party_name=b_src.bank_name,
        transaction_type="TRANSFER",
        currency=b_dst.currency,
        money_in=amt_dst,
        money_out=Decimal("0.00"),
        exchange_rate=exchange_rate,
        usd_equivalent_in=amt_src if b_src.currency == "USD" else amt_dst,
        usd_equivalent_out=Decimal("0.00"),
        transaction_reference=ref_code,
        status="RECONCILED",
        approval_status="POSTED",
        notes=notes or f"Internal transfer received from {b_src.bank_name}",
        created_by=user_name,
    )
    db.add(tx_dst)
    db.flush()

    # 3. Balanced Journal Entry
    # Debit Destination Account (1000), Credit Source Account (1000)
    usd_val = tx_src.usd_equivalent_out
    jl_lines = [
        {
            "account_code": "1000",
            "debit": usd_val,
            "credit": Decimal("0.00"),
            "description": f"Transfer in to {b_dst.bank_name} ({b_dst.currency} {amt_dst:,.2f})",
        },
        {
            "account_code": "1000",
            "debit": Decimal("0.00"),
            "credit": usd_val,
            "description": f"Transfer out from {b_src.bank_name} ({b_src.currency} {amt_src:,.2f})",
        },
    ]

    je = create_journal_entry(
        db=db,
        entry_date=t_date,
        entry_type="TRANSFER",
        description=f"Internal Bank Transfer: {b_src.bank_name} -> {b_dst.bank_name} (${usd_val:,.2f})",
        lines=jl_lines,
        reference=ref_code,
        created_by=user_name,
    )

    recalculate_bank_running_balance(db, b_src.id)
    recalculate_bank_running_balance(db, b_dst.id)

    db.commit()

    return {
        "status": "SUCCESS",
        "transfer_reference": ref_code,
        "source_transaction": tx_src.transaction_code,
        "dest_transaction": tx_dst.transaction_code,
        "journal_entry": je.entry_number,
        "amount_transferred_usd": float(usd_val),
    }
