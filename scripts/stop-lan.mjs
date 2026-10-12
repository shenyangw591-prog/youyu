import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let session;
try { session = JSON.parse(readFileSync(path.join(root, 'outputs/lan-session.json'), 'utf8')); }
catch { console.log('手机访问服务没有运行。'); process.exit(0); }
const key = session.key || new URL(session.url).searchParams.get('access');
try {
  const response = await fetch(`http://127.0.0.1:${session.port}/__youyu_stop`, {
    method: 'POST', headers: { 'x-youyu-stop': key }, signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  console.log('手机访问服务已停止。');
} catch {
  console.log('没有找到正在运行的手机访问服务。');
}
