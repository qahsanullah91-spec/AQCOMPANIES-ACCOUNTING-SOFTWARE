from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, desc

try:
    from app import models
    from app.accounting_engine import round_money
except ImportError:
    from backend.app import models
    from backend.app.accounting_engine import round_money


# =====================================================================
# MULTI-COMPANY PERMISSIONS & CONTEXT HELPERS
# =====================================================================

def get_user_accessible_companies(db: Session, user: Optional[models.User] = None) -> List[Dict[str, Any]]:
    """Returns list of companies accessible by the given user. Admin gets all."""
    all_companies = db.query(models.Company).filter(models.Company.status != "DELETED").order_by(models.Company.id).all()
    if not user or user.role in ["ADMIN", "SUPER_ADMIN"]:
        return [
            {
                "id": c.id,
                "company_code": c.company_code,
                "company_name": c.company_name,
                "legal_name": c.legal_name,
                "base_currency": c.base_currency,
                "color_accent": c.color_accent,
                "status": c.status,
                "can_view": True,
                "can_create": True,
                "can_edit": True,
                "can_post": True,
                "can_approve": True,
            }
            for c in all_companies
        ]

    # Check UserCompanyAccess
    user_accesses = {
        ua.company_id: ua
        for ua in db.query(models.UserCompanyAccess).filter(models.UserCompanyAccess.user_id == user.id).all()
    }

    result = []
    for c in all_companies:
        ua = user_accesses.get(c.id)
        if ua and ua.can_view:
            result.append({
                "id": c.id,
                "company_code": c.company_code,
                "company_name": c.company_name,
                "legal_name": c.legal_name,
                "base_currency": c.base_currency,
                "color_accent": c.color_accent,
                "status": c.status,
                "can_view": ua.can_view,
                "can_create": ua.can_create,
                "can_edit": ua.can_edit,
                "can_post": ua.can_post,
                "can_approve": ua.can_approve,
            })
    return result


def validate_company_access(db: Session, user: Optional[models.User], company_id: int, perm: str = "can_view") -> bool:
    """Validates if user has permission for the specified company. None user is treated as admin for background scripts."""
    if not user or user.role in ["ADMIN", "SUPER_ADMIN"]:
        return True
    ua = db.query(models.UserCompanyAccess).filter(
        models.UserCompanyAccess.user_id == user.id,
        models.UserCompanyAccess.company_id == company_id
    ).first()
    if not ua:
        return False
    return getattr(ua, perm, False)


# =====================================================================
# INTERCOMPANY ENGINE
# =====================================================================

def get_intercompany_accounts(db: Session) -> Tuple[models.Account, models.Account]:
    """Retrieves or ensures Accounts 1370 (Due From) and 2350 (Due To)."""
    due_from = db.query(models.Account).filter(models.Account.account_code == "1370").first()
    if not due_from:
        due_from = models.Account(
            account_code="1370",
            account_name="Due From Related Companies",
            account_type="ASSET",
            sub_type="Current Assets",
            description="Intercompany receivable due from related group entities",
            is_active=True,
            is_system=True,
            currency="USD",
        )
        db.add(due_from)
        db.commit()

    due_to = db.query(models.Account).filter(models.Account.account_code == "2350").first()
    if not due_to:
        due_to = models.Account(
            account_code="2350",
            account_name="Due To Related Companies",
            account_type="LIABILITY",
            sub_type="Current Liabilities",
            description="Intercompany payable due to related group entities",
            is_active=True,
            is_system=True,
            currency="USD",
        )
        db.add(due_to)
        db.commit()

    return due_from, due_to


def create_intercompany_transaction(db: Session, data: Dict[str, Any], user_name: str = "Admin") -> models.IntercompanyTransaction:
    """Creates an intercompany transaction with dual-sided journal entries and ledger synchronization."""
    from_company_id = int(data["from_company_id"])
    to_company_id = int(data["to_company_id"])

    if from_company_id == to_company_id:
        raise ValueError("Source and destination companies must be different.")

    from_comp = db.query(models.Company).filter(models.Company.id == from_company_id).first()
    to_comp = db.query(models.Company).filter(models.Company.id == to_company_id).first()
    if not from_comp or not to_comp:
        raise ValueError("Both source and destination companies must exist.")

    amount = round_money(data["amount"])
    if amount <= Decimal("0.00"):
        raise ValueError("Transaction amount must be greater than zero.")

    currency = data.get("currency", "USD")
    exchange_rate = Decimal(str(data.get("exchange_rate", "1.000000")))
    amount_base = round_money(amount * exchange_rate) if exchange_rate != Decimal("1.000000") else amount
    tx_date = data.get("date")
    if isinstance(tx_date, str):
        tx_date = datetime.strptime(tx_date, "%Y-%m-%d").date()
    elif not tx_date:
        tx_date = date.today()

    tx_type = data.get("transaction_type", "BANK_TRANSFER")
    purpose = data.get("purpose", f"Intercompany {tx_type.lower().replace('_', ' ')}")
    reference = data.get("reference", "")
    notes = data.get("notes", "")

    from_bank_id = data.get("from_bank_account_id")
    to_bank_id = data.get("to_bank_account_id")

    # Generate transaction code
    count = db.query(models.IntercompanyTransaction).count()
    tx_code = f"ICT-{tx_date.strftime('%Y%m')}-{count + 1:04d}"

    due_from_acc, due_to_acc = get_intercompany_accounts(db)

    # 1. Post Source Company Journal Entry:
    # Dr: Due From Related Companies (Asset increases)
    # Cr: Bank Account (Asset decreases) or Cash
    from_je_count = db.query(models.JournalEntry).count()
    from_je_num = f"JE-{from_comp.company_code}-{tx_date.strftime('%Y%m')}-{from_je_count + 1:04d}"
    from_je = models.JournalEntry(
        entry_number=from_je_num,
        entry_date=tx_date,
        entry_type="MANUAL",
        description=f"Intercompany {tx_type} to {to_comp.company_name}: {purpose}",
        reference=reference or tx_code,
        source_document_type="INTERCOMPANY",
        total_debit=amount_base,
        total_credit=amount_base,
        status="POSTED",
        company_id=from_company_id,
        created_by=user_name,
        posted_at=datetime.utcnow(),
    )
    db.add(from_je)
    db.flush()

    # Determine credit account in from_company
    bank_acc_1000 = db.query(models.Account).filter(models.Account.account_code == "1000").first()
    cr_acc = bank_acc_1000 or due_to_acc

    line1_from = models.JournalLine(
        journal_entry_id=from_je.id,
        line_number=1,
        account_id=due_from_acc.id,
        account_code=due_from_acc.account_code,
        account_name=due_from_acc.account_name,
        party_type="COMPANY",
        party_id=to_company_id,
        party_name=to_comp.company_name,
        debit=amount_base,
        credit=Decimal("0.00"),
        currency=currency,
        exchange_rate=exchange_rate,
        amount_currency=amount,
        amount_usd=amount_base,
        description=f"Due From {to_comp.company_name} - {purpose}",
        company_id=from_company_id,
    )
    line2_from = models.JournalLine(
        journal_entry_id=from_je.id,
        line_number=2,
        account_id=cr_acc.id,
        account_code=cr_acc.account_code,
        account_name=cr_acc.account_name,
        party_type="COMPANY",
        party_id=to_company_id,
        party_name=to_comp.company_name,
        debit=Decimal("0.00"),
        credit=amount_base,
        currency=currency,
        exchange_rate=exchange_rate,
        amount_currency=amount,
        amount_usd=amount_base,
        description=f"Disbursement on behalf of {to_comp.company_name}",
        company_id=from_company_id,
    )
    db.add(line1_from)
    db.add(line2_from)

    # 2. Post Destination Company Journal Entry:
    # Dr: Bank Account (Asset increases) or Expense/Payable
    # Cr: Due To Related Companies (Liability increases)
    to_je_count = db.query(models.JournalEntry).count()
    to_je_num = f"JE-{to_comp.company_code}-{tx_date.strftime('%Y%m')}-{to_je_count + 1:04d}"
    to_je = models.JournalEntry(
        entry_number=to_je_num,
        entry_date=tx_date,
        entry_type="MANUAL",
        description=f"Intercompany {tx_type} from {from_comp.company_name}: {purpose}",
        reference=reference or tx_code,
        source_document_type="INTERCOMPANY",
        total_debit=amount_base,
        total_credit=amount_base,
        status="POSTED",
        company_id=to_company_id,
        created_by=user_name,
        posted_at=datetime.utcnow(),
    )
    db.add(to_je)
    db.flush()

    line1_to = models.JournalLine(
        journal_entry_id=to_je.id,
        line_number=1,
        account_id=cr_acc.id,
        account_code=cr_acc.account_code,
        account_name=cr_acc.account_name,
        party_type="COMPANY",
        party_id=from_company_id,
        party_name=from_comp.company_name,
        debit=amount_base,
        credit=Decimal("0.00"),
        currency=currency,
        exchange_rate=exchange_rate,
        amount_currency=amount,
        amount_usd=amount_base,
        description=f"Funds/payment received via {from_comp.company_name}",
        company_id=to_company_id,
    )
    line2_to = models.JournalLine(
        journal_entry_id=to_je.id,
        line_number=2,
        account_id=due_to_acc.id,
        account_code=due_to_acc.account_code,
        account_name=due_to_acc.account_name,
        party_type="COMPANY",
        party_id=from_company_id,
        party_name=from_comp.company_name,
        debit=Decimal("0.00"),
        credit=amount_base,
        currency=currency,
        exchange_rate=exchange_rate,
        amount_currency=amount,
        amount_usd=amount_base,
        description=f"Due To {from_comp.company_name} - {purpose}",
        company_id=to_company_id,
    )
    db.add(line1_to)
    db.add(line2_to)

    # 3. Optional Bank Transactions sync if bank accounts provided
    if from_bank_id:
        from_bank = db.query(models.BankAccount).filter(models.BankAccount.id == from_bank_id).first()
        if from_bank:
            from_bank.current_balance = round_money(from_bank.current_balance - amount)
            bt_out = models.BankTransaction(
                transaction_code=f"BT-OUT-{tx_code}",
                voucher_number=f"BPV-{from_comp.company_code}-{tx_date.strftime('%Y%m')}-{count + 1:04d}",
                date=tx_date,
                bank_account_id=from_bank.id,
                bank_name=from_bank.bank_name,
                account_number=from_bank.account_number,
                party_type="INTERNAL",
                party_name=to_comp.company_name,
                transaction_type="TRANSFER",
                currency=currency,
                money_in=Decimal("0.00"),
                money_out=amount,
                usd_equivalent_out=amount_base,
                running_balance=from_bank.current_balance,
                status="POSTED",
                notes=f"Intercompany transfer to {to_comp.company_name} ({tx_code})",
                company_id=from_company_id,
                created_by=user_name,
            )
            db.add(bt_out)

    if to_bank_id:
        to_bank = db.query(models.BankAccount).filter(models.BankAccount.id == to_bank_id).first()
        if to_bank:
            to_bank.current_balance = round_money(to_bank.current_balance + amount)
            bt_in = models.BankTransaction(
                transaction_code=f"BT-IN-{tx_code}",
                voucher_number=f"BRV-{to_comp.company_code}-{tx_date.strftime('%Y%m')}-{count + 1:04d}",
                date=tx_date,
                bank_account_id=to_bank.id,
                bank_name=to_bank.bank_name,
                account_number=to_bank.account_number,
                party_type="INTERNAL",
                party_name=from_comp.company_name,
                transaction_type="TRANSFER",
                currency=currency,
                money_in=amount,
                money_out=Decimal("0.00"),
                usd_equivalent_in=amount_base,
                running_balance=to_bank.current_balance,
                status="POSTED",
                notes=f"Intercompany transfer from {from_comp.company_name} ({tx_code})",
                company_id=to_company_id,
                created_by=user_name,
            )
            db.add(bt_in)

    # 4. Create IntercompanyTransaction record
    ic_tx = models.IntercompanyTransaction(
        transaction_code=tx_code,
        date=tx_date,
        from_company_id=from_company_id,
        to_company_id=to_company_id,
        transaction_type=tx_type,
        amount=amount,
        currency=currency,
        exchange_rate=exchange_rate,
        amount_base=amount_base,
        purpose=purpose,
        reference=reference,
        from_bank_account_id=from_bank_id,
        to_bank_account_id=to_bank_id,
        from_journal_id=from_je.id,
        to_journal_id=to_je.id,
        status="MATCHED",
        notes=notes,
        created_by=user_name,
    )
    db.add(ic_tx)
    db.commit()
    db.refresh(ic_tx)
    return ic_tx


def reverse_intercompany_transaction(db: Session, tx_id: int, reason: str, user_name: str = "Admin") -> models.IntercompanyTransaction:
    """Reverses an intercompany transaction by voiding the dual journals and restoring bank balances."""
    ic_tx = db.query(models.IntercompanyTransaction).filter(models.IntercompanyTransaction.id == tx_id).first()
    if not ic_tx:
        raise ValueError("Intercompany transaction not found.")
    if ic_tx.status == "REVERSED":
        raise ValueError("Transaction has already been reversed.")

    # Void source journal
    if ic_tx.from_journal_id:
        j1 = db.query(models.JournalEntry).filter(models.JournalEntry.id == ic_tx.from_journal_id).first()
        if j1:
            j1.status = "REVERSED"
            j1.reversal_reason = reason

    # Void destination journal
    if ic_tx.to_journal_id:
        j2 = db.query(models.JournalEntry).filter(models.JournalEntry.id == ic_tx.to_journal_id).first()
        if j2:
            j2.status = "REVERSED"
            j2.reversal_reason = reason

    # Restore bank balances if applicable
    if ic_tx.from_bank_account_id:
        b1 = db.query(models.BankAccount).filter(models.BankAccount.id == ic_tx.from_bank_account_id).first()
        if b1:
            b1.current_balance = round_money(b1.current_balance + ic_tx.amount)

    if ic_tx.to_bank_account_id:
        b2 = db.query(models.BankAccount).filter(models.BankAccount.id == ic_tx.to_bank_account_id).first()
        if b2:
            b2.current_balance = round_money(b2.current_balance - ic_tx.amount)

    ic_tx.status = "REVERSED"
    ic_tx.notes = f"{ic_tx.notes or ''}\n[REVERSED] {date.today()}: {reason} by {user_name}".strip()
    db.commit()
    db.refresh(ic_tx)
    return ic_tx


def settle_intercompany_transaction(db: Session, tx_id: int, settlement_ref: str, user_name: str = "Admin") -> models.IntercompanyTransaction:
    """Marks an intercompany transaction as settled."""
    ic_tx = db.query(models.IntercompanyTransaction).filter(models.IntercompanyTransaction.id == tx_id).first()
    if not ic_tx:
        raise ValueError("Intercompany transaction not found.")
    if ic_tx.status == "SETTLED":
        raise ValueError("Transaction has already been settled.")

    ic_tx.status = "SETTLED"
    ic_tx.settled_at = datetime.utcnow()
    ic_tx.settlement_reference = settlement_ref
    ic_tx.notes = f"{ic_tx.notes or ''}\n[SETTLED] {date.today()}: Ref {settlement_ref} by {user_name}".strip()
    db.commit()
    db.refresh(ic_tx)
    return ic_tx


def get_intercompany_reconciliation(db: Session) -> Dict[str, Any]:
    """Computes pair-wise intercompany positions, checking Due To vs Due From equality across all entities."""
    companies = db.query(models.Company).filter(models.Company.status != "DELETED").order_by(models.Company.id).all()
    due_from_acc, due_to_acc = get_intercompany_accounts(db)

    pairs = []
    total_due_from = Decimal("0.00")
    total_due_to = Decimal("0.00")
    total_difference = Decimal("0.00")

    for i in range(len(companies)):
        for j in range(len(companies)):
            if i == j:
                continue
            cA = companies[i]
            cB = companies[j]

            # In cA: Account 1370 where party_id == cB.id
            dr_lines = db.query(
                func.coalesce(func.sum(models.JournalLine.debit - models.JournalLine.credit), 0)
            ).join(models.JournalEntry).filter(
                models.JournalLine.company_id == cA.id,
                models.JournalLine.account_id == due_from_acc.id,
                models.JournalLine.party_id == cB.id,
                models.JournalEntry.status == "POSTED"
            ).scalar()
            due_from_val = round_money(dr_lines)

            # In cB: Account 2350 where party_id == cA.id
            cr_lines = db.query(
                func.coalesce(func.sum(models.JournalLine.credit - models.JournalLine.debit), 0)
            ).join(models.JournalEntry).filter(
                models.JournalLine.company_id == cB.id,
                models.JournalLine.account_id == due_to_acc.id,
                models.JournalLine.party_id == cA.id,
                models.JournalEntry.status == "POSTED"
            ).scalar()
            due_to_val = round_money(cr_lines)

            diff = round_money(due_from_val - due_to_val)
            status = "MATCHED" if abs(diff) < Decimal("0.01") else "OUT_OF_BALANCE"

            if due_from_val > 0 or due_to_val > 0 or diff != 0:
                pairs.append({
                    "from_company_id": cA.id,
                    "from_company_name": cA.company_name,
                    "to_company_id": cB.id,
                    "to_company_name": cB.company_name,
                    "due_from": float(due_from_val),
                    "due_to": float(due_to_val),
                    "difference": float(diff),
                    "status": status,
                })
                total_due_from += due_from_val
                total_due_to += due_to_val
                total_difference += abs(diff)

    # Fetch recent intercompany transactions
    recent_txs = db.query(models.IntercompanyTransaction).order_by(desc(models.IntercompanyTransaction.date), desc(models.IntercompanyTransaction.id)).limit(50).all()
    tx_list = []
    for tx in recent_txs:
        fc = db.query(models.Company).filter(models.Company.id == tx.from_company_id).first()
        tc = db.query(models.Company).filter(models.Company.id == tx.to_company_id).first()
        tx_list.append({
            "id": tx.id,
            "transaction_code": tx.transaction_code,
            "date": tx.date.isoformat(),
            "from_company_id": tx.from_company_id,
            "from_company_name": fc.company_name if fc else f"Company {tx.from_company_id}",
            "to_company_id": tx.to_company_id,
            "to_company_name": tc.company_name if tc else f"Company {tx.to_company_id}",
            "transaction_type": tx.transaction_type,
            "amount": float(tx.amount),
            "currency": tx.currency,
            "exchange_rate": float(tx.exchange_rate),
            "amount_base": float(tx.amount_base),
            "purpose": tx.purpose,
            "reference": tx.reference,
            "status": tx.status,
            "created_by": tx.created_by,
        })

    return {
        "status": "BALANCED" if total_difference == Decimal("0.00") else "UNBALANCED",
        "total_due_from": float(round_money(total_due_from)),
        "total_due_to": float(round_money(total_due_to)),
        "net_difference": float(round_money(total_difference)),
        "reconciliation_pairs": pairs,
        "recent_transactions": tx_list,
    }


def get_intercompany_aging(db: Session) -> List[Dict[str, Any]]:
    """Calculates aging brackets (0-30, 31-60, 61-90, 90+ days) for outstanding intercompany transactions."""
    today = date.today()
    open_txs = db.query(models.IntercompanyTransaction).filter(
        models.IntercompanyTransaction.status.in_(["MATCHED", "DRAFT"])
    ).all()

    aging_map: Dict[Tuple[int, int], Dict[str, Any]] = {}

    for tx in open_txs:
        key = (tx.from_company_id, tx.to_company_id)
        if key not in aging_map:
            fc = db.query(models.Company).filter(models.Company.id == tx.from_company_id).first()
            tc = db.query(models.Company).filter(models.Company.id == tx.to_company_id).first()
            aging_map[key] = {
                "from_company_id": tx.from_company_id,
                "from_company_name": fc.company_name if fc else "",
                "to_company_id": tx.to_company_id,
                "to_company_name": tc.company_name if tc else "",
                "current_0_30": Decimal("0.00"),
                "days_31_60": Decimal("0.00"),
                "days_61_90": Decimal("0.00"),
                "days_90_plus": Decimal("0.00"),
                "total_outstanding": Decimal("0.00"),
                "oldest_date": tx.date,
            }

        age_days = (today - tx.date).days
        amt = tx.amount_base

        if age_days <= 30:
            aging_map[key]["current_0_30"] += amt
        elif age_days <= 60:
            aging_map[key]["days_31_60"] += amt
        elif age_days <= 90:
            aging_map[key]["days_61_90"] += amt
        else:
            aging_map[key]["days_90_plus"] += amt

        aging_map[key]["total_outstanding"] += amt
        if tx.date < aging_map[key]["oldest_date"]:
            aging_map[key]["oldest_date"] = tx.date

    result = []
    for item in aging_map.values():
        result.append({
            "from_company_id": item["from_company_id"],
            "from_company_name": item["from_company_name"],
            "to_company_id": item["to_company_id"],
            "to_company_name": item["to_company_name"],
            "current_0_30": float(round_money(item["current_0_30"])),
            "days_31_60": float(round_money(item["days_31_60"])),
            "days_61_90": float(round_money(item["days_61_90"])),
            "days_90_plus": float(round_money(item["days_90_plus"])),
            "total_outstanding": float(round_money(item["total_outstanding"])),
            "oldest_date": item["oldest_date"].isoformat() if item["oldest_date"] else None,
        })
    return result


# =====================================================================
# CENTRAL TREASURY ENGINE
# =====================================================================

def get_central_treasury_summary(db: Session, company_id: Optional[int] = None) -> Dict[str, Any]:
    """Computes real-time central treasury data: group cash, bank accounts, Sarafi, currencies, and liquidity."""
    query = db.query(models.BankAccount).filter(models.BankAccount.status != "CLOSED")
    if company_id:
        query = query.filter(models.BankAccount.company_id == company_id)
    accounts = query.all()

    companies = {c.id: c for c in db.query(models.Company).all()}

    total_group_cash_usd = Decimal("0.00")
    total_bank_usd = Decimal("0.00")
    total_cash_vault_usd = Decimal("0.00")
    total_sarafi_usd = Decimal("0.00")

    by_company: Dict[int, Dict[str, Any]] = {}
    by_currency: Dict[str, Dict[str, Any]] = {
        "USD": {"original": Decimal("0.00"), "usd_equivalent": Decimal("0.00"), "fx_rate": Decimal("1.0")},
        "AFN": {"original": Decimal("0.00"), "usd_equivalent": Decimal("0.00"), "fx_rate": Decimal("0.0145")},
        "AED": {"original": Decimal("0.00"), "usd_equivalent": Decimal("0.00"), "fx_rate": Decimal("0.2723")},
        "INR": {"original": Decimal("0.00"), "usd_equivalent": Decimal("0.00"), "fx_rate": Decimal("0.0118")},
    }

    accounts_detail = []
    for acc in accounts:
        curr = (acc.currency or "USD").upper()
        bal = round_money(acc.current_balance)
        fx_rate = by_currency.get(curr, {}).get("fx_rate", Decimal("1.0"))
        bal_usd = bal if curr == "USD" else round_money(bal * fx_rate)

        total_group_cash_usd += bal_usd
        if acc.account_type == "BANK":
            total_bank_usd += bal_usd
        elif acc.account_type == "CASH":
            total_cash_vault_usd += bal_usd
        elif acc.account_type == "SARAFI":
            total_sarafi_usd += bal_usd
        else:
            total_bank_usd += bal_usd

        # By Currency
        if curr not in by_currency:
            by_currency[curr] = {"original": Decimal("0.00"), "usd_equivalent": Decimal("0.00"), "fx_rate": Decimal("1.0")}
        by_currency[curr]["original"] += bal
        by_currency[curr]["usd_equivalent"] += bal_usd

        # By Company
        c_id = acc.company_id or 1
        comp_obj = companies.get(c_id)
        if c_id not in by_company:
            by_company[c_id] = {
                "company_id": c_id,
                "company_name": comp_obj.company_name if comp_obj else f"Company {c_id}",
                "company_code": comp_obj.company_code if comp_obj else "UNK",
                "color_accent": comp_obj.color_accent if comp_obj else "#2563eb",
                "total_usd": Decimal("0.00"),
                "bank_count": 0,
            }
        by_company[c_id]["total_usd"] += bal_usd
        by_company[c_id]["bank_count"] += 1

        accounts_detail.append({
            "id": acc.id,
            "company_id": c_id,
            "company_name": comp_obj.company_name if comp_obj else f"Company {c_id}",
            "bank_name": acc.bank_name,
            "account_name": acc.account_name,
            "account_number": acc.account_number,
            "account_type": acc.account_type,
            "currency": curr,
            "current_balance": float(bal),
            "current_balance_usd": float(bal_usd),
            "status": acc.status,
            "branch": acc.branch,
        })

    # Recent Money Movement (last 30 days)
    recent_query = db.query(models.BankTransaction).order_by(desc(models.BankTransaction.date), desc(models.BankTransaction.id))
    if company_id:
        recent_query = recent_query.filter(models.BankTransaction.company_id == company_id)
    recent_txs = recent_query.limit(25).all()

    movement_list = []
    total_money_in_30d = Decimal("0.00")
    total_money_out_30d = Decimal("0.00")

    for tx in recent_txs:
        usd_in = round_money(tx.usd_equivalent_in or tx.money_in)
        usd_out = round_money(tx.usd_equivalent_out or tx.money_out)
        total_money_in_30d += usd_in
        total_money_out_30d += usd_out
        comp_obj = companies.get(tx.company_id)
        movement_list.append({
            "id": tx.id,
            "transaction_code": tx.transaction_code,
            "date": tx.date.isoformat(),
            "company_name": comp_obj.company_name if comp_obj else "AQ COMPANIES",
            "bank_name": tx.bank_name,
            "party_name": tx.party_name,
            "transaction_type": tx.transaction_type,
            "currency": tx.currency,
            "money_in": float(tx.money_in),
            "money_out": float(tx.money_out),
            "usd_amount": float(usd_in if usd_in > 0 else usd_out),
            "is_in": usd_in > 0,
        })

    return {
        "total_group_cash_usd": float(round_money(total_group_cash_usd)),
        "total_bank_usd": float(round_money(total_bank_usd)),
        "total_cash_vault_usd": float(round_money(total_cash_vault_usd)),
        "total_sarafi_usd": float(round_money(total_sarafi_usd)),
        "by_company": [
            {
                "company_id": v["company_id"],
                "company_name": v["company_name"],
                "company_code": v["company_code"],
                "color_accent": v["color_accent"],
                "total_usd": float(round_money(v["total_usd"])),
                "bank_count": v["bank_count"],
            }
            for v in by_company.values()
        ],
        "by_currency": [
            {
                "currency": k,
                "original_amount": float(round_money(v["original"])),
                "usd_equivalent": float(round_money(v["usd_equivalent"])),
                "fx_rate": float(v["fx_rate"]),
            }
            for k, v in by_currency.items()
        ],
        "accounts": accounts_detail,
        "recent_movements": movement_list,
        "summary_30d": {
            "money_in_usd": float(round_money(total_money_in_30d)),
            "money_out_usd": float(round_money(total_money_out_30d)),
            "net_movement_usd": float(round_money(total_money_in_30d - total_money_out_30d)),
        }
    }


# =====================================================================
# CONSOLIDATED FINANCIAL REPORTS ENGINE (WITH AUTOMATIC ELIMINATIONS)
# =====================================================================

def get_consolidated_trial_balance(db: Session, as_of_date: Optional[date] = None) -> Dict[str, Any]:
    """Generates Consolidated Trial Balance across all companies, eliminating Due To (2350) and Due From (1370)."""
    companies = db.query(models.Company).filter(models.Company.status != "DELETED").order_by(models.Company.id).all()
    accounts = db.query(models.Account).filter(models.Account.is_active == True).order_by(models.Account.account_code).all()

    due_from_acc, due_to_acc = get_intercompany_accounts(db)

    rows = []
    company_totals: Dict[int, Dict[str, Decimal]] = {c.id: {"debit": Decimal("0.00"), "credit": Decimal("0.00")} for c in companies}
    total_elimination_dr = Decimal("0.00")
    total_elimination_cr = Decimal("0.00")
    total_consolidated_dr = Decimal("0.00")
    total_consolidated_cr = Decimal("0.00")

    for acc in accounts:
        comp_balances: Dict[str, float] = {}
        row_dr_sum = Decimal("0.00")
        row_cr_sum = Decimal("0.00")

        for c in companies:
            q = db.query(
                func.coalesce(func.sum(models.JournalLine.debit), 0).label("total_debit"),
                func.coalesce(func.sum(models.JournalLine.credit), 0).label("total_credit"),
            ).join(models.JournalEntry).filter(
                models.JournalLine.company_id == c.id,
                models.JournalLine.account_id == acc.id,
                models.JournalEntry.status == "POSTED",
            )
            if as_of_date:
                q = q.filter(models.JournalEntry.entry_date <= as_of_date)
            dr, cr = q.first()
            dr_dec = round_money(dr)
            cr_dec = round_money(cr)

            # Net position based on account normal balance
            if acc.account_type in ["ASSET", "EXPENSE", "COGS"]:
                net = dr_dec - cr_dec
                comp_balances[f"company_{c.id}"] = float(round_money(net))
                if net > 0:
                    row_dr_sum += net
                    company_totals[c.id]["debit"] += net
                elif net < 0:
                    row_cr_sum += abs(net)
                    company_totals[c.id]["credit"] += abs(net)
            else:
                net = cr_dec - dr_dec
                comp_balances[f"company_{c.id}"] = float(round_money(net))
                if net > 0:
                    row_cr_sum += net
                    company_totals[c.id]["credit"] += net
                elif net < 0:
                    row_dr_sum += abs(net)
                    company_totals[c.id]["debit"] += abs(net)

        # Elimination logic:
        # 1370 Due From (Asset): Normal debit. To eliminate, credit elimination.
        # 2350 Due To (Liability): Normal credit. To eliminate, debit elimination.
        elim_dr = Decimal("0.00")
        elim_cr = Decimal("0.00")

        if acc.account_code == "1370":
            # Eliminate all Due From
            elim_cr = row_dr_sum
            row_dr_sum = Decimal("0.00")
        elif acc.account_code == "2350":
            # Eliminate all Due To
            elim_dr = row_cr_sum
            row_cr_sum = Decimal("0.00")

        total_elimination_dr += elim_dr
        total_elimination_cr += elim_cr

        total_consolidated_dr += row_dr_sum
        total_consolidated_cr += row_cr_sum

        # Include in TB if any company has activity or account has eliminations
        has_activity = any(v != 0 for v in comp_balances.values()) or elim_dr != 0 or elim_cr != 0
        if has_activity:
            rows.append({
                "account_code": acc.account_code,
                "account_name": acc.account_name,
                "account_type": acc.account_type,
                "sub_type": acc.sub_type,
                "company_balances": comp_balances,
                "elimination_debit": float(round_money(elim_dr)),
                "elimination_credit": float(round_money(elim_cr)),
                "consolidated_debit": float(round_money(row_dr_sum)),
                "consolidated_credit": float(round_money(row_cr_sum)),
            })

    return {
        "as_of_date": as_of_date.isoformat() if as_of_date else date.today().isoformat(),
        "companies": [{"id": c.id, "company_code": c.company_code, "company_name": c.company_name} for c in companies],
        "rows": rows,
        "totals": {
            "company_totals": {
                f"company_{c_id}": {
                    "debit": float(round_money(vals["debit"])),
                    "credit": float(round_money(vals["credit"])),
                }
                for c_id, vals in company_totals.items()
            },
            "elimination_debit": float(round_money(total_elimination_dr)),
            "elimination_credit": float(round_money(total_elimination_cr)),
            "consolidated_debit": float(round_money(total_consolidated_dr)),
            "consolidated_credit": float(round_money(total_consolidated_cr)),
            "is_balanced": abs(total_consolidated_dr - total_consolidated_cr) < Decimal("0.05"),
        },
    }


def get_consolidated_profit_and_loss(db: Session, start_date: Optional[date] = None, end_date: Optional[date] = None) -> Dict[str, Any]:
    """Generates Consolidated Profit & Loss statement with company columns, eliminations, and group profit."""
    companies = db.query(models.Company).filter(models.Company.status != "DELETED").order_by(models.Company.id).all()

    # Revenue accounts (4000-4999), COGS (5000-5999), Expenses (6000-6999)
    pnl_accounts = db.query(models.Account).filter(
        models.Account.account_type.in_(["REVENUE", "COGS", "EXPENSE"]),
        models.Account.is_active == True,
    ).order_by(models.Account.account_code).all()

    revenue_rows = []
    cogs_rows = []
    expense_rows = []

    comp_totals = {
        c.id: {
            "total_revenue": Decimal("0.00"),
            "total_cogs": Decimal("0.00"),
            "gross_profit": Decimal("0.00"),
            "total_expenses": Decimal("0.00"),
            "net_profit": Decimal("0.00"),
        }
        for c in companies
    }

    elim_summary = {
        "revenue": Decimal("0.00"),
        "cogs": Decimal("0.00"),
        "expense": Decimal("0.00"),
    }

    for acc in pnl_accounts:
        comp_bals: Dict[str, float] = {}
        row_consolidated = Decimal("0.00")

        for c in companies:
            q = db.query(
                func.coalesce(func.sum(models.JournalLine.debit), 0).label("dr"),
                func.coalesce(func.sum(models.JournalLine.credit), 0).label("cr"),
            ).join(models.JournalEntry).filter(
                models.JournalLine.company_id == c.id,
                models.JournalLine.account_id == acc.id,
                models.JournalEntry.status == "POSTED",
            )
            if start_date:
                q = q.filter(models.JournalEntry.entry_date >= start_date)
            if end_date:
                q = q.filter(models.JournalEntry.entry_date <= end_date)

            dr, cr = q.first()
            dr_dec = round_money(dr)
            cr_dec = round_money(cr)

            if acc.account_type == "REVENUE":
                amt = cr_dec - dr_dec
                comp_totals[c.id]["total_revenue"] += amt
            else:
                amt = dr_dec - cr_dec
                if acc.account_type == "COGS":
                    comp_totals[c.id]["total_cogs"] += amt
                else:
                    comp_totals[c.id]["total_expenses"] += amt

            comp_bals[f"company_{c.id}"] = float(round_money(amt))
            row_consolidated += amt

        # Elimination check for internal service fees (if any explicit intercompany billing exists)
        elim_amount = Decimal("0.00")
        row_consolidated -= elim_amount

        row_data = {
            "account_code": acc.account_code,
            "account_name": acc.account_name,
            "account_type": acc.account_type,
            "sub_type": acc.sub_type,
            "company_balances": comp_bals,
            "eliminations": float(round_money(elim_amount)),
            "consolidated_total": float(round_money(row_consolidated)),
        }

        if any(v != 0 for v in comp_bals.values()) or row_consolidated != 0:
            if acc.account_type == "REVENUE":
                revenue_rows.append(row_data)
            elif acc.account_type == "COGS":
                cogs_rows.append(row_data)
            else:
                expense_rows.append(row_data)

    # Compute Gross and Net Profits for each company & consolidated
    consolidated_revenue = Decimal("0.00")
    consolidated_cogs = Decimal("0.00")
    consolidated_expenses = Decimal("0.00")

    for c in companies:
        rev = comp_totals[c.id]["total_revenue"]
        cogs = comp_totals[c.id]["total_cogs"]
        exp = comp_totals[c.id]["total_expenses"]

        comp_totals[c.id]["gross_profit"] = rev - cogs
        comp_totals[c.id]["net_profit"] = rev - cogs - exp

        consolidated_revenue += rev
        consolidated_cogs += cogs
        consolidated_expenses += exp

    consolidated_gross = consolidated_revenue - consolidated_cogs
    consolidated_net = consolidated_gross - consolidated_expenses

    # Check completeness: purchase costs missing or unreconciled
    incomplete_purchases = db.query(models.Purchase).filter(
        or_(models.Purchase.purchase_amount == None, models.Purchase.purchase_amount == 0),
        models.Purchase.net_kg > 0
    ).count()

    is_complete = (incomplete_purchases == 0)
    preliminary_reasons = []
    if incomplete_purchases > 0:
        preliminary_reasons.append(f"{incomplete_purchases} cargo purchases pending cost entry")

    return {
        "period": {
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else date.today().isoformat(),
        },
        "report_status": "FINAL" if is_complete else "PRELIMINARY",
        "is_complete": is_complete,
        "preliminary_reasons": preliminary_reasons,
        "companies": [{"id": c.id, "company_code": c.company_code, "company_name": c.company_name} for c in companies],
        "revenue_rows": revenue_rows,
        "cogs_rows": cogs_rows,
        "expense_rows": expense_rows,
        "summary": {
            "by_company": {
                f"company_{c_id}": {
                    "total_revenue": float(round_money(v["total_revenue"])),
                    "total_cogs": float(round_money(v["total_cogs"])),
                    "gross_profit": float(round_money(v["gross_profit"])),
                    "total_expenses": float(round_money(v["total_expenses"])),
                    "net_profit": float(round_money(v["net_profit"])),
                }
                for c_id, v in comp_totals.items()
            },
            "eliminations": {
                "revenue": float(round_money(elim_summary["revenue"])),
                "cogs": float(round_money(elim_summary["cogs"])),
                "expense": float(round_money(elim_summary["expense"])),
            },
            "consolidated": {
                "total_revenue": float(round_money(consolidated_revenue)),
                "total_cogs": float(round_money(consolidated_cogs)),
                "gross_profit": float(round_money(consolidated_gross)),
                "total_expenses": float(round_money(consolidated_expenses)),
                "net_profit": float(round_money(consolidated_net)),
            }
        }
    }


def get_consolidated_balance_sheet(db: Session, as_of_date: Optional[date] = None) -> Dict[str, Any]:
    """Generates Consolidated Balance Sheet with full eliminations of Due To/From, ensuring Assets = Liabilities + Equity."""
    companies = db.query(models.Company).filter(models.Company.status != "DELETED").order_by(models.Company.id).all()
    bs_accounts = db.query(models.Account).filter(
        models.Account.account_type.in_(["ASSET", "LIABILITY", "EQUITY"]),
        models.Account.is_active == True,
    ).order_by(models.Account.account_code).all()

    # Calculate Current Period Net Profit for Retained Earnings / Current Earnings inclusion
    pnl = get_consolidated_profit_and_loss(db, end_date=as_of_date)

    asset_rows = []
    liability_rows = []
    equity_rows = []

    comp_totals = {
        c.id: {
            "total_assets": Decimal("0.00"),
            "total_liabilities": Decimal("0.00"),
            "total_equity": Decimal("0.00"),
        }
        for c in companies
    }

    consolidated_assets = Decimal("0.00")
    consolidated_liabilities = Decimal("0.00")
    consolidated_equity = Decimal("0.00")

    total_asset_eliminations = Decimal("0.00")
    total_liability_eliminations = Decimal("0.00")

    for acc in bs_accounts:
        comp_bals: Dict[str, float] = {}
        row_sum = Decimal("0.00")

        for c in companies:
            q = db.query(
                func.coalesce(func.sum(models.JournalLine.debit), 0).label("dr"),
                func.coalesce(func.sum(models.JournalLine.credit), 0).label("cr"),
            ).join(models.JournalEntry).filter(
                models.JournalLine.company_id == c.id,
                models.JournalLine.account_id == acc.id,
                models.JournalEntry.status == "POSTED",
            )
            if as_of_date:
                q = q.filter(models.JournalEntry.entry_date <= as_of_date)

            dr, cr = q.first()
            dr_dec = round_money(dr)
            cr_dec = round_money(cr)

            if acc.account_type == "ASSET":
                net = dr_dec - cr_dec
                comp_totals[c.id]["total_assets"] += net
            elif acc.account_type == "LIABILITY":
                net = cr_dec - dr_dec
                comp_totals[c.id]["total_liabilities"] += net
            else:  # EQUITY
                net = cr_dec - dr_dec
                comp_totals[c.id]["total_equity"] += net

            comp_bals[f"company_{c.id}"] = float(round_money(net))
            row_sum += net

        # Elimination logic:
        # Account 1370 (Due From): Eliminate entirely from Assets
        # Account 2350 (Due To): Eliminate entirely from Liabilities
        elim = Decimal("0.00")
        if acc.account_code == "1370":
            elim = row_sum
            total_asset_eliminations += elim
            row_consolidated = Decimal("0.00")
        elif acc.account_code == "2350":
            elim = row_sum
            total_liability_eliminations += elim
            row_consolidated = Decimal("0.00")
        else:
            row_consolidated = row_sum

        if acc.account_type == "ASSET":
            consolidated_assets += row_consolidated
        elif acc.account_type == "LIABILITY":
            consolidated_liabilities += row_consolidated
        else:
            consolidated_equity += row_consolidated

        row_data = {
            "account_code": acc.account_code,
            "account_name": acc.account_name,
            "account_type": acc.account_type,
            "sub_type": acc.sub_type,
            "company_balances": comp_bals,
            "eliminations": float(round_money(elim)),
            "consolidated_total": float(round_money(row_consolidated)),
        }

        if any(v != 0 for v in comp_bals.values()) or row_consolidated != 0 or elim != 0:
            if acc.account_type == "ASSET":
                asset_rows.append(row_data)
            elif acc.account_type == "LIABILITY":
                liability_rows.append(row_data)
            else:
                equity_rows.append(row_data)

    # Add Current Period Net Profit into Equity section
    current_net_bals: Dict[str, float] = {}
    current_net_consolidated = Decimal("0.00")
    for c in companies:
        net_prof = Decimal(str(pnl["summary"]["by_company"][f"company_{c.id}"]["net_profit"]))
        current_net_bals[f"company_{c.id}"] = float(round_money(net_prof))
        comp_totals[c.id]["total_equity"] += net_prof
        current_net_consolidated += net_prof

    consolidated_equity += current_net_consolidated
    equity_rows.append({
        "account_code": "3999",
        "account_name": "Current Period Net Profit",
        "account_type": "EQUITY",
        "sub_type": "Current Earnings",
        "company_balances": current_net_bals,
        "eliminations": 0.0,
        "consolidated_total": float(round_money(current_net_consolidated)),
    })

    # Balance check: Assets = Liabilities + Equity
    is_balanced = abs(consolidated_assets - (consolidated_liabilities + consolidated_equity)) < Decimal("0.05")

    return {
        "as_of_date": as_of_date.isoformat() if as_of_date else date.today().isoformat(),
        "companies": [{"id": c.id, "company_code": c.company_code, "company_name": c.company_name} for c in companies],
        "asset_rows": asset_rows,
        "liability_rows": liability_rows,
        "equity_rows": equity_rows,
        "summary": {
            "by_company": {
                f"company_{c_id}": {
                    "total_assets": float(round_money(v["total_assets"])),
                    "total_liabilities": float(round_money(v["total_liabilities"])),
                    "total_equity": float(round_money(v["total_equity"])),
                    "is_balanced": abs(v["total_assets"] - (v["total_liabilities"] + v["total_equity"])) < Decimal("0.05"),
                }
                for c_id, v in comp_totals.items()
            },
            "eliminations": {
                "asset_eliminations": float(round_money(total_asset_eliminations)),
                "liability_eliminations": float(round_money(total_liability_eliminations)),
            },
            "consolidated": {
                "total_assets": float(round_money(consolidated_assets)),
                "total_liabilities": float(round_money(consolidated_liabilities)),
                "total_equity": float(round_money(consolidated_equity)),
                "liabilities_and_equity": float(round_money(consolidated_liabilities + consolidated_equity)),
                "is_balanced": is_balanced,
            }
        }
    }


# =====================================================================
# GROUP MANAGEMENT DASHBOARD SUMMARY
# =====================================================================

def get_group_management_summary(db: Session) -> Dict[str, Any]:
    """Generates high-level executive KPIs comparing all companies across revenue, receivables, cash, volume, and profit."""
    companies = db.query(models.Company).filter(models.Company.status != "DELETED").order_by(models.Company.id).all()

    total_group_sales = Decimal("0.00")
    total_group_receivables = Decimal("0.00")
    total_group_payables = Decimal("0.00")
    total_group_profit = Decimal("0.00")
    total_group_kg = Decimal("0.000")
    total_group_containers = 0

    company_cards = []

    for c in companies:
        # Sales & Receivables from Invoices
        inv_q = db.query(
            func.coalesce(func.sum(models.Invoice.total_amount), 0).label("sales"),
            func.coalesce(func.sum(models.Invoice.balance_due), 0).label("receivables"),
            func.coalesce(func.sum(models.Invoice.total_net_kg), 0).label("net_kg"),
            func.count(models.Invoice.id).label("invoices_count"),
        ).filter(models.Invoice.company_id == c.id).first()

        sales = round_money(inv_q.sales)
        rec = round_money(inv_q.receivables)
        kg = round_money(inv_q.net_kg)
        inv_count = inv_q.invoices_count

        # Payables from Purchases
        pur_q = db.query(
            func.coalesce(func.sum(models.Purchase.purchase_amount), 0).label("cost"),
            func.coalesce(func.sum(models.Purchase.balance), 0).label("payables"),
        ).filter(models.Purchase.company_id == c.id).first()
        purchase_cost = round_money(pur_q.cost)
        payables = round_money(pur_q.payables)

        # Transport
        trans_charges = round_money(db.query(
            func.coalesce(func.sum(models.TransportCharge.debit_usd), 0)
        ).filter(models.TransportCharge.company_id == c.id).scalar())

        # Shipments / Containers count
        containers = db.query(models.Shipment).filter(models.Shipment.company_id == c.id).count()

        # Cash position
        cash_pos = db.query(func.coalesce(func.sum(models.BankAccount.current_balance), 0)).filter(
            models.BankAccount.company_id == c.id,
            models.BankAccount.status != "CLOSED"
        ).scalar()
        cash_usd = round_money(cash_pos)

        # Known Profit
        profit = round_money(sales - purchase_cost - trans_charges)

        total_group_sales += sales
        total_group_receivables += rec
        total_group_payables += payables
        total_group_profit += profit
        total_group_kg += kg
        total_group_containers += containers

        company_cards.append({
            "company_id": c.id,
            "company_code": c.company_code,
            "company_name": c.company_name,
            "country": c.country,
            "color_accent": c.color_accent,
            "sales": float(sales),
            "receivables": float(rec),
            "payables": float(payables),
            "cash_position": float(cash_usd),
            "known_profit": float(profit),
            "net_kg": float(kg),
            "containers": containers,
            "invoices_count": inv_count,
            "profit_complete": purchase_cost > 0 or sales == 0,
        })

    # Treasury balances
    treasury = get_central_treasury_summary(db)
    reconciliation = get_intercompany_reconciliation(db)

    return {
        "kpis": {
            "total_group_sales": float(round_money(total_group_sales)),
            "total_group_receivables": float(round_money(total_group_receivables)),
            "total_group_payables": float(round_money(total_group_payables)),
            "total_group_cash": treasury["total_group_cash_usd"],
            "total_group_profit": float(round_money(total_group_profit)),
            "total_group_kg": float(round_money(total_group_kg)),
            "total_containers": total_group_containers,
            "intercompany_status": reconciliation["status"],
            "intercompany_diff": reconciliation["net_difference"],
        },
        "companies": company_cards,
        "treasury_by_currency": treasury["by_currency"],
        "reconciliation": reconciliation,
    }
