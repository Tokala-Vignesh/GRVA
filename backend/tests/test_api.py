import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

client = TestClient(app)

def test_health_check_unauthenticated():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "CloudSentinel AI"

def test_monitoring_overview_requires_token():
    response = client.get("/api/v1/monitoring/overview")
    # Must fail with 401 when X-CloudSentinel-Token is missing
    assert response.status_code == 401

def test_monitoring_overview_with_valid_token():
    headers = {"X-CloudSentinel-Token": settings.API_TOKEN}
    response = client.get("/api/v1/monitoring/overview", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_connections" in data
    assert "total_resources" in data
    assert "healthy_resources" in data
    assert "provider_distribution" in data

def test_connections_and_resources_endpoints():
    headers = {"X-CloudSentinel-Token": settings.API_TOKEN}
    
    # 1. Create a private Linux node connection
    conn_payload = {
        "name": "Integration Test Private Node",
        "endpoint_url": "http://127.0.0.1:9100/metrics",
        "region": "datacenter-eu"
    }
    create_resp = client.post("/api/v1/connections/private", json=conn_payload, headers=headers)
    assert create_resp.status_code == 200
    conn_data = create_resp.json()
    conn_id = conn_data["id"]
    assert conn_data["name"] == "Integration Test Private Node"
    assert conn_data["provider"] == "private"

    # 2. List connections
    list_resp = client.get("/api/v1/connections", headers=headers)
    assert list_resp.status_code == 200
    conns = list_resp.json()
    assert any(c["id"] == conn_id for c in conns)

    # 3. List resources
    res_resp = client.get("/api/v1/resources", headers=headers)
    assert res_resp.status_code == 200

    # 4. Cleanup
    del_resp = client.delete(f"/api/v1/connections/{conn_id}", headers=headers)
    assert del_resp.status_code == 200

def test_incidents_lifecycle():
    headers = {"X-CloudSentinel-Token": settings.API_TOKEN}
    inc_payload = {
        "title": "Database High Memory Warning",
        "description": "PostgreSQL instance memory threshold exceeded 90%",
        "provider": "aws",
        "severity": "high"
    }
    create_resp = client.post("/api/v1/incidents", json=inc_payload, headers=headers)
    assert create_resp.status_code == 200
    inc_data = create_resp.json()
    assert inc_data["title"] == "Database High Memory Warning"
    assert inc_data["status"] == "open"
    assert inc_data["incident_number"].startswith("INC-")

    # List incidents
    list_resp = client.get("/api/v1/incidents", headers=headers)
    assert list_resp.status_code == 200
    incidents = list_resp.json()
    assert len(incidents) >= 1

def test_settings_and_reports():
    headers = {"X-CloudSentinel-Token": settings.API_TOKEN}
    settings_resp = client.get("/api/v1/settings", headers=headers)
    assert settings_resp.status_code == 200
    data = settings_resp.json()
    assert "theme" in data
    assert "vault_backend" in data

    # Export report test
    export_resp = client.post(
        "/api/v1/reports/export",
        json={"report_type": "infrastructure_health", "format": "json"},
        headers=headers,
    )
    assert export_resp.status_code == 200
    report_data = export_resp.json()
    assert report_data["status"] == "success"
