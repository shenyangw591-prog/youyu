import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const SESSION_MS = 7 * 86400_000;
const sha256 = value => createHash('sha256').update(value).digest('hex');
export class AccountError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function normalizeUsername(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_]{3,32}$/.test(value.trim())) throw new AccountError('账号需为 3–32 位字母、数字或下划线');
  return value.trim().toLowerCase();
}
export function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 10 || value.length > 128) throw new AccountError('密码需为 10–128 个字符');
  return value;
}
async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = await derive(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return { salt, hash: hash.toString('hex') };
}
export function openStore(filename, now = () => Date.now()) {
  if (filename !== ':memory:') mkdirSync(path.dirname(path.resolve(filename)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  if (filename !== ':memory:') chmodSync(filename, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS ledgers (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
    PRAGMA user_version=1;`);
  function limit(key, max, windowMs) {
    const time = now();
    db.prepare('DELETE FROM rate_limits WHERE reset_at <= ?').run(time);
    const row = db.prepare(`INSERT INTO rate_limits(key,attempts,reset_at) VALUES (?,1,?)
      ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts`).get(sha256(key), time + windowMs);
    if (row.attempts > max) throw new AccountError('操作较频繁，请稍后重试', 429);
  }
  function newSession(userId) {
    const time = now(), token = randomBytes(32).toString('base64url');
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(time);
    db.prepare(`DELETE FROM sessions WHERE user_id=? AND token_hash NOT IN
      (SELECT token_hash FROM sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 4)`).run(userId, userId);
    db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(sha256(token), userId, time + SESSION_MS, time);
    return { token, expiresAt: time + SESSION_MS };
  }
  return {
    db, limit,
    async register(rawUsername, rawPassword, ip) {
      limit(`register:${ip}`, 10, 3600_000);
      const username = normalizeUsername(rawUsername), password = validatePassword(rawPassword);
      const { hash, salt } = await hashPassword(password), id = randomUUID();
      try { db.prepare('INSERT INTO users VALUES (?,?,?,?,?)').run(id, username, hash, salt, now()); }
      catch (error) { if (String(error).includes('UNIQUE constraint failed')) throw new AccountError('这个账号已被使用，请换一个'); throw error; }
      return { user: { id, username }, ...newSession(id) };
    },
    async login(rawUsername, rawPassword, ip) {
      limit(`login-ip:${ip}`, 40, 15 * 60_000);
      const username = normalizeUsername(rawUsername);
      limit(`login-user:${username}`, 15, 15 * 60_000);
      if (typeof rawPassword !== 'string' || rawPassword.length > 128) throw new AccountError('账号或密码不正确', 401);
      const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
      const { hash } = await hashPassword(rawPassword, user?.password_salt ?? '0123456789abcdef0123456789abcdef');
      const valid = timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user?.password_hash ?? '00'.repeat(64), 'hex'));
      if (!user || !valid) throw new AccountError('账号或密码不正确', 401);
      return { user: { id: user.id, username: user.username }, ...newSession(user.id) };
    },
    user(token) {
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
      return db.prepare(`SELECT users.id, users.username FROM sessions JOIN users ON users.id=sessions.user_id
        WHERE sessions.token_hash=? AND sessions.expires_at>?`).get(sha256(token), now()) ?? null;
    },
    logout(token) { if (typeof token === 'string') db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha256(token)); },
    readLedger(userId) {
      const row = db.prepare('SELECT data,revision FROM ledgers WHERE user_id=?').get(userId);
      return { ledger: row ? JSON.parse(row.data) : null, revision: row?.revision ?? 0 };
    },
    writeLedger(userId, ledger, revision) {
      const data = JSON.stringify(ledger), time = new Date(now()).toISOString();
      const result = revision === 0
        ? db.prepare('INSERT INTO ledgers(user_id,data,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(user_id) DO NOTHING').run(userId, data, time)
        : db.prepare('UPDATE ledgers SET data=?,revision=revision+1,updated_at=? WHERE user_id=? AND revision=?').run(data, time, userId, revision);
      if (result.changes !== 1) throw new AccountError('账本已在其他页面更新，请刷新后再重试', 409);
      return { revision: revision + 1 };
    },
    async resetPassword(username, password) {
      const name = normalizeUsername(username), next = await hashPassword(validatePassword(password));
      const user = db.prepare('SELECT id FROM users WHERE username=?').get(name);
      if (!user) throw new AccountError('账号不存在', 404);
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('UPDATE users SET password_hash=?,password_salt=? WHERE id=?').run(next.hash, next.salt, user.id);
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close() { db.close(); },
  };
}
export function getStore() {
  const key = Symbol.for('youyu.selfhost.store');
  globalThis[key] ??= openStore(path.join(process.env.YOUYU_DATA_DIR || path.resolve('data'), 'youyu.sqlite'));
  return globalThis[key];
}
