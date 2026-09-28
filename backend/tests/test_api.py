from fastapi.testclient import TestClient
try:
    from app.main import app
except ImportError:
    from backend.app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["system"] == "AQ COMPANIES"
    assert data["status"] == "healthy"


def test_dashboard_kpis():
    res = client.get("/api/dashboard/kpis")
    assert res.status_code == 200
    data = res.json()
    assert "kpis" in data
    assert "charts" in data
    kpis = data["kpis"]
    assert "total_sales" in kpis
    assert "net_profit" in kpis
    assert "customer_receivable" in kpis
    assert "transport_company_balance" in kpis


def test_global_search():
    res = client.get("/api/search?q=Raisins")
    assert res.status_code == 200
    data = res.json()
    assert "shipments" in data or "products" in data


def test_duplicate_check():
    shipments_res = client.get("/api/shipments")
    assert shipments_res.status_code == 200
    shipments = shipments_res.json()
    target_inv = shipments[0]["invoice_number"] if shipments else "INV-101"
    target_cust = shipments[0]["customer_id"] if shipments else 1

    res = client.post(
        "/api/shipments/check-duplicate",
        json={"invoice_number": target_inv, "customer_id": target_cust},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_duplicate"] is True
    assert len(data["warnings"]) > 0


def test_invoice_pdf():
    # Test downloading PDF for seed invoice #1
    res = client.get("/api/invoices/1/pdf")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert len(res.content) > 1000
