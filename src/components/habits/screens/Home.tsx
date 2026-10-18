import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Plus, Trash2 } from 'lucide-react';
import { useRoutine } from '@/components/habits/RoutineProvider';
import { BellButton, CountUp, MiniGlass, Ring, StatTile } from '@/components/habits/ui';
import { greetingFor, habitStreak, isScheduled, toDay } from '@/lib/trackers';
import { haptic } from '@/hooks/useHaptics';
import { accountName } from '@/lib/accountName';
import { useAuth } from '@/contexts/AuthContext';

export type Nav = (s: { name: string; id?: string }) => void;

export function HomeScreen({ go }: { go: Nav }) {
  const { state, today, activeHabits, setNotifications, addTodo, toggleTodo, deleteTodo, bump } = useRoutine();
  const { user } = useAuth() as any;
  const reduced = useReducedMotion();
  const now = new Date();
  const [task, setTask] = useState('');

  const name = accountName(user).fullName || 'Friend';
  const firstName = accountName(user).firstName || name;
  const scheduled = activeHabits.filter(h => isScheduled(h.days, now));
  const val = (id: string, target: number) => state.entries[`${id}|${today}`]?.v ?? 0;
  const doneCount = scheduled.filter(h => val(h.id, h.target) >= h.target).length;
  const pct = scheduled.length ? doneCount / scheduled.length : 0;

  const water = activeHabits.find(h => h.type === 'water');
  const sleep = activeHabits.find(h => h.type === 'sleep');
  const exercise = activeHabits.find(h => h.type === 'minutes' && /exerc|gym|run|walk|yoga|workout/i.test(h.name)) ?? activeHabits.find(h => h.type === 'minutes');
  const bestStreak = useMemo(() => Math.max(0, ...activeHabits.map(h => habitStreak(state.entries, h, now))), [activeHabits, state.entries]);

  // Week strip: day labelled, filled when all scheduled habits done
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    const day = toDay(d);
    const sched = activeHabits.filter(h => isScheduled(h.days, d));
    const done = sched.filter(h => (state.entries[`${h.id}|${day}`]?.v ?? 0) >= h.target).length;
    return { day, label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), full: sched.length > 0 && done === sched.length, some: done > 0, isToday: i === 6 };
  }), [activeHabits, state.entries]);

  const microBars = (id: string) =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      const day = toDay(d);
      return state.entries[`${id}|${day}`]?.v ?? 0;
    });

  const submitTask = () => {
    if (!task.trim()) return;
    addTodo(task, 'medium');
    setTask('');
  };

  return (
    <div className="px-4 pb-32 pt-4 space-y-4">
      {/* greeting */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full nnh-gradient-btn grid place-items-center text-white font-bold text-sm shadow-md">
          {firstName.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>{greetingFor(now.getHours())},</p>
          <h1 className="text-[19px] font-extrabold leading-tight truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {firstName} <span className="nnh-anim-float inline-block">👋</span>
          </h1>
        </div>
        <p className="text-[11px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
          {now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
        <BellButton on={state.notifications} onClick={() => setNotifications(!state.notifications)} />
      </div>

      {/* today progress */}
      <motion.section initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="nnh-card p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--nnh-sub)' }}>
              <span className="w-5 h-5 rounded-full nnh-gradient-btn grid place-items-center text-white text-[10px]">✓</span>
              Today's Progress
            </p>
            <h2 className="text-[19px] font-extrabold mt-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              <CountUp value={doneCount} />/<CountUp value={scheduled.length} /> habits done
            </h2>
            <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--nnh-sub)' }}>
              {doneCount >= scheduled.length && scheduled.length > 0 ? "You're doing great! 🌟" : `You're doing great! Keep going 🚀`}
            </p>
            <div className="h-2 rounded-full mt-2.5 overflow-hidden" style={{ background: 'var(--nnh-line)' }}>
              <motion.div className="h-full rounded-full nnh-gradient-btn" initial={false} animate={{ width: `${pct * 100}%` }} transition={{ type: 'spring', stiffness: 60, damping: 16 }} />
            </div>
          </div>
          <Ring size={64} stroke={7} pct={pct}>
            <span className="text-[15px] font-extrabold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}><CountUp value={Math.round(pct * 100)} />%</span>
          </Ring>
        </div>
        {/* week strip */}
        <button type="button" onClick={() => go({ name: 'calendar' })} className="w-full text-left" aria-label="Open calendar">
          <div className="flex justify-between mt-4">
          {week.map(w => (
            <div key={w.day} className="flex flex-col items-center gap-1.5">
              <span className="text-[9px] font-bold" style={{ color: w.isToday ? 'var(--nnh-purple)' : 'var(--nnh-sub)' }}>{w.label}</span>
              <motion.span
                key={`${w.day}-${w.full}`}
                initial={false}
                animate={reduced ? {} : w.full ? { scale: [1, 1.25, 1] } : {}}
                className={`w-6.5 h-6.5 grid place-items-center rounded-full border-2 ${w.isToday ? 'ring-2 ring-offset-1' : ''}`}
                style={{ width: 26, height: 26, borderColor: w.full ? 'var(--nnh-purple)' : 'var(--nnh-line)', background: w.full ? 'var(--nnh-purple)' : w.some ? 'var(--nnh-card-soft)' : 'transparent', color: '#fff' }}
              >
                {w.full && <Check size={13} strokeWidth={3.4} />}
              </motion.span>
            </div>
          ))}
          </div>
        </button>
      </motion.section>

      {/* habit cards */}
      <div className="grid grid-cols-2 gap-3">
        {water && (
          <HabitCard label="Water" icon="💧" tint="#0ea5e9" onTap={() => go({ name: 'detail', id: water.id })}>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[11px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
                  <b className="text-[17px] text-[var(--nnh-ink)]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{state.entries[`${water.id}|${today}`]?.v ?? 0}</b> / {water.target} glasses
                </p>
                <MiniBar values={microBars(water.id)} color={water.color} />
              </div>
              <MiniGlass pct={(state.entries[`${water.id}` + `|${today}`]?.v ?? 0) / water.target} color={water.color} />
            </div>
          </HabitCard>
        )}
        {sleep && (
          <HabitCard label="Sleep" icon="🌙" tint="#8b5cf6" onTap={() => go({ name: 'sleep' })}>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
              <b className="text-[17px] text-[var(--nnh-ink)]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{fmtH(state.entries[`${sleep.id}|${today}`]?.v ?? 0)}</b> h
            </p>
            <MiniBar values={microBars(sleep.id)} color={sleep.color} />
          </HabitCard>
        )}
        {exercise && (
          <HabitCard label="Exercise" icon="🏃" tint="#22c55e" onTap={() => go({ name: 'exercise' })}>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
              <b className="text-[17px] text-[var(--nnh-ink)]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{state.entries[`${exercise.id}|${today}`]?.v ?? 0}</b> min
            </p>
            <MiniBar values={microBars(exercise.id)} color={exercise.color} />
          </HabitCard>
        )}
        <HabitCard label="Streak" icon="🔥" tint="#f97316" onTap={() => go({ name: 'streaks' })}>
          <div className="flex items-center gap-2">
            <span className="text-2xl nnh-anim-flicker inline-block">🔥</span>
            <div>
              <p className="text-[17px] font-extrabold leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                <CountUp value={bestStreak} /> <span className="text-[11px] font-bold" style={{ color: 'var(--nnh-sub)' }}>days</span>
              </p>
              <p className="text-[10px] font-medium mt-1" style={{ color: 'var(--nnh-sub)' }}>Best streak</p>
            </div>
          </div>
        </HabitCard>
      </div>

      {/* focus banner */}
      <motion.button whileTap={reduced ? undefined : { scale: 0.97 }} type="button" onClick={() => go({ name: 'focus' })}
        className="nnh-card w-full p-3.5 flex items-center gap-3 text-left overflow-hidden relative">
        <span className="absolute inset-0 opacity-60" style={{ background: 'linear-gradient(100deg, #fff7ed 0%, #ffe4e6 50%, #f5f3ff 100%)' }} aria-hidden="true" />
        {state.theme === 'dark' && <span className="absolute inset-0" style={{ background: 'linear-gradient(100deg, #3b2a1f 0%, #3b1f2a 50%, #2c2450 100%)' }} aria-hidden="true" />}
        <span className="relative w-11 h-11 rounded-2xl grid place-items-center text-2xl shadow-sm" style={{ background: '#fff' }}>🍅</span>
        <span className="relative flex-1 min-w-0">
          <span className="block text-[14px] font-bold">Focus Timer</span>
          <span className="block text-[11px] font-medium" style={{ color: 'var(--nnh-sub)' }}>{state.focus[today] ?? 0} session{state.focus[today] === 1 ? '' : 's'} today · 25 min pomodoro</span>
        </span>
        <span className="relative w-9 h-9 rounded-full nnh-gradient-btn grid place-items-center text-white">
          <svg viewBox="0 0 24 24" width="14" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </span>
      </motion.button>

      {/* tasks */}
      <section className="nnh-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-bold">Today's Tasks</h3>
          <span className="text-[11px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>{state.todos.filter(t => t.done).length}/{state.todos.length}</span>
        </div>
        <div className="flex gap-2 mb-3">
          <input value={task} onChange={e => setTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitTask()}
            placeholder="Add a task…" aria-label="Add a task"
            className="flex-1 min-w-0 h-10 rounded-xl px-3 text-[13px] outline-none border" style={{ background: 'var(--nnh-card-soft)', borderColor: 'var(--nnh-line)' }} />
          <motion.button whileTap={reduced ? undefined : { scale: 0.9 }} type="button" onClick={submitTask} aria-label="Add task"
            className="w-10 h-10 rounded-xl nnh-gradient-btn text-white grid place-items-center"><Plus size={18} strokeWidth={2.6} /></motion.button>
        </div>
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {state.todos.slice(0, 5).map(t => (
              <motion.div key={t.id} layout initial={reduced ? false : { opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14, height: 0 }}
                className="flex items-center gap-2.5 p-2 rounded-xl" style={{ background: 'var(--nnh-card-soft)' }}>
                <motion.button whileTap={{ scale: 0.75 }} type="button" onClick={() => toggleTodo(t.id)} aria-label={`Complete ${t.title}`}
                  className="w-6 h-6 rounded-full border-2 grid place-items-center shrink-0"
                  style={{ borderColor: t.done ? 'var(--nnh-purple)' : 'var(--nnh-line)', background: t.done ? 'var(--nnh-purple)' : 'transparent', color: '#fff' }}>
                  {t.done && <Check size={13} strokeWidth={3.4} />}
                </motion.button>
                <span className={`flex-1 text-[13px] font-medium truncate ${t.done ? 'line-through' : ''}`} style={t.done ? { color: 'var(--nnh-sub)' } : undefined}>{t.title}</span>
                <span className="w-1.5 h-4 rounded-full" style={{ background: t.priority === 'high' ? '#ef4444' : t.priority === 'medium' ? '#f59e0b' : '#22c55e' }} aria-hidden="true" />
                <button type="button" onClick={() => deleteTodo(t.id)} aria-label={`Delete ${t.title}`} className="p-1" style={{ color: 'var(--nnh-sub)' }}><Trash2 size={14} /></button>
              </motion.div>
            ))}
          </AnimatePresence>
          {!state.todos.length && <p className="text-[12px] text-center py-2" style={{ color: 'var(--nnh-sub)' }}>No tasks — enjoy your day! 🌈</p>}
        </div>
      </section>

      {/* quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile value={<CountUp value={activeHabits.length} />} label="Habits" accent="#8b5cf6" />
        <StatTile value={<CountUp value={doneCount + state.todos.filter(t => t.done).length} />} label="Done today" accent="#22c55e" />
        <StatTile value={<CountUp value={state.focus[today] ?? 0} />} label="Focus" accent="#ef4444" />
      </div>
    </div>
  );
}

function fmtH(v: number) { return v % 1 ? v.toFixed(1) : String(v); }

function HabitCard({ label, icon, tint, onTap, children }: { label: string; icon: string; tint: string; onTap: () => void; children: React.ReactNode }) {
  return (
    <motion.button whileTap={{ scale: 0.96 }} whileHover={{ y: -2 }} type="button" onClick={onTap}
      className="nnh-card p-3.5 text-left relative overflow-hidden min-h-[104px] flex flex-col justify-between">
      <span className="absolute -right-4 -top-4 w-16 h-16 rounded-full" style={{ background: tint, opacity: 0.12 }} aria-hidden="true" />
      <span className="flex items-center gap-1.5 text-[11px] font-bold relative">
        <span className="w-6 h-6 rounded-lg grid place-items-center text-[13px]" style={{ background: `${tint}22` }}>{icon}</span>
        <span style={{ color: tint }}>{label}</span>
      </span>
      <div className="relative mt-2">{children}</div>
    </motion.button>
  );
}

function MiniBar({ values, color }: { values: number[]; color: string }) {
  const m = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-1 h-6 mt-1.5">
      {values.map((v, i) => (
        <motion.span key={i} initial={false} animate={{ height: Math.max(3, (v / m) * 24) }} transition={{ delay: i * 0.04, type: 'spring', stiffness: 120, damping: 18 }}
          className="w-1.5 rounded-full" style={{ background: v > 0 ? color : 'var(--nnh-line)' }} />
      ))}
    </div>
  );
}
