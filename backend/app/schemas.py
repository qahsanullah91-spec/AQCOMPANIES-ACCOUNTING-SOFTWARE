from datetime import date as dt_date, datetime as dt_datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any, Generic, TypeVar
from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    page: int
    page_size: int
    total: int
    pages: int


class CursorPaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    cursor: Optional[str] = None
    next_cursor: Optional[str] = None
    has_more: bool = False



class UserBase(BaseModel):
    username: str
    full_name: str
    email: str
    role: str = "ADMIN"
    is_active: bool = True
    permissions_json: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserOut(UserBase):
    id: int
    created_at: dt_datetime
    model_config = ConfigDict(from_attributes=True)


class ProductBase(BaseModel):
    product_name: str
    grade: Optional[str] = None
    hs_code: Optional[str] = None
    default_package_kg: Optional[Decimal] = Decimal("10.000")
    default_carton_tare: Optional[Decimal] = Decimal("0.000")
    default_purchase_rate: Optional[Decimal] = Decimal("0.0000")
    default_selling_rate: Optional[Decimal] = Decimal("0.0000")
    notes: Optional[str] = None


class ProductCreate(ProductBase):
    pass


class ProductOut(ProductBase):
    id: int
    created_at: dt_datetime
    model_config = ConfigDict(from_attributes=True)


class CustomerBase(BaseModel):
    customer_name: str
    contact_person: Optional[str] = None
    address: Optional[str] = None
    country: str = "India"
    phone: Optional[str] = None
    email: Optional[str] = None
    iec: Optional[str] = None
    gst: Optional[str] = None
    pan: Optional[str] = None
    fssai: Optional[str] = None
    other_registration: Optional[str] = None
    notes: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerOut(CustomerBase):
    id: int
    created_at: dt_datetime
    model_config = ConfigDict(from_attributes=True)


class SupplierBase(BaseModel):
    supplier_name: str
    contact_person: Optional[str] = None
    address: Optional[str] = None
    country: str = "Afghanistan"
    phone: Optional[str] = None
    email: Optional[str] = None
    sarafi_details: Optional[str] = None
    bank_details: Optional[str] = None
    notes: Optional[str] = None


class SupplierCreate(SupplierBase):
    pass


class SupplierOut(SupplierBase):
    id: int
    created_at: dt_datetime
    model_config = ConfigDict(from_attributes=True)


class TransportCompanyBase(BaseModel):
    company_name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = "Afghanistan / India"
    notes: Optional[str] = None


class TransportCompanyCreate(TransportCompanyBase):
    pass


class TransportCompanyOut(TransportCompanyBase):
    id: int
    created_at: dt_datetime
    model_config = ConfigDict(from_attributes=True)


class NewStockBase(BaseModel):
    stock_code: Optional[str] = None
    date: dt_date = Field(default_factory=dt_date.today)
    supplier_id: Optional[int] = None
    customer_id: Optional[int] = None
    product_name: str
    product_grade: Optional[str] = None
    packages: int = 0
    package_type: str = "CTNS"
    cartons: int = 0
    net_kg: Decimal = Decimal("0.000")
    selling_rate: Optional[Decimal] = None
    purchase_rate: Optional[Decimal] = None
    proforma_value: Optional[Decimal] = None
    location: Optional[str] = "Border Staging / In-Transit"
    status: str = "NEW"
    notes: Optional[str] = None
    documents: Optional[str] = None


class NewStockCreate(NewStockBase):
    pass


class NewStockOut(NewStockBase):
    id: int
    selling_value: Optional[Decimal] = None
    proforma_value: Optional[Decimal] = None
    purchase_cost: Optional[Decimal] = None
    converted_shipment_id: Optional[int] = None
    created_at: dt_datetime
    modified_at: dt_datetime
    supplier_name: Optional[str] = None
    customer_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ShipmentItemBase(BaseModel):
    product_name: str
    product_grade: Optional[str] = None
    packages: int = 0
    cartons: int = 0
    bags: int = 0
    package_type: str = "CTNS"
    net_weight_kg: Decimal = Decimal("0.000")
    gross_weight_kg: Decimal = Decimal("0.000")
    selling_rate: Optional[Decimal] = None
    purchase_rate: Optional[Decimal] = None


class ShipmentItemCreate(ShipmentItemBase):
    pass


class ShipmentItemOut(ShipmentItemBase):
    id: int
    shipment_id: int
    selling_amount: Optional[Decimal] = None
    purchase_amount: Optional[Decimal] = None
    model_config = ConfigDict(from_attributes=True)


class ShipmentBase(BaseModel):
    shipment_code: Optional[str] = None
    shipment_date: dt_date = Field(default_factory=dt_date.today)
    invoice_number: str
    invoice_date: dt_date = Field(default_factory=dt_date.today)
    customer_id: int
    shipper_exporter: str = "AQ COMPANIES"
    supplier_id: Optional[int] = None
    product_summary: str
    product_grade: Optional[str] = None
    packages: int = 0
    cartons: int = 0
    bags: int = 0
    package_type: str = "CTNS"
    net_weight_kg: Decimal = Decimal("0.000")
    gross_weight_kg: Decimal = Decimal("0.000")
    rate_per_kg: Optional[Decimal] = None
    currency: str = "USD"
    purchase_rate: Optional[Decimal] = None

    transport_company_id: Optional[int] = None
    transport_freight: Decimal = Decimal("0.00")
    afghanistan_truck_cost: Decimal = Decimal("0.00")
    driver_rent: Decimal = Decimal("0.00")
    customs_cost: Decimal = Decimal("0.00")
    documentation_cost: Decimal = Decimal("0.00")
    border_cost: Decimal = Decimal("0.00")
    bank_charges: Decimal = Decimal("0.00")
    commission: Decimal = Decimal("0.00")
    other_expenses: Decimal = Decimal("0.00")

    container_number: Optional[str] = None
    container_type: Optional[str] = "40ft HQ"
    bl_number: Optional[str] = None
    house_bl: Optional[str] = None
    master_bl: Optional[str] = None
    truck_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None

    origin: Optional[str] = "Kabul, Afghanistan"
    route: Optional[str] = "Chaman - Karachi - Nhava Sheva"
    destination: Optional[str] = "Delhi / Mumbai, India"
    port: Optional[str] = "Nhava Sheva / Mundra"
    vessel: Optional[str] = None
    voyage: Optional[str] = None

    data_conflict: bool = False
    conflict_type: Optional[str] = None
    conflict_details: Optional[str] = None
    transport_statement_date: Optional[dt_date] = None
    bol_issue_date: Optional[dt_date] = None
    source_row_sn: Optional[int] = None

    status: str = "IN TRANSIT"
    payment_status: str = "UNPAID"
    notes: Optional[str] = None


class ShipmentCreate(ShipmentBase):
    items: Optional[List[ShipmentItemCreate]] = None
    new_stock_id_to_convert: Optional[int] = None


class ShipmentOut(ShipmentBase):
    id: int
    invoice_value: Optional[Decimal] = None
    purchase_cost: Optional[Decimal] = None
    total_cost: Optional[Decimal] = None
    net_profit: Optional[Decimal] = None
    profit_per_kg: Optional[Decimal] = None
    profit_per_carton: Optional[Decimal] = None
    profit_margin_pct: Optional[Decimal] = None
    customer_amount_received: Decimal = Decimal("0.00")
    customer_balance: Optional[Decimal] = None
    transport_charge: Decimal = Decimal("0.00")
    transport_paid: Decimal = Decimal("0.00")
    transport_balance: Decimal = Decimal("0.00")
    supplier_amount_paid: Decimal = Decimal("0.00")
    supplier_balance: Optional[Decimal] = None
    created_by: str
    created_date: dt_datetime
    modified_by: str
    modified_date: dt_datetime
    customer_name: Optional[str] = None
    supplier_name: Optional[str] = None
    transport_company_name: Optional[str] = None
    items: List[ShipmentItemOut] = []
    model_config = ConfigDict(from_attributes=True)


class PurchaseBase(BaseModel):
    purchase_code: Optional[str] = None
    date: dt_date = Field(default_factory=dt_date.today)
    supplier_id: Optional[int] = None
    purchase_reference: Optional[str] = None
    shipment_id: Optional[int] = None
    shipment_invoice: Optional[str] = None
    customer_id: Optional[int] = None
    product_name: str
    product_grade: Optional[str] = None
    packages: int = 0
    net_kg: Decimal = Decimal("0.000")
    purchase_rate: Optional[Decimal] = None
    currency: str = "USD"
    status: str = "PENDING_SUPPLIER_INVOICE"
    payment_method: Optional[str] = "Bank Transfer"
    bank_account: Optional[str] = None
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    attachments: Optional[str] = None


class PurchaseCreate(PurchaseBase):
    pass


class PurchaseOut(PurchaseBase):
    id: int
    purchase_amount: Optional[Decimal] = None
    amount_paid: Decimal = Decimal("0.00")
    balance: Optional[Decimal] = None
    created_by: str
    created_at: dt_datetime
    modified_at: dt_datetime
    supplier_name: Optional[str] = None
    customer_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class InvoiceItemBase(BaseModel):
    product_name: str
    product_grade: Optional[str] = None
    hs_code: Optional[str] = None
    packages: int = 0
    package_type: str = "CTNS"
    net_weight_kg: Decimal = Decimal("0.000")
    gross_weight_kg: Decimal = Decimal("0.000")
    rate: Optional[Decimal] = None


class InvoiceItemCreate(InvoiceItemBase):
    pass


class InvoiceItemOut(InvoiceItemBase):
    id: int
    amount: Optional[Decimal] = None
    model_config = ConfigDict(from_attributes=True)


class InvoiceBase(BaseModel):
    invoice_number: str
    invoice_type: str = "COMMERCIAL"
    date: dt_date = Field(default_factory=dt_date.today)
    shipment_id: Optional[int] = None
    exporter: str = "AQ COMPANIES"
    customer_id: int
    notify_party: Optional[str] = None
    currency: str = "USD"
    payment_terms: Optional[str] = "100% Advance Payment / Third Party Payments Acceptable"
    bank_details: Optional[str] = None
    notes: Optional[str] = None


class InvoiceCreate(InvoiceBase):
    items: List[InvoiceItemCreate] = []


class InvoiceOut(InvoiceBase):
    id: int
    total_packages: int
    total_net_kg: Decimal
    total_gross_kg: Decimal
    total_amount: Optional[Decimal] = None
    amount_received: Decimal = Decimal("0.00")
    balance_due: Optional[Decimal] = None
    payment_status: str
    created_by: str
    created_at: dt_datetime
    modified_at: dt_datetime
    customer_name: Optional[str] = None
    items: List[InvoiceItemOut] = []
    model_config = ConfigDict(from_attributes=True)


class BankAccountBase(BaseModel):
    bank_name: str
    account_name: str = "AQ COMPANIES"
    account_number: str
    swift_iban: Optional[str] = None
    currency: str = "USD"
    opening_balance: Decimal = Decimal("0.00")
    notes: Optional[str] = None


class BankAccountCreate(BankAccountBase):
    pass


class BankAccountOut(BankAccountBase):
    id: int
    current_balance: Decimal
    created_at: dt_datetime
    model_config = ConfigDict(from_attributes=True)


class BankTransactionBase(BaseModel):
    transaction_code: Optional[str] = None
    date: dt_date = Field(default_factory=dt_date.today)
    bank_account_id: int
    party_type: str = "CUSTOMER"
    party_id: Optional[int] = None
    party_name: str
    transaction_type: str
    invoice_id: Optional[int] = None
    invoice_number: Optional[str] = None
    shipment_id: Optional[int] = None
    purchase_id: Optional[int] = None
    currency: str = "USD"
    money_in: Decimal = Decimal("0.00")
    money_out: Decimal = Decimal("0.00")
    exchange_rate: Decimal = Decimal("1.0000")
    transaction_reference: Optional[str] = None
    payment_method: Optional[str] = "Bank Transfer"
    notes: Optional[str] = None
    attachment_path: Optional[str] = None


class BankTransactionCreate(BankTransactionBase):
    allocations: Optional[List[Dict[str, Any]]] = None


class BankTransactionOut(BankTransactionBase):
    id: int
    bank_name: str
    account_number: str
    usd_equivalent_in: Decimal
    usd_equivalent_out: Decimal
    running_balance: Decimal
    created_by: str
    created_at: dt_datetime
    model_config = ConfigDict(from_attributes=True)


class ExpenseBase(BaseModel):
    expense_code: Optional[str] = None
    date: dt_date = Field(default_factory=dt_date.today)
    category: str
    amount: Decimal = Decimal("0.00")
    currency: str = "USD"
    exchange_rate: Decimal = Decimal("1.0000")
    shipment_id: Optional[int] = None
    container_number: Optional[str] = None
    invoice_id: Optional[int] = None
    customer_id: Optional[int] = None
    supplier_id: Optional[int] = None
    transport_company_id: Optional[int] = None
    paid_via_bank_tx_id: Optional[int] = None
    payment_status: str = "PAID"
    notes: Optional[str] = None


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseOut(ExpenseBase):
    id: int
    amount_usd: Decimal
    created_by: str
    created_at: dt_datetime
    model_config = ConfigDict(from_attributes=True)


class DocumentOut(BaseModel):
    id: int
    title: str
    category: str
    filename: str
    file_path: str
    mime_type: str
    file_size: int
    shipment_id: Optional[int] = None
    purchase_id: Optional[int] = None
    invoice_id: Optional[int] = None
    bank_tx_id: Optional[int] = None
    extracted_data_json: Optional[str] = None
    uploaded_by: str
    uploaded_at: dt_datetime
    model_config = ConfigDict(from_attributes=True)


class AuditLogOut(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    action: str
    old_value_json: Optional[str] = None
    new_value_json: Optional[str] = None
    user_name: str
    timestamp: dt_datetime
    model_config = ConfigDict(from_attributes=True)


# =====================================================================
# API V1 STANDARD SCHEMAS
# =====================================================================

class StandardErrorDetails(BaseModel):
    code: str
    message: str
    details: Optional[dict] = Field(default_factory=dict)


class StandardErrorResponse(BaseModel):
    error: StandardErrorDetails


class PaginatedResponse(BaseModel):
    page: int
    page_size: int
    total_count: int
    total_pages: int
    items: List[Any]


class JournalLineInput(BaseModel):
    account_code: Optional[str] = None
    account_id: Optional[int] = None
    debit: Decimal = Decimal("0.00")
    credit: Decimal = Decimal("0.00")
    description: Optional[str] = None
    party_type: Optional[str] = None
    party_id: Optional[int] = None
    currency: str = "USD"
    exchange_rate: Decimal = Decimal("1.0000")


class JournalEntryCreate(BaseModel):
    company_id: int = 1
    entry_date: dt_date = Field(default_factory=dt_date.today)
    entry_type: str = "MANUAL"
    description: str
    reference: Optional[str] = None
    source_document_type: Optional[str] = None
    source_document_id: Optional[int] = None
    posting_key: Optional[str] = None
    lines: List[JournalLineInput]


class PaymentAllocationItem(BaseModel):
    invoice_id: int
    amount: Decimal


class PaymentAllocationRequest(BaseModel):
    bank_transaction_id: int
    allocations: List[PaymentAllocationItem]
    notes: Optional[str] = None


class ReceiptAllocationItem(BaseModel):
    invoice_id: int
    amount: Decimal
    expected_version: Optional[int] = None


class CustomerReceiptRequest(BaseModel):
    company_id: int = 1
    customer_id: int
    bank_account_id: int
    receipt_amount: Decimal
    receipt_date: dt_date = Field(default_factory=dt_date.today)
    allocations: List[ReceiptAllocationItem] = Field(default_factory=list)
    voucher_number: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None



class MoneyTransferRequest(BaseModel):
    from_account_id: int
    to_account_id: int
    amount: Decimal
    transfer_date: dt_date = Field(default_factory=dt_date.today)
    purpose: str = "Internal Transfer"


class IntercompanyTransferRequest(BaseModel):
    from_company_id: int
    to_company_id: int
    amount: Decimal
    currency: str = "USD"
    exchange_rate: Decimal = Decimal("1.0000")
    purpose: str = "Intercompany Working Capital Transfer"
    tx_date: Optional[dt_date] = None


class PeriodCloseRequest(BaseModel):
    notes: Optional[str] = None


class PeriodReopenRequest(BaseModel):
    reason: str


class ReversalRequest(BaseModel):
    reason: str


class DataImportRequest(BaseModel):
    dry_run: bool = True
    company_id: int = 1
    data: List[dict]

