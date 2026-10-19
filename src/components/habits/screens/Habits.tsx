import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, Flame, Plus } from 'lucide-react';
import { useRoutine } from '@/components/habits/RoutineProvider';
import { CountUp, Ring, TopBar } from '@/components/habits/ui';
import { HABIT_CATEGORIES, fmtHabitValue, habitStreak, isScheduled, toDay } from '@/lib/trackers';
import { haptic } from '@/hooks/useHaptics';

export function HabitsScreen({ go }: { go: (s: { name: string; id?: string }) => void }) {
  const { state, today, activeHabits, updateHabit } = useRoutine();
  const reduced = useReducedMotion();
  const [showArchived, setShowArchived] = useState(false);
  const now = new Date();
  const cat = (id: string) => HABIT_CATEGORIES.find(c => c.id === id);

  const rows = (archived: boolean) => state.habits.filter(h => h.archived === archived);
  const archived = rows(true);
  const scheduledToday = rows(false).filter(h => isScheduled(h.days, now));
  const completedToday = scheduledToday.filter(h => (state.entries[`${h.id}|${today}`]?.v ?? 0) >= h.target).length;
  const todayProgress = scheduledToday.length ? completedToday / scheduledToday.length : 0;

  const row = (h: (typeof state.habits)[number], i: number, isArchived: boolean) => {
    const v = state.entries[`${h.id}|${today}`]?.v ?? 0;
    const pct = Math.min(1, v / h.target);
    const streak = habitStreak(state.entries, h, now);
    const rest = !isScheduled(h.days, now);
    return (
      <motion.div key={h.id} layout initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : i * 0.05 }}
        className="nnh-card p-3 flex items-center gap-3">
        <motion.button whileTap={reduced ? undefined : { scale: 0.9 }} type="button" onClick={() => { haptic('selection'); go({ name: 'detail', id: h.id }); }}
          className="w-12 h-12 rounded-2xl grid place-items-center text-2xl shrink-0" style={{ background: `${h.color}22` }}
          aria-label={`Open ${h.name}`}>
          {h.icon}
        </motion.button>
        <button type="button" onClick={() => { haptic('selection'); go({ name: 'detail', id: h.id }); }} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1.5">
            <p className={`text-[14px] font-bold truncate ${h.archived ? 'opacity-50' : ''}`}>{h.name}</p>
            {streak > 0 && !h.archived && (
              <span className="flex items-center gap-0.5 text-[10px] font-extrabold text-orange-500">
                <Flame size={11} className="nnh-anim-flicker" /> {streak}
              </span>
            )}
          </div>
          <p className="text-[10px] font-semibold mt-0.5" style={{ color: 'var(--nnh-sub)' }}>
            {cat(h.category)?.icon} {cat(h.category)?.label}{rest ? ' · rest day' : ''} · {fmtHabitValue(v, h.type)} / {fmtHabitValue(h.target, h.type)}
          </p>
          <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: 'var(--nnh-line)' }}>
            <motion.div initial={false} animate={{ width: `${pct * 100}%` }} transition={{ type: 'spring', stiffness: 70, damping: 17 }}
              className="h-full rounded-full" style={{ background: h.color }} />
          </div>
        </button>
        <span className="text-lg font-extrabold w-11 text-right tabular-nums" style={{ color: pct >= 1 ? h.color : 'var(--nnh-sub)', fontFamily: "'Space Grotesk', sans-serif" }}>
          <CountUp value={Math.round(pct * 100)} />%
        </span>
        {isArchived ? (
          <button type="button" onClick={() => updateHabit(h.id, { archived: false })}
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-full" style={{ background: 'var(--nnh-card-soft)', color: 'var(--nnh-purple)' }}>
            Restore
          </button>
        ) : (
          <ChevronRight size={16} style={{ color: 'var(--nnh-sub)' }} />
        )}
      </motion.div>
    );
  };

  return (
    <div className="pb-32">
      <TopBar title="My Habits" icon={<span>✨</span>} sub={`${activeHabits.length} active · ${archived.length} archived`}
        right={
          <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={() => go({ name: 'add' })} aria-label="Add habit"
            className="w-10 h-10 rounded-full nnh-gradient-btn grid place-items-center text-white">
            <Plus size={19} strokeWidth={2.6} />
          </motion.button>
        } />
      <div className="px-4 pt-2 space-y-2.5">
        {!!scheduledToday.length && (
          <motion.section initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="nnh-card relative overflow-hidden p-4 flex items-center gap-4 border border-white/60"
            style={{ background: 'linear-gradient(130deg, var(--nnh-card) 35%, #8b5cf610 100%)' }}>
            <motion.div aria-hidden="true" className="absolute -right-8 -top-12 w-32 h-32 rounded-full pointer-events-none"
              animate={reduced ? undefined : { scale: [1, 1.12, 1], opacity: [0.25, 0.48, 0.25] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ background: 'radial-gradient(circle, #c4b5fd88, transparent 70%)' }} />
            <Ring size={68} stroke={6} pct={todayProgress} from="#8b5cf6" to="#ec4899">
              <span className="text-[13px] font-extrabold tabular-nums"><CountUp value={Math.round(todayProgress * 100)} />%</span>
            </Ring>
            <div className="relative min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] nnh-gradient-text">Your daily rhythm</p>
              <p className="text-[15px] font-extrabold mt-1 leading-tight">
                <CountUp value={completedToday} /> of {scheduledToday.length} done
                {completedToday === scheduledToday.length && <motion.span className="ml-1 inline-block" animate={reduced ? undefined : { rotate: [0, 12, -12, 0], scale: [1, 1.15, 1] }} transition={{ duration: 0.7 }}>✨</motion.span>}
              </p>
              <p className="text-[10px] font-medium mt-1" style={{ color: 'var(--nnh-sub)' }}>
                {completedToday === scheduledToday.length ? 'You showed up for yourself today.' : `${scheduledToday.length - completedToday} small ${scheduledToday.length - completedToday === 1 ? 'step' : 'steps'} left — keep your pace.`}
              </p>
            </div>
          </motion.section>
        )}
        {rows(false).map((h, i) => row(h, i, false))}
        {!rows(false).length && (
          <div className="nnh-card p-8 text-center">
            <p className="text-4xl mb-2">🌱</p>
            <p className="font-bold text-[15px]">No habits yet</p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--nnh-sub)' }}>Tap + to create your first habit</p>
          </div>
        )}
        {archived.length > 0 && (
          <button type="button" onClick={() => { haptic('selection'); setShowArchived(v => !v); }}
            className="w-full text-center text-[12px] font-bold py-2" style={{ color: 'var(--nnh-purple)' }}>
            {showArchived ? 'Hide archived' : `Show archived (${archived.length})`}
          </button>
        )}
        {showArchived && archived.map((h, i) => row(h, i, true))}
      </div>
    </div>
  );
}
