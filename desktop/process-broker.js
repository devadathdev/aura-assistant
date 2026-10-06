import { spawn } from 'node:child_process';

const SAFE_COMMANDS = new Set(['whoami', 'hostname', 'where', 'tasklist', 'node', 'python', 'python3']);

export function createProcessBroker() {
  return {
    async execute(command, args = [], confirm = false) {
      if (!confirm) throw new Error('Process execution requires explicit confirmation');
      if (!SAFE_COMMANDS.has(command)) throw new Error('Command is not allowed by the AURA process policy');
      if (!Array.isArray(args) || args.some(a => typeof a !== 'string')) throw new Error('Invalid arguments');
      return new Promise((resolve, reject) => {
        const child = spawn(command, args, { shell: false, windowsHide: true });
        let stdout = '', stderr = '';
        child.stdout.on('data', d => stdout += d);
        child.stderr.on('data', d => stderr += d);
        child.on('error', reject);
        child.on('close', code => resolve({ code, stdout: stdout.slice(0, 20000), stderr: stderr.slice(0, 20000) }));
      });
    }
  };
}
