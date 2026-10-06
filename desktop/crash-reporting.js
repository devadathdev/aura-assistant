import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export function installCrashLogging(userDataPath) {
  const logDir = join(userDataPath, 'logs');
  const logFile = join(logDir, 'aura-crash.log');
  const write = async (kind, error) => {
    try {
      await mkdir(logDir, { recursive: true });
      await appendFile(logFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        kind,
        message: error?.message ?? String(error),
        stack: error?.stack ?? null
      }) + '\n');
    } catch {}
  };
  process.on('uncaughtException', e => write('uncaughtException', e));
  process.on('unhandledRejection', e => write('unhandledRejection', e));
}
