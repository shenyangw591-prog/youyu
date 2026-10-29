'use client';
import { useState } from 'react';
import { Download, FolderOpen, ShieldCheck } from 'lucide-react';
import { type Ledger, today } from '@/lib/ledger';
import { exportLocalFile, serializeBackup, parseBackup, MAX_BACKUP_BYTES } from '@/lib/local-ledger';

export function LocalBackupCard({ ledger, onPreview, canExport=true }: { ledger: Ledger; canExport?: boolean; onPreview: (ledger: Ledger) => void }) {
  const [error, setError] = useState('');
  return <section className="card local-backup-card"><div className="section-title"><h2>备份与恢复</h2><ShieldCheck size={20} /></div><p>账本保存在这台手机。换机或卸载前，请先导出完整备份。</p><div className="backup-buttons"><button className="btn btn-primary" disabled={!canExport} onClick={() => { try { exportLocalFile(`有余-账本备份-${today()}.json`, 'application/json', serializeBackup(ledger)); setError(''); } catch { setError('导出未成功，请重试'); } }}><Download size={17} />导出完整备份</button><label className="btn btn-white"><FolderOpen size={17} />恢复备份<input type="file" accept=".json,application/json" aria-label="选择有余备份文件" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; setError(''); try { if (file.size > MAX_BACKUP_BYTES) throw Error('备份文件请控制在 2 MB 以内'); onPreview(parseBackup(await file.text())); } catch (err) { setError(err instanceof Error ? err.message : '备份读取失败'); } finally { e.target.value = ''; } }} /></label></div>{error && <p className="form-error" role="alert">{error}</p>}<small>备份包含你的账本记录，请保存到自己信任的位置。</small></section>;
}
