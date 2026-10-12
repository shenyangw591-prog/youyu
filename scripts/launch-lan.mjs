import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer, request as httpRequest } from 'node:http';
import { connect as netConnect } from 'node:net';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'outputs');
const sessionPath = path.join(output, 'lan-session.json');
const upstreamHost = '127.0.0.1';
const upstreamPort = 5173;
const port = 5174;

if (!existsSync(path.join(root, 'node_modules', 'vinext'))) {
  console.error('运行文件尚未安装，请先在 Codex 中完成项目安装。');
  process.exit(1);
}
const candidates = Object.entries(networkInterfaces()).flatMap(([name, addresses]) =>
  (addresses ?? []).filter(address => address.family === 'IPv4' && !address.internal &&
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address))
    .map(address => ({ name, address: address.address })));
candidates.sort((a, b) => Number(/wi-?fi|wlan|无线/i.test(b.name)) - Number(/wi-?fi|wlan|无线/i.test(a.name)));
const host = process.env.YOUYU_LAN_HOST_OVERRIDE || candidates[0]?.address;
if (!host) {
  console.error('没有找到可用的局域网地址。请先让电脑连接 Wi-Fi。');
  process.exit(1);
}

mkdirSync(output, { recursive: true });
if (existsSync(sessionPath)) {
  try {
    const previous = JSON.parse(readFileSync(sessionPath, 'utf8'));
    const previousKey = previous.key || new URL(previous.url).searchParams.get('access');
    const currentUrl = `http://${host}:${port}/?access=${previousKey}`;
    const response = await fetch(currentUrl, { redirect: 'manual', signal: AbortSignal.timeout(2000) });
    if (response.status === 302 && response.headers.get('set-cookie')?.includes('__youyu_lan=')) {
      writeFileSync(sessionPath, JSON.stringify({ ...previous, host, url: currentUrl, key: previousKey }, null, 2));
      console.log(`有余已在运行。手机访问：\n${currentUrl}`);
      process.exit(0);
    }
  } catch {}
}

async function localReady() {
  try {
    const response = await fetch(`http://${upstreamHost}:${upstreamPort}/`, { signal: AbortSignal.timeout(2000) });
    return response.ok && (await response.text()).includes('有余');
  } catch { return false; }
}

let child;
if (!await localReady()) {
  let existingPreview = false;
  try {
    const lock = JSON.parse(readFileSync(path.join(root, '.vinext/dev/lock.json'), 'utf8'));
    if (lock.cwd === root) { process.kill(lock.pid, 0); existingPreview = true; }
  } catch {}
  console.log(existingPreview ? '正在等待有余本地服务…' : '正在启动有余本地服务…');
  if (!existingPreview) child = spawn(process.execPath, ['scripts/run-framework.mjs', 'dev'], { cwd: root, stdio: 'inherit' });
  for (let attempt = 0; attempt < 80 && !await localReady(); attempt++) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!await localReady()) {
    console.error('本地服务启动失败。请检查电脑预览窗口中的提示。');
    process.exit(1);
  }
}

const key = randomBytes(18).toString('hex');
const base = `http://${host}:${port}`;
const url = `${base}/?access=${key}`;
const cookieName = '__youyu_lan';
const accessCookie = `${cookieName}=${key}`;

function activeHost(request) {
  const candidate = request.headers.host;
  if (typeof candidate !== 'string') return false;
  const current = new Set(Object.values(networkInterfaces()).flatMap(addresses =>
    (addresses ?? []).filter(address => address.family === 'IPv4' && !address.internal &&
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address))
      .map(address => `${address.address}:${port}`)));
  return current.has(candidate);
}

function allowed(request) {
  if (!activeHost(request)) return false;
  return (request.headers.cookie ?? '').split(';').map(value => value.trim()).includes(accessCookie);
}

function forwardHeaders(request) {
  const headers = { ...request.headers, host: `${upstreamHost}:${upstreamPort}` };
  headers.cookie = (headers.cookie ?? '').split(';').map(value => value.trim())
    .filter(value => value && !value.startsWith(`${cookieName}=`)).join('; ');
  if (!headers.cookie) delete headers.cookie;
  if (headers.origin === `http://${request.headers.host}`) headers.origin = `http://${upstreamHost}:${upstreamPort}`;
  delete headers['x-forwarded-host'];
  delete headers['x-forwarded-proto'];
  return headers;
}

const server = createServer((incoming, outgoing) => {
  if (incoming.url === '/__youyu_stop' && incoming.method === 'POST' &&
      ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(incoming.socket.remoteAddress ?? '') &&
      incoming.headers['x-youyu-stop'] === key) {
    outgoing.writeHead(200, { 'Cache-Control': 'no-store' }).end('stopping');
    setTimeout(() => { child?.kill('SIGTERM'); server.closeAllConnections(); server.close(); process.exit(0); }, 100);
    return;
  }
  let target;
  try { target = new URL(incoming.url ?? '/', `http://${incoming.headers.host}`); }
  catch { outgoing.writeHead(400).end(); return; }
  if (!activeHost(incoming)) { outgoing.writeHead(403).end(); return; }
  if (incoming.method === 'GET' && target.searchParams.get('access') === key) {
    target.searchParams.delete('access');
    outgoing.writeHead(302, {
      Location: `${target.pathname}${target.search}${target.hash}`,
      'Set-Cookie': `${accessCookie}; Path=/; HttpOnly; SameSite=Lax`,
      'Cache-Control': 'private, no-store',
    }).end();
    return;
  }
  if (!allowed(incoming)) {
    outgoing.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' });
    outgoing.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>有余</title><body style="font-family:system-ui;padding:32px">请从电脑上显示的手机访问地址打开有余。</body></html>');
    return;
  }
  const upstream = httpRequest({ hostname: upstreamHost, port: upstreamPort, method: incoming.method, path: incoming.url, headers: forwardHeaders(incoming) }, response => {
    outgoing.writeHead(response.statusCode ?? 502, response.headers);
    response.pipe(outgoing);
  });
  upstream.on('error', () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end('本地服务暂时不可用'); });
  incoming.pipe(upstream);
});

server.on('upgrade', (incoming, socket, head) => {
  if (!allowed(incoming)) { socket.destroy(); return; }
  const upstream = netConnect(upstreamPort, upstreamHost, () => {
    const headers = forwardHeaders(incoming);
    upstream.write(`${incoming.method} ${incoming.url} HTTP/1.1\r\n`);
    for (const [name, value] of Object.entries(headers)) {
      if (Array.isArray(value)) for (const item of value) upstream.write(`${name}: ${item}\r\n`);
      else if (value !== undefined) upstream.write(`${name}: ${value}\r\n`);
    }
    upstream.write('\r\n');
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});

server.on('error', error => { console.error(`手机访问服务无法启动：${error.message}`); process.exitCode = 1; });
server.listen(port, '0.0.0.0', () => {
  writeFileSync(sessionPath, JSON.stringify({ host, port, url, key, pid: process.pid, startedAt: new Date().toISOString() }, null, 2));
  console.log(`\n手机与电脑连接同一 Wi-Fi 后，在手机浏览器打开：\n${url}\n`);
  console.log('此地址仅供本地使用。保持电脑开机；结束时双击“停止手机访问.cmd”。');
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); child?.kill(signal); });
