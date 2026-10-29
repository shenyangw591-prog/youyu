'use client';
import { useEffect, useState } from 'react';

export default function SessionSettings() {
  const [user, setUser] = useState<{ username: string } | null>(null), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { let active = true; fetch('/api/auth', { cache: 'no-store' }).then(r => { if (!r.ok) throw Error(); return r.json(); }).then(r => { if (active) { setUser(r.user); setReady(true); } }).catch(() => { if (active) setError('账号状态暂时无法读取，请刷新后重试'); }); return () => { active = false; }; }, []);
  async function logout() {
    setBusy(true); setError('');
    try { const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }); if (!r.ok) throw Error('暂时无法退出，请重试'); window.location.replace('/login'); }
    catch (e) { setError(e instanceof Error ? e.message : '暂时无法退出'); setBusy(false); }
  }
  async function backup() {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/ledger', { cache: 'no-store' }); const body = await r.json();
      if (!r.ok) throw Error(body.error || '账本读取失败');
      if (!body.ledger) throw Error('请先建立自己的账本');
      const content = { format: 'youyu-ledger-backup', version: 1, exportedAt: new Date().toISOString(), ledger: body.ledger };
      const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `有余-账本备份-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { setError(e instanceof Error ? e.message : '备份失败'); }
    finally { setBusy(false); }
  }
  return <section className="card"><h2>账号与数据</h2><p className="form-help">{!ready ? '正在读取账号…' : user ? `当前账号：${user.username}` : '登录后即可保存自己的网页账本。'}</p>
    {user ? <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}><button className="btn btn-soft" disabled={busy} onClick={() => void backup()}>导出完整备份</button><button className="btn btn-white" disabled={busy} onClick={() => void logout()}>退出登录</button></div> : ready && <a className="btn btn-primary" href="/login">登录 / 注册</a>}
    {error && <p className="form-error" role="alert">{error}</p>}<p className="form-help" style={{ marginTop: 14 }}><a href="/privacy">数据与隐私说明</a> · <a href="/#download">下载 Android 本地版</a></p></section>;
}
