import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronRight, Flame, Plus, Sparkles } from 'lucide-react';
import { useRoutine } from '@/components/habits/RoutineProvider';
import { CountUp, TopBar } from '@/components/habits/ui';
import { HABIT_CATEGORIES, bestStreakHistory, fmtHabitValue, habitStreak, isScheduled, toDay, weekCompletion } from '@/lib/trackers';
import { habitSpring } from '@/lib/motion';
import { haptic } from '@/hooks/useHaptics';
import { readableInk } from '@/lib/readableInk';

export function HabitsScreen({ go }: { go: (s: { name: string; id?: string }) => void }) {
  const { state, today, activeHabits, updateHabit, toggleHabitDone } = useRoutine();
  const reduced = useReducedMotion();
  const [showArchived, setShowArchived] = useState(false);
  const now = new Date();
  const cat = (id: string) => HABIT_CATEGORIES.find(c => c.id === id);

  const archived = useMemo(() => state.habits.filter(h => h.archived), [state.habits]);
  const week = useMemo(() => weekCompletion(state.entries, activeHabits, now), [state.entries, activeHabits]);
  const best = useMemo(() => bestStreakHistory(state.entries, activeHabits, now), [state.entries, activeHabits]);

  const row = (h: (typeof state.habits)[number], i: number, isArchived: boolean) => {
    const v = state.entries[`${h.id}|${today}`]?.v ?? 0;
    const pct = Math.min(1, v / h.target);
    const done = v >= h.target;
    const streak = habitStreak(state.entries, h, now);
    const rest = !isScheduled(h.days, now);
    return (
      <motion.div key={h.id} layout
        initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduced ? 0 : Math.min(i, 6) * 0.04 }}
        className="nnh-card flex items-center gap-3 p-3">
        <motion.button whileTap={reduced ? undefined : { scale: 0.9 }} type="button"
          onClick={() => { haptic('selection'); go({ name: 'detail', id: h.id }); }}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl"
          style={{ background: `color-mix(in srgb, ${h.color} 16%, transparent)` }}
          aria-label={`Open ${h.name}`}>
          {h.icon}
        </motion.button>
        <button type="button" onClick={() => { haptic('selection'); go({ name: 'detail', id: h.id }); }} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1.5">
            <p className={`truncate text-[14px] font-extrabold ${isArchived ? 'opacity-50' : ''}`}>{h.name}</p>
            {streak > 0 && !isArchived && (
              <span className="flex items-center gap-0.5 text-[10px] font-extrabold" style={{ color: 'var(--nnh-orange)' }}>
                <Flame size={11} className="nnh-anim-flicker" /> {streak}
              </span>
            )}
            {rest && !isArchived && (
              <span className="rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase"
                style={{ background: 'var(--nnh-card-soft)', color: 'var(--nnh-sub)' }}>rest</span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
            {cat(h.category)?.icon} {cat(h.category)?.label} · {fmtHabitValue(v, h.type)} / {fmtHabitValue(h.target, h.type)}
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full nnh-track">
            <motion.div initial={false} animate={{ width: `${pct * 100}%` }} transition={reduced ? { duration: 0 } : habitSpring.soft}
              className="h-full rounded-full" style={{ background: h.color }} />
          </div>
        </button>
        {isArchived ? (
          <button type="button" onClick={() => { haptic('selection'); updateHabit(h.id, { archived: false }); }}
            className="rounded-full px-2.5 py-1.5 text-[11px] font-bold"
            style={{ background: 'var(--nnh-card-soft)', color: 'var(--nnh-violet)' }}>
            Restore
          </button>
        ) : (
          <>
            <span className="nnh-display w-10 text-right text-[15px] font-extrabold tabular-nums"
              style={{ color: pct >= 1 ? h.color : 'var(--nnh-sub)' }}>
              <CountUp value={Math.round(pct * 100)} />%
            </span>
            <motion.button whileTap={reduced ? undefined : { scale: 0.82 }} type="button"
              onClick={() => toggleHabitDone(h)}
              aria-label={done ? `Reopen ${h.name}` : `Complete ${h.name}`} aria-pressed={done}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2"
              style={{ borderColor: done ? h.color : 'var(--nnh-line-strong)', background: done ? h.color : 'transparent', color: done ? readableInk(h.color) : '#fff' }}>
              {done ? <Check size={15} strokeWidth={3.4} /> : <Plus size={14} style={{ color: 'var(--nnh-sub)' }} />}
            </motion.button>
          </>
        )}
      </motion.div>
    );
  };

  return (
    <div className="pb-2">
      <TopBar title="My Habits" icon={<Sparkles size={16} />} sub={`${activeHabits.length} active · ${archived.length} archived`}
        right={
          <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={() => go({ name: 'add' })} aria-label="Add habit"
            className="grid h-10 w-10 place-items-center rounded-full text-white nnh-gradient-btn">
            <Plus size={19} strokeWidth={2.6} />
          </motion.button>
        } />

      <div className="space-y-3 px-4 pt-1">
        {/* week summary */}
        <section className="nnh-card grid grid-cols-3 gap-2 p-3">
          <div className="rounded-2xl px-2 py-2.5 text-center" style={{ background: 'var(--nnh-card-soft)' }}>
            <p className="nnh-display text-[19px] font-extrabold" style={{ color: 'var(--nnh-violet)' }}><CountUp value={week.pct} />%</p>
            <p className="text-[9px] font-bold" style={{ color: 'var(--nnh-sub)' }}>This week</p>
          </div>
          <div className="rounded-2xl px-2 py-2.5 text-center" style={{ background: 'var(--nnh-card-soft)' }}>
            <p className="nnh-display text-[19px] font-extrabold" style={{ color: 'var(--nnh-orange)' }}><CountUp value={best} /></p>
            <p className="text-[9px] font-bold" style={{ color: 'var(--nnh-sub)' }}>Best streak</p>
          </div>
          <button type="button" onClick={() => go({ name: 'tab', id: 'insights' })}
            className="rounded-2xl px-2 py-2.5 text-center" style={{ background: 'var(--nnh-card-soft)' }}>
            <p className="nnh-display text-[19px] font-extrabold" style={{ color: 'var(--nnh-pink)' }}><CountUp value={week.done} /></p>
            <p className="text-[9px] font-bold" style={{ color: 'var(--nnh-sub)' }}>Done · 7 days</p>
          </button>
        </section>

        <div className="flex items-center justify-between px-0.5">
          <span className="nnh-label">All habits</span>
          <button type="button" onClick={() => go({ name: 'tab', id: 'insights' })}
            className="flex items-center gap-0.5 text-[11px] font-bold" style={{ color: 'var(--nnh-violet)' }}>
            See trends <ChevronRight size={12} />
          </button>
        </div>

        {activeHabits.map((h, i) => row(h, i, false))}

        {!activeHabits.length && (
          <div className="nnh-card px-5 py-8 text-center">
            <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-[1.4rem] text-3xl" style={{ background: 'var(--nnh-lavender)' }}>🌱</div>
            <p className="text-[15px] font-extrabold">No habits yet</p>
            <p className="mx-auto mt-1 max-w-[230px] text-[12px] leading-relaxed" style={{ color: 'var(--nnh-sub)' }}>
              Start with something you can do in two minutes. Consistency beats intensity.
            </p>
            <button type="button" onClick={() => go({ name: 'add' })}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[12px] font-extrabold text-white nnh-gradient-btn">
              <Plus size={14} /> Create your first habit
            </button>
          </div>
        )}

        <AnimatePresence initial={false}>
          {archived.length > 0 && (
            <motion.div layout className="space-y-2.5">
              <button type="button" onClick={() => { haptic('selection'); setShowArchived(v => !v); }}
                className="w-full py-2 text-center text-[12px] font-bold" style={{ color: 'var(--nnh-violet)' }}>
                {showArchived ? 'Hide archived' : `Show archived (${archived.length})`}
              </button>
              {showArchived && archived.map((h, i) => row(h, i, true))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
