from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database.session import get_db
from app.security.auth import verify_token
from app.models.entities import RemediationAction
from app.schemas.api import RemediationResponse
from app.remediation.executor import RemediationExecutor

router = APIRouter(prefix="/remediation", tags=["Safe Remediation"], dependencies=[Depends(verify_token)])

@router.get("/actions", response_model=List[RemediationResponse])
async def list_remediation_actions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RemediationAction).order_by(desc(RemediationAction.created_at)))
    return result.scalars().all()

@router.post("/{action_id}/approve")
async def approve_remediation_action(action_id: str):
    """Approve and trigger safe remediation action."""
    try:
        appr_res = RemediationExecutor.approve_action(action_id, approver="desktop_user")
        exec_res = RemediationExecutor.execute_action(action_id)
        return {
            "status": "success",
            "approval": appr_res,
            "execution": exec_res,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{action_id}/reject")
async def reject_remediation_action(action_id: str):
    try:
        res = RemediationExecutor.reject_action(action_id, reason="User rejected recommendation")
        return {"status": "success", "rejection": res}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
