from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.session import get_db
from app.security.auth import verify_token
from app.models.entities import ApplicationSetting
from app.schemas.api import SettingsUpdate
from app.services.backup_service import BackupService
from app.credentials.vault import vault

router = APIRouter(prefix="/settings", tags=["Application Settings"], dependencies=[Depends(verify_token)])

@router.get("")
async def get_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ApplicationSetting))
    settings_records = result.scalars().all()
    out = {}
    for s in settings_records:
        out[s.key] = s.value
    
    out["vault_backend"] = vault.backend_name
    out["is_os_keyring"] = str(vault.is_using_os_keyring)
    return out

@router.patch("")
async def update_settings(payload: SettingsUpdate, db: AsyncSession = Depends(get_db)):
    for k, v in payload.settings.items():
        res = await db.execute(select(ApplicationSetting).filter_by(key=k))
        record = res.scalar_one_or_none()
        if record:
            record.value = str(v)
        else:
            db.add(ApplicationSetting(key=k, value=str(v), category="general"))
    await db.commit()
    return {"status": "updated", "count": len(payload.settings)}

@router.post("/backup")
async def create_backup():
    try:
        res = BackupService.create_database_backup()
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/restore")
async def restore_backup(backup_path: str = Body(..., embed=True)):
    try:
        res = BackupService.restore_database_backup(backup_path)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
