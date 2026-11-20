import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.session import get_db
from app.security.auth import verify_token
from app.models.entities import CloudConnection, CloudResource, CollectionJob
from app.credentials.vault import vault
from app.cloud.factory import get_cloud_connector
from app.schemas.api import (
    AWSConnectionCreate,
    GCPConnectionCreate,
    AzureConnectionCreate,
    PrivateConnectionCreate,
    ConnectionResponse,
)

router = APIRouter(prefix="/connections", tags=["Cloud Connections"], dependencies=[Depends(verify_token)])

@router.get("", response_model=List[ConnectionResponse])
async def list_connections(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CloudConnection).order_by(CloudConnection.created_at.desc()))
    return result.scalars().all()

@router.post("/aws", response_model=ConnectionResponse)
async def create_aws_connection(payload: AWSConnectionCreate, db: AsyncSession = Depends(get_db)):
    cred_ref = f"aws_{uuid.uuid4().hex[:12]}"
    secrets = {
        "aws_access_key_id": payload.aws_access_key_id,
        "aws_secret_access_key": payload.aws_secret_access_key,
        "aws_session_token": payload.aws_session_token,
        "role_arn": payload.role_arn,
        "region": payload.region,
    }
    vault.set_credentials(cred_ref, secrets)

    # Validate credentials
    conn_id = str(uuid.uuid4())
    account_id = "unknown"
    status_str = "unverified"
    try:
        connector = get_cloud_connector("aws", conn_id, payload.name, secrets)
        val = connector.validate_credentials()
        account_id = val.get("account_id", "unknown")
        status_str = "connected"
    except Exception as e:
        status_str = "error"

    now = datetime.now(timezone.utc)
    new_conn = CloudConnection(
        id=conn_id,
        name=payload.name,
        provider="aws",
        account_id=account_id,
        credential_ref=cred_ref,
        region=payload.region,
        status=status_str,
        last_verified_at=now if status_str == "connected" else None,
        created_at=now,
        updated_at=now,
    )
    db.add(new_conn)
    await db.commit()
    await db.refresh(new_conn)
    return new_conn

@router.post("/gcp", response_model=ConnectionResponse)
async def create_gcp_connection(payload: GCPConnectionCreate, db: AsyncSession = Depends(get_db)):
    cred_ref = f"gcp_{uuid.uuid4().hex[:12]}"
    secrets = {
        "project_id": payload.project_id,
        "service_account_json": payload.service_account_json,
        "service_account_file": payload.service_account_file,
        "region": payload.region,
    }
    vault.set_credentials(cred_ref, secrets)

    conn_id = str(uuid.uuid4())
    status_str = "unverified"
    try:
        connector = get_cloud_connector("gcp", conn_id, payload.name, secrets)
        connector.validate_credentials()
        status_str = "connected"
    except Exception:
        status_str = "error"

    now = datetime.now(timezone.utc)
    new_conn = CloudConnection(
        id=conn_id,
        name=payload.name,
        provider="gcp",
        account_id=payload.project_id,
        credential_ref=cred_ref,
        region=payload.region,
        status=status_str,
        last_verified_at=now if status_str == "connected" else None,
        created_at=now,
        updated_at=now,
    )
    db.add(new_conn)
    await db.commit()
    await db.refresh(new_conn)
    return new_conn

@router.post("/azure", response_model=ConnectionResponse)
async def create_azure_connection(payload: AzureConnectionCreate, db: AsyncSession = Depends(get_db)):
    cred_ref = f"azure_{uuid.uuid4().hex[:12]}"
    secrets = {
        "subscription_id": payload.subscription_id,
        "tenant_id": payload.tenant_id,
        "client_id": payload.client_id,
        "client_secret": payload.client_secret,
        "region": payload.region,
    }
    vault.set_credentials(cred_ref, secrets)

    conn_id = str(uuid.uuid4())
    status_str = "unverified"
    try:
        connector = get_cloud_connector("azure", conn_id, payload.name, secrets)
        connector.validate_credentials()
        status_str = "connected"
    except Exception:
        status_str = "error"

    now = datetime.now(timezone.utc)
    new_conn = CloudConnection(
        id=conn_id,
        name=payload.name,
        provider="azure",
        account_id=payload.subscription_id,
        credential_ref=cred_ref,
        region=payload.region,
        status=status_str,
        last_verified_at=now if status_str == "connected" else None,
        created_at=now,
        updated_at=now,
    )
    db.add(new_conn)
    await db.commit()
    await db.refresh(new_conn)
    return new_conn

@router.post("/private", response_model=ConnectionResponse)
async def create_private_connection(payload: PrivateConnectionCreate, db: AsyncSession = Depends(get_db)):
    cred_ref = f"priv_{uuid.uuid4().hex[:12]}"
    secrets = {
        "endpoint_url": payload.endpoint_url,
        "auth_token": payload.auth_token,
        "host_name": payload.host_name or payload.name,
        "region": payload.region,
    }
    vault.set_credentials(cred_ref, secrets)

    conn_id = str(uuid.uuid4())
    status_str = "connected"
    now = datetime.now(timezone.utc)
    new_conn = CloudConnection(
        id=conn_id,
        name=payload.name,
        provider="private",
        account_id=payload.endpoint_url,
        credential_ref=cred_ref,
        region=payload.region,
        status=status_str,
        last_verified_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(new_conn)
    await db.commit()
    await db.refresh(new_conn)
    return new_conn

@router.post("/{conn_id}/test")
async def test_connection(conn_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CloudConnection).filter_by(id=conn_id))
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    creds = vault.get_credentials(conn.credential_ref)
    if not creds:
        raise HTTPException(status_code=400, detail="Credentials missing in vault")

    try:
        connector = get_cloud_connector(conn.provider, conn.id, conn.name, creds)
        val = connector.validate_credentials()
        conn.status = "connected"
        conn.last_verified_at = datetime.now(timezone.utc)
        await db.commit()
        return {"status": "success", "details": val}
    except Exception as e:
        conn.status = "error"
        await db.commit()
        return {"status": "error", "error": str(e)}

@router.post("/{conn_id}/sync")
async def sync_connection(conn_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CloudConnection).filter_by(id=conn_id))
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    import threading
    from app.workers.scheduler import worker
    threading.Thread(target=worker.job_resource_discovery, daemon=True).start()
    return {"status": "sync_started", "connection_id": conn_id}

@router.delete("/{conn_id}")
async def delete_connection(conn_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CloudConnection).filter_by(id=conn_id))
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    vault.delete_credentials(conn.credential_ref)
    await db.delete(conn)
    await db.commit()
    return {"status": "deleted", "connection_id": conn_id}
