import { getStore } from '@/runtime/store.mjs';
import { json } from '@/runtime/http.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { getStore().db.prepare('SELECT 1').get(); return json({ ok: true }); }
  catch { return json({ ok: false }, 503); }
}
