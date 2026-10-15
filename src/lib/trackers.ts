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
