import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openStore, AccountError } from '../overlay/runtime/store.mjs';
import { assertOrigin, readJson, cookie, sessionToken } from '../overlay/runtime/http.mjs';

test('accounts, sessions, isolated ledgers, conflict protection and password reset', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'youyu-store-'));
  const filename = path.join(dir, 'ledger.sqlite');
  let time = Date.now(), store = openStore(filename, () => time);
  try {
    const alice = await store.register('Alice_1', 'correct-horse-battery-1', 'alice-ip');
    const bob = await store.register('bob_2', 'correct-horse-battery-2', 'bob-ip');
    assert.equal(store.user(alice.token).username, 'alice_1');
    assert.equal(store.user('forged'), null);
    const stored = store.db.prepare('SELECT * FROM users WHERE id=?').get(alice.user.id);
    assert.notEqual(stored.password_hash, 'correct-horse-battery-1');
    assert.equal(stored.password_hash.length, 128);
    await assert.rejects(store.register('ALICE_1', 'other-password-123', 'another-ip'), /已被使用/);
    await assert.rejects(store.login('alice_1', 'wrong-password', 'alice-ip'), e => e.status === 401);
    await assert.rejects(store.login('missing', 'wrong-password', 'missing-ip'), e => e.status === 401);
    const login = await store.login('ALICE_1', 'correct-horse-battery-1', 'alice-ip');
    assert.equal(store.user(login.token).id, alice.user.id);
    assert.equal(store.readLedger(alice.user.id).ledger, null);
    const ledger = { name: 'Alice private ledger', transactions: [{ amount: 123 }] };
    assert.deepEqual(store.writeLedger(alice.user.id, ledger, 0), { revision: 1 });
    assert.deepEqual(store.readLedger(bob.user.id), { ledger: null, revision: 0 });
    assert.throws(() => store.writeLedger(alice.user.id, { name: 'stale' }, 0), e => e.status === 409);
    assert.deepEqual(store.writeLedger(alice.user.id, ledger, 1), { revision: 2 });
    assert.throws(() => store.writeLedger(alice.user.id, { name: 'stale' }, 1), e => e.status === 409);
    assert.equal(store.readLedger(alice.user.id).ledger.name, ledger.name);
    const tokenRow = store.db.prepare('SELECT token_hash FROM sessions WHERE user_id=?').get(alice.user.id);
    assert.notEqual(tokenRow.token_hash, alice.token);
    store.close(); store = openStore(filename, () => time);
    assert.equal(store.readLedger(alice.user.id).revision, 2);
    assert.equal(store.user(alice.token).id, alice.user.id);
    await store.resetPassword('alice_1', 'replacement-password-123');
    assert.equal(store.user(alice.token), null);
    assert.equal(store.user(login.token), null);
    const afterReset = await store.login('alice_1', 'replacement-password-123', 'new-ip');
    store.logout(afterReset.token);
    assert.equal(store.user(afterReset.token), null);
    assert.equal(store.user(bob.token).id, bob.user.id);
    time += 8 * 86400_000;
    assert.equal(store.user(bob.token), null);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('password validation and persistent rate limits', async () => {
  let time = 1000; const store = openStore(':memory:', () => time);
  try {
    await assert.rejects(store.register('bad/name', 'good-password-123', 'ip'), AccountError);
    await assert.rejects(store.register('valid_name', 'short', 'ip'), /密码/);
    store.limit('sample', 2, 100); store.limit('sample', 2, 100);
    assert.throws(() => store.limit('sample', 2, 100), e => e.status === 429);
    time += 101;
    assert.doesNotThrow(() => store.limit('sample', 2, 100));
  } finally { store.close(); }
});

test('reject cross-site mutations and enforce streaming request size', async () => {
  process.env.YOUYU_ORIGIN = 'https://youyuapp.com.cn';
  const request = (origin, body, type = 'application/json') => new Request('https://youyuapp.com.cn/api/auth', { method: 'POST', headers: { ...(origin ? { origin } : {}), 'content-type': type }, body });
  assert.doesNotThrow(() => assertOrigin(request('https://youyuapp.com.cn', '{}')));
  assert.throws(() => assertOrigin(request('https://evil.example', '{}')), e => e.status === 403);
  assert.throws(() => assertOrigin(request(null, '{}')), e => e.status === 403);
  assert.deepEqual(await readJson(request('https://youyuapp.com.cn', '{"action":"login"}')), { action: 'login' });
  await assert.rejects(readJson(request('https://youyuapp.com.cn', '{}', 'text/plain')), e => e.status === 415);
  await assert.rejects(readJson(request('https://youyuapp.com.cn', 'not json')), /格式/);
  await assert.rejects(readJson(request('https://youyuapp.com.cn', '[]')), /格式/);
  await assert.rejects(readJson(request('https://youyuapp.com.cn', 'x'.repeat(100)), 10), e => e.status === 413);
  const headers = { cookie: cookie('a'.repeat(43)).split(';')[0] };
  assert.match(cookie('token'), /__Host-youyu_session=token; Path=\/; HttpOnly; SameSite=Lax; Max-Age=604800; Secure/);
  assert.equal(sessionToken(new Request('https://youyuapp.com.cn', { headers })), 'a'.repeat(43));
  assert.equal(sessionToken(new Request('https://youyuapp.com.cn', { headers: { cookie: `${headers.cookie}; ${headers.cookie}` } })), '');
});
