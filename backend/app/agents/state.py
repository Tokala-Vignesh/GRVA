from typing import TypedDict, List, Dict, Any, Optional, Annotated
import operator

class AgentFinding(TypedDict):
    agent_name: str
    summary: str
    details: Dict[str, Any]
    confidence: float # 0.0 to 1.0

class ProposedRemediation(TypedDict):
    action_type: str # 'restart_service', 'restart_container', 'send_notification', 'recommend_resize'
    target_resource_id: str
    target_name: str
    parameters: Dict[str, Any]
    risk_level: str # 'low', 'medium', 'high'
    approved: bool
    executed: bool
    execution_result: Optional[str]

class MultiAgentState(TypedDict):
    # Context
    incident_id: Optional[str]
    resource_id: Optional[str]
    user_query: Optional[str]

    # Shared telemetry & findings
    telemetry_data: Dict[str, Any]
    agent_findings: Annotated[List[AgentFinding], operator.add]
    
    # Root Cause & Remediation
    root_cause_analysis: Optional[str]
    root_cause_confidence: float
    proposed_remediations: List[ProposedRemediation]

    # Workflow Control
    next_agent: Optional[str]
    is_complete: bool
    error: Optional[str]
    final_response: Optional[str]
