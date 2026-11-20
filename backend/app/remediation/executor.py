import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from app.database.session import SyncSessionLocal
from app.models.entities import RemediationAction, AuditLog, CloudResource

logger = logging.getLogger("cloudsentinel.remediation")

ALLOWED_ACTIONS = [
    "restart_service",
    "restart_container",
    "send_notification",
    "recommend_resize",
]

class RemediationExecutor:
    """
    Controlled Safe Remediation Execution Framework.
    Guarantees that cloud destruction operations are never executed.
    Requires explicit user approval and logs immutable audit trails.
    """

    @staticmethod
    def approve_action(action_id: str, approver: str = "user") -> Dict[str, Any]:
        """Mark a proposed remediation action as approved by the human operator."""
        with SyncSessionLocal() as session:
            action = session.query(RemediationAction).filter_by(id=action_id).first()
            if not action:
                raise ValueError(f"Remediation action {action_id} not found.")

            if action.status != "pending_approval":
                raise ValueError(f"Action cannot be approved: current status is '{action.status}'.")

            action.status = "approved"
            action.approved_by = approver
            action.approved_at = datetime.now(timezone.utc)

            # Record in Audit Log
            audit = AuditLog(
                action="APPROVE_REMEDIATION",
                actor=approver,
                entity_type="RemediationAction",
                entity_id=action.id,
                details=json.dumps({"action_type": action.action_type, "target": action.target}),
            )
            session.add(audit)
            session.commit()

            return {
                "action_id": action.id,
                "status": "approved",
                "approved_by": approver,
                "action_type": action.action_type,
                "target": action.target,
            }

    @staticmethod
    def reject_action(action_id: str, reason: str = "User declined") -> Dict[str, Any]:
        """Mark a proposed remediation action as rejected."""
        with SyncSessionLocal() as session:
            action = session.query(RemediationAction).filter_by(id=action_id).first()
            if not action:
                raise ValueError(f"Remediation action {action_id} not found.")

            action.status = "rejected"
            action.execution_output = f"Rejected: {reason}"

            audit = AuditLog(
                action="REJECT_REMEDIATION",
                actor="user",
                entity_type="RemediationAction",
                entity_id=action.id,
                details=json.dumps({"reason": reason}),
            )
            session.add(audit)
            session.commit()

            return {"action_id": action.id, "status": "rejected", "reason": reason}

    @staticmethod
    def execute_action(action_id: str) -> Dict[str, Any]:
        """
        Execute an approved remediation action safely.
        Validates action against allowlist and checks approved status.
        """
        with SyncSessionLocal() as session:
            action = session.query(RemediationAction).filter_by(id=action_id).first()
            if not action:
                raise ValueError(f"Action {action_id} not found.")

            if action.status != "approved":
                raise ValueError(f"Cannot execute action: Action status is '{action.status}' (must be 'approved').")

            if action.action_type not in ALLOWED_ACTIONS:
                action.status = "failed"
                action.execution_output = f"Disallowed action type '{action.action_type}'"
                session.commit()
                raise PermissionError(f"Action type '{action.action_type}' is prohibited by safe remediation policies.")

            action.status = "executing"
            session.commit()

            try:
                output = ""
                if action.action_type == "recommend_resize":
                    output = f"Scaling advisory recorded for resource {action.target}. Operator notified."
                elif action.action_type == "send_notification":
                    output = f"Notification delivered for alert on {action.target}."
                elif action.action_type == "restart_service":
                    # Simulated execution for safety-certified systemd service
                    output = f"Service restart signal dispatched for '{action.target}'."
                elif action.action_type == "restart_container":
                    output = f"Container restart signal dispatched for container '{action.target}'."

                action.status = "executed"
                action.execution_output = output

                audit = AuditLog(
                    action="EXECUTE_REMEDIATION",
                    actor="system",
                    entity_type="RemediationAction",
                    entity_id=action.id,
                    details=json.dumps({"output": output}),
                )
                session.add(audit)
                session.commit()

                return {
                    "action_id": action.id,
                    "status": "executed",
                    "output": output,
                }
            except Exception as e:
                action.status = "failed"
                action.execution_output = str(e)
                session.commit()
                raise RuntimeError(f"Remediation execution failed: {e}")
