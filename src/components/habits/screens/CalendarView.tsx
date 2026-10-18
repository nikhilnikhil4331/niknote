import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useRoutine } from '@/components/habits/RoutineProvider';
import { TopBar } from '@/components/habits/ui';
import { fmtHabitValue, isScheduled, toDay } from '@/lib/trackers';
import { haptic } from '@/hooks/useHaptics';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarScreen({ go }: { go: (s: { name: string; id?: string }) => void }) {
  const { state, today, activeHabits } = useRoutine();
  const reduced = useReducedMotion();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [sel, setSel] = useState(today);
  const [dir, setDir] = useState(0);

  const cells = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < startPad; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(toDay(new Date(ym.y, ym.m, d)));
    return out;
  }, [ym]);

  const monthLabel = new Date(ym.y, ym.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const nav = (d: number) => {
    haptic('selection');
    setDir(d);
    setYm(({ y, m }) => {
      const nm = m + d;
      return { y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });
  };

  const selDate = new Date(sel + 'T12:00');
  const selHabits = activeHabits.filter(h => isScheduled(h.days, selDate));
  const dayLabel = sel === today ? 'Today' : selDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div className="pb-10">
      <TopBar title="Calendar" sub="Your habit history"
        right={
          <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={() => go({ name: 'add' })} aria-label="Add habit"
            className="w-10 h-10 rounded-full nnh-gradient-btn grid place-items-center text-white">
            <Plus size={19} strokeWidth={2.6} />
          </motion.button>
        } />
      <div className="px-4 space-y-4">
        <section className="nnh-card p-4">
          <div className="flex items-center justify-between mb-3">
            <motion.button whileTap={{ scale: 0.85 }} type="button" onClick={() => nav(-1)} aria-label="Previous month"
              className="w-9 h-9 rounded-full grid place-items-center" style={{ background: 'var(--nnh-card-soft)' }}>
              <ChevronLeft size={17} />
            </motion.button>
            <AnimatePresence mode="wait">
              <motion.h2 key={monthLabel} initial={reduced ? false : { opacity: 0, x: dir * 24 }} animate={{ opacity: 1, x: 0 }} exit={reduced ? undefined : { opacity: 0, x: -dir * 24 }}
                transition={{ duration: 0.22 }} className="text-[16px] font-extrabold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {monthLabel}
              </motion.h2>
            </AnimatePresence>
            <motion.button whileTap={{ scale: 0.85 }} type="button" onClick={() => nav(1)} aria-label="Next month"
              className="w-9 h-9 rounded-full grid place-items-center" style={{ background: 'var(--nnh-card-soft)' }}>
              <ChevronRight size={17} />
            </motion.button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DOW.map(d => (
              <span key={d} className="text-center text-[10px] font-extrabold py-1" style={{ color: 'var(--nnh-sub)' }}>{d.slice(0, 1)}</span>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={`${ym.y}-${ym.m}`} initial={reduced ? false : { opacity: 0, x: dir * 30 }} animate={{ opacity: 1, x: 0 }} exit={reduced ? undefined : { opacity: 0, x: -dir * 30 }} transition={{ duration: 0.22 }}>
              <div className="grid grid-cols-7 gap-y-1">
                {cells.map((day, i) => {
                  if (!day) return <span key={`p${i}`} />;
                  const isToday = day === today;
                  const isSel = day === sel;
                  const dots = activeHabits
                    .map(h => (state.entries[`${h.id}|${day}`]?.v ?? 0) > 0 ? h.color : null)
                    .filter(Boolean) as string[];
                  const dNum = Number(day.slice(8));
                  return (
                    <button key={day} type="button" onClick={() => { haptic('light'); setSel(day); }}
                      className="aspect-square mx-auto rounded-full grid place-items-center relative"
                      style={{
                        width: 38, height: 38,
                        background: isSel ? 'var(--nnh-purple)' : isToday ? 'var(--nnh-card-soft)' : 'transparent',
                        color: isSel ? '#fff' : 'var(--nnh-ink)',
                        boxShadow: isToday && !isSel ? 'inset 0 0 0 2px var(--nnh-purple)' : undefined,
                      }}
                      aria-label={day} aria-pressed={isSel}>
                      <span className="text-[12px] font-bold tabular-nums">{dNum}</span>
                      <span className="absolute bottom-1 flex gap-0.5">
                        {dots.slice(0, 3).map((c, k) => (
                          <span key={k} className="rounded-full" style={{ width: 4, height: 4, background: isSel ? '#fff' : c }} />
                        ))}
                        {dots.length > 3 && <span className="text-[7px] font-bold" style={{ color: isSel ? '#fff' : 'var(--nnh-sub)' }}>+{dots.length - 3}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </section>

        {/* selected day */}
        <AnimatePresence mode="wait">
          <motion.section key={sel} initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -10 }}
            className="nnh-card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[14px] font-bold">
                Habits on {selDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                {isToday(selDate, today) && <span className="ml-1.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full text-white nnh-gradient-btn align-middle">{dayLabel}</span>}
              </p>
              <span className="text-[11px] font-bold" style={{ color: 'var(--nnh-sub)' }}>
                {selHabits.filter(h => (state.entries[`${h.id}|${sel}`]?.v ?? 0) >= h.target).length}/{selHabits.length} done
              </span>
            </div>
            <div className="space-y-2">
              {selHabits.map(h => {
                const v = state.entries[`${h.id}|${sel}`]?.v ?? 0;
                const done = v >= h.target;
                const scheduled = isScheduled(h.days, selDate);
                return (
                  <button key={h.id} type="button" onClick={() => go({ name: 'detail', id: h.id })}
                    className="w-full flex items-center gap-3 p-2 rounded-xl text-left" style={{ background: 'var(--nnh-card-soft)', opacity: !scheduled ? 0.55 : 1 }}>
                    <span className="w-9 h-9 rounded-xl grid place-items-center text-lg" style={{ background: `${h.color}22` }}>{h.icon}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-bold truncate">{h.name}</span>
                      <span className="block text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
                        {!scheduled ? 'Rest day' : `${fmtHabitValue(v, h.type)} / ${fmtHabitValue(h.target, h.type)}`}
                      </span>
                    </span>
                    <motion.span initial={false} animate={done && !reduced ? { scale: [1, 1.3, 1] } : {}}
                      className="w-6 h-6 rounded-full border-2 grid place-items-center"
                      style={{ borderColor: done ? h.color : 'var(--nnh-line)', background: done ? h.color : 'transparent', color: '#fff' }}>
                      {done && <Check size={13} strokeWidth={3.4} />}
                    </motion.span>
                  </button>
                );
              })}
              {!selHabits.length && <p className="text-[12px] text-center py-3" style={{ color: 'var(--nnh-sub)' }}>Nothing scheduled this day 🌤️</p>}
            </div>
          </motion.section>
        </AnimatePresence>
      </div>
    </div>
  );
}

const isToday = (d: Date, today: string) => toDay(d) === today;
