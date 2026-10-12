'use client';

import { useEffect, useState } from 'react';

export default function SiteMotion() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowSplash(false), 2800);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.youyu-site');
    if (!root || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const targets = root.querySelectorAll<HTMLElement>('[data-reveal]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });

    root.classList.add('motion-ready');
    targets.forEach((target) => observer.observe(target));

    return () => {
      observer.disconnect();
      root.classList.remove('motion-ready');
    };
  }, []);

  if (!showSplash) return null;

  return (
    <div className="site-splash" role="status" aria-label="有余正在开启">
      <div className="splash-center">
        <div className="splash-mark-stage">
          <img src="/marketing/brand-mark-imagegen.webp" alt="" width="126" height="126" />
        </div>
        <strong className="splash-wordmark">有余</strong>
        <span className="splash-tagline">把今天过好，也把以后安排好。</span>
      </div>
      <button className="splash-skip" type="button" onClick={() => setShowSplash(false)}>跳过动画</button>
    </div>
  );
}
