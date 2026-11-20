# Ollama Setup & Configuration Guide

**CloudSentinel AI** uses local LLM inference powered by [Ollama](https://ollama.ai/). No cloud API keys, paid subscriptions, or external network access are required for AI features.

---

## 1. Installing Ollama

### Windows
1. Download the Windows installer from [https://ollama.ai/download/windows](https://ollama.ai/download/windows).
2. Run `OllamaSetup.exe` and follow the on-screen prompts.
3. Ollama will start automatically and sit in the system tray, binding to `http://127.0.0.1:11434`.

### macOS
1. Download from [https://ollama.ai/download/mac](https://ollama.ai/download/mac) or install via Homebrew:
   ```bash
   brew install ollama
   ```
2. Start the service:
   ```bash
   brew services start ollama
   ```

### Linux
1. Run the official install script:
   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   ```
2. Ensure the systemd service is active:
   ```bash
   sudo systemctl enable --now ollama
   ```

---

## 2. Recommended Models

CloudSentinel AI works with any tool-capable local model available through Ollama. We recommend:

| Model | Size | RAM Requirement | Best For |
|---|---|---|---|
| `llama3.2:3b` | 2.0 GB | 4 GB+ | Fast responses, low resource usage |
| `mistral:7b` | 4.1 GB | 8 GB+ | Balanced analysis and detailed RCA |
| `llama3.1:8b` | 4.7 GB | 8 GB+ | Complex multi-step agent reasoning |
| `qwen2.5:7b` | 4.5 GB | 8 GB+ | Strong telemetry and structured output |

To pull your chosen model, open a terminal and run:
```bash
ollama pull llama3.2
# or
ollama pull mistral
```

---

## 3. Verifying Local Ollama Status

Check that Ollama is listening locally:
```bash
curl http://127.0.0.1:11434/api/tags
```
Expected output: A JSON object containing an array of installed models.

---

## 4. Configuring CloudSentinel AI

In the CloudSentinel AI desktop application:
1. Navigate to **Settings** (`/settings`).
2. Under the **AI & Ollama Configuration** section:
   - **Ollama Host URL**: Set to `http://127.0.0.1:11434` (default).
   - **Model Selection**: Select from discovered models (e.g., `llama3.2`, `mistral`).
   - Click **Check Connection** to verify health and latency.
3. If Ollama is offline or uninstalled:
   - CloudSentinel AI will display an **OLLAMA OFFLINE** status badge in the header.
   - Core monitoring, metrics ingestion, threshold alerts, and Scikit-learn anomaly detection continue running with zero interruption.
   - Incident investigations fallback to deterministic rule-based analysis.
