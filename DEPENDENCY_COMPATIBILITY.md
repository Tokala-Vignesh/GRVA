# CloudSentinel AI — Dependency & Compatibility Matrix

## 1. Runtime Environment Verification

| Component | Target Version | Detected Host Environment | Status | Compatibility Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Operating System** | Windows 10/11 x64, macOS 12+, Linux x64 | Windows 11 x64 | Supported | Native Windows Credential Manager supported via Python `keyring` |
| **Python** | 3.12+ (3.12.x / 3.13.x) | 3.13.14 | Verified | Fully compatible with FastAPI, SQLAlchemy 2.0, Boto3, Google Cloud, Azure SDK, LangGraph |
| **Node.js** | 20.x+ | 26.5.1 | Verified | Compatible with Vite 5/6, React 18/19, Electron 30+ |
| **Package Manager** | npm 10+ / pnpm | npm 11.17.0 | Verified | Fast package resolution and offline caching supported |
| **Ollama** | 0.1.30+ | Local Daemon (127.0.0.1:11434) | Optional/Dynamic | Checked at runtime; system functions smoothly without Ollama |

---

## 2. Python Backend Dependencies

### Core Framework & Networking
- `fastapi >= 0.111.0`: High-performance asynchronous REST API framework
- `uvicorn >= 0.30.0`: ASGI server for FastAPI binding to 127.0.0.1
- `pydantic >= 2.8.0`: High-speed data validation and serialization
- `httpx >= 0.27.0`: Asynchronous HTTP client for provider health checks and Ollama REST calls

### Database & Storage
- `sqlalchemy >= 2.0.30`: Modern asynchronous ORM layer
- `aiosqlite >= 0.20.0`: Async SQLite driver for non-blocking I/O
- `alembic >= 1.13.0`: Database schema migration framework
- `keyring >= 25.0.0`: OS-native credential storage (Windows Credential Manager / macOS Keychain / Linux Secret Service)
- `cryptography >= 42.0.0`: Authenticated AES-256-GCM encryption for fallback vault

### Cloud Providers SDKs
- `boto3 >= 1.34.0`, `botocore >= 1.34.0`: AWS SDK (STS, EC2, CloudWatch, CloudWatch Logs, Cost Explorer)
- `google-cloud-compute >= 1.18.0`, `google-cloud-monitoring >= 2.20.0`, `google-cloud-logging >= 3.10.0`: Google Cloud Platform SDKs
- `azure-identity >= 1.16.0`, `azure-mgmt-compute >= 30.6.0`, `azure-mgmt-resource >= 23.1.0`, `azure-monitor-query >= 1.3.0`: Azure SDKs

### Background Processing & Scheduling
- `apscheduler >= 3.10.4`: Robust background scheduler for periodic discovery and metric pulling

### Machine Learning & Analytics
- `scikit-learn >= 1.4.0`: Isolation Forest for multivariate anomaly detection
- `numpy >= 1.26.0`, `scipy >= 1.13.0`: Numerical matrix operations and statistical calculations
- `statsmodels >= 0.14.0`: Time-series forecasting and trend decomposition
- `reportlab >= 4.1.0`: PDF report generation

### Multi-Agent & Local AI
- `langgraph >= 0.2.0`: Multi-agent state graph orchestration with human-in-the-loop approval gates
- `langchain-core >= 0.2.0`: Core abstractions for tools, messages, and runnables
- `langchain-ollama >= 0.1.0`: Native Ollama integration for local models
- `langgraph-checkpoint-sqlite >= 1.0.0`: SQLite-backed persistent state checkpointing

---

## 3. Desktop & Frontend Dependencies

### Electron Desktop Shell (`desktop/`)
- `electron >= 31.0.0`: Cross-platform desktop runtime
- `electron-builder >= 24.13.0`: Multi-platform application packaging and installer creation

### React Frontend (`frontend/`)
- `react >= 18.3.0`, `react-dom >= 18.3.0`: Modern React with concurrent rendering
- `vite >= 5.3.0`: High-speed development bundler and HMR
- `typescript >= 5.4.0`: Static type safety across entire frontend
- `tailwindcss >= 3.4.0`, `postcss`, `autoprefixer`: Enterprise dark-themed styling
- `lucide-react >= 0.390.0`: Observability icons
- `react-router-dom >= 6.23.0`: Client-side single-page routing
- `@tanstack/react-query >= 5.40.0`: Server-state caching and periodic re-polling
- `recharts >= 2.12.0`: Interactive multi-metric time-series visualizations
- `clsx`, `tailwind-merge`: Dynamic utility classes
