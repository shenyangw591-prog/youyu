import { getStore, AccountError } from '@/runtime/store.mjs';
import { json, assertOrigin, cookie, sessionToken, currentUser, readJson, clientIp, failure } from '@/runtime/http.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) { return json({ user: currentUser(request) }); }
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const body = await readJson(request, 4096), store = getStore();
    if (body.action === 'logout') { store.logout(sessionToken(request)); return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) }); }
    if (body.action !== 'register' && body.action !== 'login') throw new AccountError('操作无效');
    if (body.action === 'register' && process.env.YOUYU_REGISTRATION !== 'open') throw new AccountError('注册暂未开放', 403);
    const result = body.action === 'register'
      ? await store.register(body.username, body.password, clientIp(request))
      : await store.login(body.username, body.password, clientIp(request));
    store.logout(sessionToken(request));
    return json({ user: result.user }, 200, { 'Set-Cookie': cookie(result.token) });
  } catch (error) { return failure(error); }
}
