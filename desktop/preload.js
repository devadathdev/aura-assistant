import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('auraDesktop', Object.freeze({
  platform: process.platform,
  version: process.versions.electron,
  openExternal: (url) => ipcRenderer.invoke('aura:open-external', url),
  getSystemInfo: () => ipcRenderer.invoke('aura:system-info'),
  getAppVersion: () => ipcRenderer.invoke('aura:app-version'),
  secrets: Object.freeze({
    get: (key) => ipcRenderer.invoke('aura:secret-get', key),
    set: (key, value) => ipcRenderer.invoke('aura:secret-set', key, value),
    delete: (key) => ipcRenderer.invoke('aura:secret-delete', key)
  }),
  filesystem: Object.freeze({
    readText: (path) => ipcRenderer.invoke('aura:fs-read', path),
    writeText: (path, content, confirmed) => ipcRenderer.invoke('aura:fs-write', path, content, confirmed)
  }),
  process: Object.freeze({
    execute: (command, args, confirmed) => ipcRenderer.invoke('aura:process-execute', command, args, confirmed)
  }),
  onHotkey: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('aura:hotkey', listener);
    return () => ipcRenderer.removeListener('aura:hotkey', listener);
  },
  notify: (title, body) => ipcRenderer.invoke('aura:notify', { title, body }),
  minimize: () => ipcRenderer.send('aura:minimize'),
  maximize: () => ipcRenderer.send('aura:maximize'),
  close: () => ipcRenderer.send('aura:close')
}));
