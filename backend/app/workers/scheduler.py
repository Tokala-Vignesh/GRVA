import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import text
from app.core.config import settings
from app.database.session import SyncSessionLocal
from app.models.entities import (
    CloudConnection,
    CloudResource,
    InfrastructureMetric,
    Alert,
    Incident,
    CollectionJob,
    AuditLog,
)
from app.credentials.vault import vault
from app.cloud.factory import get_cloud_connector
from app.ml.anomaly import AnomalyDetector

logger = logging.getLogger("cloudsentinel.worker")

class MonitoringWorker:
    """
    Independent Scheduled Background Monitoring Engine.
    Executes discovery, metric collection, alert evaluation, ML anomaly detection,
    and retention maintenance independently of frontend UI state.
    """

    def __init__(self):
        self.scheduler = BackgroundScheduler(
            daemon=True,
            timezone="UTC",
            job_defaults={
                "coalesce": True, # Coalesce missed runs
                "max_instances": 1, # Prevent overlapping execution of the same job
            }
        )
        self.anomaly_detector = AnomalyDetector()

    def start(self):
        logger.info("[MonitoringWorker] Starting background scheduler...")
        now = datetime.now(timezone.utc)

        # 1. Resource Discovery Job (Runs immediately 2s after start, then every interval)
        self.scheduler.add_job(
            self.job_resource_discovery,
            trigger=IntervalTrigger(seconds=settings.DISCOVERY_INTERVAL_SECONDS),
            next_run_time=now + timedelta(seconds=2),
            id="job_resource_discovery",
            name="Cloud Resource Discovery",
            replace_existing=True,
        )

        # 2. Metric Collection Job (Runs 10s after start, then every interval)
        self.scheduler.add_job(
            self.job_metric_collection,
            trigger=IntervalTrigger(seconds=settings.METRICS_INTERVAL_SECONDS),
            next_run_time=now + timedelta(seconds=10),
            id="job_metric_collection",
            name="Infrastructure Metric Ingestion",
            replace_existing=True,
        )

        # 3. Alert Rule Evaluation (Runs 20s after start, then every interval)
        self.scheduler.add_job(
            self.job_alert_evaluation,
            trigger=IntervalTrigger(seconds=settings.ALERT_INTERVAL_SECONDS),
            next_run_time=now + timedelta(seconds=20),
            id="job_alert_evaluation",
            name="Threshold Alert Evaluation",
            replace_existing=True,
        )

        # 4. Data Retention Cleanup (Daily)
        self.scheduler.add_job(
            self.job_data_retention,
            trigger=IntervalTrigger(hours=24),
            id="job_data_retention",
            name="Historical Data Retention Cleanup",
            replace_existing=True,
        )

        self.scheduler.start()
        logger.info("[MonitoringWorker] Background scheduler started successfully.")

    def stop(self):
        logger.info("[MonitoringWorker] Shutting down background scheduler...")
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
        logger.info("[MonitoringWorker] Scheduler shut down cleanly.")

    def job_resource_discovery(self):
        """
        Scan all active cloud connections and discover virtual machines and compute assets.
        """
        logger.info("[Worker] Running scheduled resource discovery...")
        with SyncSessionLocal() as session:
            connections = session.query(CloudConnection).filter(CloudConnection.status != "disconnected").all()
            for conn in connections:
                job = CollectionJob(
                    job_type="discovery",
                    connection_id=conn.id,
                    status="running",
                    records_ingested=0,
                )
                session.add(job)
                session.commit()

                try:
                    creds = vault.get_credentials(conn.credential_ref)
                    if not creds:
                        logger.warning(f"No credentials found in vault for connection {conn.name} ({conn.id})")
                        conn.status = "error"
                        job.status = "failed"
                        job.error_message = "Missing credentials in secure vault"
                        session.commit()
                        continue

                    connector = get_cloud_connector(
                        provider=conn.provider,
                        connection_id=conn.id,
                        connection_name=conn.name,
                        credentials=creds,
                    )
                    discovered_list = connector.discover_resources()

                    for r in discovered_list:
                        existing = session.query(CloudResource).filter_by(
                            connection_id=conn.id,
                            resource_id=r.resource_id,
                        ).first()

                        now_utc = datetime.now(timezone.utc)
                        if existing:
                            existing.resource_name = r.resource_name
                            existing.status = r.status
                            existing.ip_address = r.ip_address
                            existing.private_ip = r.private_ip
                            existing.instance_type = r.instance_type
                            existing.zone = r.zone
                            existing.updated_at = now_utc
                        else:
                            new_r = CloudResource(
                                connection_id=conn.id,
                                provider=r.provider,
                                resource_id=r.resource_id,
                                resource_name=r.resource_name,
                                resource_type=r.resource_type,
                                region=r.region,
                                zone=r.zone,
                                status=r.status,
                                ip_address=r.ip_address,
                                private_ip=r.private_ip,
                                instance_type=r.instance_type,
                                created_at=now_utc,
                                updated_at=now_utc,
                            )
                            session.add(new_r)

                    conn.last_sync_at = datetime.now(timezone.utc)
                    conn.status = "connected"
                    job.status = "success"
                    job.records_ingested = len(discovered_list)
                    job.finished_at = datetime.now(timezone.utc)
                    session.commit()
                    logger.info(f"[Worker] Discovered {len(discovered_list)} resources for connection '{conn.name}'")
                except Exception as e:
                    logger.error(f"[Worker] Resource discovery failed for connection {conn.name}: {e}")
                    conn.status = "error"
                    job.status = "failed"
                    job.error_message = str(e)
                    job.finished_at = datetime.now(timezone.utc)
                    session.commit()

    def job_metric_collection(self):
        """
        Query real monitoring APIs for recent metrics on all discovered resources.
        """
        logger.info("[Worker] Running scheduled metric collection...")
        with SyncSessionLocal() as session:
            resources = session.query(CloudResource).filter(CloudResource.status == "running").all()
            if not resources:
                logger.debug("[Worker] No active running resources to collect metrics for.")
                return

            now = datetime.now(timezone.utc)
            start_window = now - timedelta(minutes=15)

            total_samples = 0
            for resource in resources:
                conn = resource.connection
                if not conn:
                    continue

                creds = vault.get_credentials(conn.credential_ref)
                if not creds:
                    continue

                try:
                    connector = get_cloud_connector(
                        provider=conn.provider,
                        connection_id=conn.id,
                        connection_name=conn.name,
                        credentials=creds,
                    )
                    from app.metrics.normalizer import DiscoveredResource
                    disc_res = DiscoveredResource(
                        resource_id=resource.resource_id,
                        resource_name=resource.resource_name,
                        provider=resource.provider,
                        region=resource.region,
                        status=resource.status,
                    )
                    samples = connector.collect_metrics(
                        disc_res,
                        start_time=start_window,
                        end_time=now,
                        period_seconds=settings.METRICS_INTERVAL_SECONDS,
                    )

                    for s in samples:
                        # Avoid duplicates
                        existing_metric = session.query(InfrastructureMetric).filter_by(
                            resource_id=resource.id,
                            timestamp=s.event_timestamp,
                        ).first()

                        if not existing_metric:
                            record = InfrastructureMetric(
                                resource_id=resource.id,
                                timestamp=s.event_timestamp,
                                cpu_usage_percent=s.cpu_usage_percent,
                                memory_usage_percent=s.memory_usage_percent,
                                disk_usage_percent=s.disk_usage_percent,
                                network_in_bytes=s.network_in_bytes,
                                network_out_bytes=s.network_out_bytes,
                                disk_read_bytes=s.disk_read_bytes,
                                disk_write_bytes=s.disk_write_bytes,
                                source=s.source,
                                freshness=s.freshness,
                            )
                            session.add(record)
                            total_samples += 1

                    resource.last_collected_at = now
                    session.commit()

                    # Run ML anomaly scoring on this resource's metric history
                    self.anomaly_detector.evaluate_resource(resource.id, session)

                except Exception as e:
                    logger.error(f"[Worker] Metric collection error for {resource.resource_name} ({resource.id}): {e}")

            logger.info(f"[Worker] Ingested {total_samples} normalized metric records across resources.")

    def job_alert_evaluation(self):
        """
        Evaluate threshold alerting rules on latest metrics.
        """
        with SyncSessionLocal() as session:
            # Query the latest metric sample for each running resource
            resources = session.query(CloudResource).filter(CloudResource.status == "running").all()
            for r in resources:
                latest_metric = (
                    session.query(InfrastructureMetric)
                    .filter_by(resource_id=r.id)
                    .order_by(InfrastructureMetric.timestamp.desc())
                    .first()
                )
                if not latest_metric:
                    continue

                # Check CPU Threshold (> 85% is Critical)
                if latest_metric.cpu_usage_percent is not None and latest_metric.cpu_usage_percent > 85.0:
                    self._trigger_alert(
                        session=session,
                        resource=r,
                        rule_name="High CPU Utilization",
                        metric_name="cpu_usage_percent",
                        threshold=85.0,
                        observed=latest_metric.cpu_usage_percent,
                        severity="critical",
                    )
                # Check Memory Threshold (> 90% is High)
                if latest_metric.memory_usage_percent is not None and latest_metric.memory_usage_percent > 90.0:
                    self._trigger_alert(
                        session=session,
                        resource=r,
                        rule_name="High Memory Utilization",
                        metric_name="memory_usage_percent",
                        threshold=90.0,
                        observed=latest_metric.memory_usage_percent,
                        severity="high",
                    )

            session.commit()

    def _trigger_alert(
        self,
        session,
        resource: CloudResource,
        rule_name: str,
        metric_name: str,
        threshold: float,
        observed: float,
        severity: str,
    ):
        """Deduplicate and register alert, creating an Incident if none is open."""
        existing_alert = (
            session.query(Alert)
            .filter_by(
                resource_id=resource.id,
                rule_name=rule_name,
                status="firing",
            )
            .first()
        )
        now_utc = datetime.now(timezone.utc)
        if not existing_alert:
            alert = Alert(
                resource_id=resource.id,
                rule_name=rule_name,
                metric_name=metric_name,
                threshold=threshold,
                observed_value=observed,
                severity=severity,
                status="firing",
                triggered_at=now_utc,
            )
            session.add(alert)
            logger.warning(f"[Alert] Firing {severity.upper()}: {rule_name} on {resource.resource_name} (Val: {observed:.1f}%, Threshold: {threshold}%)")

            # Check if an incident already exists for this resource
            existing_inc = (
                session.query(Incident)
                .filter(
                    Incident.resource_id == resource.id,
                    Incident.status.in_(["open", "investigating", "acknowledged"]),
                )
                .first()
            )
            if not existing_inc:
                # Count total incidents to generate sequential INC-XXXX number
                total_incidents = session.query(Incident).count()
                inc_num = f"INC-{1000 + total_incidents + 1}"
                new_incident = Incident(
                    incident_number=inc_num,
                    title=f"{rule_name} on {resource.resource_name}",
                    description=f"{rule_name} exceeded threshold of {threshold}% with observed value of {observed:.1f}% on {resource.provider.upper()} resource {resource.resource_id}.",
                    provider=resource.provider,
                    resource_id=resource.id,
                    severity=severity,
                    status="open",
                    ai_investigation_status="pending",
                    created_at=now_utc,
                    updated_at=now_utc,
                )
                session.add(new_incident)
                logger.info(f"[Incident] Auto-created incident {inc_num} for resource {resource.resource_name}")

    def job_data_retention(self):
        """
        Prune historical metric samples older than the retention window.
        """
        logger.info("[Worker] Running data retention maintenance...")
        cutoff = datetime.now(timezone.utc) - timedelta(days=settings.METRIC_RETENTION_DAYS)
        with SyncSessionLocal() as session:
            deleted_count = session.query(InfrastructureMetric).filter(
                InfrastructureMetric.timestamp < cutoff
            ).delete()
            session.commit()
            logger.info(f"[Worker] Retention cleanup deleted {deleted_count} metrics older than {settings.METRIC_RETENTION_DAYS} days.")


worker = MonitoringWorker()
