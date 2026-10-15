import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import confetti from 'canvas-confetti';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line } from 'recharts';
import { Plus, Trash2, Target, Users, Download, Coins, Camera, Loader2, Bell, CheckCircle2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { haptic } from '@/hooks/useHaptics';
import { toast } from 'sonner';
import { TrackerShell, Panel } from '@/components/trackers/TrackerShell';
import { EXPENSE_CATEGORIES, CURRENCIES, formatMoney, toDay, splitBill, billStatus } from '@/lib/trackers';

type Tx = { id: string; kind: string; amount: number; category: string; note: string; occurred_on: string };
type Goal = { id: string; name: string; target: number; saved: number };
type Range = 'week' | 'month' | 'year';
type Bill = { id: string; name: string; amount: number; due_day: number; last_paid_month: string | null };

const catOf = (n: string) => EXPENSE_CATEGORIES.find(c => c.name === n) ?? EXPENSE_CATEGORIES[7];
const db = supabase as any;

export default function MoneyTracker() {
  const { user } = useAuth();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [currency, setCurrency] = useState('INR');
  const [budget, setBudget] = useState(0);
  const [range, setRange] = useState<Range>('month');
  const [form, setForm] = useState({ kind: 'expense', amount: '', category: 'Food', note: '', occurred_on: toDay(new Date()) });
  const [goalForm, setGoalForm] = useState({ name: '', target: '' });
  const [split, setSplit] = useState({ total: '', people: '2' });
  const [scanning, setScanning] = useState(false);
  const [bills, setBills] = useState<Bill[]>([]);
  const [billForm, setBillForm] = useState({ name: '', amount: '', due_day: '' });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [t, g, s, b] = await Promise.all([
        db.from('money_transactions').select('*').order('occurred_on', { ascending: false }).limit(1000),
        db.from('money_goals').select('*').order('created_at'),
        db.from('tracker_settings').select('*').maybeSingle(),
        db.from('bill_reminders').select('*').order('due_day'),
      ]);
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
    })();
  }, [user]);

  const saveSettings = async (patch: { currency?: string; monthly_budget?: number }) => {
    await db.from('tracker_settings').upsert({ user_id: user!.id, currency, monthly_budget: budget, ...patch, updated_at: new Date().toISOString() });
  };

  const addTx = async () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { haptic('error'); return toast.error('Enter a valid amount'); }
    const { data, error } = await db.from('money_transactions').insert({ ...form, amount, category: form.kind === 'income' ? 'Income' : form.category }).select().single();
    if (error) { haptic('error'); return toast.error(error.message); }
    haptic('medium');
    setTxs(p => [{ ...data, amount: Number(data.amount) }, ...p]);
    setForm(f => ({ ...f, amount: '', note: '' }));
  };

  const delTx = async (id: string) => {
    haptic('heavy');
    setTxs(p => p.filter(t => t.id !== id));
    await db.from('money_transactions').delete().eq('id', id);
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
    await db.from('bill_reminders').update({ last_paid_month: month }).eq('id', b.id);
    if (b.amount > 0) {
      const { data } = await db.from('money_transactions').insert({ kind: 'expense', amount: b.amount, category: 'Bills', note: b.name }).select().single();
      if (data) setTxs(p => [{ ...data, amount: Number(data.amount) }, ...p]);
    }
    haptic('success'); toast.success(`${b.name} marked paid`);
  };
  const delBill = async (id: string) => { haptic('heavy'); setBills(p => p.filter(b => b.id !== id)); await db.from('bill_reminders').delete().eq('id', id); };

  const addGoal = async () => {
    const target = Number(goalForm.target);
    if (!goalForm.name.trim() || !target) return toast.error('Add a name and target');
    const { data, error } = await db.from('money_goals').insert({ name: goalForm.name.trim(), target }).select().single();
    if (error) return toast.error(error.message);
    haptic('light');
    setGoals(p => [...p, { ...data, target: Number(data.target), saved: 0 }]);
    setGoalForm({ name: '', target: '' });
  };

  const addToGoal = async (g: Goal, amt: number) => {
    const saved = Math.max(0, g.saved + amt);
    setGoals(p => p.map(x => x.id === g.id ? { ...x, saved } : x));
    await db.from('money_goals').update({ saved }).eq('id', g.id);
    if (g.saved < g.target && saved >= g.target) {
      haptic('success');
      confetti({ particleCount: 160, spread: 90, origin: { y: 0.6 } });
      toast.success(`Goal reached: ${g.name} 🎉`);
    } else haptic('light');
  };

  const delGoal = async (id: string) => {
    haptic('heavy');
    setGoals(p => p.filter(g => g.id !== id));
    await db.from('money_goals').delete().eq('id', id);
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
  const income = inRange.filter(t => t.kind === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = inRange.filter(t => t.kind === 'expense').reduce((s, t) => s + t.amount, 0);
  const monthStart = toDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthSpend = txs.filter(t => t.kind === 'expense' && t.occurred_on >= monthStart).reduce((s, t) => s + t.amount, 0);
  const budgetPct = budget > 0 ? Math.min(100, (monthSpend / budget) * 100) : 0;

  const pieData = EXPENSE_CATEGORIES.map(c => ({
    name: c.name, color: c.color,
    value: inRange.filter(t => t.kind === 'expense' && t.category === c.name).reduce((s, t) => s + t.amount, 0),
  })).filter(d => d.value > 0);

  const trend = useMemo(() => {
    const map = new Map<string, { label: string; income: number; expense: number }>();
    inRange.slice().reverse().forEach(t => {
      const key = range === 'year' ? t.occurred_on.slice(0, 7) : t.occurred_on;
      const row = map.get(key) ?? { label: range === 'year' ? key.slice(5) : key.slice(8), income: 0, expense: 0 };
      row[t.kind === 'income' ? 'income' : 'expense'] += t.amount;
      map.set(key, row);
    });
    return [...map.values()];
  }, [inRange, range]);

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
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Income', value: income, tone: 'text-emerald-600' },
          { label: 'Spent', value: expense, tone: 'text-rose-600' },
          { label: 'Balance', value: income - expense, tone: 'text-foreground' },
        ].map((c, i) => (
          <motion.div key={c.label} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.08 }}
            whileHover={{ rotateX: 4, rotateY: -4, scale: 1.02 }} style={{ transformPerspective: 600 }}
            className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <motion.span animate={{ rotateY: 360 }} transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}><Coins className="w-4 h-4 text-amber-500" /></motion.span>
              {c.label}
            </div>
            <p className={`text-2xl font-bold mt-1 ${c.tone}`}>{formatMoney(c.value, currency)}</p>
          </motion.div>
        ))}
      </div>

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
        <Panel title="Add transaction">
          <div className="flex gap-2 mb-3">
            {['expense', 'income'].map(k => (
              <button key={k} onClick={() => setForm(f => ({ ...f, kind: k }))}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize active:scale-95 transition ${form.kind === k ? (k === 'income' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-rose-500/15 text-rose-700') : 'bg-muted text-muted-foreground'}`}>{k}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input inputMode="decimal" placeholder="Amount" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm" />
            <input type="date" value={form.occurred_on} onChange={e => setForm(f => ({ ...f, occurred_on: e.target.value }))}
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm" />
            <input placeholder="Note (optional)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="col-span-2 h-11 rounded-xl border border-border bg-background px-3 text-sm" />
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
          <label className={`mt-2 w-full h-11 rounded-xl border-2 border-dashed border-primary/40 text-primary font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition ${scanning ? 'opacity-60 pointer-events-none' : ''}`}>
            {scanning ? <><Loader2 className="w-4 h-4 animate-spin" />Reading receipt…</> : <><Camera className="w-4 h-4" />Scan receipt photo</>}
            <input type="file" accept="image/png,image/jpeg,image/webp" capture="environment" className="hidden" onChange={e => { scanReceipt(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </Panel>

        <Panel title="Monthly budget">
          <div className="flex gap-2">
            <input inputMode="decimal" value={budget || ''} placeholder="Set budget" onChange={e => setBudget(Number(e.target.value) || 0)}
              onBlur={() => saveSettings({ monthly_budget: budget })} className="flex-1 min-w-0 h-11 rounded-xl border border-border bg-background px-3 text-sm" />
          </div>
          <div className="mt-4 h-4 rounded-full bg-muted overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${budgetPct}%` }} transition={{ type: 'spring', stiffness: 60 }}
              className={`h-full rounded-full ${budgetPct > 90 ? 'bg-rose-500' : budgetPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          </div>
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

      <Panel title="Trends">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 [&>*]:min-w-0 h-56">
          <ResponsiveContainer><BarChart data={trend}><XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} width={40} /><Tooltip />
            <Bar dataKey="income" fill="hsl(150 60% 45%)" radius={[6, 6, 0, 0]} /><Bar dataKey="expense" fill="hsl(350 75% 58%)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
          <ResponsiveContainer><LineChart data={trend}><XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} width={40} /><Tooltip />
            <Line dataKey="expense" stroke="hsl(350 75% 58%)" strokeWidth={2} dot={false} /><Line dataKey="income" stroke="hsl(150 60% 45%)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 [&>*]:min-w-0">
        <Panel title="Savings goals" action={<Target className="w-4 h-4 text-muted-foreground" />}>
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
                    <motion.div animate={{ width: `${pct}%` }} className="h-full bg-gradient-to-r from-primary to-accent rounded-full" />
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

      <Panel title="Bill reminders" action={<Bell className="w-4 h-4 text-muted-foreground" />}>
        <div className="flex gap-2 mb-4">
          <input placeholder="Bill (e.g. Electricity)" value={billForm.name} onChange={e => setBillForm(f => ({ ...f, name: e.target.value }))} className="flex-1 min-w-0 h-10 rounded-xl border border-border bg-background px-3 text-sm" />
          <input inputMode="decimal" placeholder="Amount" value={billForm.amount} onChange={e => setBillForm(f => ({ ...f, amount: e.target.value }))} className="w-20 h-10 rounded-xl border border-border bg-background px-2 text-sm" />
          <input inputMode="numeric" placeholder="Day" value={billForm.due_day} onChange={e => setBillForm(f => ({ ...f, due_day: e.target.value }))} className="w-14 h-10 rounded-xl border border-border bg-background px-2 text-sm" aria-label="Due day of month" />
          <button onClick={addBill} className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-90" aria-label="Add bill"><Plus className="w-4 h-4" /></button>
        </div>
        <div className="space-y-2">
          {bills.map(b => {
            const st = billStatus(b);
            const tone = st === 'paid' ? 'text-emerald-600' : st === 'overdue' ? 'text-rose-600' : st === 'soon' ? 'text-amber-600' : 'text-muted-foreground';
            const label = st === 'paid' ? 'Paid this month' : st === 'overdue' ? 'Overdue' : st === 'soon' ? 'Due soon' : `Due on ${b.due_day}`;
            return (
              <motion.div key={b.id} layout className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40">
                <span className="text-xl">🧾</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{b.name}{b.amount > 0 && ` · ${formatMoney(b.amount, currency)}`}</p>
                  <p className={`text-xs font-medium ${tone}`}>{label}</p>
                </div>
                {st !== 'paid' && <button onClick={() => payBill(b)} className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-700 text-xs font-semibold flex items-center gap-1 active:scale-90"><CheckCircle2 className="w-3.5 h-3.5" />Paid</button>}
                <button onClick={() => delBill(b.id)} className="p-1 text-muted-foreground" aria-label="Delete bill"><Trash2 className="w-4 h-4" /></button>
              </motion.div>
            );
          })}
          {!bills.length && <p className="text-sm text-muted-foreground">Add monthly bills — you’ll get a reminder 3 days before they’re due.</p>}
        </div>
      </Panel>

      <Panel title="Recent transactions">
        <p className="text-xs text-muted-foreground mb-3">Swipe left on a row to delete</p>
        <div className="space-y-2 overflow-hidden">
          <AnimatePresence initial={false}>
            {inRange.slice(0, 50).map(t => {
              const c = catOf(t.category);
              return (
                <motion.div key={t.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -200 }}
                  drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.6}
                  onDragEnd={(_, info: PanInfo) => { if (info.offset.x < -100) delTx(t.id); }}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border-l-4 touch-pan-y" style={{ borderLeftColor: t.kind === 'income' ? 'hsl(150 60% 45%)' : c.color }}>
                  <span className="text-xl">{t.kind === 'income' ? '💰' : c.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.note || t.category}</p>
                    <p className="text-xs text-muted-foreground">{t.category} · {t.occurred_on}</p>
                  </div>
                  <span className={`font-semibold text-sm ${t.kind === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.kind === 'income' ? '+' : '−'}{formatMoney(t.amount, currency)}</span>
                  <button onClick={() => delTx(t.id)} className="hidden md:block p-1 text-muted-foreground" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {!inRange.length && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
        </div>
      </Panel>
    </TrackerShell>
  );
}
