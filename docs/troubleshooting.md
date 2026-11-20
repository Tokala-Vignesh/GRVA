# Troubleshooting & Operational Guide

## 1. Common Issues & Diagnostics

### Issue A: "Ollama Offline" in Application Header
* **Symptom**: The top header badge indicates `OLLAMA OFFLINE` with an amber warning.
* **Root Cause**: The local Ollama daemon is not running on `http://127.0.0.1:11434` or has not been installed yet.
* **Resolution**:
  1. Open a terminal and check if Ollama is running:
     ```bash
     curl http://127.0.0.1:11434/api/tags
     ```
  2. If not running, start Ollama:
     - **Windows**: Search for "Ollama" in Start Menu and launch it.
     - **macOS**: `brew services start ollama` or launch Ollama from Applications.
     - **Linux**: `sudo systemctl start ollama`
  3. Pull at least one supported model:
     ```bash
     ollama pull llama3.2
     ```
  4. In CloudSentinel AI, navigate to **Settings** and click **Check Connection**.
* **Impact**: Core monitoring, metric charts, alerts, and Scikit-learn anomaly detection continue operating normally. Incident investigations will use deterministic rule-based analysis until Ollama is online.

---

### Issue B: "Vault: Encrypted Local File" Instead of "OS Keyring"
* **Symptom**: The header vault badge shows `Encrypted Local File` instead of `OS Keyring`.
* **Root Cause**: The operating system's native secret service is temporarily unavailable or running in a headless / containerized environment where DBus / Windows Credential Manager cannot be contacted.
* **Security Assurance**: CloudSentinel AI automatically activates its PBKDF2-HMAC-SHA256 + AES-256-GCM encrypted file vault. No secrets are ever stored in plain text.
* **Resolution (if native keyring is desired)**:
  - On Linux: Ensure `dbus-x11` and `gnome-keyring` or `ksecretservice` are installed and unlocked in your user session.
  - On Windows/macOS: Ensure the user session has standard desktop permissions to access Windows Credential Manager or macOS Keychain.

---

### Issue C: CloudWatch Metrics Show "AGENT REQUIRED"
* **Symptom**: Memory and Disk utilization metrics for an AWS EC2 instance display an "AGENT REQUIRED" pill in the Metrics Explorer.
* **Root Cause**: Standard AWS CloudWatch provides hypervisor-level metrics (`CPUUtilization`, `NetworkIn`, `DiskReadOps`, `StatusCheckFailed`). Memory utilization and filesystem metrics are OS-level metrics and require the CloudWatch Agent.
* **Architecture Integrity**: CloudSentinel AI strictly follows rule 7 and **never fabricates or substitutes missing memory metrics with zero**.
* **Resolution**:
  1. Install the official CloudWatch Unified Agent on the EC2 instance.
  2. Configure the agent to send `mem_used_percent` and `disk_used_percent` under the `CWAgent` namespace.
  3. CloudSentinel AI will automatically detect and graph these metrics on the next collection cycle.

---

### Issue D: Azure Authentication or Subscription Errors
* **Symptom**: Testing Azure connection fails with `AuthenticationFailed` or `SubscriptionNotFound`.
* **Root Cause**: The Service Principal credentials (`AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`) lack reader permissions on the target subscription.
* **Resolution**:
  1. In the Azure Portal, navigate to **Subscriptions** -> select your subscription -> **Access control (IAM)**.
  2. Assign the **Reader** role to the App Registration (Service Principal).
  3. Re-test the connection in CloudSentinel AI.

---

### Issue E: Database Lock or Timeout Errors
* **Symptom**: Log message mentions `sqlite3.OperationalError: database is locked`.
* **Root Cause**: A long-running synchronous transaction conflicted with an active background collector write.
* **Mitigation Already Applied**:
  - CloudSentinel AI enables **Write-Ahead Logging (WAL)** mode.
  - Connection `busy_timeout` is set to 20,000 ms (20 seconds).
  - LangGraph conversational checkpoints are isolated in `langgraph.db` to prevent contention with `cloudsentinel.db`.
* **Resolution**: If an external utility is locking the database file, close SQLite browser tools inspecting `%LOCALAPPDATA%\CloudSentinelAI\cloudsentinel.db`.
