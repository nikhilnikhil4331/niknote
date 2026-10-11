import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Plus, Trash2, Check, Play, Pause, RotateCcw, Droplet, Moon, Dumbbell, GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { haptic } from '@/hooks/useHaptics';
import { toast } from 'sonner';
import { TrackerShell, Panel } from '@/components/trackers/TrackerShell';
import { computeStreak, toDay } from '@/lib/trackers';

const db = supabase as any;
const BLOCKS = [
  { id: 'morning', label: 'Morning', emoji: '🌅' },
  { id: 'afternoon', label: 'Afternoon', emoji: '☀️' },
  { id: 'evening', label: 'Evening', emoji: '🌇' },
  { id: 'night', label: 'Night', emoji: '🌙' },
];
const MOODS = ['😄', '🙂', '😐', '😢', '😡'];
const PRIORITY: Record<string, string> = { high: 'bg-rose-500', medium: 'bg-amber-500', low: 'bg-emerald-500' };

type Habit = { id: string; name: string; emoji: string; block: string };
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
  const [habitForm, setHabitForm] = useState({ name: '', emoji: '✅', block: 'morning' });
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
      const streak = computeStreak([...checks.filter(c => c.habit_id === h.id).map(c => c.day), today]);
      if (streak > 0 && streak % 7 === 0) { haptic('success'); confetti({ particleCount: 120, spread: 80 }); toast.success(`${streak}-day streak on ${h.name}! 🔥`); }
    }
  };
  const delHabit = async (id: string) => { haptic('heavy'); setHabits(p => p.filter(h => h.id !== id)); await db.from('habits').delete().eq('id', id); };

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
  const habitRate = habits.length ? Math.round((checks.filter(c => last7.includes(c.day)).length / (habits.length * 7)) * 100) : 0;
  const avgSleep = (last7.reduce((s, d) => s + (week[d]?.sleep_hours ?? 0), 0) / 7).toFixed(1);
  const totalExercise = last7.reduce((s, d) => s + (week[d]?.exercise_minutes ?? 0), 0);

  return (
    <TrackerShell title="Daily Routine" subtitle="Habits, tasks, focus & wellbeing">
      {/* Wellness row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium"><Droplet className="w-4 h-4 text-sky-500" />Water</div>
          <div className="flex flex-wrap gap-1 mt-3">
            {Array.from({ length: waterGoal }, (_, i) => (
              <motion.button key={i} whileTap={{ scale: 0.8 }} onClick={() => { haptic('light'); saveWellness({ water: i + 1 === w.water ? i : i + 1 }); }}
                className={`w-6 h-8 rounded-b-lg rounded-t-sm border-2 transition ${i < w.water ? 'bg-sky-400 border-sky-400' : 'border-sky-200'}`} aria-label={`Glass ${i + 1}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">{w.water}/{waterGoal} glasses</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium"><Moon className="w-4 h-4 text-indigo-500" />Sleep</div>
          <input type="range" min={0} max={12} step={0.5} value={w.sleep_hours} onChange={e => setWeek(p => ({ ...p, [today]: { ...w, sleep_hours: Number(e.target.value) } }))}
            onPointerUp={() => saveWellness({})} className="w-full mt-4 accent-primary" aria-label="Sleep hours" />
          <p className="text-xs text-muted-foreground mt-1">{w.sleep_hours} hours</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium"><Dumbbell className="w-4 h-4 text-orange-500" />Exercise</div>
          <div className="flex gap-1 mt-3">
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

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Habits */}
        <Panel title="Routine & habits">
          <div className="flex gap-2 mb-4">
            <input value={habitForm.emoji} onChange={e => setHabitForm(f => ({ ...f, emoji: e.target.value.slice(0, 2) }))} className="w-12 h-10 rounded-xl border border-border bg-background text-center" aria-label="Emoji" />
            <input placeholder="New habit" value={habitForm.name} onChange={e => setHabitForm(f => ({ ...f, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addHabit()} className="flex-1 h-10 rounded-xl border border-border bg-background px-3 text-sm" />
            <select value={habitForm.block} onChange={e => setHabitForm(f => ({ ...f, block: e.target.value }))} className="h-10 rounded-xl border border-border bg-background px-2 text-sm" aria-label="Time of day">
              {BLOCKS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
            <button onClick={addHabit} className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-90" aria-label="Add habit"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="space-y-4">
            {BLOCKS.map(b => {
              const list = habits.filter(h => h.block === b.id);
              if (!list.length) return null;
              return (
                <div key={b.id}>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">{b.emoji} {b.label}</p>
                  <div className="space-y-2">
                    {list.map(h => {
                      const done = checks.some(c => c.habit_id === h.id && c.day === today);
                      const streak = computeStreak(checks.filter(c => c.habit_id === h.id).map(c => c.day));
                      return (
                        <motion.div key={h.id} layout className="flex items-center gap-3 p-2.5 rounded-2xl bg-muted/40">
                          <motion.button whileTap={{ scale: 0.8 }} onClick={() => toggleHabit(h)} aria-label={`Mark ${h.name}`}
                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition ${done ? 'bg-emerald-500 border-emerald-500' : 'border-border'}`}>
                            <AnimatePresence>{done && <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}><Check className="w-4 h-4 text-white" strokeWidth={3} /></motion.span>}</AnimatePresence>
                          </motion.button>
                          <span className="text-lg">{h.emoji}</span>
                          <span className={`flex-1 text-sm ${done ? 'line-through text-muted-foreground' : ''}`}>{h.name}</span>
                          {streak > 0 && (
                            <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} className="text-xs font-bold text-orange-600">🔥 {streak}</motion.span>
                          )}
                          <button onClick={() => delHabit(h.id)} className="p-1 text-muted-foreground" aria-label="Delete habit"><Trash2 className="w-4 h-4" /></button>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {!habits.length && <p className="text-sm text-muted-foreground">Add your first habit, like “Drink water” or “Read 10 pages”.</p>}
          </div>
        </Panel>

        {/* Todos */}
        <Panel title="To-do list">
          <div className="flex gap-2 mb-4">
            <input placeholder="Add a task" value={todoForm.title} onChange={e => setTodoForm(f => ({ ...f, title: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addTodo()} className="flex-1 h-10 rounded-xl border border-border bg-background px-3 text-sm" />
            <select value={todoForm.priority} onChange={e => setTodoForm(f => ({ ...f, priority: e.target.value }))} className="h-10 rounded-xl border border-border bg-background px-2 text-sm" aria-label="Priority">
              <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
            <button onClick={addTodo} className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-90" aria-label="Add task"><Plus className="w-4 h-4" /></button>
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

      <div className="grid lg:grid-cols-2 gap-6">
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
    </TrackerShell>
  );
}
