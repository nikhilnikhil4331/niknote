import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, Flame, Plus } from 'lucide-react';
import { useRoutine } from '@/components/habits/RoutineProvider';
import { CountUp, TopBar } from '@/components/habits/ui';
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
