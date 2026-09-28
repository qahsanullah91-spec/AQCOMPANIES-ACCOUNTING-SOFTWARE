import time
from decimal import Decimal
from fastapi.testclient import TestClient
try:
    from app.main import app
    from app.database import SessionLocal
    from app import models
except ImportError:
    from backend.app.main import app
    from backend.app.database import SessionLocal
    from backend.app import models

client = TestClient(app)


def test_new_stock_creation_and_conversion():
    ts = int(time.time())
    code = f"NEW STOCK-TEST-{ts}"
    inv_num = f"INV-TEST-CONV-{ts}"
    cnt_num = f"TEST{ts % 10000000:07d}"
    # 1. Create a New Stock record (e.g. prompt example NEW STOCK 004)
    payload = {
        "stock_code": code,
        "supplier_id": 1,
        "customer_id": 1,
        "product_name": "Black Raisins Test",
        "product_grade": "Grade A",
        "packages": 1000,
        "cartons": 1000,
        "net_kg": 10000.0,
        "selling_rate": 3.20,
        "purchase_rate": 2.10,
        "location": "Kabul Warehouse",
        "status": "READY FOR LOADING",
    }
    res = client.post("/api/new-stock", json=payload)
    assert res.status_code == 200
    st_data = res.json()
    assert st_data["stock_code"] == code
    assert Decimal(str(st_data["selling_value"])) == Decimal("32000.00")
    assert Decimal(str(st_data["purchase_cost"])) == Decimal("21000.00")
    st_id = st_data["id"]

    # 2. Convert to shipment without re-entering data
    conv_payload = {
        "invoice_number": inv_num,
        "container_number": cnt_num,
        "bl_number": f"BLTEST{ts}",
        "transport_company_id": 1,
        "transport_freight": 5500.00,
    }
    res_conv = client.post(f"/api/new-stock/{st_id}/convert-to-shipment", json=conv_payload)
    assert res_conv.status_code == 200
    conv_data = res_conv.json()
    assert conv_data["success"] is True
    shp_id = conv_data["shipment_id"]

    # Verify converted shipment
    res_shp = client.get(f"/api/shipments/{shp_id}")
    assert res_shp.status_code == 200
    shp = res_shp.json()
    assert shp["invoice_number"] == inv_num
    assert Decimal(str(shp["net_weight_kg"])) == Decimal("10000.000")
    assert Decimal(str(shp["invoice_value"])) == Decimal("32000.00")
    assert Decimal(str(shp["purchase_cost"])) == Decimal("21000.00")

    # Clean up test artifacts so test run leaves database pristine
    db = SessionLocal()
    try:
        db.query(models.NewStock).filter(models.NewStock.converted_shipment_id == shp_id).update({"converted_shipment_id": None})
        db.query(models.Invoice).filter(models.Invoice.shipment_id == shp_id).delete()
        db.query(models.Purchase).filter(models.Purchase.shipment_id == shp_id).delete()
        db.query(models.Shipment).filter(models.Shipment.id == shp_id).delete()
        db.query(models.NewStock).filter(models.NewStock.id == st_id).delete()
        db.commit()
    finally:
        db.close()


def test_customer_and_transport_ledgers():
    # Customer Ledger
    res_c = client.get("/api/customers/1/ledger")
    assert res_c.status_code == 200
    c_data = res_c.json()
    assert "profile" in c_data
    assert "summary" in c_data
    assert "ledger" in c_data
    assert len(c_data["ledger"]) > 0

    # Transport Company Ledger
    res_t = client.get("/api/transport-companies/1/ledger")
    assert res_t.status_code == 200
    t_data = res_t.json()
    assert "summary" in t_data
    assert "total_transport_charges" in t_data["summary"]
    assert "total_paid" in t_data["summary"]


def test_profit_and_loss_report():
    res = client.get("/api/profit-and-loss?period=this_year")
    assert res.status_code == 200
    pnl = res.json()
    assert "revenue" in pnl
    assert "cost_of_goods_sold" in pnl
    assert "operating_expenses" in pnl
    assert "net_profit" in pnl


def test_backup_creation():
    res = client.post("/api/backup/now")
    assert res.status_code == 200
    b_data = res.json()
    assert b_data["success"] is True
    assert "AQ-COMPANIES-BACKUP-" in b_data["backup_name"]
    assert b_data["size_bytes"] > 0
