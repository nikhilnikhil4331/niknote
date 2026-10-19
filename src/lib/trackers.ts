// Pure helpers shared by Money and Routine trackers
export const EXPENSE_CATEGORIES = [
  { name: 'Food', emoji: '🍔', color: 'hsl(25 90% 55%)' },
  { name: 'Transport', emoji: '🚌', color: 'hsl(200 80% 50%)' },
  { name: 'Shopping', emoji: '🛍️', color: 'hsl(320 70% 55%)' },
  { name: 'Bills', emoji: '🧾', color: 'hsl(0 70% 55%)' },
  { name: 'Entertainment', emoji: '🎬', color: 'hsl(270 65% 60%)' },
  { name: 'Education', emoji: '📚', color: 'hsl(150 60% 42%)' },
  { name: 'Health', emoji: '💊', color: 'hsl(170 60% 45%)' },
  { name: 'Other', emoji: '📦', color: 'hsl(220 10% 55%)' },
] as const;

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED'] as const;

export function formatMoney(amount: number, currency = 'INR') {
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency', currency, maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

export function toDay(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Consecutive days ending today (or yesterday if today not done yet). */
export function computeStreak(days: string[], today: Date = new Date()) {
  const set = new Set(days);
  const cursor = new Date(today);
  if (!set.has(toDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (set.has(toDay(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Split a bill evenly; remainder paise go to the first people so total matches. */
export function splitBill(total: number, people: number) {
  if (people < 1) return [];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / people);
  const extra = cents - base * people;
  return Array.from({ length: people }, (_, i) => (base + (i < extra ? 1 : 0)) / 100);
}

/** Bill reminder state for this month: paid, overdue, soon (within 3 days) or later. */
export function billStatus(b: { due_day: number; last_paid_month: string | null }, now = new Date()) {
  if (b.last_paid_month === toDay(now).slice(0, 7)) return 'paid';
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const due = Math.min(b.due_day, lastDay);
  const diff = due - now.getDate();
  if (diff < 0) return 'overdue';
  if (diff <= 3) return 'soon';
  return 'later';
}

/** Month-to-date totals from saved transactions (dates are YYYY-MM-DD local days). */
export function monthSummary(rows: { kind: string; amount: number | string; occurred_on: string }[], today: Date = new Date()) {
  const prefix = toDay(today).slice(0, 7);
  let spent = 0, income = 0;
  for (const r of rows) {
    if (!r.occurred_on?.startsWith(prefix)) continue;
    const a = Number(r.amount) || 0;
    if (r.kind === "income") income += a; else if (r.kind === "expense") spent += a;
  }
  return { spent, income, balance: income - spent };
}

export const ACCOUNTS = ['Cash', 'UPI', 'Bank', 'Card'] as const;
type MoneyRow = { kind: string; amount: number | string; account?: string | null; to_account?: string | null; occurred_on?: string };

/** Account balances: income adds, expense subtracts, transfer moves between accounts (net zero overall). */
export function accountBalances(rows: MoneyRow[]) {
  const bal: Record<string, number> = {};
  const add = (k: string, v: number) => { bal[k] = Math.round(((bal[k] ?? 0) + v) * 100) / 100; };
  for (const r of rows) {
    const a = Number(r.amount) || 0; const acc = r.account || 'Cash';
    if (r.kind === 'income') add(acc, a);
    else if (r.kind === 'expense') add(acc, -a);
    else if (r.kind === 'transfer' && r.to_account && r.to_account !== acc) { add(acc, -a); add(r.to_account, a); }
  }
  return bal;
}

/** Income/expense totals that never count transfers. */
export function cashflow(rows: MoneyRow[]) {
  let income = 0, expense = 0;
  for (const r of rows) { const a = Number(r.amount) || 0; if (r.kind === 'income') income += a; else if (r.kind === 'expense') expense += a; }
  return { income, expense, net: income - expense };
}

/** Streak over scheduled weekdays only (0=Sun). Unscheduled days never break it; today counts only if done. */
export function scheduledStreak(doneDays: string[], days: number[] = [0,1,2,3,4,5,6], today: Date = new Date(), limit = 400) {
  const set = new Set(doneDays); const sched = new Set(days.length ? days : [0,1,2,3,4,5,6]);
  const c = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let streak = 0;
  for (let i = 0; i < limit; i++, c.setDate(c.getDate() - 1)) {
    if (!sched.has(c.getDay())) continue;
    const d = toDay(c);
    if (set.has(d)) streak++;
    else if (i === 0) continue; // today not done yet
    else break;
  }
  return streak;
}

export const isScheduled = (days: number[] | null | undefined, d: Date = new Date()) => !days?.length || days.includes(d.getDay());

/** Expense totals per category, biggest first, with share of total spending (0-100). Transfers/income ignored. */
export function topCategories(txs: { kind: string; amount: number; category: string }[], limit = 3) {
  const map = new Map<string, number>();
  for (const t of txs) if (t.kind === 'expense') map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  const total = [...map.values()].reduce((s, v) => s + v, 0);
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
    .map(([category, amount]) => ({ category, amount, pct: total ? Math.round((amount / total) * 100) : 0 }));
}

// ── Niknote Habit routine (pure helpers, used by the /habit mobile experience) ──
export type HabitType = 'water' | 'sleep' | 'minutes' | 'times';
export type HabitCategory = 'health' | 'study' | 'productivity' | 'mind' | 'social' | 'other';

export const HABIT_CATEGORIES: { id: HabitCategory; label: string; icon: string }[] = [
  { id: 'health', label: 'Health', icon: '💜' },
  { id: 'study', label: 'Study', icon: '📖' },
  { id: 'productivity', label: 'Productivity', icon: '⚙️' },
  { id: 'mind', label: 'Mind', icon: '🧠' },
  { id: 'social', label: 'Social', icon: '👥' },
  { id: 'other', label: 'Other', icon: '✨' },
];

export const HABIT_ICONS = [
  '💧', '🌙', '🏃', '📖', '🧘', '💪', '🥗', '🎯',
  '📝', '🧠', '💤', '🎨', '🎸', '🚶', '🏊', '🧹',
  '☀️', '🍎', '💊', '🙏', '📵', '💻', '🗣️', '🌱',
  '❤️', '🎵', '🧺', '📞', '🚴', '🧊', '🍵', '✍️',
];

export const HABIT_COLORS = ['#8b5cf6', '#ec4899', '#f97316', '#f59e0b', '#22c55e', '#14b8a6', '#0ea5e9', '#6366f1'];

export function greetingFor(hour: number) {
  if (hour < 5) return 'Good Night';
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function habitUnit(type: HabitType) {
  if (type === 'water') return 'glasses';
  if (type === 'sleep') return 'hours';
  if (type === 'minutes') return 'minutes';
  return 'times';
}

/** Per-tap step for a habit type. */
export function stepFor(type: HabitType) {
  if (type === 'sleep') return 0.5;
  if (type === 'minutes') return 5;
  return 1;
}

export function fmtHabitValue(v: number, type: HabitType) {
  if (type === 'sleep') return `${Math.round(v * 10) / 10} h`;
  if (type === 'minutes') return `${Math.round(v)} min`;
  if (type === 'water') return v % 1 ? v.toFixed(1) : String(Math.round(v));
  return String(Math.round(v));
}

/** Entries are stored as `${habitId}|${day}` -> { v, at? }. */
export const entryKey = (habitId: string, day: string) => `${habitId}|${day}`;
export const entryValue = (entries: Record<string, { v: number; at?: string }>, habitId: string, day: string) =>
  entries[entryKey(habitId, day)]?.v ?? 0;

/** Days where the habit hit its target, going back `limit` days from `today`. */
export function habitDoneDays(entries: Record<string, { v: number; at?: string }>, habitId: string, target: number, today: Date = new Date(), limit = 400) {
  const days: string[] = [];
  for (let i = 0; i < limit; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    d.setDate(d.getDate() - i);
    const day = toDay(d);
    if ((entries[entryKey(habitId, day)]?.v ?? 0) >= target) days.push(day);
    if (i > 365) break;
  }
  return days;
}

/** Streak for one habit, counting only its scheduled weekdays. */
export function habitStreak(entries: Record<string, { v: number; at?: string }>, habit: { id: string; target: number; days?: number[] }, today: Date = new Date()) {
  return scheduledStreak(habitDoneDays(entries, habit.id, habit.target, today), habit.days, today);
}

export function bestStreakAcross(entries: Record<string, { v: number; at?: string }>, habits: { id: string; target: number; days?: number[] }[], today: Date = new Date()) {
  return habits.reduce((best, h) => Math.max(best, habitStreak(entries, h, today)), 0);
}

/** Completion across the last 7 days: scheduled slots vs done slots, with per-day percentages. */
export function weekCompletion(
  entries: Record<string, { v: number; at?: string }>,
  habits: { id: string; target: number; days?: number[] }[],
  today: Date = new Date(),
) {
  const perDay: { day: string; label: string; pct: number; total: number; done: number }[] = [];
  let slots = 0, done = 0;
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    d.setDate(d.getDate() - i);
    const day = toDay(d);
    const sched = habits.filter(h => isScheduled(h.days, d));
    const dDone = sched.filter(h => (entries[entryKey(h.id, day)]?.v ?? 0) >= h.target).length;
    slots += sched.length; done += dDone;
    perDay.push({
      day,
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      pct: sched.length ? Math.round((dDone / sched.length) * 100) : 0,
      total: sched.length,
      done: dDone,
    });
  }
  return { pct: slots ? Math.round((done / slots) * 100) : 0, slots, done, perDay };
}

/** Sleep minutes between "HH:MM" bed and "HH:MM" wake, wrapping past midnight. Null when unparseable. */
export function sleepMinutes(bed: string, wake: string) {
  const parse = (t: string) => { const [h, m] = t.split(':').map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null; };
  const b = parse(bed), w = parse(wake);
  if (b == null || w == null) return null;
  const mins = w - b;
  return mins < 0 ? mins + 24 * 60 : mins;
}

export const KCAL_PER_MIN = 4;
export const KM_PER_MIN = 0.077;
export function exerciseStats(mins: number) {
  const m = Math.max(0, mins);
  return { kcal: Math.round(m * KCAL_PER_MIN), km: Math.round(m * KM_PER_MIN * 10) / 10 };
}

export type FocusModeId = 'pomodoro' | 'deep' | 'custom';
const clampInt = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n) || lo));
export function focusDurations(mode: FocusModeId, customFocus = 25, customBreak = 5) {
  switch (mode) {
    case 'pomodoro': return { focus: 25 * 60, break: 5 * 60 };
    case 'deep': return { focus: 50 * 60, break: 10 * 60 };
    case 'custom': return { focus: clampInt(customFocus, 1, 180) * 60, break: clampInt(customBreak, 1, 60) * 60 };
  }
}

export const FOCUS_QUOTES = [
  'Small steps every day lead to big results.',
  'You do not rise to the level of your goals, you fall to the level of your systems.',
  'Focus is a superpower. Use it wisely.',
  'One hour of deep work beats three hours of busy work.',
  'The secret of getting ahead is getting started.',
];

export type AchievementCtx = {
  habits: { id: string; name: string; type: string; target: number; days: number[] }[];
  entries: Record<string, { v: number; at?: string }>;
  focus: Record<string, number>;
  today: string;
};
export type AchievementDef = { id: string; name: string; desc: string; icon: string; color: string; test: (c: AchievementCtx) => boolean };

const anyEntryDone = (c: AchievementCtx) => Object.values(c.entries).some(e => e.v > 0);
const streakOf = (c: AchievementCtx) => bestStreakAcross(c.entries, c.habits, new Date(c.today + 'T12:00'));

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-step', name: 'First Step', desc: 'Complete your first habit', icon: '⭐', color: '#f59e0b', test: anyEntryDone },
  { id: 'streak-3', name: '3 Day Streak', desc: 'Keep going!', icon: '🔥', color: '#f97316', test: c => streakOf(c) >= 3 },
  { id: 'hydration-hero', name: 'Hydration Hero', desc: 'Drink 8 glasses in a day', icon: '💧', color: '#0ea5e9', test: c => c.habits.some(h => h.type === 'water') && Object.values(c.entries).some(e => e.v >= 8) },
  { id: 'early-bird', name: 'Early Bird', desc: 'Complete a habit before 8 AM', icon: '🐦', color: '#8b5cf6', test: c => Object.values(c.entries).some(e => e.v > 0 && !!e.at && e.at.slice(11, 16) < '08:00') },
  { id: 'streak-7', name: 'Week Warrior', desc: 'Hit a 7 day streak', icon: '🚀', color: '#ec4899', test: c => streakOf(c) >= 7 },
  { id: 'perfect-week', name: 'Perfect Week', desc: '100% habits for 7 straight days', icon: '🏆', color: '#f59e0b', test: c => { const w = weekCompletion(c.entries, c.habits, new Date(c.today + 'T12:00')); return w.slots > 0 && w.perDay.every(p => p.pct === 100); } },
  { id: 'focus-4', name: 'Deep Diver', desc: 'Finish 4 focus sessions in a day', icon: '⏱️', color: '#3b82f6', test: c => Object.values(c.focus).some(n => n >= 4) },
  { id: 'night-owl', name: 'Night Owl', desc: 'Log a workout after 7 PM', icon: '🦉', color: '#6366f1', test: c => c.habits.some(h => h.type === 'minutes') && Object.values(c.entries).some(e => e.v > 0 && !!e.at && e.at.slice(11, 16) >= '19:00') },
];

export function unlockedAchievements(c: AchievementCtx) {
  return ACHIEVEMENTS.filter(a => { try { return a.test(c); } catch { return false; } });
}

/** Water glass fill: clamps drunk glasses to 0..goal*2 and returns fill ratio 0..1 plus ml. */
export const GLASS_ML = 250;
export function waterProgress(glasses: number, goal: number) {
  const g = Math.max(1, Math.round(goal) || 1);
  const drunk = Math.max(0, Math.round(glasses) || 0);
  const left = Math.max(0, g - drunk);
  return { drunk, goal: g, left, ratio: Math.min(1, drunk / g), drunkMl: drunk * GLASS_ML, goalMl: g * GLASS_ML, done: drunk >= g };
}

/** One row per calendar day from `from` to `to` (inclusive), gaps filled with 0; transfers are ignored. */
export function dailyCashSeries(txs: { kind: string; amount: number; occurred_on: string }[], from: string, to: string) {
  const out: { day: string; label: string; income: number; expense: number; net: number }[] = [];
  const idx = new Map<string, number>();
  const d = new Date(from + 'T12:00');
  const end = new Date(to + 'T12:00');
  for (let i = 0; d <= end && i < 400; i++, d.setDate(d.getDate() + 1)) {
    const day = toDay(d);
    idx.set(day, out.length);
    out.push({ day, label: String(d.getDate()), income: 0, expense: 0, net: 0 });
  }
  for (const t of txs) {
    const i = idx.get(t.occurred_on);
    if (i === undefined || (t.kind !== 'income' && t.kind !== 'expense')) continue;
    const amt = Number(t.amount) || 0;
    if (t.kind === 'income') out[i].income += amt; else out[i].expense += amt;
  }
  let running = 0;
  for (const r of out) { running += r.income - r.expense; r.net = running; }
  return out;
}

/** Longest historical run of scheduled completions (not just the current streak). */
export function bestHabitStreakEver(
  entries: Record<string, { v: number; at?: string }>,
  habit: { id: string; target: number; days?: number[] },
  today: Date = new Date(),
  limit = 400,
) {
  const done = new Set(habitDoneDays(entries, habit.id, habit.target, today, limit));
  let best = 0;
  let run = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (limit - 1));
  for (let i = 0; i < limit; i++, cursor.setDate(cursor.getDate() + 1)) {
    if (!isScheduled(habit.days, cursor)) continue;
    if (done.has(toDay(cursor))) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

/** Best historical streak across all habits (0 when there are none). */
export function bestStreakHistory(
  entries: Record<string, { v: number; at?: string }>,
  habits: { id: string; target: number; days?: number[] }[],
  today: Date = new Date(),
) {
  return habits.reduce((best, h) => Math.max(best, bestHabitStreakEver(entries, h, today)), 0);
}

/** Scheduled / completed counts for one calendar day. */
export function completionForDay(
  entries: Record<string, { v: number; at?: string }>,
  habits: { id: string; target: number; days?: number[] }[],
  date: Date,
) {
  const day = toDay(date);
  const scheduled = habits.filter(h => isScheduled(h.days, date));
  const done = scheduled.filter(h => (entries[entryKey(h.id, day)]?.v ?? 0) >= h.target).length;
  return { day, total: scheduled.length, done, pct: scheduled.length ? Math.round((done / scheduled.length) * 100) : 0 };
}

/** Completion over an arbitrary list of day keys (duplicate-free: one slot per habit/day). */
export function rangeCompletion(
  entries: Record<string, { v: number; at?: string }>,
  habits: { id: string; target: number; days?: number[] }[],
  days: string[],
) {
  let slots = 0;
  let done = 0;
  for (const day of days) {
    const date = new Date(day + 'T12:00');
    for (const h of habits) {
      if (!isScheduled(h.days, date)) continue;
      slots += 1;
      if ((entries[entryKey(h.id, day)]?.v ?? 0) >= h.target) done += 1;
    }
  }
  return { slots, done, pct: slots ? Math.round((done / slots) * 100) : 0 };
}

/** Completions grouped by habit category over the trailing `daysBack` days. */
export function categoryBreakdown(
  entries: Record<string, { v: number; at?: string }>,
  habits: { id: string; category: string; target: number; days?: number[] }[],
  today: Date = new Date(),
  daysBack = 7,
) {
  const buckets = new Map<string, { done: number; total: number }>();
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    for (const h of habits) {
      if (!isScheduled(h.days, d)) continue;
      const b = buckets.get(h.category) ?? { done: 0, total: 0 };
      b.total += 1;
      if ((entries[entryKey(h.id, toDay(d))]?.v ?? 0) >= h.target) b.done += 1;
      buckets.set(h.category, b);
    }
  }
  return [...buckets.entries()]
    .map(([category, b]) => ({ category, ...b, pct: b.total ? Math.round((b.done / b.total) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct);
}

/** Streak milestones used by the streaks screen. */
export const STREAK_MILESTONES = [3, 7, 30] as const;
export function milestoneProgress(best: number) {
  return STREAK_MILESTONES.map(days => ({ days, reached: best >= days, pct: Math.min(1, best / days) }));
}
