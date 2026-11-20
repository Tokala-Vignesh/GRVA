# Database Specification & Management Guide

## 1. Overview

**CloudSentinel AI** uses local **SQLite** databases stored strictly on the user's computer. There are no remote database servers or cloud-hosted telemetry stores.

### Database Files
1. **`cloudsentinel.db`**: Primary application database storing cloud connections, resource inventory, normalized time-series metrics, alerts, incidents, security events, audit logs, and user preferences.
2. **`langgraph.db`**: Dedicated checkpoint database for LangGraph multi-agent conversational states and workflow threads, isolated to minimize lock contention.

---

## 2. Storage Directory Resolution

Database files reside in the operating system's standard application data directory:
- **Windows**: `%LOCALAPPDATA%\CloudSentinelAI\` (e.g., `C:\Users\<user>\AppData\Local\CloudSentinelAI\`)
- **macOS**: `~/Library/Application Support/CloudSentinelAI/`
- **Linux**: `~/.config/CloudSentinelAI/` (or `$XDG_DATA_HOME/CloudSentinelAI/`)
- **Development/Sandbox Fallback**: Local project `data/` directory if OS AppData is not writable.

---

## 3. High-Concurrency SQLite Configuration

The database engine (`aiosqlite` with SQLAlchemy 2.0) enforces high-throughput concurrent settings on every connection:

```sql
PRAGMA journal_mode = WAL;         -- Write-Ahead Logging for non-blocking concurrent reads
PRAGMA synchronous = NORMAL;       -- Balances durability with high-throughput writes
PRAGMA foreign_keys = ON;          -- Strict relational integrity enforcement
PRAGMA busy_timeout = 20000;       -- Wait up to 20 seconds for locks to resolve before failing
PRAGMA temp_store = MEMORY;        -- Store temporary tables and indices in RAM
```

---

## 4. Complete Relational Schema (16 Tables)

| Table Name | Primary Key | Description | Key Indexes |
|---|---|---|---|
| `cloud_connections` | `id` (UUID) | Configured cloud accounts (AWS, GCP, Azure, Private) | `provider`, `status` |
| `cloud_resources` | `id` (UUID) | Discovered compute instances, VMs, disks, servers | `connection_id`, `provider`, `resource_type`, `status` |
| `infrastructure_metrics` | `id` (UUID) | Normalized time-series telemetry samples | `(resource_id, timestamp)`, `(metric_name, timestamp)` |
| `resource_metric_aggregates` | `id` (UUID) | Hourly and daily statistical rollups (min, max, avg) | `(resource_id, period_start, period_type)` |
| `alerts` | `id` (UUID) | Triggered threshold and ML anomaly alerts | `(resource_id, status)`, `severity` |
| `incidents` | `id` (UUID) | High-level incident dossiers grouping related alerts | `status`, `severity`, `created_at` |
| `incident_investigations` | `id` (UUID) | Multi-agent investigation reports & hypothesis chains | `incident_id` |
| `remediation_actions` | `id` (UUID) | Safe remediation proposals and execution logs | `incident_id`, `status` |
| `security_events` | `id` (UUID) | IAM changes, abnormal regions, public security group detections | `connection_id`, `event_type`, `severity` |
| `cost_records` | `id` (UUID) | Cloud billing and cost trend records | `connection_id`, `billing_period` |
| `collection_jobs` | `id` (UUID) | Background collection job execution logs | `connection_id`, `status` |
| `user_preferences` | `id` (UUID) | UI theme, refresh intervals, notification preferences | `key` |
| `application_settings` | `id` (UUID) | Ollama host, retention days, active log level | `key` |
| `audit_logs` | `id` (UUID) | Tamper-evident log of all user and agent actions | `action`, `actor`, `created_at` |
| `ml_model_metadata` | `id` (UUID) | Isolation Forest model parameters and training timestamps | `resource_id`, `model_type` |
| `cloud_resource_metadata` | `id` (UUID) | Dynamic provider-specific tags and configurations | `resource_id`, `key` |

---

## 5. Backup, Restore & Data Retention

### Automated Backup
Users can export a complete compressed snapshot via **Settings -> Database Backup**:
- Creates a timestamped `.db.gz` file.
- Uses SQLite's online backup API to ensure consistent snapshots even during active background writes.

### Safe Restore
- Prior to restoring any backup, CloudSentinel AI creates an automatic safety pre-snapshot of the active database.
- Database connections are closed, WAL journals flushed, and the snapshot extracted.

### Retention Policy
- Raw metrics (`infrastructure_metrics`) are retained for 30 days by default (configurable up to 365 days).
- A daily background worker runs at 03:00 UTC to compute hourly/daily rollups into `resource_metric_aggregates` and prune expired raw rows.
