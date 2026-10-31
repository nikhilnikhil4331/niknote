// ============================================================
// NikNote — Productivity Overview (real-data analytics)
// KPI cards + interactive chart fed exclusively by saved data
// (focus sessions, tasks, notes, habit logs). No sample numbers.
// Delta badges only appear when a valid previous period exists.
// ============================================================

import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts';
import { useReducedMotion } from 'framer-motion';
import {
  Timer, ListChecks, NotebookPen, HeartPulse, TrendingUp, TrendingDown,
} from 'lucide-react';
import {
  useFocusSessions, useTasks, useDesktopHabits, habitRangeTotal, habitCheckinsByDay,
  type NikFocusSession,
} from '../store';
import type { DNote } from '../notes';
import {
  lastNDays, lastNMonths, dayLabel, monthLabel, dayKeyOf,
  focusMinutesByDay, focusMinutesByMonth, tasksCompletedByDay, tasksCompletedByMonth,
  notesCreatedByDay, notesCreatedByMonth,
  deltaPct, sum, formatMinutesAsHours,
} from '@/lib/productivity';
import { cn } from '@/lib/utils';

type Period = 'week' | 'month' | 'year';
type Metric = 'focus' | 'tasks' | 'notes' | 'habits';

const METRICS: { id: Metric; label: string; color: string; icon: React.ElementType; unit: string }[] = [
  { id: 'focus', label: 'Focus Time', color: '#662249', icon: Timer, unit: 'min' },
  { id: 'tasks', label: 'Tasks Done', color: '#A34054', icon: ListChecks, unit: '' },
  { id: 'notes', label: 'Notes Created', color: '#ED9E59', icon: NotebookPen, unit: '' },
  { id: 'habits', label: 'Habit Logs', color: '#157F52', icon: HeartPulse, unit: '' },
];

const PERIODS: { id: Period; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

interface Row { key: string; label: string; value: number; isToday: boolean }

export const ProductivityOverview: React.FC<{ notes: DNote[] }> = ({ notes }) => {
  const { sessions } = useFocusSessions();
  const { tasks } = useTasks();
  const { habits } = useDesktopHabits();
  const reduced = useReducedMotion();

  const [period, setPeriod] = useState<Period>('week');
  const [metric, setMetric] = useState<Metric>('focus');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // ---------- period keys ----------
  const { keys, prevKeys, labelOf } = useMemo(() => {
    if (period === 'week') {
      const weekAgoStart = new Date(Date.now() - 7 * 86400000);
      return {
        keys: lastNDays(7),
        prevKeys: lastNDays(7, weekAgoStart),
        labelOf: (k: string) => dayLabel(k),
      };
    }
    if (period === 'month') {
      const mAgoStart = new Date(Date.now() - 30 * 86400000);
      return {
        keys: lastNDays(30),
        prevKeys: lastNDays(30, mAgoStart),
        labelOf: (k: string) => new Date(`${k}T00:00:00`).getDate().toString(),
      };
    }
    const yearAgoStart = new Date(new Date().getFullYear() - 1, new Date().getMonth(), 1);
    return {
      keys: lastNMonths(12),
      prevKeys: lastNMonths(12, yearAgoStart),
      labelOf: (k: string) => monthLabel(k),
    };
  }, [period]);

  const perDay = period !== 'year';

  // ---------- series per metric ----------
  const series = useMemo(() => {
    if (perDay) {
      return {
        focus: focusMinutesByDay(sessions, keys),
        tasks: tasksCompletedByDay(tasks, keys),
        notes: notesCreatedByDay(notes, keys),
        habits: habitCheckinsByDay(habits, keys),
      };
    }
    return {
      focus: focusMinutesByMonth(sessions, keys),
      tasks: tasksCompletedByMonth(tasks, keys),
      notes: notesCreatedByMonth(notes, keys),
      habits: keys.map(() => 0), // habit score is day-scoped; yearly habit detail stays empty (honest)
    };
  }, [sessions, tasks, notes, habits, keys, perDay]);

  const prevSeries = useMemo(() => {
    if (perDay) {
      return {
        focus: focusMinutesByDay(sessions, prevKeys),
        tasks: tasksCompletedByDay(tasks, prevKeys),
        notes: notesCreatedByDay(notes, prevKeys),
      };
    }
    return {
      focus: focusMinutesByMonth(sessions, prevKeys),
      tasks: tasksCompletedByMonth(tasks, prevKeys),
      notes: notesCreatedByMonth(notes, prevKeys),
    };
  }, [sessions, tasks, notes, prevKeys, perDay]);

  // ---------- KPI values ----------
  const kpis = useMemo(() => {
    const focusNow = sum(series.focus);
    const focusPrev = sum(prevSeries.focus);
    const tasksNow = sum(series.tasks);
    const tasksPrev = sum(prevSeries.tasks);
    const notesNow = sum(series.notes);
    const notesPrev = sum(prevSeries.notes);
    const habitNow = habits.length
      ? Math.round(
          (sum(habits.map((h) => Math.min(habitRangeTotal(h, 0, 6), h.target))) /
            Math.max(1, sum(habits.map((h) => h.target)))) * 100,
        )
      : 0;
    const habitPrev = habits.length
      ? Math.round(
          (sum(habits.map((h) => Math.min(habitRangeTotal(h, 7, 13), h.target))) /
            Math.max(1, sum(habits.map((h) => h.target)))) * 100,
        )
      : 0;
    return [
      {
        id: 'focus' as const, label: 'Focus Time', value: formatMinutesAsHours(focusNow),
        delta: deltaPct(focusNow, focusPrev), color: '#662249', bg: 'hsl(var(--primary) / 0.14)', icon: Timer,
      },
      {
        id: 'tasks' as const, label: 'Tasks Completed', value: String(tasksNow),
        delta: deltaPct(tasksNow, tasksPrev), color: '#A34054', bg: 'hsl(var(--accent-rose-hsl) / 0.16)', icon: ListChecks,
      },
      {
        id: 'notes' as const, label: 'Notes Created', value: String(notesNow),
        delta: deltaPct(notesNow, notesPrev), color: '#C4762F', bg: 'hsl(var(--accent-primary-hsl) / 0.18)', icon: NotebookPen,
      },
      {
        id: 'habits' as const, label: 'Habit Score', value: `${habitNow}%`,
        delta: deltaPct(habitNow, habitPrev), color: '#157F52', bg: 'hsl(var(--success) / 0.16)', icon: HeartPulse,
        caption: 'last 7 days',
      },
    ];
  }, [series, prevSeries, habits]);

  const rows: Row[] = useMemo(() => {
    const today = dayKeyOf(new Date());
    return keys.map((k, i) => ({
      key: k,
      label: labelOf(k),
      value: Math.round(series[metric][i] * 10) / 10,
      isToday: perDay && k === today,
    }));
  }, [keys, labelOf, series, metric, perDay]);

  const activeMetric = METRICS.find((m) => m.id === metric)!;
  const allEmpty = kpis.every((k, i) => (i === 3 ? false : parseFloat(String(k.value)) === 0)) && sum(series.habits) === 0;

  /** Records behind the selected bar (honest drill-down). */
  const selectedDetail = useMemo(() => {
    if (!selectedKey || !perDay) return null;
    const daySessions = sessions.filter((s) => dayKeyOf(new Date(s.startedAt)) === selectedKey);
    const dayTasks = tasks.filter((t) => t.status === 'done' && t.doneAt && dayKeyOf(new Date(t.doneAt)) === selectedKey);
    const dayNotes = notes.filter((n) => dayKeyOf(new Date(n.createdAt)) === selectedKey);
    return { sessions: daySessions, tasks: dayTasks, notes: dayNotes };
  }, [selectedKey, perDay, sessions, tasks, notes]);

  const valueText = (v: number) =>
    metric === 'focus' ? formatMinutesAsHours(v) : `${v}${metric === 'habits' ? ' logs' : ''}`;

  if (allEmpty) {
    return (
      <div className="nd-card p-6 text-center">
        <div className="text-[34px] nd-float" aria-hidden>📊</div>
        <p className="text-[14.5px] font-bold mt-1" style={{ color: 'var(--nd-ink)' }}>
          Your productivity story starts here
        </p>
        <p className="text-[12.5px] mt-1.5 max-w-[420px] mx-auto" style={{ color: 'var(--nd-ink-2)' }}>
          Complete a focus session, finish a task or write a note — your real activity builds these charts automatically. Nothing here is sample data.
        </p>
      </div>
    );
  }

  return (
    <div className="nd-card p-5">
      {/* header */}
      <div className="flex items-center flex-wrap gap-3 mb-4">
        <div className="flex gap-1.5 flex-wrap">
          {METRICS.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                className={cn('nd-chip-btn !text-[11.5px] inline-flex items-center gap-1.5', metric === m.id && 'nd-on')}
                style={metric === m.id ? { background: m.color, borderColor: m.color } : undefined}
                aria-pressed={metric === m.id}
                onClick={() => { setMetric(m.id); setSelectedKey(null); }}
              >
                <Icon size={11} /> {m.label}
              </button>
            );
          })}
        </div>
        <div className="nd-vtabs ml-auto">
          {PERIODS.map((p) => (
            <button key={p.id} className={cn(period === p.id && 'nd-on')} onClick={() => { setPeriod(p.id); setSelectedKey(null); }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.id} className="nd-kpi">
              <span className="nd-kpi-ic" style={{ background: k.bg, color: k.color }}>
                <Icon size={17} />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold truncate" style={{ color: 'var(--nd-text-3)' }}>
                  {k.label}{k.caption ? ` · ${k.caption}` : ''}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[19px] font-extrabold tabular-nums" style={{ color: 'var(--nd-ink)' }}>
                    {k.value}
                  </span>
                  {k.delta !== null && (
                    <span className={cn('nd-delta', k.delta >= 0 ? 'nd-up' : 'nd-down')} title="vs previous period">
                      {k.delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {Math.abs(k.delta)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* chart */}
      <div style={{ width: '100%', height: 196 }}>
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 6, right: 4, left: -18, bottom: 0 }} barCategoryGap={perDay && keys.length > 10 ? '18%' : '32%'}>
            <CartesianGrid vertical={false} stroke="#f0ebf9" />
            <XAxis
              dataKey="label" tickLine={false} axisLine={false}
              tick={{ fontSize: 10.5, fill: '#a39cc0', fontWeight: 600 }}
              interval={period === 'month' ? 4 : 0}
            />
            <YAxis
              tickLine={false} axisLine={false}
              tick={{ fontSize: 10.5, fill: '#a39cc0', fontWeight: 600 }}
              tickFormatter={(v: number) => (metric === 'focus' ? (v >= 60 ? `${Math.round(v / 60)}h` : `${v}m`) : String(v))}
            />
            <Tooltip
              cursor={{ fill: 'rgba(112,40,217,0.06)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as Row;
                const i = keys.indexOf(row.key);
                return (
                  <div className="nd-chart-tip">
                    <div className="font-bold text-[12px]" style={{ color: 'var(--nd-ink)' }}>
                      {perDay ? new Date(`${row.key}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : monthLabel(row.key)}
                    </div>
                    <div className="mt-1 space-y-0.5" style={{ color: 'var(--nd-ink-2)' }}>
                      <div><b style={{ color: 'hsl(var(--accent-cool-hsl))' }}>{formatMinutesAsHours(series.focus[i] ?? 0)}</b> focused</div>
                      <div><b style={{ color: 'hsl(var(--accent-rose-hsl))' }}>{series.tasks[i] ?? 0}</b> tasks done</div>
                      <div><b style={{ color: 'hsl(var(--accent-warm-hsl))' }}>{series.notes[i] ?? 0}</b> notes created</div>
                      {perDay && <div><b style={{ color: 'hsl(var(--success))' }}>{series.habits[i] ?? 0}</b> habit logs</div>}
                    </div>
                    {perDay && <div className="mt-1 text-[10px] font-semibold" style={{ color: 'var(--nd-text-3)' }}>Click for details</div>}
                  </div>
                );
              }}
            />
            <Bar
              dataKey="value"
              radius={[6, 6, 2, 2]}
              isAnimationActive={!reduced}
              animationDuration={500}
              onClick={(data) => {
                const row = (data as unknown as { payload?: Row }).payload;
                if (perDay && row) setSelectedKey((k) => (k === row.key ? null : row.key));
              }}
            >
              {rows.map((r) => (
                <Cell
                  key={r.key}
                  fill={r.key === selectedKey ? '#44174E' : r.isToday ? '#A34054' : activeMetric.color}
                  fillOpacity={selectedKey && r.key !== selectedKey ? 0.35 : r.isToday ? 1 : 0.82}
                  style={{ cursor: perDay ? 'pointer' : 'default' }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10.5px] font-semibold mt-1" style={{ color: 'var(--nd-text-3)' }}>
        {activeMetric.label}{metric === 'focus' ? ' in minutes' : ''} · {PERIODS.find((p) => p.id === period)?.label} — from your saved sessions, tasks and notes
        {perDay && ' · click a bar to inspect that day'}
      </p>

      {/* day drill-down */}
      {selectedKey && selectedDetail && (
        <div className="mt-3 rounded-xl p-3" style={{ background: 'var(--nd-lavender)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold" style={{ color: 'var(--nd-ink)' }}>
              {new Date(`${selectedKey}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <button className="text-[11px] font-bold" style={{ color: 'var(--nd-brand-magenta)' }} onClick={() => setSelectedKey(null)}>
              Close
            </button>
          </div>
          <div className="mt-2 space-y-1 text-[12px]" style={{ color: 'var(--nd-ink-2)' }}>
            {selectedDetail.sessions.map((s: NikFocusSession) => (
              <div key={s.id} className="flex justify-between">
                <span>🎯 {s.category}{s.taskTitle ? ` · ${s.taskTitle}` : ''}</span>
                <b className="tabular-nums">{formatMinutesAsHours(s.durationSec / 60)}</b>
              </div>
            ))}
            {selectedDetail.tasks.map((t) => (
              <div key={t.id} className="flex justify-between"><span>✅ {t.title}</span></div>
            ))}
            {selectedDetail.notes.map((n) => (
              <div key={n.id} className="flex justify-between"><span>📝 {n.title}</span></div>
            ))}
            {!selectedDetail.sessions.length && !selectedDetail.tasks.length && !selectedDetail.notes.length && (
              <div style={{ color: 'var(--nd-text-3)' }}>No recorded activity on this day.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductivityOverview;
