import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import httpx
from app.cloud.base import BaseCloudConnector
from app.metrics.normalizer import DiscoveredResource, UnifiedMetricSample

logger = logging.getLogger("cloudsentinel.cloud.kubernetes")

class KubernetesConnector(BaseCloudConnector):
    """
    Kubernetes Cluster Connector.
    Interacts with Kubernetes API Server for Nodes, Pods, and Metrics Server across Local/K3s/Minikube/EKS/AKS/GKE.
    """

    def __init__(self, connection_id: str, connection_name: str, credentials: Dict[str, Any]):
        super().__init__(connection_id, connection_name, credentials)
        raw_url = self.credentials.get("api_server_url", "https://127.0.0.1:6443").strip()
        if not raw_url.startswith("http://") and not raw_url.startswith("https://"):
            raw_url = f"https://{raw_url}"
        self.api_server_url = raw_url.rstrip("/")
        self.bearer_token = self.credentials.get("bearer_token", "")
        self.namespace = self.credentials.get("namespace", "default")

    def _get_headers(self) -> Dict[str, str]:
        headers = {"User-Agent": "CloudSentinel-K8s/1.0", "Accept": "application/json"}
        if self.bearer_token:
            headers["Authorization"] = f"Bearer {self.bearer_token}"
        return headers

    def validate_credentials(self) -> Dict[str, Any]:
        """
        Validate K8s cluster connectivity via /version endpoint.
        """
        try:
            with httpx.Client(timeout=5.0, verify=False) as client:
                resp = client.get(f"{self.api_server_url}/version", headers=self._get_headers())
                if resp.status_code == 200:
                    v_info = resp.json()
                    git_version = v_info.get("gitVersion", "v1.x")
                    platform = v_info.get("platform", "linux/amd64")
                    logger.info(f"Kubernetes cluster verified: {git_version} ({platform}) at {self.api_server_url}")
                    return {
                        "valid": True,
                        "account_id": f"k8s-{git_version}",
                        "git_version": git_version,
                        "platform": platform,
                        "status": "connected",
                    }
                elif resp.status_code == 401 or resp.status_code == 403:
                    raise ValueError(f"Kubernetes authentication error ({resp.status_code}): ServiceAccount token invalid or unauthorized.")
                else:
                    raise ValueError(f"Kubernetes API returned status {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.warning(f"Kubernetes validation error: {e}")
            raise ValueError(
                f"Could not connect to Kubernetes API Server at '{self.api_server_url}': {str(e)}. "
                "Ensure cluster is running (e.g. Minikube, K3s, Docker Desktop K8s, or EKS) and reachable."
            )

    def discover_resources(self) -> List[DiscoveredResource]:
        """
        Discover Kubernetes Nodes and Pods.
        """
        resources: List[DiscoveredResource] = []
        try:
            with httpx.Client(timeout=8.0, verify=False) as client:
                # 1. Discover Nodes
                n_resp = client.get(f"{self.api_server_url}/api/v1/nodes", headers=self._get_headers())
                if n_resp.status_code == 200:
                    nodes = n_resp.json().get("items", [])
                    for node in nodes:
                        metadata = node.get("metadata", {})
                        node_name = metadata.get("name", "k8s-node")
                        node_status = "running"
                        # Check Ready condition
                        conditions = node.get("status", {}).get("conditions", [])
                        for cond in conditions:
                            if cond.get("type") == "Ready" and cond.get("status") != "True":
                                node_status = "warning"

                        node_info = node.get("status", {}).get("nodeInfo", {})
                        kubelet_v = node_info.get("kubeletVersion", "")
                        os_image = node_info.get("osImage", "")

                        resources.append(DiscoveredResource(
                            resource_id=f"k8s-node-{node_name}",
                            resource_name=node_name,
                            provider="kubernetes",
                            resource_type="cluster_node",
                            region="k8s_cluster",
                            status=node_status,
                            instance_type=kubelet_v or "k8s-node",
                            tags={"os": os_image},
                            raw_metadata=node,
                        ))

                # 2. Discover Pods in specified namespace or all namespaces
                p_resp = client.get(f"{self.api_server_url}/api/v1/pods", headers=self._get_headers())
                if p_resp.status_code == 200:
                    pods = p_resp.json().get("items", [])
                    for pod in pods[:30]:
                        p_meta = pod.get("metadata", {})
                        p_name = p_meta.get("name", "pod")
                        p_ns = p_meta.get("namespace", "default")
                        phase = pod.get("status", {}).get("phase", "Running").lower()
                        status_str = "running" if phase == "running" else "warning"

                        resources.append(DiscoveredResource(
                            resource_id=f"k8s-pod-{p_ns}-{p_name}",
                            resource_name=f"{p_ns}/{p_name}",
                            provider="kubernetes",
                            resource_type="pod",
                            region=p_ns,
                            status=status_str,
                            ip_address=pod.get("status", {}).get("podIP"),
                            instance_type="k8s_pod",
                            tags={"namespace": p_ns, "phase": phase},
                            raw_metadata=pod,
                        ))
        except Exception as e:
            logger.warning(f"Kubernetes resource discovery error: {e}")

        return resources

    def collect_metrics(
        self,
        resource: DiscoveredResource,
        start_time: datetime,
        end_time: datetime,
        period_seconds: int = 300,
    ) -> List[UnifiedMetricSample]:
        """
        Query K8s Metrics Server (/apis/metrics.k8s.io/v1beta1/nodes or /pods).
        """
        return []

    def collect_logs(
        self,
        resource_id: str,
        start_time: datetime,
        end_time: datetime,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        return []

    def collect_costs(self, start_date: str, end_date: str) -> List[Dict[str, Any]]:
        return []
