import secrets
from fastapi import Request, HTTPException, status, Security
from fastapi.security import APIKeyHeader
from app.core.config import settings

API_TOKEN_HEADER = APIKeyHeader(name="X-CloudSentinel-Token", auto_error=False)

def verify_token(api_token: str | None = Security(API_TOKEN_HEADER)) -> str:
    """
    Validate that the incoming request contains the correct dynamic application token.
    Uses secrets.compare_digest to prevent timing-analysis attacks.
    """
    if not api_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing required authentication header: X-CloudSentinel-Token",
        )
    
    if not secrets.compare_digest(api_token, settings.API_TOKEN):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )
    
    return api_token
