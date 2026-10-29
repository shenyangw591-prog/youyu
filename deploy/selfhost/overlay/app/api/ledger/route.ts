import { ledgerSchema } from '@/lib/ledger';
import { getStore, AccountError } from '@/runtime/store.mjs';
import { json, assertOrigin, currentUser, readJson, failure } from '@/runtime/http.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = currentUser(request);
    if (!user) return json({ error: '请先登录后建立自己的账本' }, 401);
    return json(getStore().readLedger(user.id));
  } catch (error) { return failure(error); }
}
export async function PUT(request: Request) {
  try {
    assertOrigin(request);
    const user = currentUser(request);
    if (!user) return json({ error: '请先登录后建立自己的账本' }, 401);
    const body = await readJson(request);
    if (!Number.isSafeInteger(body.revision) || body.revision < 0) throw new AccountError('账本版本无效');
    const result = ledgerSchema.safeParse(body.ledger);
    if (!result.success) throw new AccountError(result.error.issues[0].message);
    return json(getStore().writeLedger(user.id, result.data, body.revision));
  } catch (error) { return failure(error); }
}
