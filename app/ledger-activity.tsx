'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import { Utensils, ShoppingBag, BusFront, Package, House, Gamepad2, BookOpen, HeartPulse, Users, Ellipsis, Plane, Apple, Cookie, Dumbbell, Smartphone, Landmark, Wallet, BriefcaseBusiness, Clock, GraduationCap, Gift, MoreHorizontal, Pencil, Trash2, Eye, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { BUCKETS, money, type Transaction } from '@/lib/ledger';
import { expenseCategories, incomeCategories, transactionCategory } from '@/lib/transaction-categories';
import { dayGroups, periodAnchor, reportData, type ReportRange } from '@/lib/ledger-queries';

const categoryIcons: Record<string, LucideIcon> = { food: Utensils, shopping: ShoppingBag, transport: BusFront, daily: Package, housing: House, fun: Gamepad2, study: BookOpen, health: HeartPulse, social: Users, other: Ellipsis, travel: Plane, fruit: Apple, snack: Cookie, sport: Dumbbell, digital: Smartphone, saving: Landmark, communication: Smartphone, allowance: Wallet, salary: BriefcaseBusiness, parttime: Clock, award: GraduationCap, gift: Gift };
export function CategoryIcon({ label, kind = 'expense', size = 22 }: { label: string; kind?: string; size?: number }) {
  const category = (kind === 'income' ? incomeCategories : expenseCategories).find(c => c.label === label);
  const Icon = categoryIcons[category?.icon ?? 'other'];
  return <Icon size={size} aria-hidden="true" />;
}

export function ActivityList({ rows, limit, onMore, onEdit, onDelete, onDetails }: { rows: Transaction[]; limit: number; onMore: () => void; onEdit: (t: Transaction) => void; onDelete: (t: Transaction) => void; onDetails: (t: Transaction) => void }) {
  const totals = new Map(dayGroups(rows).map(group => [group.date, group]));
  return <div className="activity-list">{dayGroups(rows.slice(0, limit)).map(visible => { const group = { ...totals.get(visible.date)!, rows: visible.rows }; return <section className="activity-day" key={group.date}>
    <div className="activity-day-head"><h3>{Number(group.date.slice(5, 7))}月{Number(group.date.slice(8))}日 <span>{new Intl.DateTimeFormat('zh-CN', { timeZone: 'UTC', weekday: 'long' }).format(new Date(group.date + 'T12:00:00Z'))}</span></h3><p>{group.income > 0 && <span>收入 {money(group.income)}</span>}<span>支出 {money(group.expense)}</span></p></div>
    {group.rows.map(t => { const category = transactionCategory(t), account = BUCKETS.find(b => b.id === t.bucket)!; return <div className="activity-row" key={t.id}>
      <button className="activity-record" onClick={() => onDetails(t)} aria-label={`查看 ${t.title} 明细`}><span className="activity-icon"><CategoryIcon label={category} kind={t.kind} /></span><span className="activity-description"><b>{category}</b><small><span data-account={t.bucket}>{account.name}</span>{t.note || t.title !== category ? <span className="activity-note"> · {t.note || t.title}</span> : null}</small></span><strong className={t.kind === 'income' || t.kind === 'refund' ? 'positive' : ''}>{t.kind === 'expense' ? '−' : t.kind === 'transfer' ? '' : '+'}{money(t.amount)}</strong></button>
      <DropdownMenu><DropdownMenuTrigger asChild><button className="icon-button" aria-label={`${t.title} 操作`}><MoreHorizontal size={18} /></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => onEdit(t)}><Pencil size={15} />修改</DropdownMenuItem><DropdownMenuItem onSelect={() => onDetails(t)}><Eye size={15} />查看明细</DropdownMenuItem><DropdownMenuItem className="danger" onSelect={() => onDelete(t)}><Trash2 size={15} />删除</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    </div>; })}
  </section>; })}{rows.length > limit && <button className="btn btn-white load-more" onClick={onMore}>再显示 40 条</button>}</div>;
}

export function LedgerCharts({ transactions, period }: { transactions: Transaction[]; period: string }) {
  const [range, setRange] = useState<ReportRange>('month'), [kind, setKind] = useState<'expense' | 'income'>('expense'), [bucket, setBucket] = useState('all'), [anchor, setAnchor] = useState(periodAnchor(period)), [selected, setSelected] = useState<number | null>(null);
  useEffect(() => { setAnchor(periodAnchor(period)); setSelected(null); }, [period]);
  const report = reportData(transactions, period, range, kind, bucket, anchor);
  const min = Math.min(0, ...report.points.map(p => p.value)), max = Math.max(100, ...report.points.map(p => p.value)), spread = max - min;
  const x = (i: number) => 20 + i * 600 / Math.max(1, report.points.length - 1), y = (v: number) => 165 - (v - min) / spread * 135;
  const points = report.points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');
  const maxCategory = Math.max(1, ...report.categories.map(c => Math.abs(c.amount)));
  function moveWeek(days: number) { const d = new Date(anchor + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); setAnchor(d.toISOString().slice(0, 10)); setSelected(null); }
  return <section className="card ledger-charts">
    <div className="chart-controls"><div className="kind-tabs" role="group" aria-label="统计收支类型">{(['expense', 'income'] as const).map(v => <button key={v} className={kind === v ? 'selected' : ''} onClick={() => { setKind(v); setSelected(null); }}>{v === 'expense' ? '支出' : '收入'}</button>)}</div><div className="report-range" role="group" aria-label="统计周期">{(['week', 'month', 'year'] as const).map((v, i) => <button key={v} aria-pressed={range === v} className={range === v ? 'selected' : ''} onClick={() => { setRange(v); setSelected(null); }}>{['周', '月', '年'][i]}</button>)}</div></div>
    <div className="account-filter" role="group" aria-label="统计账户"><button className={bucket === 'all' ? 'selected' : ''} onClick={() => setBucket('all')}>全部账户</button>{BUCKETS.map(b => <button key={b.id} data-account={b.id} className={bucket === b.id ? 'selected' : ''} onClick={() => setBucket(b.id)}>{b.name}</button>)}</div>
    <div className="chart-period-label">{range === 'week' && <button className="icon-button" aria-label="上一周" onClick={() => moveWeek(-7)}><ChevronLeft size={18} /></button>}<span>{range === 'year' ? `${period.slice(0, 4)}年` : range === 'month' ? `${period.slice(0, 4)}年${Number(period.slice(5))}月` : `${report.start.slice(5).replace('-', '/')} — ${report.end.slice(5).replace('-', '/')}`}</span>{range === 'week' && <button className="icon-button" aria-label="下一周" onClick={() => moveWeek(7)}><ChevronRight size={18} /></button>}</div>
    <div className="chart-summary"><div><span>{kind === 'expense' ? '净支出' : '总收入'}</span><strong>¥{money(report.total)}</strong></div><div><span>{range === 'year' ? '月均' : '日均'}</span><b>¥{money(report.average)}</b></div><div><span>记录</span><b>{report.rows.length} 笔</b></div></div>
    <figure className="trend-figure"><svg viewBox="0 0 640 210" role="img" aria-label={`${range === 'year' ? '每月' : '每日'}${kind === 'expense' ? '净支出' : '收入'}趋势图`}>
      {[0, .5, 1].map(ratio => <line key={ratio} x1="20" x2="620" y1={30 + ratio * 135} y2={30 + ratio * 135} stroke="#e3eee7" strokeDasharray="4 4" />)}
      <polygon points={`20,${y(0)} ${points} 620,${y(0)}`} fill="#e9f7ef" /><polyline points={points} fill="none" stroke="#079066" strokeWidth="2.5" />
      {report.points.map((p, i) => <g key={p.key}><circle cx={x(i)} cy={y(p.value)} r={selected === i ? 5 : 3} fill={selected === i ? '#00714f' : '#fff'} stroke="#079066" strokeWidth="1.5" /><title>{p.key}：{money(p.value)}元</title>{(i === 0 || i === report.points.length - 1 || i % Math.ceil(report.points.length / 6) === 0) && <text x={x(i)} y="197" textAnchor="middle" fill="#718278" fontSize="13">{p.label}</text>}</g>)}
    </svg><figcaption>{selected === null ? (report.rows.length ? '点选日期查看金额' : '这个周期还没有记录') : `${report.points[selected].key} · ¥${money(report.points[selected].value)}`}</figcaption><div className="trend-dates" role="group" aria-label="查看趋势金额">{report.points.map((p, i) => <button key={p.key} className={selected === i ? 'selected' : ''} aria-label={`${p.key}，${money(p.value)}元`} onClick={() => setSelected(i)}>{p.label}</button>)}</div></figure>
    <div className="section-title"><h2>{kind === 'expense' ? '支出分类' : '收入分类'}</h2><span className="chart-count">{report.categories.length} 个分类</span></div>
    {report.categories.length ? <div className="category-ranking">{report.categories.map(c => <div className="category-ranking-row" key={c.label}><span className="activity-icon"><CategoryIcon label={c.label} kind={kind} size={20} /></span><div><div><b>{c.label}</b><small>{report.total > 0 ? `${(c.amount / report.total * 100).toFixed(1)}%` : '—'}</small><strong>¥{money(c.amount)}</strong></div><span className="ranking-track"><i style={{ width: `${Math.abs(c.amount) / maxCategory * 100}%`, background: c.amount < 0 ? '#83a397' : '#16a77b' } as CSSProperties} /></span></div></div>)}</div> : <div className="empty-state"><p>记下第一笔，消费分布就会出现在这里。</p></div>}
    {kind === 'expense' && report.rows.some(t => t.kind === 'refund') && <p className="form-help">历史退款已抵扣支出；分类比例按净支出计算。</p>}
  </section>;
}

export function BillSummary({ transactions, period, onMonth }: { transactions: Transaction[]; period: string; onMonth: (month: string) => void }) {
  const [year, setYear] = useState(Number(period.slice(0, 4))), [tab, setTab] = useState('month');
  const summarize = (prefix: string) => { const rows = transactions.filter(t => t.date.startsWith(prefix)); return { income: rows.reduce((s, t) => s + (t.kind === 'income' ? t.amount : 0), 0), expense: rows.reduce((s, t) => s + (t.kind === 'expense' ? t.amount : t.kind === 'refund' ? -t.amount : 0), 0) }; };
  const total = summarize(tab === 'month' ? String(year) : '');
  const years = [...new Set([Number(period.slice(0, 4)), ...transactions.map(t => Number(t.date.slice(0, 4)))])].sort((a, b) => b - a);
  const periods = tab === 'month' ? Array.from({ length: 12 }, (_, i) => `${year}-${String(12 - i).padStart(2, '0')}`) : years.map(String);
  return <div className="bill-summary"><div className="bill-controls">{tab === 'month' && <div><button className="icon-button" aria-label="上一年" disabled={year <= 1900} onClick={() => setYear(year - 1)}><ChevronLeft size={18} /></button><b>{year}年</b><button className="icon-button" aria-label="下一年" disabled={year >= 9999} onClick={() => setYear(year + 1)}><ChevronRight size={18} /></button></div>}<div className="report-range">{['month', 'year'].map((v, i) => <button key={v} className={tab === v ? 'selected' : ''} onClick={() => setTab(v)}>{['月账单', '年账单'][i]}</button>)}</div></div><div className="bill-total"><span>{tab === 'month' ? `${year}年收支结余` : '累计收支结余'}</span><strong>¥{money(total.income - total.expense)}</strong><p>收入 ¥{money(total.income)} <span>支出 ¥{money(total.expense)}</span></p></div><div className="bill-table"><div className="bill-table-head"><span>{tab === 'month' ? '月份' : '年份'}</span><span>收入</span><span>净支出</span><span>结余</span></div>{periods.map(p => { const data = summarize(p); return <button className="bill-table-row" key={p} onClick={() => { if (tab === 'year') { setYear(Number(p)); setTab('month'); } else onMonth(p); }}><span>{tab === 'month' ? `${Number(p.slice(5))}月` : `${p}年`}</span><span>{money(data.income)}</span><span>{money(data.expense)}</span><span className={data.income - data.expense < 0 ? 'danger' : ''}>{money(data.income - data.expense)}</span><ChevronRight size={13} /></button>; })}</div><p className="form-help">结余为记录收入减去净支出。账户可用金额按预算分配计算。</p></div>;
}
