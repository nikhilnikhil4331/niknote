import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Bell, CalendarDays, Check, ChevronRight, Flame, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useRoutine } from '@/components/habits/RoutineProvider';
import { CountUp, MiniGlass, Ring } from '@/components/habits/ui';
import { fmtHabitValue, greetingFor, isScheduled, toDay } from '@/lib/trackers';
import { habitSpring } from '@/lib/motion';
import { haptic } from '@/hooks/useHaptics';
import { accountName } from '@/lib/accountName';
import { useAuth } from '@/contexts/AuthContext';
import { readableInk } from '@/lib/readableInk';

export type Nav = (s: { name: string; id?: string }) => void;

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function HomeScreen({ go }: { go: Nav }) {
  const { state, today, activeHabits, setNotifications, addTodo, toggleTodo, deleteTodo, toggleHabitDone } = useRoutine();
  const { user } = useAuth();
  const reduced = useReducedMotion();
  const now = new Date();
  const [task, setTask] = useState('');
  const [selected, setSelected] = useState(today);
  const [weekOffset, setWeekOffset] = useState(0);

  const firstName = accountName(user).firstName || 'Friend';
  const selectedDate = new Date(selected + 'T12:00');
  const isToday = selected === today;

  const week = useMemo(() => {
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (6 - i));
      const day = toDay(d);
      const scheduled = activeHabits.filter(h => isScheduled(h.days, d));
      const done = scheduled.filter(h => (state.entries[`${h.id}|${day}`]?.v ?? 0) >= h.target).length;
      return {
        day, date: d,
        label: WEEKDAY_SHORT[d.getDay()],
        num: d.getDate(),
        isToday: day === today,
        isFuture: day > today,
        full: scheduled.length > 0 && done === scheduled.length,
        some: done > 0 && done < scheduled.length,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHabits, state.entries, weekOffset, today]);

  const scheduled = useMemo(() => activeHabits.filter(h => isScheduled(h.days, selectedDate)), [activeHabits, selected]);
  const doneCount = scheduled.filter(h => (state.entries[`${h.id}|${selected}`]?.v ?? 0) >= h.target).length;
  const pct = scheduled.length ? doneCount / scheduled.length : 0;

  const water = activeHabits.find(h => h.type === 'water');
  const sleep = activeHabits.find(h => h.type === 'sleep');
  const exercise = activeHabits.find(h => h.type === 'minutes' && /exerc|gym|run|walk|yoga|workout/i.test(h.name)) ?? activeHabits.find(h => h.type === 'minutes');
  const streak = useMemo(() => Math.max(0, ...activeHabits.map(h => {
    const done = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      if ((state.entries[`${h.id}|${toDay(d)}`]?.v ?? 0) >= h.target) done.add(toDay(d));
    }
    let s = 0;
    const c = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let i = 0; i < 400; i++, c.setDate(c.getDate() - 1)) {
      if (!isScheduled(h.days, c)) continue;
      if (done.has(toDay(c))) s++;
      else if (i === 0) continue;
      else break;
    }
    return s;
  })), [activeHabits, state.entries]);

  const submitTask = () => {
    if (!task.trim()) return;
    addTodo(task, 'medium');
    setTask('');
  };

  const selectDay = (day: string) => {
    haptic('selection');
    setSelected(day);
  };

  const shiftWeek = (dir: -1 | 1) => {
    const next = Math.max(0, Math.min(52, weekOffset + dir));
    if (next === weekOffset) return;
    haptic('light');
    setWeekOffset(next);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - next * 7);
    setSelected(next === 0 ? today : toDay(end));
  };

  const isFutureSelected = selected > today;

  const dateLabel = isToday
    ? now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : selectedDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="px-4 pt-4 space-y-4">
      {/* header */}
      <motion.header
        initial={reduced ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-3"
      >
        <div className="relative grid h-12 w-12 place-items-center rounded-full p-[2.5px] nnh-gradient-btn shrink-0">
          <span className="grid h-full w-full place-items-center rounded-full text-[15px] font-extrabold"
            style={{ background: 'var(--nnh-card)', color: 'var(--nnh-violet)' }}>
            {firstName.slice(0, 1).toUpperCase()}
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2"
            style={{ background: 'var(--nnh-mint)', borderColor: 'var(--nnh-card)' }} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>{greetingFor(now.getHours())},</p>
          <h1 className="nnh-display truncate text-[20px] font-extrabold leading-tight">{firstName} 👋</h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button type="button" onClick={() => { haptic('selection'); setNotifications(!state.notifications); }}
            aria-label={state.notifications ? 'Mute reminders' : 'Enable reminders'} aria-pressed={state.notifications}
            className="relative grid h-11 w-11 place-items-center rounded-full nnh-card">
            <Bell size={17} className={state.notifications ? '' : 'opacity-45'} />
            {state.notifications && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full" style={{ background: 'var(--nnh-pink)' }} />}
          </button>
          <span className="text-[10px] font-bold" style={{ color: 'var(--nnh-sub)' }}>{dateLabel}</span>
        </div>
      </motion.header>

      {/* progress hero */}
      <motion.section
        initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
        className="nnh-card relative overflow-hidden p-4"
      >
        <div className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.14), transparent 70%)' }} aria-hidden="true" />
        <div className="relative flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold" style={{ color: 'var(--nnh-sub)' }}>
              <span className="grid h-5 w-5 place-items-center rounded-full text-[10px] text-white nnh-gradient-btn"><Check size={11} strokeWidth={3.4} /></span>
              {isToday ? "Today's Progress" : `${selectedDate.toLocaleDateString(undefined, { weekday: 'long' })}'s Progress`}
            </p>
            <h2 className="nnh-display mt-1 text-[21px] font-extrabold leading-tight">
              <CountUp value={doneCount} />/{scheduled.length} habits done
            </h2>
            <p className="mt-0.5 text-[11px] font-medium" style={{ color: 'var(--nnh-sub)' }}>
              {!scheduled.length
                ? 'Nothing scheduled — add a habit to begin.'
                : doneCount >= scheduled.length
                  ? 'Everything done. A brighter day ✨'
                  : pct > 0.5 ? 'Over halfway there — keep going 🚀' : 'Small steps add up. You’ve got this.'}
            </p>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full nnh-track" role="progressbar"
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} aria-label="Habit completion">
              <motion.div className="h-full rounded-full nnh-bar-fill" initial={false}
                animate={{ width: `${pct * 100}%` }} transition={reduced ? { duration: 0 } : habitSpring.soft} />
            </div>
          </div>
          <Ring size={78} stroke={8} pct={pct} from="#7C5F9E" to="#A34054">
            <span className="nnh-display text-[17px] font-extrabold"><CountUp value={Math.round(pct * 100)} />%</span>
          </Ring>
        </div>

        {/* week strip */}
        <div className="relative mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="nnh-label">{weekOffset === 0 ? 'This week' : `${weekOffset} week${weekOffset > 1 ? 's' : ''} ago`}</span>
            <div className="flex items-center gap-1">
              {!isToday && (
                <button type="button" onClick={() => { setSelected(today); setWeekOffset(0); haptic('selection'); }}
                  className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-extrabold"
                  style={{ background: 'var(--nnh-card-soft)', color: 'var(--nnh-violet)' }}>
                  <RotateCcw size={10} /> Today
                </button>
              )}
              <button type="button" onClick={() => { haptic('selection'); go({ name: 'calendar' }); }} aria-label="Open calendar"
                className="grid h-7 w-7 place-items-center rounded-full" style={{ background: 'var(--nnh-card-soft)', color: 'var(--nnh-sub)' }}>
                <CalendarDays size={13} />
              </button>
            </div>
          </div>
          <motion.div
            drag={reduced ? false : 'x'}
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.08}
            onDragEnd={(_, info) => {
              if (info.offset.x < -48) shiftWeek(1);
              else if (info.offset.x > 48) shiftWeek(-1);
            }}
            className="flex justify-between gap-1 touch-pan-y"
            aria-label="Week days"
          >
            {week.map(w => {
              const on = w.day === selected;
              return (
                <button key={w.day} type="button" onClick={() => selectDay(w.day)} aria-pressed={on} data-testid={`week-day-${w.day}`}
                  aria-label={`${w.label} ${w.num}${w.full ? ' — all habits done' : w.some ? ' — partly done' : ''}`}
                  className="relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 transition-colors"
                  style={on ? { background: 'var(--nnh-card-soft)' } : undefined}
                >
                  <span className="text-[9px] font-extrabold" style={{ color: w.isToday ? 'var(--nnh-violet)' : 'var(--nnh-sub)' }}>{w.label}</span>
                  <span
                    className="grid h-8 w-8 place-items-center rounded-full text-[12px] font-extrabold tabular-nums"
                    style={on
                      ? { background: 'linear-gradient(135deg, #7C5F9E, #A34054)', color: '#fff', boxShadow: '0 8px 16px -8px rgba(147,51,234,0.7)' }
                      : w.isToday
                        ? { border: '2px solid var(--nnh-purple)', color: 'var(--nnh-violet)' }
                        : { color: w.isFuture ? 'var(--nnh-sub)' : 'var(--nnh-ink)', opacity: w.isFuture ? 0.55 : 1 }}
                  >
                    {w.num}
                  </span>
                  <span className="h-1 w-1 rounded-full" aria-hidden="true"
                    style={{ background: w.full ? 'var(--nnh-violet)' : w.some ? 'var(--nnh-pink)' : 'transparent' }} />
                </button>
              );
            })}
          </motion.div>
        </div>
      </motion.section>

      {/* metric cards */}
      <div className="grid grid-cols-2 gap-3">
        {water ? (
          <MetricCard label="Water" tint="var(--nnh-sky)" icon="💧" onClick={() => go({ name: 'detail', id: water.id })}>
            <div className="flex items-end justify-between gap-1">
              <p className="text-[11px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
                <b className="nnh-display text-[18px]" style={{ color: 'var(--nnh-ink)' }}>
                  {fmtHabitValue(state.entries[`${water.id}|${selected}`]?.v ?? 0, water.type)}
                </b> / {water.target}
              </p>
              <MiniGlass pct={(state.entries[`${water.id}|${selected}`]?.v ?? 0) / water.target} color="#7C5F9E" size={30} />
            </div>
            <MiniBar values={microBars(water.id, state.entries, now)} color="#7C5F9E" />
          </MetricCard>
        ) : null}
        {sleep ? (
          <MetricCard label="Sleep" tint="var(--nnh-purple)" icon="🌙" onClick={() => go({ name: 'sleep' })}>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
              <b className="nnh-display text-[18px]" style={{ color: 'var(--nnh-ink)' }}>
                {fmtHabitValue(state.entries[`${sleep.id}|${selected}`]?.v ?? 0, sleep.type)}
              </b> / {sleep.target} h
            </p>
            <MiniBar values={microBars(sleep.id, state.entries, now)} color="#7C5F9E" />
          </MetricCard>
        ) : null}
        {exercise ? (
          <MetricCard label="Exercise" tint="var(--nnh-mint)" icon="🏃" onClick={() => go({ name: 'exercise' })}>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
              <b className="nnh-display text-[18px]" style={{ color: 'var(--nnh-ink)' }}>
                {Math.round(state.entries[`${exercise.id}|${selected}`]?.v ?? 0)}
              </b> / {exercise.target} min
            </p>
            <MiniBar values={microBars(exercise.id, state.entries, now)} color="#157F52" />
          </MetricCard>
        ) : null}
        <MetricCard label="Streak" tint="var(--nnh-orange)" icon="🔥" onClick={() => go({ name: 'streaks' })}>
          <div className="flex items-center gap-2">
            <span className="nnh-display text-[20px] font-extrabold"><CountUp value={streak} /></span>
            <span className="text-[10px] font-bold" style={{ color: 'var(--nnh-sub)' }}>days<br />current</span>
          </div>
          <div className="mt-1 flex items-center gap-1">
            {[0, 1, 2, 3, 4].map(i => (
              <span key={i} className="h-1.5 flex-1 rounded-full"
                style={{ background: i < Math.min(streak, 5) ? 'linear-gradient(90deg,#D9822F,#ED9E59)' : 'var(--nnh-line)' }} />
            ))}
          </div>
        </MetricCard>
      </div>

      {/* habits for the selected day */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-extrabold">
            {isToday ? "Today's habits" : `${selectedDate.toLocaleDateString(undefined, { weekday: 'long' })}'s habits`}
          </h3>
          <button type="button" onClick={() => go({ name: 'tab', id: 'habits' })}
            className="flex items-center gap-0.5 text-[11px] font-bold" style={{ color: 'var(--nnh-violet)' }}>
            See all <ChevronRight size={13} />
          </button>
        </div>

        {isFutureSelected && (
          <p className="rounded-xl px-3 py-2 text-[10px] font-semibold" style={{ background: 'var(--nnh-card-soft)', color: 'var(--nnh-sub)' }}>
            This day is in the future — check-ins unlock on the day itself.
          </p>
        )}
        {scheduled.length > 0 ? (
          <AnimatePresence initial={false}>
            {scheduled.map((h, i) => {
              const value = state.entries[`${h.id}|${selected}`]?.v ?? 0;
              const done = value >= h.target;
              return (
                <motion.div key={h.id} layout
                  initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, height: 0 }}
                  transition={{ duration: 0.24, delay: reduced ? 0 : Math.min(i, 6) * 0.035 }}
                  className="nnh-card flex items-center gap-3 p-3"
                >
                  <button type="button" onClick={() => { haptic('selection'); go({ name: 'detail', id: h.id }); }}
                    aria-label={`Open ${h.name}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl"
                    style={{ background: `color-mix(in srgb, ${h.color} 16%, transparent)` }}>
                    {h.icon}
                  </button>
                  <button type="button" onClick={() => { haptic('selection'); go({ name: 'detail', id: h.id }); }}
                    className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[13.5px] font-bold">{h.name}</p>
                      {done && <span className="rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide"
                        style={{ background: `color-mix(in srgb, ${h.color} 16%, transparent)`, color: h.color }}>done</span>}
                    </div>
                    <p className="mt-0.5 text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
                      {fmtHabitValue(value, h.type)} / {fmtHabitValue(h.target, h.type)} · {Math.round(Math.min(1, value / h.target) * 100)}%
                    </p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full nnh-track">
                      <motion.div className="h-full rounded-full" initial={false}
                        animate={{ width: `${Math.min(100, (value / h.target) * 100)}%` }}
                        transition={reduced ? { duration: 0 } : habitSpring.soft}
                        style={{ background: h.color }} />
                    </div>
                  </button>
                  <motion.button whileTap={reduced ? undefined : { scale: 0.82 }} type="button"
                    onClick={() => toggleHabitDone(h, selected)}
                    aria-label={done ? `Reopen ${h.name}` : `Complete ${h.name}`}
                    aria-pressed={done}
                    disabled={isFutureSelected}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 disabled:opacity-40"
                    style={{
                      borderColor: done ? h.color : 'var(--nnh-line-strong)',
                      background: done ? h.color : 'transparent',
                      color: done ? readableInk(h.color) : '#fff',
                    }}>
                    <motion.span initial={false} animate={done ? { scale: [0.6, 1.15, 1] } : { scale: 1 }}
                      transition={reduced ? { duration: 0 } : habitSpring.pop}>
                      {done ? <Check size={17} strokeWidth={3.4} /> : <Plus size={15} style={{ color: 'var(--nnh-sub)' }} />}
                    </motion.span>
                  </motion.button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        ) : (
          <div className="nnh-card px-5 py-7 text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl text-2xl"
              style={{ background: 'var(--nnh-lavender)' }}>🌱</div>
            <p className="text-[14px] font-extrabold">{activeHabits.length ? 'A rest day' : 'Start with one small habit'}</p>
            <p className="mx-auto mt-1 max-w-[240px] text-[11px] font-medium leading-relaxed" style={{ color: 'var(--nnh-sub)' }}>
              {activeHabits.length
                ? 'Nothing is scheduled for this day. Enjoy the pause, or create a habit for it.'
                : 'Two minutes to set up, then one tap a day. Your streak starts with the first check-in.'}
            </p>
            <button type="button" onClick={() => { haptic('medium'); go({ name: 'add' }); }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[12px] font-extrabold text-white nnh-gradient-btn">
              <Plus size={14} /> Create your first habit
            </button>
          </div>
        )}
      </section>

      {/* focus banner */}
      <motion.button whileTap={reduced ? undefined : { scale: 0.98 }} type="button" onClick={() => go({ name: 'focus' })}
        className="nnh-card relative flex w-full items-center gap-3 overflow-hidden p-3.5 text-left">
        <span className="absolute inset-0" aria-hidden="true"
          style={{ background: 'linear-gradient(100deg, color-mix(in srgb, var(--nnh-pale-pink) 80%, transparent) 0%, color-mix(in srgb, var(--nnh-lavender) 82%, transparent) 55%, transparent 100%)' }} />
        <span className="relative grid h-11 w-11 place-items-center rounded-2xl text-2xl" style={{ background: 'var(--nnh-card)' }}>🍅</span>
        <span className="relative min-w-0 flex-1">
          <span className="block text-[14px] font-extrabold">Focus Timer</span>
          <span className="block text-[11px] font-medium" style={{ color: 'var(--nnh-sub)' }}>
            {state.focus[today] ?? 0} session{state.focus[today] === 1 ? '' : 's'} today · {state.focusMode === 'deep' ? 'deep work' : state.focusMode === 'custom' ? `${state.customFocus} min custom` : '25 min pomodoro'}
          </span>
        </span>
        <span className="relative grid h-9 w-9 place-items-center rounded-full text-white nnh-gradient-btn">
          <svg viewBox="0 0 24 24" width="13" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
        </span>
      </motion.button>

      {/* tasks */}
      <section className="nnh-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[14px] font-extrabold">Today's Tasks</h3>
          <span className="text-[11px] font-bold" style={{ color: 'var(--nnh-sub)' }}>
            {state.todos.filter(t => t.done).length}/{state.todos.length}
          </span>
        </div>
        <div className="mb-3 flex gap-2">
          <input value={task} onChange={e => setTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitTask()}
            placeholder="Add a task…" aria-label="Add a task"
            className="h-10 min-w-0 flex-1 rounded-xl border px-3 text-[13px] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:hsl(var(--focus-ring-hsl))]"
            style={{ background: 'var(--nnh-card-soft)', borderColor: 'var(--nnh-line)', color: 'var(--nnh-ink)' }} />
          <motion.button whileTap={reduced ? undefined : { scale: 0.9 }} type="button" onClick={submitTask} aria-label="Add task"
            className="grid h-10 w-10 place-items-center rounded-xl text-white nnh-gradient-btn disabled:opacity-40" disabled={!task.trim()}>
            <Plus size={18} strokeWidth={2.6} />
          </motion.button>
        </div>
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {state.todos.slice(0, 6).map(t => (
              <motion.div key={t.id} layout initial={reduced ? false : { opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12, height: 0 }}
                className="flex items-center gap-2.5 rounded-xl p-2" style={{ background: 'var(--nnh-card-soft)' }}>
                <motion.button whileTap={{ scale: 0.78 }} type="button" onClick={() => toggleTodo(t.id)}
                  aria-label={t.done ? `Reopen ${t.title}` : `Complete ${t.title}`} aria-pressed={t.done}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2"
                  style={{ borderColor: t.done ? 'var(--nnh-purple)' : 'var(--nnh-line-strong)', background: t.done ? 'var(--nnh-purple)' : 'transparent', color: readableInk('#662249') }}>
                  {t.done && <Check size={13} strokeWidth={3.4} />}
                </motion.button>
                <span className={`flex-1 truncate text-[13px] font-medium ${t.done ? 'line-through' : ''}`}
                  style={t.done ? { color: 'var(--nnh-sub)' } : undefined}>{t.title}</span>
                <span className="h-4 w-1.5 rounded-full" aria-hidden="true"
                  style={{ background: t.priority === 'high' ? '#A62B36' : t.priority === 'medium' ? '#C4762F' : '#157F52' }} />
                <button type="button" onClick={() => deleteTodo(t.id)} aria-label={`Delete ${t.title}`}
                  className="grid h-9 w-9 place-items-center rounded-full" style={{ color: 'var(--nnh-sub)' }}>
                  <Trash2 size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {!state.todos.length && <p className="py-2 text-center text-[12px]" style={{ color: 'var(--nnh-sub)' }}>No tasks — enjoy your day 🌈</p>}
        </div>
      </section>

      <p className="pb-1 text-center text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
        Small habits. Big changes. ✨
      </p>
    </div>
  );
}

function microBars(id: string, entries: Record<string, { v: number }>, now: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    return entries[`${id}|${toDay(d)}`]?.v ?? 0;
  });
}

function MetricCard({ label, tint, icon, onClick, children }: {
  label: string; tint: string; icon: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={onClick} aria-label={`${label} details`}
      className="nnh-card relative flex min-h-[104px] flex-col justify-between overflow-hidden p-3.5 text-left">
      <span className="absolute -right-4 -top-5 h-16 w-16 rounded-full" style={{ background: tint, opacity: 0.1 }} aria-hidden="true" />
      <span className="relative flex items-center gap-1.5 text-[11px] font-extrabold">
        <span className="grid h-6 w-6 place-items-center rounded-lg text-[13px]"
          style={{ background: `color-mix(in srgb, ${tint} 16%, transparent)` }}>{icon}</span>
        <span style={{ color: tint }}>{label}</span>
      </span>
      <div className="relative mt-2">{children}</div>
    </motion.button>
  );
}

function MiniBar({ values, color }: { values: number[]; color: string }) {
  const m = Math.max(1, ...values);
  return (
    <div className="mt-1.5 flex h-6 items-end gap-1" aria-hidden="true">
      {values.map((v, i) => (
        <motion.span key={i} initial={false} animate={{ height: Math.max(3, (v / m) * 24) }}
          transition={{ delay: i * 0.03, type: 'spring', stiffness: 140, damping: 20 }}
          className="w-1.5 rounded-full" style={{ background: v > 0 ? color : 'var(--nnh-line)' }} />
      ))}
    </div>
  );
}
