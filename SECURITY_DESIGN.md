# CloudSentinel AI — Security & Threat Model

## 1. Local-First Security Architecture

CloudSentinel AI is designed from the ground up under a **Zero-Hosted-Trust** philosophy. Because it operates directly on the user's workstation, the security boundary is primarily focused on process isolation, secret segregation, loopback binding security, and strict human authorization.

---

## 2. Threat Model & Mitigations

### 2.1 Unauthorized Local Access to Backend API
* **Threat**: Malicious software or local processes executing under other local accounts attempting to query CloudSentinel's backend API or manipulate cloud resources.
* **Mitigations**:
  1. **Loopback Only**: FastAPI/Uvicorn is strictly bound to `127.0.0.1`. Binding to `0.0.0.0` or external network interfaces is strictly forbidden.
  2. **Ephemeral Dynamic Session Token**: On application launch, the Electron main process generates a high-entropy cryptographically secure random token (`secrets.token_urlsafe(32)`).
  3. **Mandatory Header Verification**: All backend endpoints (except `/api/v1/health`) require the `X-CloudSentinel-Token` header. Missing or mismatched tokens result in immediate `401 Unauthorized` responses.
  4. **Strict CORS**: The CORS middleware only permits requests matching the desktop shell's specific origin (`file://` or Vite's local dev port).

### 2.2 Cloud Credential Exposure
* **Threat**: Malicious processes or malicious code reading cloud API keys, access secrets, or private keys.
* **Mitigations**:
  1. **OS-Native Keyring**: Credentials are never written to disk in plain text. They are stored directly inside the operating system's native secure credential manager:
     - Windows Credential Manager (`win32cred`)
     - macOS Keychain (`Security.framework`)
     - Linux Secret Service (`freedesktop.org SecretService` via D-Bus)
  2. **Zero-Database Plaintext**: The SQLite database only stores non-sensitive metadata: account names, provider types, region identifiers, credential reference keys, and verification timestamps.
  3. **Encrypted Fallback Vault**: If OS keyring services are disabled or unavailable in headless environments, credentials are encrypted using AES-256-GCM with a PBKDF2-HMAC-SHA256 derived key.
  4. **No LLM Prompt Injection of Secrets**: Prompts constructed for Ollama and LangGraph are explicitly sanitized; cloud keys and sensitive authorization tokens are strictly filtered out before agent invocations.

### 2.3 Electron Process Sandboxing
* **Threat**: Cross-Site Scripting (XSS) or arbitrary code execution via compromised frontend dependencies.
* **Mitigations**:
  1. `contextIsolation: true`: Prevents renderer scripts from modifying prototype chains or accessing Node.js internals.
  2. `nodeIntegration: false`: Completely disables `require()`, `process`, and Node runtime APIs in the renderer.
  3. `sandbox: true`: Enables Chromium's native OS-level sandbox for the renderer process.
  4. **Strict Preload Bridge**: `preload.ts` exposes only a minimal, typed `window.cloudSentinelDesktop` interface with sanitized IPC messaging.
  5. **Content Security Policy (CSP)**:
     ```http
     default-src 'self';
     script-src 'self';
     style-src 'self' 'unsafe-inline';
     img-src 'self' data: https:;
     connect-src 'self' http://127.0.0.1:*;
     font-src 'self' data:;
     object-src 'none';
     base-uri 'self';
     form-action 'self';
     ```

### 2.4 Autonomous Destruction Protection (Safe Remediation)
* **Threat**: An LLM agent autonomously terminating instances, dropping production databases, or altering routing configurations.
* **Mitigations**:
  1. **Cloud Write Operations Disabled by Default**: All cloud connectors operate strictly in read-only audit mode for discovery and metric gathering.
  2. **Allowed Operations Whitelist**: Only safe, predefined non-destructive actions are implemented:
     - Restarting an approved private Linux systemd service.
     - Restarting an approved Docker container on a managed private node.
     - Emitting alert webhooks or local desktop notifications.
     - Generating advisory sizing recommendations (e.g. recommend upgrading instance size).
  3. **Human-in-the-Loop Interruption**: LangGraph workflows pause before any remediation action using state interrupts. A human operator must explicitly click **Approve** in the UI with full visibility into the target resource, parameters, and risk score.
  4. **Immutable Audit Trail**: All proposed, approved, rejected, and executed actions are permanently recorded in the local SQLite `remediation_actions` and `audit_logs` tables.

---

## 3. Data Privacy & Compliance
- **Zero Telemetry to Third Parties**: CloudSentinel AI does not send telemetry, analytics, crash dumps, or error logs to any external server.
- **Provider API Quota Protection**: Configurable polling intervals and exponential backoff prevent accidental rate-limiting or unexpected cloud API bill generation.
- **Complete Data Erasure**: The user can export or permanently delete their local database, model artifacts, and cached metrics at any time through the Settings page.
