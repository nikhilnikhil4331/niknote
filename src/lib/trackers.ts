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
