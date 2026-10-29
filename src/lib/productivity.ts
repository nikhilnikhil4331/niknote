// ============================================================
// NikNote — productivity analytics (pure helpers)
// Every KPI and chart on the desktop dashboard is derived here
// from real, saved records: focus sessions, tasks, notes, habits.
// Honest-analytics rules:
//  - never invent history: empty input → zeroed series, UI shows
//    an empty state;
//  - never show a percentage change without a valid comparison
//    period: deltaPct returns null when there is no baseline;
//  - metrics with different units are never normalised onto one
//    misleading scale.
// ============================================================

export interface FocusSessionLike {
  /** ISO start timestamp. */
  startedAt: string;
  /** Actual focused seconds recorded when the session completed. */
  durationSec: number;
  /** Free-form category: Study / Work / Reading / Personal / Other … */
  category?: string | null;
}

export interface TaskLike {
  status: string;
  /** ISO timestamp set when the task was completed. */
  doneAt?: string;
  /** Due day YYYY-MM-DD. */
  due?: string;
}

export interface NoteLike {
  createdAt: string;
  updatedAt?: string;
}

export interface HabitLike {
  target: number;
  /** sum of completions over the period being scored */
  periodTotal: number;
}

export const dayKeyOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Last n local day keys ending today (oldest first). */
export function lastNDays(n: number, from: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() - i);
    out.push(dayKeyOf(d));
  }
  return out;
}

/** Short label for a day key: today/yesterday/weekday-or-date. */
export function dayLabel(key: string, today: Date = new Date()): string {
  const t = dayKeyOf(today);
  if (key === t) return 'Today';
  const y = dayKeyOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));
  if (key === y) return 'Yday';
  const d = new Date(`${key}T00:00:00`);
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
}

const isoDay = (iso?: string): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : dayKeyOf(d);
};

export const monthKeyOf = (d: Date): string => dayKeyOf(d).slice(0, 7);

/** Last n month keys (YYYY-MM) including the current month. */
export function lastNMonths(n: number, from: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(monthKeyOf(new Date(from.getFullYear(), from.getMonth() - i, 1)));
  }
  return out;
}

export function monthLabel(key: string): string {
  return new Date(`${key}-15T00:00:00`).toLocaleDateString('en-IN', { month: 'short' });
}

/** Focused minutes per arbitrary period key (day or month keys). */
export function focusMinutesByPeriod(
  sessions: FocusSessionLike[],
  periods: string[],
  keyOf: (iso: string) => string | null = isoDay,
): number[] {
  const totals = new Map<string, number>();
  for (const s of sessions) {
    const k = keyOf(s.startedAt);
    if (!k) continue;
    totals.set(k, (totals.get(k) ?? 0) + Math.max(0, s.durationSec) / 60);
  }
  return periods.map((k) => Math.round((totals.get(k) ?? 0) * 10) / 10);
}

export const focusMinutesByMonth = (s: FocusSessionLike[], months: string[]): number[] =>
  focusMinutesByPeriod(s, months, (iso) => isoDay(iso)?.slice(0, 7) ?? null);

export function tasksCompletedByMonth(tasks: TaskLike[], months: string[]): number[] {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (t.status !== 'done') continue;
    const k = isoDay(t.doneAt)?.slice(0, 7);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return months.map((k) => counts.get(k) ?? 0);
}

export function notesCreatedByMonth(notes: NoteLike[], months: string[]): number[] {
  const counts = new Map<string, number>();
  for (const n of notes) {
    const k = isoDay(n.createdAt)?.slice(0, 7);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return months.map((k) => counts.get(k) ?? 0);
}

/** Generator for a generic per-key counter — used by habit check-ins. */
export function countKeys<T>(items: T[], keys: string[], keyOf: (x: T) => string | null): number[] {
  const counts = new Map<string, number>();
  for (const it of items) {
    const k = keyOf(it);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return keys.map((k) => counts.get(k) ?? 0);
}

/** Focused minutes per day, aligned with the supplied day keys. */
export function focusMinutesByDay(sessions: FocusSessionLike[], days: string[]): number[] {
  const totals = new Map<string, number>();
  for (const s of sessions) {
    const k = isoDay(s.startedAt);
    if (!k) continue;
    totals.set(k, (totals.get(k) ?? 0) + Math.max(0, s.durationSec) / 60);
  }
  return days.map((k) => Math.round((totals.get(k) ?? 0) * 10) / 10);
}

/** Completed tasks per day (uses doneAt — the day completion happened). */
export function tasksCompletedByDay(tasks: TaskLike[], days: string[]): number[] {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (t.status !== 'done') continue;
    const k = isoDay(t.doneAt);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return days.map((k) => counts.get(k) ?? 0);
}

/** Notes created per day (createdAt only — edits/autosaves never counted). */
export function notesCreatedByDay(notes: NoteLike[], days: string[]): number[] {
  const counts = new Map<string, number>();
  for (const n of notes) {
    const k = isoDay(n.createdAt);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return days.map((k) => counts.get(k) ?? 0);
}

/** Notes edited per day (updatedAt), for activity trends. */
export function notesEditedByDay(notes: NoteLike[], days: string[]): number[] {
  const counts = new Map<string, number>();
  for (const n of notes) {
    const k = isoDay(n.updatedAt ?? n.createdAt);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return days.map((k) => counts.get(k) ?? 0);
}

export const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

/**
 * Habit score: completed units vs scheduled targets over the period,
 * each habit capped at its own target so one over-achieved habit
 * cannot hide a neglected one. 0–100.
 */
export function habitScorePct(habits: HabitLike[]): number {
  const totalTarget = sum(habits.map((h) => Math.max(0, h.target)));
  if (totalTarget <= 0) return 0;
  const done = sum(habits.map((h) => Math.min(Math.max(0, h.periodTotal), Math.max(0, h.target))));
  return Math.round((done / totalTarget) * 100);
}

/**
 * Honest period comparison: percent change of current vs previous.
 * Returns null when there is no valid baseline (previous = 0) so the
 * UI can stay silent instead of inventing "+100%".
 */
export function deltaPct(current: number, previous: number, minBaseline = 1): number | null {
  if (previous < minBaseline) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Focus-time share per category (biggest first), percentages sum ≈ 100. */
export function focusDistribution(
  sessions: FocusSessionLike[],
): { category: string; minutes: number; pct: number }[] {
  const totals = new Map<string, number>();
  for (const s of sessions) {
    const cat = (s.category || 'Other').trim() || 'Other';
    totals.set(cat, (totals.get(cat) ?? 0) + Math.max(0, s.durationSec) / 60);
  }
  const total = sum([...totals.values()]);
  if (total <= 0) return [];
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, minutes]) => ({
      category,
      minutes: Math.round(minutes),
      pct: Math.round((minutes / total) * 100),
    }));
}

/** "12h 45m" / "45m" / "0m" */
export function formatMinutesAsHours(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

/** Overdue open tasks: due before today and not done. */
export function overdueCount(tasks: TaskLike[], today: Date = new Date()): number {
  const t = dayKeyOf(today);
  return tasks.filter((x) => x.status !== 'done' && !!x.due && x.due < t).length;
}

/** Tasks done today. */
export function doneTodayCount(tasks: TaskLike[], today: Date = new Date()): number {
  const t = dayKeyOf(today);
  return tasks.filter((x) => x.status === 'done' && isoDay(x.doneAt) === t).length;
}
