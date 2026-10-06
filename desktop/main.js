import { app, BrowserWindow, session, shell, Notification, ipcMain } from 'electron';
import { getSystemInfo } from './system.js';
import { createTray } from './tray.js';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const serverEntry = join(root, 'server.js');
let serverProcess;
let win;
let tray;

ipcMain.handle('aura:open-external', async (_event, url) => {
  if (typeof url !== 'string' || !/^https?:\\/\\//i.test(url)) throw new Error('Only http(s) URLs are allowed');
  await shell.openExternal(url);
  return true;
});
ipcMain.handle('aura:system-info', () => getSystemInfo());
ipcMain.handle('aura:notify', (_event, payload) => {
  const title = String(payload?.title ?? 'AURA');
  const body = String(payload?.body ?? '');
  if (Notification.isSupported()) new Notification({ title, body }).show();
  return true;
});
ipcMain.on('aura:minimize', () => win?.minimize());
ipcMain.on('aura:maximize', () => win?.isMaximized() ? win.unmaximize() : win?.maximize());
ipcMain.on('aura:close', () => win?.close());

function findFreePort(start = 3000) {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(start, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('AURA local server did not become ready');
}

async function startBackend() {
  const port = await findFreePort(Number(process.env.PORT || 3000));
  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: 'inherit',
    windowsHide: true
  });
  serverProcess.once('exit', code => {
    if (!app.isQuitting && code !== 0) console.error(`AURA backend exited with code ${code}`);
  });
  const url = `http://127.0.0.1:${port}`;
  await waitForServer(`${url}/api/status`);
  return url;
}

async function createWindow() {
  const url = await startBackend();

  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#050b0c',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(__dirname, 'preload.js')
    }
  });

  win.once('ready-to-show', () => win.show());
  tray = createTray({ window: win, onQuit: () => app.quit() });
  win.on('minimize', event => { event.preventDefault(); win.hide(); });
  win.on('closed', () => { win = null; tray?.destroy(); tray = null; });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  await win.loadURL(url);
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });

  try {
    await createWindow();
  } catch (error) {
    console.error(error);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
