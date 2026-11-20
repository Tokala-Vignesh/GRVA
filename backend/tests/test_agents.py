import pytest
from app.agents.tools import AgentTools
from app.agents.workflow import multi_agent_system
from app.database.init_db import init_database

def test_agent_tools_execution():
    init_database()
    status = AgentTools.query_infrastructure_status()
    assert "total_connections" in status
    assert "total_resources" in status
    assert "resources_by_provider" in status

    events = AgentTools.query_security_audit_events(limit=5)
    assert isinstance(events, list)

def test_multi_agent_investigation_workflow():
    init_database()
    result = multi_agent_system.run_investigation(
        incident_id="INC-TEST-001",
        resource_id="res-test-instance",
        user_query="Investigate elevated CPU consumption",
    )

    assert result is not None
    findings = result.get("agent_findings", [])
    assert len(findings) >= 4, f"Expected multiple specialist agent findings, got {len(findings)}"
    
    agent_names = [f["agent_name"] for f in findings]
    assert "InfrastructureMonitoringAgent" in agent_names
    assert "AnomalyDetectionAgent" in agent_names
    assert "PredictiveAnalysisAgent" in agent_names
    assert "RootCauseAnalysisAgent" in agent_names
    assert result.get("root_cause_analysis") is not None
