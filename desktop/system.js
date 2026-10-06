import os from 'node:os';
import process from 'node:process';

export function getSystemInfo() {
  return {
    platform: process.platform,
    arch: process.arch,
    release: os.release(),
    hostname: os.hostname(),
    cpu: os.cpus()[0]?.model ?? 'unknown',
    cpuCores: os.cpus().length,
    memoryTotal: os.totalmem(),
    memoryFree: os.freemem(),
    uptime: os.uptime()
  };
}
