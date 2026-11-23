from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database.session import get_db
from app.security.auth import verify_token
from app.models.entities import CloudConnection, CloudResource, InfrastructureMetric, Alert, Incident, SecurityEvent
from app.credentials.vault import vault
from app.services.ollama_service import ollama_service

router = APIRouter(prefix="/monitoring", tags=["Monitoring & Telemetry"], dependencies=[Depends(verify_token)])

@router.get("/overview")
async def get_monitoring_overview(db: AsyncSession = Depends(get_db)):
    # Total connections
    conns_res = await db.execute(select(CloudConnection))
    connections = conns_res.scalars().all()
    
    # Total resources & status
    res_query = await db.execute(select(CloudResource))
    resources = res_query.scalars().all()

    by_provider = {
        "aws": 0, "gcp": 0, "azure": 0, "oci": 0,
        "digitalocean": 0, "hetzner": 0, "render": 0,
        "cloudflare": 0, "vercel": 0, "supabase": 0,
        "flyio": 0, "docker": 0, "kubernetes": 0, "private": 0,
    }
    by_status = {"healthy": 0, "warning": 0, "critical": 0, "stopped": 0}

    for r in resources:
        p = r.provider.lower()
        by_provider[p] = by_provider.get(p, 0) + 1
        st = r.status.lower()
        if st in ("running", "ready"):
            by_status["healthy"] += 1
        elif st in ("warning", "degraded"):
            by_status["warning"] += 1
        elif st in ("critical", "failed", "error"):
            by_status["critical"] += 1
        else:
            by_status["stopped"] += 1

    # Active Incidents
    inc_query = await db.execute(
        select(Incident).filter(Incident.status.in_(["open", "investigating", "awaiting_approval"]))
    )
    active_incidents = len(inc_query.scalars().all())

    # Recent Security Events
    sec_query = await db.execute(select(SecurityEvent).order_by(SecurityEvent.occurred_at.desc()).limit(5))
    recent_security = [
        {"name": s.event_name, "provider": s.provider, "severity": s.severity, "time": s.occurred_at.isoformat()}
        for s in sec_query.scalars().all()
    ]

    # Real-time aggregate telemetry across discovered resources
    metrics_query = await db.execute(
        select(InfrastructureMetric)
        .order_by(InfrastructureMetric.timestamp.desc())
        .limit(60)
    )
    raw_metrics = metrics_query.scalars().all()
    time_series_map = {}
    for m in reversed(raw_metrics):
        t_str = m.timestamp.strftime("%H:%M") if m.timestamp else ""
        if t_str not in time_series_map:
            time_series_map[t_str] = {"time": t_str, "cpu_sum": 0.0, "mem_sum": 0.0, "count": 0}
        if m.cpu_usage_percent is not None:
            time_series_map[t_str]["cpu_sum"] += m.cpu_usage_percent
        if m.memory_usage_percent is not None:
            time_series_map[t_str]["mem_sum"] += m.memory_usage_percent
        time_series_map[t_str]["count"] += 1

    real_telemetry = []
    for k, v in time_series_map.items():
        c = v["count"] or 1
        real_telemetry.append({
            "time": v["time"],
            "cpu": round(v["cpu_sum"] / c, 1) if v["cpu_sum"] else None,
            "mem": round(v["mem_sum"] / c, 1) if v["mem_sum"] else None,
        })

    return {
        "total_connections": len(connections),
        "total_resources": len(resources),
        "healthy_resources": by_status["healthy"],
        "warning_resources": by_status["warning"],
        "critical_resources": by_status["critical"],
        "stopped_resources": by_status["stopped"],
        "active_incidents": active_incidents,
        "provider_distribution": by_provider,
        "recent_security_events": recent_security,
        "vault_backend": vault.backend_name,
        "telemetry_series": real_telemetry,
    }

@router.get("/health")
async def get_system_health():
    ollama_info = ollama_service.check_health()
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": "sqlite_wal_active",
        "keyring_vault": vault.backend_name,
        "ollama": ollama_info,
    }
