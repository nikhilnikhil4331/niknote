import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { haptic } from '@/hooks/useHaptics';
import { toDay, entryKey, unlockedAchievements, ACHIEVEMENTS, type FocusModeId } from '@/lib/trackers';
import { hasSavedState, loadState, saveState, uid, type Entry, type Habit, type RoutineState, type Todo } from '@/lib/routineStore';

type Routine = {
  state: RoutineState;
  today: string;
  activeHabits: Habit[];
  syncBusy: boolean;
  syncMsg: string | null;
  setOnboarded: (v: boolean) => void;
  setTheme: (t: 'light' | 'dark') => void;
  setNotifications: (v: boolean) => void;
  addHabit: (h: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => Habit;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  setEntry: (habit: Habit, day: string, v: number) => void;
  bump: (habit: Habit, delta: number, day?: string) => void;
  setSleepTime: (day: string, k: 'bed' | 'wake', value: string) => void;
  addTodo: (title: string, priority: Todo['priority']) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  addFocusSession: () => void;
  setFocusMode: (m: FocusModeId) => void;
  setCustom: (focus: number, brk: number) => void;
  exportData: () => void;
  syncNow: () => Promise<void>;
};

const Ctx = createContext<Routine | null>(null);
export const useRoutine = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRoutine outside RoutineProvider');
  return ctx;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Fetch legacy /routine Supabase data and shape it into a local state (names map to types). */
async function restoreFromSupabase(userId: string, now = new Date()): Promise<RoutineState | null> {
  try {
    const from = new Date(); from.setDate(from.getDate() - 60);
    // Timeout guard: on dead/flaky networks this fetch used to hang forever,
    // which left first-time users staring at the sample seed with no restore.
    const timeout = new Promise<null>(res => setTimeout(() => res(null), 12000));
    const fetched = await Promise.race([
      Promise.all([
        supabase.from('habits').select('id,name,emoji,days,archived,created_at').order('created_at'),
        supabase.from('habit_checks').select('habit_id,day').gte('day', toDay(from)),
      ]),
      timeout,
    ]);
    if (!fetched) return null; // timed out — local state stays in charge
    const [h, c] = fetched;
    if (h.error || !h.data?.length) return null;
    const typeOf = (name: string): Habit['type'] => /water|hydrat/i.test(name) ? 'water' : /sleep/i.test(name) ? 'sleep' : /exerc|gym|run|walk|yoga|workout/i.test(name) ? 'minutes' : 'times';
    const habits: Habit[] = h.data.map((r: any, i: number) => {
      const t = typeOf(r.name);
      return {
        id: r.id, name: r.name,
        category: 'other', icon: r.emoji || '✅', color: ['#8b5cf6', '#ec4899', '#0ea5e9', '#22c55e'][i % 4],
        type: t, target: t === 'water' ? 8 : t === 'sleep' ? 8 : t === 'minutes' ? 30 : 1,
        days: Array.isArray(r.days) && r.days.length ? r.days : [0, 1, 2, 3, 4, 5, 6],
        reminderOn: false, reminders: [], createdAt: r.created_at || toDay(now), archived: r.archived === true,
      };
    });
    const entries: Record<string, Entry> = {};
    for (const r of c.data ?? []) {
      const target = habits.find(hh => hh.id === r.habit_id)?.target ?? 1;
      entries[entryKey(r.habit_id, r.day)] = { v: target };
    }
    const active = habits.filter(x => !x.archived);
    const state: RoutineState = {
      version: 1, onboarded: false, theme: 'light', notifications: true,
      habits, entries, sleepTimes: {}, todos: [], focus: {},
      focusMode: 'pomodoro', customFocus: 25, customBreak: 5,
      unlocked: unlockedAchievements({
        habits: active.map(x => ({ id: x.id, name: x.name, type: x.type, target: x.target, days: x.days })),
        entries, focus: {}, today: toDay(now),
      }).map(a => a.id),
    };
    saveState(userId, state);
    return state;
  } catch {
    return null;
  }
}

export function RoutineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth() as any;
  const userId: string = user?.id || 'anon';
  const reduced = useReducedMotion();
  const [state, setState] = useState<RoutineState>(() => loadState(userId));
  const [restored, setRestored] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  // Bumped by every user action — the cloud restore must never clobber changes
  // the user already made while the (slow) fetch was in flight.
  const dirtyRef = useRef(0);

  // Load on account change. On a true first visit (no local data yet), offer to restore
  // legacy /routine cloud history in place of the sample seed.
  useEffect(() => {
    const hadSaved = hasSavedState(userId);
    dirtyRef.current = 0;
    setState(loadState(userId));
    setRestored(false);
    if (user && !hadSaved) {
      restoreFromSupabase(userId).then(s => {
        if (s && s.habits.length && dirtyRef.current === 0) { setState(s); toast.success('Restored your habits from the cloud ☁️'); }
        setRestored(true);
      });
    } else {
      setRestored(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, user?.id]);

  // Persist on every change.
  useEffect(() => { if (restored || state.habits.length) saveState(userId, state); }, [state, userId, restored]);

  // Achievement unlock detection -> celebrate new ones once.
  const unlockedIds = useMemo(() => {
    const ctx = { habits: state.habits.map(h => ({ id: h.id, name: h.name, type: h.type, target: h.target, days: h.days })), entries: state.entries, focus: state.focus, today: toDay(new Date()) };
    return new Set(unlockedAchievements(ctx).map(a => a.id));
  }, [state.habits, state.entries, state.focus]);

  const celebrated = useRef<Set<string>>(new Set(state.unlocked));
  useEffect(() => {
    const fresh = [...unlockedIds].filter(id => !celebrated.current.has(id));
    if (!fresh.length) return;
    fresh.forEach(id => celebrated.current.add(id));
    setState(s => ({ ...s, unlocked: [...new Set([...s.unlocked, ...fresh])] }));
    const a = ACHIEVEMENTS.find(x => x.id === fresh[fresh.length - 1]);
    if (a) {
      if (!reduced) confetti({ particleCount: 90, spread: 75, origin: { y: 0.7 }, colors: [a.color, '#fbbf24', '#ffffff'] });
      toast.success(`${a.icon} Achievement unlocked: ${a.name}!`);
    }
  }, [unlockedIds, reduced]);

  const today = toDay(new Date());
  const activeHabits = useMemo(() => state.habits.filter(h => !h.archived), [state.habits]);

  const mutate = useCallback((fn: (s: RoutineState) => RoutineState) => { dirtyRef.current++; setState(fn); }, []);

  const setOnboarded = useCallback((v: boolean) => mutate(s => ({ ...s, onboarded: v })), [mutate]);
  const setTheme = useCallback((t: 'light' | 'dark') => { haptic('selection'); mutate(s => ({ ...s, theme: t })); }, [mutate]);
  const setNotifications = useCallback((v: boolean) => { haptic('selection'); mutate(s => ({ ...s, notifications: v })); }, [mutate]);

  const addHabit = useCallback((h: Omit<Habit, 'id' | 'createdAt' | 'archived'>): Habit => {
    const habit: Habit = { ...h, id: uid(), createdAt: new Date().toISOString().slice(0, 10), archived: false };
    mutate(s => ({ ...s, habits: [...s.habits, habit] }));
    return habit;
  }, [mutate]);

  const updateHabit = useCallback((id: string, patch: Partial<Habit>) => mutate(s => ({ ...s, habits: s.habits.map(h => h.id === id ? { ...h, ...patch } : h) })), [mutate]);

  const deleteHabit = useCallback((id: string) => {
    haptic('heavy');
    mutate(s => {
      const entries = { ...s.entries };
      Object.keys(entries).forEach(k => { if (k.startsWith(id + '|')) delete entries[k]; });
      return { ...s, habits: s.habits.filter(h => h.id !== id), entries };
    });
    toast.success('Habit deleted');
  }, [mutate]);

  const setEntry = useCallback((habit: Habit, day: string, v: number) => {
    const max = habit.type === 'water' ? habit.target * 2 : habit.type === 'sleep' ? 16 : habit.type === 'minutes' ? 600 : habit.target * 3;
    const next = clamp(Math.round(v * 10) / 10, 0, max);
    const key = entryKey(habit.id, day);
    mutate(s => {
      const prev = s.entries[key];
      const entry: Entry = { v: next, at: prev?.at ?? (next > 0 ? new Date().toISOString() : undefined) };
      return { ...s, entries: { ...s.entries, [key]: entry } };
    });
  }, [mutate]);

  const bump = useCallback((habit: Habit, delta: number, day?: string) => {
    const d = day ?? toDay(new Date());
    const key = entryKey(habit.id, d);
    const cur = stateRef.current.entries[key]?.v ?? 0;
    const next = clamp(Math.round((cur + delta) * 10) / 10, 0, habit.target * (habit.type === 'water' ? 2 : habit.type === 'times' ? 3 : 40));
    haptic(delta > 0 ? 'medium' : 'light');
    const was = cur >= habit.target;
    const is = next >= habit.target;
    if (delta > 0 && !was && is) {
      haptic('success');
      if (!reduced) confetti({ particleCount: 50, spread: 55, origin: { y: 0.75 }, colors: [habit.color, '#ffffff'] });
      toast.success(`${habit.icon} ${habit.name} — goal reached!`);
    }
    setEntry(habit, d, next);
  }, [setEntry, reduced]);

  const setSleepTime = useCallback((day: string, k: 'bed' | 'wake', value: string) => {
    mutate(s => ({ ...s, sleepTimes: { ...s.sleepTimes, [day]: { ...s.sleepTimes[day], [k]: value } } }));
  }, [mutate]);

  const addTodo = useCallback((title: string, priority: Todo['priority']) => {
    if (!title.trim()) return;
    haptic('light');
    mutate(s => ({ ...s, todos: [...s.todos, { id: uid(), title: title.trim(), done: false, priority, position: s.todos.length }] }));
  }, [mutate]);
  const toggleTodo = useCallback((id: string) => {
    const t = stateRef.current.todos.find(x => x.id === id);
    haptic(t?.done ? 'light' : 'medium');
    mutate(s => ({ ...s, todos: s.todos.map(x => x.id === id ? { ...x, done: !x.done } : x) }));
  }, [mutate]);
  const deleteTodo = useCallback((id: string) => { haptic('light'); mutate(s => ({ ...s, todos: s.todos.filter(x => x.id !== id) })); }, [mutate]);

  const addFocusSession = useCallback(() => {
    const d = toDay(new Date());
    haptic('success');
    mutate(s => ({ ...s, focus: { ...s.focus, [d]: (s.focus[d] ?? 0) + 1 } }));
  }, [mutate]);
  const setFocusMode = useCallback((m: FocusModeId) => { haptic('selection'); mutate(s => ({ ...s, focusMode: m })); }, [mutate]);
  const setCustom = useCallback((focus: number, brk: number) => mutate(s => ({ ...s, customFocus: focus, customBreak: brk })), [mutate]);

  const exportData = useCallback(() => {
    try {
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...stateRef.current }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `niknote-habits-${toDay(new Date())}.json`;
      a.click();
      URL.revokeObjectURL(url);
      haptic('success');
      toast.success('Habit data exported 📦');
    } catch {
      toast.error('Export failed');
    }
  }, []);

  // ── Cloud backup (mirrors to the same Supabase tables as /routine) ──
  const syncNow = useCallback(async () => {
    setSyncBusy(true);
    setSyncMsg(null);
    try {
      const s = stateRef.current;
      const [habitsRes, checksRes, todosRes, wellnessRes, settingsRes, delRes] = await Promise.all([
        supabase.from('habits').upsert(s.habits.map(h => ({ id: h.id, name: h.name, emoji: h.icon, block: 'morning', days: h.days, archived: h.archived })), { onConflict: 'id' }),
        supabase.from('habit_checks').upsert(
          Object.entries(s.entries).filter(([, e]) => e.v > 0).map(([k]) => { const [habit_id, day] = k.split('|'); return { habit_id, day }; }).slice(0, 400),
          { onConflict: 'habit_id,day' },
        ),
        supabase.from('todos').upsert(s.todos.map(t => ({ id: t.id, title: t.title, done: t.done, priority: t.priority, position: t.position })), { onConflict: 'id' }),
        supabase.from('daily_wellness').upsert(
          Object.keys({ ...s.focus, ...s.entries }).length ? wellnessRows(s) : [],
          { onConflict: 'user_id,day' },
        ),
        supabase.from('tracker_settings').upsert({ water_goal: s.habits.find(h => h.type === 'water' && !h.archived)?.target ?? 8 }),
        supabase.from('habits').delete().not('id', 'in', `(${s.habits.map(h => h.id).join(',')})`).limit(100),
      ]);
      const bad = [habitsRes, checksRes, todosRes, wellnessRes, settingsRes, delRes].find(r => r.error);
      if (bad?.error) throw new Error(bad.error.message);
      haptic('success');
      setSyncMsg('synced');
      toast.success('Backed up to the cloud ☁️');
    } catch (e) {
      setSyncMsg('failed');
      toast.error(`Sync failed — ${e instanceof Error ? e.message : 'offline'}`);
    } finally {
      setSyncBusy(false);
    }
  }, []);

  const value: Routine = {
    state, today, activeHabits, syncBusy, syncMsg,
    setOnboarded, setTheme, setNotifications,
    addHabit, updateHabit, deleteHabit, setEntry, bump, setSleepTime,
    addTodo, toggleTodo, deleteTodo,
    addFocusSession, setFocusMode, setCustom,
    exportData, syncNow,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <AnimatePresence>
        {syncBusy && (
          <motion.div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 nnh-card px-4 py-2 text-xs font-semibold flex items-center gap-2"
            style={{ background: 'var(--nnh-card)' }}
            initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            <motion.span className="w-3 h-3 rounded-full border-2 border-[var(--nnh-purple)] border-t-transparent" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
            Syncing to the cloud…
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}

/** Aggregate per-day wellness rows for the legacy daily_wellness table. */
function wellnessRows(s: RoutineState) {
  const water = s.habits.find(h => h.type === 'water' && !h.archived);
  const sleep = s.habits.find(h => h.type === 'sleep' && !h.archived);
  const exercise = s.habits.find(h => h.type === 'minutes' && !h.archived && /exerc|gym|run|walk|yoga|workout/i.test(h.name)) ?? s.habits.find(h => h.type === 'minutes' && !h.archived);
  const byDay: Record<string, { water: number; sleep: number; exercise: number }> = {};
  const row = (d: string) => (byDay[d] ??= { water: 0, sleep: 0, exercise: 0 });
  for (const [k, e] of Object.entries(s.entries)) {
    const [id, day] = k.split('|');
    const r = row(day);
    if (id === water?.id) r.water = Math.round(e.v);
    else if (id === sleep?.id) r.sleep = Math.round(e.v * 10) / 10;
    else if (id === exercise?.id) r.exercise = Math.round(e.v);
  }
  for (const [day, n] of Object.entries(s.focus)) row(day);
  return Object.entries(byDay).map(([day, r]) => ({
    day,
    water: r.water,
    sleep_hours: r.sleep,
    exercise_minutes: r.exercise,
    mood: '',
    pomodoros: s.focus[day] ?? 0,
  }));
}
