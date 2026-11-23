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
    OCIConnectionCreate,
    DigitalOceanConnectionCreate,
    HetznerConnectionCreate,
    RenderConnectionCreate,
    CloudflareConnectionCreate,
    VercelConnectionCreate,
    SupabaseConnectionCreate,
    FlyioConnectionCreate,
    DockerConnectionCreate,
    KubernetesConnectionCreate,
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

    conn_id = str(uuid.uuid4())
    account_id = "unknown"
    status_str = "unverified"
    try:
        connector = get_cloud_connector("aws", conn_id, payload.name, secrets)
        val = connector.validate_credentials()
        account_id = val.get("account_id", "unknown")
        status_str = "connected"
    except Exception:
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

@router.post("/oci", response_model=ConnectionResponse)
async def create_oci_connection(payload: OCIConnectionCreate, db: AsyncSession = Depends(get_db)):
    cred_ref = f"oci_{uuid.uuid4().hex[:12]}"
    secrets = {
        "tenancy_ocid": payload.tenancy_ocid,
        "user_ocid": payload.user_ocid,
        "fingerprint": payload.fingerprint,
        "private_key": payload.private_key,
        "region": payload.region,
    }
    vault.set_credentials(cred_ref, secrets)

    conn_id = str(uuid.uuid4())
    status_str = "unverified"
    try:
        connector = get_cloud_connector("oci", conn_id, payload.name, secrets)
        connector.validate_credentials()
        status_str = "connected"
    except Exception:
        status_str = "error"

    now = datetime.now(timezone.utc)
    new_conn = CloudConnection(
        id=conn_id,
        name=payload.name,
        provider="oci",
        account_id=payload.tenancy_ocid[-12:] if len(payload.tenancy_ocid) >= 12 else payload.tenancy_ocid,
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

@router.post("/digitalocean", response_model=ConnectionResponse)
async def create_digitalocean_connection(payload: DigitalOceanConnectionCreate, db: AsyncSession = Depends(get_db)):
    cred_ref = f"do_{uuid.uuid4().hex[:12]}"
    secrets = {"api_token": payload.api_token}
    vault.set_credentials(cred_ref, secrets)

    conn_id = str(uuid.uuid4())
    status_str = "unverified"
    account_id = f"do-{payload.api_token[:8]}"
    try:
        connector = get_cloud_connector("digitalocean", conn_id, payload.name, secrets)
        val = connector.validate_credentials()
        account_id = val.get("email", account_id)
        status_str = "connected"
    except Exception:
        status_str = "error"

    now = datetime.now(timezone.utc)
    new_conn = CloudConnection(
        id=conn_id,
        name=payload.name,
        provider="digitalocean",
        account_id=account_id,
        credential_ref=cred_ref,
        region="global",
        status=status_str,
        last_verified_at=now if status_str == "connected" else None,
        created_at=now,
        updated_at=now,
    )
    db.add(new_conn)
    await db.commit()
    await db.refresh(new_conn)
    return new_conn

@router.post("/hetzner", response_model=ConnectionResponse)
async def create_hetzner_connection(payload: HetznerConnectionCreate, db: AsyncSession = Depends(get_db)):
    cred_ref = f"hz_{uuid.uuid4().hex[:12]}"
    secrets = {"api_token": payload.api_token}
    vault.set_credentials(cred_ref, secrets)

    conn_id = str(uuid.uuid4())
    status_str = "unverified"
    account_id = f"hz-{payload.api_token[:8]}"
    try:
        connector = get_cloud_connector("hetzner", conn_id, payload.name, secrets)
        connector.validate_credentials()
        status_str = "connected"
    except Exception:
        status_str = "error"

    now = datetime.now(timezone.utc)
    new_conn = CloudConnection(
        id=conn_id,
        name=payload.name,
        provider="hetzner",
        account_id=account_id,
        credential_ref=cred_ref,
        region="eu-central",
        status=status_str,
        last_verified_at=now if status_str == "connected" else None,
        created_at=now,
        updated_at=now,
    )
    db.add(new_conn)
    await db.commit()
    await db.refresh(new_conn)
    return new_conn

@router.post("/render", response_model=ConnectionResponse)
async def create_render_connection(payload: RenderConnectionCreate, db: AsyncSession = Depends(get_db)):
    cred_ref = f"render_{uuid.uuid4().hex[:12]}"
    secrets = {"api_key": payload.api_key}
    vault.set_credentials(cred_ref, secrets)

    conn_id = str(uuid.uuid4())
    status_str = "unverified"
    account_id = f"render-{payload.api_key[:8]}"
    try:
        connector = get_cloud_connector("render", conn_id, payload.name, secrets)
        val = connector.validate_credentials()
        account_id = val.get("owner_name", account_id)
        status_str = "connected"
    except Exception:
        status_str = "error"

    now = datetime.now(timezone.utc)
    new_conn = CloudConnection(
        id=conn_id,
        name=payload.name,
        provider="render",
        account_id=account_id,
        credential_ref=cred_ref,
        region="global",
        status=status_str,
        last_verified_at=now if status_str == "connected" else None,
        created_at=now,
        updated_at=now,
    )
    db.add(new_conn)
    await db.commit()
    await db.refresh(new_conn)
    return new_conn

@router.post("/cloudflare", response_model=ConnectionResponse)
async def create_cloudflare_connection(payload: CloudflareConnectionCreate, db: AsyncSession = Depends(get_db)):
    cred_ref = f"cf_{uuid.uuid4().hex[:12]}"
    secrets = {
        "api_token": payload.api_token,
        "account_id": payload.account_id,
    }
    vault.set_credentials(cred_ref, secrets)

    conn_id = str(uuid.uuid4())
    status_str = "unverified"
    try:
        connector = get_cloud_connector("cloudflare", conn_id, payload.name, secrets)
        connector.validate_credentials()
        status_str = "connected"
    except Exception:
        status_str = "error"

    now = datetime.now(timezone.utc)
    new_conn = CloudConnection(
        id=conn_id,
        name=payload.name,
        provider="cloudflare",
        account_id=payload.account_id,
        credential_ref=cred_ref,
        region="global_edge",
        status=status_str,
        last_verified_at=now if status_str == "connected" else None,
        created_at=now,
        updated_at=now,
    )
    db.add(new_conn)
    await db.commit()
    await db.refresh(new_conn)
    return new_conn

@router.post("/vercel", response_model=ConnectionResponse)
async def create_vercel_connection(payload: VercelConnectionCreate, db: AsyncSession = Depends(get_db)):
    cred_ref = f"vercel_{uuid.uuid4().hex[:12]}"
    secrets = {
        "api_token": payload.api_token,
        "team_id": payload.team_id,
    }
    vault.set_credentials(cred_ref, secrets)

    conn_id = str(uuid.uuid4())
    status_str = "unverified"
    account_id = f"vercel-{payload.api_token[:8]}"
    try:
        connector = get_cloud_connector("vercel", conn_id, payload.name, secrets)
        val = connector.validate_credentials()
        account_id = val.get("username", account_id)
        status_str = "connected"
    except Exception:
        status_str = "error"

    now = datetime.now(timezone.utc)
    new_conn = CloudConnection(
        id=conn_id,
        name=payload.name,
        provider="vercel",
        account_id=account_id,
        credential_ref=cred_ref,
        region="global_edge",
        status=status_str,
        last_verified_at=now if status_str == "connected" else None,
        created_at=now,
        updated_at=now,
    )
    db.add(new_conn)
    await db.commit()
    await db.refresh(new_conn)
    return new_conn

@router.post("/supabase", response_model=ConnectionResponse)
async def create_supabase_connection(payload: SupabaseConnectionCreate, db: AsyncSession = Depends(get_db)):
    cred_ref = f"supabase_{uuid.uuid4().hex[:12]}"
    secrets = {"api_token": payload.api_token}
    vault.set_credentials(cred_ref, secrets)

    conn_id = str(uuid.uuid4())
    status_str = "unverified"
    account_id = f"sb-{payload.api_token[:8]}"
    try:
        connector = get_cloud_connector("supabase", conn_id, payload.name, secrets)
        connector.validate_credentials()
        status_str = "connected"
    except Exception:
        status_str = "error"

    now = datetime.now(timezone.utc)
    new_conn = CloudConnection(
        id=conn_id,
        name=payload.name,
        provider="supabase",
        account_id=account_id,
        credential_ref=cred_ref,
        region="global",
        status=status_str,
        last_verified_at=now if status_str == "connected" else None,
        created_at=now,
        updated_at=now,
    )
    db.add(new_conn)
    await db.commit()
    await db.refresh(new_conn)
    return new_conn

@router.post("/flyio", response_model=ConnectionResponse)
async def create_flyio_connection(payload: FlyioConnectionCreate, db: AsyncSession = Depends(get_db)):
    cred_ref = f"fly_{uuid.uuid4().hex[:12]}"
    secrets = {"api_token": payload.api_token}
    vault.set_credentials(cred_ref, secrets)

    conn_id = str(uuid.uuid4())
    status_str = "unverified"
    account_id = f"fly-{payload.api_token[:8]}"
    try:
        connector = get_cloud_connector("flyio", conn_id, payload.name, secrets)
        connector.validate_credentials()
        status_str = "connected"
    except Exception:
        status_str = "error"

    now = datetime.now(timezone.utc)
    new_conn = CloudConnection(
        id=conn_id,
        name=payload.name,
        provider="flyio",
        account_id=account_id,
        credential_ref=cred_ref,
        region="global_anycast",
        status=status_str,
        last_verified_at=now if status_str == "connected" else None,
        created_at=now,
        updated_at=now,
    )
    db.add(new_conn)
    await db.commit()
    await db.refresh(new_conn)
    return new_conn

@router.post("/docker", response_model=ConnectionResponse)
async def create_docker_connection(payload: DockerConnectionCreate, db: AsyncSession = Depends(get_db)):
    cred_ref = f"docker_{uuid.uuid4().hex[:12]}"
    secrets = {
        "daemon_url": payload.daemon_url,
        "tls_verify": payload.tls_verify,
    }
    vault.set_credentials(cred_ref, secrets)

    conn_id = str(uuid.uuid4())
    status_str = "unverified"
    account_id = payload.daemon_url
    try:
        connector = get_cloud_connector("docker", conn_id, payload.name, secrets)
        connector.validate_credentials()
        status_str = "connected"
    except Exception:
        status_str = "error"

    now = datetime.now(timezone.utc)
    new_conn = CloudConnection(
        id=conn_id,
        name=payload.name,
        provider="docker",
        account_id=account_id,
        credential_ref=cred_ref,
        region="local_host",
        status=status_str,
        last_verified_at=now if status_str == "connected" else None,
        created_at=now,
        updated_at=now,
    )
    db.add(new_conn)
    await db.commit()
    await db.refresh(new_conn)
    return new_conn

@router.post("/kubernetes", response_model=ConnectionResponse)
async def create_kubernetes_connection(payload: KubernetesConnectionCreate, db: AsyncSession = Depends(get_db)):
    cred_ref = f"k8s_{uuid.uuid4().hex[:12]}"
    secrets = {
        "api_server_url": payload.api_server_url,
        "bearer_token": payload.bearer_token,
        "kubeconfig_content": payload.kubeconfig_content,
        "namespace": payload.namespace,
    }
    vault.set_credentials(cred_ref, secrets)

    conn_id = str(uuid.uuid4())
    status_str = "unverified"
    account_id = payload.api_server_url
    try:
        connector = get_cloud_connector("kubernetes", conn_id, payload.name, secrets)
        connector.validate_credentials()
        status_str = "connected"
    except Exception:
        status_str = "error"

    now = datetime.now(timezone.utc)
    new_conn = CloudConnection(
        id=conn_id,
        name=payload.name,
        provider="kubernetes",
        account_id=account_id,
        credential_ref=cred_ref,
        region=payload.namespace,
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
