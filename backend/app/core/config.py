import os
import sys
import secrets
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Ensure loopback traffic is never routed through external/sandbox proxies
if not os.environ.get("NO_PROXY"):
    os.environ["NO_PROXY"] = "127.0.0.1,localhost"
elif "127.0.0.1" not in os.environ["NO_PROXY"]:
    os.environ["NO_PROXY"] += ",127.0.0.1,localhost"
os.environ["no_proxy"] = os.environ["NO_PROXY"]

def get_default_app_data_dir() -> Path:
  """Get platform-appropriate application data directory with fallback for sandboxed environments."""
  env_override = os.getenv("CLOUDSENTINEL_DATA_DIR")
  if env_override:
    p = Path(env_override)
    p.mkdir(parents=True, exist_ok=True)
    return p

  candidates = []
  if sys.platform == "win32":
    base = os.getenv("LOCALAPPDATA")
    if base:
      candidates.append(Path(base) / "CloudSentinelAI")
    candidates.append(Path.home() / "AppData" / "Local" / "CloudSentinelAI")
  elif sys.platform == "darwin":
    candidates.append(
        Path.home() / "Library" / "Application Support" / "CloudSentinelAI"
    )
  else:
    candidates.append(Path.home() / ".local" / "share" / "cloudsentinel")

  app_data_env = os.getenv("APPDATA_DIR") or os.getenv("ANTIGRAVITY_APP_DATA")
  if app_data_env:
    candidates.append(Path(app_data_env) / "CloudSentinelAI")

  candidates.append(Path.cwd() / "data")

  for candidate in candidates:
    try:
      candidate.mkdir(parents=True, exist_ok=True)
      test_file = candidate / ".write_test"
      test_file.write_text("ok")
      test_file.unlink()
      return candidate
    except (PermissionError, OSError):
      continue

  fallback = Path.cwd() / "data"
  fallback.mkdir(parents=True, exist_ok=True)
  return fallback

class Settings(BaseSettings):
  model_config = SettingsConfigDict(env_file=".env", extra="ignore")

  APP_NAME: str = "CloudSentinel AI"
  APP_VERSION: str = "1.0.0"
  DEBUG: bool = False

  # Server loopback binding (STRICT: 127.0.0.1 only)
  HOST: str = "127.0.0.1"
  PORT: int = 8765

  # Per-session dynamic API authentication token
  API_TOKEN: str = Field(default_factory=lambda: os.getenv("CLOUDSENTINEL_TOKEN") or secrets.token_urlsafe(32), validation_alias="CLOUDSENTINEL_TOKEN")

  # Storage directories in OS AppData or fallback
  DATA_DIR: Path = get_default_app_data_dir()

  @property
  def DB_FILE(self) -> Path:
    custom = os.getenv("CLOUDSENTINEL_DB_PATH")
    if custom:
      return Path(custom)
    return self.DATA_DIR / "cloudsentinel.db"

  @property
  def LANGGRAPH_DB_FILE(self) -> Path:
    custom = os.getenv("LANGGRAPH_DB_PATH")
    if custom:
      return Path(custom)
    return self.DATA_DIR / "langgraph.db"

  @property
  def MODELS_DIR(self) -> Path:
    p = self.DATA_DIR / "models"
    p.mkdir(parents=True, exist_ok=True)
    return p

  @property
  def REPORTS_DIR(self) -> Path:
    p = self.DATA_DIR / "reports"
    p.mkdir(parents=True, exist_ok=True)
    return p

  @property
  def BACKUPS_DIR(self) -> Path:
    p = self.DATA_DIR / "backups"
    p.mkdir(parents=True, exist_ok=True)
    return p

  # Local Ollama AI Engine
  OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
  OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.2")
  OLLAMA_REQUEST_TIMEOUT: float = 60.0

  # Monitoring Intervals (in seconds)
  DISCOVERY_INTERVAL_SECONDS: int = int(os.getenv("DISCOVERY_INTERVAL_SECONDS", "900")) # 15 minutes
  METRICS_INTERVAL_SECONDS: int = int(os.getenv("METRICS_INTERVAL_SECONDS", "300"))     # 5 minutes
  PRIVATE_HOST_INTERVAL_SECONDS: int = int(os.getenv("PRIVATE_HOST_INTERVAL_SECONDS", "60")) # 60 seconds
  ALERT_INTERVAL_SECONDS: int = int(os.getenv("ALERT_INTERVAL_SECONDS", "60"))         # 60 seconds

  # Data Retention
  METRIC_RETENTION_DAYS: int = 30
  AUDIT_LOG_RETENTION_DAYS: int = 90

settings = Settings()
