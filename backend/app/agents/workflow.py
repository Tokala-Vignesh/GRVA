import json
import uuid
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.sqlite import SqliteSaver
import sqlite3
from app.core.config import settings
from app.database.session import SyncSessionLocal
from app.models.entities import AuditLog, SecurityEvent, CloudResource
from app.agents.state import MultiAgentState, AgentFinding, ProposedRemediation
from app.agents.tools import AgentTools
from app.services.ollama_service import ollama_service

logger = logging.getLogger("cloudsentinel.agents.workflow")

class CloudSentinelMultiAgentSystem:
    """
    Supervisor-Coordinated LangGraph Multi-Agent Architecture with 7 Domain Agents
    and SQLite Checkpoint Persistence.
    """

    def __init__(self):
        self.graph = self._build_graph()

    def _build_graph(self):
        workflow = StateGraph(MultiAgentState)

        # Register Agent Nodes
        workflow.add_node("supervisor", self.node_supervisor)
        workflow.add_node("monitoring_agent", self.node_monitoring_agent)
        workflow.add_node("anomaly_agent", self.node_anomaly_agent)
        workflow.add_node("prediction_agent", self.node_prediction_agent)
        workflow.add_node("log_agent", self.node_log_agent)
        workflow.add_node("security_agent", self.node_security_agent)
        workflow.add_node("root_cause_agent", self.node_root_cause_agent)
        workflow.add_node("remediation_agent", self.node_remediation_agent)

        # Set Entry Point
        workflow.set_entry_point("supervisor")

        # Supervisor conditional routing
        workflow.add_conditional_edges(
            "supervisor",
            lambda state: state.get("next_agent", END),
            {
                "monitoring_agent": "monitoring_agent",
                "anomaly_agent": "anomaly_agent",
                "prediction_agent": "prediction_agent",
                "log_agent": "log_agent",
                "security_agent": "security_agent",
                "root_cause_agent": "root_cause_agent",
                "remediation_agent": "remediation_agent",
                END: END,
            }
        )

        # Each specialist node returns to supervisor
        workflow.add_edge("monitoring_agent", "supervisor")
        workflow.add_edge("anomaly_agent", "supervisor")
        workflow.add_edge("prediction_agent", "supervisor")
        workflow.add_edge("log_agent", "supervisor")
        workflow.add_edge("security_agent", "supervisor")
        workflow.add_edge("root_cause_agent", "supervisor")
        workflow.add_edge("remediation_agent", "supervisor")

        # SQLite Checkpointer
        settings.LANGGRAPH_DB_FILE.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(settings.LANGGRAPH_DB_FILE), check_same_thread=False)
        checkpointer = SqliteSaver(conn)

        # Compile graph
        return workflow.compile(
            checkpointer=checkpointer,
            interrupt_before=["remediation_agent"],
        )

    # ================= Node Implementations =================

    def node_supervisor(self, state: MultiAgentState) -> Dict[str, Any]:
        """Supervisor coordinating specialists and routing next actions."""
        findings = state.get("agent_findings", [])
        completed_agents = [f["agent_name"] for f in findings]

        if "InfrastructureMonitoringAgent" not in completed_agents:
            return {"next_agent": "monitoring_agent"}
        elif "AnomalyDetectionAgent" not in completed_agents:
            return {"next_agent": "anomaly_agent"}
        elif "PredictiveAnalysisAgent" not in completed_agents:
            return {"next_agent": "prediction_agent"}
        elif "SecurityIntelligenceAgent" not in completed_agents:
            return {"next_agent": "security_agent"}
        elif "RootCauseAnalysisAgent" not in completed_agents:
            return {"next_agent": "root_cause_agent"}
        elif "RemediationAgent" not in completed_agents and state.get("root_cause_analysis"):
            return {"next_agent": "remediation_agent"}
        else:
            return {"next_agent": END, "is_complete": True}

    def node_monitoring_agent(self, state: MultiAgentState) -> Dict[str, Any]:
        """Agent 1: Infrastructure Monitoring Specialist."""
        resource_id = state.get("resource_id")
        if resource_id:
            telemetry = AgentTools.query_resource_telemetry(resource_id)
        else:
            telemetry = AgentTools.query_infrastructure_status()

        summary = f"Retrieved telemetry: {telemetry.get('metrics_sample_count', 0)} metric samples collected."
        finding: AgentFinding = {
            "agent_name": "InfrastructureMonitoringAgent",
            "summary": summary,
            "details": telemetry,
            "confidence": 0.95,
        }
        return {
            "telemetry_data": telemetry,
            "agent_findings": [finding],
        }

    def node_anomaly_agent(self, state: MultiAgentState) -> Dict[str, Any]:
        """Agent 2: Machine Learning Anomaly Detection Specialist."""
        resource_id = state.get("resource_id")
        result = {}
        if resource_id:
            result = AgentTools.invoke_ml_anomaly_detector(resource_id)

        is_anomaly = result.get("is_anomaly", False)
        score = result.get("anomaly_score", 0.0)
        summary = (
            f"Isolation Forest Analysis: {'ANOMALY DETECTED' if is_anomaly else 'Nominal baseline'}. "
            f"Score: {score:.3f}, Severity: {result.get('severity', 'normal')}"
        )
        finding: AgentFinding = {
            "agent_name": "AnomalyDetectionAgent",
            "summary": summary,
            "details": result,
            "confidence": 0.90 if result.get("status") == "analyzed" else 0.50,
        }
        return {"agent_findings": [finding]}

    def node_prediction_agent(self, state: MultiAgentState) -> Dict[str, Any]:
        """Agent 3: Predictive Forecasting Specialist."""
        resource_id = state.get("resource_id")
        forecast = {}
        if resource_id:
            forecast = AgentTools.invoke_predictive_forecaster(resource_id, "cpu_usage_percent")

        trend = forecast.get("trend_direction", "unknown")
        exhaustion = forecast.get("exhaustion_threshold_hours")
        summary = f"Forecaster trend: {trend.upper()}."
        if exhaustion:
            summary += f" Critical threshold reached in ~{exhaustion} hours."

        finding: AgentFinding = {
            "agent_name": "PredictiveAnalysisAgent",
            "summary": summary,
            "details": forecast,
            "confidence": 0.85 if forecast.get("status") == "forecasted" else 0.40,
        }
        return {"agent_findings": [forecast] if False else [finding]}

    def node_log_agent(self, state: MultiAgentState) -> Dict[str, Any]:
        """Agent 4: Log Analysis Specialist."""
        with SyncSessionLocal() as session:
            audit_logs = session.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(20).all()
            security_events = session.query(SecurityEvent).order_by(SecurityEvent.occurred_at.desc()).limit(10).all()

            error_count = sum(1 for e in security_events if e.severity in ("critical", "high"))
            summary = (
                f"Log inspection evaluated {len(audit_logs)} audit records and {len(security_events)} security event streams. "
                f"High-severity anomalies: {error_count}."
            )
            finding: AgentFinding = {
                "agent_name": "LogAnalysisAgent",
                "summary": summary,
                "details": {
                    "audit_records_analyzed": len(audit_logs),
                    "security_events_analyzed": len(security_events),
                    "high_severity_events": error_count,
                    "recent_actions": [log.action for log in audit_logs[:5]],
                },
                "confidence": 0.88,
            }
            return {"agent_findings": [finding]}

    def node_security_agent(self, state: MultiAgentState) -> Dict[str, Any]:
        """Agent 5: Security Intelligence Specialist."""
        events = AgentTools.query_security_audit_events(limit=5)
        summary = f"Security Intelligence: {len(events)} recent cloud audit events evaluated."
        finding: AgentFinding = {
            "agent_name": "SecurityIntelligenceAgent",
            "summary": summary,
            "details": {"events": events},
            "confidence": 0.90,
        }
        return {"agent_findings": [finding]}

    def node_root_cause_agent(self, state: MultiAgentState) -> Dict[str, Any]:
        """Agent 6: Root Cause Synthesis Specialist."""
        findings = state.get("agent_findings", [])
        telemetry = state.get("telemetry_data", {})
        resource_id = state.get("resource_id") or "Target Resource"

        # Dynamically synthesize from actual specialist agent findings
        anomaly_finding = next((f for f in findings if f.get("agent_name") == "AnomalyDetectionAgent"), None)
        monitoring_finding = next((f for f in findings if f.get("agent_name") == "InfrastructureMonitoringAgent"), None)
        security_finding = next((f for f in findings if f.get("agent_name") == "SecurityIntelligenceAgent"), None)

        is_anomaly = anomaly_finding and anomaly_finding.get("details", {}).get("is_anomaly", False)
        sec_events = security_finding.get("details", {}).get("events", []) if security_finding else []

        synthesis_parts = []
        if is_anomaly:
            score = anomaly_finding["details"].get("anomaly_score", 0.0)
            synthesis_parts.append(
                f"Multi-Agent Root Cause Synthesis for {resource_id}: "
                f"Isolation Forest identified a multivariate anomaly (Anomaly Score: {score:.3f}). "
                f"Resource telemetry exhibits significant deviation from the historical baseline."
            )
        else:
            synthesis_parts.append(
                f"Multi-Agent Health Assessment for {resource_id}: "
                f"Isolation Forest model reports nominal baseline telemetry behavior with no metric anomalies."
            )

        if sec_events:
            synthesis_parts.append(f"Security Intelligence detected {len(sec_events)} correlated audit event(s) in the evaluation window.")
        else:
            synthesis_parts.append("No unauthorized security events, privilege escalations, or policy violations detected.")

        analysis_text = "\n".join(synthesis_parts)
        confidence = 0.90 if is_anomaly else 0.85

        finding: AgentFinding = {
            "agent_name": "RootCauseAnalysisAgent",
            "summary": "Correlated metric anomalies, time-series telemetry, and security audit logs.",
            "details": {"synthesis": analysis_text, "correlated_anomaly": is_anomaly},
            "confidence": confidence,
        }
        return {
            "root_cause_analysis": analysis_text,
            "root_cause_confidence": confidence,
            "agent_findings": [finding],
        }

    def node_remediation_agent(self, state: MultiAgentState) -> Dict[str, Any]:
        """Agent 7: Safe Controlled Remediation Specialist (Requires Human Approval)."""
        incident_id = state.get("incident_id")
        resource_id = state.get("resource_id") or "unknown"

        provider = "cloud"
        with SyncSessionLocal() as session:
            res = session.query(CloudResource).filter(
                (CloudResource.id == resource_id) | (CloudResource.resource_id == resource_id)
            ).first()
            if res:
                provider = res.provider

        if provider == "private":
            action_type = "restart_service"
            params = {"service_name": "node_exporter", "instruction": "Restart systemd monitoring agent"}
        else:
            action_type = "recommend_resize"
            params = {"suggested_action": f"Evaluate compute instance resize or auto-scaling trigger on {provider.upper()}"}

        proposal = AgentTools.propose_remediation_action(
            incident_id=incident_id,
            resource_id=resource_id,
            action_type=action_type,
            target=resource_id,
            parameters=params,
            risk_level="low",
        )

        remediation_item: ProposedRemediation = {
            "action_type": action_type,
            "target_resource_id": resource_id,
            "target_name": res.resource_name if (res and res.resource_name) else resource_id,
            "parameters": {"proposal": proposal},
            "risk_level": "low",
            "approved": False,
            "executed": False,
            "execution_result": None,
        }

        finding: AgentFinding = {
            "agent_name": "RemediationAgent",
            "summary": f"Generated safe {action_type} proposal. Awaiting explicit user approval.",
            "details": proposal,
            "confidence": 0.95,
        }

        return {
            "proposed_remediations": [remediation_item],
            "agent_findings": [finding],
            "final_response": "Investigation complete. Root cause identified and safe remediation proposed.",
            "is_complete": True,
        }

    def run_investigation(
        self,
        incident_id: Optional[str] = None,
        resource_id: Optional[str] = None,
        user_query: Optional[str] = None,
        thread_id: Optional[str] = None,
    ) -> MultiAgentState:
        """Execute the multi-agent investigation workflow synchronously."""
        initial_state: MultiAgentState = {
            "incident_id": incident_id,
            "resource_id": resource_id,
            "user_query": user_query,
            "telemetry_data": {},
            "agent_findings": [],
            "root_cause_analysis": None,
            "root_cause_confidence": 0.0,
            "proposed_remediations": [],
            "next_agent": None,
            "is_complete": False,
            "error": None,
            "final_response": None,
        }

        active_thread = thread_id or f"{incident_id or 'inv'}-{uuid.uuid4().hex[:8]}"
        config = {"configurable": {"thread_id": active_thread}}

        final_state = self.graph.invoke(initial_state, config=config)
        return final_state

multi_agent_system = CloudSentinelMultiAgentSystem()
