'use client';

import { useEffect, useState } from 'react';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

declare global {
  interface Window { __youyuInstallPrompt?: InstallPrompt; }
}

function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function PwaBootstrap() {
  useEffect(() => {
    if ('serviceWorker' in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      window.__youyuInstallPrompt = event as InstallPrompt;
      window.dispatchEvent(new Event('youyu:installable'));
    };
    const onInstalled = () => {
      window.__youyuInstallPrompt = undefined;
      window.dispatchEvent(new Event('youyu:installed'));
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  return null;
}

export function InstallAppCard() {
  const [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [hint, setHint] = useState('在浏览器菜单中选择“安装有余”或“添加到主屏幕”。');

  useEffect(() => {
    const refresh = () => {
      setInstalled(isInstalled());
      setPrompt(window.__youyuInstallPrompt ?? null);
    };
    if (!window.isSecureContext) {
      setHint('本地版可直接在浏览器使用；安装到主屏幕请打开 HTTPS 正式版。');
    } else if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      setHint('在浏览器中点“分享”，选择“添加到主屏幕”。');
    }
    refresh();
    window.addEventListener('youyu:installable', refresh);
    window.addEventListener('youyu:installed', refresh);
    return () => {
      window.removeEventListener('youyu:installable', refresh);
      window.removeEventListener('youyu:installed', refresh);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      window.__youyuInstallPrompt = undefined;
      setPrompt(null);
      if (choice.outcome === 'accepted') setInstalled(true);
    } catch { setPrompt(null); }
  }

  return <section className="card install-app-card">
    <img src="/pwa/icon-192.png" width="54" height="54" alt="" />
    <div><h2>安装有余</h2><p>{installed ? '已添加到主屏幕' : hint}</p></div>
    {!installed && prompt && <button className="btn btn-primary" onClick={() => void install()}>立即安装</button>}
  </section>;
}
