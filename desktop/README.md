# AURA Desktop

AURA Desktop packages the existing web dashboard as a native Windows application using Electron.

## Development

```bash
npm install
npm run desktop
```

The Electron main process starts AURA's existing `server.js` on an available localhost port, waits for `/api/status`, and loads the dashboard into a hardened BrowserWindow.

## Windows build

```bash
npm install
npm run desktop:build
```

Artifacts are written to `dist/`:

- NSIS installer
- Portable Windows executable

The desktop shell deliberately keeps the existing web UI and API architecture intact. Native laptop features can be added behind a small Electron preload/IPC layer later rather than mixing OS access into the web UI.
