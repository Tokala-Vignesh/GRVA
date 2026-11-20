from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database.session import get_db
from app.security.auth import verify_token
from app.models.entities import Incident, IncidentInvestigation
from app.schemas.api import IncidentCreate, IncidentResponse
from app.agents.workflow import multi_agent_system

router = APIRouter(prefix="/incidents", tags=["Incidents"], dependencies=[Depends(verify_token)])

@router.get("", response_model=List[IncidentResponse])
async def list_incidents(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Incident)
    if status:
        query = query.filter_by(status=status.lower())
    if severity:
        query = query.filter_by(severity=severity.lower())
    
    query = query.order_by(desc(Incident.created_at))
    result = await db.execute(query)
    return result.scalars().all()

@router.post("", response_model=IncidentResponse)
async def create_incident(payload: IncidentCreate, db: AsyncSession = Depends(get_db)):
    # Sequential incident number
    count_res = await db.execute(select(Incident))
    total = len(count_res.scalars().all())
    inc_num = f"INC-{1000 + total + 1}"

    now = datetime.now(timezone.utc)
    new_inc = Incident(
        incident_number=inc_num,
        title=payload.title,
        description=payload.description,
        provider=payload.provider.lower(),
        resource_id=payload.resource_id,
        severity=payload.severity.lower(),
        status="open",
        ai_investigation_status="pending",
        created_at=now,
        updated_at=now,
    )
    db.add(new_inc)
    await db.commit()
    await db.refresh(new_inc)
    return new_inc

@router.get("/{inc_id}", response_model=IncidentResponse)
async def get_incident(inc_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Incident).filter((Incident.id == inc_id) | (Incident.incident_number == inc_id))
    )
    inc = result.scalar_one_or_none()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    return inc

@router.post("/{inc_id}/investigate")
async def trigger_investigation(inc_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Incident).filter((Incident.id == inc_id) | (Incident.incident_number == inc_id))
    )
    inc = result.scalar_one_or_none()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    inc.ai_investigation_status = "running"
    await db.commit()

    # Run LangGraph multi-agent workflow
    investigation_res = multi_agent_system.run_investigation(
        incident_id=inc.incident_number,
        resource_id=inc.resource_id,
        user_query=f"Root cause analysis for {inc.title}",
    )

    # Persist findings
    root_cause = investigation_res.get("root_cause_analysis")
    inc.root_cause = root_cause
    inc.ai_investigation_status = "completed"
    inc.status = "investigating"
    inc.updated_at = datetime.now(timezone.utc)

    # Record investigation trace
    for finding in investigation_res.get("agent_findings", []):
        inv_record = IncidentInvestigation(
            incident_id=inc.id,
            agent_name=finding["agent_name"],
            reasoning_trace=finding["summary"],
            findings=json.dumps(finding.get("details", {})),
            confidence_score=finding.get("confidence", 0.8),
            created_at=datetime.now(timezone.utc),
        )
        db.add(inv_record)

    await db.commit()
    await db.refresh(inc)

    return {
        "status": "completed",
        "incident_number": inc.incident_number,
        "root_cause": root_cause,
        "agent_findings": investigation_res.get("agent_findings", []),
        "proposed_remediations": investigation_res.get("proposed_remediations", []),
    }

import json
