import hashlib
from datetime import date, datetime, timedelta
from decimal import Decimal
try:
    from app.database import SessionLocal, Base, engine
    from app import models
    from app.accounting import calculate_shipment_metrics, round_money, round_rate, round_weight
except ImportError:
    from backend.app.database import SessionLocal, Base, engine
    from backend.app import models
    from backend.app.accounting import calculate_shipment_metrics, round_money, round_rate, round_weight


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(models.User).filter_by(username="admin").first():
            print("Database already contains seed data.")
            return

        print("Seeding AQ COMPANIES database...")

        # 1. Users
        admin_user = models.User(
            username="admin",
            full_name="Ahsanullah Qureshi",
            email="admin@aqcompanies.com",
            role="ADMIN",
            password_hash=hash_password("admin123"),
            is_active=True,
            permissions_json='["*"]',
        )
        accountant_user = models.User(
            username="accountant",
            full_name="Senior Financial Controller",
            email="accounts@aqcompanies.com",
            role="ACCOUNTANT",
            password_hash=hash_password("acct123"),
            is_active=True,
            permissions_json='["view","create","edit","payments","accounting","reports"]',
        )
        ops_user = models.User(
            username="operations",
            full_name="Logistics & Container Manager",
            email="ops@aqcompanies.com",
            role="OPERATIONS",
            password_hash=hash_password("ops123"),
            is_active=True,
            permissions_json='["view","create","edit","shipments","containers"]',
        )
        db.add_all([admin_user, accountant_user, ops_user])
        db.commit()

        # 2. Products Master
        products_data = [
            ("Black Raisins", "Best", "08062010", Decimal("10.000"), Decimal("0.500"), Decimal("2.1000"), Decimal("3.2500")),
            ("Black Raisins Best", "Premium AAA", "08062010", Decimal("10.000"), Decimal("0.500"), Decimal("2.3500"), Decimal("3.5800")),
            ("Black Raisins MED", "Medium", "08062010", Decimal("10.000"), Decimal("0.500"), Decimal("1.8500"), Decimal("2.8000")),
            ("Golden Raisins", "Grade 1", "08062010", Decimal("10.000"), Decimal("0.500"), Decimal("2.8000"), Decimal("4.1500")),
            ("Green Raisins", "Sundried", "08062010", Decimal("10.000"), Decimal("0.500"), Decimal("3.1000"), Decimal("4.6000")),
            ("Dry Figs", "Anjeer Premium", "08042010", Decimal("10.000"), Decimal("0.600"), Decimal("5.2000"), Decimal("7.3800")),
            ("Dry Apricots", "Sweet Grade A", "08131000", Decimal("12.000"), Decimal("0.500"), Decimal("2.4000"), Decimal("3.8500")),
            ("Almonds", "Mamra", "08021200", Decimal("25.000"), Decimal("0.300"), Decimal("9.5000"), Decimal("14.2000")),
            ("Caraway Seeds / Zeera", "Pure Afghan", "09096111", Decimal("25.000"), Decimal("0.200"), Decimal("3.6000"), Decimal("5.1000")),
            ("Anar Dana", "Wild Pomegranate Seeds", "08134090", Decimal("20.000"), Decimal("0.300"), Decimal("2.9000"), Decimal("4.2500")),
        ]
        created_products = []
        for name, grade, hs, pkg_kg, tare, p_rate, s_rate in products_data:
            p = models.Product(
                product_name=name,
                grade=grade,
                hs_code=hs,
                default_package_kg=pkg_kg,
                default_carton_tare=tare,
                default_purchase_rate=p_rate,
                default_selling_rate=s_rate,
                notes=f"Standard standard {name} specification",
            )
            db.add(p)
            created_products.append(p)
        db.commit()

        # 3. Customers
        c1 = models.Customer(
            customer_name="G.T INDIA PVT LTD",
            contact_person="Rajesh Sharma",
            address="Plot 45, Khari Baoli, Spice Market, Old Delhi, 110006",
            country="India",
            phone="+91 11 2398 4400",
            email="import@gtindia.com",
            iec="0508012345",
            gst="07AABCG1234F1Z8",
            pan="AABCG1234F",
            fssai="10018011005234",
            notes="Major dry fruits importer in North India. Terms: Bank TT.",
        )
        c2 = models.Customer(
            customer_name="G.T JAYANTI AGROCHEM INDIA PVT LTD",
            contact_person="Jayanti Patel",
            address="A-102 APMC Market 1, Phase 2, Vashi, Navi Mumbai, 400703",
            country="India",
            phone="+91 22 2788 9012",
            email="trade@gtjayanti.com",
            iec="0312098765",
            gst="27AAACG9876M1ZQ",
            pan="AAACG9876M",
            fssai="10019022006789",
            notes="High volume dry fruits processor and distributor in Maharashtra/Gujarat.",
        )
        c3 = models.Customer(
            customer_name="HINDUSTAN DRY FRUITS CORP",
            contact_person="Sunil Gupta",
            address="Shop 12, APMC Dry Fruit Yard, Amritsar, Punjab, 143001",
            country="India",
            phone="+91 183 255 6789",
            email="orders@hindustandryfruits.in",
            iec="0411033221",
            gst="03AAACH3322D1Z4",
            pan="AAACH3322D",
            fssai="10017013004112",
            notes="Regular buyer of Green Raisins and Afghan Dry Figs.",
        )
        db.add_all([c1, c2, c3])
        db.commit()

        # 4. Suppliers
        s1 = models.Supplier(
            supplier_name="Kabul Dry Fruit Trading Co.",
            contact_person="Haji Ahmad Shah",
            address="Sara-e-Shahzada, Money Market & Trading Hub, Kabul",
            country="Afghanistan",
            phone="+93 700 123 456",
            email="ahmadshah@kabultrading.af",
            sarafi_details="Sarafi Haji Abdul Qayoom, Sara-e-Shahzada Branch, Kabul",
            bank_details="Kabul Bank AFN 1200-449-0123",
            notes="Primary supplier for Black and Green Raisins.",
        )
        s2 = models.Supplier(
            supplier_name="Kandahar Raisin & Fruit Processors",
            contact_person="Mohammad Dawood",
            address="Industrial Park, Kandahar City",
            country="Afghanistan",
            phone="+93 799 654 321",
            email="dawood@kandaharraisins.af",
            sarafi_details="Kandahar Chaman Sarafi Exchange Services",
            bank_details="Azizi Bank USD 001-558-7711",
            notes="Large scale cleaning and carton packing factory.",
        )
        s3 = models.Supplier(
            supplier_name="Herat Anjeer & Dry Goods",
            contact_person="Nasir Ahmad",
            address="Customs Road, Herat",
            country="Afghanistan",
            phone="+93 788 333 222",
            email="heratanjeer@trade.af",
            sarafi_details="Herat Exchange Plaza Shop #44",
            bank_details="AIB Herat Branch",
            notes="Finest quality Afghan dry figs (Anjeer).",
        )
        db.add_all([s1, s2, s3])
        db.commit()

        # 5. Transport Companies
        t1 = models.TransportCompany(
            company_name="Silk Route Freight & Logistics",
            contact_person="Tariq Mahmood",
            phone="+92 21 3456 7890",
            email="ops@silkroutelogistics.com",
            address="Customs House Road, Karachi Port Area / Torkham Border",
            country="Afghanistan / Pakistan / India",
            notes="Door-to-door transit via Chaman/Karachi to Nhava Sheva / Mundra.",
        )
        t2 = models.TransportCompany(
            company_name="Khyber-Indo Container Lines",
            contact_person="Gul Khan",
            phone="+93 777 888 999",
            email="booking@khyberindo.com",
            address="Jalalabad Highway, Kabul",
            country="Afghanistan / India",
            notes="Reefer and HQ container specialist for dry-fruits.",
        )
        db.add_all([t1, t2])
        db.commit()

        # 6. Bank Accounts
        b1 = models.BankAccount(
            bank_name="Emirates NBD - Dubai",
            account_name="AQ COMPANIES FZE",
            account_number="AE440260000123456789012",
            swift_iban="EBILAEADXXX",
            currency="USD",
            opening_balance=Decimal("250000.00"),
            current_balance=Decimal("250000.00"),
            notes="Main international collection and trade settlement account.",
        )
        b2 = models.BankAccount(
            bank_name="Bank of Baroda - Mumbai",
            account_name="AQ COMPANIES INDIA BRANCH",
            account_number="BARB0NARIMA01928374",
            swift_iban="BARBINBBXXX",
            currency="INR",
            opening_balance=Decimal("4500000.00"),
            current_balance=Decimal("4500000.00"),
            notes="Indian domestic port clearance and customer receipts.",
        )
        b3 = models.BankAccount(
            bank_name="Kabul Bank - Kabul",
            account_name="AQ COMPANIES LTD",
            account_number="KBK00192830112",
            swift_iban="KBKBAFKAXXX",
            currency="USD",
            opening_balance=Decimal("80000.00"),
            current_balance=Decimal("80000.00"),
            notes="Local Afghanistan supplier payments and transit clearance.",
        )
        db.add_all([b1, b2, b3])
        db.commit()

        # 7. Exact Example NEW STOCK items from user specifications:
        # NEW STOCK 001
        ns1 = models.NewStock(
            stock_code="NEW STOCK-001",
            date=date.today() - timedelta(days=12),
            supplier_id=s1.id,
            customer_id=c1.id,
            product_name="Black Raisins",
            product_grade="Best Quality",
            packages=2300,
            package_type="CTNS",
            cartons=2300,
            net_kg=Decimal("23000.000"),
            selling_rate=Decimal("3.2500"),
            selling_value=Decimal("74750.00"),
            purchase_rate=Decimal("2.1000"),
            purchase_cost=Decimal("48300.00"),
            location="Kabul Main Warehouse",
            status="READY FOR LOADING",
            notes="Prompt example NEW STOCK 001 for G.T INDIA PVT LTD. Ready for allocation.",
        )
        # NEW STOCK 002
        ns2 = models.NewStock(
            stock_code="NEW STOCK-002",
            date=date.today() - timedelta(days=10),
            supplier_id=s1.id,
            customer_id=c1.id,
            product_name="Black Raisins",
            product_grade="Best Quality",
            packages=2295,
            package_type="CTNS",
            cartons=2295,
            net_kg=Decimal("22950.000"),
            selling_rate=Decimal("3.2500"),
            selling_value=Decimal("74587.50"),
            purchase_rate=Decimal("2.1000"),
            purchase_cost=Decimal("48195.00"),
            location="Kabul Main Warehouse",
            status="PACKING",
            notes="Prompt example NEW STOCK 002 for G.T INDIA PVT LTD.",
        )
        # NEW STOCK 003
        ns3 = models.NewStock(
            stock_code="NEW STOCK-003",
            date=date.today() - timedelta(days=8),
            supplier_id=s2.id,
            customer_id=c2.id,
            product_name="Black Raisins Best",
            product_grade="Premium AAA",
            packages=1385,
            package_type="CTNS",
            cartons=1385,
            net_kg=Decimal("22160.000"),
            selling_rate=Decimal("3.5800"),
            selling_value=Decimal("79332.80"),
            purchase_rate=Decimal("2.3500"),
            purchase_cost=Decimal("52076.00"),
            location="Kandahar Processing Facility",
            status="PURCHASED",
            notes="Prompt example NEW STOCK 003 for G.T JAYANTI AGROCHEM INDIA PVT LTD.",
        )
        # NEW STOCK 004
        ns4 = models.NewStock(
            stock_code="NEW STOCK-004",
            date=date.today() - timedelta(days=5),
            supplier_id=s2.id,
            customer_id=c2.id,
            product_name="Black Raisins",
            product_grade="Standard",
            packages=2250,
            package_type="CTNS",
            cartons=2250,
            net_kg=Decimal("22500.000"),
            selling_rate=Decimal("2.8000"),
            selling_value=Decimal("63000.00"),
            purchase_rate=Decimal("1.8500"),
            purchase_cost=Decimal("41625.00"),
            location="Kabul Transit Yard",
            status="NEW",
            notes="Prompt example NEW STOCK 004 for G.T JAYANTI AGROCHEM INDIA PVT LTD.",
        )
        db.add_all([ns1, ns2, ns3, ns4])
        db.commit()

        # 8. Multi-Product Container Shipment (Prompt example: Dry Figs 17,520 KG @ $7.38 + Black Raisins 5,920 KG @ $3.10)
        multi_items = [
            {
                "product_name": "Dry Figs",
                "product_grade": "Anjeer Premium",
                "packages": 1752,
                "cartons": 1752,
                "bags": 0,
                "package_type": "CTNS",
                "net_weight_kg": Decimal("17520.000"),
                "gross_weight_kg": Decimal("18571.200"),
                "selling_rate": Decimal("7.3800"),
                "selling_amount": Decimal("129297.60"),
                "purchase_rate": Decimal("5.2000"),
                "purchase_amount": Decimal("91104.00"),
            },
            {
                "product_name": "Black Raisins",
                "product_grade": "Best Quality",
                "packages": 592,
                "cartons": 592,
                "bags": 0,
                "package_type": "CTNS",
                "net_weight_kg": Decimal("5920.000"),
                "gross_weight_kg": Decimal("6275.200"),
                "selling_rate": Decimal("3.1000"),
                "selling_amount": Decimal("18352.00"),
                "purchase_rate": Decimal("2.1000"),
                "purchase_amount": Decimal("12432.00"),
            },
        ]
        # Total Invoice = $129,297.60 + $18,352.00 = $147,649.60

        shp1_metrics = calculate_shipment_metrics(
            net_weight_kg=Decimal("23440.000"),
            cartons=2344,
            selling_rate=Decimal("6.2990"),
            purchase_rate=Decimal("4.4171"),
            transport_freight=Decimal("6500.00"),
            afghanistan_truck_cost=Decimal("1800.00"),
            driver_rent=Decimal("450.00"),
            customs_cost=Decimal("1200.00"),
            documentation_cost=Decimal("350.00"),
            border_cost=Decimal("600.00"),
            bank_charges=Decimal("150.00"),
            commission=Decimal("500.00"),
            other_expenses=Decimal("200.00"),
            customer_amount_received=Decimal("147649.60"),  # Fully paid
            transport_paid=Decimal("9350.00"),            # Fully paid
            supplier_amount_paid=Decimal("103536.00"),      # Fully paid
            items=multi_items,
        )

        shp1 = models.Shipment(
            shipment_code="SHP-2026-001",
            shipment_date=date.today() - timedelta(days=25),
            invoice_number="INV-AQ-2026-001",
            invoice_date=date.today() - timedelta(days=25),
            customer_id=c1.id,
            shipper_exporter="AQ COMPANIES",
            supplier_id=s3.id,
            product_summary="Dry Figs (17,520 KG) & Black Raisins (5,920 KG)",
            product_grade="Premium Export Quality",
            packages=2344,
            cartons=2344,
            bags=0,
            package_type="CTNS",
            net_weight_kg=shp1_metrics["net_weight_kg"],
            gross_weight_kg=Decimal("24846.400"),
            rate_per_kg=shp1_metrics["rate_per_kg"],
            invoice_value=shp1_metrics["invoice_value"],
            currency="USD",
            purchase_rate=shp1_metrics["purchase_rate"],
            purchase_cost=shp1_metrics["purchase_cost"],
            transport_company_id=t1.id,
            transport_freight=Decimal("6500.00"),
            afghanistan_truck_cost=Decimal("1800.00"),
            driver_rent=Decimal("450.00"),
            customs_cost=Decimal("1200.00"),
            documentation_cost=Decimal("350.00"),
            border_cost=Decimal("600.00"),
            bank_charges=Decimal("150.00"),
            commission=Decimal("500.00"),
            other_expenses=Decimal("200.00"),
            total_cost=shp1_metrics["total_cost"],
            net_profit=shp1_metrics["net_profit"],
            profit_per_kg=shp1_metrics["profit_per_kg"],
            profit_per_carton=shp1_metrics["profit_per_carton"],
            profit_margin_pct=shp1_metrics["profit_margin_pct"],
            container_number="MSCU9823411",
            container_type="40ft HQ",
            bl_number="MEDU99238491",
            house_bl="HBL-AQ-001",
            master_bl="MBL-MED-99238491",
            truck_number="AFG-KBL-4491",
            driver_name="Abdul Hameed",
            driver_phone="+93 700 889900",
            origin="Kabul, Afghanistan",
            route="Chaman - Karachi - Nhava Sheva",
            destination="Delhi / Nhava Sheva, India",
            port="Nhava Sheva",
            vessel="MSC ROSA",
            voyage="2601E",
            customer_amount_received=shp1_metrics["customer_amount_received"],
            customer_balance=shp1_metrics["customer_balance"],
            transport_charge=shp1_metrics["transport_charge"],
            transport_paid=shp1_metrics["transport_paid"],
            transport_balance=shp1_metrics["transport_balance"],
            supplier_amount_paid=shp1_metrics["supplier_amount_paid"],
            supplier_balance=shp1_metrics["supplier_balance"],
            status="DELIVERED",
            payment_status="PAID",
            notes="Multi-product shipment completed with full receipt from G.T INDIA PVT LTD.",
            created_by="Admin",
            modified_by="Admin",
        )
        db.add(shp1)
        db.commit()

        # Add shipment items
        for mi in multi_items:
            si = models.ShipmentItem(
                shipment_id=shp1.id,
                product_name=mi["product_name"],
                product_grade=mi["product_grade"],
                packages=mi["packages"],
                cartons=mi["cartons"],
                bags=mi["bags"],
                package_type=mi["package_type"],
                net_weight_kg=mi["net_weight_kg"],
                gross_weight_kg=mi["gross_weight_kg"],
                selling_rate=mi["selling_rate"],
                selling_amount=mi["selling_amount"],
                purchase_rate=mi["purchase_rate"],
                purchase_amount=mi["purchase_amount"],
            )
            db.add(si)
        db.commit()

        # Create Commercial Invoice for SHP1
        inv1 = models.Invoice(
            invoice_number="INV-AQ-2026-001",
            invoice_type="COMMERCIAL",
            date=shp1.invoice_date,
            shipment_id=shp1.id,
            exporter="AQ COMPANIES",
            customer_id=c1.id,
            notify_party="G.T INDIA PVT LTD LOGISTICS DEPT",
            currency="USD",
            total_packages=2344,
            total_net_kg=Decimal("23440.000"),
            total_gross_kg=Decimal("24846.400"),
            total_amount=Decimal("147649.60"),
            amount_received=Decimal("147649.60"),
            balance_due=Decimal("0.00"),
            payment_status="PAID",
            payment_terms="100% Advance Payment / Third Party Payments Acceptable",
            bank_details="Emirates NBD - Dubai, IBAN: AE440260000123456789012, SWIFT: EBILAEADXXX",
            notes="Full container Dry Figs & Black Raisins exported to India.",
            created_by="Admin",
        )
        db.add(inv1)
        db.commit()

        # Invoice items
        for mi in multi_items:
            ii = models.InvoiceItem(
                invoice_id=inv1.id,
                product_name=mi["product_name"],
                product_grade=mi["product_grade"],
                hs_code="08042010" if "Figs" in mi["product_name"] else "08062010",
                packages=mi["packages"],
                package_type=mi["package_type"],
                net_weight_kg=mi["net_weight_kg"],
                gross_weight_kg=mi["gross_weight_kg"],
                rate=mi["selling_rate"],
                amount=mi["selling_amount"],
            )
            db.add(ii)
        db.commit()

        # Bank transaction for receipt of $147,649.60
        tx1 = models.BankTransaction(
            transaction_code="BNK-2026-001",
            date=date.today() - timedelta(days=20),
            bank_account_id=b1.id,
            bank_name=b1.bank_name,
            account_number=b1.account_number,
            party_type="CUSTOMER",
            party_id=c1.id,
            party_name=c1.customer_name,
            transaction_type="CUSTOMER RECEIPT",
            invoice_id=inv1.id,
            invoice_number=inv1.invoice_number,
            shipment_id=shp1.id,
            currency="USD",
            money_in=Decimal("147649.60"),
            money_out=Decimal("0.00"),
            exchange_rate=Decimal("1.0000"),
            usd_equivalent_in=Decimal("147649.60"),
            usd_equivalent_out=Decimal("0.00"),
            transaction_reference="TT-ENBD-9912048",
            running_balance=Decimal("397649.60"),
            payment_method="Bank Transfer (SWIFT)",
            notes="Settlement for INV-AQ-2026-001 by G.T INDIA PVT LTD",
            created_by="Admin",
        )
        db.add(tx1)
        b1.current_balance += Decimal("147649.60")
        db.commit()

        # Payment allocation
        alloc1 = models.PaymentAllocation(
            bank_transaction_id=tx1.id,
            customer_id=c1.id,
            invoice_id=inv1.id,
            shipment_id=shp1.id,
            allocated_amount_usd=Decimal("147649.60"),
        )
        db.add(alloc1)
        db.commit()

        # 9. Shipment 2: In transit with partial payment (Prompt rule demo: $70,000 invoice, $30,000 paid)
        shp2_metrics = calculate_shipment_metrics(
            net_weight_kg=Decimal("20000.000"),
            cartons=2000,
            selling_rate=Decimal("3.5000"),
            purchase_rate=Decimal("2.2000"),
            transport_freight=Decimal("6000.00"),
            afghanistan_truck_cost=Decimal("1500.00"),
            driver_rent=Decimal("400.00"),
            customs_cost=Decimal("1000.00"),
            documentation_cost=Decimal("300.00"),
            border_cost=Decimal("500.00"),
            bank_charges=Decimal("120.00"),
            commission=Decimal("400.00"),
            other_expenses=Decimal("150.00"),
            customer_amount_received=Decimal("30000.00"),  # $30,000 received
            transport_paid=Decimal("5000.00"),            # $5,000 paid out of $8,400 charges
            supplier_amount_paid=Decimal("20000.00"),      # $20,000 paid out of $44,000
        )
        shp2 = models.Shipment(
            shipment_code="SHP-2026-002",
            shipment_date=date.today() - timedelta(days=6),
            invoice_number="INV-AQ-2026-002",
            invoice_date=date.today() - timedelta(days=6),
            customer_id=c2.id,
            shipper_exporter="AQ COMPANIES",
            supplier_id=s2.id,
            product_summary="Black Raisins Best (20,000 KG)",
            product_grade="Premium AAA",
            packages=2000,
            cartons=2000,
            bags=0,
            package_type="CTNS",
            net_weight_kg=shp2_metrics["net_weight_kg"],
            gross_weight_kg=Decimal("21200.000"),
            rate_per_kg=shp2_metrics["rate_per_kg"],
            invoice_value=shp2_metrics["invoice_value"],  # $70,000.00
            currency="USD",
            purchase_rate=shp2_metrics["purchase_rate"],
            purchase_cost=shp2_metrics["purchase_cost"],  # $44,000.00
            transport_company_id=t1.id,
            transport_freight=Decimal("6000.00"),
            afghanistan_truck_cost=Decimal("1500.00"),
            driver_rent=Decimal("400.00"),
            customs_cost=Decimal("1000.00"),
            documentation_cost=Decimal("300.00"),
            border_cost=Decimal("500.00"),
            bank_charges=Decimal("120.00"),
            commission=Decimal("400.00"),
            other_expenses=Decimal("150.00"),
            total_cost=shp2_metrics["total_cost"],
            net_profit=shp2_metrics["net_profit"],
            profit_per_kg=shp2_metrics["profit_per_kg"],
            profit_per_carton=shp2_metrics["profit_per_carton"],
            profit_margin_pct=shp2_metrics["profit_margin_pct"],
            container_number="CMAU7718290",
            container_type="40ft HQ",
            bl_number="CMACGM918237",
            house_bl="HBL-AQ-002",
            master_bl="MBL-CMA-918237",
            truck_number="AFG-KDR-8812",
            driver_name="Nematullah Khan",
            driver_phone="+93 799 445566",
            origin="Kandahar, Afghanistan",
            route="Chaman - Karachi - Mundra",
            destination="Mundra / Navi Mumbai, India",
            port="Mundra",
            vessel="CMA CGM LA TRAVIATA",
            voyage="4402W",
            customer_amount_received=shp2_metrics["customer_amount_received"],  # $30,000.00
            customer_balance=shp2_metrics["customer_balance"],                  # $40,000.00
            transport_charge=shp2_metrics["transport_charge"],                  # $8,400.00
            transport_paid=shp2_metrics["transport_paid"],                      # $5,000.00
            transport_balance=shp2_metrics["transport_balance"],                # $3,400.00
            supplier_amount_paid=shp2_metrics["supplier_amount_paid"],          # $20,000.00
            supplier_balance=shp2_metrics["supplier_balance"],                  # $24,000.00
            status="IN TRANSIT",
            payment_status="PARTIALLY PAID",
            notes="Partial payment demonstration: Invoice $70,000, Customer paid $30,000, Receivable $40,000.",
            created_by="Admin",
            modified_by="Admin",
        )
        db.add(shp2)
        db.commit()

        # Invoice for SHP2
        inv2 = models.Invoice(
            invoice_number="INV-AQ-2026-002",
            invoice_type="COMMERCIAL",
            date=shp2.invoice_date,
            shipment_id=shp2.id,
            exporter="AQ COMPANIES",
            customer_id=c2.id,
            notify_party="G.T JAYANTI AGROCHEM INDIA PVT LTD",
            currency="USD",
            total_packages=2000,
            total_net_kg=Decimal("20000.000"),
            total_gross_kg=Decimal("21200.000"),
            total_amount=Decimal("70000.00"),
            amount_received=Decimal("30000.00"),
            balance_due=Decimal("40000.00"),
            payment_status="PARTIALLY PAID",
            payment_terms="100% Advance Payment / Third Party Payments Acceptable",
            bank_details="Emirates NBD - Dubai, IBAN: AE440260000123456789012, SWIFT: EBILAEADXXX",
            notes="20,000 KG Black Raisins Best for Jayanti Agrochem.",
            created_by="Admin",
        )
        db.add(inv2)
        db.commit()

        # Bank transaction for partial payment $30,000
        tx2 = models.BankTransaction(
            transaction_code="BNK-2026-002",
            date=date.today() - timedelta(days=4),
            bank_account_id=b1.id,
            bank_name=b1.bank_name,
            account_number=b1.account_number,
            party_type="CUSTOMER",
            party_id=c2.id,
            party_name=c2.customer_name,
            transaction_type="CUSTOMER RECEIPT",
            invoice_id=inv2.id,
            invoice_number=inv2.invoice_number,
            shipment_id=shp2.id,
            currency="USD",
            money_in=Decimal("30000.00"),
            money_out=Decimal("0.00"),
            exchange_rate=Decimal("1.0000"),
            usd_equivalent_in=Decimal("30000.00"),
            usd_equivalent_out=Decimal("0.00"),
            transaction_reference="TT-BOI-8829103",
            running_balance=b1.current_balance + Decimal("30000.00"),
            payment_method="Bank Transfer (SWIFT)",
            notes="Partial advance payment against INV-AQ-2026-002 ($30,000 out of $70,000)",
            created_by="Admin",
        )
        db.add(tx2)
        b1.current_balance += Decimal("30000.00")
        db.commit()

        alloc2 = models.PaymentAllocation(
            bank_transaction_id=tx2.id,
            customer_id=c2.id,
            invoice_id=inv2.id,
            shipment_id=shp2.id,
            allocated_amount_usd=Decimal("30000.00"),
        )
        db.add(alloc2)
        db.commit()

        # Transport payment of $5,000 for Silk Route Logistics
        tx_t = models.BankTransaction(
            transaction_code="BNK-2026-003",
            date=date.today() - timedelta(days=3),
            bank_account_id=b1.id,
            bank_name=b1.bank_name,
            account_number=b1.account_number,
            party_type="TRANSPORT",
            party_id=t1.id,
            party_name=t1.company_name,
            transaction_type="TRANSPORT PAYMENT",
            invoice_id=None,
            invoice_number=None,
            shipment_id=shp2.id,
            currency="USD",
            money_in=Decimal("0.00"),
            money_out=Decimal("5000.00"),
            exchange_rate=Decimal("1.0000"),
            usd_equivalent_in=Decimal("0.00"),
            usd_equivalent_out=Decimal("5000.00"),
            transaction_reference="WIRE-SRL-00293",
            running_balance=b1.current_balance - Decimal("5000.00"),
            payment_method="Bank Wire",
            notes="Payment against Silk Route Logistics transport charge ($5,000 paid)",
            created_by="Admin",
        )
        db.add(tx_t)
        b1.current_balance -= Decimal("5000.00")
        db.commit()

        # Audit log entry
        audit = models.AuditLog(
            entity_type="Shipment",
            entity_id=shp1.id,
            action="CREATE",
            old_value_json=None,
            new_value_json=f'{{"shipment_code":"{shp1.shipment_code}","invoice_value":{shp1.invoice_value}}}',
            user_name="Admin",
        )
        db.add(audit)
        db.commit()

        print("Seeding completed successfully with test data and exact examples.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
