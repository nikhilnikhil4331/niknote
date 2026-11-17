// ============================================================
// NikNote Desktop — local stores (tasks, note meta, spaces, habits)
// All persisted to localStorage so every widget on the desktop
// workspace is fully functional for cloud AND guest users,
// without touching the supabase schema or the mobile app.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { useOptionalAuth } from '@/contexts/AuthContext';
import { ownerScopedStorageKey } from '@/lib/ownerScopedStorage';

const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    try {
      const parsed = JSON.parse(raw);
      if (typeof fallback === 'boolean' && (parsed === 0 || parsed === 1)) return Boolean(parsed) as T;
      return parsed as T;
    } catch {
      // Older simple preferences were stored as bare strings instead of JSON.
      return (typeof fallback === 'string' ? raw : fallback) as T;
    }
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

/**
 * localStorage-backed state shared live across components in the same tab.
 * A valid cloud account gets its own key; guest/device mode keeps using the
 * legacy key so existing offline work remains accessible. Account changes
 * switch the visible value synchronously and never write the prior account's
 * in-memory state into the newly selected key.
 */
export function useLocalStore<T>(key: string, initial: T | (() => T)) {
  const auth = useOptionalAuth();
  const storageKey = ownerScopedStorageKey(key, auth?.user?.id);
  const fallback = () => typeof initial === 'function' ? (initial as () => T)() : initial;
  const [stored, setStored] = useState<{ key: string; value: T }>(() => ({
    key: storageKey,
    value: readJSON<T>(storageKey, fallback()),
  }));
  const value = stored.key === storageKey ? stored.value : readJSON<T>(storageKey, fallback());

  useEffect(() => {
    const sync = () => setStored({ key: storageKey, value: readJSON<T>(storageKey, fallback()) });
    sync();
    window.addEventListener(`nik-store:${storageKey}`, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(`nik-store:${storageKey}`, sync);
      window.removeEventListener('storage', sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setStored((previous) => {
        const priorValue = previous.key === storageKey
          ? previous.value
          : readJSON<T>(storageKey, fallback());
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(priorValue) : next;
        writeJSON(storageKey, resolved);
        return { key: storageKey, value: resolved };
      });
    },
    [storageKey],
  );

  return [value, set] as const;
}

// ---------------- Tasks ----------------

export type TaskStatus = 'todo' | 'doing' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high';

export const TASK_TAGS: { name: string; color: string }[] = [
  { name: 'Study', color: '#2869d5' },
  { name: 'Learning', color: '#b92d48' },
  { name: 'Work', color: '#247957' },
  { name: 'Health', color: '#368567' },
  { name: 'Reading', color: '#836108' },
  { name: 'Personal', color: '#c83f58' },
  { name: 'Other', color: '#68636c' },
];

export interface NikTask {
  id: string;
  title: string;
  status: TaskStatus;
  due?: string; // YYYY-MM-DD
  createdAt: string;
  doneAt?: string;
  tag?: string;
  time?: string; // HH:MM (24h) — display only
  priority?: TaskPriority;
}

export const TASK_COLUMNS: { id: TaskStatus; label: string; bg: string; dot: string }[] = [
  { id: 'todo', label: 'To Do', bg: '#eef4ff', dot: '#2869d5' },
  { id: 'doing', label: 'In Progress', bg: '#fff0f0', dot: '#c83f58' },
  { id: 'done', label: 'Done', bg: '#edf7f0', dot: '#247957' },
];

const TASKS_KEY = 'niknote.desktop.tasks.v1';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const todayKey = todayStr;

export function useTasks() {
  // Existing task records are preserved; genuinely new workspaces start empty.
  const [tasks, setTasks] = useLocalStore<NikTask[]>(TASKS_KEY, []);

  const addTask = useCallback(
    (title: string, status: TaskStatus = 'todo', due?: string, extra: Partial<Pick<NikTask, 'tag' | 'time' | 'priority'>> = {}) => {
      const clean = title.trim();
      if (!clean) return;
      setTasks((prev) => [
        { id: uid(), title: clean, status, due, createdAt: new Date().toISOString(), ...extra },
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

  /** Re-insert a previously removed task (used by Undo flows). */
  const restoreTask = useCallback(
    (task: NikTask) => {
      setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev : [task, ...prev]));
    },
    [setTasks],
  );

  const toggleDone = useCallback(
    (task: NikTask) => updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' }),
    [updateTask],
  );

  return { tasks, addTask, updateTask, removeTask, restoreTask, toggleDone };
}

// ---------------- Note meta (status / favourite overlay) ----------------

export interface NoteMeta {
  status: TaskStatus;
  fav?: boolean;
  pinned?: boolean;
  prevFolder?: string | null;
}

const META_KEY = 'niknote.desktop.noteMeta.v1';

export function useNoteMeta() {
  const [meta, setMeta] = useLocalStore<Record<string, NoteMeta>>(META_KEY, {});

  const statusOf = useCallback((id: string): TaskStatus => meta[id]?.status ?? 'todo', [meta]);
  const isFav = useCallback((id: string) => !!meta[id]?.fav, [meta]);
  const isPinned = useCallback((id: string) => !!meta[id]?.pinned, [meta]);

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
  const togglePinned = useCallback(
    (id: string) =>
      setMeta((prev) => ({
        ...prev,
        [id]: { status: prev[id]?.status ?? 'todo', ...prev[id], pinned: !prev[id]?.pinned },
      })),
    [setMeta],
  );
  const setPrevFolder = useCallback(
    (id: string, prevFolder: string | null) =>
      setMeta((prev) => ({ ...prev, [id]: { status: prev[id]?.status ?? 'todo', ...prev[id], prevFolder } })),
    [setMeta],
  );

  return { meta, statusOf, isFav, isPinned, setStatus, toggleFav, togglePinned, setPrevFolder };
}

// ---------------- Spaces ----------------

export interface NikSpace {
  name: string;
  color: string;
}

export const DEFAULT_SPACES: NikSpace[] = [
  { name: 'Personal', color: '#c83f58' },
  { name: 'College', color: '#2869d5' },
  { name: 'Work', color: '#247957' },
  { name: 'Projects', color: '#b92d48' },
  { name: 'Ideas', color: '#347ff0' },
  { name: 'Archive', color: '#89838c' },
];

const SPACES_KEY = 'niknote.desktop.spaces.v1';
const SPACE_COLORS = ['#2869d5', '#c83f58', '#ffe45c', '#347ff0', '#247957', '#b92d48', '#8db2ef', '#836108'];

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
      if (DEFAULT_SPACES.some((s) => s.name.toLowerCase() === clean.toLowerCase())) return null;
      const space: NikSpace = { name: clean, color: SPACE_COLORS[Math.floor(Math.random() * SPACE_COLORS.length)] };
      setCustom((prev) => (prev.some((s) => s.name.toLowerCase() === clean.toLowerCase()) ? prev : [...prev, space]));
      return space;
    },
    [setCustom],
  );

  /** Rename a CUSTOM space (defaults and folder-derived spaces are untouched). Returns false when not allowed. */
  const renameSpace = useCallback(
    (oldName: string, newName: string): boolean => {
      const clean = newName.trim();
      if (!clean || clean.toLowerCase() === oldName.toLowerCase()) return false;
      let ok = false;
      setCustom((prev) => {
        const exists = prev.some((s) => s.name === oldName);
        const dupe =
          DEFAULT_SPACES.some((s) => s.name.toLowerCase() === clean.toLowerCase()) ||
          prev.some((s) => s.name.toLowerCase() === clean.toLowerCase());
        if (!exists || dupe) return prev;
        ok = true;
        return prev.map((s) => (s.name === oldName ? { ...s, name: clean } : s));
      });
      return ok;
    },
    [setCustom],
  );

  /** Remove a CUSTOM space. Never removes defaults or note-backed folders. */
  const removeSpace = useCallback(
    (name: string) => setCustom((prev) => prev.filter((s) => s.name !== name)),
    [setCustom],
  );

  const isCustom = useCallback(
    (name: string) => custom.some((s) => s.name.toLowerCase() === name.toLowerCase()),
    [custom],
  );

  return { spaces, addSpace, renameSpace, removeSpace, isCustom };
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

/** Week progress for a habit = sum of the last 7 days (capped at target for the ring). */
export function habitWeekTotal(h: NikHabit): number {
  return habitRangeTotal(h, 0, 6);
}

/** Sum of a habit's counts over a day-offset window (0 = today). */
export function habitRangeTotal(h: NikHabit, fromDaysAgo: number, toDaysAgo: number): number {
  let total = 0;
  for (let i = fromDaysAgo; i <= toDaysAgo; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    total += h.days[k] || 0;
  }
  return total;
}

/** Habit check-ins per day key (how many habit logs happened on each day). */
export function habitCheckinsByDay(habits: NikHabit[], days: string[]): number[] {
  return days.map((k) => habits.reduce((acc, h) => acc + (h.days[k] || 0), 0));
}

export function useDesktopHabits() {
  // Keep existing logs untouched, but do not manufacture habits for new users.
  const [habits, setHabits] = useLocalStore<NikHabit[]>(HABITS_KEY, []);

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

// ---------------- Focus sessions (real recorded data for analytics) ----------------

export type FocusKind = 'pomodoro' | 'timer' | 'stopwatch';

export interface NikFocusSession {
  id: string;
  kind: FocusKind;
  /** ISO timestamp when the session started. */
  startedAt: string;
  /** ISO timestamp when it ended. */
  endedAt: string;
  /** Actual focused seconds (never the configured duration unless it ran to completion). */
  durationSec: number;
  category: string; // Study / Work / Reading / Personal / Other
  /** Optional task the session was linked to. */
  taskId?: string;
  taskTitle?: string;
  /** Pomodoro phase: focus vs break completion. */
  phase?: 'focus' | 'break';
}

const SESSIONS_KEY = 'niknote.desktop.focusSessions.v1';
export const FOCUS_SESSION_CAP = 2000; // localStorage safety cap

export function useFocusSessions() {
  const [sessions, setSessions] = useLocalStore<NikFocusSession[]>(SESSIONS_KEY, []);

  const recordSession = useCallback(
    (input: Omit<NikFocusSession, 'id'>) => {
      // Guard against duplicate/double-fire recording of the same instant.
      setSessions((prev) => {
        const last = prev[0];
        if (
          last &&
          last.kind === input.kind &&
          last.startedAt === input.startedAt &&
          last.durationSec === input.durationSec
        ) {
          return prev;
        }
        const session: NikFocusSession = { ...input, id: uid() };
        return [session, ...prev].slice(0, FOCUS_SESSION_CAP);
      });
    },
    [setSessions],
  );

  const removeSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, [setSessions]);

  return { sessions, recordSession, removeSession };
}

// ---------------- Timer settings + runtime persistence ----------------

export interface TimerSettings {
  sound: boolean;
  autoStartBreak: boolean;
  autoStartNextFocus: boolean;
  /** Pomodoro configuration, minutes. */
  pomodoroFocus: number;
  pomodoroShortBreak: number;
  pomodoroLongBreak: number;
  pomodoroRounds: number; // focus sessions before a long break
}

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  sound: true,
  autoStartBreak: false,
  autoStartNextFocus: false,
  pomodoroFocus: 25,
  pomodoroShortBreak: 5,
  pomodoroLongBreak: 15,
  pomodoroRounds: 4,
};

const TIMER_SETTINGS_KEY = 'niknote.desktop.timerSettings.v1';

export function useTimerSettings() {
  const [settings, setSettings] = useLocalStore<TimerSettings>(TIMER_SETTINGS_KEY, DEFAULT_TIMER_SETTINGS);
  const update = useCallback(
    (patch: Partial<TimerSettings>) => setSettings((prev) => ({ ...prev, ...patch })),
    [setSettings],
  );
  return { settings, update };
}

/**
 * Persisted running/paused timer so a refresh never loses a live session.
 * Countdown: { mode:'pomodoro'|'timer', phase, remainingSec, endAt|null }
 * Stopwatch: { mode:'stopwatch', baseMs, startedAt|null }
 */
export interface PersistedTimer {
  mode: FocusKind;
  // countdown/pomodoro
  phase?: 'idle' | 'focus' | 'shortBreak' | 'longBreak';
  remainingSec?: number;
  endAt?: number | null;
  configuredMin?: number;
  roundsDone?: number;
  category?: string;
  taskId?: string;
  taskTitle?: string;
  sessionStartedAt?: string;
  // stopwatch
  baseMs?: number;
  startedAt?: number | null;
  laps?: number[];
  savedAt: number;
}

/** Focus-session categories with brand accents (Study/Work/Reading/Personal/Other). */
export const FOCUS_CATEGORIES: { name: string; color: string }[] = [
  { name: 'Study', color: '#2869d5' },
  { name: 'Work', color: '#247957' },
  { name: 'Reading', color: '#836108' },
  { name: 'Personal', color: '#c83f58' },
  { name: 'Other', color: '#68636c' },
];

// ---------------- Linked task (shared between task lists and the timer) ----------------

const LINKED_TASK_KEY = 'niknote.desktop.linkedTask.v1';

/** The task a focus session is linked to — synced live across all timer/task widgets. */
export function useLinkedTask() {
  const [taskId, setTaskId] = useLocalStore<string>(LINKED_TASK_KEY, '');
  return { taskId, setTaskId };
}

const TIMER_STATE_KEY = 'niknote.desktop.timerState.v1';

export function loadPersistedTimer(ownerId?: string): PersistedTimer | null {
  try {
    const raw = localStorage.getItem(ownerScopedStorageKey(TIMER_STATE_KEY, ownerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedTimer;
    if (!parsed || typeof parsed !== 'object' || !parsed.mode) return null;
    // Ignore state older than 24h — a day-old "running" timer is nonsense.
    if (Date.now() - (parsed.savedAt || 0) > 24 * 3600_000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePersistedTimer(state: PersistedTimer | null, ownerId?: string) {
  const storageKey = ownerScopedStorageKey(TIMER_STATE_KEY, ownerId);
  try {
    if (!state) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, JSON.stringify({ ...state, savedAt: Date.now() }));
    }
  } catch {
    /* quota — ignore */
  }
}

// ---------------- Shared helpers ----------------

/** Ask the DesktopShell to open the global command palette (Ctrl+K equivalent). */
export function openCommandPalette() {
  try {
    window.dispatchEvent(new CustomEvent('nik:open-command-palette'));
  } catch {
    /* non-browser env */
  }
}


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
