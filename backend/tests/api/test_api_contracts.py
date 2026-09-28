"""
AQ COMPANIES - API Contract & Schema Drift Test Suite
Ensures all public and internal API contracts conform strictly to specifications,
detects OpenAPI schema drift, and verifies maintenance mode locking behavior.
"""

import os
import json
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.maintenance import set_maintenance_mode

client = TestClient(app)
SNAPSHOT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "openapi.json")


@pytest.mark.api
def test_openapi_snapshot_exists_and_valid():
    """Verify that openapi.json exists and is valid JSON."""
    assert os.path.exists(SNAPSHOT_PATH), f"Missing OpenAPI snapshot: {SNAPSHOT_PATH}"
    with open(SNAPSHOT_PATH, "r", encoding="utf-8") as f:
        snapshot = json.load(f)
    assert snapshot.get("openapi", "").startswith("3.")
    assert "paths" in snapshot
    assert "/version" in snapshot["paths"]
    assert "/health" in snapshot["paths"]


@pytest.mark.api
def test_openapi_contract_drift():
    """Verify that current app.openapi() routes match the snapshot routes without unauthorized deletions."""
    current_spec = app.openapi()
    with open(SNAPSHOT_PATH, "r", encoding="utf-8") as f:
        snapshot = json.load(f)

    current_paths = set(current_spec.get("paths", {}).keys())
    snapshot_paths = set(snapshot.get("paths", {}).keys())

    missing_paths = snapshot_paths - current_paths
    assert not missing_paths, f"API Contract Breaking Drift! Paths removed from specification: {missing_paths}"


@pytest.mark.api
def test_version_contract():
    """Verify /version endpoint shape and semantic version."""
    res = client.get("/version")
    assert res.status_code == 200
    data = res.json()
    assert data["version"] == "2.0.0"
    assert data["api_version"] == "v1"
    assert "environment" in data
    assert "database_revision" in data
    # Verify no leaked credentials or secrets
    assert "SECRET_KEY" not in str(data)
    assert "password" not in str(data).lower()


@pytest.mark.api
def test_health_and_ready_contracts():
    """Verify /health and /ready contract standards."""
    h_res = client.get("/health")
    assert h_res.status_code == 200
    h_data = h_res.json()
    assert h_data["status"] in ("UP", "ok")
    assert h_data["version"] == "2.0.0"

    r_res = client.get("/ready")
    assert r_res.status_code == 200
    r_data = r_res.json()
    assert r_data["status"].upper() == "READY"
    assert r_data["database"].lower() == "connected"


@pytest.mark.api
def test_system_maintenance_contract():
    """Verify /api/v1/system/maintenance status endpoint."""
    res = client.get("/api/v1/system/maintenance")
    assert res.status_code == 200
    data = res.json()
    assert "enabled" in data
    assert isinstance(data["enabled"], bool)


@pytest.mark.api
def test_dashboard_kpis_contract():
    """Verify /api/dashboard/kpis structure and types."""
    res = client.get("/api/dashboard/kpis?filter=all")
    assert res.status_code == 200
    data = res.json()
    assert "kpis" in data
    kpis = data["kpis"]
    assert "total_sales" in kpis
    assert "customer_receivable" in kpis
    assert isinstance(kpis["total_sales"], (int, float))
    assert isinstance(kpis["customer_receivable"], (int, float))


@pytest.mark.api
def test_customers_contract():
    """Verify /api/customers structure."""
    res = client.get("/api/customers")
    assert res.status_code == 200
    customers = res.json()
    assert isinstance(customers, list)
    if customers:
        first = customers[0]
        assert "id" in first
        assert "customer_name" in first


@pytest.mark.api
def test_bank_accounts_contract():
    """Verify /api/bank-accounts structure."""
    res = client.get("/api/bank-accounts")
    assert res.status_code == 200
    accounts = res.json()
    assert isinstance(accounts, list)
    if accounts:
        first = accounts[0]
        assert "id" in first
        assert "account_name" in first
        assert "bank_name" in first


@pytest.mark.api
def test_maintenance_mode_locking_contract():
    """
    Verify maintenance mode behavior:
    1. Safe reads (GET /health) still return 200
    2. Mutating requests return HTTP 503 Service Unavailable
    3. Requests with X-Maintenance-Bypass header are permitted
    """
    try:
        set_maintenance_mode(enabled=True, reason="CI Contract Test", updated_by="TestRunner")

        # GET /health should always pass
        get_res = client.get("/health")
        assert get_res.status_code == 200

        # Mutation without bypass should receive 503
        post_res = client.post("/api/invoices", json={"customer_id": 1, "total_amount": 100.0})
        assert post_res.status_code == 503
        assert "maintenance" in post_res.text.lower()

        # Mutation with bypass header should pass the maintenance interceptor
        bypass_headers = {"X-Maintenance-Bypass": settings.SECRET_KEY}
        bypass_res = client.post("/api/invoices", json={"invalid": "payload"}, headers=bypass_headers)
        # It should pass the 503 gate and reach validation (e.g. 422 or 400), but NOT 503
        assert bypass_res.status_code != 503
    finally:
        set_maintenance_mode(enabled=False, reason="CI Contract Test Completed", updated_by="TestRunner")
