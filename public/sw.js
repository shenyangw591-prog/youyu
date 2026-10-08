/* 有余安装支持：仅处理断网导航，不缓存账本、接口或身份信息。 */
const offlinePage = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#008e64"><title>暂时无法连接 · 有余</title><style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#f6fbf8;color:#102b22;font-family:system-ui,"Microsoft YaHei",sans-serif}.panel{max-width:320px;padding:36px;text-align:center}.mark{display:grid;place-items:center;width:72px;height:72px;margin:0 auto 22px;border-radius:22px;background:#e5f8ed;color:#008e64;font-size:36px;font-weight:700}h1{font-size:22px;margin:0 0 10px}p{font-size:14px;line-height:1.7;color:#718b7b;margin:0 0 24px}button{border:0;border-radius:13px;background:#008e64;color:#fff;font-size:15px;font-weight:700;padding:12px 28px}</style></head><body><main class="panel"><div class="mark">余</div><h1>暂时无法连接</h1><p>账本数据没有保存在这台设备的离线缓存中。连接网络后，再打开有余即可继续。</p><button onclick="location.reload()">重新连接</button></main></body></html>`;

self.addEventListener('install', event => { event.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(request).catch(() => new Response(offlinePage, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })));
});
