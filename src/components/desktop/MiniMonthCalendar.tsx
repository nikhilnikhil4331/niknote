// ============================================================
// NikNote Desktop — MiniMonthCalendar (right-rail month view)
// Compact month grid with activity dots from REAL records
// (tasks due, notes created/edited, focus sessions), one dot per
// colour — no duplicates when a task is updated.
// ============================================================

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dayKey } from './MonthCalendar';
import { useTasks, useFocusSessions } from './store';
import type { DNote } from './notes';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const MiniMonthCalendar: React.FC<{ notes: DNote[] }> = ({ notes }) => {
  const navigate = useNavigate();
  const { tasks } = useTasks();
  const { sessions } = useFocusSessions();
  const today = dayKey(new Date());
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  /** day → set of dot colours (task due / note activity / focus session) */
  const dots = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const add = (key: string | null, color: string) => {
      if (!key) return;
      const s = map.get(key) ?? new Set<string>();
      s.add(color);
      map.set(key, s);
    };
    for (const t of tasks) add(t.due || null, '#D92C9B');
    for (const n of notes) {
      const k = (n.createdAt || '').slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(k)) add(k, '#FFAD45');
    }
    for (const s of sessions) add((s.startedAt || '').slice(0, 10), '#7028D9');
    return map;
  }, [tasks, notes, sessions]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const offset = first.getDay(); // Sunday-first
    const start = new Date(year, month, 1 - offset);
    const count = Math.ceil((offset + new Date(year, month + 1, 0).getDate()) / 7) * 7;
    return Array.from({ length: count }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12.5px] font-extrabold" style={{ color: 'var(--nd-ink)' }}>{monthLabel}</span>
        <div className="flex items-center gap-0.5">
          <button
            className="nd-icon-btn !w-6 !h-6"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            title="Previous month"
            aria-label="Previous month"
          >
            <ChevronLeft size={13} />
          </button>
          <button
            className="nd-icon-btn !w-6 !h-6"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            title="Next month"
            aria-label="Next month"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center mb-0.5">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="text-[9.5px] font-bold uppercase" style={{ color: 'var(--nd-text-3)' }}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((date) => {
          const key = dayKey(date);
          const inMonth = date.getMonth() === cursor.getMonth();
          const dayDots = dots.get(key);
          return (
            <button
              key={key}
              className={cn('nd-mini-cal-day', !inMonth && 'nd-mc-out', key === today && 'nd-mc-today')}
              onClick={() => navigate('/calendar')}
              title={`${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — open calendar`}
              aria-label={`${date.toLocaleDateString('en-IN', { dateStyle: 'medium' })}${dayDots ? `, ${dayDots.size} activit${dayDots.size === 1 ? 'y' : 'ies'}` : ''}`}
            >
              <span>{date.getDate()}</span>
              <span className="flex gap-[2px] h-[3.5px] items-center" aria-hidden>
                {dayDots &&
                  [...dayDots].slice(0, 3).map((c) => (
                    <span key={c} className="nd-mc-dot" style={{ background: key === today ? '#fff' : c }} />
                  ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MiniMonthCalendar;
