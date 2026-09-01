#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SERVICES = [
  {
    name: 'AURA Assistant',
    cmd: 'node',
    args: ['server.js'],
    cwd: __dirname,
    port: 3000,
    health: 'http://localhost:3000/api/status',
    color: '\x1b[36m' // cyan
  },
  {
    name: 'FORGE API',
    cmd: 'pnpm',
    args: ['--filter=@forge/api', 'dev'],
    cwd: join(__dirname, 'FORGE'),
    port: 4000,
    health: 'http://localhost:4000/health',
    color: '\x1b[35m' // magenta
  },
  {
    name: 'FORGE Web',
    cmd: 'pnpm',
    args: ['--filter=@forge/web', 'dev'],
    cwd: join(__dirname, 'FORGE'),
    env: { ...process.env, PORT: '3001' },
    port: 3001,
    health: 'http://localhost:3001',
    color: '\x1b[35m' // magenta
  },
  {
    name: 'FORGE Worker',
    cmd: 'pnpm',
    args: ['--filter=@forge/worker', 'dev'],
    cwd: join(__dirname, 'FORGE'),
    port: 4002,
    health: null,
    color: '\x1b[35m' // magenta
  },
  {
    name: 'SENTINEL API',
    cmd: 'uv',
    args: ['run', 'uvicorn', 'sentinel_api.main:app', '--host', '0.0.0.0', '--port', '8000', '--reload'],
    cwd: join(__dirname, 'SENTINEL/sentinel/apps/api'),
    port: 8000,
    health: 'http://localhost:8000/health',
    color: '\x1b[32m' // green
  },
  {
    name: 'SENTINEL Web',
    cmd: 'pnpm',
    args: ['dev'],
    cwd: join(__dirname, 'SENTINEL/sentinel/apps/web'),
    env: { ...process.env, PORT: '3002' },
    port: 3002,
    health: 'http://localhost:3002',
    color: '\x1b[32m' // green
  }
];

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';

const processes = [];
let shuttingDown = false;

function log(service, message, level = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = `${service.color}[${service.name}]${RESET}`;
  const levelColor = level === 'error' ? RED : level === 'warn' ? YELLOW : level === 'ready' ? GREEN : '';
  console.log(`${GRAY}[${timestamp}]${RESET} ${prefix} ${levelColor}${message}${RESET}`);
}

const GRAY = '\x1b[90m';

async function checkHealth(url, name) {
  if (!url) return true;
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForService(service, maxAttempts = 60) {
  log(service, 'Starting...', 'info');
  for (let i = 0; i < maxAttempts; i++) {
    if (shuttingDown) return false;
    const healthy = await checkHealth(service.health, service.name);
    if (healthy) {
      log(service, 'Ready!', 'ready');
      return true;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  log(service, 'Health check timeout', 'error');
  return false;
}

function startService(service) {
  return new Promise((resolve, reject) => {
    const child = spawn(service.cmd, service.args, {
      cwd: service.cwd,
      env: { ...process.env, ...service.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });

    processes.push({ service, child });

    child.stdout.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        if (line) log(service, line);
      }
    });

    child.stderr.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        if (line) log(service, line, 'warn');
      }
    });

    child.on('error', (err) => {
      log(service, `Failed to start: ${err.message}`, 'error');
      reject(err);
    });

    child.on('exit', (code, signal) => {
      if (!shuttingDown) {
        log(service, `Exited with code ${code} (signal: ${signal})`, 'error');
      }
    });

    // Give it a moment to start
    setTimeout(() => resolve(child), 500);
  });
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  
  console.log(`\n${YELLOW}Shutting down all services...${RESET}`);
  
  for (const { service, child } of processes) {
    if (!child.killed) {
      log(service, 'Stopping...', 'warn');
      child.kill('SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
    }
  }
  
  // Wait for all to exit
  await Promise.all(processes.map(({ child }) => new Promise(r => child.on('exit', r))));
  
  console.log(`${GREEN}All services stopped.${RESET}`);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (err) => {
  console.error(`${RED}Uncaught exception: ${err.message}${RESET}`);
  shutdown();
});

async function main() {
  console.log(`${BLUE}${BOLD}`);
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     AURA Assistant + FORGE + SENTINEL Unified Launch        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`${RESET}`);

  // Start all services
  for (const service of SERVICES) {
    try {
      await startService(service);
    } catch (err) {
      console.error(`${RED}Failed to start ${service.name}: ${err.message}${RESET}`);
    }
  }

  // Wait for health checks
  console.log(`\n${BLUE}Waiting for services to be ready...${RESET}\n`);
  
  const results = await Promise.all(
    SERVICES.map(s => waitForService(s))
  );

  const allReady = results.every(r => r);
  
  if (allReady) {
    console.log(`\n${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}`);
    console.log(`${GREEN}${BOLD}║                    ALL SERVICES RUNNING                       ║${RESET}`);
    console.log(`${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}\n`);
    
    console.log(`${GREEN}┌─────────────────────────────────────────────────────────────┐${RESET}`);
    console.log(`${GREEN}│ Service              │ URL                                  │${RESET}`);
    console.log(`${GREEN}├─────────────────────────────────────────────────────────────┤${RESET}`);
    for (const service of SERVICES) {
      console.log(`${GREEN}│ ${service.name.padEnd(20)} │ http://localhost:${service.port.toString().padEnd(32)} │${RESET}`);
    }
    console.log(`${GREEN}└─────────────────────────────────────────────────────────────┘${RESET}\n`);
    
    console.log(`${CYAN}Press Ctrl+C to stop all services${RESET}\n`);
  } else {
    console.log(`\n${YELLOW}Some services failed health checks. Check logs above.${RESET}\n`);
  }

  // Keep running
  await new Promise(() => {});
}

main().catch(err => {
  console.error(`${RED}Fatal error: ${err.message}${RESET}`);
  shutdown();
});