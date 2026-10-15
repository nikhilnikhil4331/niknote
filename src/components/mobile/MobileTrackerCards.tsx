import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, CalendarCheck, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatMoney, monthSummary, toDay } from '@/lib/trackers';
import { useHaptics } from '@/hooks/useHaptics';

function useTrackerSummary(userId?: string) {
  return useQuery({
    queryKey: ['mobile-tracker-summary', userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const now = new Date();
      const monthStart = toDay(new Date(now.getFullYear(), now.getMonth(), 1));
      const today = toDay(now);
      const [tx, settings, habits, checks] = await Promise.all([
        supabase.from('money_transactions').select('kind,amount,occurred_on').gte('occurred_on', monthStart).limit(2000),
        supabase.from('tracker_settings').select('currency').maybeSingle(),
        supabase.from('habits').select('id'),
        supabase.from('habit_checks').select('habit_id').eq('day', today),
      ]);
      if (tx.error || habits.error || checks.error) throw new Error('load');
      return {
        money: monthSummary(tx.data ?? [], now),
        currency: settings.data?.currency ?? 'INR',
        habitsTotal: habits.data?.length ?? 0,
        habitsDone: new Set((checks.data ?? []).map((c: any) => c.habit_id)).size,
      };
    },
  });
}

export function MobileTrackerCards() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const { triggerHaptic } = useHaptics();
  const q = useTrackerSummary(user?.id);
  const d = q.data;
  const pct = d && d.habitsTotal ? Math.round((d.habitsDone / d.habitsTotal) * 100) : 0;

  const value = (ready: string, empty: string) =>
    !user ? 'Sign in to start' : q.isLoading ? null : q.isError ? 'Tap to open' : d ? ready || empty : empty;

  const cards = [
    {
      to: '/money', label: 'Money Tracker', icon: Wallet, tone: 'money',
      main: value(d && (d.money.spent || d.money.income) ? formatMoney(d.money.spent, d.currency) : '', 'No spends yet'),
      sub: d && (d.money.spent || d.money.income) ? (d.money.income ? `spent this month · ${formatMoney(d.money.balance, d.currency)} left` : 'spent this month') : 'Track income & expenses',
    },
    {
      to: '/routine', label: 'Daily Tracker', icon: CalendarCheck, tone: 'daily',
      main: value(d && d.habitsTotal ? `${d.habitsDone}/${d.habitsTotal} done` : '', 'Add a habit'),
      sub: d && d.habitsTotal ? `${pct}% of today's habits` : 'Habits, tasks & wellness',
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
          {tone === 'daily' && d && d.habitsTotal > 0 && <span className="nn-tracker-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>}
        </motion.button>
      ))}
    </section>
  );
}
