from typing import Dict, Any
from app.cloud.base import BaseCloudConnector

def get_cloud_connector(
    provider: str,
    connection_id: str,
    connection_name: str,
    credentials: Dict[str, Any],
) -> BaseCloudConnector:
    """
    Factory creating the appropriate cloud, PaaS, or container infrastructure connector.
    Uses deferred lazy imports to ensure sub-second cold boot times.
    """
    p = provider.lower()
    
    # 1. Hyperscale Clouds
    if p == "aws":
        from app.cloud.aws.connector import AWSConnector
        return AWSConnector(connection_id, connection_name, credentials)
    elif p == "gcp":
        from app.cloud.gcp.connector import GCPConnector
        return GCPConnector(connection_id, connection_name, credentials)
    elif p == "azure":
        from app.cloud.azure.connector import AzureConnector
        return AzureConnector(connection_id, connection_name, credentials)
    elif p in ("oci", "oracle"):
        from app.cloud.oci.connector import OCIConnector
        return OCIConnector(connection_id, connection_name, credentials)
        
    # 2. Developer & VPS Clouds
    elif p in ("digitalocean", "do"):
        from app.cloud.digitalocean.connector import DigitalOceanConnector
        return DigitalOceanConnector(connection_id, connection_name, credentials)
    elif p in ("hetzner", "hetzner_cloud"):
        from app.cloud.hetzner.connector import HetznerConnector
        return HetznerConnector(connection_id, connection_name, credentials)
        
    # 3. Developer PaaS & Serverless Clouds
    elif p == "render":
        from app.cloud.render.connector import RenderConnector
        return RenderConnector(connection_id, connection_name, credentials)
    elif p in ("cloudflare", "cf"):
        from app.cloud.cloudflare.connector import CloudflareConnector
        return CloudflareConnector(connection_id, connection_name, credentials)
    elif p == "vercel":
        from app.cloud.vercel.connector import VercelConnector
        return VercelConnector(connection_id, connection_name, credentials)
    elif p == "supabase":
        from app.cloud.supabase.connector import SupabaseConnector
        return SupabaseConnector(connection_id, connection_name, credentials)
    elif p in ("flyio", "fly"):
        from app.cloud.flyio.connector import FlyioConnector
        return FlyioConnector(connection_id, connection_name, credentials)
        
    # 4. Containers & Infrastructure
    elif p == "docker":
        from app.cloud.docker.connector import DockerConnector
        return DockerConnector(connection_id, connection_name, credentials)
    elif p in ("kubernetes", "k8s"):
        from app.cloud.kubernetes.connector import KubernetesConnector
        return KubernetesConnector(connection_id, connection_name, credentials)
    elif p in ("private", "linux", "prometheus", "baremetal", "linux_server"):
        from app.cloud.private_servers.connector import PrivateServerConnector
        return PrivateServerConnector(connection_id, connection_name, credentials)
    else:
        raise ValueError(f"Unsupported cloud provider: '{provider}'")
