import { safeStorage } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

let filePath;

export function initSecureStore(userDataPath) {
  filePath = join(userDataPath, 'secure-store.json');
}

async function load() {
  try { return JSON.parse(await readFile(filePath, 'utf8')); } catch { return {}; }
}

export async function setSecret(key, value) {
  if (!filePath) throw new Error('Secure store not initialized');
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption is unavailable');
  const data = await load();
  data[key] = safeStorage.encryptString(String(value)).toString('base64');
  await mkdir(join(filePath, '..'), { recursive: true });
  await writeFile(filePath, JSON.stringify(data), { mode: 0o600 });
}

export async function getSecret(key) {
  if (!filePath || !safeStorage.isEncryptionAvailable()) return null;
  const data = await load();
  if (!data[key]) return null;
  try { return safeStorage.decryptString(Buffer.from(data[key], 'base64')); } catch { return null; }
}

export async function deleteSecret(key) {
  const data = await load();
  delete data[key];
  await writeFile(filePath, JSON.stringify(data), { mode: 0o600 });
}
