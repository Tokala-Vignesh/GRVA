from typing import Dict, Any
from app.cloud.base import BaseCloudConnector

def get_cloud_connector(
    provider: str,
    connection_id: str,
    connection_name: str,
    credentials: Dict[str, Any],
) -> BaseCloudConnector:
    """
    Factory creating the appropriate cloud or private infrastructure connector.
    Uses deferred lazy imports to ensure sub-second cold boot times.
    """
    p = provider.lower()
    if p == "aws":
        from app.cloud.aws.connector import AWSConnector
        return AWSConnector(connection_id, connection_name, credentials)
    elif p == "gcp":
        from app.cloud.gcp.connector import GCPConnector
        return GCPConnector(connection_id, connection_name, credentials)
    elif p == "azure":
        from app.cloud.azure.connector import AzureConnector
        return AzureConnector(connection_id, connection_name, credentials)
    elif p in ("private", "linux", "prometheus"):
        from app.cloud.private_servers.connector import PrivateServerConnector
        return PrivateServerConnector(connection_id, connection_name, credentials)
    else:
        raise ValueError(f"Unsupported cloud provider: '{provider}'")
