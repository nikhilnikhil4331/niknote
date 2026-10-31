// ============================================================
// NikNote Desktop — RightRail (mockup right column)
// Focus Timer (Pomodoro/Timer/Stopwatch) + Today's Tasks +
// Habit rings + Mini calendar. Every widget reads the shared
// desktop stores, so the rail always agrees with the pages.
// ============================================================

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check, Plus, Play, Timer, ListChecks, HeartPulse, CalendarDays, ChevronRight,
} from 'lucide-react';
import { FocusTimerPanel } from './focus/FocusTimerPanel';
import { Ring } from './widgets';
import { MiniMonthCalendar } from './MiniMonthCalendar';
import {
  useTasks, useDesktopHabits, useLinkedTask, habitWeekTotal, todayKey,
  TASK_TAGS, type NikTask,
} from './store';
import type { DNote } from './notes';
import { cn } from '@/lib/utils';

const tagColor = (name?: string) =>
  TASK_TAGS.find((t) => t.name === name)?.color ?? '#5C3A6E';

export const RightRail: React.FC<{ notes: DNote[] }> = ({ notes }) => {
  const navigate = useNavigate();
  const { tasks, addTask, toggleDone } = useTasks();
  const { habits, logToday } = useDesktopHabits();
  const { taskId: linkedTaskId, setTaskId: setLinkedTask } = useLinkedTask();
  const [newTask, setNewTask] = useState('');
  const [adding, setAdding] = useState(false);

  const today = todayKey();
  const todayTasks = useMemo(() => {
    const relevant = tasks.filter((t) => t.due === today || (!t.due && t.status !== 'done'));
    const open = relevant.filter((t) => t.status !== 'done');
    const done = relevant.filter((t) => t.status === 'done');
    return [...open, ...done].slice(0, 6);
  }, [tasks, today]);

  const submitTask = () => {
    const title = newTask.trim();
    if (!title) return;
    addTask(title, 'todo', today);
    setNewTask('');
    setAdding(false);
  };

  const startFocusFor = (t: NikTask) => {
    setLinkedTask(t.id);
    // The timer panel above adopts the linked task instantly (shared store).
    document.getElementById('nd-focus-timer-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- Focus Timer ---------- */}
      <section className="nd-card p-4 nd-anim" id="nd-focus-timer-card" aria-label="Focus timer">
        <div className="flex items-center justify-between mb-3">
          <h3 className="nd-rail-title">
            <Timer size={15} style={{ color: 'var(--nd-brand-magenta)' }} /> Focus Timer
          </h3>
          <button
            className="text-[11px] font-bold inline-flex items-center gap-0.5"
            style={{ color: 'var(--nd-brand)' }}
            onClick={() => navigate('/focus')}
          >
            Full view <ChevronRight size={12} />
          </button>
        </div>
        <FocusTimerPanel tasks={tasks} compact />
      </section>

      {/* ---------- Today's tasks ---------- */}
      <section className="nd-card p-4 nd-anim nd-anim-1" aria-label="Today's tasks">
        <div className="flex items-center justify-between mb-3">
          <h3 className="nd-rail-title">
            <ListChecks size={15} style={{ color: 'var(--nd-brand)' }} /> Today&apos;s Tasks
          </h3>
          <button
            className="text-[11px] font-bold inline-flex items-center gap-1"
            style={{ color: 'var(--nd-brand-magenta)' }}
            onClick={() => setAdding((v) => !v)}
            aria-expanded={adding}
          >
            <Plus size={12} /> Add
          </button>
        </div>

        {adding && (
          <div className="flex items-center gap-2 mb-3">
            <input
              className="nd-input !py-1.5 !text-[12.5px]"
              placeholder="Task for today…"
              value={newTask}
              autoFocus
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitTask(); if (e.key === 'Escape') setAdding(false); }}
            />
            <button className="nd-btn-cta !py-1.5 !px-3 !text-[12px]" onClick={submitTask}>Add</button>
          </div>
        )}

        <div className="flex flex-col">
          {todayTasks.length === 0 && (
            <p className="text-[12.5px] py-2" style={{ color: 'var(--nd-text-3)' }}>
              No tasks for today yet — add one ✨
            </p>
          )}
          {todayTasks.map((t) => {
            const done = t.status === 'done';
            const linked = linkedTaskId === t.id;
            return (
              <div
                key={t.id}
                className="flex items-center gap-2.5 py-2 group"
                style={{ borderBottom: '1px solid var(--nd-border-soft)' }}
              >
                <button
                  className={cn('nd-check', done && 'nd-done')}
                  onClick={() => toggleDone(t)}
                  title={done ? 'Reopen task' : 'Mark done'}
                  aria-label={done ? `Reopen ${t.title}` : `Complete ${t.title}`}
                  aria-pressed={done}
                >
                  <Check size={12} strokeWidth={3.2} />
                </button>
                <div className="flex-1 min-w-0">
                  <span
                    className="block text-[13px] font-semibold truncate"
                    style={{
                      color: done ? 'var(--nd-text-3)' : 'var(--nd-ink)',
                      textDecoration: done ? 'line-through' : 'none',
                    }}
                  >
                    {t.title}
                  </span>
                  <span className="flex items-center gap-1.5 mt-0.5">
                    {t.tag && (
                      <span className="nd-tag" style={{ background: `${tagColor(t.tag)}1c`, color: tagColor(t.tag) }}>
                        {t.tag}
                      </span>
                    )}
                    {t.time && (
                      <span className="text-[10.5px] font-semibold tabular-nums" style={{ color: 'var(--nd-text-3)' }}>{t.time}</span>
                    )}
                  </span>
                </div>
                {!done && (
                  <button
                    className="nd-icon-btn !w-7 !h-7 flex-none"
                    title={linked ? 'Linked to focus timer' : `Focus on ${t.title}`}
                    aria-label={linked ? `${t.title} is linked to the focus timer` : `Start a focus session for ${t.title}`}
                    onClick={() => startFocusFor(t)}
                  >
                    <Play
                      size={12}
                      fill={linked ? '#A34054' : 'none'}
                      style={{ color: linked ? '#A34054' : 'var(--nd-text-3)' }}
                    />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {tasks.length > todayTasks.length && (
          <button
            className="mt-2.5 w-full text-center text-[11.5px] font-bold py-1 rounded-lg hover:bg-[color:hsl(var(--primary)/0.06)] transition-colors"
            style={{ color: 'var(--nd-brand)' }}
            onClick={() => navigate('/tasks')}
          >
            View all {tasks.filter((t) => t.status !== 'done').length} open tasks
          </button>
        )}
      </section>

      {/* ---------- Habits ---------- */}
      <section className="nd-card p-4 nd-anim nd-anim-2" aria-label="Habit tracker">
        <div className="flex items-center justify-between mb-3">
          <h3 className="nd-rail-title">
            <HeartPulse size={15} style={{ color: 'var(--nd-brand-pink)' }} /> Habit Tracker
          </h3>
          <span className="text-[10.5px] font-bold" style={{ color: 'var(--nd-text-3)' }}>This Week</span>
        </div>
        <div className="grid grid-cols-4 gap-1 justify-items-center">
          {habits.map((h) => (
            <Ring
              key={h.id}
              label={h.name}
              value={Math.min(habitWeekTotal(h), h.target)}
              target={h.target}
              color={h.color}
              size={58}
              stroke={5.5}
              onClick={() => logToday(h.id)}
              title={`${h.name}: ${habitWeekTotal(h)}/${h.target} ${h.unit} this week — click to log today`}
            />
          ))}
        </div>
        <button
          className="mt-3 w-full text-center text-[11.5px] font-bold py-1 rounded-lg hover:bg-[color:hsl(var(--primary)/0.06)] transition-colors"
          style={{ color: 'var(--nd-brand)' }}
          onClick={() => navigate('/habit')}
        >
          Open full habit app
        </button>
      </section>

      {/* ---------- Mini calendar ---------- */}
      <section className="nd-card p-4 nd-anim nd-anim-3" aria-label="Calendar">
        <div className="flex items-center justify-between mb-2">
          <h3 className="nd-rail-title">
            <CalendarDays size={15} style={{ color: 'var(--nd-brand-orange)' }} /> Calendar
          </h3>
          <button
            className="text-[11px] font-bold"
            style={{ color: 'var(--nd-brand)' }}
            onClick={() => navigate('/calendar')}
          >
            Open
          </button>
        </div>
        <MiniMonthCalendar notes={notes} />
      </section>
    </div>
  );
};

export default RightRail;
