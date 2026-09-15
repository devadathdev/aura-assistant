#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = __dirname;
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';

const services = [
  { name: 'AURA Assistant', cwd: ROOT, command: process.execPath, args: ['server.js'], port: 3000, health: '/api/status' },
  { name: 'FORGE API', cwd: process.env.FORGE_DIR || path.join(ROOT, '..', 'forge'), command: 'npm', args: ['run', 'start'], port: 4000 },
  { name: 'SENTINEL API', cwd: process.env.SENTINEL_DIR || path.join(ROOT, '..', 'sentinel'), command: 'npm', args: ['run', 'start'], port: 8000 }
];

const children = new Map();

function log(color, message) {
  console.log(`${color}${message}${RESET}`);
}

function startService(service) {
  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    env: { ...process.env, FORCE_COLOR: '1' },
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  children.set(service.name, child);
  child.on('error', error => log(RED, `[${service.name}] ${error.message}`));
  child.on('exit', (code, signal) => {
    children.delete(service.name);
    if (signal) log(YELLOW, `[${service.name}] stopped by ${signal}`);
    else if (code !== 0) log(RED, `[${service.name}] exited with code ${code}`);
    else log(GRAY, `[${service.name}] stopped`);
  });

  log(GREEN, `[${service.name}] started (pid ${child.pid ?? 'n/a'})`);
}

async function waitForHealth(port, endpoint = '/api/status', timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${endpoint}`);
      if (response.ok) return true;
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

async function main() {
  log(CYAN, 'AURA unified development launcher');
  log(GRAY, `Root: ${ROOT}`);

  for (const service of services) {
    if (service.name !== 'AURA Assistant' && service.cwd && !require('node:fs').existsSync(service.cwd)) {
      log(YELLOW, `[${service.name}] skipped: ${service.cwd} does not exist`);
      continue;
    }
    startService(service);
  }

  const aura = services.find(s => s.name === 'AURA Assistant');
  if (aura && await waitForHealth(aura.port, aura.health)) {
    log(GREEN, 'AURA Assistant health check passed.');
  } else {
    log(YELLOW, 'AURA Assistant health check did not pass within 15 seconds.');
  }

  log(CYAN, 'Press Ctrl+C to stop all started services.');
}

function shutdown(signal) {
  log(YELLOW, `\nReceived ${signal}; stopping services...`);
  for (const [name, child] of children) {
    if (!child.killed) {
      log(GRAY, `Stopping ${name}...`);
      child.kill('SIGTERM');
    }
  }
  setTimeout(() => {
    for (const child of children.values()) {
      if (!child.killed) child.kill('SIGKILL');
    }
    process.exit(0);
  }, 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch(error => {
  log(RED, error.stack || error.message);
  shutdown('startup error');
});
