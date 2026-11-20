import os
from pathlib import Path
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

# Ensure parent directory for database exists
settings.DB_FILE.parent.mkdir(parents=True, exist_ok=True)

# SQLite URLs
ASYNC_DB_URL = f"sqlite+aiosqlite:///{settings.DB_FILE.as_posix()}"
SYNC_DB_URL = f"sqlite:///{settings.DB_FILE.as_posix()}"

# Async Engine for FastAPI async request cycle
async_engine = create_async_engine(
    ASYNC_DB_URL,
    echo=settings.DEBUG,
    connect_args={
        "timeout": 20.0, # 20 second busy timeout
    },
)

# Synchronous Engine for APScheduler background worker threads and migrations
sync_engine = create_engine(
    SYNC_DB_URL,
    echo=settings.DEBUG,
    connect_args={
        "timeout": 20.0,
    },
)

# SQLite PRAGMAs: Enable WAL mode and foreign key enforcement on every connection
@event.listens_for(sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA synchronous = NORMAL;")
    cursor.execute("PRAGMA busy_timeout = 20000;")
    cursor.execute("PRAGMA foreign_keys = ON;")
    cursor.close()

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    class_=Session,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for obtaining an asynchronous database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

def get_sync_db() -> Session:
    """Helper for obtaining a synchronous database session (for workers & scripts)."""
    return SyncSessionLocal()
