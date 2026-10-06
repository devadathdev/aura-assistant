import { autoUpdater } from 'electron-updater';

export function configureUpdater({ onStatus = () => {} } = {}) {
  autoUpdater.autoDownload = false;
  autoUpdater.on('checking-for-update', () => onStatus({ state: 'checking' }));
  autoUpdater.on('update-available', info => onStatus({ state: 'available', version: info.version }));
  autoUpdater.on('update-not-available', () => onStatus({ state: 'current' }));
  autoUpdater.on('error', error => onStatus({ state: 'error', message: error.message }));
  autoUpdater.on('download-progress', p => onStatus({ state: 'downloading', percent: p.percent }));
  autoUpdater.on('update-downloaded', info => onStatus({ state: 'downloaded', version: info.version }));
}
