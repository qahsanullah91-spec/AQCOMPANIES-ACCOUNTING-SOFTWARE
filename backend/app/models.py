from datetime import datetime, date, date as dt_date
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Numeric,
    Date,
    DateTime,
    Boolean,
    ForeignKey,
    Index,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.orm import relationship, synonym
try:
    from app.database import Base
except ImportError:
    from backend.app.database import Base

from datetime import timezone

def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    company_code = Column(String(50), unique=True, index=True, nullable=False)
    company_name = Column(String(150), unique=True, index=True, nullable=False)
    legal_name = Column(String(200), nullable=True)
    trade_license_no = Column(String(100), nullable=True)
    tax_number = Column(String(100), nullable=True)
    country = Column(String(100), default="UAE", nullable=False)
    address = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True)
    base_currency = Column(String(10), default="USD", nullable=False)
    logo = Column(String(255), nullable=True)
    color_accent = Column(String(30), default="#2563eb", nullable=False)
    status = Column(String(30), default="ACTIVE", index=True, nullable=False)  # ACTIVE, INACTIVE, ARCHIVED
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    user_access = relationship("UserCompanyAccess", back_populates="company", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    role = Column(String(30), default="ADMIN", nullable=False)  # ADMIN, ACCOUNTANT, OPERATIONS, DOCUMENT STAFF, VIEW ONLY
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    permissions_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    company_access = relationship("UserCompanyAccess", back_populates="user", cascade="all, delete-orphan")


class UserCompanyAccess(Base):
    __tablename__ = "user_company_access"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    role = Column(String(30), default="ACCOUNTANT", nullable=False)  # ADMIN, ACCOUNTANT, OPERATIONS, VIEWER
    can_view = Column(Boolean, default=True, nullable=False)
    can_create = Column(Boolean, default=True, nullable=False)
    can_edit = Column(Boolean, default=True, nullable=False)
    can_post = Column(Boolean, default=True, nullable=False)
    can_approve = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    user = relationship("User", back_populates="company_access")
    company = relationship("Company", back_populates="user_access")



class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    product_name = Column(String(100), unique=True, index=True, nullable=False)
    grade = Column(String(50), nullable=True)
    hs_code = Column(String(50), nullable=True)
    default_package_kg = Column(Numeric(18, 3), default=Decimal("10.000"), nullable=True)
    default_carton_tare = Column(Numeric(18, 3), default=Decimal("0.000"), nullable=True)
    default_purchase_rate = Column(Numeric(18, 4), default=Decimal("0.0000"), nullable=True)
    default_selling_rate = Column(Numeric(18, 4), default=Decimal("0.0000"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String(150), unique=True, index=True, nullable=False)
    name = synonym("customer_name")
    contact_person = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    country = Column(String(60), default="India", nullable=False)
    phone = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True)
    iec = Column(String(50), nullable=True)
    gst = Column(String(50), nullable=True)
    pan = Column(String(50), nullable=True)
    fssai = Column(String(50), nullable=True)
    other_registration = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    shipments = relationship("Shipment", back_populates="customer")
    invoices = relationship("Invoice", back_populates="customer")


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    supplier_name = Column(String(150), unique=True, index=True, nullable=False)
    name = synonym("supplier_name")
    contact_person = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    country = Column(String(60), default="Afghanistan", nullable=False)
    phone = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True)
    sarafi_details = Column(Text, nullable=True)
    bank_details = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    purchases = relationship("Purchase", back_populates="supplier")
    shipments = relationship("Shipment", back_populates="supplier")


class CompanyCustomerAccount(Base):
    __tablename__ = "company_customer_accounts"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    opening_balance = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    credit_limit = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    notes = Column(Text, nullable=True)

    company = relationship("Company")
    customer = relationship("Customer")


class CompanySupplierAccount(Base):
    __tablename__ = "company_supplier_accounts"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False, index=True)
    opening_balance = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    notes = Column(Text, nullable=True)

    company = relationship("Company")
    supplier = relationship("Supplier")



class TransportCompany(Base):
    __tablename__ = "transport_companies"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(150), unique=True, index=True, nullable=False)
    contact_person = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    country = Column(String(60), default="Afghanistan / India", nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    shipments = relationship("Shipment", back_populates="transport_company")


class NewStock(Base):
    __tablename__ = "new_stock"

    id = Column(Integer, primary_key=True, index=True)
    stock_code = Column(String(50), unique=True, index=True, nullable=False)  # NEW STOCK-001, etc.
    date = Column(Date, default=date.today, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    product_name = Column(String(100), nullable=False)
    product_grade = Column(String(50), nullable=True)
    packages = Column(Integer, default=0, nullable=False)
    package_type = Column(String(30), default="CTNS", nullable=False)
    cartons = Column(Integer, default=0, nullable=False)
    net_kg = Column(Numeric(18, 3), default=Decimal("0.000"), nullable=False)
    selling_rate = Column(Numeric(18, 4), nullable=True)  # Selling / Proforma Rate
    selling_value = Column(Numeric(18, 2), nullable=True)   # Proforma Value
    proforma_value = Column(Numeric(18, 2), nullable=True)  # Explicit Proforma Value
    purchase_rate = Column(Numeric(18, 4), nullable=True)   # Separate purchase rate - NULL if unknown
    purchase_cost = Column(Numeric(18, 2), nullable=True)   # Net KG * Purchase Rate - NULL if unknown
    location = Column(String(100), default="Border Staging / In-Transit", nullable=True)
    status = Column(
        String(50),
        default="NEW",
        nullable=False
    )  # NEW, PURCHASED, PACKING, READY FOR LOADING, ALLOCATED, LOADED, SHIPPED, SOLD
    converted_shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=True)
    notes = Column(Text, nullable=True)
    documents = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    modified_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    supplier = relationship("Supplier")
    customer = relationship("Customer")
    converted_shipment = relationship("Shipment", foreign_keys=[converted_shipment_id])


class Shipment(Base):
    __tablename__ = "shipments"
    __table_args__ = (
        Index("ix_shipments_company_date", "company_id", "shipment_date"),
        Index("ix_shipments_company_customer", "company_id", "customer_id"),
        CheckConstraint("packages >= 0", name="chk_shipments_packages_positive"),
        CheckConstraint("net_weight_kg >= 0", name="chk_shipments_net_weight_positive"),
        CheckConstraint("gross_weight_kg >= 0", name="chk_shipments_gross_weight_positive"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    shipment_code = Column(String(50), unique=True, index=True, nullable=False)  # SHP-001, etc.
    shipment_date = Column(Date, default=date.today, nullable=False)
    invoice_number = Column(String(80), index=True, nullable=False)
    invoice_date = Column(Date, default=date.today, nullable=False)

    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    shipper_exporter = Column(String(150), default="AQ COMPANIES", nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)

    product_summary = Column(String(200), nullable=False)
    product_grade = Column(String(50), nullable=True)
    packages = Column(Integer, default=0, nullable=False)
    cartons = Column(Integer, default=0, nullable=False)
    bags = Column(Integer, default=0, nullable=False)
    package_type = Column(String(30), default="CTNS", nullable=False)
    net_weight_kg = Column(Numeric(18, 3), default=Decimal("0.000"), nullable=False)
    gross_weight_kg = Column(Numeric(18, 3), default=Decimal("0.000"), nullable=False)
    rate_per_kg = Column(Numeric(18, 4), nullable=True)
    invoice_value = Column(Numeric(18, 2), nullable=True)
    currency = Column(String(10), default="USD", nullable=False)

    purchase_rate = Column(Numeric(18, 4), nullable=True)
    purchase_cost = Column(Numeric(18, 2), nullable=True)

    transport_company_id = Column(Integer, ForeignKey("transport_companies.id"), nullable=True)
    transport_freight = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    afghanistan_truck_cost = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    driver_rent = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    customs_cost = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    documentation_cost = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    border_cost = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    bank_charges = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    commission = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    other_expenses = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)

    total_cost = Column(Numeric(18, 2), nullable=True)
    net_profit = Column(Numeric(18, 2), nullable=True)
    profit_per_kg = Column(Numeric(18, 4), nullable=True)
    profit_per_carton = Column(Numeric(18, 2), nullable=True)
    profit_margin_pct = Column(Numeric(18, 2), nullable=True)

    container_number = Column(String(50), index=True, nullable=True)
    container_type = Column(String(30), default="40ft HQ", nullable=True)
    bl_number = Column(String(80), index=True, nullable=True)
    house_bl = Column(String(80), nullable=True)
    master_bl = Column(String(80), nullable=True)
    truck_number = Column(String(50), index=True, nullable=True)
    driver_name = Column(String(100), nullable=True)
    driver_phone = Column(String(50), nullable=True)

    origin = Column(String(100), default="Kabul, Afghanistan", nullable=True)
    route = Column(String(150), default="Chaman - Karachi - Nhava Sheva", nullable=True)
    destination = Column(String(100), default="Delhi / Mumbai, India", nullable=True)
    port = Column(String(100), default="Nhava Sheva / Mundra", nullable=True)
    vessel = Column(String(100), nullable=True)
    voyage = Column(String(50), nullable=True)

    customer_amount_received = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    customer_balance = Column(Numeric(18, 2), nullable=True)

    transport_charge = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    transport_paid = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    transport_balance = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)

    supplier_amount_paid = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    supplier_balance = Column(Numeric(18, 2), nullable=True)

    # Tracking & Discrepancy Auditing Fields
    data_conflict = Column(Boolean, default=False, nullable=False)
    conflict_type = Column(String(50), nullable=True)
    conflict_details = Column(Text, nullable=True)
    transport_statement_date = Column(Date, nullable=True)
    bol_issue_date = Column(Date, nullable=True)
    source_row_sn = Column(Integer, nullable=True)

    status = Column(String(50), default="IN TRANSIT", nullable=False)  # LOADING, IN TRANSIT, AT BORDER, AT PORT, DELIVERED, CLOSED
    payment_status = Column(String(30), default="UNPAID", nullable=False)  # UNPAID, PARTIALLY PAID, PAID
    notes = Column(Text, nullable=True)
    created_by = Column(String(50), default="Admin", nullable=False)
    created_date = Column(DateTime, default=utc_now, nullable=False)
    modified_by = Column(String(50), default="Admin", nullable=False)
    modified_date = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    customer = relationship("Customer", back_populates="shipments")
    supplier = relationship("Supplier", back_populates="shipments")
    transport_company = relationship("TransportCompany", back_populates="shipments")
    items = relationship("ShipmentItem", back_populates="shipment", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="shipment")


Index("ix_shipment_inv_cust", Shipment.invoice_number, Shipment.customer_id)
Index("ix_shipment_container", Shipment.container_number)
Index("ix_shipment_bl", Shipment.bl_number)


class ShipmentItem(Base):
    __tablename__ = "shipment_items"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False)
    product_name = Column(String(100), nullable=False)
    product_grade = Column(String(50), nullable=True)
    packages = Column(Integer, default=0, nullable=False)
    cartons = Column(Integer, default=0, nullable=False)
    bags = Column(Integer, default=0, nullable=False)
    package_type = Column(String(30), default="CTNS", nullable=False)
    net_weight_kg = Column(Numeric(18, 3), default=Decimal("0.000"), nullable=False)
    gross_weight_kg = Column(Numeric(18, 3), default=Decimal("0.000"), nullable=False)
    selling_rate = Column(Numeric(18, 4), nullable=True)
    selling_amount = Column(Numeric(18, 2), nullable=True)
    purchase_rate = Column(Numeric(18, 4), nullable=True)
    purchase_amount = Column(Numeric(18, 2), nullable=True)

    shipment = relationship("Shipment", back_populates="items")


class Purchase(Base):
    __tablename__ = "purchases"
    __table_args__ = (
        Index("ix_purchases_company_date", "company_id", "date"),
        Index("ix_purchases_company_supplier", "company_id", "supplier_id"),
        CheckConstraint("packages >= 0", name="chk_purchases_packages_positive"),
        CheckConstraint("net_kg >= 0", name="chk_purchases_net_kg_positive"),
        CheckConstraint("amount_paid >= 0", name="chk_purchases_amount_paid_positive"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    purchase_code = Column(String(50), unique=True, index=True, nullable=False)
    date = Column(Date, default=date.today, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    purchase_reference = Column(String(100), nullable=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=True)
    shipment_invoice = Column(String(80), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    product_name = Column(String(100), nullable=False)
    product_grade = Column(String(50), nullable=True)
    packages = Column(Integer, default=0, nullable=False)
    net_kg = Column(Numeric(18, 3), default=Decimal("0.000"), nullable=False)
    purchase_rate = Column(Numeric(18, 4), nullable=True)
    purchase_amount = Column(Numeric(18, 2), nullable=True)
    currency = Column(String(10), default="USD", nullable=False)
    amount_paid = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    balance = Column(Numeric(18, 2), nullable=True)
    status = Column(String(50), default="PENDING_SUPPLIER_INVOICE", nullable=False)
    payment_method = Column(String(50), default="Bank Transfer", nullable=True)
    bank_account = Column(String(100), nullable=True)
    payment_reference = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    attachments = Column(Text, nullable=True)
    created_by = Column(String(50), default="Admin", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    modified_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)
    version_id = Column(Integer, default=1, nullable=False)

    supplier = relationship("Supplier", back_populates="purchases")
    customer = relationship("Customer")
    shipment = relationship("Shipment")


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        Index("ix_invoices_company_number", "company_id", "invoice_number"),
        Index("ix_invoices_company_customer_status", "company_id", "customer_id", "payment_status"),
        Index("ix_invoices_customer_date", "customer_id", "date"),
        CheckConstraint("total_packages >= 0", name="chk_invoices_packages_positive"),
        CheckConstraint("total_net_kg >= 0", name="chk_invoices_net_kg_positive"),
        CheckConstraint("amount_received >= 0", name="chk_invoices_amount_received_positive"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    invoice_number = Column(String(80), unique=True, index=True, nullable=False)
    invoice_type = Column(String(30), default="COMMERCIAL", nullable=False)  # COMMERCIAL, PROFORMA
    date = Column(Date, default=date.today, nullable=False)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=True)
    exporter = Column(String(150), default="AQ COMPANIES", nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    notify_party = Column(String(150), nullable=True)
    currency = Column(String(10), default="USD", nullable=False)
    total_packages = Column(Integer, default=0, nullable=False)
    total_net_kg = Column(Numeric(18, 3), default=Decimal("0.000"), nullable=False)
    total_gross_kg = Column(Numeric(18, 3), default=Decimal("0.000"), nullable=False)
    total_amount = Column(Numeric(18, 2), nullable=True)
    amount_received = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    balance_due = Column(Numeric(18, 2), nullable=True)
    payment_status = Column(String(30), default="UNPAID", nullable=False)  # UNPAID, PARTIALLY PAID, PAID
    payment_terms = Column(String(100), default="100% Advance Payment / Third Party Payments Acceptable", nullable=True)
    bank_details = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(String(50), default="Admin", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    modified_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)
    version_id = Column(Integer, default=1, nullable=False)

    customer = relationship("Customer", back_populates="invoices")
    shipment = relationship("Shipment")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    product_name = Column(String(100), nullable=False)
    product_grade = Column(String(50), nullable=True)
    hs_code = Column(String(50), nullable=True)
    packages = Column(Integer, default=0, nullable=False)
    package_type = Column(String(30), default="CTNS", nullable=False)
    net_weight_kg = Column(Numeric(18, 3), default=Decimal("0.000"), nullable=False)
    gross_weight_kg = Column(Numeric(18, 3), default=Decimal("0.000"), nullable=False)
    rate = Column(Numeric(18, 4), nullable=True)
    amount = Column(Numeric(18, 2), nullable=True)

    invoice = relationship("Invoice", back_populates="items")


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    bank_name = Column(String(100), nullable=False)
    account_name = Column(String(150), default="AQ COMPANIES", nullable=False)
    account_number = Column(String(100), unique=True, index=True, nullable=False)
    account_type = Column(String(30), default="BANK", nullable=False)  # BANK, CASH, SARAFI, MOBILE_MONEY, OTHER
    iban = Column(String(100), nullable=True)
    swift = Column(String(100), nullable=True)
    swift_iban = Column(String(100), nullable=True)
    currency = Column(String(10), default="USD", nullable=False)
    opening_balance = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    opening_balance_date = Column(Date, nullable=True)
    current_balance = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    running_balance = synonym("current_balance")
    available_balance = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    branch = Column(String(100), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    gl_account_code = Column(String(20), nullable=True)
    status = Column(String(30), default="ACTIVE", nullable=False)  # ACTIVE, INACTIVE, FROZEN, CLOSED
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    transactions = relationship("BankTransaction", back_populates="bank_account_rel")


class BankTransaction(Base):
    __tablename__ = "bank_transactions"
    __table_args__ = (
        Index("ix_bank_transactions_company_date", "company_id", "date"),
        Index("ix_bank_transactions_account_date", "bank_account_id", "date"),
        Index("ix_bank_transactions_party", "party_type", "party_id"),
        CheckConstraint("money_in >= 0", name="chk_bank_tx_money_in_positive"),
        CheckConstraint("money_out >= 0", name="chk_bank_tx_money_out_positive"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    transaction_code = Column(String(50), unique=True, index=True, nullable=False)
    voucher_number = Column(String(50), nullable=True, index=True)  # CRV-..., CPV-..., BRV-..., BPV-..., SRV-..., SPV-...
    date = Column(Date, default=date.today, nullable=False)
    document_date = Column(Date, nullable=True)
    posting_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    bank_account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=False)
    bank_name = Column(String(100), nullable=False)
    account_number = Column(String(100), nullable=False)

    party_type = Column(String(30), default="CUSTOMER", nullable=False)  # CUSTOMER, SUPPLIER, TRANSPORT, SARAFI, INTERNAL, OTHER
    party_id = Column(Integer, nullable=True)
    party_name = Column(String(150), nullable=False)

    transaction_type = Column(
        String(50),
        nullable=False
    )  # CUSTOMER_RECEIPT, CUSTOMER_ADVANCE, SUPPLIER_PAYMENT, SUPPLIER_ADVANCE, TRANSPORT_PAYMENT, BANK_CHARGE, OTHER_EXPENSE, TRANSFER

    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    invoice_number = Column(String(80), nullable=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id"), nullable=True)

    currency = Column(String(10), default="USD", nullable=False)  # USD, AFN, AED, INR
    money_in = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    money_out = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    exchange_rate = Column(Numeric(18, 4), default=Decimal("1.0000"), nullable=False)
    usd_equivalent_in = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    usd_equivalent_out = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    fx_gain_loss = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)

    transaction_reference = Column(String(100), index=True, nullable=True)
    bank_reference = Column(String(100), nullable=True)
    swift_reference = Column(String(100), nullable=True)
    mt103_reference = Column(String(100), nullable=True)
    sarafi_reference = Column(String(100), nullable=True)
    cheque_number = Column(String(100), nullable=True)

    running_balance = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    payment_method = Column(String(50), default="Bank Transfer", nullable=True)
    status = Column(String(30), default="POSTED", nullable=False)  # DRAFT, PENDING_APPROVAL, POSTED, RECONCILED, VOID, REVERSED
    approval_status = Column(String(30), default="POSTED", nullable=False)
    approved_by = Column(String(50), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    is_reversed = Column(Boolean, default=False, nullable=False)
    reversal_of_id = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
    reversed_by_id = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
    reversal_reason = Column(Text, nullable=True)

    notes = Column(Text, nullable=True)
    attachment_path = Column(String(255), nullable=True)
    created_by = Column(String(50), default="Admin", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    version_id = Column(Integer, default=1, nullable=False)

    bank_account_rel = relationship("BankAccount", back_populates="transactions")
    allocations = relationship("PaymentAllocation", back_populates="bank_transaction", cascade="all, delete-orphan")


class PaymentAllocation(Base):
    __tablename__ = "payment_allocations"
    __table_args__ = (
        Index("ix_payment_allocations_customer_invoice", "customer_id", "invoice_id"),
        Index("ix_payment_allocations_transaction", "bank_transaction_id"),
        CheckConstraint("allocated_amount_usd > 0", name="chk_payment_alloc_positive"),
    )

    id = Column(Integer, primary_key=True, index=True)
    bank_transaction_id = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=True)
    allocated_amount_usd = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    amount_allocated = synonym("allocated_amount_usd")
    allocation_type = Column(String(30), default="INVOICE_PAYMENT", nullable=False)  # INVOICE_PAYMENT, ADVANCE_ALLOCATION
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    bank_transaction = relationship("BankTransaction", back_populates="allocations")
    invoice = relationship("Invoice")
    customer = relationship("Customer")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    expense_code = Column(String(50), unique=True, index=True, nullable=False)
    date = Column(Date, default=date.today, nullable=False)
    category = Column(
        String(80),
        nullable=False
    )  # Driver Rent, Afghanistan Trucking, Customs, Documentation, Border Charges, Loading, Unloading, Warehouse, Freight, Port Charges, Bank Charges, Commission, Demurrage, Detention, Container Charges, Inspection, Fumigation, Phytosanitary, Other
    amount = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    currency = Column(String(10), default="USD", nullable=False)
    exchange_rate = Column(Numeric(18, 4), default=Decimal("1.0000"), nullable=False)
    amount_usd = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)

    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=True)
    container_number = Column(String(50), nullable=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    transport_company_id = Column(Integer, ForeignKey("transport_companies.id"), nullable=True)
    paid_via_bank_tx_id = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
    payment_status = Column(String(30), default="PAID", nullable=False)
    notes = Column(Text, nullable=True)
    created_by = Column(String(50), default="Admin", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    shipment = relationship("Shipment")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    title = Column(String(150), nullable=False)
    category = Column(
        String(60),
        nullable=False
    )  # Commercial Invoice, Proforma Invoice, Packing List, Bill of Lading, Transit Certificate, Phytosanitary Certificate, Certificate of Origin, Customs Document, Transport Invoice, Bank Payment, MT103, Purchase Invoice, Other
    filename = Column(String(255), nullable=False)
    file_path = Column(String(255), nullable=False)
    mime_type = Column(String(100), default="application/pdf", nullable=False)
    file_size = Column(Integer, default=0, nullable=False)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id"), nullable=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    bank_tx_id = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
    extracted_data_json = Column(Text, nullable=True)
    uploaded_by = Column(String(50), default="Admin", nullable=False)
    uploaded_at = Column(DateTime, default=utc_now, nullable=False)

    shipment = relationship("Shipment", back_populates="documents")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), index=True, nullable=False)  # Shipment, Purchase, Invoice, BankTransaction, Expense, NewStock
    entity_id = Column(Integer, index=True, nullable=False)
    action = Column(String(30), nullable=False)  # CREATE, UPDATE, DELETE, ALLOCATE, IMPORT
    old_value_json = Column(Text, nullable=True)
    new_value_json = Column(Text, nullable=True)
    user_name = Column(String(50), default="Admin", nullable=False)
    reason = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    device_info = Column(String(100), nullable=True)
    timestamp = Column(DateTime, default=utc_now, index=True, nullable=False)


class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id"), nullable=False)
    product_name = Column(String(100), nullable=False)
    product_grade = Column(String(50), nullable=True)
    packages = Column(Integer, default=0, nullable=False)
    package_type = Column(String(30), default="CTNS", nullable=False)
    net_kg = Column(Numeric(18, 3), default=Decimal("0.000"), nullable=False)
    purchase_rate = Column(Numeric(18, 4), nullable=True)
    purchase_amount = Column(Numeric(18, 2), nullable=True)


class TransportCharge(Base):
    __tablename__ = "transport_charges"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    source_sn = Column(Integer, nullable=True)
    date = Column(Date, default=date.today, nullable=False)
    entry_type = Column(String(50), default="FREIGHT CHARGE", nullable=False)  # FREIGHT CHARGE, OPENING CREDIT
    transport_company_id = Column(Integer, ForeignKey("transport_companies.id"), nullable=False)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=True)
    invoice_no = Column(String(80), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    description = Column(String(200), nullable=False)
    debit_usd = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    credit_usd = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    running_balance_usd = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    container_no = Column(String(50), nullable=True)
    bl_no = Column(String(80), nullable=True)
    truck_no = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    transport_company = relationship("TransportCompany")
    shipment = relationship("Shipment")
    customer = relationship("Customer")


class TransportPayment(Base):
    __tablename__ = "transport_payments"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    source_sn = Column(Integer, nullable=True)
    date = Column(Date, default=date.today, nullable=False)
    bank_transaction_id = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
    transport_company_id = Column(Integer, ForeignKey("transport_companies.id"), nullable=False)
    payment_method = Column(String(50), default="Bank Wire Transfer", nullable=True)
    amount_usd = Column(Numeric(18, 2), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    bank_transaction = relationship("BankTransaction")
    transport_company = relationship("TransportCompany")


class CustomerPayment(Base):
    __tablename__ = "customer_payments"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    bank_transaction_id = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=True)
    amount_usd = Column(Numeric(18, 2), nullable=False)
    payment_date = Column(Date, default=date.today, nullable=False)
    payment_method = Column(String(50), default="Bank Wire Transfer", nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    customer = relationship("Customer")
    invoice = relationship("Invoice")


class SupplierPayment(Base):
    __tablename__ = "supplier_payments"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    bank_transaction_id = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    purchase_id = Column(Integer, ForeignKey("purchases.id"), nullable=True)
    amount_usd = Column(Numeric(18, 2), nullable=False)
    payment_date = Column(Date, default=date.today, nullable=False)
    payment_method = Column(String(50), default="Sarafi / Hawala", nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    supplier = relationship("Supplier")
    purchase = relationship("Purchase")


class DataConflict(Base):
    __tablename__ = "data_conflicts"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False)  # Shipment, Invoice, Transport
    entity_code = Column(String(50), nullable=False)  # INV-136, INV-088, etc.
    conflict_type = Column(String(50), nullable=False)  # CARGO_DESCRIPTION, INVOICE_NUMBERING, DATE_MISMATCH, PAYMENT_AMOUNT
    source_1_label = Column(String(100), nullable=False)
    source_1_value = Column(Text, nullable=True)
    source_2_label = Column(String(100), nullable=False)
    source_2_value = Column(Text, nullable=True)
    chosen_value = Column(Text, nullable=True)
    status = Column(String(30), default="UNRESOLVED", nullable=False)  # UNRESOLVED, RESOLVED, ACCEPTED_PRIMARY
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)


# =====================================================================
# ACCOUNTING CORE & GENERAL LEDGER MODELS (DOUBLE-ENTRY ENGINE)
# =====================================================================

class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    account_code = Column(String(20), unique=True, index=True, nullable=False)
    account_name = Column(String(150), nullable=False)
    account_type = Column(String(30), nullable=False)  # ASSET, LIABILITY, EQUITY, REVENUE, COGS, EXPENSE
    sub_type = Column(String(60), nullable=True)  # Current Assets, Fixed Assets, Current Liabilities, etc.
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_system = Column(Boolean, default=True, nullable=False)  # Protect system accounts while code/name remain editable
    currency = Column(String(10), default="USD", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    journal_lines = relationship("JournalLine", back_populates="account")


class JournalEntry(Base):
    __tablename__ = "journal_entries"
    __table_args__ = (
        Index("ix_journal_entries_company_date", "company_id", "entry_date"),
        Index("ix_journal_entries_source", "company_id", "source_document_type", "source_document_id"),
        CheckConstraint("total_debit >= 0", name="chk_journal_entries_debit_positive"),
        CheckConstraint("total_credit >= 0", name="chk_journal_entries_credit_positive"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    entry_number = Column(String(50), unique=True, index=True, nullable=False)  # JE-2026-0001
    entry_date = Column(Date, default=date.today, nullable=False)
    entry_type = Column(
        String(50),
        nullable=False
    )  # CUSTOMER_INVOICE, CUSTOMER_PAYMENT, PURCHASE_INVOICE, SUPPLIER_PAYMENT, TRANSPORT_CHARGE, TRANSPORT_PAYMENT, BANK_CHARGE, MANUAL, REVERSAL, PERIOD_CLOSE
    description = Column(Text, nullable=False)
    reference = Column(String(100), nullable=True)  # Invoice No, Wire Reference, etc.
    
    source_document_type = Column(String(50), nullable=True)  # INVOICE, PAYMENT, PURCHASE, TRANSPORT_CHARGE, BANK_TRANSACTION
    source_document_id = Column(Integer, nullable=True)
    
    total_debit = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    total_credit = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    status = Column(String(30), default="POSTED", nullable=False)  # DRAFT, POSTED, VOID, REVERSED
    
    reversed_entry_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=True)
    reversal_reason = Column(Text, nullable=True)
    
    posting_key = Column(String(100), unique=True, index=True, nullable=True)
    version_id = Column(Integer, default=1, nullable=False)
    approved_by = Column(String(50), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_by = Column(String(50), default="System", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    posted_at = Column(DateTime, default=utc_now, nullable=False)

    lines = relationship("JournalLine", back_populates="journal_entry", cascade="all, delete-orphan")


class JournalLine(Base):
    __tablename__ = "journal_lines"
    __table_args__ = (
        Index("ix_journal_lines_account_company", "account_id", "company_id"),
        Index("ix_journal_lines_party", "party_type", "party_id"),
        CheckConstraint("debit >= 0", name="chk_journal_lines_debit_positive"),
        CheckConstraint("credit >= 0", name="chk_journal_lines_credit_positive"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    journal_entry_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=False)
    line_number = Column(Integer, default=1, nullable=False)
    
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    account_code = Column(String(20), nullable=False)
    account_name = Column(String(150), nullable=False)
    
    party_type = Column(String(30), nullable=True)  # CUSTOMER, SUPPLIER, TRANSPORT, OTHER
    party_id = Column(Integer, nullable=True)
    party_name = Column(String(150), nullable=True)
    
    debit = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    credit = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    
    currency = Column(String(10), default="USD", nullable=False)
    exchange_rate = Column(Numeric(18, 4), default=Decimal("1.0000"), nullable=False)
    amount_currency = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    amount_usd = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    
    invoice_ref = Column(String(80), nullable=True)
    shipment_ref = Column(String(80), nullable=True)
    bank_ref = Column(String(80), nullable=True)
    description = Column(String(255), nullable=True)

    journal_entry = relationship("JournalEntry", back_populates="lines")
    account = relationship("Account", back_populates="journal_lines")


class IntercompanyTransaction(Base):
    __tablename__ = "intercompany_transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_code = Column(String(60), unique=True, index=True, nullable=False)
    date = Column(Date, default=dt_date.today, nullable=False, index=True)
    from_company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    to_company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    transaction_type = Column(
        String(50), default="BANK_TRANSFER", nullable=False
    )  # PAYMENT_ON_BEHALF, CASH_TRANSFER, BANK_TRANSFER, EXPENSE_ON_BEHALF, LOAN, ADVANCE, SETTLEMENT, OTHER
    amount = Column(Numeric(18, 2), nullable=False)
    currency = Column(String(10), default="USD", nullable=False)
    exchange_rate = Column(Numeric(18, 6), default=Decimal("1.000000"), nullable=False)
    amount_base = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    purpose = Column(String(255), nullable=False)
    reference = Column(String(100), nullable=True)
    from_bank_account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=True)
    to_bank_account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=True)
    from_journal_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=True)
    to_journal_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=True)
    status = Column(String(30), default="MATCHED", index=True, nullable=False)  # DRAFT, MATCHED, SETTLED, REVERSED
    notes = Column(Text, nullable=True)
    created_by = Column(String(50), default="Admin", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    settled_at = Column(DateTime, nullable=True)
    settlement_reference = Column(String(100), nullable=True)

    from_company = relationship("Company", foreign_keys=[from_company_id])
    to_company = relationship("Company", foreign_keys=[to_company_id])
    from_journal = relationship("JournalEntry", foreign_keys=[from_journal_id])
    to_journal = relationship("JournalEntry", foreign_keys=[to_journal_id])
    from_bank_account = relationship("BankAccount", foreign_keys=[from_bank_account_id])
    to_bank_account = relationship("BankAccount", foreign_keys=[to_bank_account_id])



class BankReconciliation(Base):
    __tablename__ = "bank_reconciliations"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    bank_account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=False)
    statement_date = Column(Date, default=date.today, nullable=False)
    statement_closing_balance = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    system_closing_balance = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    difference = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    status = Column(String(30), default="IN_PROGRESS", nullable=False)  # IN_PROGRESS, RECONCILED, DISCREPANCY
    notes = Column(Text, nullable=True)
    reconciled_by = Column(String(50), default="Admin", nullable=False)
    reconciled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    bank_account = relationship("BankAccount")
    statement_lines = relationship("BankStatementLine", back_populates="reconciliation", cascade="all, delete-orphan")


class BankImportBatch(Base):
    __tablename__ = "bank_import_batches"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    batch_number = Column(String(60), unique=True, index=True, nullable=False)
    bank_account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_hash = Column(String(64), index=True, nullable=False)  # SHA-256
    statement_start_date = Column(Date, nullable=True)
    statement_end_date = Column(Date, nullable=True)
    opening_balance = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=True)
    closing_balance = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=True)
    currency = Column(String(10), default="USD", nullable=False)
    total_rows = Column(Integer, default=0, nullable=False)
    matched_rows = Column(Integer, default=0, nullable=False)
    status = Column(
        String(30),
        default="UPLOADED",
        nullable=False
    )  # UPLOADED, PARSING, READY_FOR_REVIEW, PARTIALLY_MATCHED, RECONCILED, POSTED, FAILED
    uploaded_by = Column(String(50), default="Admin", nullable=False)
    uploaded_at = Column(DateTime, default=utc_now, nullable=False)
    posted_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    bank_account = relationship("BankAccount")
    statement_lines = relationship("BankStatementLine", back_populates="import_batch", cascade="all, delete-orphan")


class BankMappingProfile(Base):
    __tablename__ = "bank_mapping_profiles"

    id = Column(Integer, primary_key=True, index=True)
    profile_name = Column(String(100), unique=True, index=True, nullable=False)  # e.g., "AFGHAN UNITED BANK USD"
    bank_account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=True)
    date_column = Column(String(50), default="Date", nullable=False)
    value_date_column = Column(String(50), nullable=True)
    description_column = Column(String(50), default="Description", nullable=False)
    debit_column = Column(String(50), default="Debit", nullable=True)
    credit_column = Column(String(50), default="Credit", nullable=True)
    amount_column = Column(String(50), nullable=True)
    balance_column = Column(String(50), default="Balance", nullable=True)
    reference_column = Column(String(50), default="Reference", nullable=True)
    date_format = Column(String(30), default="%Y-%m-%d", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    bank_account = relationship("BankAccount")


class BankMatchingRule(Base):
    __tablename__ = "bank_matching_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String(100), nullable=False)
    pattern_type = Column(String(30), default="CONTAINS", nullable=False)  # CONTAINS, STARTS_WITH, EXACT, REGEX
    pattern_value = Column(String(150), nullable=False)
    direction = Column(String(10), default="ANY", nullable=False)  # IN, OUT, ANY
    target_party_type = Column(String(30), nullable=True)  # CUSTOMER, SUPPLIER, TRANSPORT, BANK, EXPENSE
    target_party_id = Column(Integer, nullable=True)
    target_party_name = Column(String(150), nullable=True)
    target_transaction_type = Column(String(50), nullable=False)  # CUSTOMER_RECEIPT, TRANSPORT_PAYMENT, SUPPLIER_PAYMENT, BANK_CHARGE, TRANSFER, EXPENSE
    target_account_code = Column(String(20), nullable=True)  # e.g., "5600", "2100", "1100"
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(String(50), default="Admin", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)


class SwiftMT103(Base):
    __tablename__ = "swift_mt103"

    id = Column(Integer, primary_key=True, index=True)
    transaction_reference = Column(String(50), unique=True, index=True, nullable=False)  # Field 20
    bank_operation_code = Column(String(30), nullable=True)  # Field 23B
    value_date = Column(Date, nullable=False)  # Field 32A date
    currency = Column(String(10), default="USD", nullable=False)  # Field 32A currency
    amount = Column(Numeric(18, 2), nullable=False)  # Field 32A amount

    ordering_customer = Column(Text, nullable=True)  # Field 50
    ordering_institution = Column(Text, nullable=True)  # Field 52
    sender_bank = Column(String(150), nullable=True)  # Field 53
    receiver_bank = Column(String(150), nullable=True)  # Field 54
    intermediary_bank = Column(Text, nullable=True)  # Field 56A
    account_with_institution = Column(Text, nullable=True)  # Field 57A
    beneficiary = Column(Text, nullable=False)  # Field 59
    beneficiary_account = Column(String(100), nullable=True)  # Field 59 account/IBAN

    remittance_info = Column(Text, nullable=True)  # Field 70
    charges_details = Column(String(30), default="OUR", nullable=True)  # Field 71A
    sender_to_receiver_info = Column(Text, nullable=True)  # Field 72

    linked_bank_transaction_id = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
    linked_invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    linked_customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)

    status = Column(
        String(30),
        default="MT103 RECEIVED",
        nullable=False
    )  # PAYMENT ADVISED, MT103 RECEIVED, BANK CREDIT PENDING, BANK CREDIT CONFIRMED, ALLOCATED, RECONCILED

    raw_mt103 = Column(Text, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    linked_transaction = relationship("BankTransaction")
    linked_invoice = relationship("Invoice")
    linked_customer = relationship("Customer")


class BankStatementLine(Base):
    __tablename__ = "bank_statement_lines"

    id = Column(Integer, primary_key=True, index=True)
    reconciliation_id = Column(Integer, ForeignKey("bank_reconciliations.id"), nullable=True)
    batch_id = Column(Integer, ForeignKey("bank_import_batches.id"), nullable=True, index=True)
    bank_account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=True)
    
    date = Column(Date, default=dt_date.today, nullable=False, index=True)
    transaction_date = Column(Date, default=dt_date.today, nullable=True, index=True)
    value_date = Column(Date, nullable=True)
    
    description = Column(String(255), nullable=False)
    reference = Column(String(100), nullable=True, index=True)
    bank_reference = Column(String(100), nullable=True, index=True)
    swift_reference = Column(String(100), nullable=True)
    transaction_code = Column(String(50), nullable=True)

    currency = Column(String(10), default="USD", nullable=False)
    debit = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    credit = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    balance = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=True)
    
    money_in = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    money_out = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    amount = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)

    normalized_amount = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    usd_amount = Column(Numeric(18, 2), nullable=True)

    counterparty_name = Column(String(150), nullable=True)
    counterparty_account = Column(String(100), nullable=True)

    match_status = Column(
        String(30),
        default="UNMATCHED",
        nullable=False,
        index=True
    )  # UNMATCHED, SUGGESTED, EXACT_MATCH, HIGH_CONFIDENCE, POSSIBLE_MATCH, MATCHED, RECONCILED, IGNORED
    
    matched_transaction_id = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
    matched_bank_tx_id = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
    
    confidence_score = Column(Integer, default=0, nullable=True)
    matching_reasons = Column(Text, nullable=True)
    suggested_type = Column(String(50), nullable=True)
    suggested_party_type = Column(String(30), nullable=True)
    suggested_party_id = Column(Integer, nullable=True)
    suggested_party_name = Column(String(150), nullable=True)
    suggested_invoice_id = Column(Integer, nullable=True)
    suggested_invoice_number = Column(String(80), nullable=True)

    raw_source_data = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    matched_status = synonym("match_status")
    matched_bank_transaction_id = synonym("matched_transaction_id")

    reconciliation = relationship("BankReconciliation", back_populates="statement_lines")
    import_batch = relationship("BankImportBatch", back_populates="statement_lines")
    matched_transaction = relationship("BankTransaction", foreign_keys=[matched_transaction_id])
    bank_account = relationship("BankAccount")


class AccountingPeriod(Base):
    __tablename__ = "accounting_periods"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    period_name = Column(String(50), unique=True, index=True, nullable=False)  # e.g., "August 2026", "September 2026"
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String(20), default="OPEN", nullable=False)  # OPEN, CLOSED, LOCKED
    closed_by = Column(String(50), nullable=True)
    closed_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)


class MoneyTransfer(Base):
    __tablename__ = "money_transfers"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    transfer_code = Column(String(50), unique=True, index=True, nullable=False)
    transfer_type = Column(String(50), default="INTERNAL_TRANSFER", nullable=False)  # INTERNAL_TRANSFER, CURRENCY_EXCHANGE
    date = Column(Date, default=dt_date.today, nullable=False)

    source_account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=False)
    source_amount = Column(Numeric(18, 2), nullable=False)
    source_currency = Column(String(10), default="USD", nullable=False)

    destination_account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=False)
    destination_amount = Column(Numeric(18, 2), nullable=False)
    destination_currency = Column(String(10), default="USD", nullable=False)

    exchange_rate = Column(Numeric(18, 4), default=Decimal("1.0000"), nullable=False)
    commission_amount = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)

    reference = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String(30), default="POSTED", nullable=False)  # DRAFT, PENDING_APPROVAL, POSTED, VOID

    source_transaction_id = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
    destination_transaction_id = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
    journal_entry_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=True)

    created_by = Column(String(50), default="Admin", nullable=False)
    approved_by = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    source_account = relationship("BankAccount", foreign_keys=[source_account_id])
    destination_account = relationship("BankAccount", foreign_keys=[destination_account_id])
    journal_entry = relationship("JournalEntry")


class CashCount(Base):
    __tablename__ = "cash_counts"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    count_code = Column(String(50), unique=True, index=True, nullable=False)
    date = Column(Date, default=dt_date.today, nullable=False)
    cash_account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=False)
    currency = Column(String(10), default="USD", nullable=False)

    system_balance = Column(Numeric(18, 2), nullable=False)
    physical_count = Column(Numeric(18, 2), nullable=False)
    difference = Column(Numeric(18, 2), nullable=False)  # physical - system
    status = Column(String(30), default="MATCHED", nullable=False)  # MATCHED, SHORTAGE, OVERAGE

    reason = Column(Text, nullable=True)
    adjustment_transaction_id = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
    adjustment_journal_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=True)

    counted_by = Column(String(50), default="Admin", nullable=False)
    verified_by = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    cash_account = relationship("BankAccount")


class DailyClose(Base):
    __tablename__ = "daily_closes"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    close_date = Column(Date, unique=True, index=True, nullable=False)
    closed_by = Column(String(50), default="Admin", nullable=False)
    closed_at = Column(DateTime, default=utc_now, nullable=False)

    opening_cash_usd = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    opening_bank_usd = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    total_money_in_usd = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    total_money_out_usd = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    closing_cash_usd = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    closing_bank_usd = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    net_movement_usd = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)

    draft_transactions_count = Column(Integer, default=0, nullable=False)
    unbalanced_journals_count = Column(Integer, default=0, nullable=False)
    unallocated_receipts_count = Column(Integer, default=0, nullable=False)
    unreconciled_cash_diff = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)

    status = Column(String(20), default="CLOSED", nullable=False)  # CLOSED, REOPENED
    notes = Column(Text, nullable=True)


class AccountingNote(Base):
    __tablename__ = "accounting_notes"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    note_number = Column(String(50), unique=True, index=True, nullable=False)  # CN-2026-..., DN-2026-...
    note_type = Column(String(30), nullable=False)  # CREDIT_NOTE, DEBIT_NOTE
    party_type = Column(String(30), nullable=False)  # CUSTOMER, SUPPLIER, TRANSPORT
    party_id = Column(Integer, nullable=False)
    party_name = Column(String(150), nullable=False)

    original_invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    original_invoice_number = Column(String(80), nullable=True)
    date = Column(Date, default=dt_date.today, nullable=False)
    amount = Column(Numeric(18, 2), nullable=False)
    currency = Column(String(10), default="USD", nullable=False)
    reason = Column(Text, nullable=False)

    journal_entry_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=True)
    status = Column(String(30), default="POSTED", nullable=False)

    created_by = Column(String(50), default="Admin", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    original_invoice = relationship("Invoice")
    journal_entry = relationship("JournalEntry")


class OpeningBalanceEntry(Base):
    __tablename__ = "opening_balance_entries"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    entry_code = Column(String(50), unique=True, index=True, nullable=False)  # OBE-2026-...
    entity_type = Column(String(50), nullable=False)  # BANK_ACCOUNT, CASH_ACCOUNT, SARAFI_ACCOUNT, CUSTOMER, SUPPLIER, TRANSPORT
    entity_id = Column(Integer, nullable=True)
    entity_name = Column(String(150), nullable=False)

    opening_debit = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    opening_credit = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    currency = Column(String(10), default="USD", nullable=False)
    effective_date = Column(Date, default=dt_date.today, nullable=False)
    reference = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    journal_entry_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=True)
    created_by = Column(String(50), default="Admin", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    journal_entry = relationship("JournalEntry")


class PeriodFinancialSnapshot(Base):
    __tablename__ = "period_financial_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    period_id = Column(Integer, ForeignKey("accounting_periods.id"), nullable=True)
    period_name = Column(String(50), nullable=False)
    report_type = Column(String(50), nullable=False)  # TRIAL_BALANCE, PROFIT_LOSS, BALANCE_SHEET, CASH_FLOW
    as_of_date = Column(Date, nullable=False)
    generated_at = Column(DateTime, default=utc_now, nullable=False)
    generated_by = Column(String(50), default="Admin", nullable=False)
    data_json = Column(Text, nullable=False)
    checksum = Column(String(64), nullable=False)
    notes = Column(Text, nullable=True)

    period = relationship("AccountingPeriod")


class BudgetEntry(Base):
    __tablename__ = "budget_entries"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    account_code = Column(String(20), nullable=False)  # e.g., "4000", "5000", "5100", "6000"
    category_name = Column(String(100), nullable=False)
    fiscal_year = Column(Integer, nullable=False)
    period_name = Column(String(50), nullable=False)  # "2026-09", "2026-Annual", etc.
    budget_amount = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    currency = Column(String(10), default="USD", nullable=False)
    notes = Column(Text, nullable=True)
    created_by = Column(String(50), default="Admin", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)


class CashForecastItem(Base):
    __tablename__ = "cash_forecast_items"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    forecast_category = Column(String(50), nullable=False)  # RECEIVABLE, PAYABLE, TRANSPORT, EXPENSE, MANUAL
    party_name = Column(String(150), nullable=False)
    party_type = Column(String(50), default="CUSTOMER", nullable=False)  # CUSTOMER, SUPPLIER, TRANSPORT, OTHER
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    expected_date = Column(Date, nullable=False)
    expected_amount = Column(Numeric(18, 2), nullable=False)
    currency = Column(String(10), default="USD", nullable=False)
    status = Column(String(30), default="EXPECTED", nullable=False)  # EXPECTED, PROMISED, PARTIAL, OVERDUE, RECEIVED
    probability_pct = Column(Integer, default=100, nullable=False)  # e.g. 50, 75, 90, 100
    notes = Column(Text, nullable=True)
    created_by = Column(String(50), default="Admin", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    invoice = relationship("Invoice")


class TransactionVersion(Base):
    __tablename__ = "transaction_versions"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), index=True, nullable=False)  # BankTransaction, JournalEntry, Invoice, Purchase
    entity_id = Column(Integer, index=True, nullable=False)
    version_number = Column(Integer, nullable=False)
    data_json = Column(Text, nullable=False)
    changed_fields_json = Column(Text, nullable=True)
    user_name = Column(String(50), default="Admin", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    entity_type = Column(String(50), index=True, nullable=False)  # PAYMENT, MANUAL_JOURNAL, DISBURSEMENT, EXPENSE
    entity_id = Column(Integer, index=True, nullable=False)
    reference = Column(String(100), nullable=True)
    amount = Column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    currency = Column(String(10), default="USD", nullable=False)
    party_name = Column(String(150), nullable=True)
    account_name = Column(String(150), nullable=True)
    supporting_document = Column(String(255), nullable=True)
    requested_by = Column(String(50), nullable=False)
    status = Column(String(30), default="PENDING", index=True, nullable=False)  # PENDING, APPROVED, REJECTED, CANCELLED
    required_role = Column(String(30), default="ADMIN", nullable=False)  # ADMIN, SUPER_ADMIN
    threshold_rule = Column(String(100), nullable=True)
    approved_by = Column(String(50), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(50), default="ACCOUNTING", index=True, nullable=False)  # ACCOUNTING, BANKING, APPROVAL, SYSTEM, BACKUP
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String(200), nullable=True)
    severity = Column(String(30), default="INFO", nullable=False)  # INFO, WARNING, DANGER, SUCCESS
    status = Column(String(30), default="UNREAD", index=True, nullable=False)  # UNREAD, READ, DISMISSED
    created_at = Column(DateTime, default=utc_now, nullable=False)
    read_at = Column(DateTime, nullable=True)


class AccountingTask(Base):
    __tablename__ = "accounting_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_name = Column(String(200), nullable=False)
    category = Column(String(50), default="ACCOUNTING", nullable=False)  # RECONCILIATION, COST_ENTRY, ALLOCATION, APPROVAL, BACKUP, JOURNAL
    priority = Column(String(20), default="MEDIUM", nullable=False)  # HIGH, MEDIUM, LOW
    assigned_to = Column(String(50), default="Accountant", nullable=False)
    due_date = Column(Date, nullable=True)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(Integer, nullable=True)
    status = Column(String(30), default="PENDING", index=True, nullable=False)  # PENDING, IN_PROGRESS, COMPLETED
    created_by = Column(String(50), default="System", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    completed_at = Column(DateTime, nullable=True)


class BackupLog(Base):
    __tablename__ = "backup_logs"

    id = Column(Integer, primary_key=True, index=True)
    backup_code = Column(String(60), unique=True, index=True, nullable=False)
    filename = Column(String(150), nullable=False)
    backup_type = Column(String(30), default="MANUAL", nullable=False)  # MANUAL, DAILY, WEEKLY, MONTHLY, PRE_RESTORE
    file_path = Column(String(255), nullable=False)
    size_bytes = Column(Integer, default=0, nullable=False)
    checksum_sha256 = Column(String(64), nullable=False)
    records_count_json = Column(Text, nullable=True)
    status = Column(String(30), default="SUCCESS", nullable=False)  # SUCCESS, FAILED, VERIFIED
    created_by = Column(String(50), default="Admin", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    verified_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)


class SystemConfiguration(Base):
    __tablename__ = "system_configurations"

    id = Column(Integer, primary_key=True, index=True)
    config_key = Column(String(100), unique=True, index=True, nullable=False)
    config_value = Column(Text, nullable=False)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=utc_now, nullable=False)
    updated_by = Column(String(50), default="Admin", nullable=False)


class ApiIdempotencyKey(Base):
    """
    Stores idempotent API request tokens, request payload SHA256 hashes,
    and responses to prevent duplicate financial processing.
    """
    __tablename__ = "api_idempotency_keys"
    __table_args__ = (
        Index("ix_api_idempotency_company_key", "company_id", "key"),
    )

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    user_id = Column(Integer, nullable=True)
    company_id = Column(Integer, nullable=True, index=True)
    endpoint = Column(String(200), nullable=False)
    request_hash = Column(String(64), nullable=False)
    response_status = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    status = Column(String(30), default="PROCESSING", nullable=False)  # PROCESSING, COMPLETED, FAILED
    created_at = Column(DateTime, default=utc_now, nullable=False)
    expires_at = Column(DateTime, nullable=False)


class BackgroundJob(Base):
    """
    Asynchronous and background task ledger for heavy operations:
    backups, report pre-generation, large data imports, accounting health checks.
    """
    __tablename__ = "background_jobs"
    __table_args__ = (
        Index("ix_background_jobs_type_status", "job_type", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(60), unique=True, index=True, nullable=False)
    job_type = Column(String(50), nullable=False, index=True)  # BACKUP, BACKUP_VERIFICATION, REPORT_SNAPSHOT, HEALTH_CHECK, DATA_IMPORT
    status = Column(String(30), default="QUEUED", nullable=False, index=True)  # QUEUED, RUNNING, SUCCESS, FAILED, CANCELLED
    progress = Column(Integer, default=0, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error = Column(Text, nullable=True)
    created_by = Column(String(50), default="System", nullable=False)
    result_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)





