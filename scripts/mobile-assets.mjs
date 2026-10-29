import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const project = fileURLToPath(new URL('..', import.meta.url));
for (const name of ['brand-mark-imagegen.png', 'account-safety.png', 'account-experience.png', 'account-wealth.png', 'hero-journey.png', 'pwa/icon-192.png']) {
  const destination = path.join(project, 'mobile/public', name);
  await mkdir(path.dirname(destination), { recursive: true });
  try { await copyFile(path.join(project, 'public', name), destination); } catch (e) { if (e.code !== 'ENOENT' || name !== 'hero-journey.png') throw e; }
}
await mkdir(path.join(project, 'mobile/android/res/drawable'), { recursive: true });
await copyFile(path.join(project, 'public/pwa/icon-192.png'), path.join(project, 'mobile/android/res/drawable/app_icon.png'));
console.log('Android assets ready');
