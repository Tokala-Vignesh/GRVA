import sqlite3
import pytest
from app.core.config import settings
from app.database.init_db import init_database

def test_database_initialization():
    init_database()
    assert settings.DB_FILE.exists(), "Database file must exist"
    
    conn = sqlite3.connect(settings.DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = [row[0] for row in cursor.fetchall()]
    
    expected_tables = [
        "alerts",
        "application_settings",
        "audit_logs",
        "cloud_connections",
        "cloud_resource_metadata",
        "cloud_resources",
        "collection_jobs",
        "cost_records",
        "incident_investigations",
        "incidents",
        "infrastructure_metrics",
        "ml_model_metadata",
        "remediation_actions",
        "resource_metric_aggregates",
        "security_events",
        "user_preferences",
    ]
    
    for table in expected_tables:
        assert table in tables, f"Expected table '{table}' to be created"
        
    cursor.execute("PRAGMA journal_mode;")
    mode = cursor.fetchone()[0]
    assert mode.lower() == "wal", f"Expected WAL mode, got {mode}"
    
    conn.close()

if __name__ == "__main__":
    test_database_initialization()
    print("Database initialization test PASSED successfully!")
