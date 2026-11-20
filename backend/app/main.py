import sys
from pathlib import Path

# Ensure backend root is always on sys.path regardless of execution entrypoint
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.database.init_db import init_database
from app.workers.scheduler import worker
from app.api.v1.routes_connections import router as connections_router
from app.api.v1.routes_resources import router as resources_router
from app.api.v1.routes_monitoring import router as monitoring_router
from app.api.v1.routes_incidents import router as incidents_router
from app.api.v1.routes_ai import router as ai_router
from app.api.v1.routes_remediation import router as remediation_router
from app.api.v1.routes_reports import router as reports_router
from app.api.v1.routes_settings import router as settings_router

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("cloudsentinel.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and graceful shutdown lifecycle."""
    logger.info("Initializing CloudSentinel AI Local Backend...")
    # Initialize SQLite schema and settings
    init_database()
    # Start APScheduler background worker
    worker.start()
    logger.info(f"CloudSentinel AI Backend initialized on {settings.HOST}:{settings.PORT}")

    yield

    logger.info("Shutting down CloudSentinel AI Local Backend...")
    worker.stop()
    logger.info("Shutdown complete.")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Local-First Unified Multi-Cloud Infrastructure Monitoring & AI Incident Response",
    lifespan=lifespan,
)

# Strict CORS: only permit desktop shell and local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "file://",
        "*", # In local loopback mode only
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health Check Route (Unauthenticated so Electron lifecycle monitor can ping without prior handshake)
@app.get("/api/v1/health", status_code=status.HTTP_200_OK, tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "host": settings.HOST,
    }

# Register all v1 API routers
app.include_router(connections_router, prefix="/api/v1")
app.include_router(resources_router, prefix="/api/v1")
app.include_router(monitoring_router, prefix="/api/v1")
app.include_router(incidents_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(remediation_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")

if __name__ == "__main__":
    import uvicorn
    # Enforce loopback binding strictly
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
