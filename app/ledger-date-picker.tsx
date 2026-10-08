'use client';

import { useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { today } from '@/lib/ledger';

const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

function parts(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

export function LedgerDatePicker({ value, onChange, label }: { value: string; onChange: (date: string) => void; label: string }) {
  const selected = parts(value);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(() => new Date(selected.year, selected.month - 1, 1));
  const firstWeekday = (new Date(visible.getFullYear(), visible.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(visible.getFullYear(), visible.getMonth() + 1, 0).getDate();
  const currentDate = today();
  const dateString = (day: number) => `${visible.getFullYear()}-${String(visible.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const changeMonth = (offset: number) => setVisible(new Date(visible.getFullYear(), visible.getMonth() + offset, 1));
  const choose = (date: string) => { onChange(date); setOpen(false); };

  return <Popover open={open} onOpenChange={next => { setOpen(next); if (next) setVisible(new Date(selected.year, selected.month - 1, 1)); }}>
    <PopoverTrigger asChild>
      <button type="button" className="ledger-date-trigger" aria-label={label} aria-expanded={open}>
        <span>{value.replaceAll('-', '/')}</span><CalendarDays size={17} aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverContent className="ledger-date-popover" align="end" sideOffset={9} collisionPadding={12}>
      <div className="ledger-date-head">
        <strong>{visible.getFullYear()}年{visible.getMonth() + 1}月</strong>
        <div>
          <button type="button" onClick={() => changeMonth(-1)} aria-label="上个月"><ChevronLeft size={18}/></button>
          <button type="button" onClick={() => changeMonth(1)} aria-label="下个月"><ChevronRight size={18}/></button>
        </div>
      </div>
      <div className="ledger-date-weekdays">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
      <div className="ledger-date-days">
        {Array.from({ length: firstWeekday }, (_, i) => <span key={`blank-${i}`} aria-hidden="true" />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const date = dateString(day);
          return <button type="button" key={date} onClick={() => choose(date)} className={(date === value ? 'selected ' : '') + (date === currentDate ? 'today' : '')} aria-label={`${visible.getFullYear()}年${visible.getMonth() + 1}月${day}日`} aria-pressed={date === value}>{day}</button>;
        })}
      </div>
      <div className="ledger-date-foot"><button type="button" onClick={() => choose(currentDate)}>今天</button></div>
    </PopoverContent>
  </Popover>;
}

export function LedgerMonthPicker({ value, onChange }: { value: string; onChange: (month: string) => void }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  const selectedYear = Number(value.slice(0, 4));
  const selectedMonth = Number(value.slice(5, 7));
  const selectMonth = (month: number) => {
    onChange(`${year}-${String(month).padStart(2, '0')}`);
    setOpen(false);
  };

  return <Popover open={open} onOpenChange={next => { setOpen(next); if (next) setYear(selectedYear); }}>
    <PopoverTrigger asChild>
      <button type="button" className="ledger-month-trigger" aria-label="查看月份" aria-expanded={open}>
        <CalendarDays size={16} aria-hidden="true"/><span>{selectedYear}年{selectedMonth}月</span><ChevronDown size={14} aria-hidden="true"/>
      </button>
    </PopoverTrigger>
    <PopoverContent className="ledger-month-popover" align="start" sideOffset={6} collisionPadding={12}>
      <div className="ledger-date-head"><strong>{year}年</strong><div><button type="button" onClick={() => setYear(year - 1)} aria-label="上一年"><ChevronLeft size={18}/></button><button type="button" onClick={() => setYear(year + 1)} aria-label="下一年"><ChevronRight size={18}/></button></div></div>
      <div className="ledger-month-grid">{Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const active = year === selectedYear && month === selectedMonth;
        return <button type="button" key={month} className={active ? 'selected' : ''} aria-pressed={active} onClick={() => selectMonth(month)}>{month}月</button>;
      })}</div>
      <div className="ledger-date-foot"><button type="button" onClick={() => { onChange(today().slice(0, 7)); setOpen(false); }}>本月</button></div>
    </PopoverContent>
  </Popover>;
}
