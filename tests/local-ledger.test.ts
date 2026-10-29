import assert from 'node:assert/strict';
import { newLedger, metrics } from '../lib/ledger';
import { serializeBackup, parseBackup, loadLocalLedger, saveLocalLedger, LOCAL_LEDGER_KEY } from '../lib/local-ledger';

const ledger = newLedger('安卓内测测试', 300000, 1, '2026-10');
ledger.transactions.push({ id: 'offline', date: '2026-10-12', kind: 'expense', bucket: 'experience', title: '离线午饭', category: '餐饮', note: '离线午饭', amount: 1250, channel: '手动记账' });
const backup = serializeBackup(ledger, '2026-10-12T00:00:00Z');
assert.deepEqual(parseBackup(backup), ledger);
assert.deepEqual(parseBackup(JSON.stringify(ledger)), ledger);
assert.equal(metrics(parseBackup(backup), '2026-10').remaining.experience, 88750);
assert.throws(() => parseBackup('{broken'), /JSON/);
assert.throws(() => parseBackup(JSON.stringify({ format: 'youyu-ledger-backup', version: 9, ledger })), /版本/);
assert.throws(() => parseBackup(JSON.stringify({ format: 'other', version: 1, ledger })), /格式/);
assert.throws(() => parseBackup(JSON.stringify({ ...ledger, transactions: [{ ...ledger.transactions[0], amount: -1 }] })), /无效数据/);
assert.throws(() => parseBackup(' '.repeat(2 * 1024 * 1024 + 1)), /2 MB/);

const store = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { value: {}, configurable: true, writable: true });
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) }, configurable: true });
assert.equal(loadLocalLedger(), null);
saveLocalLedger(ledger);
assert.deepEqual(loadLocalLedger(), ledger);
const previous = store.get(LOCAL_LEDGER_KEY);
assert.throws(() => parseBackup('{broken'));
assert.equal(store.get(LOCAL_LEDGER_KEY), previous, 'invalid restore does not modify the saved ledger');
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => previous, setItem: () => { throw Error('quota'); } }, configurable: true });
assert.throws(() => saveLocalLedger(ledger), /尚未保存/);

let nativeContent = '';
window.AndroidLedger = {
  readLedger: () => nativeContent ? JSON.stringify({ status: 'ready', content: nativeContent }) : JSON.stringify({ status: 'empty' }),
  saveLedger: (content: string) => { nativeContent = content; return ''; },
  exportFile: () => {},
};
assert.equal(loadLocalLedger(), null);
saveLocalLedger(ledger);
assert.deepEqual(loadLocalLedger(), ledger, 'native bridge uses the same backup format');
window.AndroidLedger.saveLedger = () => '磁盘写入失败';
assert.throws(() => saveLocalLedger(ledger), /磁盘写入失败/);
window.AndroidLedger.readLedger = () => JSON.stringify({ status: 'error', error: '密钥不可用' });
assert.throws(() => loadLocalLedger(), /密钥不可用/);
delete window.AndroidLedger;
console.log('PASS: 离线持久化、完整备份往返、无效备份保护、存储失败处理、原生保存接口与读取错误。');
