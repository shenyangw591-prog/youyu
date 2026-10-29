import { Download, ShieldCheck } from 'lucide-react';
import release from '@/public/downloads/release.json';

export function AndroidDownloadButton({ className = 'site-primary' }: { className?: string }) {
  return <a className={className} href={`/downloads/${release.filename}`} download={release.filename}><Download size={19} aria-hidden="true" />下载 Android 版</a>;
}
export default function AndroidDownload() {
  return <section className="site-download" id="download" aria-labelledby="download-title"><div className="section-inner download-layout">
    <div><span className="section-index">随身记录</span><h2 id="download-title">把有余，<br />装进口袋。</h2><p>离线也能记一笔，给每天留一点余地。</p></div>
    <div className="download-card"><img src="/pwa/icon-192.png" width="72" height="72" alt="有余应用图标" loading="lazy" /><h3>有余 · Android 本地版</h3><p className="download-version">正式版 {release.versionName} · Android {release.minAndroid} 及以上 · {(release.bytes / 1024 / 1024).toFixed(1)} MB</p><AndroidDownloadButton /><p className="download-local"><ShieldCheck size={16} aria-hidden="true" />账本加密保存在手机，无需登录，可离线使用。</p><p className="download-note">Android 本地版与网页版分别保存账本。换机或从旧内测版迁移时，先导出 JSON 完整备份，再在新应用中恢复。</p><a className="download-checksum" href="/downloads/SHA256.txt" target="_blank" rel="noreferrer">查看安装包 SHA-256 校验值</a></div>
  </div></section>;
}
