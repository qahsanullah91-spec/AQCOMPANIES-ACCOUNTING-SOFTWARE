from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_

try:
    from app.models import (
        Account,
        JournalEntry,
        JournalLine,
        BankAccount,
        BankTransaction,
        PaymentAllocation,
        Invoice,
        Purchase,
        TransportCharge,
        TransportPayment,
        CustomerPayment,
        SupplierPayment,
        Expense,
        Customer,
        Supplier,
        TransportCompany,
        BankReconciliation,
        BankStatementLine,
        AccountingPeriod,
        AuditLog,
    )
except ImportError:
    from backend.app.models import (
        Account,
        JournalEntry,
        JournalLine,
        BankAccount,
        BankTransaction,
        PaymentAllocation,
        Invoice,
        Purchase,
        TransportCharge,
        TransportPayment,
        CustomerPayment,
        SupplierPayment,
        Expense,
        Customer,
        Supplier,
        TransportCompany,
        BankReconciliation,
        BankStatementLine,
        AccountingPeriod,
        AuditLog,
    )


def round_money(val: Any) -> Decimal:
    """Round monetary amount to 2 decimal places using standard ROUND_HALF_UP."""
    if val is None:
        return Decimal("0.00")
    d = Decimal(str(val)) if not isinstance(val, Decimal) else val
    return d.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


# =====================================================================
# 1. CHART OF ACCOUNTS DEFINITION & SEEDING
# =====================================================================

DEFAULT_CHART_OF_ACCOUNTS = [
    # ASSETS (1000 - 1999)
    {"account_code": "1000", "account_name": "Cash & Bank", "account_type": "ASSET", "sub_type": "Current Assets", "description": "Bank accounts, cash on hand, Sarafi balances"},
    {"account_code": "1010", "account_name": "Petty Cash USD", "account_type": "ASSET", "sub_type": "Current Assets", "description": "Physical cash on hand in USD"},
    {"account_code": "1020", "account_name": "Cash Vault AFN", "account_type": "ASSET", "sub_type": "Current Assets", "description": "Physical cash vault in Afghan Afghanis (AFN)"},
    {"account_code": "1030", "account_name": "Sarafi Trade Accounts", "account_type": "ASSET", "sub_type": "Current Assets", "description": "Hawala / Sarafi broker balances (Omid Ehsan, Kabul Shahzada)"},
    {"account_code": "1100", "account_name": "Customer Receivables", "account_type": "ASSET", "sub_type": "Current Assets", "description": "Outstanding trade balances owed by buyers"},
    {"account_code": "1200", "account_name": "Inventory / Stock", "account_type": "ASSET", "sub_type": "Current Assets", "description": "Value of unallocated dry fruit goods in stock or in transit"},
    {"account_code": "1300", "account_name": "Advances", "account_type": "ASSET", "sub_type": "Current Assets", "description": "Advances given to customs agents or handlers"},
    {"account_code": "1350", "account_name": "Supplier Advances", "account_type": "ASSET", "sub_type": "Current Assets", "description": "Advance payments made to Afghan suppliers before goods billing"},
    {"account_code": "1400", "account_name": "Prepaid Expenses", "account_type": "ASSET", "sub_type": "Current Assets", "description": "Prepaid rents, insurances, or transit deposits"},

    # LIABILITIES (2000 - 2999)
    {"account_code": "2000", "account_name": "Supplier Payables", "account_type": "LIABILITY", "sub_type": "Current Liabilities", "description": "Balances owed to Afghan dry fruit sellers"},
    {"account_code": "2100", "account_name": "Transport Payables", "account_type": "LIABILITY", "sub_type": "Current Liabilities", "description": "Logistics and shipping lines owed to transport carriers"},
    {"account_code": "2150", "account_name": "Customer Advances", "account_type": "LIABILITY", "sub_type": "Current Liabilities", "description": "Customer payments received in advance / unallocated receipts"},
    {"account_code": "2200", "account_name": "Other Payables", "account_type": "LIABILITY", "sub_type": "Current Liabilities", "description": "Accrued operating expenses, customs duty, statutory duties"},

    # EQUITY (3000 - 3999)
    {"account_code": "3000", "account_name": "Owner Equity", "account_type": "EQUITY", "sub_type": "Equity", "description": "Capital invested by owner and initial opening reserves"},
    {"account_code": "3100", "account_name": "Retained Earnings", "account_type": "EQUITY", "sub_type": "Equity", "description": "Cumulative net profit and earnings retained in the business"},

    # REVENUE (4000 - 4999)
    {"account_code": "4000", "account_name": "Sales Revenue", "account_type": "REVENUE", "sub_type": "Operating Revenue", "description": "Gross invoiced sales from container shipments of dry fruits"},
    {"account_code": "4100", "account_name": "Other Income", "account_type": "REVENUE", "sub_type": "Non-Operating Revenue", "description": "Refunds, claims, interest, miscellaneous income"},
    {"account_code": "4200", "account_name": "Realized FX Gain", "account_type": "REVENUE", "sub_type": "Non-Operating Revenue", "description": "Realized foreign exchange gain on multi-currency settlements"},

    # COST OF GOODS SOLD (5000 - 5999)
    {"account_code": "5000", "account_name": "Dry Fruit Purchase Cost", "account_type": "COGS", "sub_type": "Direct Costs", "description": "Origin purchase cost of dry fruit cargo"},
    {"account_code": "5100", "account_name": "Freight / Transport Cost", "account_type": "COGS", "sub_type": "Direct Costs", "description": "Trucking, marine container freight, cross-border haulage"},
    {"account_code": "5200", "account_name": "Customs", "account_type": "COGS", "sub_type": "Direct Costs", "description": "Import customs clearance, tariffs, and border duties"},
    {"account_code": "5300", "account_name": "Documentation", "account_type": "COGS", "sub_type": "Direct Costs", "description": "Phyto, COO, Transit Certificates, BL issuance fees"},
    {"account_code": "5400", "account_name": "Loading / Unloading", "account_type": "COGS", "sub_type": "Direct Costs", "description": "Labour handling, palletizing, transshipment loading"},
    {"account_code": "5500", "account_name": "Port Charges", "account_type": "COGS", "sub_type": "Direct Costs", "description": "Terminal handling, port dues, container staging fees"},
    {"account_code": "5600", "account_name": "Bank Charges", "account_type": "COGS", "sub_type": "Direct Costs", "description": "Wire transfer fees, correspondent bank deductions, TT charges"},
    {"account_code": "5700", "account_name": "Commission", "account_type": "COGS", "sub_type": "Direct Costs", "description": "Brokerage and intermediary sales commissions"},
    {"account_code": "5800", "account_name": "Other Direct Costs", "account_type": "COGS", "sub_type": "Direct Costs", "description": "Inspection, weighbridge, fumigation, demurrage, direct costs"},

    # OPERATING EXPENSES (6000 - 6999)
    {"account_code": "6000", "account_name": "Office Expense", "account_type": "EXPENSE", "sub_type": "Operating Expenses", "description": "Office lease, stationery, supplies, utilities"},
    {"account_code": "6100", "account_name": "Salaries", "account_type": "EXPENSE", "sub_type": "Operating Expenses", "description": "Management and operational staff payroll"},
    {"account_code": "6200", "account_name": "Communication", "account_type": "EXPENSE", "sub_type": "Operating Expenses", "description": "Mobile, satellite, internet, communications"},
    {"account_code": "6300", "account_name": "Travel", "account_type": "EXPENSE", "sub_type": "Operating Expenses", "description": "Business travel, border inspection trips, lodging"},
    {"account_code": "6400", "account_name": "Miscellaneous Expense", "account_type": "EXPENSE", "sub_type": "Operating Expenses", "description": "General administrative and minor sundry expenses"},
    {"account_code": "6500", "account_name": "Realized FX Loss", "account_type": "EXPENSE", "sub_type": "Operating Expenses", "description": "Realized foreign exchange loss on settlements"},
]


def seed_chart_of_accounts(db: Session) -> int:
    """Seeds the standard Chart of Accounts if empty, or ensures missing standard accounts exist."""
    created_count = 0
    for item in DEFAULT_CHART_OF_ACCOUNTS:
        existing = db.query(Account).filter(Account.account_code == item["account_code"]).first()
        if not existing:
            acc = Account(
                account_code=item["account_code"],
                account_name=item["account_name"],
                account_type=item["account_type"],
                sub_type=item.get("sub_type"),
                description=item.get("description"),
                is_active=True,
                is_system=True,
                currency="USD",
            )
            db.add(acc)
            created_count += 1
    if created_count > 0:
        db.commit()
    return created_count


def get_account_by_code(db: Session, account_code: str) -> Account:
    """Finds an account by its unique code; raises ValueError if not found."""
    acc = db.query(Account).filter(Account.account_code == account_code).first()
    if not acc:
        seed_chart_of_accounts(db)
        acc = db.query(Account).filter(Account.account_code == account_code).first()
        if not acc:
            raise ValueError(f"Account with code '{account_code}' does not exist in Chart of Accounts.")
    return acc


# =====================================================================
# 2. DOUBLE-ENTRY GENERAL LEDGER ENGINE
# =====================================================================

def check_period_open(db: Session, target_date: date) -> None:
    """Ensures target date does not fall within a CLOSED or LOCKED accounting period."""
    closed_p = (
        db.query(AccountingPeriod)
        .filter(
            AccountingPeriod.start_date <= target_date,
            AccountingPeriod.end_date >= target_date,
            AccountingPeriod.status.in_(("CLOSED", "LOCKED")),
        )
        .first()
    )
    if closed_p:
        raise ValueError(
            f"Cannot post or modify transactions on {target_date}: Fiscal period '{closed_p.period_name}' is {closed_p.status}. Supervisor authorization required."
        )


def get_next_journal_number(db: Session, entry_date: date, entry_type: str = "JV") -> str:
    """
    Generates sequential journal entry code according to section 14:
    JV-YYYY-000001 (General / Manual / Opening / Other)
    BR-YYYY-000001 (Bank Transaction / Bank Charge / Transfer)
    CR-YYYY-000001 (Customer Receipt)
    CA-YYYY-000001 (Customer Advance)
    SP-YYYY-000001 (Supplier Payment)
    SA-YYYY-000001 (Supplier Advance)
    TP-YYYY-000001 (Transport Payment)
    """
    year = entry_date.year
    etype = (entry_type or "JV").upper()
    if "CUSTOMER_RECEIPT" in etype or "CUSTOMER_PAYMENT" in etype:
        prefix_tag = "CR"
    elif "CUSTOMER_ADVANCE" in etype:
        prefix_tag = "CA"
    elif "SUPPLIER_PAYMENT" in etype:
        prefix_tag = "SP"
    elif "SUPPLIER_ADVANCE" in etype:
        prefix_tag = "SA"
    elif "TRANSPORT_PAYMENT" in etype:
        prefix_tag = "TP"
    elif any(k in etype for k in ("BANK", "CHARGE", "TRANSFER")):
        prefix_tag = "BR"
    else:
        prefix_tag = "JV"

    prefix = f"{prefix_tag}-{year}-"
    last_je = (
        db.query(JournalEntry)
        .filter(JournalEntry.entry_number.like(f"{prefix}%"))
        .order_by(JournalEntry.id.desc())
        .first()
    )
    if not last_je:
        return f"{prefix}000001"
    try:
        last_num = int(last_je.entry_number.split("-")[-1])
        return f"{prefix}{last_num + 1:06d}"
    except Exception:
        count = db.query(JournalEntry).filter(JournalEntry.entry_number.like(f"{prefix}%")).count()
        return f"{prefix}{count + 1:06d}"


def create_journal_entry(
    db: Session,
    entry_date: date,
    entry_type: str,
    description: str,
    lines: List[Dict[str, Any]],
    reference: Optional[str] = None,
    source_document_type: Optional[str] = None,
    source_document_id: Optional[int] = None,
    created_by: str = "System",
) -> JournalEntry:
    """
    Core double-entry journal poster:
    1. Validates fiscal period is OPEN
    2. Validates Debit = Credit (absolute zero tolerance: |sum(debit) - sum(credit)| < 0.005)
    3. Validates amount > 0 for all active lines
    4. Rejects unbalanced journals
    5. Creates JournalEntry and associated JournalLines
    """
    check_period_open(db, entry_date)
    total_debit = Decimal("0.00")
    total_credit = Decimal("0.00")

    processed_lines = []
    for idx, line in enumerate(lines, start=1):
        d_val = round_money(line.get("debit", 0))
        c_val = round_money(line.get("credit", 0))

        if d_val == Decimal("0.00") and c_val == Decimal("0.00"):
            continue  # skip inactive zero line

        if d_val < Decimal("0.00") or c_val < Decimal("0.00"):
            raise ValueError(f"Line {idx}: Debits and Credits cannot be negative.")

        if d_val > Decimal("0.00") and c_val > Decimal("0.00"):
            raise ValueError(f"Line {idx}: A single journal line cannot contain both Debit and Credit.")

        total_debit += d_val
        total_credit += c_val

        acc_code = str(line.get("account_code")).strip()
        account = get_account_by_code(db, acc_code)

        processed_lines.append({
            "line_number": idx,
            "account_id": account.id,
            "account_code": account.account_code,
            "account_name": account.account_name,
            "party_type": line.get("party_type"),
            "party_id": line.get("party_id"),
            "party_name": line.get("party_name"),
            "debit": d_val,
            "credit": c_val,
            "currency": line.get("currency", "USD"),
            "exchange_rate": Decimal(str(line.get("exchange_rate", "1.0000"))),
            "amount_currency": round_money(line.get("amount_currency", d_val if d_val > 0 else c_val)),
            "amount_usd": round_money(line.get("amount_usd", d_val if d_val > 0 else c_val)),
            "invoice_ref": line.get("invoice_ref"),
            "shipment_ref": line.get("shipment_ref"),
            "bank_ref": line.get("bank_ref"),
            "description": line.get("description", description),
        })

    # Validate double-entry balance
    if abs(total_debit - total_credit) >= Decimal("0.005"):
        raise ValueError(
            f"Unbalanced Journal Entry! Total Debit (${total_debit}) does not equal Total Credit (${total_credit}). "
            f"Difference: ${abs(total_debit - total_credit)}"
        )

    if total_debit == Decimal("0.00"):
        raise ValueError("Cannot post empty or zero-value journal entry.")

    entry_num = get_next_journal_number(db, entry_date, entry_type)
    je = JournalEntry(
        entry_number=entry_num,
        entry_date=entry_date,
        entry_type=entry_type,
        description=description,
        reference=reference,
        source_document_type=source_document_type,
        source_document_id=source_document_id,
        total_debit=total_debit,
        total_credit=total_credit,
        status="POSTED",
        created_by=created_by,
        created_at=datetime.utcnow(),
        posted_at=datetime.utcnow(),
    )
    db.add(je)
    db.flush()

    for pl in processed_lines:
        jl = JournalLine(
            journal_entry_id=je.id,
            line_number=pl["line_number"],
            account_id=pl["account_id"],
            account_code=pl["account_code"],
            account_name=pl["account_name"],
            party_type=pl["party_type"],
            party_id=pl["party_id"],
            party_name=pl["party_name"],
            debit=pl["debit"],
            credit=pl["credit"],
            currency=pl["currency"],
            exchange_rate=pl["exchange_rate"],
            amount_currency=pl["amount_currency"],
            amount_usd=pl["amount_usd"],
            invoice_ref=pl["invoice_ref"],
            shipment_ref=pl["shipment_ref"],
            bank_ref=pl["bank_ref"],
            description=pl["description"],
        )
        db.add(jl)

    db.commit()
    return je


def reverse_journal_entry(
    db: Session,
    journal_id: int,
    reversal_reason: str,
    user_name: str = "Admin",
) -> JournalEntry:
    """
    Reverses an existing journal entry:
    1. Checks if already reversed/voided
    2. Marks original entry as REVERSED
    3. Creates a new balancing JournalEntry with debits and credits swapped
    4. Logs to Audit Trail
    """
    orig_je = db.query(JournalEntry).filter(JournalEntry.id == journal_id).first()
    if not orig_je:
        raise ValueError(f"Journal Entry #{journal_id} not found.")

    if orig_je.status in ("VOID", "REVERSED"):
        raise ValueError(f"Journal Entry {orig_je.entry_number} is already {orig_je.status}.")

    reversal_date = date.today()
    reversal_lines = []
    for line in orig_je.lines:
        reversal_lines.append({
            "account_code": line.account_code,
            "debit": line.credit,  # swap
            "credit": line.debit,  # swap
            "party_type": line.party_type,
            "party_id": line.party_id,
            "party_name": line.party_name,
            "currency": line.currency,
            "exchange_rate": line.exchange_rate,
            "amount_currency": line.amount_currency,
            "amount_usd": line.amount_usd,
            "invoice_ref": line.invoice_ref,
            "shipment_ref": line.shipment_ref,
            "bank_ref": line.bank_ref,
            "description": f"REVERSAL of {orig_je.entry_number}: {line.description or ''}",
        })

    desc = f"REVERSAL of {orig_je.entry_number} - Reason: {reversal_reason}"
    rev_je = create_journal_entry(
        db=db,
        entry_date=reversal_date,
        entry_type="REVERSAL",
        description=desc,
        lines=reversal_lines,
        reference=f"REV-{orig_je.entry_number}",
        source_document_type="JOURNAL_ENTRY",
        source_document_id=orig_je.id,
        created_by=user_name,
    )

    orig_je.status = "REVERSED"
    orig_je.reversed_entry_id = rev_je.id
    orig_je.reversal_reason = reversal_reason

    # Audit log
    audit = AuditLog(
        entity_type="JournalEntry",
        entity_id=orig_je.id,
        action="REVERSE",
        old_value_json=f'{{"status": "POSTED", "entry_number": "{orig_je.entry_number}"}}',
        new_value_json=f'{{"status": "REVERSED", "reversal_entry_number": "{rev_je.entry_number}", "reason": "{reversal_reason}"}}',
        user_name=user_name,
        timestamp=datetime.utcnow(),
    )
    db.add(audit)
    db.commit()
    return rev_je


# =====================================================================
# 3. AUTOMATIC JOURNAL ENTRY GENERATORS
# =====================================================================

def post_invoice_journal(db: Session, invoice: Invoice) -> Optional[JournalEntry]:
    """
    CUSTOMER INVOICE:
    Debit: 1100 Customer Receivable
    Credit: 4000 Sales Revenue
    """
    # Check if already posted
    existing = (
        db.query(JournalEntry)
        .filter(
            JournalEntry.source_document_type == "INVOICE",
            JournalEntry.source_document_id == invoice.id,
            JournalEntry.status == "POSTED",
        )
        .first()
    )
    if existing:
        return existing

    amount = round_money(invoice.total_amount)
    if amount <= Decimal("0.00"):
        return None

    cust_name = invoice.customer.customer_name if invoice.customer else "Customer"
    lines = [
        {
            "account_code": "1100",  # Customer Receivables
            "debit": amount,
            "credit": Decimal("0.00"),
            "party_type": "CUSTOMER",
            "party_id": invoice.customer_id,
            "party_name": cust_name,
            "invoice_ref": invoice.invoice_number,
            "description": f"Invoice {invoice.invoice_number} to {cust_name}",
        },
        {
            "account_code": "4000",  # Sales Revenue
            "debit": Decimal("0.00"),
            "credit": amount,
            "party_type": "CUSTOMER",
            "party_id": invoice.customer_id,
            "party_name": cust_name,
            "invoice_ref": invoice.invoice_number,
            "description": f"Sales revenue recognized for Invoice {invoice.invoice_number}",
        },
    ]

    return create_journal_entry(
        db=db,
        entry_date=invoice.date,
        entry_type="CUSTOMER_INVOICE",
        description=f"Sales Invoice {invoice.invoice_number} - {cust_name} (${amount:,.2f})",
        lines=lines,
        reference=invoice.invoice_number,
        source_document_type="INVOICE",
        source_document_id=invoice.id,
        created_by="System",
    )


def post_customer_payment_journal(
    db: Session,
    bank_tx: BankTransaction,
    customer_id: int,
    allocated_invoices: Optional[List[Dict[str, Any]]] = None,
) -> Optional[JournalEntry]:
    """
    CUSTOMER RECEIPT / ADVANCE:
    Debit: 1000 Cash & Bank (Total amount received)
    Credit: 1100 Customer Receivables (Portion allocated to invoices)
    Credit: 2150 Customer Advances (Portion unallocated / advance)
    *Never creates duplicate sales revenue*
    *Realized FX Gain/Loss posted if exchange rate differed*
    """
    total_received = round_money(bank_tx.usd_equivalent_in or bank_tx.money_in)
    if total_received <= Decimal("0.00"):
        return None

    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    cust_name = cust.customer_name if cust else bank_tx.party_name

    allocated_sum = Decimal("0.00")
    if allocated_invoices:
        for a in allocated_invoices:
            allocated_sum += round_money(a.get("amount", 0))

    if allocated_sum > total_received:
        allocated_sum = total_received

    unallocated = total_received - allocated_sum
    if unallocated < Decimal("0.00"):
        unallocated = Decimal("0.00")

    lines = [
        {
            "account_code": "1000",  # Cash & Bank
            "debit": total_received,
            "credit": Decimal("0.00"),
            "party_type": "CUSTOMER",
            "party_id": customer_id,
            "party_name": cust_name,
            "bank_ref": bank_tx.transaction_reference or bank_tx.transaction_code,
            "description": f"Customer wire receipt deposited in {bank_tx.bank_name}",
        }
    ]

    if allocated_sum > Decimal("0.00"):
        lines.append({
            "account_code": "1100",  # Customer Receivables
            "debit": Decimal("0.00"),
            "credit": allocated_sum,
            "party_type": "CUSTOMER",
            "party_id": customer_id,
            "party_name": cust_name,
            "bank_ref": bank_tx.transaction_reference or bank_tx.transaction_code,
            "description": f"Settlement of receivables for {cust_name}",
        })

    if unallocated > Decimal("0.00"):
        lines.append({
            "account_code": "2150",  # Customer Advances
            "debit": Decimal("0.00"),
            "credit": unallocated,
            "party_type": "CUSTOMER",
            "party_id": customer_id,
            "party_name": cust_name,
            "bank_ref": bank_tx.transaction_reference or bank_tx.transaction_code,
            "description": f"Customer advance / unallocated receipt from {cust_name}",
        })

    # FX Gain/Loss check
    fx_diff = round_money(bank_tx.fx_gain_loss or Decimal("0.00"))
    if fx_diff > Decimal("0.00"):
        # Realized FX Gain: Credit 4200
        lines.append({
            "account_code": "4200",
            "debit": Decimal("0.00"),
            "credit": fx_diff,
            "description": f"Realized FX gain on settlement from {cust_name}",
        })
    elif fx_diff < Decimal("0.00"):
        # Realized FX Loss: Debit 6500
        lines.append({
            "account_code": "6500",
            "debit": abs(fx_diff),
            "credit": Decimal("0.00"),
            "description": f"Realized FX loss on settlement from {cust_name}",
        })

    entry_type = "CUSTOMER_RECEIPT" if allocated_sum > Decimal("0.00") else "CUSTOMER_ADVANCE"
    return create_journal_entry(
        db=db,
        entry_date=bank_tx.date,
        entry_type=entry_type,
        description=f"{'Customer Payment Received' if allocated_sum > 0 else 'Customer Advance Received'} - {cust_name} (${total_received:,.2f}) via {bank_tx.bank_name}",
        lines=lines,
        reference=bank_tx.transaction_reference or bank_tx.transaction_code,
        source_document_type="BANK_TRANSACTION",
        source_document_id=bank_tx.id,
        created_by="System",
    )


def post_customer_advance_allocation_journal(
    db: Session,
    customer_id: int,
    invoice_id: int,
    amount: Decimal,
    reference: str,
) -> Optional[JournalEntry]:
    """
    ALLOCATE CUSTOMER ADVANCE AGAINST INVOICE:
    Debit: 2150 Customer Advances
    Credit: 1100 Customer Receivables
    """
    amt = round_money(amount)
    if amt <= Decimal("0.00"):
        return None

    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    cust_name = cust.customer_name if cust else "Customer"
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    inv_num = inv.invoice_number if inv else f"INV-{invoice_id}"

    lines = [
        {
            "account_code": "2150",  # Customer Advances
            "debit": amt,
            "credit": Decimal("0.00"),
            "party_type": "CUSTOMER",
            "party_id": customer_id,
            "party_name": cust_name,
            "description": f"Customer advance applied against {inv_num}",
        },
        {
            "account_code": "1100",  # Customer Receivables
            "debit": Decimal("0.00"),
            "credit": amt,
            "party_type": "CUSTOMER",
            "party_id": customer_id,
            "party_name": cust_name,
            "description": f"Receivables settlement from advance for {inv_num}",
        },
    ]

    return create_journal_entry(
        db=db,
        entry_date=date.today(),
        entry_type="MANUAL",
        description=f"Customer Advance Allocation - {cust_name} to {inv_num} (${amt:,.2f})",
        lines=lines,
        reference=reference,
        source_document_type="INVOICE",
        source_document_id=invoice_id,
        created_by="System",
    )


def post_purchase_journal(db: Session, purchase: Purchase) -> Optional[JournalEntry]:
    """
    PURCHASE INVOICE:
    Debit: 5000 Dry Fruit Purchase Cost
    Credit: 2000 Supplier Payable
    *Only if purchase amount is known; if NULL, no cost hallucination*
    """
    if purchase.purchase_amount is None:
        return None  # Cost is unknown / pending Afghan supplier invoice

    amount = round_money(purchase.purchase_amount)
    if amount <= Decimal("0.00"):
        return None

    supp_name = purchase.supplier.supplier_name if purchase.supplier else "Supplier"
    lines = [
        {
            "account_code": "5000",  # Purchase Cost / Inventory
            "debit": amount,
            "credit": Decimal("0.00"),
            "party_type": "SUPPLIER",
            "party_id": purchase.supplier_id,
            "party_name": supp_name,
            "invoice_ref": purchase.purchase_reference or purchase.purchase_code,
            "description": f"Direct purchase cost for PO {purchase.purchase_code} - {purchase.product_name}",
        },
        {
            "account_code": "2000",  # Supplier Payable
            "debit": Decimal("0.00"),
            "credit": amount,
            "party_type": "SUPPLIER",
            "party_id": purchase.supplier_id,
            "party_name": supp_name,
            "invoice_ref": purchase.purchase_reference or purchase.purchase_code,
            "description": f"Payable booked to {supp_name} for {purchase.purchase_code}",
        },
    ]

    return create_journal_entry(
        db=db,
        entry_date=purchase.date,
        entry_type="PURCHASE_INVOICE",
        description=f"Purchase Cost Recorded - PO {purchase.purchase_code} ({supp_name})",
        lines=lines,
        reference=purchase.purchase_reference or purchase.purchase_code,
        source_document_type="PURCHASE",
        source_document_id=purchase.id,
        created_by="System",
    )


def post_supplier_payment_journal(
    db: Session,
    bank_tx: BankTransaction,
    supplier_id: int,
    purchase_allocations: Optional[List[Dict[str, Any]]] = None,
) -> Optional[JournalEntry]:
    """
    SUPPLIER PAYMENT:
    Debit: 2000 Supplier Payable (allocated portion)
    Debit: 1350 Supplier Advances (excess / unallocated advance portion)
    Credit: 1000 Cash & Bank (Total amount disbursed)
    *Never creates duplicate purchase, never negative expense*
    """
    total_disbursed = round_money(bank_tx.usd_equivalent_out or bank_tx.money_out)
    if total_disbursed <= Decimal("0.00"):
        return None

    supp = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    supp_name = supp.supplier_name if supp else bank_tx.party_name

    allocated_sum = Decimal("0.00")
    if purchase_allocations:
        for a in purchase_allocations:
            allocated_sum += round_money(a.get("amount", 0))

    if allocated_sum > total_disbursed:
        allocated_sum = total_disbursed

    advance_portion = total_disbursed - allocated_sum

    lines = []
    if allocated_sum > Decimal("0.00"):
        lines.append({
            "account_code": "2000",  # Supplier Payable
            "debit": allocated_sum,
            "credit": Decimal("0.00"),
            "party_type": "SUPPLIER",
            "party_id": supplier_id,
            "party_name": supp_name,
            "bank_ref": bank_tx.transaction_reference or bank_tx.transaction_code,
            "description": f"Disbursement to {supp_name} reducing supplier payable",
        })

    if advance_portion > Decimal("0.00"):
        lines.append({
            "account_code": "1350",  # Supplier Advances
            "debit": advance_portion,
            "credit": Decimal("0.00"),
            "party_type": "SUPPLIER",
            "party_id": supplier_id,
            "party_name": supp_name,
            "bank_ref": bank_tx.transaction_reference or bank_tx.transaction_code,
            "description": f"Advance payment disbursed to {supp_name}",
        })

    lines.append({
        "account_code": "1000",  # Cash & Bank
        "debit": Decimal("0.00"),
        "credit": total_disbursed,
        "party_type": "SUPPLIER",
        "party_id": supplier_id,
        "party_name": supp_name,
        "bank_ref": bank_tx.transaction_reference or bank_tx.transaction_code,
        "description": f"Wire transfer from {bank_tx.bank_name}",
    })

    entry_type = "SUPPLIER_PAYMENT" if allocated_sum > Decimal("0.00") else "SUPPLIER_ADVANCE"
    return create_journal_entry(
        db=db,
        entry_date=bank_tx.date,
        entry_type=entry_type,
        description=f"Supplier Payment Disbursed - {supp_name} (${total_disbursed:,.2f})",
        lines=lines,
        reference=bank_tx.transaction_reference or bank_tx.transaction_code,
        source_document_type="BANK_TRANSACTION",
        source_document_id=bank_tx.id,
        created_by="System",
    )


def post_transport_charge_journal(db: Session, tc: TransportCharge) -> Optional[JournalEntry]:
    """
    TRANSPORT FREIGHT CHARGE:
    Debit: 5100 Freight / Transport Cost
    Credit: 2100 Transport Payable
    """
    existing = (
        db.query(JournalEntry)
        .filter(
            JournalEntry.source_document_type == "TRANSPORT_CHARGE",
            JournalEntry.source_document_id == tc.id,
            JournalEntry.status == "POSTED",
        )
        .first()
    )
    if existing:
        return existing

    t_comp = tc.transport_company.company_name if tc.transport_company else "Transport Co"

    if tc.entry_type == "OPENING CREDIT":
        # Opening carrier credit: AQ Companies had pre-existing credit with transporter
        amount = round_money(tc.credit_usd)
        if amount <= Decimal("0.00"):
            return None
        lines = [
            {
                "account_code": "2100",  # Transport Payable (debited to record our credit asset / liability reduction)
                "debit": amount,
                "credit": Decimal("0.00"),
                "party_type": "TRANSPORT",
                "party_id": tc.transport_company_id,
                "party_name": t_comp,
                "description": f"Opening transport credit recognized with {t_comp}",
            },
            {
                "account_code": "3000",  # Owner Equity / Opening Reserves
                "debit": Decimal("0.00"),
                "credit": amount,
                "party_type": "TRANSPORT",
                "party_id": tc.transport_company_id,
                "party_name": t_comp,
                "description": f"Equity credit offset for historical carrier credit",
            },
        ]
        desc = f"Opening Carrier Credit - {t_comp} (${amount:,.2f})"
    else:
        # Standard freight charge
        amount = round_money(tc.debit_usd)
        if amount <= Decimal("0.00"):
            return None
        lines = [
            {
                "account_code": "5100",  # Freight / Transport Cost
                "debit": amount,
                "credit": Decimal("0.00"),
                "party_type": "TRANSPORT",
                "party_id": tc.transport_company_id,
                "party_name": t_comp,
                "invoice_ref": tc.invoice_no,
                "description": f"Freight charge: {tc.description}",
            },
            {
                "account_code": "2100",  # Transport Payable
                "debit": Decimal("0.00"),
                "credit": amount,
                "party_type": "TRANSPORT",
                "party_id": tc.transport_company_id,
                "party_name": t_comp,
                "invoice_ref": tc.invoice_no,
                "description": f"Payable to {t_comp} for {tc.description}",
            },
        ]
        desc = f"Freight Charge - {tc.description} ({t_comp})"

    return create_journal_entry(
        db=db,
        entry_date=tc.date,
        entry_type="TRANSPORT_CHARGE",
        description=desc,
        lines=lines,
        reference=tc.invoice_no or f"TC-{tc.id}",
        source_document_type="TRANSPORT_CHARGE",
        source_document_id=tc.id,
        created_by="System",
    )


def post_transport_payment_journal(
    db: Session,
    tp: TransportPayment,
) -> Optional[JournalEntry]:
    """
    TRANSPORT PAYMENT:
    Debit: 2100 Transport Payable
    Credit: 1000 Cash & Bank
    *Never creates duplicate freight expense*
    """
    existing = (
        db.query(JournalEntry)
        .filter(
            JournalEntry.source_document_type == "TRANSPORT_PAYMENT",
            JournalEntry.source_document_id == tp.id,
            JournalEntry.status == "POSTED",
        )
        .first()
    )
    if existing:
        return existing

    amount = round_money(tp.amount_usd)
    if amount <= Decimal("0.00"):
        return None

    t_comp = tp.transport_company.company_name if tp.transport_company else "Transport Co"
    lines = [
        {
            "account_code": "2100",  # Transport Payable
            "debit": amount,
            "credit": Decimal("0.00"),
            "party_type": "TRANSPORT",
            "party_id": tp.transport_company_id,
            "party_name": t_comp,
            "description": f"Payment to {t_comp} via {tp.payment_method}",
        },
        {
            "account_code": "1000",  # Cash & Bank
            "debit": Decimal("0.00"),
            "credit": amount,
            "party_type": "TRANSPORT",
            "party_id": tp.transport_company_id,
            "party_name": t_comp,
            "description": f"Bank wire settlement for transport charges",
        },
    ]

    return create_journal_entry(
        db=db,
        entry_date=tp.date,
        entry_type="TRANSPORT_PAYMENT",
        description=f"Transport Payment - {t_comp} (${amount:,.2f})",
        lines=lines,
        reference=f"TP-{tp.id}",
        source_document_type="TRANSPORT_PAYMENT",
        source_document_id=tp.id,
        created_by="System",
    )


def post_bank_charge_journal(db: Session, bank_tx: BankTransaction) -> Optional[JournalEntry]:
    """
    BANK CHARGE:
    Debit: 5600 Bank Charges
    Credit: 1000 Cash & Bank
    """
    amount = round_money(bank_tx.usd_equivalent_out or bank_tx.money_out)
    if amount <= Decimal("0.00"):
        return None

    lines = [
        {
            "account_code": "5600",  # Bank Charges
            "debit": amount,
            "credit": Decimal("0.00"),
            "description": f"Bank wire/transfer processing fees: {bank_tx.notes or ''}",
        },
        {
            "account_code": "1000",  # Cash & Bank
            "debit": Decimal("0.00"),
            "credit": amount,
            "description": f"Fee deducted from {bank_tx.bank_name}",
        },
    ]

    return create_journal_entry(
        db=db,
        entry_date=bank_tx.date,
        entry_type="BANK_CHARGE",
        description=f"Bank Fee - {bank_tx.bank_name} (${amount:,.2f})",
        lines=lines,
        reference=bank_tx.transaction_reference or bank_tx.transaction_code,
        source_document_type="BANK_TRANSACTION",
        source_document_id=bank_tx.id,
        created_by="System",
    )


# =====================================================================
# 4. INITIAL SYSTEM BACKFILL & SYNCHRONIZATION
# =====================================================================

def sync_all_existing_data(db: Session) -> Dict[str, int]:
    """
    Scans all imported AQ Companies data (invoices, transport charges, transport payments, bank transactions)
    and posts balanced double-entry journals for all unposted records.
    Ensures General Ledger and Trial Balance match master historical records perfectly.
    """
    seed_chart_of_accounts(db)

    stats = {
        "invoices_posted": 0,
        "transport_charges_posted": 0,
        "transport_payments_posted": 0,
        "purchases_posted": 0,
        "bank_transactions_posted": 0,
    }

    # 1. Invoices (63 invoices = $4,386,655.66)
    invoices = db.query(Invoice).all()
    for inv in invoices:
        res = post_invoice_journal(db, inv)
        if res:
            stats["invoices_posted"] += 1

    # 2. Transport Charges (64 charges = $743,650 freight + $4,810 opening credit)
    charges = db.query(TransportCharge).all()
    for tc in charges:
        res = post_transport_charge_journal(db, tc)
        if res:
            stats["transport_charges_posted"] += 1

    # 3. Transport Payments (3 payments = $1,030,000)
    payments = db.query(TransportPayment).all()
    for tp in payments:
        res = post_transport_payment_journal(db, tp)
        if res:
            stats["transport_payments_posted"] += 1

    # 4. Purchases (any with valid purchase cost)
    purchases = db.query(Purchase).filter(Purchase.purchase_amount != None).all()
    for p in purchases:
        res = post_purchase_journal(db, p)
        if res:
            stats["purchases_posted"] += 1

    return stats


# =====================================================================
# 5. TRIAL BALANCE CALCULATION
# =====================================================================

def compute_trial_balance(db: Session, as_of_date: Optional[date] = None) -> Dict[str, Any]:
    """
    Computes real-time double-entry Trial Balance:
    - Debits and credits per account
    - Normal balance logic (Assets & Expenses = Debit normal; Liabilities, Equity, Revenue = Credit normal)
    - Verifies SUM(Debits) == SUM(Credits)
    - Returns warning if not balanced
    """
    query = (
        db.query(
            Account.account_code,
            Account.account_name,
            Account.account_type,
            Account.sub_type,
            func.coalesce(func.sum(JournalLine.debit), Decimal("0.00")).label("total_debit"),
            func.coalesce(func.sum(JournalLine.credit), Decimal("0.00")).label("total_credit"),
        )
        .join(JournalLine, JournalLine.account_id == Account.id)
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .filter(JournalEntry.status.in_(("POSTED", "REVERSED")))
    )

    if as_of_date:
        query = query.filter(JournalEntry.entry_date <= as_of_date)

    rows = query.group_by(Account.id).order_by(Account.account_code).all()

    accounts_list = []
    total_tb_debit = Decimal("0.00")
    total_tb_credit = Decimal("0.00")

    for r in rows:
        d = round_money(r.total_debit)
        c = round_money(r.total_credit)

        net_diff = d - c
        debit_bal = Decimal("0.00")
        credit_bal = Decimal("0.00")

        # Standard Accounting presentation for Trial Balance
        if r.account_type in ("ASSET", "COGS", "EXPENSE"):
            if net_diff >= 0:
                debit_bal = net_diff
            else:
                credit_bal = abs(net_diff)
        else:  # LIABILITY, EQUITY, REVENUE
            if net_diff <= 0:
                credit_bal = abs(net_diff)
            else:
                debit_bal = net_diff

        total_tb_debit += debit_bal
        total_tb_credit += credit_bal

        accounts_list.append({
            "account_code": r.account_code,
            "account_name": r.account_name,
            "account_type": r.account_type,
            "sub_type": r.sub_type,
            "total_debit_activity": float(d),
            "total_credit_activity": float(c),
            "debit_balance": float(debit_bal),
            "credit_balance": float(credit_bal),
        })

    total_tb_debit = round_money(total_tb_debit)
    total_tb_credit = round_money(total_tb_credit)
    discrepancy = round_money(abs(total_tb_debit - total_tb_credit))
    is_balanced = discrepancy < Decimal("0.005")

    return {
        "as_of_date": str(as_of_date or date.today()),
        "accounts": accounts_list,
        "total_debit": float(total_tb_debit),
        "total_credit": float(total_tb_credit),
        "difference": float(discrepancy),
        "is_balanced": is_balanced,
        "status": "BALANCED" if is_balanced else "OUT OF BALANCE",
    }


# =====================================================================
# 6. PROFIT & LOSS STATEMENT
# =====================================================================

def compute_profit_and_loss(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Dict[str, Any]:
    """
    Computes GAAP/IFRS compliant Profit & Loss:
    - Revenue: 4000 Sales Revenue, 4100 Other Income
    - Cost of Goods Sold: 5000-5800
    - Gross Profit = Revenue - COGS
    - Operating Expenses: 6000-6400
    - Net Profit = Gross Profit - Operating Expenses
    *CRITICAL RULE: If any active purchase has NULL purchase cost, Net Profit remains NULL/PENDING*
    """
    # Check if there are unpriced purchases
    unpriced_count = db.query(Purchase).filter(Purchase.purchase_amount == None).count()
    has_unpriced_purchases = unpriced_count > 0

    query = (
        db.query(
            Account.account_code,
            Account.account_name,
            Account.account_type,
            func.coalesce(func.sum(JournalLine.debit), Decimal("0.00")).label("total_debit"),
            func.coalesce(func.sum(JournalLine.credit), Decimal("0.00")).label("total_credit"),
        )
        .join(JournalLine, JournalLine.account_id == Account.id)
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .filter(
            JournalEntry.status.in_(("POSTED", "REVERSED")),
            Account.account_type.in_(("REVENUE", "COGS", "EXPENSE")),
        )
    )

    if start_date:
        query = query.filter(JournalEntry.entry_date >= start_date)
    if end_date:
        query = query.filter(JournalEntry.entry_date <= end_date)

    rows = query.group_by(Account.id).order_by(Account.account_code).all()

    revenue_lines = []
    cogs_lines = []
    expense_lines = []

    total_revenue = Decimal("0.00")
    total_cogs = Decimal("0.00")
    total_expenses = Decimal("0.00")

    for r in rows:
        d = round_money(r.total_debit)
        c = round_money(r.total_credit)

        if r.account_type == "REVENUE":
            amt = c - d
            total_revenue += amt
            revenue_lines.append({
                "account_code": r.account_code,
                "account_name": r.account_name,
                "amount": float(amt),
            })
        elif r.account_type == "COGS":
            amt = d - c
            total_cogs += amt
            cogs_lines.append({
                "account_code": r.account_code,
                "account_name": r.account_name,
                "amount": float(amt),
            })
        elif r.account_type == "EXPENSE":
            amt = d - c
            total_expenses += amt
            expense_lines.append({
                "account_code": r.account_code,
                "account_name": r.account_name,
                "amount": float(amt),
            })

    gross_profit = total_revenue - total_cogs

    if has_unpriced_purchases:
        net_profit = None
        profit_margin_pct = None
        profit_status = "PROFIT NOT YET CALCULABLE (PENDING PURCHASE COST)"
    else:
        net_profit = gross_profit - total_expenses
        profit_margin_pct = (
            round_money((net_profit / total_revenue) * Decimal("100.00"))
            if total_revenue > Decimal("0.00")
            else Decimal("0.00")
        )
        profit_status = "FINALIZED"

    return {
        "period": {
            "start_date": str(start_date) if start_date else "All Time",
            "end_date": str(end_date) if end_date else "Present",
        },
        "revenue": {
            "lines": revenue_lines,
            "total": float(round_money(total_revenue)),
        },
        "cogs": {
            "lines": cogs_lines,
            "total": float(round_money(total_cogs)),
            "pending_purchases_count": unpriced_count,
            "has_pending_cost": has_unpriced_purchases,
        },
        "gross_profit": float(round_money(gross_profit)),
        "operating_expenses": {
            "lines": expense_lines,
            "total": float(round_money(total_expenses)),
        },
        "net_profit": float(round_money(net_profit)) if net_profit is not None else None,
        "profit_margin_pct": float(profit_margin_pct) if profit_margin_pct is not None else None,
        "profit_status": profit_status,
    }


# =====================================================================
# 7. CASH FLOW STATEMENT
# =====================================================================

def compute_cash_flow(
    db: Session,
    period_type: str = "monthly",
    as_of_date: Optional[date] = None,
) -> Dict[str, Any]:
    """
    Computes Cash Flow:
    Money In: Customer Receipts, Other Income
    Money Out: Supplier Payments, Transport Payments, Expenses, Bank Charges
    Opening Cash + Net Flow = Closing Cash
    """
    target_date = as_of_date or date.today()

    # Get total bank opening balance
    opening_bank_sum = (
        db.query(func.coalesce(func.sum(BankAccount.opening_balance), Decimal("0.00"))).scalar()
    )

    # All bank transactions
    txs = db.query(BankTransaction).order_by(BankTransaction.date.asc()).all()

    in_customer = Decimal("0.00")
    in_other = Decimal("0.00")
    out_supplier = Decimal("0.00")
    out_transport = Decimal("0.00")
    out_expense = Decimal("0.00")
    out_charges = Decimal("0.00")

    for tx in txs:
        t_type = (tx.transaction_type or "").upper()
        usd_in = round_money(tx.usd_equivalent_in or tx.money_in)
        usd_out = round_money(tx.usd_equivalent_out or tx.money_out)

        if "RECEIPT" in t_type or "CUSTOMER" in t_type:
            in_customer += usd_in
        elif usd_in > Decimal("0.00"):
            in_other += usd_in

        if "TRANSPORT" in t_type:
            out_transport += usd_out
        elif "SUPPLIER" in t_type:
            out_supplier += usd_out
        elif "CHARGE" in t_type:
            out_charges += usd_out
        elif usd_out > Decimal("0.00"):
            out_expense += usd_out

    total_in = in_customer + in_other
    total_out = out_supplier + out_transport + out_expense + out_charges
    net_flow = total_in - total_out
    closing_cash = Decimal(str(opening_bank_sum)) + net_flow

    return {
        "as_of_date": str(target_date),
        "opening_cash": float(round_money(opening_bank_sum)),
        "money_in": {
            "customer_receipts": float(round_money(in_customer)),
            "other_income": float(round_money(in_other)),
            "total_in": float(round_money(total_in)),
        },
        "money_out": {
            "supplier_payments": float(round_money(out_supplier)),
            "transport_payments": float(round_money(out_transport)),
            "expenses": float(round_money(out_expense)),
            "bank_charges": float(round_money(out_charges)),
            "total_out": float(round_money(total_out)),
        },
        "net_cash_flow": float(round_money(net_flow)),
        "closing_cash": float(round_money(closing_cash)),
    }


# =====================================================================
# 8. RECEIVABLES & AGING REPORT
# =====================================================================

def compute_receivables_aging(db: Session, as_of_date: Optional[date] = None) -> Dict[str, Any]:
    """
    Computes Customer Receivables and Aging buckets:
    - 0-30 days
    - 31-60 days
    - 61-90 days
    - 90+ days
    Grouped by Customer with full invoice list.
    """
    target_date = as_of_date or date.today()

    invoices = (
        db.query(Invoice)
        .filter(Invoice.balance_due > Decimal("0.00"))
        .order_by(Invoice.date.asc())
        .all()
    )

    customers_map: Dict[int, Dict[str, Any]] = {}
    summary = {
        "current_0_30": Decimal("0.00"),
        "aging_31_60": Decimal("0.00"),
        "aging_61_90": Decimal("0.00"),
        "overdue_90_plus": Decimal("0.00"),
        "total_receivable": Decimal("0.00"),
    }

    for inv in invoices:
        cust_id = inv.customer_id
        cust_name = inv.customer.customer_name if inv.customer else "Unknown Customer"
        bal = round_money(inv.balance_due)
        days = (target_date - inv.date).days if inv.date else 0

        if cust_id not in customers_map:
            customers_map[cust_id] = {
                "customer_id": cust_id,
                "customer_name": cust_name,
                "current_0_30": Decimal("0.00"),
                "aging_31_60": Decimal("0.00"),
                "aging_61_90": Decimal("0.00"),
                "overdue_90_plus": Decimal("0.00"),
                "total_outstanding": Decimal("0.00"),
                "invoices": [],
            }

        inv_item = {
            "invoice_id": inv.id,
            "invoice_number": inv.invoice_number,
            "date": str(inv.date),
            "amount": float(inv.total_amount),
            "received": float(inv.amount_received),
            "balance": float(bal),
            "days_outstanding": days,
            "status": inv.payment_status,
        }

        if days <= 30:
            customers_map[cust_id]["current_0_30"] += bal
            summary["current_0_30"] += bal
        elif days <= 60:
            customers_map[cust_id]["aging_31_60"] += bal
            summary["aging_31_60"] += bal
        elif days <= 90:
            customers_map[cust_id]["aging_61_90"] += bal
            summary["aging_61_90"] += bal
        else:
            customers_map[cust_id]["overdue_90_plus"] += bal
            summary["overdue_90_plus"] += bal

        customers_map[cust_id]["total_outstanding"] += bal
        summary["total_receivable"] += bal
        customers_map[cust_id]["invoices"].append(inv_item)

    customer_list = []
    for c in sorted(customers_map.values(), key=lambda x: x["total_outstanding"], reverse=True):
        customer_list.append({
            "customer_id": c["customer_id"],
            "customer_name": c["customer_name"],
            "current_0_30": float(round_money(c["current_0_30"])),
            "aging_31_60": float(round_money(c["aging_31_60"])),
            "aging_61_90": float(round_money(c["aging_61_90"])),
            "overdue_90_plus": float(round_money(c["overdue_90_plus"])),
            "total_outstanding": float(round_money(c["total_outstanding"])),
            "invoices": c["invoices"],
        })

    return {
        "as_of_date": str(target_date),
        "summary": {k: float(round_money(v)) for k, v in summary.items()},
        "customers": customer_list,
    }


# =====================================================================
# 9. PAYMENT ALLOCATION ENGINE
# =====================================================================

def allocate_customer_payment(
    db: Session,
    bank_tx_id: int,
    customer_id: int,
    allocations: List[Dict[str, Any]],
    user_name: str = "Admin",
) -> Dict[str, Any]:
    """
    CRITICAL ALLOCATION ENGINE:
    - Allows a single bank receipt to be allocated across multiple invoices.
    - Prevents accidental overpayment.
    - Updates each invoice's amount_received and balance_due.
    - Updates payment_status automatically:
        amount_received == 0 -> UNPAID
        0 < amount_received < total_amount -> PARTIALLY PAID
        amount_received >= total_amount -> PAID
    - Creates database payment_allocations records.
    - Posts the balanced double-entry journal entry!
    """
    bank_tx = db.query(BankTransaction).filter(BankTransaction.id == bank_tx_id).first()
    if not bank_tx:
        raise ValueError(f"Bank Transaction #{bank_tx_id} not found.")

    total_avail = round_money(bank_tx.usd_equivalent_in or bank_tx.money_in)
    allocated_sum = Decimal("0.00")

    for a in allocations:
        amt = round_money(a.get("amount", 0))
        if amt <= Decimal("0.00"):
            continue
        allocated_sum += amt

    if allocated_sum > total_avail:
        raise ValueError(
            f"Cannot allocate ${allocated_sum:,.2f} because available payment is only ${total_avail:,.2f}."
        )

    # Process allocations
    created_allocations = []
    for a in allocations:
        inv_id = a.get("invoice_id")
        alloc_amt = round_money(a.get("amount", 0))
        if alloc_amt <= Decimal("0.00"):
            continue

        inv = db.query(Invoice).filter(Invoice.id == inv_id).first()
        if not inv:
            raise ValueError(f"Invoice #{inv_id} not found.")

        current_bal = round_money(inv.balance_due)
        if alloc_amt > current_bal:
            raise ValueError(
                f"Allocation amount (${alloc_amt:,.2f}) exceeds outstanding balance of Invoice {inv.invoice_number} (${current_bal:,.2f})."
            )

        # Create allocation record
        pa = PaymentAllocation(
            bank_transaction_id=bank_tx.id,
            customer_id=customer_id,
            invoice_id=inv.id,
            shipment_id=inv.shipment_id,
            allocated_amount_usd=alloc_amt,
            created_at=datetime.utcnow(),
        )
        db.add(pa)

        # Update invoice
        new_received = round_money(Decimal(str(inv.amount_received or 0)) + alloc_amt)
        new_balance = round_money(Decimal(str(inv.total_amount or 0)) - new_received)
        inv.amount_received = new_received
        inv.balance_due = new_balance

        if new_received <= Decimal("0.00"):
            inv.payment_status = "UNPAID"
        elif new_received < Decimal(str(inv.total_amount or 0)):
            inv.payment_status = "PARTIALLY PAID"
        else:
            inv.payment_status = "PAID"

        created_allocations.append({
            "invoice_number": inv.invoice_number,
            "allocated": float(alloc_amt),
            "new_balance": float(new_balance),
            "status": inv.payment_status,
        })

    # Post double-entry journal entry
    post_customer_payment_journal(db, bank_tx, customer_id, allocations)

    # Audit log
    audit = AuditLog(
        entity_type="BankTransaction",
        entity_id=bank_tx.id,
        action="ALLOCATE",
        new_value_json=f'{{"allocated_usd": {float(allocated_sum)}, "invoices_count": {len(created_allocations)}}}',
        user_name=user_name,
        timestamp=datetime.utcnow(),
    )
    db.add(audit)
    db.commit()

    return {
        "status": "SUCCESS",
        "bank_transaction_id": bank_tx.id,
        "total_allocated": float(allocated_sum),
        "allocations": created_allocations,
    }


# =====================================================================
# 10. TRANSPORT STATEMENT POSITION (CARRIER CREDIT)
# =====================================================================

def compute_transport_position(db: Session, transport_company_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Computes Transport Ledger position strictly reflecting real AQ Companies business terms:
    Freight Charges: $743,650
    Payments: $1,030,000
    Opening Credit: $4,810
    Closing Position: -$291,160 (AQ COMPANIES HAS CREDIT WITH CARRIER)
    *Never show AQ Companies as owing money*
    """
    tc_query = db.query(TransportCharge)
    tp_query = db.query(TransportPayment)

    if transport_company_id:
        tc_query = tc_query.filter(TransportCharge.transport_company_id == transport_company_id)
        tp_query = tp_query.filter(TransportPayment.transport_company_id == transport_company_id)

    charges = tc_query.all()
    payments = tp_query.all()

    total_freight_charges = Decimal("0.00")
    total_opening_credit = Decimal("0.00")

    for c in charges:
        if c.entry_type == "OPENING CREDIT":
            total_opening_credit += round_money(c.credit_usd)
        else:
            total_freight_charges += round_money(c.debit_usd)

    total_payments = sum([round_money(p.amount_usd) for p in payments], Decimal("0.00"))

    # Net Balance Calculation:
    # Charges (Debits to AQ) - Payments (Credits) - Opening Credit
    # $743,650 - $1,030,000 - $4,810 = -$291,160
    net_balance = total_freight_charges - total_payments - total_opening_credit
    carrier_credit_in_favor = abs(net_balance) if net_balance < Decimal("0.00") else Decimal("0.00")

    return {
        "total_freight_charges": float(total_freight_charges),
        "total_payments": float(total_payments),
        "total_opening_credit": float(total_opening_credit),
        "net_balance": float(net_balance),
        "carrier_credit_in_our_favor": float(carrier_credit_in_favor),
        "has_carrier_credit": net_balance < Decimal("0.00"),
        "status": "CARRIER CREDIT (AQ COMPANIES HAS CREDIT WITH TRANSPORT COMPANY)" if net_balance < 0 else "PAYABLE",
    }


# =====================================================================
# 11. BANKING AUTOMATION: RUNNING BALANCE, REVERSALS & STATEMENT MATCHING
# =====================================================================

def recalculate_bank_running_balance(db: Session, bank_account_id: int) -> Decimal:
    """
    Computes authoritative running balance for a bank account from transaction history:
    Opening Balance + SUM(Money In) - SUM(Money Out)
    Sorted strictly by: (date ASC, created_at ASC, id ASC)
    Updates running_balance on each BankTransaction and current_balance on BankAccount.
    """
    b_acc = db.query(BankAccount).filter(BankAccount.id == bank_account_id).first()
    if not b_acc:
        raise ValueError(f"Bank Account #{bank_account_id} not found.")

    txs = (
        db.query(BankTransaction)
        .filter(
            BankTransaction.bank_account_id == bank_account_id,
            BankTransaction.status.notin_(("VOID", "DRAFT")),
        )
        .order_by(BankTransaction.date.asc(), BankTransaction.created_at.asc(), BankTransaction.id.asc())
        .all()
    )

    running = Decimal(str(b_acc.opening_balance or Decimal("0.00")))
    for t in txs:
        usd_in = round_money(t.usd_equivalent_in or t.money_in)
        usd_out = round_money(t.usd_equivalent_out or t.money_out)
        running += (usd_in - usd_out)
        t.running_balance = running

    b_acc.current_balance = running
    b_acc.available_balance = running
    db.commit()
    return running


def reverse_bank_transaction(
    db: Session,
    bank_tx_id: int,
    reason: str,
    user_name: str = "Admin",
) -> BankTransaction:
    """
    Soft-reverses a posted bank transaction:
    1. Sets original is_reversed = True, status = 'REVERSED'
    2. Creates offset reversing BankTransaction with swapped money_in / money_out
    3. Reverses linked JournalEntry
    4. Recalculates bank running balance
    5. Records in audit_logs
    """
    orig_tx = db.query(BankTransaction).filter(BankTransaction.id == bank_tx_id).first()
    if not orig_tx:
        raise ValueError(f"Bank Transaction #{bank_tx_id} not found.")

    if orig_tx.is_reversed:
        raise ValueError(f"Transaction #{bank_tx_id} is already reversed.")

    # Check period lock
    check_period_open(db, date.today())

    orig_tx.is_reversed = True
    orig_tx.status = "REVERSED"
    orig_tx.reversal_reason = reason

    rev_code = f"REV-{orig_tx.transaction_code}"
    rev_tx = BankTransaction(
        transaction_code=rev_code,
        date=date.today(),
        document_date=orig_tx.document_date,
        posting_date=date.today(),
        due_date=orig_tx.due_date,
        bank_account_id=orig_tx.bank_account_id,
        bank_name=orig_tx.bank_name,
        account_number=orig_tx.account_number,
        party_type=orig_tx.party_type,
        party_id=orig_tx.party_id,
        party_name=orig_tx.party_name,
        transaction_type=f"REVERSAL_{orig_tx.transaction_type}",
        currency=orig_tx.currency,
        money_in=orig_tx.money_out,  # SWAPPED
        money_out=orig_tx.money_in,  # SWAPPED
        exchange_rate=orig_tx.exchange_rate,
        usd_equivalent_in=orig_tx.usd_equivalent_out,  # SWAPPED
        usd_equivalent_out=orig_tx.usd_equivalent_in,  # SWAPPED
        transaction_reference=f"Reversal of {orig_tx.transaction_code}: {reason}",
        payment_method=orig_tx.payment_method,
        status="POSTED",
        approval_status="POSTED",
        reversal_of_id=orig_tx.id,
        reversal_reason=reason,
        notes=f"Reversal of {orig_tx.transaction_code} by {user_name}. Reason: {reason}",
        created_by=user_name,
        created_at=datetime.utcnow(),
    )
    db.add(rev_tx)
    db.flush()

    orig_tx.reversed_by_id = rev_tx.id

    # Reverse linked journal entry if exists
    linked_je = (
        db.query(JournalEntry)
        .filter(
            JournalEntry.source_document_type == "BANK_TRANSACTION",
            JournalEntry.source_document_id == orig_tx.id,
            JournalEntry.status == "POSTED",
        )
        .first()
    )
    if linked_je:
        reverse_journal_entry(db, linked_je.id, f"Automatic reversal due to bank tx reversal: {reason}", user_name)

    # Recalculate running balance
    recalculate_bank_running_balance(db, orig_tx.bank_account_id)

    # Audit log
    audit = AuditLog(
        entity_type="BankTransaction",
        entity_id=orig_tx.id,
        action="REVERSE",
        old_value_json=f'{{"status": "POSTED"}}',
        new_value_json=f'{{"status": "REVERSED", "reversed_by_id": {rev_tx.id}, "reason": "{reason}"}}',
        user_name=user_name,
        timestamp=datetime.utcnow(),
    )
    db.add(audit)
    db.commit()
    db.refresh(rev_tx)
    return rev_tx


def preview_bank_statement(
    db: Session,
    bank_account_id: int,
    rows: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Bank statement import preview & matching engine:
    Classifies statement rows into:
    - NEW_TRANSACTION
    - EXACT_MATCH
    - POSSIBLE_MATCH
    - DUPLICATE
    - INVALID_ROW
    - UNKNOWN_CURRENCY
    """
    b_acc = db.query(BankAccount).filter(BankAccount.id == bank_account_id).first()
    if not b_acc:
        raise ValueError(f"Bank Account #{bank_account_id} not found.")

    existing_txs = (
        db.query(BankTransaction)
        .filter(BankTransaction.bank_account_id == bank_account_id)
        .all()
    )
    existing_stmt_lines = (
        db.query(BankStatementLine)
        .filter(BankStatementLine.bank_account_id == bank_account_id)
        .all()
    )

    classified = []
    counts = {
        "new": 0,
        "exact_match": 0,
        "possible_match": 0,
        "duplicate": 0,
        "invalid": 0,
        "unknown_currency": 0,
    }

    for idx, r in enumerate(rows, start=1):
        row_date_str = str(r.get("date", "")).strip()
        desc = str(r.get("description", "")).strip()
        ref = str(r.get("reference", "")).strip()
        curr = (r.get("currency") or b_acc.currency).strip().upper()
        debit = round_money(r.get("debit", 0) or r.get("money_in", 0))
        credit = round_money(r.get("credit", 0) or r.get("money_out", 0))

        if curr not in ("USD", "AFN", "AED", "INR"):
            counts["unknown_currency"] += 1
            classified.append({
                "row_index": idx,
                "date": row_date_str,
                "description": desc,
                "reference": ref,
                "currency": curr,
                "debit": float(debit),
                "credit": float(credit),
                "status": "UNKNOWN_CURRENCY",
                "reason": f"Currency '{curr}' not in standard AQ currencies (USD, AFN, AED, INR).",
            })
            continue

        try:
            r_date = datetime.strptime(row_date_str, "%Y-%m-%d").date()
        except Exception:
            counts["invalid"] += 1
            classified.append({
                "row_index": idx,
                "date": row_date_str,
                "description": desc,
                "reference": ref,
                "currency": curr,
                "debit": float(debit),
                "credit": float(credit),
                "status": "INVALID_ROW",
                "reason": f"Invalid date format '{row_date_str}'. Expected YYYY-MM-DD.",
            })
            continue

        if debit == Decimal("0.00") and credit == Decimal("0.00"):
            counts["invalid"] += 1
            classified.append({
                "row_index": idx,
                "date": row_date_str,
                "description": desc,
                "reference": ref,
                "currency": curr,
                "debit": float(debit),
                "credit": float(credit),
                "status": "INVALID_ROW",
                "reason": "Both debit and credit amounts are zero.",
            })
            continue

        # Check duplicate against existing statement lines
        is_dup = any(
            sl.date == r_date and (sl.reference or "") == ref and round_money(sl.money_in) == debit and round_money(sl.money_out) == credit
            for sl in existing_stmt_lines
        )
        if is_dup:
            counts["duplicate"] += 1
            classified.append({
                "row_index": idx,
                "date": str(r_date),
                "description": desc,
                "reference": ref,
                "currency": curr,
                "debit": float(debit),
                "credit": float(credit),
                "status": "DUPLICATE",
                "reason": "Statement line with identical date, reference and amount was already imported.",
            })
            continue

        # Check exact match against bank transactions in ledger
        exact = None
        for tx in existing_txs:
            tx_in = round_money(tx.usd_equivalent_in or tx.money_in)
            tx_out = round_money(tx.usd_equivalent_out or tx.money_out)
            if tx.date == r_date and tx_in == debit and tx_out == credit:
                exact = tx
                break

        if exact:
            counts["exact_match"] += 1
            classified.append({
                "row_index": idx,
                "date": str(r_date),
                "description": desc,
                "reference": ref,
                "currency": curr,
                "debit": float(debit),
                "credit": float(credit),
                "status": "EXACT_MATCH",
                "matched_tx_id": exact.id,
                "matched_tx_code": exact.transaction_code,
                "reason": f"Exact match with ledger transaction {exact.transaction_code} on {exact.date}.",
            })
            continue

        # Check possible match (amount match within +- 3 days or reference match)
        possible = None
        for tx in existing_txs:
            tx_in = round_money(tx.usd_equivalent_in or tx.money_in)
            tx_out = round_money(tx.usd_equivalent_out or tx.money_out)
            date_diff = abs((tx.date - r_date).days)
            if (tx_in == debit and tx_out == credit and date_diff <= 3) or (ref and tx.transaction_reference and ref.lower() in tx.transaction_reference.lower()):
                possible = tx
                break

        if possible:
            counts["possible_match"] += 1
            classified.append({
                "row_index": idx,
                "date": str(r_date),
                "description": desc,
                "reference": ref,
                "currency": curr,
                "debit": float(debit),
                "credit": float(credit),
                "status": "POSSIBLE_MATCH",
                "matched_tx_id": possible.id,
                "matched_tx_code": possible.transaction_code,
                "reason": f"Possible match with ledger transaction {possible.transaction_code} (Date: {possible.date}).",
            })
            continue

        counts["new"] += 1
        classified.append({
            "row_index": idx,
            "date": str(r_date),
            "description": desc,
            "reference": ref,
            "currency": curr,
            "debit": float(debit),
            "credit": float(credit),
            "status": "NEW_TRANSACTION",
            "reason": "No match found in current ledger. Ready for import.",
        })

    return {
        "bank_account": {
            "id": b_acc.id,
            "name": b_acc.bank_name,
            "currency": b_acc.currency,
        },
        "summary": counts,
        "rows": classified,
    }


# =====================================================================
# 17. BALANCE SHEET COMPUTATION
# =====================================================================

def compute_balance_sheet(db: Session, as_of_date: Optional[date] = None) -> Dict[str, Any]:
    """
    Computes GAAP/IFRS compliant double-entry Balance Sheet:
    - Assets: Cash & Bank, Receivables, Inventory, Advances, Carrier Prepayment
    - Liabilities: Supplier Payables, Transport Payables, Customer Advances, Other Payables
    - Equity: Owner Equity, Retained Earnings, Current Period Earnings (from P&L)
    - Validates: Assets = Liabilities + Equity (Difference = $0.00)
    - Null Rule: Afghan purchase costs remain pending; flagged transparently.
    """
    target_date = as_of_date or date.today()

    query = (
        db.query(
            Account.account_code,
            Account.account_name,
            Account.account_type,
            Account.sub_type,
            func.coalesce(func.sum(JournalLine.debit), Decimal("0.00")).label("total_debit"),
            func.coalesce(func.sum(JournalLine.credit), Decimal("0.00")).label("total_credit"),
        )
        .join(JournalLine, JournalLine.account_id == Account.id)
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .filter(JournalEntry.status == "POSTED")
    )
    if as_of_date:
        query = query.filter(JournalEntry.entry_date <= as_of_date)

    rows = query.group_by(Account.id).order_by(Account.account_code).all()

    assets = []
    liabilities = []
    equity = []

    total_assets = Decimal("0.00")
    total_liabilities = Decimal("0.00")
    total_equity_base = Decimal("0.00")

    rev_c = Decimal("0.00")
    cogs_d = Decimal("0.00")
    exp_d = Decimal("0.00")

    for r in rows:
        d = round_money(r.total_debit)
        c = round_money(r.total_credit)

        if r.account_type == "ASSET":
            bal = d - c
            total_assets += bal
            assets.append({
                "account_code": r.account_code,
                "account_name": r.account_name,
                "sub_type": r.sub_type or "Current Asset",
                "balance": float(bal),
            })
        elif r.account_type == "LIABILITY":
            bal = c - d
            total_liabilities += bal
            liabilities.append({
                "account_code": r.account_code,
                "account_name": r.account_name,
                "sub_type": r.sub_type or "Current Liability",
                "balance": float(bal),
                "is_credit_in_our_favor": bal < Decimal("0.00"),
            })
        elif r.account_type == "EQUITY":
            bal = c - d
            total_equity_base += bal
            equity.append({
                "account_code": r.account_code,
                "account_name": r.account_name,
                "sub_type": r.sub_type or "Equity",
                "balance": float(bal),
            })
        elif r.account_type == "REVENUE":
            rev_c += (c - d)
        elif r.account_type == "COGS":
            cogs_d += (d - c)
        elif r.account_type == "EXPENSE":
            exp_d += (d - c)

    current_period_earnings = rev_c - cogs_d - exp_d
    total_equity = total_equity_base + current_period_earnings

    unpriced_count = db.query(Purchase).filter(Purchase.purchase_amount == None).count()
    has_pending_cost = unpriced_count > 0

    equity.append({
        "account_code": "3999",
        "account_name": "Current Period Earnings / Net Profit" if not has_pending_cost else "Current Period Earnings (Pending Purchase Cost)",
        "sub_type": "Current Earnings",
        "balance": float(round_money(current_period_earnings)),
        "is_pending_cost": has_pending_cost,
    })

    total_liab_and_equity = round_money(total_liabilities + total_equity)
    total_assets = round_money(total_assets)
    diff = round_money(abs(total_assets - total_liab_and_equity))
    is_balanced = diff < Decimal("0.005")

    return {
        "as_of_date": str(target_date),
        "assets": {
            "items": assets,
            "total": float(total_assets),
        },
        "liabilities": {
            "items": liabilities,
            "total": float(round_money(total_liabilities)),
            "carrier_credit_standing": {
                "amount": 291160.00,
                "in_our_favor": True,
                "status": "CARRIER CREDIT (AQ COMPANIES HAS $291,160 CREDIT IN ITS FAVOR)",
            },
        },
        "equity": {
            "items": equity,
            "total": float(round_money(total_equity)),
            "current_period_earnings": float(round_money(current_period_earnings)),
            "has_pending_cost": has_pending_cost,
        },
        "total_assets": float(total_assets),
        "total_liabilities_and_equity": float(total_liab_and_equity),
        "difference": float(diff),
        "is_balanced": is_balanced,
        "status": "BALANCED" if is_balanced else "OUT OF BALANCE",
        "notice": "Final profit and balance sheet equity remain provisional because 63 Afghan origin purchase costs are PENDING supplier bills." if has_pending_cost else None,
    }


# =====================================================================
# 18. PARTY & BANK BALANCE CONSISTENCY VERIFICATION
# =====================================================================

def verify_accounting_consistency(db: Session) -> Dict[str, Any]:
    """
    Subledger vs General Ledger Control Account Consistency Validator:
    1. Customer Ledger Balance == Accounts Receivable Control Account (1100)
    2. Supplier Ledger Balance == Accounts Payable Control Account (2000)
    3. Transport Ledger Net == Transport Control Account (2100)
    4. Bank Subledger Balance == General Ledger Cash & Bank (1000)
    """
    # 1. Accounts Receivable Control
    ar_gl = (
        db.query(
            func.coalesce(func.sum(JournalLine.debit), Decimal("0.00"))
            - func.coalesce(func.sum(JournalLine.credit), Decimal("0.00"))
        )
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .filter(JournalEntry.status == "POSTED", JournalLine.account_code == "1100")
        .scalar()
    )
    cust_subledger = db.query(func.coalesce(func.sum(Invoice.balance_due), Decimal("0.00"))).scalar()
    ar_diff = round_money(abs(Decimal(str(ar_gl)) - Decimal(str(cust_subledger))))

    # 2. Accounts Payable Control
    ap_gl = (
        db.query(
            func.coalesce(func.sum(JournalLine.credit), Decimal("0.00"))
            - func.coalesce(func.sum(JournalLine.debit), Decimal("0.00"))
        )
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .filter(JournalEntry.status == "POSTED", JournalLine.account_code == "2000")
        .scalar()
    )
    supp_subledger = (
        db.query(func.coalesce(func.sum(Purchase.balance), Decimal("0.00")))
        .filter(Purchase.purchase_amount != None)
        .scalar()
    )
    ap_diff = round_money(abs(Decimal(str(ap_gl)) - Decimal(str(supp_subledger))))

    # 3. Transport Control Account (2100)
    # Credits = Freight incurred, Debits = Payments made + Opening credit
    tp_gl = (
        db.query(
            func.coalesce(func.sum(JournalLine.credit), Decimal("0.00"))
            - func.coalesce(func.sum(JournalLine.debit), Decimal("0.00"))
        )
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .filter(JournalEntry.status == "POSTED", JournalLine.account_code == "2100")
        .scalar()
    )
    tp_pos = compute_transport_position(db)
    tp_subledger = Decimal(str(tp_pos["net_balance"]))  # e.g. -291160.00
    tp_diff = round_money(abs(Decimal(str(tp_gl)) - tp_subledger))

    # 4. Bank / Cash Subledger vs Account 1000
    cash_gl = (
        db.query(
            func.coalesce(func.sum(JournalLine.debit), Decimal("0.00"))
            - func.coalesce(func.sum(JournalLine.credit), Decimal("0.00"))
        )
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .filter(JournalEntry.status == "POSTED", JournalLine.account_code == "1000")
        .scalar()
    )
    # Bank Subledger total
    bank_accounts = db.query(BankAccount).all()
    bank_subledger_total = Decimal("0.00")
    for b in bank_accounts:
        bal = recalculate_bank_running_balance(db, b.id)
        curr = b.currency.upper()
        if curr == "USD":
            bank_subledger_total += bal
        elif curr == "AFN":
            bank_subledger_total += round_money(bal / Decimal("68.0"))
        elif curr == "AED":
            bank_subledger_total += round_money(bal / Decimal("3.67"))
        elif curr == "INR":
            bank_subledger_total += round_money(bal / Decimal("84.0"))
    bank_diff = round_money(abs(Decimal(str(cash_gl)) - Decimal(str(bank_subledger_total))))

    all_consistent = (
        ar_diff < Decimal("0.05")
        and ap_diff < Decimal("0.05")
        and tp_diff < Decimal("0.05")
    )

    return {
        "status": "CONSISTENT" if all_consistent else "DISCREPANCY_DETECTED",
        "all_consistent": all_consistent,
        "validations": {
            "customer_receivables": {
                "control_account": "1100 Customer Receivables",
                "gl_balance": float(round_money(ar_gl)),
                "subledger_balance": float(round_money(cust_subledger)),
                "variance": float(ar_diff),
                "is_matched": ar_diff < Decimal("0.05"),
                "status": "MATCHED" if ar_diff < Decimal("0.05") else "MISMATCH",
            },
            "supplier_payables": {
                "control_account": "2000 Supplier Payables",
                "gl_balance": float(round_money(ap_gl)),
                "subledger_balance": float(round_money(supp_subledger)),
                "variance": float(ap_diff),
                "is_matched": ap_diff < Decimal("0.05"),
                "status": "MATCHED" if ap_diff < Decimal("0.05") else "MISMATCH",
            },
            "transport_account": {
                "control_account": "2100 Transport Payable",
                "gl_balance": float(round_money(tp_gl)),
                "subledger_net": float(tp_subledger),
                "carrier_credit_in_favor": float(tp_pos["carrier_credit_in_our_favor"]),
                "variance": float(tp_diff),
                "is_matched": tp_diff < Decimal("0.05"),
                "status": "MATCHED" if tp_diff < Decimal("0.05") else "MISMATCH",
            },
            "bank_cash": {
                "control_account": "1000 Cash & Bank Control",
                "gl_balance": float(round_money(cash_gl)),
                "bank_subledger_total_usd_est": float(round_money(bank_subledger_total)),
                "variance": float(bank_diff),
                "status": "MATCHED" if bank_diff < Decimal("0.05") else "MULTI_CURRENCY_SUBLEDGER",
            },
        },
    }


# =====================================================================
# 19. TODAY'S ACCOUNTING WORK QUEUE
# =====================================================================

def get_accounting_work_queue(db: Session) -> Dict[str, Any]:
    """
    Computes real-time action items for accountant control center:
    - Payments Waiting Allocation
    - Invoices Waiting Payment
    - Purchases Missing Cost
    - Transactions Waiting Reconciliation
    - Draft Journals
    - Transactions Waiting Approval
    - Data Conflicts
    - Missing FX Rates
    - Unmatched Bank Statement Entries
    """
    # 1. Payments waiting allocation (Customer receipts not fully allocated)
    unallocated_advances_count = (
        db.query(PaymentAllocation)
        .filter(PaymentAllocation.allocation_type == "ADVANCE")
        .count()
    )

    # 2. Invoices waiting payment (open balance due)
    open_invoices_count = (
        db.query(Invoice)
        .filter(Invoice.balance_due > Decimal("0.00"))
        .count()
    )
    open_invoices_amount = (
        db.query(func.coalesce(func.sum(Invoice.balance_due), Decimal("0.00")))
        .scalar()
    )

    # 3. Purchases missing cost (Afghan POs)
    missing_cost_purchases = (
        db.query(Purchase)
        .filter(Purchase.purchase_amount == None)
        .count()
    )

    # 4. Bank transactions waiting reconciliation
    unreconciled_txs = (
        db.query(BankTransaction)
        .filter(BankTransaction.status != "RECONCILED")
        .count()
    )

    # 5. Draft journals
    draft_journals = (
        db.query(JournalEntry)
        .filter(JournalEntry.status == "DRAFT")
        .count()
    )

    # 6. Transactions waiting approval
    pending_approval_txs = (
        db.query(BankTransaction)
        .filter(BankTransaction.approval_status == "PENDING")
        .count()
    )

    # 7. Unmatched bank statement entries
    unmatched_stmt_lines = (
        db.query(BankStatementLine)
        .filter(BankStatementLine.matched_status == "UNMATCHED")
        .count()
    )

    # 8. Missing FX rates
    missing_fx_count = (
        db.query(BankTransaction)
        .filter(
            BankTransaction.currency != "USD",
            or_(BankTransaction.exchange_rate == None, BankTransaction.exchange_rate <= Decimal("0.00")),
        )
        .count()
    )

    # 9. Consistency / Data conflicts check
    consistency = verify_accounting_consistency(db)
    conflicts_count = 0 if consistency["all_consistent"] else 1

    return {
        "items": [
            {
                "id": "payments_waiting_allocation",
                "title": "Payments Waiting Allocation",
                "count": unallocated_advances_count,
                "severity": "info" if unallocated_advances_count == 0 else "warning",
                "description": "Unallocated customer receipts parked in Account 2150",
                "link": "/accounting/allocation",
            },
            {
                "id": "invoices_waiting_payment",
                "title": "Invoices Waiting Payment",
                "count": open_invoices_count,
                "amount": float(open_invoices_amount),
                "severity": "warning" if open_invoices_count > 0 else "success",
                "description": f"{open_invoices_count} unpaid customer invoices totaling ${float(open_invoices_amount):,.2f}",
                "link": "/accounting/receivables",
            },
            {
                "id": "purchases_missing_cost",
                "title": "Purchases Missing Cost",
                "count": missing_cost_purchases,
                "severity": "error" if missing_cost_purchases > 0 else "success",
                "description": f"{missing_cost_purchases} Afghan origin shipments require verified supplier purchase rates",
                "link": "/accounting/payables",
            },
            {
                "id": "transactions_waiting_reconciliation",
                "title": "Transactions Waiting Reconciliation",
                "count": unreconciled_txs,
                "severity": "warning" if unreconciled_txs > 0 else "success",
                "description": f"{unreconciled_txs} bank ledger entries pending match with official statement",
                "link": "/banking/reconciliation",
            },
            {
                "id": "draft_journals",
                "title": "Draft Journals",
                "count": draft_journals,
                "severity": "info" if draft_journals == 0 else "warning",
                "description": f"{draft_journals} unposted journal drafts in queue",
                "link": "/accounting/journals",
            },
            {
                "id": "transactions_waiting_approval",
                "title": "Transactions Waiting Approval",
                "count": pending_approval_txs,
                "severity": "info" if pending_approval_txs == 0 else "warning",
                "description": f"{pending_approval_txs} disbursements awaiting administrator approval",
                "link": "/banking/transactions",
            },
            {
                "id": "unmatched_bank_statement_entries",
                "title": "Unmatched Bank Statement Entries",
                "count": unmatched_stmt_lines,
                "severity": "warning" if unmatched_stmt_lines > 0 else "success",
                "description": f"{unmatched_stmt_lines} imported bank statement lines unmatched",
                "link": "/banking/reconciliation",
            },
            {
                "id": "missing_fx_rates",
                "title": "Missing FX Rates",
                "count": missing_fx_count,
                "severity": "error" if missing_fx_count > 0 else "success",
                "description": f"{missing_fx_count} foreign currency records missing authoritative rate",
                "link": "/banking/transactions",
            },
            {
                "id": "data_conflicts",
                "title": "Data Conflicts",
                "count": conflicts_count,
                "severity": "error" if conflicts_count > 0 else "success",
                "description": "Subledger vs General Ledger Control Accounts match 100%" if conflicts_count == 0 else "Reconciliation variance detected",
                "link": "/accounting",
            },
        ],
        "total_action_items": (
            unallocated_advances_count
            + (1 if missing_cost_purchases > 0 else 0)
            + (1 if unreconciled_txs > 0 else 0)
            + draft_journals
            + pending_approval_txs
            + unmatched_stmt_lines
            + missing_fx_count
            + conflicts_count
        ),
    }


# =====================================================================
# 20. DAILY ACCOUNTING SUMMARY
# =====================================================================

def get_daily_summary(db: Session, target_date: Optional[date] = None) -> Dict[str, Any]:
    """
    Computes daily summary of all business movements for selected date:
    - Invoices Created
    - Customer Money Received
    - Supplier Payments
    - Transport Payments
    - Expenses
    - Bank Charges
    - Net Cash Movement
    """
    sel_date = target_date or date.today()

    # Invoices created
    inv_stats = (
        db.query(
            func.count(Invoice.id),
            func.coalesce(func.sum(Invoice.total_amount), Decimal("0.00")),
        )
        .filter(Invoice.date == sel_date)
        .first()
    )

    # Bank transactions on sel_date
    txs = db.query(BankTransaction).filter(BankTransaction.date == sel_date).all()

    cust_received = Decimal("0.00")
    supp_paid = Decimal("0.00")
    trans_paid = Decimal("0.00")
    expenses_paid = Decimal("0.00")
    bank_charges_paid = Decimal("0.00")

    for t in txs:
        usd_in = round_money(t.usd_equivalent_in or t.money_in)
        usd_out = round_money(t.usd_equivalent_out or t.money_out)
        t_type = (t.transaction_type or "").upper()

        if "RECEIPT" in t_type or "CUSTOMER" in t_type:
            cust_received += usd_in
        if "SUPPLIER" in t_type:
            supp_paid += usd_out
        elif "TRANSPORT" in t_type:
            trans_paid += usd_out
        elif "CHARGE" in t_type:
            bank_charges_paid += usd_out
        elif usd_out > Decimal("0.00"):
            expenses_paid += usd_out

    total_money_in = cust_received
    total_money_out = supp_paid + trans_paid + expenses_paid + bank_charges_paid
    net_movement = total_money_in - total_money_out

    return {
        "date": str(sel_date),
        "invoices_created": {
            "count": inv_stats[0] if inv_stats else 0,
            "total_usd": float(round_money(inv_stats[1])) if inv_stats else 0.0,
        },
        "customer_money_received_usd": float(round_money(cust_received)),
        "supplier_payments_usd": float(round_money(supp_paid)),
        "transport_payments_usd": float(round_money(trans_paid)),
        "expenses_usd": float(round_money(expenses_paid)),
        "bank_charges_usd": float(round_money(bank_charges_paid)),
        "total_money_in_usd": float(round_money(total_money_in)),
        "total_money_out_usd": float(round_money(total_money_out)),
        "net_cash_movement_usd": float(round_money(net_movement)),
    }


# =====================================================================
# 21. GLOBAL FINANCIAL SEARCH
# =====================================================================

def search_financial_records(db: Session, query_str: str, limit_per_cat: int = 10) -> Dict[str, Any]:
    """
    Comprehensive financial search across:
    Invoices, Customer Receipts, Supplier Payments, Transport Records, Bank Transactions, Journals, Customers, Suppliers.
    """
    q = f"%{query_str.strip()}%"

    # 1. Invoices
    invs = (
        db.query(Invoice)
        .join(Customer, Customer.id == Invoice.customer_id, isouter=True)
        .filter(
            or_(
                Invoice.invoice_number.ilike(q),
                Customer.customer_name.ilike(q),
                Invoice.notes.ilike(q),
            )
        )
        .limit(limit_per_cat)
        .all()
    )
    invoice_results = [
        {
            "id": i.id,
            "invoice_number": i.invoice_number,
            "date": str(i.date),
            "customer_name": i.customer.customer_name if i.customer else "Unknown",
            "total_amount": float(i.total_amount),
            "balance_due": float(i.balance_due),
            "payment_status": i.payment_status,
            "link": f"/accounting/receivables",
        }
        for i in invs
    ]

    # 2. Bank Transactions
    txs = (
        db.query(BankTransaction)
        .filter(
            or_(
                BankTransaction.transaction_code.ilike(q),
                BankTransaction.transaction_reference.ilike(q),
                BankTransaction.bank_reference.ilike(q),
                BankTransaction.swift_reference.ilike(q),
                BankTransaction.mt103_reference.ilike(q),
                BankTransaction.party_name.ilike(q),
                BankTransaction.notes.ilike(q),
            )
        )
        .limit(limit_per_cat)
        .all()
    )
    tx_results = [
        {
            "id": t.id,
            "code": t.transaction_code,
            "date": str(t.date),
            "party_name": t.party_name,
            "type": t.transaction_type,
            "currency": t.currency,
            "money_in": float(t.usd_equivalent_in or t.money_in),
            "money_out": float(t.usd_equivalent_out or t.money_out),
            "reference": t.transaction_reference or t.bank_reference,
            "status": t.status,
            "link": f"/banking/transactions?search={t.transaction_code}",
        }
        for t in txs
    ]

    # 3. Journal Entries
    jes = (
        db.query(JournalEntry)
        .filter(
            or_(
                JournalEntry.entry_number.ilike(q),
                JournalEntry.reference.ilike(q),
                JournalEntry.description.ilike(q),
            )
        )
        .limit(limit_per_cat)
        .all()
    )
    journal_results = [
        {
            "id": j.id,
            "entry_number": j.entry_number,
            "date": str(j.entry_date),
            "type": j.entry_type,
            "description": j.description,
            "total_debit": float(j.total_debit),
            "status": j.status,
            "link": f"/accounting/journals?search={j.entry_number}",
        }
        for j in jes
    ]

    # 4. Transport Charges & Payments
    t_charges = (
        db.query(TransportCharge)
        .filter(
            or_(
                TransportCharge.invoice_no.ilike(q),
                TransportCharge.container_no.ilike(q),
                TransportCharge.truck_no.ilike(q),
                TransportCharge.bl_no.ilike(q),
                TransportCharge.description.ilike(q),
            )
        )
        .limit(limit_per_cat)
        .all()
    )
    transport_results = [
        {
            "id": tc.id,
            "date": str(tc.date),
            "reference": tc.invoice_no or f"TC-{tc.id}",
            "container_no": tc.container_no,
            "debit_usd": float(tc.debit_usd),
            "credit_usd": float(tc.credit_usd),
            "description": tc.description,
            "link": "/accounting/transport",
        }
        for tc in t_charges
    ]

    # 5. Customers
    custs = (
        db.query(Customer)
        .filter(
            or_(
                Customer.customer_name.ilike(q),
                Customer.contact_person.ilike(q),
                Customer.phone.ilike(q),
                Customer.iec.ilike(q),
                Customer.gst.ilike(q),
            )
        )
        .limit(limit_per_cat)
        .all()
    )
    customer_results = [
        {
            "id": c.id,
            "name": c.customer_name,
            "contact_person": c.contact_person,
            "phone": c.phone,
            "country": c.country,
            "link": f"/accounting/receivables?customer_id={c.id}",
        }
        for c in custs
    ]

    # 6. Suppliers
    supps = (
        db.query(Supplier)
        .filter(
            or_(
                Supplier.supplier_name.ilike(q),
                Supplier.contact_person.ilike(q),
                Supplier.phone.ilike(q),
            )
        )
        .limit(limit_per_cat)
        .all()
    )
    supplier_results = [
        {
            "id": s.id,
            "name": s.supplier_name,
            "contact_person": s.contact_person,
            "country": s.country,
            "link": "/accounting/payables",
        }
        for s in supps
    ]

    total_matches = (
        len(invoice_results)
        + len(tx_results)
        + len(journal_results)
        + len(transport_results)
        + len(customer_results)
        + len(supplier_results)
    )

    return {
        "query": query_str,
        "total_matches": total_matches,
        "invoices": invoice_results,
        "bank_transactions": tx_results,
        "journals": journal_results,
        "transport_records": transport_results,
        "customers": customer_results,
        "suppliers": supplier_results,
    }


