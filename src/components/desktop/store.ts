// ============================================================
// NikNote Desktop — local stores (tasks, note meta, spaces, habits)
// All persisted to localStorage so every widget on the desktop
// workspace is fully functional for cloud AND guest users,
// without touching the supabase schema or the mobile app.
// ============================================================

import { useCallback, useEffect, useState } from 'react';

const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(`nik-store:${key}`));
  } catch {
    /* quota — ignore */
  }
}

/** localStorage-backed state shared live across components in the same tab. */
export function useLocalStore<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() =>
    readJSON<T>(key, typeof initial === 'function' ? (initial as () => T)() : initial),
  );

  useEffect(() => {
    const sync = () =>
      setValue(readJSON<T>(key, typeof initial === 'function' ? (initial as () => T)() : initial));
    window.addEventListener(`nik-store:${key}`, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(`nik-store:${key}`, sync);
      window.removeEventListener('storage', sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        writeJSON(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, set] as const;
}

// ---------------- Tasks ----------------

export type TaskStatus = 'todo' | 'doing' | 'done';

export interface NikTask {
  id: string;
  title: string;
  status: TaskStatus;
  due?: string; // YYYY-MM-DD
  createdAt: string;
  doneAt?: string;
}

export const TASK_COLUMNS: { id: TaskStatus; label: string; bg: string; dot: string }[] = [
  { id: 'todo', label: 'To Do', bg: '#FFF3F4', dot: '#F26D8D' },
  { id: 'doing', label: 'In Progress', bg: '#F1EFFF', dot: '#7C6CF0' },
  { id: 'done', label: 'Done', bg: '#ECFBF3', dot: '#1FA97A' },
];

const TASKS_KEY = 'niknote.desktop.tasks.v1';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const todayKey = todayStr;

function seedTasks(): NikTask[] {
  const t = todayStr();
  return [
    { id: uid(), title: 'Complete Biology notes', status: 'todo', due: t, createdAt: new Date().toISOString() },
    { id: uid(), title: 'Read Chapter 5', status: 'todo', due: t, createdAt: new Date().toISOString() },
    { id: uid(), title: 'Prepare for test', status: 'todo', createdAt: new Date().toISOString() },
    { id: uid(), title: 'Make summary', status: 'doing', due: t, createdAt: new Date().toISOString() },
    { id: uid(), title: 'Create flashcards', status: 'doing', createdAt: new Date().toISOString() },
    { id: uid(), title: 'Upload notes', status: 'done', due: t, createdAt: new Date().toISOString(), doneAt: new Date().toISOString() },
    { id: uid(), title: 'Revise formulas', status: 'done', createdAt: new Date().toISOString(), doneAt: new Date().toISOString() },
    { id: uid(), title: 'Workout', status: 'todo', due: t, createdAt: new Date().toISOString() },
  ];
}

export function useTasks() {
  const [tasks, setTasks] = useLocalStore<NikTask[]>(TASKS_KEY, () => {
    const seeded = seedTasks();
    // persist seed on first run only if key absent
    if (!localStorage.getItem(TASKS_KEY)) writeJSON(TASKS_KEY, seeded);
    return readJSON(TASKS_KEY, seeded);
  });

  const addTask = useCallback(
    (title: string, status: TaskStatus = 'todo', due?: string) => {
      const clean = title.trim();
      if (!clean) return;
      setTasks((prev) => [
        { id: uid(), title: clean, status, due, createdAt: new Date().toISOString() },
        ...prev,
      ]);
    },
    [setTasks],
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<NikTask>) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, ...patch, doneAt: patch.status === 'done' ? new Date().toISOString() : patch.status ? undefined : t.doneAt }
            : t,
        ),
      );
    },
    [setTasks],
  );

  const removeTask = useCallback(
    (id: string) => setTasks((prev) => prev.filter((t) => t.id !== id)),
    [setTasks],
  );

  const toggleDone = useCallback(
    (task: NikTask) => updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' }),
    [updateTask],
  );

  return { tasks, addTask, updateTask, removeTask, toggleDone };
}

// ---------------- Note meta (status / favourite overlay) ----------------

export interface NoteMeta {
  status: TaskStatus;
  fav?: boolean;
  prevFolder?: string | null;
}

const META_KEY = 'niknote.desktop.noteMeta.v1';

export function useNoteMeta() {
  const [meta, setMeta] = useLocalStore<Record<string, NoteMeta>>(META_KEY, {});

  const statusOf = useCallback((id: string): TaskStatus => meta[id]?.status ?? 'todo', [meta]);
  const isFav = useCallback((id: string) => !!meta[id]?.fav, [meta]);

  const setStatus = useCallback(
    (id: string, status: TaskStatus) =>
      setMeta((prev) => ({ ...prev, [id]: { ...prev[id], status } })),
    [setMeta],
  );
  const toggleFav = useCallback(
    (id: string) =>
      setMeta((prev) => ({
        ...prev,
        [id]: { status: prev[id]?.status ?? 'todo', ...prev[id], fav: !prev[id]?.fav },
      })),
    [setMeta],
  );
  const setPrevFolder = useCallback(
    (id: string, prevFolder: string | null) =>
      setMeta((prev) => ({ ...prev, [id]: { status: prev[id]?.status ?? 'todo', ...prev[id], prevFolder } })),
    [setMeta],
  );

  return { meta, statusOf, isFav, setStatus, toggleFav, setPrevFolder };
}

// ---------------- Spaces ----------------

export interface NikSpace {
  name: string;
  color: string;
}

export const DEFAULT_SPACES: NikSpace[] = [
  { name: 'Personal', color: '#7C6CF0' },
  { name: 'College', color: '#3B82F6' },
  { name: 'Work', color: '#F59E0B' },
  { name: 'Projects', color: '#EC4899' },
  { name: 'Ideas', color: '#10B981' },
  { name: 'Archive', color: '#94A3B8' },
];

const SPACES_KEY = 'niknote.desktop.spaces.v1';
const SPACE_COLORS = ['#7C6CF0', '#3B82F6', '#F59E0B', '#EC4899', '#10B981', '#06B6D4', '#F26D8D', '#8B5CF6'];

export function useSpaces(extraFolders: string[] = []) {
  const [custom, setCustom] = useLocalStore<NikSpace[]>(SPACES_KEY, []);

  const spaces: NikSpace[] = [...DEFAULT_SPACES];
  const seen = new Set(spaces.map((s) => s.name.toLowerCase()));
  for (const s of custom) {
    if (!seen.has(s.name.toLowerCase())) { spaces.push(s); seen.add(s.name.toLowerCase()); }
  }
  extraFolders.forEach((f, i) => {
    if (f && f !== '__trash__' && !seen.has(f.toLowerCase())) {
      spaces.push({ name: f, color: SPACE_COLORS[i % SPACE_COLORS.length] });
      seen.add(f.toLowerCase());
    }
  });

  const addSpace = useCallback(
    (name: string) => {
      const clean = name.trim();
      if (!clean) return null;
      const space: NikSpace = { name: clean, color: SPACE_COLORS[Math.floor(Math.random() * SPACE_COLORS.length)] };
      setCustom((prev) => (prev.some((s) => s.name.toLowerCase() === clean.toLowerCase()) ? prev : [...prev, space]));
      return space;
    },
    [setCustom],
  );

  return { spaces, addSpace };
}

// ---------------- Habits (home rings) ----------------

export interface NikHabit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  target: number; // per week
  unit: string;
  days: Record<string, number>; // YYYY-MM-DD -> count
}

const HABITS_KEY = 'niknote.desktop.habits.v1';

function seedHabits(): NikHabit[] {
  const mkDays = (counts: number[]) => {
    const days: Record<string, number> = {};
    counts.forEach((c, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (counts.length - 1 - i));
      days[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`] = c;
    });
    return days;
  };
  return [
    { id: 'habit-study', name: 'Study', emoji: '📚', color: '#22C55E', target: 4, unit: 'sessions', days: mkDays([1, 1, 1]) },
    { id: 'habit-read', name: 'Read', emoji: '📖', color: '#F5A623', target: 3, unit: 'sessions', days: mkDays([1, 0, 1]) },
    { id: 'habit-workout', name: 'Workout', emoji: '🏋️', color: '#38BDF8', target: 1, unit: 'session', days: mkDays([0, 0, 1]) },
    { id: 'habit-sleep', name: 'Sleep', emoji: '😴', color: '#8B7CF6', target: 8, unit: 'hours', days: mkDays([0, 0, 7]) },
  ];
}

/** Week progress for a habit = sum of the last 7 days (capped at target for the ring). */
export function habitWeekTotal(h: NikHabit): number {
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    total += h.days[k] || 0;
  }
  return total;
}

export function useDesktopHabits() {
  const [habits, setHabits] = useLocalStore<NikHabit[]>(HABITS_KEY, () => {
    const seeded = seedHabits();
    if (!localStorage.getItem(HABITS_KEY)) writeJSON(HABITS_KEY, seeded);
    return readJSON(HABITS_KEY, seeded);
  });

  const logToday = useCallback(
    (id: string, amount = 1) => {
      const k = todayStr();
      setHabits((prev) =>
        prev.map((h) => (h.id === id ? { ...h, days: { ...h.days, [k]: (h.days[k] || 0) + amount } } : h)),
      );
    },
    [setHabits],
  );

  return { habits, logToday };
}

// ---------------- Shared helpers ----------------

export function timeAgo(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day} days ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function niceDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function greeting(): { text: string; emoji: string } {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good Morning', emoji: '☀️' };
  if (h < 17) return { text: 'Good Afternoon', emoji: '🌤️' };
  return { text: 'Good Evening', emoji: '🌙' };
}
