from datetime import datetime, date, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from app import models
from app.core.exceptions import (
    AccountingError,
    UnbalancedJournalError,
    PeriodClosedError,
    DuplicateTransactionError,
    ValidationError,
)


def round_money(val: Any) -> Decimal:
    """Rounds monetary value to 2 decimal places using ROUND_HALF_UP. Preserves None if val is None."""
    if val is None:
        return Decimal("0.00")
    d = Decimal(str(val)) if not isinstance(val, Decimal) else val
    return d.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def round_rate(val: Any) -> Decimal:
    """Rounds rate to 4 decimal places."""
    if val is None:
        return Decimal("0.0000")
    d = Decimal(str(val)) if not isinstance(val, Decimal) else val
    return d.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def round_weight(val: Any) -> Decimal:
    """Rounds weight to 3 decimal places."""
    if val is None:
        return Decimal("0.000")
    d = Decimal(str(val)) if not isinstance(val, Decimal) else val
    return d.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)


def check_accounting_period_open(db: Session, target_date: date, company_id: Optional[int] = None) -> None:
    """Verifies target date falls within an OPEN accounting period. Raises PeriodClosedError if closed or locked."""
    period_name = target_date.strftime("%B %Y")
    query = db.query(models.AccountingPeriod).filter(
        models.AccountingPeriod.period_name == period_name,
    )
    if company_id:
        query = query.filter(models.AccountingPeriod.company_id == company_id)
    period = query.first()

    if period and period.status in ("CLOSED", "LOCKED"):
        raise PeriodClosedError(
            message=f"Posting rejected: Accounting period '{period_name}' is {period.status}.",
            details={"period": period_name, "status": period.status, "date": target_date.isoformat()},
        )


def get_account_by_code(db: Session, account_code: str) -> models.Account:
    """Retrieves account by its standard code. Raises AccountingError if missing."""
    acc = db.query(models.Account).filter(models.Account.account_code == str(account_code)).first()
    if not acc:
        raise AccountingError(
            message=f"Chart of Accounts error: Account code '{account_code}' does not exist.",
            details={"account_code": account_code},
        )
    return acc


def generate_journal_entry_number(db: Session, entry_date: date, entry_type: str = "JV", company_code: str = "AQ") -> str:
    """Generates unique sequential journal entry number: JE-AQ-YYYYMM-XXXX."""
    year_month = entry_date.strftime("%Y%m")
    prefix = f"JE-{company_code}-{year_month}-"
    
    highest = (
        db.query(models.JournalEntry.entry_number)
        .filter(models.JournalEntry.entry_number.like(f"{prefix}%"))
        .order_by(models.JournalEntry.entry_number.desc())
        .first()
    )
    if highest and highest[0]:
        try:
            seq = int(highest[0].split("-")[-1]) + 1
        except Exception:
            seq = 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"


class PostingService:
    """
    Authoritative Accounting Posting Engine for AQ COMPANIES.
    Ensures strict double-entry balancing, idempotency, period controls, and atomic transaction execution.
    """

    @staticmethod
    def create_journal_entry(
        db: Session,
        company_id: int,
        entry_date: date,
        entry_type: str,
        description: str,
        lines: List[Dict[str, Any]],
        reference: Optional[str] = None,
        source_document_type: Optional[str] = None,
        source_document_id: Optional[int] = None,
        posting_key: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        auto_commit: bool = True,
    ) -> models.JournalEntry:
        """
        Creates, validates, and commits an authoritative double-entry journal.
        Enforces:
        - Accounting Period is OPEN
        - Idempotency key / posting key uniqueness
        - SUM(DEBIT) == SUM(CREDIT) (strictly Decimal)
        - Debits and credits are >= 0.00
        """
        # 1. Period check
        check_accounting_period_open(db, entry_date, company_id=company_id)

        # 2. Idempotency check
        key = idempotency_key or posting_key
        if key:
            existing = db.query(models.JournalEntry).filter(
                models.JournalEntry.posting_key == key,
                models.JournalEntry.status == "POSTED",
            ).first()
            if existing:
                return existing

        # 3. Line validation & Double Entry Check
        if not lines or len(lines) < 2:
            raise ValidationError("A journal entry requires at least two lines.")

        total_debit = Decimal("0.00")
        total_credit = Decimal("0.00")
        validated_lines = []

        for idx, line in enumerate(lines, start=1):
            acc_code = line.get("account_code")
            acc_id = line.get("account_id")
            if not acc_id and acc_code:
                account = get_account_by_code(db, acc_code)
                acc_id = account.id
            elif acc_id:
                account = db.query(models.Account).filter(models.Account.id == acc_id).first()
                if not account:
                    raise AccountingError(f"Account ID {acc_id} not found.")
            else:
                raise ValidationError(f"Line {idx} is missing account_code or account_id.")

            debit = round_money(line.get("debit", 0))
            credit = round_money(line.get("credit", 0))

            if debit < 0 or credit < 0:
                raise ValidationError(f"Line {idx}: Negative debits or credits are forbidden.")
            if debit > 0 and credit > 0:
                raise ValidationError(f"Line {idx}: A single line cannot have both debit and credit.")
            if debit == 0 and credit == 0:
                continue

            total_debit += debit
            total_credit += credit

            validated_lines.append({
                "account_id": account.id,
                "account_code": account.account_code,
                "account_name": account.account_name,
                "debit": debit,
                "credit": credit,
                "description": line.get("description", description),
                "party_type": line.get("party_type"),
                "party_id": line.get("party_id"),
                "party_name": line.get("party_name"),
                "currency": line.get("currency", "USD"),
                "exchange_rate": line.get("exchange_rate", Decimal("1.0")),
                "amount_currency": round_money(line.get("amount_currency", debit or credit)),
                "amount_usd": round_money(line.get("amount_usd", debit or credit)),
                "invoice_ref": line.get("invoice_ref"),
                "shipment_ref": line.get("shipment_ref"),
                "bank_ref": line.get("bank_ref"),
            })

        diff = abs(total_debit - total_credit)
        if diff >= Decimal("0.01"):
            raise UnbalancedJournalError(
                message=f"DOUBLE-ENTRY VIOLATION: Total Debit (${total_debit}) != Total Credit (${total_credit}). Difference: ${diff}.",
                details={"total_debit": float(total_debit), "total_credit": float(total_credit), "difference": float(diff)},
            )

        # 4. Generate Journal Entry
        comp = db.query(models.Company).filter(models.Company.id == company_id).first()
        comp_code = comp.company_code if comp else "AQ"
        entry_number = generate_journal_entry_number(db, entry_date, entry_type, comp_code)

        journal = models.JournalEntry(
            company_id=company_id,
            entry_number=entry_number,
            entry_date=entry_date,
            entry_type=entry_type,
            description=description,
            reference=reference,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            total_debit=total_debit,
            total_credit=total_credit,
            status="POSTED",
            posting_key=key,
            version_id=1,
        )
        db.add(journal)
        db.flush()

        for idx, line_data in enumerate(validated_lines, start=1):
            jl = models.JournalLine(
                journal_entry_id=journal.id,
                account_id=line_data["account_id"],
                account_code=line_data["account_code"],
                account_name=line_data["account_name"],
                line_number=idx,
                debit=line_data["debit"],
                credit=line_data["credit"],
                description=line_data["description"],
                party_type=line_data["party_type"],
                party_id=line_data["party_id"],
                party_name=line_data["party_name"],
                currency=line_data["currency"],
                exchange_rate=line_data["exchange_rate"],
                amount_currency=line_data["amount_currency"],
                amount_usd=line_data["amount_usd"],
                invoice_ref=line_data["invoice_ref"],
                shipment_ref=line_data["shipment_ref"],
                bank_ref=line_data["bank_ref"],
                company_id=company_id,
            )
            db.add(jl)

        if auto_commit:
            db.commit()
            db.refresh(journal)

        return journal

    @classmethod
    def post_customer_invoice(cls, db: Session, invoice: models.Invoice) -> models.JournalEntry:
        """
        Posts authoritative Sales Invoice journal:
        Dr 1100 Customer Receivables
        Cr 4000 Sales Revenue
        """
        amount = round_money(invoice.total_amount)
        if amount <= 0:
            raise ValidationError(f"Invoice {invoice.invoice_number} has zero or negative amount.")

        posting_key = f"INVOICE:{invoice.id}"
        existing = db.query(models.JournalEntry).filter(
            models.JournalEntry.posting_key == posting_key,
            models.JournalEntry.status == "POSTED",
        ).first()
        if existing:
            return existing

        ar_acc = get_account_by_code(db, "1100")
        sales_acc = get_account_by_code(db, "4000")

        lines = [
            {
                "account_id": ar_acc.id,
                "debit": amount,
                "credit": Decimal("0.00"),
                "description": f"A/R for Invoice {invoice.invoice_number}",
                "party_type": "CUSTOMER",
                "party_id": invoice.customer_id,
            },
            {
                "account_id": sales_acc.id,
                "debit": Decimal("0.00"),
                "credit": amount,
                "description": f"Sales Revenue for Invoice {invoice.invoice_number}",
                "party_type": "CUSTOMER",
                "party_id": invoice.customer_id,
            },
        ]

        journal = cls.create_journal_entry(
            db=db,
            company_id=invoice.company_id or 1,
            entry_date=invoice.invoice_date or date.today(),
            entry_type="CUSTOMER_INVOICE",
            description=f"Invoiced sales for {invoice.invoice_number}",
            lines=lines,
            reference=invoice.invoice_number,
            source_document_type="INVOICE",
            source_document_id=invoice.id,
            posting_key=posting_key,
        )
        return journal

    @classmethod
    def post_customer_receipt(
        cls,
        db: Session,
        bank_tx: models.BankTransaction,
        customer_id: int,
        invoice_id: Optional[int] = None,
    ) -> models.JournalEntry:
        """
        Posts authoritative Customer Receipt journal:
        Dr Bank / Cash / Sarafi
        Cr 1100 Customer Receivables (or 2150 Customer Advances if unapplied)
        """
        amount = round_money(bank_tx.money_in)
        if amount <= 0:
            raise ValidationError(f"Customer receipt must have positive money_in.")

        posting_key = f"CUSTOMER_RECEIPT:{bank_tx.id}"
        existing = db.query(models.JournalEntry).filter(
            models.JournalEntry.posting_key == posting_key,
            models.JournalEntry.status == "POSTED",
        ).first()
        if existing:
            return existing

        # Determine Bank or Cash Account
        bank_acc = db.query(models.BankAccount).filter(models.BankAccount.id == bank_tx.bank_account_id).first()
        if bank_acc and bank_acc.account_type == "CASH":
            debit_account = get_account_by_code(db, "1010")
        elif bank_acc and bank_acc.account_type == "SARAFI":
            debit_account = get_account_by_code(db, "1030")
        else:
            debit_account = get_account_by_code(db, "1000")

        # If applied to invoice -> Cr 1100, if advance receipt -> Cr 2150
        credit_account = get_account_by_code(db, "1100" if invoice_id else "2150")

        lines = [
            {
                "account_id": debit_account.id,
                "debit": amount,
                "credit": Decimal("0.00"),
                "description": f"Receipt via {bank_tx.bank_name} ({bank_tx.transaction_code})",
            },
            {
                "account_id": credit_account.id,
                "debit": Decimal("0.00"),
                "credit": amount,
                "description": f"Payment from customer {bank_tx.party_name}",
                "party_type": "CUSTOMER",
                "party_id": customer_id,
            },
        ]

        journal = cls.create_journal_entry(
            db=db,
            company_id=bank_tx.company_id or 1,
            entry_date=bank_tx.date or date.today(),
            entry_type="CUSTOMER_PAYMENT",
            description=f"Customer receipt: {bank_tx.party_name} - ${amount}",
            lines=lines,
            reference=bank_tx.transaction_code,
            source_document_type="BANK_TRANSACTION",
            source_document_id=bank_tx.id,
            posting_key=posting_key,
        )
        return journal

    @classmethod
    def post_supplier_bill(cls, db: Session, purchase: models.Purchase) -> Optional[models.JournalEntry]:
        """
        Posts authoritative Supplier Bill journal:
        Dr 5000 Dry Fruit Purchase Cost (or 1200 Inventory)
        Cr 2000 Supplier Payable
        CRITICAL: Does NOT post if purchase_cost is NULL / unknown.
        """
        if purchase.purchase_amount is None:
            # Respect NULL accounting rule
            return None

        amount = round_money(purchase.purchase_amount)
        if amount <= 0:
            return None

        posting_key = f"PURCHASE:{purchase.id}"
        existing = db.query(models.JournalEntry).filter(
            models.JournalEntry.posting_key == posting_key,
            models.JournalEntry.status == "POSTED",
        ).first()
        if existing:
            return existing

        cogs_acc = get_account_by_code(db, "5000")
        ap_acc = get_account_by_code(db, "2000")

        lines = [
            {
                "account_id": cogs_acc.id,
                "debit": amount,
                "credit": Decimal("0.00"),
                "description": f"Cargo purchase cost for {purchase.purchase_code or purchase.id}",
                "party_type": "SUPPLIER",
                "party_id": purchase.supplier_id,
            },
            {
                "account_id": ap_acc.id,
                "debit": Decimal("0.00"),
                "credit": amount,
                "description": f"Supplier payable for {purchase.purchase_code or purchase.id}",
                "party_type": "SUPPLIER",
                "party_id": purchase.supplier_id,
            },
        ]

        journal = cls.create_journal_entry(
            db=db,
            company_id=purchase.company_id or 1,
            entry_date=purchase.purchase_date or date.today(),
            entry_type="PURCHASE_INVOICE",
            description=f"Supplier purchase bill {purchase.purchase_code or purchase.id}",
            lines=lines,
            reference=purchase.purchase_code or str(purchase.id),
            source_document_type="PURCHASE",
            source_document_id=purchase.id,
            posting_key=posting_key,
        )
        return journal

    @classmethod
    def post_supplier_payment(
        cls,
        db: Session,
        bank_tx: models.BankTransaction,
        supplier_id: int,
        is_advance: bool = False,
    ) -> models.JournalEntry:
        """
        Posts authoritative Supplier Payment journal:
        Dr 2000 Supplier Payable (or 1350 Supplier Advance if advance)
        Cr Bank / Cash / Sarafi
        """
        amount = round_money(bank_tx.money_out)
        if amount <= 0:
            raise ValidationError(f"Supplier payment must have positive money_out.")

        posting_key = f"SUPPLIER_PAYMENT:{bank_tx.id}"
        existing = db.query(models.JournalEntry).filter(
            models.JournalEntry.posting_key == posting_key,
            models.JournalEntry.status == "POSTED",
        ).first()
        if existing:
            return existing

        bank_acc = db.query(models.BankAccount).filter(models.BankAccount.id == bank_tx.bank_account_id).first()
        if bank_acc and bank_acc.account_type == "CASH":
            credit_account = get_account_by_code(db, "1010")
        elif bank_acc and bank_acc.account_type == "SARAFI":
            credit_account = get_account_by_code(db, "1030")
        else:
            credit_account = get_account_by_code(db, "1000")

        debit_account = get_account_by_code(db, "1350" if is_advance else "2000")

        lines = [
            {
                "account_id": debit_account.id,
                "debit": amount,
                "credit": Decimal("0.00"),
                "description": f"Supplier payment to {bank_tx.party_name}",
                "party_type": "SUPPLIER",
                "party_id": supplier_id,
            },
            {
                "account_id": credit_account.id,
                "debit": Decimal("0.00"),
                "credit": amount,
                "description": f"Wire/Cash out via {bank_tx.bank_name}",
            },
        ]

        journal = cls.create_journal_entry(
            db=db,
            company_id=bank_tx.company_id or 1,
            entry_date=bank_tx.date or date.today(),
            entry_type="SUPPLIER_PAYMENT",
            description=f"Supplier payment: {bank_tx.party_name} - ${amount}",
            lines=lines,
            reference=bank_tx.transaction_code,
            source_document_type="BANK_TRANSACTION",
            source_document_id=bank_tx.id,
            posting_key=posting_key,
        )
        return journal

    @classmethod
    def post_transport_charge(cls, db: Session, tc: models.TransportCharge) -> models.JournalEntry:
        """
        Posts authoritative Transport Charge journal:
        Dr 5100 Freight / Transport Cost
        Cr 2100 Transport Payable
        """
        amount = round_money(tc.debit_usd)
        if amount <= 0:
            raise ValidationError("Transport charge must have positive debit_usd.")

        posting_key = f"TRANSPORT_CHARGE:{tc.id}"
        existing = db.query(models.JournalEntry).filter(
            models.JournalEntry.posting_key == posting_key,
            models.JournalEntry.status == "POSTED",
        ).first()
        if existing:
            return existing

        freight_acc = get_account_by_code(db, "5100")
        tp_acc = get_account_by_code(db, "2100")

        lines = [
            {
                "account_id": freight_acc.id,
                "debit": amount,
                "credit": Decimal("0.00"),
                "description": f"Freight charge for shipment {tc.shipment_id or ''} - Container {tc.container_number or ''}",
                "party_type": "TRANSPORT",
                "party_id": tc.transport_company_id,
            },
            {
                "account_id": tp_acc.id,
                "debit": Decimal("0.00"),
                "credit": amount,
                "description": f"Payable to carrier for container {tc.container_number or ''}",
                "party_type": "TRANSPORT",
                "party_id": tc.transport_company_id,
            },
        ]

        journal = cls.create_journal_entry(
            db=db,
            company_id=tc.company_id or 1,
            entry_date=tc.date or date.today(),
            entry_type="TRANSPORT_CHARGE",
            description=f"Transport freight: {tc.container_number or ''} - ${amount}",
            lines=lines,
            reference=tc.container_number or str(tc.id),
            source_document_type="TRANSPORT_CHARGE",
            source_document_id=tc.id,
            posting_key=posting_key,
        )
        return journal

    @classmethod
    def post_transport_payment(
        cls,
        db: Session,
        bank_tx: models.BankTransaction,
        transport_company_id: int,
    ) -> models.JournalEntry:
        """
        Posts authoritative Transport Payment journal:
        Dr 2100 Transport Payable
        Cr Bank / Cash / Sarafi
        """
        amount = round_money(bank_tx.money_out)
        if amount <= 0:
            raise ValidationError(f"Transport payment must have positive money_out.")

        posting_key = f"TRANSPORT_PAYMENT:{bank_tx.id}"
        existing = db.query(models.JournalEntry).filter(
            models.JournalEntry.posting_key == posting_key,
            models.JournalEntry.status == "POSTED",
        ).first()
        if existing:
            return existing

        bank_acc = db.query(models.BankAccount).filter(models.BankAccount.id == bank_tx.bank_account_id).first()
        credit_account = get_account_by_code(db, "1000")

        tp_acc = get_account_by_code(db, "2100")

        lines = [
            {
                "account_id": tp_acc.id,
                "debit": amount,
                "credit": Decimal("0.00"),
                "description": f"Carrier freight payment: {bank_tx.party_name}",
                "party_type": "TRANSPORT",
                "party_id": transport_company_id,
            },
            {
                "account_id": credit_account.id,
                "debit": Decimal("0.00"),
                "credit": amount,
                "description": f"Wire transfer via {bank_tx.bank_name}",
            },
        ]

        journal = cls.create_journal_entry(
            db=db,
            company_id=bank_tx.company_id or 1,
            entry_date=bank_tx.date or date.today(),
            entry_type="TRANSPORT_PAYMENT",
            description=f"Transport payment: {bank_tx.party_name} - ${amount}",
            lines=lines,
            reference=bank_tx.transaction_code,
            source_document_type="BANK_TRANSACTION",
            source_document_id=bank_tx.id,
            posting_key=posting_key,
        )
        return journal
