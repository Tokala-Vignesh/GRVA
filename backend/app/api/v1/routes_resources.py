from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database.session import get_db
from app.security.auth import verify_token
from app.models.entities import CloudResource, InfrastructureMetric
from app.schemas.api import ResourceResponse, MetricRecord
from app.ml.forecaster import ResourceForecaster

router = APIRouter(prefix="/resources", tags=["Cloud Resources"], dependencies=[Depends(verify_token)])

@router.get("", response_model=List[ResourceResponse])
async def list_resources(
    provider: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(CloudResource)
    if provider:
        query = query.filter_by(provider=provider.lower())
    if status:
        query = query.filter_by(status=status.lower())
    
    query = query.order_by(CloudResource.resource_name.asc())
    result = await db.execute(query)
    resources = result.scalars().all()

    response_items = []
    for r in resources:
        # Fetch latest metrics for sparklines
        latest_m = await db.execute(
            select(InfrastructureMetric)
            .filter_by(resource_id=r.id)
            .order_by(desc(InfrastructureMetric.timestamp))
            .limit(1)
        )
        lm = latest_m.scalar_one_or_none()
        response_items.append(
            ResourceResponse(
                id=r.id,
                connection_id=r.connection_id,
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
                last_collected_at=r.last_collected_at,
                latest_cpu=lm.cpu_usage_percent if lm else None,
                latest_mem=lm.memory_usage_percent if lm else None,
                latest_disk=lm.disk_usage_percent if lm else None,
            )
        )
    return response_items

@router.get("/{res_id}", response_model=ResourceResponse)
async def get_resource(res_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CloudResource).filter((CloudResource.id == res_id) | (CloudResource.resource_id == res_id))
    )
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    latest_m = await db.execute(
        select(InfrastructureMetric)
        .filter_by(resource_id=r.id)
        .order_by(desc(InfrastructureMetric.timestamp))
        .limit(1)
    )
    lm = latest_m.scalar_one_or_none()
    return ResourceResponse(
        id=r.id,
        connection_id=r.connection_id,
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
        last_collected_at=r.last_collected_at,
        latest_cpu=lm.cpu_usage_percent if lm else None,
        latest_mem=lm.memory_usage_percent if lm else None,
        latest_disk=lm.disk_usage_percent if lm else None,
    )

@router.get("/{res_id}/metrics", response_model=List[MetricRecord])
async def get_resource_metrics(
    res_id: str,
    limit: int = Query(default=100, le=500),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(CloudResource).filter((CloudResource.id == res_id) | (CloudResource.resource_id == res_id))
    )
    r = res.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Resource not found")

    result = await db.execute(
        select(InfrastructureMetric)
        .filter_by(resource_id=r.id)
        .order_by(desc(InfrastructureMetric.timestamp))
        .limit(limit)
    )
    metrics = result.scalars().all()
    return [
        MetricRecord(
            timestamp=m.timestamp,
            cpu_usage_percent=m.cpu_usage_percent,
            memory_usage_percent=m.memory_usage_percent,
            disk_usage_percent=m.disk_usage_percent,
            network_in_bytes=m.network_in_bytes,
            network_out_bytes=m.network_out_bytes,
            source=m.source,
        )
        for m in reversed(metrics)
    ]

@router.get("/{res_id}/forecast")
async def get_resource_forecast(
    res_id: str,
    metric_name: str = "cpu_usage_percent",
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(CloudResource).filter((CloudResource.id == res_id) | (CloudResource.resource_id == res_id))
    )
    r = res.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Resource not found")

    result = await db.execute(
        select(InfrastructureMetric)
        .filter_by(resource_id=r.id)
        .order_by(InfrastructureMetric.timestamp.asc())
    )
    metrics = result.scalars().all()
    forecast = ResourceForecaster.forecast_metric(metrics, metric_name)
    return forecast
