// Local store for the Niknote Habit experience. Persists per user in localStorage;
// all rules live in pure helpers (src/lib/trackers.ts).
import { toDay, unlockedAchievements, type HabitCategory, type HabitType, type FocusModeId } from './trackers';

export type Habit = {
  id: string;
  name: string;
  category: HabitCategory;
  icon: string;
  color: string;
  type: HabitType;
  target: number;
  days: number[]; // 0 = Sunday
  reminderOn: boolean;
  reminders: string[]; // "HH:MM"
  createdAt: string;
  archived: boolean;
};

export type Entry = { v: number; at?: string };
export type Todo = { id: string; title: string; done: boolean; priority: 'high' | 'medium' | 'low'; position: number };

export type RoutineState = {
  version: 1;
  onboarded: boolean;
  theme: 'light' | 'dark';
  notifications: boolean;
  habits: Habit[];
  entries: Record<string, Entry>; // `${habitId}|${day}`
  sleepTimes: Record<string, { bed?: string; wake?: string }>;
  todos: Todo[];
  focus: Record<string, number>; // day -> completed focus sessions
  focusMode: FocusModeId;
  customFocus: number;
  customBreak: number;
  unlocked: string[]; // achievement ids already celebrated
};

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;

const day = (offset: number, now = new Date()) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + offset);
  return toDay(d);
};

/** First-run sample data so every screen (charts, streaks, calendar) feels alive. Users can delete anything. */
export function seedState(now = new Date()): RoutineState {
  const entries: Record<string, Entry> = {};
  const put = (id: string, off: number, v: number, at?: string) => {
    entries[`${id}|${day(off, now)}`] = { v, ...(at ? { at: `${day(off, now)}T${at}:00` } : {}) };
  };
  const habits: Habit[] = [
    { id: uid(), name: 'Water Intake', category: 'health', icon: '💧', color: '#0ea5e9', type: 'water', target: 8, days: [0, 1, 2, 3, 4, 5, 6], reminderOn: true, reminders: ['08:00', '12:00', '16:00'], createdAt: day(-20, now), archived: false },
    { id: uid(), name: 'Sleep', category: 'health', icon: '🌙', color: '#8b5cf6', type: 'sleep', target: 8, days: [0, 1, 2, 3, 4, 5, 6], reminderOn: false, reminders: ['22:30'], createdAt: day(-20, now), archived: false },
    { id: uid(), name: 'Exercise', category: 'health', icon: '🏃', color: '#22c55e', type: 'minutes', target: 30, days: [0, 1, 2, 3, 4, 5, 6], reminderOn: true, reminders: ['07:00'], createdAt: day(-20, now), archived: false },
  ];
  const [w, s, x] = habits.map(h => h.id);
  // Past six days: mostly completed, a few misses so charts have shape.
  for (const off of [-6, -5, -4, -3, -2, -1]) {
    put(w, off, 8, '08:15');
    put(s, off, off === -3 ? 7 : 8, '06:40');
    put(x, off, off === -4 ? 20 : 35, off === -2 ? '19:30' : '07:05');
  }
  // Today: a realistic half-day — water 5/8 still pouring, sleep + exercise done → 2/3 (67%).
  put(w, 0, 5, '08:20');
  put(s, 0, 8, '06:00');
  put(x, 0, 30, '07:10');

  const y = day(-1, now);
  const focus = { [day(-2, now)]: 4, [y]: 3 };
  // Sample data already satisfies some achievements — pre-unlock them so first open is quiet.
  const unlocked = unlockedAchievements({
    habits: habits.map(h => ({ id: h.id, name: h.name, type: h.type, target: h.target, days: h.days })),
    entries,
    focus,
    today: day(0, now),
  }).map(a => a.id);
  return {
    version: 1,
    onboarded: false,
    theme: 'light',
    notifications: true,
    habits,
    entries,
    sleepTimes: { [day(0, now)]: { bed: '22:30', wake: '06:00' } },
    todos: [
      { id: uid(), title: 'Submit assignment', done: true, priority: 'high', position: 0 },
      { id: uid(), title: 'Revise chapter 4', done: false, priority: 'medium', position: 1 },
    ],
    focus,
    focusMode: 'pomodoro',
    customFocus: 25,
    customBreak: 5,
    unlocked,
  };
}

const KEY = (userId: string) => `niknote.habits.v1.${userId}`;

/** Parse saved state without seeding. Null when there is nothing (or it is corrupted). */
export function readState(userId: string): RoutineState | null {
  try {
    const raw = localStorage.getItem(KEY(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as RoutineState;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.habits)) {
        parsed.theme = parsed.theme === 'dark' ? 'dark' : 'light';
        parsed.focusMode = parsed.focusMode || 'pomodoro';
        parsed.unlocked = Array.isArray(parsed.unlocked) ? parsed.unlocked : [];
        parsed.sleepTimes = parsed.sleepTimes || {};
        parsed.focus = parsed.focus || {};
        parsed.entries = parsed.entries || {};
        parsed.todos = Array.isArray(parsed.todos) ? parsed.todos : [];
        return parsed;
      }
    }
  } catch { /* corrupted -> reseed */ }
  return null;
}

/** True when the user already has saved local data (guards first-run restore). */
export function hasSavedState(userId: string) {
  return readState(userId) !== null;
}

export function loadState(userId: string, now = new Date()): RoutineState {
  const saved = readState(userId);
  if (saved) return saved;
  const fresh = seedState(now);
  try { localStorage.setItem(KEY(userId), JSON.stringify(fresh)); } catch { /* storage full/blocked */ }
  return fresh;
}

export function saveState(userId: string, state: RoutineState) {
  try { localStorage.setItem(KEY(userId), JSON.stringify(state)); } catch { /* storage full/blocked */ }
}

export function stateKey(userId: string) { return KEY(userId); }
