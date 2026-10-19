import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Plus, RotateCcw } from 'lucide-react';
import { useRoutine } from '@/components/habits/RoutineProvider';
import { TopBar } from '@/components/habits/ui';
import { completionForDay, fmtHabitValue, isScheduled, toDay } from '@/lib/trackers';
import { haptic } from '@/hooks/useHaptics';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarScreen({ go }: { go: (s: { name: string; id?: string }) => void }) {
  const { state, today, activeHabits, toggleHabitDone } = useRoutine();
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

  const jumpToday = () => {
    haptic('selection');
    setDir(0);
    setYm({ y: now.getFullYear(), m: now.getMonth() });
    setSel(today);
  };

  const selDate = new Date(sel + 'T12:00');
  const selHabits = activeHabits.filter(h => isScheduled(h.days, selDate));
  const selDone = selHabits.filter(h => (state.entries[`${h.id}|${sel}`]?.v ?? 0) >= h.target).length;
  const isTodaySelected = sel === today;

  // month summary from real records only
  const monthSummary = useMemo(() => {
    let slots = 0, done = 0, active = 0;
    for (const day of cells) {
      if (!day || day > today) continue;
      const c = completionForDay(state.entries, activeHabits, new Date(day + 'T12:00'));
      slots += c.total;
      done += c.done;
      if (c.done > 0) active += 1;
    }
    return { slots, done, active, pct: slots ? Math.round((done / slots) * 100) : 0 };
  }, [cells, state.entries, activeHabits]);

  return (
    <div className="pb-2">
      <TopBar title="Calendar" sub="Your habit history" onBack={() => go({ name: 'tab', id: 'home' })}
        right={
          <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={() => go({ name: 'add' })} aria-label="Add habit"
            className="grid h-10 w-10 place-items-center rounded-full text-white nnh-gradient-btn">
            <Plus size={19} strokeWidth={2.6} />
          </motion.button>
        } />
      <div className="space-y-4 px-4">
        <section className="nnh-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <motion.button whileTap={{ scale: 0.86 }} type="button" onClick={() => nav(-1)} aria-label="Previous month"
              className="grid h-9 w-9 place-items-center rounded-full" style={{ background: 'var(--nnh-card-soft)' }}>
              <ChevronLeft size={17} />
            </motion.button>
            <AnimatePresence mode="wait">
              <motion.h2 key={monthLabel} initial={reduced ? false : { opacity: 0, x: dir * 22 }} animate={{ opacity: 1, x: 0 }}
                exit={reduced ? undefined : { opacity: 0, x: -dir * 22 }} transition={{ duration: 0.2 }}
                className="nnh-display text-[16px] font-extrabold">{monthLabel}</motion.h2>
            </AnimatePresence>
            <motion.button whileTap={{ scale: 0.86 }} type="button" onClick={() => nav(1)} aria-label="Next month"
              className="grid h-9 w-9 place-items-center rounded-full" style={{ background: 'var(--nnh-card-soft)' }}>
              <ChevronRight size={17} />
            </motion.button>
          </div>

          <div className="mb-1 grid grid-cols-7">
            {DOW.map(d => (
              <span key={d} className="py-1 text-center text-[10px] font-extrabold" style={{ color: 'var(--nnh-sub)' }}>{d.slice(0, 1)}</span>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={`${ym.y}-${ym.m}`}
              initial={reduced ? false : { opacity: 0, x: dir * 26 }} animate={{ opacity: 1, x: 0 }} exit={reduced ? undefined : { opacity: 0, x: -dir * 26 }}
              transition={{ duration: 0.22 }}>
              <motion.div
                drag={reduced ? false : 'x'} dragDirectionLock dragConstraints={{ left: 0, right: 0 }} dragElastic={0.07}
                onDragEnd={(_, info) => { if (info.offset.x < -42) nav(1); else if (info.offset.x > 42) nav(-1); }}
                className="grid touch-pan-y grid-cols-7 gap-y-1"
                aria-label={`${monthLabel} calendar`}
              >
                {cells.map((day, i) => {
                  if (!day) return <span key={`p${i}`} />;
                  const isToday = day === today;
                  const isSel = day === sel;
                  const c = completionForDay(state.entries, activeHabits, new Date(day + 'T12:00'));
                  const future = day > today;
                  return (
                    <button key={day} type="button" onClick={() => { haptic('light'); setSel(day); }}
                      className="relative mx-auto grid h-10 w-10 place-items-center rounded-xl"
                      style={{
                        background: isSel
                          ? 'linear-gradient(135deg,#9333ea,#ec4899)'
                          : c.pct === 100
                            ? 'color-mix(in srgb, var(--nnh-purple) 16%, transparent)'
                            : c.pct > 0
                              ? 'color-mix(in srgb, var(--nnh-pink) 10%, transparent)'
                              : 'transparent',
                        color: isSel ? '#fff' : future ? 'var(--nnh-sub)' : 'var(--nnh-ink)',
                        boxShadow: isToday && !isSel ? 'inset 0 0 0 2px var(--nnh-purple)' : undefined,
                        opacity: future ? 0.55 : 1,
                      }}
                      aria-label={`${day}${isToday ? ' today' : ''}, ${c.done}/${c.total} habits complete`}
                      aria-pressed={isSel}>
                      <span className="text-[12px] font-bold tabular-nums">{Number(day.slice(8))}</span>
                      {c.total > 0 && (
                        <span className="absolute bottom-1 flex gap-0.5" aria-hidden="true">
                          {c.pct === 100
                            ? <Check size={8} strokeWidth={4} style={{ color: isSel ? '#fff' : 'var(--nnh-purple)' }} />
                            : c.pct > 0
                              ? <span className="h-1 w-1 rounded-full" style={{ background: isSel ? '#fff' : 'var(--nnh-pink)' }} />
                              : null}
                        </span>
                      )}
                    </button>
                  );
                })}
              </motion.div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 nnh-hairline">
            <div className="text-center">
              <p className="nnh-display text-[16px] font-extrabold" style={{ color: 'var(--nnh-violet)' }}>{monthSummary.pct}%</p>
              <p className="text-[9px] font-bold" style={{ color: 'var(--nnh-sub)' }}>Month completion</p>
            </div>
            <div className="text-center">
              <p className="nnh-display text-[16px] font-extrabold" style={{ color: 'var(--nnh-pink)' }}>{monthSummary.done}</p>
              <p className="text-[9px] font-bold" style={{ color: 'var(--nnh-sub)' }}>Checks logged</p>
            </div>
            <div className="text-center">
              <p className="nnh-display text-[16px] font-extrabold" style={{ color: 'var(--nnh-orange)' }}>{monthSummary.active}</p>
              <p className="text-[9px] font-bold" style={{ color: 'var(--nnh-sub)' }}>Active days</p>
            </div>
          </div>
          {!isTodaySelected && (
            <button type="button" onClick={jumpToday}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-full py-2 text-[11px] font-extrabold nnh-chip"
              style={{ color: 'var(--nnh-violet)' }}>
              <RotateCcw size={11} /> Back to today
            </button>
          )}
        </section>

        {/* crossfade instead of mode="wait": the day's records must update with the tap */}
        <AnimatePresence initial={false}>
          <motion.section key={sel} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -6 }} className="nnh-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[14px] font-extrabold">
                Habits on {selDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                {isTodaySelected && (
                  <span className="ml-1.5 rounded-full px-2 py-0.5 align-middle text-[10px] font-extrabold text-white nnh-gradient-btn">Today</span>
                )}
              </p>
              <span className="text-[11px] font-bold" style={{ color: 'var(--nnh-sub)' }}>{selDone}/{selHabits.length} done</span>
            </div>
            <div className="space-y-2">
              {selHabits.map(h => {
                const v = state.entries[`${h.id}|${sel}`]?.v ?? 0;
                const done = v >= h.target;
                return (
                  <div key={h.id} className="flex items-center gap-2 rounded-xl p-2" style={{ background: 'var(--nnh-card-soft)' }}>
                    <button type="button" onClick={() => go({ name: 'detail', id: h.id })}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="grid h-9 w-9 place-items-center rounded-xl text-lg" style={{ background: `${h.color}22` }}>{h.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold">{h.name}</span>
                        <span className="block text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
                          {fmtHabitValue(v, h.type)} / {fmtHabitValue(h.target, h.type)}
                        </span>
                      </span>
                    </button>
                    <motion.button whileTap={reduced ? undefined : { scale: 0.84 }} type="button"
                      onClick={() => toggleHabitDone(h, sel)}
                      aria-label={done ? `Reopen ${h.name}` : `Complete ${h.name}`} aria-pressed={done}
                      disabled={sel > today}
                      className="grid h-8 w-8 place-items-center rounded-full border-2 disabled:opacity-40"
                      style={{ borderColor: done ? h.color : 'var(--nnh-line-strong)', background: done ? h.color : 'transparent', color: '#fff' }}>
                      {done ? <Check size={14} strokeWidth={3.4} /> : <Plus size={13} style={{ color: 'var(--nnh-sub)' }} />}
                    </motion.button>
                  </div>
                );
              })}
              {!selHabits.length && <p className="py-3 text-center text-[12px]" style={{ color: 'var(--nnh-sub)' }}>Nothing scheduled this day 🌤️</p>}
            </div>
          </motion.section>
        </AnimatePresence>
      </div>
    </div>
  );
}
