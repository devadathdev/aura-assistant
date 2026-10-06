import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('auraDesktop', Object.freeze({
  platform: process.platform,
  version: process.versions.electron,
  openExternal: (url) => ipcRenderer.invoke('aura:open-external', url),
  getSystemInfo: () => ipcRenderer.invoke('aura:system-info'),
  notify: (title, body) => ipcRenderer.invoke('aura:notify', { title, body }),
  minimize: () => ipcRenderer.send('aura:minimize'),
  maximize: () => ipcRenderer.send('aura:maximize'),
  close: () => ipcRenderer.send('aura:close')
}));
