import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronRight, Lock, Sparkles } from 'lucide-react';
import { useRoutine } from '@/components/habits/RoutineProvider';
import { CountUp, TopBar } from '@/components/habits/ui';
import { ProgressBar } from '@/components/habits/charts';
import {
  ACHIEVEMENTS, bestStreakHistory, habitStreak, isScheduled, milestoneProgress, toDay, unlockedAchievements,
} from '@/lib/trackers';

export function StreaksScreen({ go }: { go: (s: { name: string; id?: string }) => void }) {
  const { state, activeHabits } = useRoutine();
  const reduced = useReducedMotion();
  const now = new Date();
  const today = toDay(now);

  const current = useMemo(() => Math.max(0, ...activeHabits.map(h => habitStreak(state.entries, h, now))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.entries, activeHabits]);
  const best = useMemo(() => bestStreakHistory(state.entries, activeHabits, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.entries, activeHabits]);
  const milestones = useMemo(() => milestoneProgress(best), [best]);

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    const day = toDay(d);
    const sched = activeHabits.filter(h => isScheduled(h.days, d));
    const done = sched.filter(h => (state.entries[`${h.id}|${day}`]?.v ?? 0) >= h.target).length;
    return {
      day,
      label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()],
      full: sched.length > 0 && done === sched.length,
      partial: done > 0 && done < sched.length,
      today: day === today,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state.entries, activeHabits, today]);

  const unlocked = useMemo(() => new Set(unlockedAchievements({
    habits: activeHabits.map(h => ({ id: h.id, name: h.name, type: h.type, target: h.target, days: h.days })),
    entries: state.entries,
    focus: state.focus,
    today,
  }).map(a => a.id)), [activeHabits, state.entries, state.focus, today]);

  return (
    <div className="pb-2">
      <TopBar title="Streaks & Achievements" icon={<span>🏅</span>} sub="Momentum is everything" />
      <div className="space-y-4 px-4">
        {/* streak hero */}
        <section className="nnh-card relative overflow-hidden p-5 text-center">
          <span className="pointer-events-none absolute inset-x-0 top-0 h-28" aria-hidden="true"
            style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(249,115,22,0.16), transparent 78%)' }} />
          <motion.span
            animate={reduced ? undefined : { y: [0, -6, 0], rotate: [-2, 2, -2] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="nnh-anim-flicker relative inline-block text-[52px] leading-none">🔥</motion.span>
          <h2 className="nnh-display relative mt-1 text-[26px] font-extrabold">
            <CountUp value={current} /> Day Streak
          </h2>
          <p className="relative mt-1 text-[12px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
            {current >= 7 ? 'You are on fire! 🚀' : current > 0 ? 'Keep the momentum going!' : 'Complete a habit to start one 🔥'}
          </p>
          <p className="relative mt-1 text-[10px] font-bold" style={{ color: 'var(--nnh-orange)' }}>
            Best ever: {best} day{best === 1 ? '' : 's'}
          </p>

          <div className="relative mt-4 flex justify-center gap-3" role="img" aria-label={`Last 7 days, ${week.filter(w => w.full).length} complete days`}>
            {week.map(w => (
              <div key={w.day} className="flex flex-col items-center gap-1">
                <span className="text-[9px] font-bold" style={{ color: w.today ? 'var(--nnh-violet)' : 'var(--nnh-sub)' }}>{w.label}</span>
                <motion.span initial={false} animate={w.full && !reduced ? { scale: [1, 1.12, 1] } : {}} transition={{ duration: 0.35 }}
                  className="grid h-8 w-8 place-items-center rounded-full border-2"
                  style={{
                    borderColor: w.full ? 'var(--nnh-orange)' : w.partial ? 'var(--nnh-pink)' : 'var(--nnh-line)',
                    background: w.full ? 'linear-gradient(135deg,#D9822F,#ED9E59)' : 'transparent',
                    color: w.full ? '#1B1931' : 'var(--nnh-ink)',
                  }}>
                  {w.full && <Check size={14} strokeWidth={3.4} />}
                </motion.span>
              </div>
            ))}
          </div>
        </section>

        {/* milestones */}
        <section className="nnh-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[14px] font-extrabold">Milestones</h3>
            <span className="text-[10px] font-bold" style={{ color: 'var(--nnh-sub)' }}>based on your best streak</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {milestones.map(m => (
              <div key={m.days} className="rounded-2xl p-2.5 text-center"
                style={{ background: m.reached ? 'color-mix(in srgb, var(--nnh-orange) 14%, var(--nnh-card))' : 'var(--nnh-card-soft)' }}>
                <p className="text-[18px] leading-none">{m.reached ? '🔥' : '🎯'}</p>
                <p className="mt-1 text-[13px] font-extrabold">{m.days} days</p>
                <p className="mb-1.5 text-[9px] font-bold" style={{ color: m.reached ? 'var(--nnh-orange)' : 'var(--nnh-sub)' }}>
                  {m.reached ? 'Reached' : `${Math.round(m.pct * 100)}%`}
                </p>
                <ProgressBar pct={m.pct * 100} color={m.reached ? 'var(--nnh-orange)' : 'var(--nnh-purple)'} height={4} />
              </div>
            ))}
          </div>
        </section>

        {/* per-habit streaks */}
        <section className="nnh-card p-4">
          <h3 className="mb-2.5 text-[14px] font-extrabold">Habit streaks</h3>
          <div className="space-y-2">
            {activeHabits.map(h => {
              const s = habitStreak(state.entries, h, now);
              return (
                <button key={h.id} type="button" onClick={() => go({ name: 'detail', id: h.id })}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left" style={{ background: 'var(--nnh-card-soft)' }}>
                  <span className="grid h-8 w-8 place-items-center rounded-lg text-base" style={{ background: `${h.color}22` }}>{h.icon}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-bold">{h.name}</span>
                  <span className="flex items-center gap-1 text-[11px] font-extrabold" style={{ color: s > 0 ? 'var(--nnh-orange)' : 'var(--nnh-sub)' }}>
                    🔥 {s}
                  </span>
                  <ChevronRight size={14} style={{ color: 'var(--nnh-sub)' }} />
                </button>
              );
            })}
            {!activeHabits.length && <p className="py-2 text-center text-[12px]" style={{ color: 'var(--nnh-sub)' }}>No habits yet</p>}
          </div>
        </section>

        {/* achievements */}
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-[15px] font-extrabold">Achievements</h3>
            <span className="text-[11px] font-bold" style={{ color: 'var(--nnh-sub)' }}>{unlocked.size}/{ACHIEVEMENTS.length} unlocked</span>
          </div>
          <div className="space-y-2.5">
            {ACHIEVEMENTS.map((a, i) => {
              const on = unlocked.has(a.id);
              return (
                <motion.div key={a.id}
                  initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduced ? 0 : Math.min(i, 6) * 0.04 }}
                  className="nnh-card relative flex items-center gap-3 overflow-hidden p-3">
                  {on && <span className="absolute inset-0" aria-hidden="true"
                    style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${a.color} 12%, transparent), transparent 58%)` }} />}
                  <motion.span whileHover={reduced ? undefined : { scale: 1.08, rotate: 5 }}
                    className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[22px]"
                    style={{ background: on ? `color-mix(in srgb, ${a.color} 18%, transparent)` : 'var(--nnh-card-soft)', filter: on ? undefined : 'grayscale(1)', opacity: on ? 1 : 0.55 }}>
                    {a.icon}
                    {!on && <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full text-white" style={{ background: 'var(--nnh-sub)' }}><Lock size={10} /></span>}
                  </motion.span>
                  <div className="relative min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">{a.name}</p>
                    <p className="truncate text-[11px] font-medium" style={{ color: 'var(--nnh-sub)' }}>{a.desc}</p>
                  </div>
                  <span className="relative rounded-full px-2 py-1 text-[9px] font-extrabold"
                    style={on ? { background: `color-mix(in srgb, ${a.color} 16%, transparent)`, color: a.color } : { background: 'var(--nnh-card-soft)', color: 'var(--nnh-sub)' }}>
                    {on ? 'UNLOCKED' : 'LOCKED'}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </section>

        <button type="button" onClick={() => go({ name: 'tab', id: 'habits' })}
          className="flex w-full items-center justify-center gap-1 rounded-2xl py-3 text-[13px] font-bold nnh-chip" style={{ color: 'var(--nnh-violet)' }}>
          <Sparkles size={14} /> Go complete a habit today <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
