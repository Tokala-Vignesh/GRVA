import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone, timedelta
from app.cloud.gcp.connector import GCPConnector
from app.metrics.normalizer import DiscoveredResource

@pytest.fixture
def sample_gcp_creds():
    return {
        "project_id": "test-cloudsentinel-project",
        "service_account_json": json_info_mock(),
        "region": "us-central1"
    }

def json_info_mock():
    import json
    return json.dumps({
        "type": "service_account",
        "project_id": "test-cloudsentinel-project",
        "private_key_id": "1234567890abcdef",
        "private_key": "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAz...FAKEKEY\n-----END RSA PRIVATE KEY-----\n",
        "client_email": "sa@test-cloudsentinel-project.iam.gserviceaccount.com",
        "client_id": "100000000000000000001",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
    })

def test_gcp_validate_credentials(sample_gcp_creds):
    with patch("google.oauth2.service_account.Credentials.from_service_account_info"):
        with patch("google.cloud.compute_v1.ZonesClient") as mock_zones_cls:
            mock_zones = MagicMock()
            mock_page = MagicMock()
            mock_page.__iter__.return_value = [MagicMock(name="us-central1-a")]
            mock_zones.list.return_value = mock_page
            mock_zones_cls.return_value = mock_zones

            connector = GCPConnector("conn-gcp-1", "My GCP", sample_gcp_creds)
            res = connector.validate_credentials()
            assert res["valid"] is True
            assert res["project_id"] == "test-cloudsentinel-project"

def test_gcp_discover_resources(sample_gcp_creds):
    with patch("google.oauth2.service_account.Credentials.from_service_account_info"):
        with patch("google.cloud.compute_v1.InstancesClient") as mock_inst_cls:
            mock_client = MagicMock()
            
            # Mock instance
            mock_inst = MagicMock()
            mock_inst.id = 9876543210
            mock_inst.name = "web-prod-01"
            mock_inst.machine_type = "zones/us-central1-a/machineTypes/e2-standard-4"
            mock_inst.status = "RUNNING"
            mock_inst.self_link = "https://compute.googleapis.com/.../web-prod-01"
            mock_inst.cpu_platform = "Intel Cascade Lake"
            mock_inst.creation_timestamp = "2026-01-01T00:00:00Z"
            mock_inst.labels = {"environment": "production", "tier": "backend"}
            
            # Nic
            nic = MagicMock()
            nic.network_i_p = "10.128.0.2"
            access_cfg = MagicMock()
            access_cfg.nat_i_p = "34.100.200.50"
            nic.access_configs = [access_cfg]
            mock_inst.network_interfaces = [nic]
            mock_inst.disks = []

            scoped_list = MagicMock()
            scoped_list.instances = [mock_inst]
            mock_client.aggregated_list.return_value = [("zones/us-central1-a", scoped_list)]
            mock_inst_cls.return_value = mock_client

            connector = GCPConnector("conn-gcp-1", "My GCP", sample_gcp_creds)
            resources = connector.discover_resources()

            assert len(resources) == 1
            r = resources[0]
            assert r.resource_id == "9876543210"
            assert r.resource_name == "web-prod-01"
            assert r.provider == "gcp"
            assert r.zone == "us-central1-a"
            assert r.region == "us-central1"
            assert r.status == "running"
            assert r.ip_address == "34.100.200.50"
            assert r.private_ip == "10.128.0.2"
            assert r.instance_type == "e2-standard-4"
            assert r.tags["environment"] == "production"
