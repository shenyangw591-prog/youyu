import { getStore, AccountError } from './store.mjs';

export function appOrigin() {
  const origin = new URL(process.env.YOUYU_ORIGIN || 'https://youyuapp.com.cn');
  if (!['http:', 'https:'].includes(origin.protocol)) throw Error('Invalid YOUYU_ORIGIN');
  return origin.origin;
}
export const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
export function assertOrigin(request) {
  if (request.headers.get('origin') !== appOrigin()) throw new AccountError('请求来源无效，请从本站重新打开', 403);
}
function cookieName() { return appOrigin().startsWith('https:') ? '__Host-youyu_session' : 'youyu_session'; }
export function cookie(token, maxAge = 7 * 86400) {
  return `${cookieName()}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${appOrigin().startsWith('https:') ? '; Secure' : ''}`;
}
export function sessionToken(request) {
  const matches = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).filter(s => s.startsWith(cookieName() + '='));
  return matches.length === 1 ? matches[0].slice(cookieName().length + 1) : '';
}
export function currentUser(request) { return getStore().user(sessionToken(request)); }
export async function readJson(request, maxBytes = 1_500_000) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw new AccountError('请提交 JSON 数据', 415);
  const contentLength = request.headers.get('content-length');
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxBytes)) throw new AccountError('提交的数据过大', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AccountError('提交的数据为空');
  let size = 0; const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new AccountError('提交的数据过大', 413); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AccountError('数据格式无效'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AccountError('数据格式无效');
  return body;
}
export function clientIp(request) { return (request.headers.get('x-real-ip') || 'unknown').slice(0, 80); }
export function failure(error) {
  if (error instanceof AccountError) return json({ error: error.message }, error.status);
  console.error('Youyu request failed', error);
  return json({ error: '服务暂时不可用，请稍后重试' }, 503);
}
