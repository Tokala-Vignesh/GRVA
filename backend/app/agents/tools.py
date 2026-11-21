import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from app.database.session import SyncSessionLocal
from app.models.entities import (
    CloudConnection,
    CloudResource,
    InfrastructureMetric,
    SecurityEvent,
    Incident,
    RemediationAction,
    AuditLog,
)
from app.ml.anomaly import AnomalyDetector
from app.ml.forecaster import ResourceForecaster

logger = logging.getLogger("cloudsentinel.agents.tools")

class AgentTools:
    """Tools grounded in real SQLite data for LangGraph multi-agent execution."""

    @staticmethod
    def query_infrastructure_status() -> Dict[str, Any]:
        """Summarize overall health and resource counts across all cloud providers."""
        with SyncSessionLocal() as session:
            connections = session.query(CloudConnection).all()
            resources = session.query(CloudResource).all()

            by_provider = {}
            by_status = {"running": 0, "stopped": 0, "warning": 0, "critical": 0, "unknown": 0}

            for r in resources:
                p = r.provider
                by_provider[p] = by_provider.get(p, 0) + 1
                st = r.status.lower()
                by_status[st] = by_status.get(st, 0) + 1

            active_incidents = session.query(Incident).filter(Incident.status.in_(["open", "investigating"])).count()

            return {
                "total_connections": len(connections),
                "total_resources": len(resources),
                "resources_by_provider": by_provider,
                "resources_by_status": by_status,
                "active_incidents": active_incidents,
            }

    @staticmethod
    def query_top_utilized_resources(limit: int = 5) -> Dict[str, Any]:
        """Fetch highest CPU, memory, and disk consuming resources across all providers."""
        with SyncSessionLocal() as session:
            resources = session.query(CloudResource).all()
            res_data = []
            for r in resources:
                latest_metric = (
                    session.query(InfrastructureMetric)
                    .filter_by(resource_id=r.id)
                    .order_by(InfrastructureMetric.timestamp.desc())
                    .first()
                )
                cpu = latest_metric.cpu_usage_percent if latest_metric and latest_metric.cpu_usage_percent is not None else None
                mem = latest_metric.memory_usage_percent if latest_metric and latest_metric.memory_usage_percent is not None else None
                disk = latest_metric.disk_usage_percent if latest_metric and latest_metric.disk_usage_percent is not None else None

                res_data.append({
                    "id": r.id,
                    "resource_id": r.resource_id,
                    "resource_name": r.resource_name,
                    "provider": r.provider,
                    "region": r.region,
                    "status": r.status,
                    "instance_type": r.instance_type,
                    "ip_address": r.ip_address,
                    "cpu_usage_percent": cpu,
                    "memory_usage_percent": mem,
                    "disk_usage_percent": disk,
                })

            top_cpu = sorted(
                [r for r in res_data if r["cpu_usage_percent"] is not None],
                key=lambda x: x["cpu_usage_percent"],
                reverse=True
            )[:limit]
            top_mem = sorted(
                [r for r in res_data if r["memory_usage_percent"] is not None],
                key=lambda x: x["memory_usage_percent"],
                reverse=True
            )[:limit]
            top_disk = sorted(
                [r for r in res_data if r["disk_usage_percent"] is not None],
                key=lambda x: x["disk_usage_percent"],
                reverse=True
            )[:limit]

            return {
                "all_resources_count": len(res_data),
                "top_cpu": top_cpu,
                "top_mem": top_mem,
                "top_disk": top_disk,
                "resources": res_data[:15],
            }

    @staticmethod
    def query_active_incidents(limit: int = 5) -> List[Dict[str, Any]]:
        """Fetch open and investigating incidents with root causes."""
        with SyncSessionLocal() as session:
            incidents = (
                session.query(Incident)
                .filter(Incident.status.in_(["open", "investigating", "awaiting_approval"]))
                .order_by(Incident.created_at.desc())
                .limit(limit)
                .all()
            )
            return [
                {
                    "incident_number": inc.incident_number,
                    "title": inc.title,
                    "provider": inc.provider,
                    "severity": inc.severity,
                    "status": inc.status,
                    "root_cause": inc.root_cause,
                    "created_at": inc.created_at.isoformat() if inc.created_at else None,
                }
                for inc in incidents
            ]

    @staticmethod
    def query_full_application_context() -> Dict[str, Any]:
        """Aggregate full system observability context for AI reasoning."""
        with SyncSessionLocal() as session:
            infra_status = AgentTools.query_infrastructure_status()
            utilization = AgentTools.query_top_utilized_resources(limit=5)
            incidents = AgentTools.query_active_incidents(limit=5)
            security_events = AgentTools.query_security_audit_events(limit=5)

            connections = session.query(CloudConnection).all()
            conn_data = [
                {
                    "name": c.name,
                    "provider": c.provider,
                    "region": c.region,
                    "status": c.status,
                    "last_sync": c.last_sync_at.isoformat() if c.last_sync_at else None,
                }
                for c in connections
            ]

            remediations = session.query(RemediationAction).filter_by(status="pending_approval").limit(5).all()
            rem_data = [
                {
                    "action_type": r.action_type,
                    "target": r.target,
                    "risk_level": r.risk_level,
                    "status": r.status,
                }
                for r in remediations
            ]

            return {
                "infrastructure_summary": infra_status,
                "utilization": utilization,
                "active_incidents": incidents,
                "security_events": security_events,
                "cloud_connections": conn_data,
                "pending_remediations": rem_data,
            }

    @staticmethod
    def query_resource_telemetry(resource_id: str, limit: int = 15) -> Dict[str, Any]:
        """Fetch recent normalized telemetry samples for a specific resource."""
        with SyncSessionLocal() as session:
            res = session.query(CloudResource).filter(
                (CloudResource.id == resource_id) | (CloudResource.resource_id == resource_id)
            ).first()

            if not res:
                return {"error": f"Resource '{resource_id}' not found in database."}

            metrics = (
                session.query(InfrastructureMetric)
                .filter_by(resource_id=res.id)
                .order_by(InfrastructureMetric.timestamp.desc())
                .limit(limit)
                .all()
            )

            metric_list = []
            for m in reversed(metrics):
                metric_list.append({
                    "timestamp": m.timestamp.isoformat(),
                    "cpu_usage_percent": m.cpu_usage_percent,
                    "memory_usage_percent": m.memory_usage_percent,
                    "disk_usage_percent": m.disk_usage_percent,
                    "network_in_bytes": m.network_in_bytes,
                    "network_out_bytes": m.network_out_bytes,
                })

            return {
                "resource_id": res.resource_id,
                "resource_name": res.resource_name,
                "provider": res.provider,
                "status": res.status,
                "region": res.region,
                "metrics_sample_count": len(metric_list),
                "metrics": metric_list,
            }

    @staticmethod
    def invoke_ml_anomaly_detector(resource_id: str) -> Dict[str, Any]:
        """Run Scikit-learn Isolation Forest on historical telemetry."""
        with SyncSessionLocal() as session:
            res = session.query(CloudResource).filter(
                (CloudResource.id == resource_id) | (CloudResource.resource_id == resource_id)
            ).first()

            if not res:
                return {"error": f"Resource '{resource_id}' not found."}

            detector = AnomalyDetector()
            return detector.evaluate_resource(res.id, session)

    @staticmethod
    def invoke_predictive_forecaster(resource_id: str, metric_name: str = "cpu_usage_percent") -> Dict[str, Any]:
        """Run linear trend extrapolation and time-to-exhaustion analysis."""
        with SyncSessionLocal() as session:
            res = session.query(CloudResource).filter(
                (CloudResource.id == resource_id) | (CloudResource.resource_id == resource_id)
            ).first()

            if not res:
                return {"error": f"Resource '{resource_id}' not found."}

            metrics = (
                session.query(InfrastructureMetric)
                .filter_by(resource_id=res.id)
                .order_by(InfrastructureMetric.timestamp.asc())
                .all()
            )

            return ResourceForecaster.forecast_metric(metrics, metric_name, horizon_hours=24)

    @staticmethod
    def query_security_audit_events(limit: int = 10) -> List[Dict[str, Any]]:
        """Fetch recent cloud audit security events."""
        with SyncSessionLocal() as session:
            events = (
                session.query(SecurityEvent)
                .order_by(SecurityEvent.occurred_at.desc())
                .limit(limit)
                .all()
            )
            return [
                {
                    "event_name": e.event_name,
                    "provider": e.provider,
                    "severity": e.severity,
                    "actor": e.actor,
                    "source_ip": e.source_ip,
                    "occurred_at": e.occurred_at.isoformat(),
                }
                for e in events
            ]

    @staticmethod
    def propose_remediation_action(
        incident_id: Optional[str],
        resource_id: str,
        action_type: str,
        target: str,
        parameters: Dict[str, Any],
        risk_level: str = "low",
    ) -> Dict[str, Any]:
        """
        Record a proposed safe remediation action requiring explicit user approval.
        Allowed actions: restart_service, restart_container, send_notification, recommend_resize.
        """
        allowed_types = ["restart_service", "restart_container", "send_notification", "recommend_resize"]
        if action_type not in allowed_types:
            raise ValueError(f"Action '{action_type}' is not permitted by safe remediation policy.")

        with SyncSessionLocal() as session:
            res = session.query(CloudResource).filter(
                (CloudResource.id == resource_id) | (CloudResource.resource_id == resource_id)
            ).first()

            if not res:
                return {"error": f"Resource '{resource_id}' not found."}

            action = RemediationAction(
                incident_id=incident_id,
                resource_id=res.id,
                action_type=action_type,
                target=target,
                parameters=json.dumps(parameters),
                risk_level=risk_level,
                status="pending_approval",
                requires_approval=True,
                created_at=datetime.now(timezone.utc),
            )
            session.add(action)
            session.commit()

            return {
                "action_id": action.id,
                "action_type": action_type,
                "target": target,
                "status": "pending_approval",
                "risk_level": risk_level,
                "requires_human_approval": True,
            }
