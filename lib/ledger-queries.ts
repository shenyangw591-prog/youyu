import type { BucketId, Transaction } from './ledger';
import { today } from './ledger';
import { transactionCategory } from './transaction-categories';

export type ReportRange = 'week' | 'month' | 'year';
const iso = (date: Date) => date.toISOString().slice(0, 10);
export function periodAnchor(period: string) {
  return today().startsWith(period) ? today() : iso(new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5)), 0)));
}
export function reportData(transactions: Transaction[], period: string, range: ReportRange, kind: 'expense' | 'income', bucket: string, anchor = periodAnchor(period)) {
  const year = Number(period.slice(0, 4)), month = Number(period.slice(5));
  let start = period + '-01', end = iso(new Date(Date.UTC(year, month, 0)));
  if (range === 'year') { start = `${year}-01-01`; end = `${year}-12-31`; }
  if (range === 'week') {
    const date = new Date(anchor + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    start = iso(date); date.setUTCDate(date.getUTCDate() + 6); end = iso(date);
  }
  const rows = transactions.filter(t => t.date >= start && t.date <= end && (bucket === 'all' || t.bucket === bucket) && (kind === 'income' ? t.kind === 'income' : t.kind === 'expense' || t.kind === 'refund'));
  const net = (t: Transaction) => t.kind === 'refund' ? -t.amount : t.amount;
  const categories = new Map<string, number>();
  const values = new Map<string, number>();
  for (const t of rows) {
    const category = transactionCategory(t), key = range === 'year' ? t.date.slice(0, 7) : t.date;
    categories.set(category, (categories.get(category) ?? 0) + net(t));
    values.set(key, (values.get(key) ?? 0) + net(t));
  }
  const points: { key: string; label: string; value: number }[] = [];
  if (range === 'year') {
    for (let i = 1; i <= 12; i++) { const key = `${year}-${String(i).padStart(2, '0')}`; points.push({ key, label: `${i}月`, value: values.get(key) ?? 0 }); }
  } else {
    for (const d = new Date(start + 'T00:00:00Z'); iso(d) <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = iso(d); points.push({ key, label: range === 'week' ? `${Number(key.slice(5, 7))}/${Number(key.slice(8))}` : String(Number(key.slice(8))), value: values.get(key) ?? 0 });
    }
  }
  const total = rows.reduce((sum, t) => sum + net(t), 0);
  return { start, end, total, average: Math.round(total / points.length), rows, points, categories: [...categories].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount) };
}

export function dayGroups(transactions: Transaction[]) {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) groups.set(t.date, [...(groups.get(t.date) ?? []), t]);
  return [...groups].sort(([a], [b]) => b.localeCompare(a)).map(([date, rows]) => ({
    date, rows,
    income: rows.filter(t => t.kind === 'income').reduce((sum, t) => sum + t.amount, 0),
    expense: rows.reduce((sum, t) => sum + (t.kind === 'expense' ? t.amount : t.kind === 'refund' ? -t.amount : 0), 0),
  }));
}

export function accountNet(transactions: Transaction[], bucket: BucketId) {
  return transactions.reduce((sum, t) => sum + (t.bucket === bucket ? t.kind === 'expense' ? t.amount : t.kind === 'refund' ? -t.amount : 0 : 0), 0);
}
