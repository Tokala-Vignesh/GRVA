import { contextBridge, ipcRenderer } from 'electron';

export interface CloudSentinelDesktopAPI {
  getBackendConfig: () => Promise<{ host: string; port: number; token: string }>;
  sendNotification: (title: string, body: string) => void;
  getAppVersion: () => Promise<string>;
  platform: string;
  openExternal: (url: string) => void;
}

const desktopAPI: CloudSentinelDesktopAPI = {
  getBackendConfig: () => ipcRenderer.invoke('backend:get-config'),
  sendNotification: (title: string, body: string) => {
    ipcRenderer.send('app:notification', { title, body });
  },
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  platform: process.platform,
  openExternal: (url: string) => {
    // Only allow http / https URLs to prevent arbitrary protocol launches
    if (url.startsWith('https://') || url.startsWith('http://')) {
      ipcRenderer.send('app:open-external', url);
    }
  },
};

// Safely bridge the API to the renderer under window.cloudSentinelDesktop
contextBridge.exposeInMainWorld('cloudSentinelDesktop', desktopAPI);
