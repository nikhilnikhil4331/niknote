import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, Droplet, Dumbbell, Moon, TrendingUp } from 'lucide-react';
import { useRoutine } from '@/components/habits/RoutineProvider';
import { CountUp, Segmented, StatTile, TopBar, WeekBars } from '@/components/habits/ui';
import { bestStreakAcross, exerciseStats, isScheduled, toDay, weekCompletion } from '@/lib/trackers';

type Tab = 'habits' | 'water' | 'sleep' | 'exercise';

export function InsightsScreen({ go }: { go: (s: { name: string; id?: string }) => void }) {
  const { state, activeHabits } = useRoutine();
  const reduced = useReducedMotion();
  const [tab, setTab] = useState<Tab>('habits');
  const now = new Date();

  const water = activeHabits.find(h => h.type === 'water');
  const sleep = activeHabits.find(h => h.type === 'sleep');
  const exercise = activeHabits.find(h => h.type === 'minutes' && /exerc|gym|run|walk|yoga|workout/i.test(h.name)) ?? activeHabits.find(h => h.type === 'minutes');

  const wk = useMemo(() => weekCompletion(state.entries, activeHabits, now), [state.entries, activeHabits]);
  const best = useMemo(() => bestStreakAcross(state.entries, activeHabits, now), [state.entries, activeHabits]);

  // previous week for the delta
  const prevPct = useMemo(() => {
    let slots = 0, done = 0;
    for (let i = 13; i >= 7; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const day = toDay(d);
      for (const h of activeHabits) {
        if (!isScheduled(h.days, d)) continue;
        slots++;
        if ((state.entries[`${h.id}|${day}`]?.v ?? 0) >= h.target) done++;
      }
    }
    return slots ? Math.round((done / slots) * 100) : 0;
  }, [state.entries, activeHabits]);
  const delta = wk.pct - prevPct;

  const series = (id: string | undefined, scale = 1) =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      const day = toDay(d);
      return { label: d.toLocaleDateString(undefined, { weekday: 'short' }), value: (id ? state.entries[`${id}|${day}`]?.v ?? 0 : 0) * scale, today: i === 6 };
    });

  const weekVal = (id: string | undefined) =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      return state.entries[`${id}|${toDay(d)}`]?.v ?? 0;
    }).reduce((a, b) => a + b, 0);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'habits', label: 'Habits' },
    { id: 'water', label: 'Water' },
    { id: 'sleep', label: 'Sleep' },
    { id: 'exercise', label: 'Exercise' },
  ];

  return (
    <div className="pb-32">
      <TopBar title="Insights" icon={<span>📊</span>} sub="Your week at a glance" />
      <div className="px-4 space-y-4">
        <Segmented options={tabs} value={tab} onChange={v => setTab(v)} />

        {/* headline stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="nnh-card p-3 text-center">
            <p className="text-[22px] font-extrabold" style={{ color: 'var(--nnh-purple)', fontFamily: "'Space Grotesk', sans-serif" }}>
              <CountUp value={wk.pct} />%
            </p>
            <p className="text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>Completion</p>
            <p className={`text-[10px] font-bold flex items-center justify-center gap-0.5 mt-0.5 ${delta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              <TrendingUp size={10} className={delta < 0 ? 'rotate-180' : ''} /> {delta >= 0 ? '+' : ''}{delta}%
            </p>
          </div>
          <div className="nnh-card p-3 text-center">
            <p className="text-[22px] font-extrabold" style={{ color: 'var(--nnh-indigo, #6366f1)', fontFamily: "'Space Grotesk', sans-serif" }}>
              <CountUp value={activeHabits.length} />
            </p>
            <p className="text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>Total Habits</p>
            <p className="text-[10px] font-bold text-emerald-500 mt-0.5">active</p>
          </div>
          <div className="nnh-card p-3 text-center">
            <p className="text-[22px] font-extrabold" style={{ color: 'var(--nnh-orange, #f97316)', fontFamily: "'Space Grotesk', sans-serif" }}>
              <CountUp value={best} /> <span className="text-[12px]">days</span>
            </p>
            <p className="text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>Best Streak</p>
          </div>
        </div>

        {/* weekly progress */}
        <section className="nnh-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[14px] font-bold">Weekly Progress</p>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold text-white nnh-gradient-btn">{wk.pct}%</span>
          </div>
          <WeekBars
            data={wk.perDay.map(p => ({ label: p.label, value: p.pct, today: p.day === toDay(now) }))}
            colorFrom="#8b5cf6" colorTo="#ec4899" max={100} height={130} suffix="%" reduced={reduced}
          />
        </section>

        <motion.div key={tab} initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {tab === 'habits' && (
            <section className="nnh-card p-4 space-y-2.5">
              <p className="text-[14px] font-bold mb-1">This week by habit</p>
              {activeHabits.map(h => {
                const total = wk.perDay.filter(p => h.days.includes(new Date(p.day + 'T12:00').getDay())).length;
                const done = wk.perDay.filter(p => (state.entries[`${h.id}|${p.day}`]?.v ?? 0) >= h.target).length;
                const pct = total ? Math.round((done / total) * 100) : 0;
                return (
                  <button key={h.id} type="button" onClick={() => go({ name: 'detail', id: h.id })} className="w-full flex items-center gap-3 text-left">
                    <span className="w-9 h-9 rounded-xl grid place-items-center text-lg" style={{ background: `${h.color}22` }}>{h.icon}</span>
                    <span className="flex-1 min-w-0">
                      <span className="flex justify-between text-[12px] font-bold">
                        <span className="truncate">{h.name}</span>
                        <span style={{ color: h.color }}>{done}/{total} days</span>
                      </span>
                      <span className="block h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: 'var(--nnh-line)' }}>
                        <motion.span initial={false} animate={{ width: `${pct}%` }} className="block h-full rounded-full" style={{ background: h.color }} transition={{ type: 'spring', stiffness: 70, damping: 17 }} />
                      </span>
                    </span>
                  </button>
                );
              })}
              {!activeHabits.length && <p className="text-[12px] text-center py-3" style={{ color: 'var(--nnh-sub)' }}>Add habits to see your stats</p>}
            </section>
          )}

          {tab === 'water' && water && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatTile value={<><CountUp value={weekVal(water.id)} decimals={weekVal(water.id) % 1 ? 1 : 0} /> <span className="text-[11px]">glasses</span></>} label="This week" accent="#0ea5e9" icon={<Droplet size={14} />} />
                <StatTile value={<><CountUp value={weekVal(water.id) / 7} decimals={1} /> <span className="text-[11px]">glasses</span></>} label="Daily average" accent="#2563eb" />
              </div>
              <section className="nnh-card p-4">
                <p className="text-[14px] font-bold mb-3">Glasses per day</p>
                <WeekBars data={series(water.id)} colorFrom="#38bdf8" colorTo="#2563eb" max={water.target} height={130} suffix="" reduced={reduced} />
                <button type="button" onClick={() => go({ name: 'detail', id: water.id })}
                  className="w-full mt-3 flex items-center justify-center gap-1 text-[12px] font-bold nnh-chip py-2.5" style={{ color: '#0284c7' }}>
                  Open Water Intake <ChevronRight size={14} />
                </button>
              </section>
            </>
          )}

          {tab === 'sleep' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatTile value={<><CountUp value={weekVal(sleep?.id)} decimals={1} /> <span className="text-[11px]">hours</span></>} label="This week" accent="#8b5cf6" icon={<Moon size={14} />} />
                <StatTile value={<><CountUp value={(weekVal(sleep?.id) / 7)} decimals={1} /> <span className="text-[11px]">h avg</span></>} label="Daily average" accent="#6366f1" />
              </div>
              <section className="nnh-card p-4">
                <p className="text-[14px] font-bold mb-3">Sleep per night</p>
                <WeekBars data={series(sleep?.id)} colorFrom="#a78bfa" colorTo="#6366f1" max={10} height={130} suffix="h" reduced={reduced} />
                <button type="button" onClick={() => go({ name: 'sleep' })}
                  className="w-full mt-3 flex items-center justify-center gap-1 text-[12px] font-bold nnh-chip py-2.5" style={{ color: '#7c3aed' }}>
                  Sleep details <ChevronRight size={14} />
                </button>
              </section>
            </>
          )}

          {tab === 'exercise' && (
            <>
              {exercise ? (
                <>
                  {(() => {
                    const mins = weekVal(exercise.id);
                    const s = exerciseStats(mins);
                    return (
                      <div className="grid grid-cols-3 gap-3">
                        <StatTile value={<><CountUp value={mins} /> <span className="text-[11px]">min</span></>} label="This week" accent="#22c55e" icon={<Dumbbell size={13} />} />
                        <StatTile value={<><CountUp value={s.kcal} /> <span className="text-[11px]">kcal</span></>} label="Burned" accent="#f97316" />
                        <StatTile value={<><CountUp value={s.km} decimals={1} /> <span className="text-[11px]">km</span></>} label="Distance" accent="#0ea5e9" />
                      </div>
                    );
                  })()}
                  <section className="nnh-card p-4">
                    <p className="text-[14px] font-bold mb-3">Minutes per day</p>
                    <WeekBars data={series(exercise.id)} colorFrom="#4ade80" colorTo="#16a34a" max={Math.max(45, exercise.target)} height={130} suffix="m" reduced={reduced} />
                    <button type="button" onClick={() => go({ name: 'exercise' })}
                      className="w-full mt-3 flex items-center justify-center gap-1 text-[12px] font-bold nnh-chip py-2.5" style={{ color: '#16a34a' }}>
                      Exercise details <ChevronRight size={14} />
                    </button>
                  </section>
                </>
              ) : (
                <p className="text-center text-[12px] py-6" style={{ color: 'var(--nnh-sub)' }}>Add an exercise habit to track workouts 💪</p>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
