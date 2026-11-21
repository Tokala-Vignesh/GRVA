import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';

export interface BackendConfig {
  host: string;
  port: number;
  token: string;
  dbPath?: string;
  isPackaged: boolean;
  appPath: string;
}

export class BackendManager {
  private process: ChildProcess | null = null;
  private config: BackendConfig;
  private isShuttingDown: boolean = false;

  constructor(appPath: string, isPackaged: boolean) {
    // Check environment or .env file first to ensure backend and desktop tokens match
    let token = process.env.CLOUDSENTINEL_TOKEN;
    if (!token) {
      try {
        const envFile = path.resolve(appPath, '..', '.env');
        if (fs.existsSync(envFile)) {
          const m = fs.readFileSync(envFile, 'utf-8').match(/^CLOUDSENTINEL_TOKEN=(.*)$/m);
          if (m && m[1].trim()) token = m[1].trim();
        }
      } catch {}
    }
    token = token || crypto.randomBytes(32).toString('hex');

    this.config = {
      host: '127.0.0.1',
      port: 8765,
      token,
      isPackaged,
      appPath,
    };
  }

  public getToken(): string {
    return this.config.token;
  }

  public getPort(): number {
    return this.config.port;
  }

  public getHost(): string {
    return this.config.host;
  }

  private killPortOccupant(port: number): void {
    try {
      const { execSync } = require('child_process');
      if (process.platform === 'win32') {
        try {
          const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
          const lines = out.split(/\r?\n/);
          const pidsToKill = new Set<string>();
          for (const line of lines) {
            if (line.includes('LISTENING')) {
              const parts = line.trim().split(/\s+/);
              const pid = parts[parts.length - 1];
              if (pid && pid !== '0' && pid !== process.pid.toString()) {
                pidsToKill.add(pid);
              }
            }
          }
          for (const pid of pidsToKill) {
            console.log(`[BackendManager] Terminating stale process on port ${port} (PID ${pid})...`);
            try {
              execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' });
            } catch {}
          }
        } catch {
          // No process matching port
        }
      } else {
        execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore', timeout: 5000 });
      }
    } catch {
      // Ignore if no process was running
    }
  }

  public async start(): Promise<void> {
    console.log(`[BackendManager] Ensuring port ${this.config.port} is free...`);
    this.killPortOccupant(this.config.port);
    await new Promise((resolve) => setTimeout(resolve, 800));

    console.log('[BackendManager] Initializing local backend process...');

    const dataDir = this.config.isPackaged
      ? path.join(process.env.LOCALAPPDATA || process.env.HOME || '.', 'CloudSentinelAI')
      : path.resolve(this.config.appPath, '..', 'data');

    const env = {
      ...process.env,
      NO_PROXY: process.env.NO_PROXY ? `${process.env.NO_PROXY},127.0.0.1,localhost` : '127.0.0.1,localhost',
      no_proxy: '127.0.0.1,localhost',
      CLOUDSENTINEL_HOST: this.config.host,
      CLOUDSENTINEL_PORT: this.config.port.toString(),
      CLOUDSENTINEL_TOKEN: this.config.token,
      CLOUDSENTINEL_DATA_DIR: dataDir,
      PYTHONUNBUFFERED: '1',
    };

    if (this.config.isPackaged) {
      // Packaged PyInstaller executable inside extraResources
      const backendExeName = process.platform === 'win32' ? 'cloudsentinel-backend.exe' : 'cloudsentinel-backend';
      const executablePath = path.join(process.resourcesPath, 'backend', backendExeName);

      if (!fs.existsSync(executablePath)) {
        throw new Error(`Packaged backend binary not found at: ${executablePath}`);
      }

      console.log(`[BackendManager] Spawning packaged binary: ${executablePath}`);
      this.process = spawn(executablePath, [], {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } else {
      // In development mode: spawn Python directly from the workspace
      const backendRoot = path.resolve(this.config.appPath, '..', 'backend');
      const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
      const mainScript = path.join(backendRoot, 'app', 'main.py');

      console.log(`[BackendManager] Spawning dev backend with: ${pythonExecutable} ${mainScript} in ${backendRoot}`);
      this.process = spawn(
        pythonExecutable,
        [mainScript],
        {
          cwd: backendRoot,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );
    }

    this.process.stdout?.on('data', (data) => {
      console.log(`[Backend stdout]: ${data.toString().trim()}`);
    });

    this.process.stderr?.on('data', (data) => {
      console.error(`[Backend stderr]: ${data.toString().trim()}`);
    });

    this.process.on('exit', (code, signal) => {
      console.log(`[BackendManager] Backend process exited with code ${code}, signal ${signal}`);
      if (!this.isShuttingDown) {
        console.error('[BackendManager] Backend exited unexpectedly!');
      }
      this.process = null;
    });

    // Wait for readiness (up to 60s for cold boot)
    await this.waitForHealthCheck(60, 1000);
    console.log('[BackendManager] Backend is healthy and ready.');
  }

  private async waitForHealthCheck(maxRetries: number, intervalMs: number): Promise<void> {
    const healthUrl = `http://${this.config.host}:${this.config.port}/api/v1/health`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (this.isShuttingDown) return;

      if (this.process && this.process.exitCode !== null) {
        throw new Error(`Backend process exited with code ${this.process.exitCode} before becoming healthy.`);
      }

      try {
        const isHealthy = await this.pingHealth(healthUrl);
        if (isHealthy) {
          return;
        }
      } catch (err) {
        // Backend still booting up
      }

      console.log(`[BackendManager] Waiting for backend at ${healthUrl}... (Attempt ${attempt}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Backend failed to respond healthy at ${healthUrl} within ${maxRetries * intervalMs}ms.`);
  }

  private pingHealth(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      req.on('error', () => resolve(false));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  public async stop(): Promise<void> {
    this.isShuttingDown = true;
    if (!this.process) return;

    console.log('[BackendManager] Gracefully terminating backend process...');
    if (process.platform === 'win32' && this.process.pid) {
      try {
        const { execSync } = require('child_process');
        execSync(`taskkill /F /PID ${this.process.pid} /T`, { stdio: 'ignore' });
      } catch {}
    } else {
      this.process.kill('SIGTERM');
    }
    this.process = null;
    this.killPortOccupant(this.config.port);
    console.log('[BackendManager] Backend stopped successfully.');
  }
}
