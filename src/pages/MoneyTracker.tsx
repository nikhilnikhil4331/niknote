import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import confetti from 'canvas-confetti';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area, CartesianGrid } from 'recharts';
import { MoneyArt } from '@/components/motion/FeatureArt';
import { Plus, Trash2, Target, Users, Download, Coins, Camera, Loader2, Bell, CheckCircle2, Sparkles, TrendingDown, TrendingUp, FileDown, PiggyBank, ReceiptText } from 'lucide-react';
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { haptic } from '@/hooks/useHaptics';
import { toast } from 'sonner';
import { TrackerShell, Panel } from '@/components/trackers/TrackerShell';
import { SemiCircularDial, type DialItem } from '@/components/dial/SemiCircularDial';
import { EXPENSE_CATEGORIES, CURRENCIES, formatMoney, accountBalances, cashflow, ACCOUNTS, toDay, splitBill, billStatus, topCategories, dailyCashSeries } from '@/lib/trackers';
import { syncLocalMoneyToCloud } from '@/lib/cloudSyncEngine';
import { NKProgressBar } from '@/components/nk';

type Tx = { id: string; kind: string; amount: number; category: string; note: string; occurred_on: string; account: string; to_account: string | null };
type Goal = { id: string; name: string; target: number; saved: number };
type Range = 'week' | 'month' | 'year';
type Bill = { id: string; name: string; amount: number; due_day: number; last_paid_month: string | null };

const catOf = (n: string) => EXPENSE_CATEGORIES.find(c => c.name === n) ?? EXPENSE_CATEGORIES[7];
const db = supabase as any;
const LOCAL_MONEY_KEY = 'niknote.money.v1.local';

function readLocalMoney(): { txs: Tx[]; goals: Goal[]; bills: Bill[]; currency: string; budget: number } {
  try {
    const raw = localStorage.getItem(LOCAL_MONEY_KEY);
    if (!raw) return { txs: [], goals: [], bills: [], currency: 'INR', budget: 0 };
    const parsed = JSON.parse(raw);
    return {
      txs: Array.isArray(parsed.txs) ? parsed.txs : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      bills: Array.isArray(parsed.bills) ? parsed.bills : [],
      currency: typeof parsed.currency === 'string' ? parsed.currency : 'INR',
      budget: Number(parsed.budget) || 0,
    };
  } catch {
    return { txs: [], goals: [], bills: [], currency: 'INR', budget: 0 };
  }
}

function writeLocalMoney(state: { txs: Tx[]; goals: Goal[]; bills: Bill[]; currency: string; budget: number }) {
  try { localStorage.setItem(LOCAL_MONEY_KEY, JSON.stringify(state)); } catch { /* quota */ }
}

const localId = () => `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export default function MoneyTracker() {
  const { user, loading: authLoading } = useAuth();
  const [txs, setTxs] = useState<Tx[]>(() => readLocalMoney().txs);
  const [goals, setGoals] = useState<Goal[]>(() => readLocalMoney().goals);
  const [currency, setCurrency] = useState(() => readLocalMoney().currency);
  const [budget, setBudget] = useState(() => readLocalMoney().budget);
  const [range, setRange] = useState<Range>('month');
  const [form, setForm] = useState({ kind: 'expense', amount: '', category: 'Food', note: '', occurred_on: toDay(new Date()), account: 'Cash', to_account: 'Bank' });
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [goalForm, setGoalForm] = useState({ name: '', target: '' });
  const [split, setSplit] = useState({ total: '', people: '2' });
  const [scanning, setScanning] = useState(false);
  const [bills, setBills] = useState<Bill[]>(() => readLocalMoney().bills);
  const [billForm, setBillForm] = useState({ name: '', amount: '', due_day: '' });
  const [search, setSearch] = useState('');

  const amountRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const isLocalOnly = !user || String(user.id || '').startsWith('local-guest-');

  /** Smoothly reveal a panel (and focus an input when given) — used by the dial. */
  const focusPanel = (id: string, focus?: React.RefObject<HTMLInputElement>) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => focus?.current?.focus({ preventScroll: true }), 350);
  };

  // Always mirror device state cleanly when not signed in to cloud
  useEffect(() => {
    if (authLoading || !isLocalOnly) return;
    writeLocalMoney({ txs, goals, bills, currency, budget });
  }, [txs, goals, bills, currency, budget, isLocalOnly, authLoading]);

  useEffect(() => {
    if (isLocalOnly || !user) return;
    const loadTimer = window.setTimeout(() => setLoadError(true), 12000);
    (async () => {
      // Push any offline/guest local transactions, goals & bills to cloud FIRST so nothing is ever lost
      await syncLocalMoneyToCloud(user.id).catch(() => 0);

      const [t, g, s, b] = await Promise.all([
        db.from('money_transactions').select('*').order('occurred_on', { ascending: false }).limit(1000),
        db.from('money_goals').select('*').order('created_at'),
        db.from('tracker_settings').select('*').maybeSingle(),
        db.from('bill_reminders').select('*').order('due_day'),
      ]);
      window.clearTimeout(loadTimer);
      setLoadError(!!t.error);
      if (!t.error) {
        setTxs((t.data ?? []).map((x: any) => ({ ...x, amount: Number(x.amount) })));
        setGoals((g.data ?? []).map((x: any) => ({ ...x, target: Number(x.target), saved: Number(x.saved) })));
        if (s.data) { setCurrency(s.data.currency); setBudget(Number(s.data.monthly_budget)); }
        const billRows = (b.data ?? []).map((x: any) => ({ ...x, amount: Number(x.amount) }));
        setBills(billRows);
        const due = billRows.filter((x: Bill) => billStatus(x) !== 'paid' && billStatus(x) !== 'later');
        if (due.length) {
          toast.warning(`${due.length} bill${due.length > 1 ? 's' : ''} due soon: ${due.map((x: Bill) => x.name).join(', ')}`);
          if ('Notification' in window && Notification.permission === 'granted') new Notification('Niknote bill reminder', { body: due.map((x: Bill) => `${x.name} — due on ${x.due_day}`).join('\n') });
        }
      }
    })();
    return () => window.clearTimeout(loadTimer);
  }, [user, isLocalOnly, reload]);

  const saveSettings = async (patch: { currency?: string; monthly_budget?: number }) => {
    if (isLocalOnly || !user) return;
    await db.from('tracker_settings').upsert({ user_id: user.id, currency, monthly_budget: budget, ...patch, updated_at: new Date().toISOString() });
  };

  const addTx = async () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { haptic('error'); return toast.error('Enter a valid amount'); }
    if (Math.round(amount * 100) !== amount * 100) { haptic('error'); return toast.error('Use at most 2 decimals'); }
    if (form.kind === 'transfer' && form.account === form.to_account) { haptic('error'); return toast.error('Pick two different accounts'); }
    const row = { kind: form.kind, amount, note: form.note, occurred_on: form.occurred_on, account: form.account, to_account: form.kind === 'transfer' ? form.to_account : null,
      category: form.kind === 'income' ? 'Income' : form.kind === 'transfer' ? 'Transfer' : form.category };
    if (isLocalOnly) {
      haptic('medium');
      setTxs(p => [{ id: localId(), ...row }, ...p]);
      setForm(f => ({ ...f, amount: '', note: '' }));
      toast.success('Saved on device');
      return;
    }
    const { data, error } = await db.from('money_transactions').insert(row).select().single();
    if (error) {
      // Flaky network fallback: save locally and queue for cloud sync!
      const fallbackEntry = { id: localId(), ...row };
      setTxs(p => [fallbackEntry, ...p]);
      writeLocalMoney({ txs: [fallbackEntry, ...readLocalMoney().txs], goals, bills, currency, budget });
      setForm(f => ({ ...f, amount: '', note: '' }));
      toast.success('Saved on device — will sync when online ✨');
      return;
    }
    haptic('medium');
    setTxs(p => [{ ...data, amount: Number(data.amount) }, ...p]);
    setForm(f => ({ ...f, amount: '', note: '' }));
  };

  const delTx = async (id: string) => {
    if (!window.confirm('Delete this entry?')) return;
    haptic('heavy');
    const prev = txs;
    setTxs(p => p.filter(t => t.id !== id));
    if (!user) return;
    const { error } = await db.from('money_transactions').delete().eq('id', id);
    if (error) { setTxs(prev); toast.error('Could not delete. Try again.'); }
  };

  const editTx = async (t: Tx) => {
    const a = window.prompt('Amount', String(t.amount)); if (a === null) return;
    const amount = Number(a); if (!amount || amount <= 0) return toast.error('Enter a valid amount');
    const note = window.prompt('Note', t.note) ?? t.note;
    if (user) {
      const { error } = await db.from('money_transactions').update({ amount, note }).eq('id', t.id);
      if (error) return toast.error('Could not save the change');
    }
    setTxs(p => p.map(x => x.id === t.id ? { ...x, amount, note } : x)); haptic('success');
  };

  const scanReceipt = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return toast.error('Use a PNG, JPG or WEBP photo');
    if (file.size > 5 * 1024 * 1024) return toast.error('Photo must be under 5MB');
    setScanning(true);
    try {
      const image = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file); });
      const { data, error } = await supabase.functions.invoke('scan-receipt', { body: { image } });
      if (error || data?.error) {
        let msg = data?.error;
        try { msg = msg || (await (error as any)?.context?.json())?.error; } catch { /* noop */ }
        throw new Error(msg || 'Could not read the receipt');
      }
      const { data: row, error: insErr } = await db.from('money_transactions').insert({ kind: 'expense', amount: data.amount, category: data.category, note: data.note || 'Receipt', occurred_on: data.date }).select().single();
      if (insErr) throw insErr;
      setTxs(p => [{ ...row, amount: Number(row.amount) }, ...p]);
      haptic('success');
      toast.success(`Added ${formatMoney(data.amount, currency)} · ${data.category}${data.note ? ' · ' + data.note : ''}`);
    } catch (e: any) {
      haptic('error'); toast.error(e.message);
    } finally { setScanning(false); }
  };

  const addBill = async () => {
    const due_day = Number(billForm.due_day);
    if (!billForm.name.trim() || !(due_day >= 1 && due_day <= 31)) return toast.error('Add a bill name and due day (1-31)');
    if (!user) {
      haptic('light');
      setBills(p => [...p, { id: localId(), name: billForm.name.trim(), amount: Number(billForm.amount) || 0, due_day, last_paid_month: null }].sort((a, b) => a.due_day - b.due_day));
      setBillForm({ name: '', amount: '', due_day: '' });
      return;
    }
    const { data, error } = await db.from('bill_reminders').insert({ name: billForm.name.trim(), amount: Number(billForm.amount) || 0, due_day }).select().single();
    if (error) return toast.error(error.message);
    haptic('light');
    setBills(p => [...p, { ...data, amount: Number(data.amount) }].sort((a, b) => a.due_day - b.due_day));
    setBillForm({ name: '', amount: '', due_day: '' });
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  };
  const payBill = async (b: Bill) => {
    const month = toDay(new Date()).slice(0, 7);
    setBills(p => p.map(x => x.id === b.id ? { ...x, last_paid_month: month } : x));
    if (!user) {
      if (b.amount > 0) setTxs(p => [{ id: localId(), kind: 'expense', amount: b.amount, category: 'Bills', note: b.name, occurred_on: toDay(new Date()), account: 'Cash', to_account: null }, ...p]);
      haptic('success'); toast.success(`${b.name} marked paid`);
      return;
    }
    await db.from('bill_reminders').update({ last_paid_month: month }).eq('id', b.id);
    if (b.amount > 0) {
      const { data } = await db.from('money_transactions').insert({ kind: 'expense', amount: b.amount, category: 'Bills', note: b.name }).select().single();
      if (data) setTxs(p => [{ ...data, amount: Number(data.amount) }, ...p]);
    }
    haptic('success'); toast.success(`${b.name} marked paid`);
  };
  const delBill = async (id: string) => { haptic('heavy'); setBills(p => p.filter(b => b.id !== id)); if (user) await db.from('bill_reminders').delete().eq('id', id); };

  const addGoal = async () => {
    const target = Number(goalForm.target);
    if (!goalForm.name.trim() || !target) return toast.error('Add a name and target');
    if (!user) {
      haptic('light');
      setGoals(p => [...p, { id: localId(), name: goalForm.name.trim(), target, saved: 0 }]);
      setGoalForm({ name: '', target: '' });
      return;
    }
    const { data, error } = await db.from('money_goals').insert({ name: goalForm.name.trim(), target }).select().single();
    if (error) return toast.error(error.message);
    haptic('light');
    setGoals(p => [...p, { ...data, target: Number(data.target), saved: 0 }]);
    setGoalForm({ name: '', target: '' });
  };

  const addToGoal = async (g: Goal, amt: number) => {
    const saved = Math.max(0, g.saved + amt);
    setGoals(p => p.map(x => x.id === g.id ? { ...x, saved } : x));
    if (user) await db.from('money_goals').update({ saved }).eq('id', g.id);
    if (g.saved < g.target && saved >= g.target) {
      haptic('success');
      confetti({ particleCount: 160, spread: 90, origin: { y: 0.6 } });
      toast.success(`Goal reached: ${g.name} 🎉`);
    } else haptic('light');
  };

  const delGoal = async (id: string) => {
    haptic('heavy');
    setGoals(p => p.filter(g => g.id !== id));
    if (user) await db.from('money_goals').delete().eq('id', id);
  };

  const now = new Date();
  const fromDay = useMemo(() => {
    const d = new Date();
    if (range === 'week') d.setDate(d.getDate() - 6);
    else if (range === 'month') d.setDate(1);
    else { d.setMonth(0); d.setDate(1); }
    return toDay(d);
  }, [range]);

  const inRange = txs.filter(t => t.occurred_on >= fromDay);
  const { income, expense } = cashflow(inRange);
  const balances = accountBalances(txs);
  const monthStart = toDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthSpend = txs.filter(t => t.kind === 'expense' && t.occurred_on >= monthStart).reduce((s, t) => s + t.amount, 0);
  const budgetPct = budget > 0 ? Math.min(100, (monthSpend / budget) * 100) : 0;

  const pieData = EXPENSE_CATEGORIES.map(c => ({
    name: c.name, color: c.color,
    value: inRange.filter(t => t.kind === 'expense' && t.category === c.name).reduce((s, t) => s + t.amount, 0),
  })).filter(d => d.value > 0);

  const trend = useMemo(() => {
    const map = new Map<string, { label: string; income: number; expense: number }>();
    inRange.filter(t => t.kind !== 'transfer').slice().reverse().forEach(t => {
      const key = range === 'year' ? t.occurred_on.slice(0, 7) : t.occurred_on;
      const row = map.get(key) ?? { label: range === 'year' ? key.slice(5) : key.slice(8), income: 0, expense: 0 };
      row[t.kind === 'income' ? 'income' : 'expense'] += t.amount;
      map.set(key, row);
    });
    return [...map.values()];
  }, [inRange, range]);

  const [chart, setChart] = useState<'flow' | 'balance' | 'compare'>('balance');
  const series = useMemo(() => {
    if (range === 'year') { let run = 0; return trend.map(r => ({ ...r, net: (run += r.income - r.expense) })); }
    return dailyCashSeries(inRange, fromDay, toDay(new Date()));
  }, [range, trend, inRange, fromDay]);
  const short = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)));

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text(`Niknote Money Report (${range})`, 14, 18);
    doc.setFontSize(11);
    doc.text(`Income: ${formatMoney(income, currency)}   Expense: ${formatMoney(expense, currency)}   Net: ${formatMoney(income - expense, currency)}`, 14, 28);
    let y = 40;
    pieData.forEach(p => { doc.text(`${p.name}: ${formatMoney(p.value, currency)}`, 14, y); y += 7; });
    y += 4; doc.text('Transactions', 14, y); y += 7;
    inRange.forEach(t => {
      if (y > 280) { doc.addPage(); y = 18; }
      doc.text(`${t.occurred_on}  ${t.kind === 'income' ? '+' : '-'}${formatMoney(t.amount, currency)}  ${t.category}  ${t.note}`.slice(0, 95), 14, y); y += 6;
    });
    doc.save(`niknote-money-${range}.pdf`);
    haptic('success');
  };

  const shares = splitBill(Number(split.total) || 0, Number(split.people) || 0);

  return (
    <TrackerShell title="Money Tracker" subtitle="Income, budgets & savings goals">
      {loadError && <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm flex items-center gap-3">Could not load your entries — totals below may be incomplete.<button className="ml-auto underline font-medium" onClick={() => setReload(n => n + 1)}>Retry</button></div>}
      <p className="text-xs text-muted-foreground">Niknote is a tracker, not a bank — your money stays in your real accounts. Transfers move money between your accounts and are not counted as income or spending.</p>
      <section className="rounded-3xl border border-border bg-card p-4 flex items-center gap-4 shadow-sm overflow-hidden">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">This month</p>
          <p className="text-xl font-bold leading-tight">{formatMoney(monthSpend, currency)} spent</p>
          <p className="text-xs text-muted-foreground mt-1">{budget > 0 ? (budget - monthSpend >= 0 ? `${formatMoney(budget - monthSpend, currency)} left in your budget` : `${formatMoney(monthSpend - budget, currency)} over budget`) : 'Set a monthly budget to see what’s left'}</p>
        </div>
        {budget > 0 && (
          <svg viewBox="0 0 44 44" className="w-14 h-14 -rotate-90 shrink-0" role="img" aria-label={`${Math.round(budgetPct)}% of budget used`}>
            <defs><linearGradient id="nn-ring-grad"><stop offset="0%" stopColor="hsl(var(--success))" /><stop offset="100%" stopColor={budgetPct >= 90 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} /></linearGradient></defs>
            <circle cx="22" cy="22" r="18" fill="none" strokeWidth="5" className="nn-ring-track" />
            <motion.circle cx="22" cy="22" r="18" fill="none" strokeWidth="5" strokeLinecap="round" className="nn-ring-fill" strokeDasharray={113.1} initial={{ strokeDashoffset: 113.1 }} animate={{ strokeDashoffset: 113.1 * (1 - budgetPct / 100) }} transition={{ duration: 1.1, ease: 'easeOut' }} />
          </svg>
        )}
        <MoneyArt />
      </section>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'Income', value: income, tone: 'text-success' },
          { label: 'Spent', value: expense, tone: 'text-accent-rose' },
          { label: 'Balance', value: income - expense, tone: 'text-foreground' },
        ].map((c, i) => (
          <motion.div key={c.label} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.08 }}
            whileHover={{ rotateX: 4, rotateY: -4, scale: 1.02 }} style={{ transformPerspective: 600 }}
            className="rounded-3xl border border-border bg-card p-3 sm:p-5 shadow-sm min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Coins className="w-4 h-4" style={{ color: c.tone.startsWith('text-success') ? 'hsl(var(--success))' : c.tone.startsWith('text-accent-rose') ? 'hsl(var(--accent-rose-hsl))' : undefined, opacity: 0.7 }} />
              {c.label}
            </div>
            <p className={`text-base sm:text-2xl font-bold mt-1 truncate ${c.tone}`}>{formatMoney(c.value, currency)}</p>
          </motion.div>
        ))}
      </div>

      {/* Dashboard: net cashflow, budget left, top categories, goals */}
      {(() => {
        const net = income - expense;
        const top = topCategories(inRange);
        const goalSaved = goals.reduce((s, g) => s + g.saved, 0), goalTarget = goals.reduce((s, g) => s + g.target, 0);
        const left = budget - monthSpend;
        return (
          <section aria-label="Money dashboard" className="rounded-3xl border border-border bg-card p-4 shadow-sm space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Net cashflow ({range})</p>
                <p className={`text-xl font-bold ${net < 0 ? 'text-destructive' : 'text-success'}`}>{net >= 0 ? '+' : '−'}{formatMoney(Math.abs(net), currency)}</p>
                <p className="text-[11px] text-muted-foreground">{net >= 0 ? 'You saved this much' : 'You spent more than you earned'}</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Budget left this month</p>
                <p className={`text-xl font-bold ${budget > 0 && left < 0 ? 'text-destructive' : ''}`}>{budget > 0 ? formatMoney(left, currency) : '—'}</p>
                <p className="text-[11px] text-muted-foreground">{budget > 0 ? `${Math.round(budgetPct)}% of budget used` : 'Set a monthly budget below'}</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Top spending categories</p>
              {top.length === 0 ? <p className="text-xs text-muted-foreground">No spending in this period yet.</p> : (
                <ul className="space-y-2">
                  {top.map(c => {
                    const meta = EXPENSE_CATEGORIES.find(e => e.name === c.category);
                    return (
                      <li key={c.category}>
                        <div className="flex items-center justify-between text-sm"><span>{meta?.emoji} {c.category}</span><span className="font-medium">{formatMoney(c.amount, currency)} · {c.pct}%</span></div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden mt-1"><motion.div initial={{ width: 0 }} animate={{ width: `${c.pct}%` }} className="h-full rounded-full" style={{ background: meta?.color ?? 'hsl(var(--primary))' }} /></div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {goals.length > 0 && <p className="text-xs text-muted-foreground">Savings goals: {formatMoney(goalSaved, currency)} of {formatMoney(goalTarget, currency)} saved across {goals.length} goal{goals.length > 1 ? 's' : ''}.</p>}
          </section>
        );
      })()}

      <div className="flex flex-wrap items-center gap-2">
        {(['week', 'month', 'year'] as Range[]).map(r => (
          <button key={r} onClick={() => { setRange(r); haptic('selection'); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition active:scale-95 ${range === r ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{r}</button>
        ))}
        <select value={currency} onChange={e => { setCurrency(e.target.value); saveSettings({ currency: e.target.value }); }}
          className="ml-auto h-9 rounded-xl border border-border bg-background px-2 text-sm" aria-label="Currency">
          {CURRENCIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <button onClick={exportPdf} className="h-9 px-3 rounded-xl bg-muted text-sm font-medium flex items-center gap-1.5 active:scale-95"><Download className="w-4 h-4" />PDF</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 [&>*]:min-w-0">
        <Panel id="panel-tx" title="Add transaction">
          <div className="flex gap-2 mb-3">
            {['expense', 'income', 'transfer'].map(k => (
              <button key={k} onClick={() => setForm(f => ({ ...f, kind: k }))}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize active:scale-95 transition ${form.kind === k ? (k === 'income' ? 'bg-success/15 text-success' : 'bg-primary/15 text-accent-rose') : 'bg-muted text-muted-foreground'}`}>{k}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input ref={amountRef} inputMode="decimal" placeholder="Amount" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm" />
            <input type="date" value={form.occurred_on} onChange={e => setForm(f => ({ ...f, occurred_on: e.target.value }))}
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm" />
            <input placeholder="Note (optional)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="col-span-2 h-11 rounded-xl border border-border bg-background px-3 text-sm" />
            <select aria-label={form.kind === 'transfer' ? 'From account' : 'Account'} value={form.account} onChange={e => setForm(f => ({ ...f, account: e.target.value }))} className={`h-11 rounded-xl border border-border bg-background px-3 text-sm ${form.kind === 'transfer' ? '' : 'col-span-2'}`}>
              {ACCOUNTS.map(a => <option key={a} value={a}>{form.kind === 'transfer' ? `From ${a}` : a}</option>)}
            </select>
            {form.kind === 'transfer' && <select aria-label="To account" value={form.to_account} onChange={e => setForm(f => ({ ...f, to_account: e.target.value }))} className="h-11 rounded-xl border border-border bg-background px-3 text-sm">
              {ACCOUNTS.map(a => <option key={a} value={a}>To {a}</option>)}
            </select>}
          </div>
          {form.kind === 'expense' && (
            <div className="grid grid-cols-4 gap-2 mt-3">
              {EXPENSE_CATEGORIES.map(c => (
                <button key={c.name} onClick={() => { setForm(f => ({ ...f, category: c.name })); haptic('selection'); }}
                  style={{ borderColor: form.category === c.name ? c.color : undefined }}
                  className={`py-2 rounded-xl border-2 text-[11px] font-medium flex flex-col items-center active:scale-95 transition ${form.category === c.name ? 'bg-muted' : 'border-transparent bg-muted/40'}`}>
                  <span className="text-lg">{c.emoji}</span>{c.name}
                </button>
              ))}
            </div>
          )}
          <motion.button whileTap={{ scale: 0.94 }} onClick={addTx}
            className="mt-4 w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"><Plus className="w-4 h-4" />Add</motion.button>
          <label className={`mt-2 w-full h-11 rounded-xl border-2 border-dashed border-primary/40 text-accent-rose font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition ${scanning ? 'opacity-60 pointer-events-none' : ''}`}>
            {scanning ? <><Loader2 className="w-4 h-4 animate-spin" />Reading receipt…</> : <><Camera className="w-4 h-4" />Scan receipt photo</>}
            <input ref={scanRef} type="file" accept="image/png,image/jpeg,image/webp" capture="environment" className="hidden" onChange={e => { scanReceipt(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </Panel>

        <Panel id="panel-accounts" title="Account balances">
          <p className="text-xs text-muted-foreground mb-3">From all your saved entries (income − spending ± transfers).</p>
          <div className="grid grid-cols-2 gap-2">
            {ACCOUNTS.map(a => <div key={a} className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{a}</p><p className={`font-semibold ${(balances[a] ?? 0) < 0 ? 'text-destructive' : ''}`}>{formatMoney(balances[a] ?? 0, currency)}</p></div>)}
          </div>
        </Panel>

        <Panel id="panel-budget" title="Monthly budget">
          <div className="flex gap-2">
            <input inputMode="decimal" value={budget || ''} placeholder="Set budget" onChange={e => setBudget(Number(e.target.value) || 0)}
              onBlur={() => saveSettings({ monthly_budget: budget })} className="flex-1 min-w-0 h-11 rounded-xl border border-border bg-background px-3 text-sm" />
          </div>
          <NKProgressBar
            className="mt-4"
            value={Math.min(100, budgetPct)}
            tone={budgetPct > 90 ? 'primary' : budgetPct > 70 ? 'amber' : 'success'}
            size="lg"
            aria-label="Monthly budget used"
          />
          <p className="text-sm text-muted-foreground mt-2">
            {budget > 0 ? `${formatMoney(monthSpend, currency)} of ${formatMoney(budget, currency)} spent this month` : 'Set a budget to track this month’s spending'}
          </p>
          <div className="h-48 mt-4">
            {pieData.length ? (
              <ResponsiveContainer>
                <PieChart><Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {pieData.map(p => <Cell key={p.name} fill={p.color} />)}</Pie>
                  <Tooltip formatter={(v: number) => formatMoney(v, currency)} /></PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center pt-16">No spending yet in this period</p>}
          </div>
        </Panel>
      </div>

      <Panel id="panel-graphs" title="Graphs" action={<div className="nn-chart-tabs" role="group" aria-label="Choose graph">{([['flow', 'Flow'], ['balance', 'Balance'], ['compare', 'Compare']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={chart === k} onClick={() => { haptic('selection'); setChart(k); }}>{l}</button>)}</div>}>
        {series.every(r => !r.income && !r.expense) ? <p className="text-sm text-muted-foreground py-10 text-center flex items-center justify-center gap-1.5">Add a transaction to see your graph grow <Sparkles className="w-4 h-4 text-accent-rose shrink-0" aria-hidden="true" /></p> : (
        <motion.div key={chart + range} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="h-60">
          <ResponsiveContainer>
            {chart === 'compare' ? (
              <BarChart data={series} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="nn-inc-bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--success))" /><stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.45} /></linearGradient>
                  <linearGradient id="nn-exp-bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--heart))" /><stop offset="100%" stopColor="hsl(var(--heart))" stopOpacity={0.45} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} /><YAxis fontSize={11} tickFormatter={short} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted) / .5)' }} formatter={(v: number, n: string) => [formatMoney(v, currency), n === 'income' ? 'Income' : 'Spent']} />
                <Bar dataKey="income" fill="url(#nn-inc-bar)" radius={[8, 8, 2, 2]} animationDuration={900} /><Bar dataKey="expense" fill="url(#nn-exp-bar)" radius={[8, 8, 2, 2]} animationDuration={900} />
              </BarChart>
            ) : chart === 'balance' ? (
              <AreaChart data={series} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                <defs><linearGradient id="nn-net-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.03} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} /><YAxis fontSize={11} tickFormatter={short} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => [formatMoney(v, currency), 'Running balance']} />
                <Area type="monotone" dataKey="net" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#nn-net-area)" animationDuration={1100} />
              </AreaChart>
            ) : (
              <AreaChart data={series} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="nn-inc-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.45} /><stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.02} /></linearGradient>
                  <linearGradient id="nn-exp-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--heart))" stopOpacity={0.45} /><stop offset="100%" stopColor="hsl(var(--heart))" stopOpacity={0.02} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} /><YAxis fontSize={11} tickFormatter={short} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number, n: string) => [formatMoney(v, currency), n === 'income' ? 'Income' : 'Spent']} />
                <Area type="monotone" dataKey="income" stroke="hsl(var(--success))" strokeWidth={2.5} fill="url(#nn-inc-area)" animationDuration={1000} />
                <Area type="monotone" dataKey="expense" stroke="hsl(var(--heart))" strokeWidth={2.5} fill="url(#nn-exp-area)" animationDuration={1200} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </motion.div>)}
        <div className="flex gap-4 text-xs text-muted-foreground mt-2">{chart === 'balance' ? <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-primary" />Balance</span> : <><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: 'hsl(var(--success))' }} />Income</span><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: 'hsl(var(--heart))' }} />Spent</span></>}</div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 [&>*]:min-w-0">
        <Panel id="panel-goals" title="Savings goals" action={<Target className="w-4 h-4 text-muted-foreground" />}>
          <div className="flex gap-2 mb-4">
            <input placeholder="Goal (e.g. New phone)" value={goalForm.name} onChange={e => setGoalForm(g => ({ ...g, name: e.target.value }))} className="flex-1 min-w-0 h-10 rounded-xl border border-border bg-background px-3 text-sm" />
            <input inputMode="decimal" placeholder="Target" value={goalForm.target} onChange={e => setGoalForm(g => ({ ...g, target: e.target.value }))} className="w-20 shrink-0 h-10 rounded-xl border border-border bg-background px-3 text-sm" />
            <button onClick={addGoal} className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-90" aria-label="Add goal"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="space-y-4">
            {goals.map(g => {
              const pct = Math.min(100, (g.saved / g.target) * 100);
              return (
                <div key={g.id}>
                  <div className="flex justify-between text-sm"><span className="font-medium">{g.name}{pct >= 100 && ' 🎉'}</span>
                    <span className="text-muted-foreground">{formatMoney(g.saved, currency)} / {formatMoney(g.target, currency)}</span></div>
                  <div className="h-3 rounded-full bg-muted mt-1.5 overflow-hidden">
                    <motion.div animate={{ width: `${pct}%` }} className="h-full bg-gradient-to-r from-primary to-nk-rose rounded-full" />
                  </div>
                  <div className="flex gap-2 mt-2">
                    {[100, 500, 1000].map(a => <button key={a} onClick={() => addToGoal(g, a)} className="px-2.5 py-1 rounded-lg bg-muted text-xs font-medium active:scale-90">+{a}</button>)}
                    <button onClick={() => delGoal(g.id)} className="ml-auto p-1 text-muted-foreground" aria-label="Delete goal"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              );
            })}
            {!goals.length && <p className="text-sm text-muted-foreground">No goals yet — add one above.</p>}
          </div>
        </Panel>

        <Panel title="Split a bill" action={<Users className="w-4 h-4 text-muted-foreground" />}>
          <div className="flex gap-2">
            <input inputMode="decimal" placeholder="Total" value={split.total} onChange={e => setSplit(s => ({ ...s, total: e.target.value }))} className="flex-1 min-w-0 h-10 rounded-xl border border-border bg-background px-3 text-sm" />
            <input inputMode="numeric" placeholder="People" value={split.people} onChange={e => setSplit(s => ({ ...s, people: e.target.value }))} className="w-20 shrink-0 h-10 rounded-xl border border-border bg-background px-3 text-sm" />
          </div>
          {shares.length > 0 && Number(split.total) > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {shares.map((s, i) => <span key={i} className="px-3 py-1.5 rounded-xl bg-muted text-sm">Person {i + 1}: <b>{formatMoney(s, currency)}</b></span>)}
            </div>
          )}
        </Panel>
      </div>

      <Panel id="panel-bills" title="Bill reminders" action={<Bell className="w-4 h-4 text-muted-foreground" />}>
        <div className="flex gap-2 mb-4">
          <input placeholder="Bill (e.g. Electricity)" value={billForm.name} onChange={e => setBillForm(f => ({ ...f, name: e.target.value }))} className="flex-1 min-w-0 h-10 rounded-xl border border-border bg-background px-3 text-sm" />
          <input inputMode="decimal" placeholder="Amount" value={billForm.amount} onChange={e => setBillForm(f => ({ ...f, amount: e.target.value }))} className="w-20 h-10 rounded-xl border border-border bg-background px-2 text-sm" />
          <input inputMode="numeric" placeholder="Day" value={billForm.due_day} onChange={e => setBillForm(f => ({ ...f, due_day: e.target.value }))} className="w-14 h-10 rounded-xl border border-border bg-background px-2 text-sm" aria-label="Due day of month" />
          <button onClick={addBill} className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-90" aria-label="Add bill"><Plus className="w-4 h-4" /></button>
        </div>
        <div className="space-y-2">
          {bills.map(b => {
            const st = billStatus(b);
            const tone = st === 'paid' ? 'text-success' : st === 'overdue' ? 'text-accent-rose' : st === 'soon' ? 'text-accent-warm' : 'text-muted-foreground';
            const label = st === 'paid' ? 'Paid this month' : st === 'overdue' ? 'Overdue' : st === 'soon' ? 'Due soon' : `Due on ${b.due_day}`;
            return (
              <motion.div key={b.id} layout className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40">
                <span className="text-xl">🧾</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{b.name}{b.amount > 0 && ` · ${formatMoney(b.amount, currency)}`}</p>
                  <p className={`text-xs font-medium ${tone}`}>{label}</p>
                </div>
                {st !== 'paid' && <button onClick={() => payBill(b)} className="px-3 py-1.5 rounded-lg bg-success/15 text-success text-xs font-semibold flex items-center gap-1 active:scale-90"><CheckCircle2 className="w-3.5 h-3.5" />Paid</button>}
                <button onClick={() => delBill(b.id)} className="p-1 text-muted-foreground" aria-label="Delete bill"><Trash2 className="w-4 h-4" /></button>
              </motion.div>
            );
          })}
          {!bills.length && <p className="text-sm text-muted-foreground">Add monthly bills — you’ll get a reminder 3 days before they’re due.</p>}
        </div>
      </Panel>

      <Panel title="Recent transactions">
        <div className="mb-3 flex items-center gap-2">
          <p className="text-xs text-muted-foreground">Swipe left on a row to delete</p>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search note or category…"
            aria-label="Search transactions"
            className="ml-auto h-9 w-44 rounded-xl border border-border bg-background px-3 text-xs"
          />
        </div>
        <div className="space-y-2 overflow-hidden">
          <AnimatePresence initial={false}>
            {inRange.filter(t => !search.trim() || `${t.note} ${t.category}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 50).map(t => {
              const c = catOf(t.category);
              return (
                <motion.div key={t.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -200 }}
                  drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.6}
                  onDragEnd={(_, info: PanInfo) => { if (info.offset.x < -100) delTx(t.id); }}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border-l-4 touch-pan-y" style={{ borderLeftColor: t.kind === 'income' ? 'hsl(150 60% 45%)' : c.color }}>
                  <span className="text-xl">{t.kind === 'income' ? '💰' : c.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.note || t.category}</p>
                    <p className="text-xs text-muted-foreground">{t.kind === 'transfer' ? `${t.account} → ${t.to_account}` : `${t.category} · ${t.account || 'Cash'}`} · {t.occurred_on}</p>
                  </div>
                  <span className={`font-semibold text-sm ${t.kind === 'income' ? 'text-success' : t.kind === 'transfer' ? 'text-muted-foreground' : 'text-accent-rose'}`}>{t.kind === 'income' ? '+' : t.kind === 'transfer' ? '⇄ ' : '−'}{formatMoney(t.amount, currency)}</span>
                  <button onClick={() => editTx(t)} className="h-9 px-2 text-xs font-medium text-accent-rose" aria-label="Edit entry">Edit</button><button onClick={() => delTx(t.id)} className="h-9 w-9 grid place-items-center text-muted-foreground" aria-label="Delete entry"><Trash2 className="w-4 h-4" /></button>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {inRange.filter(t => !search.trim() || `${t.note} ${t.category}`.toLowerCase().includes(search.trim().toLowerCase())).length === 0 && (
            <p className="text-sm text-muted-foreground">{search ? `No entries match “${search}”.` : 'Nothing here yet.'}</p>
          )}
        </div>
      </Panel>

      {/* Semi-circular quick dial — same rotating nav language as the Daily Tracker */}
      <div className="fixed z-40 bottom-24 right-3 md:bottom-8 md:right-8" data-testid="money-dial">
        <SemiCircularDial
          menuLabel="Money quick actions"
          centerLabel="Open money quick actions"
          align="right"
          items={[
            { id: 'expense', label: 'Add expense', icon: TrendingDown, tint: '#A34054', onSelect: () => { setForm(f => ({ ...f, kind: 'expense' })); focusPanel('panel-tx', amountRef); } },
            { id: 'income', label: 'Add income', icon: TrendingUp, tint: 'hsl(var(--success))', onSelect: () => { setForm(f => ({ ...f, kind: 'income' })); focusPanel('panel-tx', amountRef); } },
            { id: 'receipt', label: 'Scan receipt', icon: Camera, tint: '#7C5F9E', onSelect: () => scanRef.current?.click() },
            { id: 'budget', label: 'Budget', icon: PiggyBank, tint: '#7C5F9E', onSelect: () => focusPanel('panel-budget') },
            { id: 'goals', label: 'Goals', icon: Target, tint: '#C4762F', onSelect: () => focusPanel('panel-goals') },
            { id: 'bills', label: 'Bills', icon: ReceiptText, tint: '#64748b', onSelect: () => focusPanel('panel-bills') },
            { id: 'report', label: 'PDF report', icon: FileDown, tint: '#334155', onSelect: exportPdf },
          ]}
        />
      </div>
    </TrackerShell>
  );
}
