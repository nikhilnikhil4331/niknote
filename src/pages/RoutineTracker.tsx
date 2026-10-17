import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Plus, Trash2, Check, Play, Pause, RotateCcw, Droplet, Moon, Dumbbell, GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { haptic } from '@/hooks/useHaptics';
import { toast } from 'sonner';
import { TrackerShell, Panel } from '@/components/trackers/TrackerShell';
import { scheduledStreak, isScheduled, toDay } from '@/lib/trackers';
import { WaterGlass } from '@/components/motion/WaterGlass';
import { RoutineArt } from '@/components/motion/FeatureArt';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';

const db = supabase as any;
const BLOCKS = [
  { id: 'morning', label: 'Morning', emoji: '🌅' },
  { id: 'afternoon', label: 'Afternoon', emoji: '☀️' },
  { id: 'evening', label: 'Evening', emoji: '🌇' },
  { id: 'night', label: 'Night', emoji: '🌙' },
];
const MOODS = ['😄', '🙂', '😐', '😢', '😡'];
const PRIORITY: Record<string, string> = { high: 'bg-rose-500', medium: 'bg-amber-500', low: 'bg-emerald-500' };

type Habit = { id: string; name: string; emoji: string; block: string; days: number[]; archived: boolean };
const WEEK = ['S','M','T','W','T','F','S'];
type Todo = { id: string; title: string; priority: string; done: boolean; position: number };
type Wellness = { water: number; sleep_hours: number; exercise_minutes: number; mood: string; pomodoros: number };

export default function RoutineTracker() {
  const { user } = useAuth();
  const today = toDay(new Date());
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checks, setChecks] = useState<{ habit_id: string; day: string }[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [week, setWeek] = useState<Record<string, Wellness>>({});
  const [waterGoal, setWaterGoal] = useState(8);
  const [habitForm, setHabitForm] = useState({ name: '', emoji: '✅', block: 'morning', days: [0,1,2,3,4,5,6] as number[] });
  const [showArchived, setShowArchived] = useState(false);
  const [todoForm, setTodoForm] = useState({ title: '', priority: 'medium' });

  const w: Wellness = week[today] ?? { water: 0, sleep_hours: 0, exercise_minutes: 0, mood: '', pomodoros: 0 };

  useEffect(() => {
    if (!user) return;
    const from = new Date(); from.setDate(from.getDate() - 60);
    (async () => {
      const [h, c, t, d, s] = await Promise.all([
        db.from('habits').select('*').order('created_at'),
        db.from('habit_checks').select('habit_id, day').gte('day', toDay(from)),
        db.from('todos').select('*').order('position'),
        db.from('daily_wellness').select('*').gte('day', toDay(new Date(Date.now() - 6 * 864e5))),
        db.from('tracker_settings').select('water_goal').maybeSingle(),
      ]);
      setHabits(h.data ?? []); setChecks(c.data ?? []); setTodos(t.data ?? []);
      setWeek(Object.fromEntries((d.data ?? []).map((r: any) => [r.day, { ...r, sleep_hours: Number(r.sleep_hours) }])));
      if (s.data) setWaterGoal(s.data.water_goal);
    })();
  }, [user]);

  const saveWellness = async (patch: Partial<Wellness>) => {
    const next = { ...w, ...patch };
    setWeek(p => ({ ...p, [today]: next }));
    await db.from('daily_wellness').upsert({ user_id: user!.id, day: today, ...next });
  };

  // Habits
  const addHabit = async () => {
    if (!habitForm.name.trim()) return;
    if (!habitForm.days.length) return toast.error('Pick at least one day');
    const { data, error } = await db.from('habits').insert({ ...habitForm, name: habitForm.name.trim() }).select().single();
    if (error) return toast.error(error.message);
    haptic('light'); setHabits(p => [...p, data]); setHabitForm(f => ({ ...f, name: '' }));
  };
  const toggleHabit = async (h: Habit) => {
    const done = checks.some(c => c.habit_id === h.id && c.day === today);
    if (done) {
      setChecks(p => p.filter(c => !(c.habit_id === h.id && c.day === today)));
      haptic('light');
      await db.from('habit_checks').delete().eq('habit_id', h.id).eq('day', today);
    } else {
      setChecks(p => [...p, { habit_id: h.id, day: today }]);
      haptic('medium');
      await db.from('habit_checks').insert({ habit_id: h.id, day: today });
      const streak = scheduledStreak([...checks.filter(c => c.habit_id === h.id).map(c => c.day), today], h.days);
      if (streak > 0 && streak % 7 === 0) { haptic('success'); confetti({ particleCount: 120, spread: 80 }); toast.success(`${streak}-day streak on ${h.name}! 🔥`); }
    }
  };
  const archiveHabit = async (h: Habit) => { haptic('light'); setHabits(p => p.map(x => x.id === h.id ? { ...x, archived: !h.archived } : x)); await db.from('habits').update({ archived: !h.archived }).eq('id', h.id); toast.success(h.archived ? 'Habit restored' : 'Habit archived — history kept'); };
  const delHabit = async (id: string) => { if (!window.confirm('Delete this habit and all its history? Archive keeps history instead.')) return; haptic('heavy'); setHabits(p => p.filter(h => h.id !== id)); await db.from('habits').delete().eq('id', id); };

  // Todos
  const addTodo = async () => {
    if (!todoForm.title.trim()) return;
    const { data, error } = await db.from('todos').insert({ ...todoForm, title: todoForm.title.trim(), position: todos.length }).select().single();
    if (error) return toast.error(error.message);
    haptic('light'); setTodos(p => [...p, data]); setTodoForm(f => ({ ...f, title: '' }));
  };
  const toggleTodo = async (t: Todo) => {
    haptic(t.done ? 'light' : 'medium');
    setTodos(p => p.map(x => x.id === t.id ? { ...x, done: !x.done } : x));
    await db.from('todos').update({ done: !t.done }).eq('id', t.id);
  };
  const delTodo = async (id: string) => { haptic('heavy'); setTodos(p => p.filter(t => t.id !== id)); await db.from('todos').delete().eq('id', id); };
  const reorderTimer = useRef<number>();
  const onReorder = (next: Todo[]) => {
    setTodos(next); haptic('selection');
    window.clearTimeout(reorderTimer.current);
    reorderTimer.current = window.setTimeout(() => {
      next.forEach((t, i) => db.from('todos').update({ position: i }).eq('id', t.id));
    }, 600);
  };

  // Pomodoro
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [secs, setSecs] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setSecs(s => s - 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  useEffect(() => {
    if (secs > 0) return;
    setRunning(false); haptic('success');
    if (mode === 'focus') { saveWellness({ pomodoros: w.pomodoros + 1 }); toast.success('Focus session done — take a break ☕'); setMode('break'); setSecs(5 * 60); }
    else { toast('Break over — back to focus'); setMode('focus'); setSecs(25 * 60); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secs]);

  // Weekly report
  const last7 = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return toDay(d); }), []);
  const activeHabits = habits.filter(h => !h.archived);
  const scheduledSlots = activeHabits.reduce((n, h) => n + last7.filter(d => isScheduled(h.days, new Date(d + 'T12:00'))).length, 0);
  const habitRate = scheduledSlots ? Math.round((checks.filter(c => last7.includes(c.day) && activeHabits.some(h => h.id === c.habit_id && isScheduled(h.days, new Date(c.day + 'T12:00')))).length / scheduledSlots) * 100) : 0;
  const avgSleep = (last7.reduce((s, d) => s + (week[d]?.sleep_hours ?? 0), 0) / 7).toFixed(1);
  const totalExercise = last7.reduce((s, d) => s + (week[d]?.exercise_minutes ?? 0), 0);
  const todayList = activeHabits.filter(h => isScheduled(h.days));
  const todayScheduled = todayList.length;
  const todayDone = todayList.filter(h => checks.some(c => c.habit_id === h.id && c.day === today)).length;
  const todayPct = todayScheduled ? (todayDone / todayScheduled) * 100 : 0;
  const [chart, setChart] = useState<'habits' | 'water' | 'sleep'>('habits');
  const weekSeries = last7.map(d => {
    const date = new Date(d + 'T12:00');
    const sched = activeHabits.filter(h => isScheduled(h.days, date));
    const done = sched.filter(h => checks.some(c => c.habit_id === h.id && c.day === d)).length;
    return { label: date.toLocaleDateString(undefined, { weekday: 'short' }), habits: sched.length ? Math.round((done / sched.length) * 100) : 0, water: week[d]?.water ?? 0, sleep: week[d]?.sleep_hours ?? 0 };
  });

  return (
    <TrackerShell title="Daily Routine" subtitle="Habits, tasks, focus & wellbeing">
      {/* Today hero */}
      <section className="rounded-3xl border border-border bg-card p-4 flex items-center gap-4 shadow-sm overflow-hidden">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Today</p>
          <p className="text-xl font-bold leading-tight">{todayDone}/{todayScheduled} habits done</p>
          <p className="text-xs text-muted-foreground mt-1">{todayScheduled === 0 ? 'Add a habit to start your streak' : todayDone >= todayScheduled ? 'All done — great day! 🌟' : `${todayScheduled - todayDone} left for today`}</p>
          <div className="h-2 rounded-full bg-muted overflow-hidden mt-2"><motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${todayPct}%` }} transition={{ type: 'spring', stiffness: 80, damping: 16 }} /></div>
        </div>
        <RoutineArt progress={todayPct} />
      </section>

      {/* Wellness row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 [&>*]:min-w-0">
        <div className="col-span-2 rounded-3xl border border-border bg-card p-4 pb-7">
          <div className="flex items-center gap-2 text-sm font-medium mb-2"><Droplet className="w-4 h-4 text-sky-500" />Water</div>
          <WaterGlass glasses={w.water} goal={waterGoal} onChange={n => { haptic(n > w.water ? 'light' : 'selection'); if (n >= waterGoal && w.water < waterGoal) { haptic('success'); confetti({ particleCount: 60, spread: 60, colors: ['#38bdf8', '#0ea5e9', '#ffffff'] }); } saveWellness({ water: n }); }} />
        </div>
        <div className="rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium"><Moon className="w-4 h-4 text-indigo-500" />Sleep</div>
          <input type="range" min={0} max={12} step={0.5} value={w.sleep_hours} onChange={e => setWeek(p => ({ ...p, [today]: { ...w, sleep_hours: Number(e.target.value) } }))}
            onPointerUp={() => saveWellness({})} className="w-full mt-4 accent-primary" aria-label="Sleep hours" />
          <p className="text-xs text-muted-foreground mt-1">{w.sleep_hours} hours</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium"><Dumbbell className="w-4 h-4 text-orange-500" />Exercise</div>
          <div className="flex flex-wrap gap-1 mt-3">
            {[10, 20, 30].map(m => <button key={m} onClick={() => { haptic('light'); saveWellness({ exercise_minutes: w.exercise_minutes + m }); }} className="px-2 py-1 rounded-lg bg-muted text-xs font-medium active:scale-90">+{m}m</button>)}
          </div>
          <p className="text-xs text-muted-foreground mt-2">{w.exercise_minutes} min today</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-4">
          <div className="text-sm font-medium">Mood</div>
          <div className="flex justify-between mt-3">
            {MOODS.map(m => (
              <motion.button key={m} whileTap={{ scale: 1.4 }} onClick={() => { haptic('selection'); saveWellness({ mood: m }); }}
                className={`text-2xl transition ${w.mood === m ? 'scale-125' : 'opacity-50 grayscale'}`} aria-label={`Mood ${m}`}>{m}</motion.button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 [&>*]:min-w-0">
        {/* Habits */}
        <Panel title="Routine & habits">
          <div className="flex flex-wrap gap-2 mb-4">
            <input value={habitForm.emoji} onChange={e => setHabitForm(f => ({ ...f, emoji: e.target.value.slice(0, 2) }))} className="w-12 h-10 rounded-xl border border-border bg-background text-center" aria-label="Emoji" />
            <input placeholder="New habit" value={habitForm.name} onChange={e => setHabitForm(f => ({ ...f, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addHabit()} className="flex-1 min-w-[9rem] h-10 rounded-xl border border-border bg-background px-3 text-sm" />
            <select value={habitForm.block} onChange={e => setHabitForm(f => ({ ...f, block: e.target.value }))} className="h-10 rounded-xl border border-border bg-background px-2 text-sm" aria-label="Time of day">
              {BLOCKS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
            <div className="w-full flex items-center gap-1" role="group" aria-label="Repeat on days">
              {WEEK.map((l, i) => { const on = habitForm.days.includes(i); return <button key={i} type="button" aria-pressed={on} aria-label={['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][i]} onClick={() => setHabitForm(f => ({ ...f, days: on ? f.days.filter(x => x !== i) : [...f.days, i].sort() }))} className={`h-9 flex-1 rounded-lg text-xs font-semibold ${on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{l}</button>; })}
            </div>
            <button onClick={addHabit} className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-90" aria-label="Add habit"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="space-y-4">
            {BLOCKS.map(b => {
              const list = habits.filter(h => h.block === b.id && h.archived === showArchived);
              if (!list.length) return null;
              return (
                <div key={b.id}>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">{b.emoji} {b.label}</p>
                  <div className="space-y-2">
                    {list.map(h => {
                      const done = checks.some(c => c.habit_id === h.id && c.day === today);
                      const streak = scheduledStreak(checks.filter(c => c.habit_id === h.id).map(c => c.day), h.days);
                      const restDay = !isScheduled(h.days);
                      return (
                        <motion.div key={h.id} layout className="flex items-center gap-3 p-2.5 rounded-2xl bg-muted/40">
                          <motion.button whileTap={{ scale: 0.8 }} onClick={() => toggleHabit(h)} aria-label={`Mark ${h.name}`}
                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition ${done ? 'bg-emerald-500 border-emerald-500' : 'border-border'}`}>
                            <AnimatePresence>{done && <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}><Check className="w-4 h-4 text-white" strokeWidth={3} /></motion.span>}</AnimatePresence>
                          </motion.button>
                          <span className="text-lg">{h.emoji}</span>
                          <span className={`flex-1 min-w-0 text-sm ${done ? 'line-through text-muted-foreground' : ''}`}><span className="block truncate">{h.name}</span><span className="block text-[11px] text-muted-foreground">{h.days?.length === 7 || !h.days?.length ? 'Every day' : h.days.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(' · ')}{restDay && !done ? ' — rest day today' : ''}</span></span>
                          {streak > 0 && (
                            <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} className="text-xs font-bold text-orange-600">🔥 {streak}</motion.span>
                          )}
                          <button onClick={() => archiveHabit(h)} className="h-9 px-2 text-xs font-medium text-primary" aria-label={h.archived ? 'Restore habit' : 'Archive habit'}>{h.archived ? 'Restore' : 'Archive'}</button><button onClick={() => delHabit(h.id)} className="h-9 w-9 grid place-items-center text-muted-foreground" aria-label="Delete habit"><Trash2 className="w-4 h-4" /></button>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {habits.some(h => h.archived) && <button onClick={() => setShowArchived(v => !v)} className="text-xs font-medium text-primary underline">{showArchived ? 'Show active habits' : `Show archived (${habits.filter(h => h.archived).length})`}</button>}
            {!habits.length && <p className="text-sm text-muted-foreground">Add your first habit, like “Drink water” or “Read 10 pages”.</p>}
          </div>
        </Panel>

        {/* Todos */}
        <Panel title="To-do list">
          <div className="flex gap-2 mb-4">
            <input placeholder="Add a task" value={todoForm.title} onChange={e => setTodoForm(f => ({ ...f, title: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addTodo()} className="flex-1 min-w-0 h-10 rounded-xl border border-border bg-background px-3 text-sm" />
            <select value={todoForm.priority} onChange={e => setTodoForm(f => ({ ...f, priority: e.target.value }))} className="h-10 rounded-xl border border-border bg-background px-2 text-sm" aria-label="Priority">
              <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
            <button onClick={addTodo} className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-90" aria-label="Add task"><Plus className="w-4 h-4" /></button>
          </div>
          <Reorder.Group axis="y" values={todos} onReorder={onReorder} className="space-y-2">
            {todos.map(t => (
              <Reorder.Item key={t.id} value={t} className="flex items-center gap-2 p-2.5 rounded-2xl bg-muted/40 cursor-grab active:cursor-grabbing">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <motion.button whileTap={{ scale: 0.8 }} onClick={() => toggleTodo(t)} aria-label={`Complete ${t.title}`}
                  className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${t.done ? 'bg-primary border-primary' : 'border-border'}`}>
                  {t.done && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}><Check className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3} /></motion.span>}
                </motion.button>
                <span className={`w-2 h-2 rounded-full ${PRIORITY[t.priority]}`} />
                <span className={`flex-1 text-sm ${t.done ? 'line-through text-muted-foreground' : ''}`}>{t.title}</span>
                <button onClick={() => delTodo(t.id)} className="p-1 text-muted-foreground" aria-label="Delete task"><Trash2 className="w-4 h-4" /></button>
              </Reorder.Item>
            ))}
          </Reorder.Group>
          {!todos.length && <p className="text-sm text-muted-foreground">No tasks — enjoy your day!</p>}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 [&>*]:min-w-0">
        <Panel title={mode === 'focus' ? 'Pomodoro — Focus' : 'Pomodoro — Break'}>
          <div className="flex flex-col items-center">
            <div className="relative w-44 h-44">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="45" className="stroke-muted fill-none" strokeWidth="6" />
                <motion.circle cx="50" cy="50" r="45" className="stroke-primary fill-none" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={283} animate={{ strokeDashoffset: 283 * (1 - secs / ((mode === 'focus' ? 25 : 5) * 60)) }} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold tabular-nums">
                {String(Math.floor(Math.max(secs, 0) / 60)).padStart(2, '0')}:{String(Math.max(secs, 0) % 60).padStart(2, '0')}
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => { haptic('light'); setRunning(r => !r); }} className="h-11 px-5 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center gap-2">
                {running ? <><Pause className="w-4 h-4" />Pause</> : <><Play className="w-4 h-4" />Start</>}
              </motion.button>
              <button onClick={() => { setRunning(false); setSecs((mode === 'focus' ? 25 : 5) * 60); }} className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center" aria-label="Reset"><RotateCcw className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">{w.pomodoros} sessions today</p>
          </div>
        </Panel>

        <Panel title="This week">
          <div className="grid grid-cols-7 gap-1.5 mb-4">
            {last7.map(d => {
              const n = checks.filter(c => c.day === d).length;
              const ratio = habits.length ? n / habits.length : 0;
              return (
                <div key={d} className="text-center">
                  <div className="text-[10px] text-muted-foreground">{new Date(d).toLocaleDateString(undefined, { weekday: 'short' })}</div>
                  <div className="h-10 rounded-lg mt-1 flex items-center justify-center text-lg" style={{ background: `hsl(150 60% 45% / ${0.1 + ratio * 0.8})` }}>{week[d]?.mood || ''}</div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-2xl bg-muted/50"><p className="text-xl font-bold">{habitRate}%</p><p className="text-[11px] text-muted-foreground">Habits done</p></div>
            <div className="p-3 rounded-2xl bg-muted/50"><p className="text-xl font-bold">{avgSleep}h</p><p className="text-[11px] text-muted-foreground">Avg sleep</p></div>
            <div className="p-3 rounded-2xl bg-muted/50"><p className="text-xl font-bold">{totalExercise}m</p><p className="text-[11px] text-muted-foreground">Exercise</p></div>
          </div>
        </Panel>
      </div>

      <Panel title="Weekly graphs" action={<div className="nn-chart-tabs" role="group" aria-label="Choose graph">{(['habits', 'water', 'sleep'] as const).map(k => <button key={k} type="button" aria-pressed={chart === k} onClick={() => { haptic('selection'); setChart(k); }} className="capitalize">{k}</button>)}</div>}>
        <motion.div key={chart} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="h-56">
          <ResponsiveContainer>
            {chart === 'habits' ? (
              <BarChart data={weekSeries} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <defs><linearGradient id="nn-habit-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--success))" /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.7} /></linearGradient></defs>
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} /><YAxis fontSize={11} domain={[0, 100]} tickLine={false} axisLine={false} unit="%" />
                <Tooltip cursor={{ fill: 'hsl(var(--muted) / .5)' }} formatter={(v: number) => [`${v}%`, 'Habits done']} />
                <Bar dataKey="habits" fill="url(#nn-habit-grad)" radius={[10, 10, 4, 4]} animationDuration={900} />
              </BarChart>
            ) : chart === 'water' ? (
              <AreaChart data={weekSeries} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <defs><linearGradient id="nn-water-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--water))" stopOpacity={0.6} /><stop offset="100%" stopColor="hsl(var(--water))" stopOpacity={0.05} /></linearGradient></defs>
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} /><YAxis fontSize={11} allowDecimals={false} domain={[0, (max: number) => Math.max(waterGoal, max)]} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => [`${v} glasses`, 'Water']} />
                <ReferenceLine y={waterGoal} stroke="hsl(var(--water-deep))" strokeDasharray="4 4" label={{ value: 'Goal', fontSize: 10, position: 'insideTopRight' }} />
                <Area type="monotone" dataKey="water" stroke="hsl(var(--water-deep))" strokeWidth={3} fill="url(#nn-water-area)" animationDuration={1000} dot={{ r: 3 }} />
              </AreaChart>
            ) : (
              <AreaChart data={weekSeries} margin={{ top: 8, right: 14, left: -18, bottom: 0 }}>
                <defs><linearGradient id="nn-sleep-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.55} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} /></linearGradient></defs>
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} /><YAxis fontSize={11} domain={[0, 12]} tickLine={false} axisLine={false} unit="h" />
                <Tooltip formatter={(v: number) => [`${v} h`, 'Sleep']} />
                <ReferenceLine y={8} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: '8h goal', fontSize: 10, position: 'insideTopRight' }} />
                <Area type="monotone" dataKey="sleep" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#nn-sleep-area)" animationDuration={1000} dot={{ r: 3 }} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </motion.div>
      </Panel>
    </TrackerShell>
  );
}
