import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronRight, Lock } from 'lucide-react';
import { useRoutine } from '@/components/habits/RoutineProvider';
import { CountUp, TopBar } from '@/components/habits/ui';
import { ACHIEVEMENTS, isScheduled, toDay, unlockedAchievements } from '@/lib/trackers';

export function StreaksScreen({ go }: { go: (s: { name: string; id?: string }) => void }) {
  const { state, activeHabits } = useRoutine();
  const reduced = useReducedMotion();
  const now = new Date();
  const today = toDay(now);

  const best = useMemo(() => {
    let m = 0;
    for (const h of activeHabits) {
      const set = new Set<string>();
      for (let i = 0; i < 400; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const day = toDay(d);
        if ((state.entries[`${h.id}|${day}`]?.v ?? 0) >= h.target) set.add(day);
        else if (i === 0) continue;
        else break;
      }
      // scheduled streak
      let streak = 0;
      for (let i = 0; i < 400; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        if (!isScheduled(h.days, d)) continue;
        const day = toDay(d);
        if (set.has(day)) streak++;
        else if (i === 0) continue;
        else break;
      }
      m = Math.max(m, streak);
    }
    return m;
  }, [state.entries, activeHabits]);

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    const day = toDay(d);
    const sched = activeHabits.filter(h => isScheduled(h.days, d));
    const done = sched.filter(h => (state.entries[`${h.id}|${day}`]?.v ?? 0) >= h.target).length;
    return { day, label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()], full: sched.length > 0 && done === sched.length, today: day === today };
  }), [state.entries, activeHabits, today]);

  const unlocked = useMemo(() => new Set(unlockedAchievements({
    habits: activeHabits.map(h => ({ id: h.id, name: h.name, type: h.type, target: h.target, days: h.days })),
    entries: state.entries,
    focus: state.focus,
    today,
  }).map(a => a.id)), [activeHabits, state.entries, state.focus, today]);

  return (
    <div className="pb-32">
      <TopBar title="Streaks & Achievements" icon={<span>🏅</span>} sub="Momentum is everything" />
      <div className="px-4 space-y-4">
        {/* flame hero */}
        <section className="nnh-card p-5 text-center relative overflow-hidden">
          <span className="absolute inset-x-0 top-0 h-24" style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(249,115,22,0.16), transparent 75%)' }} aria-hidden="true" />
          <motion.span
            animate={reduced ? undefined : { y: [0, -6, 0], rotate: [-2, 2, -2] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            className="text-[52px] leading-none inline-block nnh-anim-flicker">🔥</motion.span>
          <h2 className="text-[24px] font-extrabold mt-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            <CountUp value={best} /> Day Streak
          </h2>
          <p className="text-[12px] font-semibold mt-1" style={{ color: 'var(--nnh-sub)' }}>
            {best >= 7 ? 'You are on fire! 🚀' : best > 0 ? 'Keep the momentum going!' : 'Complete a habit to start one 🔥'}
          </p>
          <div className="flex justify-center gap-3 mt-4">
            {week.map(w => (
              <div key={w.day} className="flex flex-col items-center gap-1">
                <span className="text-[9px] font-bold" style={{ color: w.today ? 'var(--nnh-purple)' : 'var(--nnh-sub)' }}>{w.label}</span>
                <span className="w-7 h-7 rounded-full grid place-items-center border-2"
                  style={{ borderColor: w.full ? 'var(--nnh-orange)' : 'var(--nnh-line)', background: w.full ? 'var(--nnh-orange)' : 'transparent', color: '#fff' }}>
                  {w.full && <Check size={13} strokeWidth={3.4} />}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* achievements */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-[15px] font-bold">Achievements</h3>
            <span className="text-[11px] font-bold" style={{ color: 'var(--nnh-sub)' }}>{unlocked.size}/{ACHIEVEMENTS.length} unlocked</span>
          </div>
          <div className="space-y-2.5">
            {ACHIEVEMENTS.map((a, i) => {
              const on = unlocked.has(a.id);
              return (
                <motion.div key={a.id} initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : i * 0.05 }}
                  className="nnh-card p-3 flex items-center gap-3 relative overflow-hidden">
                  {on && <span className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${a.color}14, transparent 55%)` }} aria-hidden="true" />}
                  <motion.span whileHover={reduced ? undefined : { scale: 1.1, rotate: 6 }}
                    className="relative w-11 h-11 rounded-2xl grid place-items-center text-[22px] shrink-0"
                    style={{ background: on ? `${a.color}26` : 'var(--nnh-card-soft)', filter: on ? undefined : 'grayscale(1)', opacity: on ? 1 : 0.55 }}>
                    {a.icon}
                    {!on && <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full grid place-items-center text-white" style={{ background: 'var(--nnh-sub)' }}><Lock size={10} /></span>}
                  </motion.span>
                  <div className="relative flex-1 min-w-0">
                    <p className="text-[13px] font-bold truncate">{a.name}</p>
                    <p className="text-[11px] font-medium truncate" style={{ color: 'var(--nnh-sub)' }}>{a.desc}</p>
                  </div>
                  <span className="relative text-[10px] font-extrabold px-2 py-1 rounded-full"
                    style={on ? { background: `${a.color}22`, color: a.color } : { background: 'var(--nnh-card-soft)', color: 'var(--nnh-sub)' }}>
                    {on ? 'UNLOCKED' : 'LOCKED'}
                  </span>
                  <ChevronRight size={15} className="relative" style={{ color: 'var(--nnh-sub)' }} />
                </motion.div>
              );
            })}
          </div>
        </section>

        <button type="button" onClick={() => go({ name: 'tab', id: 'habits' })}
          className="w-full nnh-chip py-3 text-[13px] font-bold flex items-center justify-center gap-1" style={{ color: 'var(--nnh-purple)' }}>
          Go complete a habit today <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
