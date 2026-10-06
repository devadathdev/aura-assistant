import { Menu, Tray, nativeImage } from 'electron';
import { join } from 'node:path';

export function createTray({ window, onQuit }) {
  const iconPath = join(process.cwd(), 'desktop', 'tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  const tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('AURA Assistant');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open AURA', click: () => { window.show(); window.focus(); } },
    { type: 'separator' },
    { label: 'Quit AURA', click: onQuit }
  ]));
  tray.on('double-click', () => { window.show(); window.focus(); });
  return tray;
}
