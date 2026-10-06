import { realpath, stat, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

function inside(root, target) {
  const r = resolve(root);
  const t = resolve(target);
  return t === r || t.startsWith(r + sep);
}

export function createFilesystemBroker(allowedRoots = []) {
  const roots = allowedRoots.map(resolve);
  const assertAllowed = async target => {
    const p = resolve(target);
    if (!roots.some(root => inside(root, p))) throw new Error('Path is outside AURA allowed directories');
    return p;
  };

  return {
    async readText(path) {
      const p = await assertAllowed(path);
      return readFile(p, 'utf8');
    },
    async writeText(path, content, confirm = false) {
      if (!confirm) throw new Error('Filesystem write requires explicit confirmation');
      const p = await assertAllowed(path);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, String(content), 'utf8');
      return { path: p, written: true };
    }
  };
}
