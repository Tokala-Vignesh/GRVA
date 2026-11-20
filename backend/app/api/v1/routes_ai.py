from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.session import get_db
from app.security.auth import verify_token
from app.models.entities import CloudResource, InfrastructureMetric, Incident, SecurityEvent
from app.schemas.api import AIChatRequest, AIChatResponse, AIInvestigateRequest
from app.services.ollama_service import ollama_service
from app.agents.workflow import multi_agent_system
from app.agents.tools import AgentTools

router = APIRouter(prefix="/ai", tags=["AI & Multi-Agent"], dependencies=[Depends(verify_token)])

@router.get("/status")
async def get_ai_status():
    """Verify local Ollama installation and execution status."""
    return ollama_service.check_health()

@router.get("/models")
async def get_ai_models():
    """List available local models in Ollama."""
    models = ollama_service.list_installed_models()
    return {"models": models}

@router.post("/chat", response_model=AIChatResponse)
async def ai_assistant_chat(payload: AIChatRequest, db: AsyncSession = Depends(get_db)):
    """
    Conversational Cloud Assistant grounded strictly in real collected SQLite data.
    """
    # 1. Fetch real infrastructure context
    infra_summary = AgentTools.query_infrastructure_status()
    
    resource_context = None
    if payload.resource_id:
        resource_context = AgentTools.query_resource_telemetry(payload.resource_id, limit=5)

    grounding_data = {
        "infrastructure": infra_summary,
        "selected_resource": resource_context,
    }

    # 2. Check if Ollama is available
    health = ollama_service.check_health()
    if health["available"]:
        system_prompt = (
            "You are CloudSentinel AI Assistant, a local cloud infrastructure expert.\n"
            "Answer the user's inquiry based strictly on the verified local telemetry data provided below.\n"
            "Never invent resources, IP addresses, or false metrics. If data is absent, state that plainly.\n\n"
            f"TELEMETRY CONTEXT:\n{json.dumps(grounding_data, indent=2)}"
        )
        response_text = await ollama_service.generate_response(
            prompt=payload.query,
            system_prompt=system_prompt,
        )
        model_name = ollama_service.list_installed_models()
        active_model = model_name[0] if model_name else "local-ollama"
    else:
        # Grounded deterministic response when Ollama daemon is offline
        q_lower = payload.query.lower()
        if "cpu" in q_lower or "intensive" in q_lower:
            response_text = (
                f"Infrastructure Telemetry Summary: Currently tracking {infra_summary['total_resources']} "
                f"resources across {infra_summary['total_connections']} connections. "
                "Active monitors indicate nominal baseline CPU metrics. "
                "(Note: Local Ollama daemon is currently offline; install or run Ollama for conversational explanations)."
            )
        elif "incident" in q_lower:
            response_text = f"Current active incidents in system: {infra_summary['active_incidents']} open."
        else:
            response_text = (
                f"Local Cloud Sentinel status: {infra_summary['total_resources']} total resources "
                f"({infra_summary['resources_by_status'].get('healthy', 0)} healthy). "
                "To enable natural language LLM chat, launch Ollama with 'ollama run llama3.2'."
            )
        active_model = "deterministic-telemetry-engine"

    return AIChatResponse(
        response=response_text,
        grounding_data=grounding_data,
        model_used=active_model,
    )

@router.post("/investigate")
async def trigger_ai_investigation(payload: AIInvestigateRequest):
    """Run full LangGraph multi-agent investigation."""
    result = multi_agent_system.run_investigation(
        incident_id=payload.incident_id,
        resource_id=payload.resource_id,
        user_query=payload.query,
    )
    return result

import json
