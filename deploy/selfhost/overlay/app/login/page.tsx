'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import '../selfhost.css';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const form = new FormData(event.currentTarget), password = String(form.get('password') || '');
    if (mode === 'register' && password !== form.get('confirm')) { setError('两次输入的密码不一致'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: mode, username: form.get('username'), password }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || '暂时无法登录，请稍后重试');
      window.location.replace('/app');
    } catch (error) { setError(error instanceof Error ? error.message : '连接失败，请稍后重试'); setBusy(false); }
  }
  return <main className="account-page"><section className="account-panel">
    <Link href="/" className="account-brand"><img src="/pwa/icon-192.png" width="48" height="48" alt="" />有余</Link>
    <h1>{mode === 'login' ? '欢迎回来' : '开启自己的账本'}</h1>
    <p>安排好生活费，给每天留一点余地。</p>
    <div className="account-tabs"><button type="button" className={mode === 'login' ? 'selected' : ''} onClick={() => { setMode('login'); setError(''); }} disabled={busy}>登录</button><button type="button" className={mode === 'register' ? 'selected' : ''} onClick={() => { setMode('register'); setError(''); }} disabled={busy}>注册</button></div>
    <form onSubmit={submit}>
      <label>账号<input name="username" autoComplete="username" required minLength={3} maxLength={32} pattern="[a-zA-Z0-9_]+" placeholder="3–32 位字母、数字或下划线" disabled={busy} /></label>
      <label>密码<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={10} maxLength={128} placeholder="至少 10 个字符" disabled={busy} /></label>
      {mode === 'register' && <label>确认密码<input name="confirm" type="password" autoComplete="new-password" required minLength={10} maxLength={128} placeholder="再次输入密码" disabled={busy} /></label>}
      {error && <p className="account-error" role="alert">{error}</p>}
      <button className="btn btn-primary account-submit" disabled={busy}>{busy ? '请稍候…' : mode === 'login' ? '登录有余' : '注册并开始'}</button>
    </form>
    <p className="account-fine">请妥善保存账号和密码，当前暂不支持自助找回。<br />网页版账本按账号保存，Android 本地版在手机上独立保存。</p>
    <nav><Link href="/app">先体验演示账本</Link><Link href="/privacy">数据与隐私说明</Link></nav>
  </section></main>;
}
