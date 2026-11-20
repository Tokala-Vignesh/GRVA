from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from datetime import datetime
from app.metrics.normalizer import DiscoveredResource, UnifiedMetricSample

class BaseCloudConnector(ABC):
    """
    Abstract Base Class for all Cloud and Private Infrastructure Connectors.
    Enforces unified interfaces for verification, resource discovery, metric ingestion,
    log inspection, and cost queries.
    """

    def __init__(self, connection_id: str, connection_name: str, credentials: Dict[str, Any]):
        self.connection_id = connection_id
        self.connection_name = connection_name
        self.credentials = credentials

    @abstractmethod
    def validate_credentials(self) -> Dict[str, Any]:
        """
        Validate credentials by issuing a real, non-destructive authentication/caller identity call.
        Returns account info or raises an exception with specific diagnostic details.
        """
        pass

    @abstractmethod
    def discover_resources(self) -> List[DiscoveredResource]:
        """
        Query real cloud APIs to discover virtual machines and compute assets.
        """
        pass

    @abstractmethod
    def collect_metrics(
        self,
        resource: DiscoveredResource,
        start_time: datetime,
        end_time: datetime,
        period_seconds: int = 300,
    ) -> List[UnifiedMetricSample]:
        """
        Retrieve real metrics from provider monitoring services (CloudWatch, Cloud Monitoring, Azure Monitor)
        and normalize them into UnifiedMetricSample records.
        """
        pass

    @abstractmethod
    def collect_logs(
        self,
        resource_id: str,
        start_time: datetime,
        end_time: datetime,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Fetch recent log entries from provider logging service where permissions permit.
        """
        pass

    @abstractmethod
    def collect_costs(
        self,
        start_date: str,
        end_date: str,
    ) -> List[Dict[str, Any]]:
        """
        Optional query to provider billing APIs (Cost Explorer, Cloud Billing, Cost Management).
        """
        pass
