// ============================================================
// NikNote Desktop — month calendar grid (mockup style)
// ============================================================

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CalItem {
  id: string;
  title: string;
  date: string; // ISO or YYYY-MM-DD
  color: string;
  kind: 'note' | 'task';
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export { dayKey };

export const MonthCalendar: React.FC<{
  items: CalItem[];
  selected: string;
  onSelectDay: (key: string) => void;
  onItemClick: (item: CalItem) => void;
}> = ({ items, selected, onSelectDay, onItemClick }) => {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const byDay = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    for (const it of items) {
      const k = (it.date || '').slice(0, 10);
      if (!k) continue;
      const arr = map.get(k) || [];
      arr.push(it);
      map.set(k, arr);
    }
    return map;
  }, [items]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    // Monday-first offset
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [cursor]);

  const today = dayKey(new Date());
  const monthLabel = cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="nd-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--nd-border)' }}>
        <span className="text-[15px] font-bold" style={{ color: 'var(--nd-text)' }}>{monthLabel}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            className="nd-btn-ghost !py-1.5"
            onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); onSelectDay(today); }}
          >
            Today
          </button>
          <button className="nd-icon-btn" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))} title="Previous month">
            <ChevronLeft size={16} />
          </button>
          <button className="nd-icon-btn" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} title="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="nd-cal-grid" style={{ borderBottom: '1px solid var(--nd-border)' }}>
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center py-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--nd-text-3)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="nd-cal-grid">
        {cells.map((date, i) => {
          const key = dayKey(date);
          const inMonth = date.getMonth() === cursor.getMonth();
          const dayItems = byDay.get(key) || [];
          return (
            <div
              key={key}
              className={cn('nd-cal-day', !inMonth && 'nd-out', selected === key && 'nd-selected')}
              style={i % 7 === 6 ? { borderRight: 'none' } : undefined}
              onClick={() => onSelectDay(key)}
            >
              <span className={cn('nd-cal-num', key === today && 'nd-today')}>{date.getDate()}</span>
              {dayItems.slice(0, 3).map((it) => (
                <div
                  key={it.id + it.kind}
                  className="nd-cal-ev"
                  style={{ background: `${it.color}22`, color: it.color }}
                  title={it.title}
                  onClick={(e) => { e.stopPropagation(); onItemClick(it); }}
                >
                  {it.kind === 'task' ? '✓ ' : ''}{it.title}
                </div>
              ))}
              {dayItems.length > 3 && (
                <div className="text-[10.5px] font-semibold mt-1" style={{ color: 'var(--nd-text-3)' }}>
                  +{dayItems.length - 3} more
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
