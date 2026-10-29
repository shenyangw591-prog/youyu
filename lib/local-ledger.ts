import { ledgerSchema, type Ledger } from './ledger';

export const LOCAL_LEDGER_KEY = 'youyu.android.beta.ledger.v1';
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
export type NativeLedgerBridge = {
  readLedger(): string;
  saveLedger(content: string): string;
  exportFile(name: string, mime: string, content: string): void;
};
declare global {
  interface Window {
    AndroidLedger?: NativeLedgerBridge;
    YouyuHandleBack?: () => boolean;
  }
}

export function serializeBackup(ledger: Ledger, savedAt = new Date().toISOString()) {
  return JSON.stringify({ format: 'youyu-ledger-backup', version: 1, savedAt, ledger: ledgerSchema.parse(ledger) }, null, 2);
}

export function parseBackup(content: string): Ledger {
  if (new TextEncoder().encode(content).length > MAX_BACKUP_BYTES) throw Error('备份文件超过 2 MB，请选择完整的有余备份文件');
  let raw: unknown;
  try { raw = JSON.parse(content.replace(/^\uFEFF/, '')); } catch { throw Error('备份文件不是有效的 JSON 文件'); }
  if (raw && typeof raw === 'object' && 'format' in raw) {
    const backup = raw as { format: unknown; version: unknown; ledger: unknown };
    if (backup.format !== 'youyu-ledger-backup' || backup.version !== 1) throw Error('无法识别这份备份的格式或版本');
    raw = backup.ledger;
  }
  const result = ledgerSchema.safeParse(raw);
  if (!result.success) throw Error('备份中的账本记录不完整或存在无效数据，未覆盖当前账本');
  return result.data;
}

export function loadLocalLedger(): Ledger | null {
  if (window.AndroidLedger) {
    const result = JSON.parse(window.AndroidLedger.readLedger()) as { status: string; content?: string; error?: string };
    if (result.status === 'empty') return null;
    if (result.status !== 'ready' || !result.content) throw Error(result.error || '本机账本暂时无法读取，请保留应用数据并恢复备份');
    return parseBackup(result.content);
  }
  const content = localStorage.getItem(LOCAL_LEDGER_KEY);
  return content ? parseBackup(content) : null;
}

export function saveLocalLedger(ledger: Ledger) {
  const content = serializeBackup(ledger);
  if (new TextEncoder().encode(content).length > MAX_BACKUP_BYTES) throw Error('账本超过内测版容量，请先导出备份');
  if (window.AndroidLedger) {
    const error = window.AndroidLedger.saveLedger(content);
    if (error) throw Error(error);
    return;
  }
  try { localStorage.setItem(LOCAL_LEDGER_KEY, content); } catch { throw Error('本机存储空间不足或不可用，本次记录尚未保存'); }
}

export function exportLocalFile(name: string, mime: string, content: string) {
  if (window.AndroidLedger) { window.AndroidLedger.exportFile(name, mime, content); return; }
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
