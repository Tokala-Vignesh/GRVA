import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone, timedelta
from app.cloud.azure.connector import AzureConnector
from app.metrics.normalizer import DiscoveredResource

@pytest.fixture
def sample_azure_creds():
    return {
        "subscription_id": "sub-12345-67890",
        "tenant_id": "tenant-abc-def",
        "client_id": "app-client-id-001",
        "client_secret": "SuperSecretClientSecret123!",
        "region": "eastus"
    }

def test_azure_validate_credentials(sample_azure_creds):
    with patch("app.cloud.azure.connector.ClientSecretCredential"):
        with patch("app.cloud.azure.connector.ResourceManagementClient") as mock_rg_cls:
            with patch("app.cloud.azure.connector.ComputeManagementClient"):
                with patch("app.cloud.azure.connector.MonitorManagementClient"):
                    mock_client = MagicMock()
                    mock_rg_iter = MagicMock()
                    mock_rg_iter.__iter__.return_value = [MagicMock(name="rg-prod-01")]
                    mock_client.resource_groups.list.return_value = mock_rg_iter
                    mock_rg_cls.return_value = mock_client

                    connector = AzureConnector("conn-az-1", "My Azure", sample_azure_creds)
                    res = connector.validate_credentials()
                    assert res["valid"] is True
                    assert res["subscription_id"] == "sub-12345-67890"

def test_azure_discover_resources(sample_azure_creds):
    with patch("app.cloud.azure.connector.ClientSecretCredential"):
        with patch("app.cloud.azure.connector.ResourceManagementClient"):
            with patch("app.cloud.azure.connector.ComputeManagementClient") as mock_compute_cls:
                with patch("app.cloud.azure.connector.MonitorManagementClient"):
                    mock_client = MagicMock()
                    mock_vm = MagicMock()
                    mock_vm.id = "/subscriptions/sub-12345-67890/resourceGroups/prod-rg/providers/Microsoft.Compute/virtualMachines/vm-db-01"
                    mock_vm.name = "vm-db-01"
                    mock_vm.location = "eastus"
                    mock_vm.hardware_profile.vm_size = "Standard_D4s_v5"
                    mock_vm.tags = {"app": "database"}
                    mock_vm.network_profile.network_interfaces = []
                    mock_vm.storage_profile.os_disk.os_type = "Linux"

                    mock_client.virtual_machines.list_all.return_value = [mock_vm]
                    
                    # Instance view
                    iv = MagicMock()
                    status_item = MagicMock()
                    status_item.code = "PowerState/running"
                    iv.statuses = [status_item]
                    mock_client.virtual_machines.instance_view.return_value = iv
                    mock_compute_cls.return_value = mock_client

                    connector = AzureConnector("conn-az-1", "My Azure", sample_azure_creds)
                    resources = connector.discover_resources()

                    assert len(resources) == 1
                    r = resources[0]
                    assert r.resource_id == mock_vm.id
                    assert r.resource_name == "vm-db-01"
                    assert r.provider == "azure"
                    assert r.region == "eastus"
                    assert r.status == "running"
                    assert r.instance_type == "Standard_D4s_v5"
                    assert r.raw_metadata["resource_group"] == "prod-rg"
