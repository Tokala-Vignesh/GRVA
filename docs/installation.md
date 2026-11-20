# Installation & Getting Started Guide

## 1. System Requirements

- **Operating System**:
  - Windows 10/11 (64-bit)
  - macOS 12 (Monterey) or higher (Apple Silicon & Intel)
  - Linux (Ubuntu 20.04+, Debian 11+, Fedora 36+, Arch Linux)
- **Memory**: Minimum 4 GB RAM (8 GB+ recommended if running local Ollama LLMs)
- **Disk Space**: ~500 MB for CloudSentinel AI + ~3-5 GB per local Ollama LLM model
- **Network**: Internet access required only for direct cloud provider API calls (AWS STS/CloudWatch, GCP Monitoring, Azure Resource Manager) and local loopback access (`127.0.0.1`).

---

## 2. Desktop Installer Installation

### Windows (`.exe` / NSIS)
1. Download `CloudSentinelAI-Setup-1.0.0.exe` from the latest release.
2. Double-click the installer and follow the setup wizard.
3. Launch **CloudSentinel AI** from the Start Menu or desktop shortcut.

### macOS (`.dmg`)
1. Download `CloudSentinelAI-1.0.0.dmg`.
2. Open the DMG and drag **CloudSentinel AI** into your `/Applications` folder.
3. Launch the application from Spotlight or Launchpad.

### Linux (`.AppImage` / `.deb`)
```bash
# AppImage
chmod +x CloudSentinelAI-1.0.0.AppImage
./CloudSentinelAI-1.0.0.AppImage

# Debian/Ubuntu
sudo dpkg -i cloudsentinelai_1.0.0_amd64.deb
```

---

## 3. Running from Source (Development Mode)

If you are developing or running CloudSentinel AI from source:

### Prerequisites
- Node.js 18+ (tested on Node 20 / 22 / 26)
- Python 3.12+ (tested on Python 3.12 and 3.13)
- (Optional) [Ollama](https://ollama.ai/) for local AI investigations

### Step 1: Install Backend Dependencies
```bash
python -m pip install -r backend/requirements.txt
```

### Step 2: Install Desktop & Frontend Dependencies
```bash
# In frontend directory
cd frontend
npm install
npm run build

# In desktop directory
cd ../desktop
npm install
npm run build:ts
```

### Step 3: Run the Development Server
```bash
# Terminal 1: Run Python Backend
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8765 --reload

# Terminal 2: Run Electron Desktop
cd desktop
npm start
```

---

## 4. First-Time Setup Wizard

When you launch CloudSentinel AI for the first time:
1. **Database Initialization**: The local SQLite database schema (`cloudsentinel.db`) is automatically created and configured in WAL mode.
2. **Credential Vault Verification**: The app verifies your OS Credential Manager (Windows Credential Manager / Keychain / Secret Service).
3. **Connect a Cloud Provider**:
   - Go to **Connections** (`/connections`).
   - Click **Add Connection** and select AWS, GCP, Azure, or Private Server.
   - Enter your credentials (e.g. AWS Access Key / Secret Key or IAM Role ARN).
   - Click **Test & Save Connection**.
4. **Discover Resources**:
   - CloudSentinel AI instantly discovers compute instances, disks, and servers.
   - Background telemetry collection begins immediately on the scheduled cadence.
