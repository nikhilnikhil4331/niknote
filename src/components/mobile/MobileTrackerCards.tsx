import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, CalendarCheck, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatMoney, isScheduled, monthSummary, toDay } from '@/lib/trackers';
import { readState } from '@/lib/routineStore';
import { useHaptics } from '@/hooks/useHaptics';

function readLocalMoneySummary(now = new Date()): { money: ReturnType<typeof monthSummary>; currency: string } {
  try {
    const raw = localStorage.getItem('niknote.money.v1.local');
    if (!raw) return { money: monthSummary([], now), currency: 'INR' };
    const parsed = JSON.parse(raw);
    const rows: { kind: string; amount: number | string; occurred_on: string }[] =
      Array.isArray(parsed?.rows) ? parsed.rows : [];
    const currency = typeof parsed?.settings?.currency === 'string' ? parsed.settings.currency : 'INR';
    return { money: monthSummary(rows, now), currency };
  } catch {
    return { money: monthSummary([], now), currency: 'INR' };
  }
}

function useTrackerSummary(userId?: string) {
  return useQuery({
    queryKey: ['mobile-tracker-summary', userId || 'local-device'],
    staleTime: 10_000,
    queryFn: async () => {
      if (!userId) {
        return readLocalMoneySummary(new Date());
      }
      const now = new Date();
      const monthStart = toDay(new Date(now.getFullYear(), now.getMonth(), 1));
      const [tx, settings] = await Promise.all([
        supabase.from('money_transactions').select('kind,amount,occurred_on').gte('occurred_on', monthStart).limit(2000),
        supabase.from('tracker_settings').select('currency').maybeSingle(),
      ]);
      if (tx.error) return readLocalMoneySummary(now);
      return {
        money: monthSummary(tx.data ?? [], now),
        currency: settings.data?.currency ?? 'INR',
      };
    },
  });
}

/**
 * The Daily Tracker card opens the Niknote Habit app (`/habit`), which is
 * local-first. Read that same store so the card's numbers always match the
 * screen it opens — never a different (server) dataset.
 */
export function localHabitSummary(userId: string, now = new Date()) {
  const state = readState(userId);
  if (!state) return { habitsTotal: 0, habitsDone: 0 };
  const day = toDay(now);
  const scheduled = state.habits.filter(h => !h.archived && isScheduled(h.days, now));
  const done = scheduled.filter(h => (state.entries[`${h.id}|${day}`]?.v ?? 0) >= h.target).length;
  return { habitsTotal: scheduled.length, habitsDone: done };
}

export function MobileTrackerCards() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const { triggerHaptic } = useHaptics();
  const q = useTrackerSummary(user?.id);
  const d = q.data ?? (!user ? readLocalMoneySummary() : undefined);
  const habits = localHabitSummary(user?.id || 'anon');
  const pct = habits.habitsTotal ? Math.round((habits.habitsDone / habits.habitsTotal) * 100) : 0;

  const value = (ready: string, empty: string) =>
    q.isLoading && !d ? null : d ? ready || empty : empty;

  const cards = [
    {
      to: '/money', label: 'Money Tracker', icon: Wallet, tone: 'money',
      main: value(d && (d.money.spent || d.money.income) ? formatMoney(d.money.spent, d.currency) : '', 'Track expenses'),
      sub: d && (d.money.spent || d.money.income) ? (d.money.income ? `spent this month · ${formatMoney(d.money.balance, d.currency)} left` : 'spent this month') : 'Income, spends & budgets',
    },
    {
      to: '/habit', label: 'Daily Tracker', icon: CalendarCheck, tone: 'daily',
      main: habits.habitsTotal ? `${habits.habitsDone}/${habits.habitsTotal} done` : 'Start habits',
      sub: habits.habitsTotal ? `${pct}% of today's habits` : 'Habits, tasks & wellness',
    },
  ];

  return (
    <section className="nn-trackers" aria-label="Trackers">
      {cards.map(({ to, label, icon: Icon, tone, main, sub }) => (
        <motion.button key={to} type="button" whileTap={reduced ? undefined : { scale: 0.96 }}
          className={`nn-tracker nn-tracker-${tone}`} aria-label={`Open ${label}${main ? `: ${main}` : ''}`}
          onClick={() => { triggerHaptic('selection'); navigate(to); }}>
          <span className="nn-tracker-top"><span className="nn-tracker-icon"><Icon size={20} /></span><ArrowUpRight size={16} className="nn-tracker-arrow" aria-hidden="true" /></span>
          <strong className="nn-tracker-label">{label}</strong>
          {main === null ? <span className="nn-tracker-skel" aria-label="Loading" /> : <span className="nn-tracker-value">{main}</span>}
          <small className="nn-tracker-sub">{sub}</small>
          {tone === 'daily' && habits.habitsTotal > 0 && <span className="nn-tracker-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>}
        </motion.button>
      ))}
    </section>
  );
}
