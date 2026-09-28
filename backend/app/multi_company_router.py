import os
import json
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc

try:
    from app.database import get_db
    from app import models, schemas
    from app.multi_company_engine import (
        get_user_accessible_companies,
        validate_company_access,
        create_intercompany_transaction,
        reverse_intercompany_transaction,
        settle_intercompany_transaction,
        get_intercompany_reconciliation,
        get_intercompany_aging,
        get_central_treasury_summary,
        get_consolidated_trial_balance,
        get_consolidated_profit_and_loss,
        get_consolidated_balance_sheet,
        get_group_management_summary,
    )
except ImportError:
    from backend.app.database import get_db
    from backend.app import models, schemas
    from backend.app.multi_company_engine import (
        get_user_accessible_companies,
        validate_company_access,
        create_intercompany_transaction,
        reverse_intercompany_transaction,
        settle_intercompany_transaction,
        get_intercompany_reconciliation,
        get_intercompany_aging,
        get_central_treasury_summary,
        get_consolidated_trial_balance,
        get_consolidated_profit_and_loss,
        get_consolidated_balance_sheet,
        get_group_management_summary,
    )

router = APIRouter(prefix="/api", tags=["Multi-Company & Treasury"])


# =====================================================================
# 1. COMPANIES MASTER & SWITCHER
# =====================================================================

@router.get("/companies")
def list_companies(db: Session = Depends(get_db)):
    """Returns all accessible business entities in AQ COMPANIES group."""
    companies = get_user_accessible_companies(db)
    return {"status": "SUCCESS", "companies": companies}


@router.get("/companies/{company_id}")
def get_company(company_id: int, db: Session = Depends(get_db)):
    """Returns single company profile and operational parameters."""
    comp = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Company not found.")
    return {"status": "SUCCESS", "company": {
        "id": comp.id,
        "company_code": comp.company_code,
        "company_name": comp.company_name,
        "legal_name": comp.legal_name,
        "trade_license_no": comp.trade_license_no,
        "tax_number": comp.tax_number,
        "country": comp.country,
        "address": comp.address,
        "phone": comp.phone,
        "email": comp.email,
        "base_currency": comp.base_currency,
        "color_accent": comp.color_accent,
        "status": comp.status,
        "created_at": comp.created_at.isoformat() if comp.created_at else None,
    }}


@router.post("/companies")
def create_company(data: Dict[str, Any], db: Session = Depends(get_db)):
    """Registers a new company entity within the group."""
    code = data.get("company_code", "").strip().upper()
    name = data.get("company_name", "").strip()
    if not code or not name:
        raise HTTPException(status_code=400, detail="Company code and name are required.")

    existing = db.query(models.Company).filter(
        or_(models.Company.company_code == code, models.Company.company_name == name)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Company with this code or name already exists.")

    comp = models.Company(
        company_code=code,
        company_name=name,
        legal_name=data.get("legal_name", name),
        trade_license_no=data.get("trade_license_no"),
        tax_number=data.get("tax_number"),
        country=data.get("country", "UAE"),
        address=data.get("address"),
        phone=data.get("phone"),
        email=data.get("email"),
        base_currency=data.get("base_currency", "USD"),
        color_accent=data.get("color_accent", "#2563eb"),
        status=data.get("status", "ACTIVE"),
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)

    # Grant Admin access to this company
    admins = db.query(models.User).filter(models.User.role == "ADMIN").all()
    for adm in admins:
        access = models.UserCompanyAccess(
            user_id=adm.id,
            company_id=comp.id,
            role="ADMIN",
            can_view=True,
            can_create=True,
            can_edit=True,
            can_post=True,
            can_approve=True,
        )
        db.add(access)
    db.commit()

    return {"status": "SUCCESS", "message": f"Company {name} ({code}) created successfully.", "company_id": comp.id}


@router.put("/companies/{company_id}")
def update_company(company_id: int, data: Dict[str, Any], db: Session = Depends(get_db)):
    """Updates company profile, legal details, or brand accent color."""
    comp = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Company not found.")

    for field in ["company_name", "legal_name", "trade_license_no", "tax_number", "country", "address", "phone", "email", "base_currency", "color_accent", "status"]:
        if field in data:
            setattr(comp, field, data[field])

    db.commit()
    return {"status": "SUCCESS", "message": "Company updated successfully."}


@router.post("/companies/{company_id}/archive")
def archive_company(company_id: int, db: Session = Depends(get_db)):
    """Sets company status to ARCHIVED. Financial history is permanently preserved."""
    if company_id == 1:
        raise HTTPException(status_code=400, detail="Primary entity AQ COMPANIES cannot be archived.")
    comp = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Company not found.")

    comp.status = "ARCHIVED"
    db.commit()
    return {"status": "SUCCESS", "message": f"Company {comp.company_name} is now ARCHIVED."}


# =====================================================================
# 2. USER COMPANY PERMISSIONS
# =====================================================================

@router.get("/companies/{company_id}/users")
def get_company_users(company_id: int, db: Session = Depends(get_db)):
    """Returns access privileges for all users assigned to the specified company."""
    accesses = db.query(models.UserCompanyAccess).filter(models.UserCompanyAccess.company_id == company_id).all()
    result = []
    for a in accesses:
        u = db.query(models.User).filter(models.User.id == a.user_id).first()
        result.append({
            "id": a.id,
            "user_id": a.user_id,
            "username": u.username if u else "Unknown",
            "full_name": u.full_name if u else "Unknown",
            "user_role": u.role if u else "ACCOUNTANT",
            "company_role": a.role,
            "can_view": a.can_view,
            "can_create": a.can_create,
            "can_edit": a.can_edit,
            "can_post": a.can_post,
            "can_approve": a.can_approve,
        })
    return {"status": "SUCCESS", "users": result}


@router.post("/companies/{company_id}/users")
def set_company_user_access(company_id: int, data: Dict[str, Any], db: Session = Depends(get_db)):
    """Grants or updates user access permissions for a specific company."""
    user_id = data.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required.")

    access = db.query(models.UserCompanyAccess).filter(
        models.UserCompanyAccess.company_id == company_id,
        models.UserCompanyAccess.user_id == user_id
    ).first()

    if not access:
        access = models.UserCompanyAccess(
            company_id=company_id,
            user_id=user_id,
        )
        db.add(access)

    access.role = data.get("role", access.role or "ACCOUNTANT")
    access.can_view = data.get("can_view", True)
    access.can_create = data.get("can_create", True)
    access.can_edit = data.get("can_edit", True)
    access.can_post = data.get("can_post", True)
    access.can_approve = data.get("can_approve", False)

    db.commit()
    return {"status": "SUCCESS", "message": "User company access updated."}


# =====================================================================
# 3. CENTRAL TREASURY
# =====================================================================

@router.get("/treasury/overview")
def get_treasury_overview(company_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    """Returns central treasury cash position, currency positions, and liquidity movements."""
    return get_central_treasury_summary(db, company_id=company_id)


@router.post("/treasury/transfer")
def execute_treasury_transfer(data: Dict[str, Any], db: Session = Depends(get_db)):
    """Executes a money transfer. If across different companies, creates intercompany dual entries."""
    from_acc_id = data.get("from_bank_account_id")
    to_acc_id = data.get("to_bank_account_id")
    amount = Decimal(str(data.get("amount", "0.00")))
    purpose = data.get("purpose", "Treasury Liquidity Transfer")
    reference = data.get("reference", "")

    if not from_acc_id or not to_acc_id or amount <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Valid from/to accounts and positive amount required.")

    from_acc = db.query(models.BankAccount).filter(models.BankAccount.id == from_acc_id).first()
    to_acc = db.query(models.BankAccount).filter(models.BankAccount.id == to_acc_id).first()
    if not from_acc or not to_acc:
        raise HTTPException(status_code=404, detail="One or both bank accounts not found.")

    from_company_id = from_acc.company_id or 1
    to_company_id = to_acc.company_id or 1

    if from_company_id == to_company_id:
        # Same company transfer: Bank to Bank / Bank to Cash
        from_acc.current_balance = from_acc.current_balance - amount
        to_acc.current_balance = to_acc.current_balance + amount

        # Create transfer record
        count = db.query(models.MoneyTransfer).count()
        tf_code = f"TRF-{date.today().strftime('%Y%m')}-{count + 1:04d}"
        transfer = models.MoneyTransfer(
            transfer_code=tf_code,
            transfer_type="INTERNAL_TRANSFER",
            date=date.today(),
            source_account_id=from_acc.id,
            source_amount=amount,
            source_currency=from_acc.currency,
            destination_account_id=to_acc.id,
            destination_amount=amount,
            destination_currency=to_acc.currency,
            reference=reference,
            description=purpose,
            status="POSTED",
            company_id=from_company_id,
            created_by=data.get("user_name", "Admin"),
        )
        db.add(transfer)
        db.commit()
        return {"status": "SUCCESS", "type": "SAME_COMPANY", "transfer_code": tf_code, "message": "Same company liquidity transfer completed."}

    else:
        # Intercompany transfer: automatically call create_intercompany_transaction
        ic_data = {
            "from_company_id": from_company_id,
            "to_company_id": to_company_id,
            "transaction_type": "BANK_TRANSFER",
            "amount": amount,
            "currency": from_acc.currency,
            "exchange_rate": data.get("exchange_rate", 1.0),
            "purpose": purpose,
            "reference": reference,
            "from_bank_account_id": from_acc.id,
            "to_bank_account_id": to_acc.id,
            "date": data.get("date", date.today()),
            "notes": f"Automated intercompany treasury transfer between {from_acc.bank_name} and {to_acc.bank_name}",
        }
        ic_tx = create_intercompany_transaction(db, ic_data, user_name=data.get("user_name", "Admin"))
        return {
            "status": "SUCCESS",
            "type": "INTERCOMPANY",
            "transaction_code": ic_tx.transaction_code,
            "message": f"Intercompany transfer created between Company {from_company_id} and Company {to_company_id}.",
        }


# =====================================================================
# 4. INTERCOMPANY TRANSACTIONS & RECONCILIATION
# =====================================================================

@router.get("/intercompany/transactions")
def list_intercompany_transactions(
    from_company_id: Optional[int] = Query(None),
    to_company_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Returns list of intercompany transactions with counterparty company details."""
    q = db.query(models.IntercompanyTransaction).order_by(desc(models.IntercompanyTransaction.date), desc(models.IntercompanyTransaction.id))
    if from_company_id:
        q = q.filter(models.IntercompanyTransaction.from_company_id == from_company_id)
    if to_company_id:
        q = q.filter(models.IntercompanyTransaction.to_company_id == to_company_id)
    if status:
        q = q.filter(models.IntercompanyTransaction.status == status)

    txs = q.limit(100).all()
    comps = {c.id: c.company_name for c in db.query(models.Company).all()}

    return {
        "status": "SUCCESS",
        "transactions": [
            {
                "id": t.id,
                "transaction_code": t.transaction_code,
                "date": t.date.isoformat(),
                "from_company_id": t.from_company_id,
                "from_company_name": comps.get(t.from_company_id, f"Company {t.from_company_id}"),
                "to_company_id": t.to_company_id,
                "to_company_name": comps.get(t.to_company_id, f"Company {t.to_company_id}"),
                "transaction_type": t.transaction_type,
                "amount": float(t.amount),
                "currency": t.currency,
                "exchange_rate": float(t.exchange_rate),
                "amount_base": float(t.amount_base),
                "purpose": t.purpose,
                "reference": t.reference,
                "status": t.status,
                "created_by": t.created_by,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "settled_at": t.settled_at.isoformat() if t.settled_at else None,
            }
            for t in txs
        ]
    }


@router.post("/intercompany/transactions")
def post_intercompany_transaction(data: Dict[str, Any], db: Session = Depends(get_db)):
    """Creates a new intercompany transaction, auto-posting dual balanced journals."""
    try:
        user_name = data.get("created_by", "Admin")
        tx = create_intercompany_transaction(db, data, user_name=user_name)
        return {
            "status": "SUCCESS",
            "message": f"Intercompany transaction {tx.transaction_code} recorded and posted successfully.",
            "transaction": {
                "id": tx.id,
                "transaction_code": tx.transaction_code,
                "status": tx.status,
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/intercompany/transactions/{tx_id}/reverse")
def reverse_intercompany_tx(tx_id: int, data: Dict[str, Any], db: Session = Depends(get_db)):
    """Reverses an intercompany transaction with full reversal journal postings."""
    reason = data.get("reason", "Administrative reversal")
    user_name = data.get("user_name", "Admin")
    try:
        tx = reverse_intercompany_transaction(db, tx_id, reason=reason, user_name=user_name)
        return {"status": "SUCCESS", "message": f"Transaction {tx.transaction_code} reversed.", "status_code": tx.status}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/intercompany/transactions/{tx_id}/settle")
def settle_intercompany_tx(tx_id: int, data: Dict[str, Any], db: Session = Depends(get_db)):
    """Marks an intercompany transaction as settled."""
    settlement_ref = data.get("settlement_reference", f"SETTLE-{date.today()}")
    user_name = data.get("user_name", "Admin")
    try:
        tx = settle_intercompany_transaction(db, tx_id, settlement_ref=settlement_ref, user_name=user_name)
        return {"status": "SUCCESS", "message": f"Transaction {tx.transaction_code} settled.", "status_code": tx.status}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/intercompany/reconciliation")
def get_intercompany_reconciliation_report(db: Session = Depends(get_db)):
    """Returns pair-wise Due To vs Due From reconciliation across all entities."""
    return get_intercompany_reconciliation(db)


@router.get("/intercompany/aging")
def get_intercompany_aging_report(db: Session = Depends(get_db)):
    """Returns aging breakdown (0-30, 31-60, 61-90, 90+ days) of unsettled balances."""
    aging = get_intercompany_aging(db)
    return {"status": "SUCCESS", "aging": aging}


# =====================================================================
# 5. CONSOLIDATED FINANCIAL REPORTS
# =====================================================================

@router.get("/accounting/consolidated/trial-balance")
def get_consolidated_tb(as_of_date: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """Generates multi-column Consolidated Trial Balance with automated intercompany eliminations."""
    parsed_date = datetime.strptime(as_of_date, "%Y-%m-%d").date() if as_of_date else None
    return get_consolidated_trial_balance(db, as_of_date=parsed_date)


@router.get("/accounting/consolidated/profit-loss")
def get_consolidated_pnl(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Generates multi-column Consolidated Profit & Loss with automated eliminations and group profit."""
    s_date = datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else None
    e_date = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else None
    return get_consolidated_profit_and_loss(db, start_date=s_date, end_date=e_date)


@router.get("/accounting/consolidated/balance-sheet")
def get_consolidated_bs(as_of_date: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """Generates multi-column Consolidated Balance Sheet proving Assets = Liabilities + Equity."""
    parsed_date = datetime.strptime(as_of_date, "%Y-%m-%d").date() if as_of_date else None
    return get_consolidated_balance_sheet(db, as_of_date=parsed_date)


# =====================================================================
# 6. GROUP MANAGEMENT DASHBOARD & COMPARISON
# =====================================================================

@router.get("/management/group-summary")
def get_group_management(db: Session = Depends(get_db)):
    """Returns executive KPIs comparing all companies across revenue, receivables, cash, volume, and profit."""
    return get_group_management_summary(db)


# =====================================================================
# 7. COMPANY DATA BACKUP & EXPORT
# =====================================================================

@router.get("/companies/{company_id}/export")
def export_company_data(company_id: int, db: Session = Depends(get_db)):
    """Exports all transactions, invoices, purchases, journals, and bank accounts of a single company."""
    comp = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Company not found.")

    invoices = db.query(models.Invoice).filter(models.Invoice.company_id == company_id).all()
    purchases = db.query(models.Purchase).filter(models.Purchase.company_id == company_id).all()
    bank_accounts = db.query(models.BankAccount).filter(models.BankAccount.company_id == company_id).all()
    bank_txs = db.query(models.BankTransaction).filter(models.BankTransaction.company_id == company_id).all()
    journals = db.query(models.JournalEntry).filter(models.JournalEntry.company_id == company_id).all()

    export_payload = {
        "metadata": {
            "exported_at": datetime.utcnow().isoformat(),
            "company_id": comp.id,
            "company_code": comp.company_code,
            "company_name": comp.company_name,
            "base_currency": comp.base_currency,
        },
        "statistics": {
            "invoices_count": len(invoices),
            "purchases_count": len(purchases),
            "bank_accounts_count": len(bank_accounts),
            "bank_transactions_count": len(bank_txs),
            "journal_entries_count": len(journals),
        },
        "bank_accounts": [
            {
                "id": b.id,
                "bank_name": b.bank_name,
                "account_number": b.account_number,
                "currency": b.currency,
                "current_balance": float(b.current_balance),
            }
            for b in bank_accounts
        ],
        "invoices": [
            {
                "invoice_number": inv.invoice_number,
                "date": inv.date.isoformat(),
                "total_amount": float(inv.total_amount or 0),
                "balance_due": float(inv.balance_due or 0),
            }
            for inv in invoices
        ],
        "purchases": [
            {
                "purchase_code": p.purchase_code,
                "date": p.date.isoformat(),
                "purchase_amount": float(p.purchase_amount or 0),
                "balance": float(p.balance or 0),
            }
            for p in purchases
        ],
    }
    return JSONResponse(content=export_payload)
