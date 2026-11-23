import { app, BrowserWindow, ipcMain, Notification, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import isDev from 'electron-is-dev';
import { BackendManager } from './backend-manager';

// Ensure compatibility with containerized and virtualized desktop display servers
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');

let mainWindow: BrowserWindow | null = null;
let backendManager: BackendManager | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#020617', // slate-950
    show: true,
    title: 'CloudSentinel AI — Unified Multi-Cloud Observability',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  // Protect against arbitrary URL navigation
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'http://127.0.0.1:5173' && parsedUrl.protocol !== 'file:') {
      event.preventDefault();
      console.warn(`[Security] Blocked unauthorized navigation to: ${navigationUrl}`);
    }
  });

  // Open external links in default OS browser, not in the app window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Candidate paths for built frontend dist/index.html
  const candidateDists = [
    path.join(__dirname, '..', '..', '..', 'frontend', 'dist', 'index.html'),
    path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html'),
    path.join(app.getAppPath(), '..', 'frontend', 'dist', 'index.html'),
  ];

  let resolvedFrontendDist: string | null = null;
  for (const candidate of candidateDists) {
    if (fs.existsSync(candidate)) {
      resolvedFrontendDist = candidate;
      break;
    }
  }

  const viteDevUrl = process.env.VITE_DEV_SERVER_URL;

  if (viteDevUrl) {
    console.log(`[Desktop] Loading from Vite dev server: ${viteDevUrl}`);
    await mainWindow.loadURL(viteDevUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else if (resolvedFrontendDist) {
    console.log(`[Desktop] Loading built frontend: ${resolvedFrontendDist}`);
    await mainWindow.loadFile(resolvedFrontendDist);
  } else {
    console.log(`[Desktop] Fallback to default dev URL: http://127.0.0.1:5173`);
    await mainWindow.loadURL('http://127.0.0.1:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.show();
  mainWindow.focus();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  ipcMain.handle('backend:get-config', () => {
    if (!backendManager) {
      throw new Error('BackendManager is not initialized.');
    }
    return {
      host: backendManager.getHost(),
      port: backendManager.getPort(),
      token: backendManager.getToken(),
    };
  });

  ipcMain.handle('app:version', () => {
    return app.getVersion();
  });

  ipcMain.on('app:notification', (_event, { title, body }: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  });

  ipcMain.on('app:open-external', (_event, url: string) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
  });
}

// Application Lifecycle
app.whenReady().then(async () => {
  try {
    // If backend was pre-started externally (e.g. by start.ps1), skip spawning it again
    // and just provide the token from env + a no-op manager.
    const preStarted = process.env.CLOUDSENTINEL_BACKEND_PRESTARTED === '1';

    if (!preStarted) {
      backendManager = new BackendManager(app.getAppPath(), app.isPackaged);
    } else {
      // Create a lightweight stub so IPC handlers resolve token from env or .env file
      let stubToken = process.env.CLOUDSENTINEL_TOKEN;
      if (!stubToken) {
        try {
          const envFile = path.resolve(app.getAppPath(), '..', '.env');
          if (fs.existsSync(envFile)) {
            const m = fs.readFileSync(envFile, 'utf-8').match(/^CLOUDSENTINEL_TOKEN=(.*)$/m);
            if (m && m[1].trim()) stubToken = m[1].trim();
          }
        } catch {}
      }
      stubToken = stubToken || 'cloudsentinel_session_vault_token_489274912739';
      backendManager = new BackendManager(app.getAppPath(), app.isPackaged);
      // Override the generated token with the one the pre-started backend knows
      (backendManager as any).config.token = stubToken;
    }

    registerIpcHandlers();

    if (!preStarted) {
      // Start local Python backend
      await backendManager.start();
    } else {
      console.log('[Main] Backend was pre-started externally. Skipping spawn.');
    }

    // Create desktop window once backend is healthy
    await createWindow();
  } catch (error) {
    console.error('[Main] Failed to start CloudSentinel application:', error);
    try {
      fs.writeFileSync(path.join(__dirname, '..', '..', 'desktop_error.log'), String(error) + '\n' + ((error as any)?.stack || ''));
    } catch {}
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    if (backendManager) {
      await backendManager.stop();
    }
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  if (backendManager) {
    event.preventDefault();
    console.log('[Main] Stopping backend before quitting...');
    await backendManager.stop();
    backendManager = null;
    app.quit();
  }
});
