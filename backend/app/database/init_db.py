import logging
from sqlalchemy import text
from app.database.session import sync_engine
from app.models.entities import Base, ApplicationSetting
from app.database.session import SyncSessionLocal

logger = logging.getLogger("cloudsentinel.database")

def init_database() -> None:
    """
    Initialize SQLite schema, tables, indexes, and initial configuration.
    Configures WAL mode, busy timeout, and foreign key enforcement.
    """
    logger.info("Initializing SQLite database tables and indexes...")
    
    # Create all tables defined in SQLAlchemy Base
    Base.metadata.create_all(bind=sync_engine)

    with sync_engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode = WAL;"))
        conn.execute(text("PRAGMA synchronous = NORMAL;"))
        conn.execute(text("PRAGMA busy_timeout = 20000;"))
        conn.execute(text("PRAGMA foreign_keys = ON;"))
        conn.commit()

    # Seed default application settings if not already present
    with SyncSessionLocal() as session:
        default_settings = [
            ("theme", "dark", "general"),
            ("discovery_interval_seconds", "900", "monitoring"),
            ("metrics_interval_seconds", "300", "monitoring"),
            ("private_host_interval_seconds", "60", "monitoring"),
            ("alert_interval_seconds", "60", "monitoring"),
            ("ollama_base_url", "http://127.0.0.1:11434", "ollama"),
            ("ollama_model", "llama3.2", "ollama"),
            ("ml_anomaly_contamination", "0.05", "ml"),
            ("ml_min_training_samples", "15", "ml"),
            ("data_retention_days", "30", "retention"),
        ]
        for key, val, cat in default_settings:
            existing = session.query(ApplicationSetting).filter_by(key=key).first()
            if not existing:
                session.add(ApplicationSetting(key=key, value=val, category=cat))
        session.commit()

    logger.info("Database schema initialized successfully.")

if __name__ == "__main__":
    init_database()
