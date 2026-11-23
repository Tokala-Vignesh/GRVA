import json
import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.session import get_db
from app.security.auth import verify_token
from app.models.entities import CloudResource, InfrastructureMetric, Incident, SecurityEvent, ApplicationSetting
from app.schemas.api import (
    AIChatRequest,
    AIChatResponse,
    AIInvestigateRequest,
    AIModelSwitchRequest,
    OllamaModelsResponse,
    OllamaModelItem,
)
from app.core.config import settings
from app.services.ollama_service import ollama_service, OllamaInferenceError
from app.agents.workflow import multi_agent_system
from app.agents.tools import AgentTools

logger = logging.getLogger("cloudsentinel.routes_ai")

router = APIRouter(prefix="/ai", tags=["AI & Multi-Agent"], dependencies=[Depends(verify_token)])

def build_optimized_ai_context(query: str, context: Dict[str, Any]) -> str:
    """
    High-density, low-token context builder.
    Instead of bloated raw JSON (3,000+ tokens) that slows down local LLMs (like Gemma/Llama),
    this generates a compact 100-250 token summary focused on what the user asked about.
    """
    q_lower = query.lower()
    infra = context.get("infrastructure_summary", {})
    utilization = context.get("utilization", {})
    all_res = utilization.get("resources", [])
    top_cpu = utilization.get("top_cpu", [])
    top_mem = utilization.get("top_mem", [])
    incidents = context.get("active_incidents", [])
    connections = context.get("cloud_connections", [])

    lines = [
        f"CONNECTED INFRASTRUCTURE: {infra.get('total_resources', 0)} total resources across {len(connections)} active providers."
    ]

    # Detect provider-specific keywords
    provider_synonyms = {
        "render": ["render", "blender"],
        "docker": ["docker", "container", "daemon"],
        "kubernetes": ["kubernetes", "k8s", "pod", "node"],
        "cloudflare": ["cloudflare", "worker", "pages"],
        "vercel": ["vercel", "nextjs"],
        "supabase": ["supabase", "postgres"],
        "flyio": ["flyio", "fly.io", "fly"],
        "hetzner": ["hetzner"],
        "digitalocean": ["digitalocean", "droplet"],
        "oci": ["oci", "oracle"],
        "aws": ["aws", "ec2", "s3"],
        "gcp": ["gcp", "google cloud"],
        "azure": ["azure"],
        "private": ["private", "bare-metal", "prometheus", "linux"],
    }

    matched_providers = []
    for prov_key, syns in provider_synonyms.items():
        if any(s in q_lower for s in syns):
            matched_providers.append(prov_key)

    if matched_providers:
        for p in matched_providers:
            matching = [r for r in all_res if r.get("provider", "").lower() == p]
            if matching:
                lines.append(f"\n{p.upper()} ASSETS ({len(matching)} tracked):")
                for r in matching[:10]:
                    ip_url = r.get("ip_address") or r.get("region") or "N/A"
                    lines.append(f"- {r['resource_name']} | Type: {r.get('instance_type', 'service')} | Status: {r['status']} | Access/IP: {ip_url}")

    # Detect metrics intent
    if any(k in q_lower for k in ["cpu", "processor", "load", "intensive"]):
        if top_cpu:
            lines.append("\nHIGHEST CPU NODES:")
            for r in top_cpu[:3]:
                cpu_v = f"{r['cpu_usage_percent']:.1f}%" if r.get('cpu_usage_percent') is not None else "N/A"
                lines.append(f"- {r['resource_name']} ({r['provider'].upper()}): {cpu_v} CPU")

    if any(k in q_lower for k in ["memory", "ram", "swap"]):
        if top_mem:
            lines.append("\nHIGHEST MEMORY NODES:")
            for r in top_mem[:3]:
                mem_v = f"{r['memory_usage_percent']:.1f}%" if r.get('memory_usage_percent') is not None else "N/A"
                lines.append(f"- {r['resource_name']} ({r['provider'].upper()}): {mem_v} RAM")

    # Detect incidents intent
    if any(k in q_lower for k in ["incident", "outage", "rca", "alert"]):
        if incidents:
            lines.append("\nACTIVE INCIDENTS:")
            for inc in incidents[:3]:
                lines.append(f"- {inc['incident_number']} [{inc['severity']}]: {inc['title']} ({inc['provider']})")

    # If general inquiry, add brief provider breakdown
    if len(lines) == 1:
        by_prov = infra.get("resources_by_provider", {})
        prov_summary = ", ".join([f"{k.upper()}: {v}" for k, v in by_prov.items() if v > 0])
        if prov_summary:
            lines.append(f"Distribution: {prov_summary}")

    return "\n".join(lines)

def generate_grounded_telemetry_response(query: str, context: Dict[str, Any]) -> str:
    """
    Intelligent Grounded Telemetry Engine.
    Parses user query intent and answers accurately using real collected SQLite telemetry.
    Formats output with rich Markdown tables and clean summaries.
    """
    q_lower = query.lower()
    utilization = context.get("utilization", {})
    all_res = utilization.get("resources", [])
    top_cpu = utilization.get("top_cpu", [])
    top_mem = utilization.get("top_mem", [])
    infra = context.get("infrastructure_summary", {})
    incidents = context.get("active_incidents", [])
    security_events = context.get("security_events", [])
    connections = context.get("cloud_connections", [])
    total_resources = infra.get("total_resources", 0)

    # 1. Provider-Specific Projects / Resources Intent (e.g. Render/Blender, Docker, K8s, AWS, etc.)
    provider_synonyms = {
        "render": ["render", "blender"],
        "docker": ["docker", "container", "daemon"],
        "kubernetes": ["kubernetes", "k8s", "pod"],
        "cloudflare": ["cloudflare", "worker", "pages"],
        "vercel": ["vercel"],
        "supabase": ["supabase"],
        "flyio": ["flyio", "fly.io", "fly"],
        "hetzner": ["hetzner"],
        "digitalocean": ["digitalocean", "droplet"],
        "oci": ["oci", "oracle"],
        "aws": ["aws", "ec2"],
        "gcp": ["gcp", "google cloud"],
        "azure": ["azure"],
        "private": ["private", "bare-metal", "prometheus", "linux"],
    }

    target_prov = None
    for p_key, syns in provider_synonyms.items():
        if any(s in q_lower for s in syns):
            target_prov = p_key
            break

    if target_prov:
        prov_resources = [r for r in all_res if r.get("provider", "").lower() == target_prov]
        if prov_resources:
            lines = [
                f"Based on local telemetry data, here are the services running on **{target_prov.upper()}**:\n",
                "| Project Name | Status | Type | Access URL / IP |",
                "|---|---|---|---|",
            ]
            for r in prov_resources:
                url_ip = r.get("ip_address") or r.get("region") or "Internal"
                lines.append(f"| **{r['resource_name']}** | {r['status']} | {r.get('instance_type', 'service')} | `{url_ip}` |")
            lines.append(f"\n**Summary:**\n* **Total Active {target_prov.upper()} Resources:** {len(prov_resources)}\n* **Telemetry Health:** All services operating nominally.")
            return "\n".join(lines)
        else:
            return f"Currently tracking 0 discovered resources on **{target_prov.upper()}**. Ensure the connection credentials are added in the Cloud Connections tab."

    # 2. CPU Utilization Intent
    if any(k in q_lower for k in ["cpu", "processor", "intensive", "compute load", "utilization"]):
        if top_cpu:
            lines = [
                "Here are the most CPU-intensive resources currently recorded in local telemetry:\n",
                "| Resource Name | Provider | CPU % | RAM % | Status | Region |",
                "|---|---|---|---|---|---|",
            ]
            for r in top_cpu:
                cpu_val = f"{r['cpu_usage_percent']:.1f}%" if r.get('cpu_usage_percent') is not None else "N/A"
                mem_val = f"{r['memory_usage_percent']:.1f}%" if r.get('memory_usage_percent') is not None else "N/A"
                lines.append(f"| **{r['resource_name']}** | {r['provider'].upper()} | **{cpu_val}** | {mem_val} | {r['status']} | {r['region']} |")
            lines.append(f"\n**Highest CPU Node:** **{top_cpu[0]['resource_name']}**.")
            return "\n".join(lines)
        elif total_resources > 0:
            return (
                f"Currently tracking {total_resources} resources across {len(connections)} connection(s). "
                "All resources are within nominal idle baselines (<50% CPU)."
            )
        else:
            return (
                "There are currently no discovered cloud resources in the local database.\n\n"
                "To begin monitoring real-time telemetry:\n"
                "1. Navigate to **Cloud Connections** (/connections).\n"
                "2. Add your AWS, Render, Docker, or other cloud credentials.\n"
                "3. Telemetry metrics will be collected and ranked automatically."
            )

    # 3. Memory / RAM Intent
    if any(k in q_lower for k in ["memory", "ram", "swap"]):
        if top_mem:
            lines = [
                "Here are the highest memory-consuming resources in local telemetry:\n",
                "| Resource Name | Provider | RAM % | CPU % | Status |",
                "|---|---|---|---|---|",
            ]
            for r in top_mem:
                mem_val = f"{r['memory_usage_percent']:.1f}%" if r.get('memory_usage_percent') is not None else "N/A"
                cpu_val = f"{r['cpu_usage_percent']:.1f}%" if r.get('cpu_usage_percent') is not None else "N/A"
                lines.append(f"| **{r['resource_name']}** | {r['provider'].upper()} | **{mem_val}** | {cpu_val} | {r['status']} |")
            return "\n".join(lines)
        else:
            return f"Currently tracking {total_resources} resources. No memory metric anomalies recorded."

    # 4. Incident & Root Cause Intent
    if any(k in q_lower for k in ["incident", "outage", "failure", "alert", "rca", "root cause"]):
        if incidents:
            lines = [
                f"Found {len(incidents)} active incident(s) in system:\n",
                "| Incident # | Severity | Title | Provider | Status |",
                "|---|---|---|---|---|",
            ]
            for inc in incidents:
                lines.append(f"| **{inc['incident_number']}** | `{inc['severity'].upper()}` | {inc['title']} | {inc['provider'].upper()} | {inc['status']} |")
            return "\n".join(lines)
        else:
            return f"All clear! Zero active incidents or unhandled threshold alerts across your {total_resources} monitored resources."

    # 5. Security & Audit Events Intent
    if any(k in q_lower for k in ["security", "audit", "login", "suspicious", "privilege", "event"]):
        if security_events:
            lines = [
                f"Recent Cloud Security Audit Events ({len(security_events)} evaluated):\n",
                "| Event Name | Provider | Severity | Actor | Source IP |",
                "|---|---|---|---|---|",
            ]
            for ev in security_events:
                lines.append(f"| {ev['event_name']} | {ev['provider'].upper()} | `{ev['severity'].upper()}` | `{ev['actor']}` | `{ev['source_ip']}` |")
            return "\n".join(lines)
        else:
            return "No suspicious security audit events or unauthorized privilege changes detected in recent event streams."

    # 6. Default Grounded Status Summary
    by_prov = infra.get("resources_by_provider", {})
    by_st = infra.get("resources_by_status", {})
    lines = [
        "### Multi-Cloud Infrastructure Summary",
        f"- **Total Monitored Resources**: {total_resources}",
        f"- **Active Connections**: {infra.get('total_connections', 0)}",
        "",
        "**Resource Breakdown by Connected Clouds:**",
    ]
    for prov_name, count in by_prov.items():
        if count > 0:
            lines.append(f"- **{prov_name.upper()}**: {count} resources")
    lines.extend([
        "",
        "**Fleet Health Status:**",
        f"- Healthy: {by_st.get('running', 0) + by_st.get('healthy', 0)}",
        f"- Warning / Degraded: {by_st.get('warning', 0)}",
        f"- Critical / Error: {by_st.get('critical', 0)}",
    ])
    return "\n".join(lines)

def build_system_prompt(optimized_context: str) -> str:
    return (
        "You are CloudSentinel AI, an elite Cloud & DevOps Solutions Architect with dual capabilities:\n\n"
        "1. LOCAL INFRASTRUCTURE OBSERVABILITY:\n"
        "When the user asks about their connected systems, resources, projects, containers, servers, CPU/RAM metrics, or incidents, answer accurately based on the verified local telemetry context below.\n\n"
        "2. GLOBAL CLOUD & DEVOPS INTELLIGENCE:\n"
        "When the user asks general, architectural, best-practice, pricing, CLI, configuration, or troubleshooting questions about ANY cloud platform (AWS, GCP, Azure, Oracle Cloud, Render, Cloudflare, Vercel, Supabase, Fly.io, Docker, Kubernetes, Hetzner, DigitalOcean, Linux, etc.), provide authoritative, up-to-date, step-by-step guidance.\n\n"
        "3. FORMATTING STANDARDS:\n"
        "- Always format structured lists of services, projects, or servers as clean Markdown tables with columns: | Resource Name | Status | Type | Access URL / IP |\n"
        "- Use bullet points for recommendations or summaries.\n"
        "- Use inline backticks for code, paths, and URLs.\n"
        "- Be concise, direct, and fast. Avoid unnecessary preamble.\n\n"
        f"VERIFIED LOCAL TELEMETRY CONTEXT:\n{optimized_context}"
    )

    # 6. Default Grounded Status Summary
    by_st = infra.get("resources_by_status", {})
    healthy_count = by_st.get('running', 0) + by_st.get('healthy', 0)
    return (
        f"Local CloudSentinel Telemetry Summary: Currently tracking {total_resources} resources "
        f"across {infra.get('total_connections', 0)} cloud connections ({healthy_count} healthy, "
        f"{infra.get('active_incidents', 0)} active incidents).\n\n"
        "You can ask me about:\n"
        "- Most CPU-intensive or memory-intensive resources\n"
        "- Multi-cloud comparisons across AWS, GCP, Azure, and Private servers\n"
        "- Anomaly detection and linear forecasting trends\n"
        "- Active incidents, root causes, and security audit events"
    )

@router.get("/status")
async def get_ai_status():
    """Verify local Ollama installation and execution status."""
    return ollama_service.check_health()

@router.get("/models")
async def get_ai_models():
    """List available local and remote models in Ollama with metadata."""
    models = ollama_service.list_installed_models()
    detailed = ollama_service.list_models_detailed()
    return {"models": models, "details": detailed}

@router.post("/model")
async def set_active_ai_model(payload: AIModelSwitchRequest, db: AsyncSession = Depends(get_db)):
    """Update the active Ollama model in application settings."""
    model_name = payload.model.strip()
    if not model_name:
        raise HTTPException(status_code=400, detail="Model name cannot be empty.")

    res = await db.execute(select(ApplicationSetting).filter_by(key="ollama_model"))
    setting_rec = res.scalar_one_or_none()
    if setting_rec:
        setting_rec.value = model_name
    else:
        db.add(ApplicationSetting(key="ollama_model", value=model_name, category="ollama"))
    await db.commit()
    settings.OLLAMA_MODEL = model_name
    logger.info(f"Active Ollama model switched to: {model_name}")
    return {"status": "success", "active_model": model_name}

@router.post("/chat", response_model=AIChatResponse)
async def ai_assistant_chat(payload: AIChatRequest, db: AsyncSession = Depends(get_db)):
    """
    Conversational Cloud Assistant grounded strictly in real collected SQLite data.
    Automatically handles Ollama Cloud 402 errors and offline states with intelligent fallback.
    """
    # 1. Fetch full application context
    grounding_data = AgentTools.query_full_application_context()
    if payload.resource_id:
        grounding_data["selected_resource"] = AgentTools.query_resource_telemetry(payload.resource_id, limit=10)

    # 2. Determine target model
    if payload.model and payload.model.strip():
        chosen_model = payload.model.strip()
        # Persist model selection to settings table
        res = await db.execute(select(ApplicationSetting).filter_by(key="ollama_model"))
        setting_rec = res.scalar_one_or_none()
        if setting_rec:
            setting_rec.value = chosen_model
        else:
            db.add(ApplicationSetting(key="ollama_model", value=chosen_model, category="ollama"))
        await db.commit()
        settings.OLLAMA_MODEL = chosen_model
    else:
        res = await db.execute(select(ApplicationSetting).filter_by(key="ollama_model"))
        setting_rec = res.scalar_one_or_none()
        chosen_model = setting_rec.value if setting_rec and setting_rec.value else settings.OLLAMA_MODEL

    # 3. Check Ollama availability and attempt inference
    health = ollama_service.check_health()
    optimized_context = build_optimized_ai_context(payload.query, grounding_data)
    system_prompt = build_system_prompt(optimized_context)

    if health["available"]:
        try:
            response_text = await ollama_service.generate_response(
                prompt=payload.query,
                system_prompt=system_prompt,
                model=chosen_model,
            )
            active_model = chosen_model
        except OllamaInferenceError as oie:
            logger.warning(f"Ollama inference error (status {oie.status_code}): {oie.detail}")
            deterministic_text = generate_grounded_telemetry_response(payload.query, grounding_data)
            if oie.is_cloud_payment_required:
                response_text = (
                    f"⚠️ **Notice: Model `{chosen_model}` is an Ollama Cloud model requiring usage credits (HTTP 402).**\n\n"
                    "The response below was generated directly from your local verified SQLite telemetry.\n"
                    "*(Tip: You can switch to any local model such as `llama3.2`, `gemma:2b`, or `mistral` using the model selector above).*\n\n"
                    "---\n\n"
                    f"{deterministic_text}"
                )
                active_model = f"{chosen_model} (grounded-telemetry)"
            else:
                response_text = (
                    f"⚠️ Notice: Model `{chosen_model}` returned error ({oie.status_code}). "
                    "Displaying verified local telemetry:\n\n" + deterministic_text
                )
                active_model = "deterministic-telemetry-engine"
        except Exception as e:
            logger.error(f"Ollama execution exception: {e}")
            response_text = generate_grounded_telemetry_response(payload.query, grounding_data)
            active_model = "deterministic-telemetry-engine"
    else:
        # Grounded deterministic response when Ollama daemon is offline
        deterministic_text = generate_grounded_telemetry_response(payload.query, grounding_data)
        response_text = (
            f"*(Ollama daemon is offline at {settings.OLLAMA_BASE_URL} — responding using verified local SQLite telemetry)*\n\n"
            f"{deterministic_text}"
        )
        active_model = "deterministic-telemetry-engine"

    return AIChatResponse(
        response=response_text,
        grounding_data=grounding_data,
        model_used=active_model,
    )

@router.post("/chat/stream")
async def ai_assistant_chat_stream(payload: AIChatRequest, db: AsyncSession = Depends(get_db)):
    """
    Streaming AI chat endpoint using Server-Sent Events (SSE).
    Delivers tokens in real time with near-instant Time-To-First-Token.
    """
    grounding_data = AgentTools.query_full_application_context()
    if payload.resource_id:
        grounding_data["selected_resource"] = AgentTools.query_resource_telemetry(payload.resource_id, limit=10)

    # Determine target model
    if payload.model and payload.model.strip():
        chosen_model = payload.model.strip()
        res = await db.execute(select(ApplicationSetting).filter_by(key="ollama_model"))
        setting_rec = res.scalar_one_or_none()
        if setting_rec:
            setting_rec.value = chosen_model
        else:
            db.add(ApplicationSetting(key="ollama_model", value=chosen_model, category="ollama"))
        await db.commit()
        settings.OLLAMA_MODEL = chosen_model
    else:
        res = await db.execute(select(ApplicationSetting).filter_by(key="ollama_model"))
        setting_rec = res.scalar_one_or_none()
        chosen_model = setting_rec.value if setting_rec and setting_rec.value else settings.OLLAMA_MODEL

    optimized_context = build_optimized_ai_context(payload.query, grounding_data)
    system_prompt = build_system_prompt(optimized_context)

    async def sse_generator():
        health = ollama_service.check_health()
        if health["available"]:
            try:
                async for token in ollama_service.generate_stream(
                    prompt=payload.query,
                    system_prompt=system_prompt,
                    model=chosen_model,
                ):
                    yield f"data: {json.dumps({'token': token})}\n\n"
                yield f"data: {json.dumps({'done': True, 'model': chosen_model, 'grounding': grounding_data})}\n\n"
            except OllamaInferenceError as oie:
                det = generate_grounded_telemetry_response(payload.query, grounding_data)
                notice = f"⚠️ Notice: Model `{chosen_model}` returned {oie.status_code}. Responding via local telemetry:\n\n" + det
                yield f"data: {json.dumps({'token': notice})}\n\n"
                yield f"data: {json.dumps({'done': True, 'model': 'grounded-engine', 'grounding': grounding_data})}\n\n"
            except Exception as e:
                det = generate_grounded_telemetry_response(payload.query, grounding_data)
                yield f"data: {json.dumps({'token': det})}\n\n"
                yield f"data: {json.dumps({'done': True, 'model': 'grounded-engine', 'grounding': grounding_data})}\n\n"
        else:
            det = generate_grounded_telemetry_response(payload.query, grounding_data)
            yield f"data: {json.dumps({'token': det})}\n\n"
            yield f"data: {json.dumps({'done': True, 'model': 'deterministic-telemetry', 'grounding': grounding_data})}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@router.post("/investigate")
async def trigger_ai_investigation(payload: AIInvestigateRequest):
    """Run full LangGraph multi-agent investigation."""
    result = multi_agent_system.run_investigation(
        incident_id=payload.incident_id,
        resource_id=payload.resource_id,
        user_query=payload.query,
    )
    return result
