import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, Droplet, Dumbbell, Moon, TrendingDown, TrendingUp } from 'lucide-react';
import { useRoutine } from '@/components/habits/RoutineProvider';
import { CountUp, Segmented, StatTile, TopBar } from '@/components/habits/ui';
import { ConsistencyHeatmap, InteractiveBars, ProgressBar, TrendLine } from '@/components/habits/charts';
import {
  HABIT_CATEGORIES, bestStreakHistory, categoryBreakdown, completionForDay,
  exerciseStats, isScheduled, rangeCompletion, toDay,
} from '@/lib/trackers';

type Tab = 'habits' | 'water' | 'sleep' | 'exercise';
type Range = 'week' | 'month';

export function InsightsScreen({ go }: { go: (s: { name: string; id?: string }) => void }) {
  const { state, activeHabits } = useRoutine();
  const reduced = useReducedMotion();
  const [tab, setTab] = useState<Tab>('habits');
  const [range, setRange] = useState<Range>('week');
  const now = new Date();
  const span = range === 'week' ? 7 : 30;

  const water = activeHabits.find(h => h.type === 'water');
  const sleep = activeHabits.find(h => h.type === 'sleep');
  const exercise = activeHabits.find(h => h.type === 'minutes' && /exerc|gym|run|walk|yoga|workout/i.test(h.name)) ?? activeHabits.find(h => h.type === 'minutes');

  /** Every day key in the active range, oldest first. */
  const rangeDays = useMemo(() => Array.from({ length: span }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (span - 1 - i));
    return toDay(d);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [span, range]);

  const prevDays = useMemo(() => Array.from({ length: span }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (span * 2 - 1 - i));
    return toDay(d);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [span, range]);

  const completion = useMemo(() => rangeCompletion(state.entries, activeHabits, rangeDays), [state.entries, activeHabits, rangeDays]);
  const previous = useMemo(() => rangeCompletion(state.entries, activeHabits, prevDays), [state.entries, activeHabits, prevDays]);
  const delta = completion.pct - previous.pct;
  const best = useMemo(() => bestStreakHistory(state.entries, activeHabits, now), [state.entries, activeHabits]);

  const perDay = useMemo(() => rangeDays.map(day => {
    const c = completionForDay(state.entries, activeHabits, new Date(day + 'T12:00'));
    return {
      label: new Date(day + 'T12:00').toLocaleDateString(undefined, range === 'week' ? { weekday: 'narrow' } : { day: 'numeric' }),
      value: c.pct,
      hint: new Date(day + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      today: day === toDay(now),
    };
  }), [rangeDays, state.entries, activeHabits, range]);

  /** Monthly view groups the 30 days into weeks so bars stay readable. */
  const weekBuckets = useMemo(() => {
    const buckets: { label: string; value: number; hint: string; today?: boolean }[] = [];
    for (let start = 0; start < rangeDays.length; start += 7) {
      const slice = rangeDays.slice(start, start + 7);
      const c = rangeCompletion(state.entries, activeHabits, slice);
      const first = new Date(slice[0] + 'T12:00');
      const last = new Date(slice[slice.length - 1] + 'T12:00');
      buckets.push({
        label: `W${buckets.length + 1}`,
        value: c.pct,
        hint: `${first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}–${last.getDate()}`,
        today: slice.includes(toDay(now)),
      });
    }
    return buckets;
  }, [rangeDays, state.entries, activeHabits]);

  const categories = useMemo(
    () => categoryBreakdown(state.entries, activeHabits, now, span),
    [state.entries, activeHabits, span],
  );

  const heat = useMemo(() => Array.from({ length: 35 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (34 - i));
    const c = completionForDay(state.entries, activeHabits, d);
    return { day: toDay(d), pct: c.pct, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state.entries, activeHabits]);

  const trendPoints = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (29 - i));
    const c = completionForDay(state.entries, activeHabits, d);
    return { label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: c.pct };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state.entries, activeHabits]);

  const valuesFor = (id: string | undefined, scale = 1) => rangeDays.map((day, i) => {
    const d = new Date(day + 'T12:00');
    return {
      label: range === 'week' ? d.toLocaleDateString(undefined, { weekday: 'narrow' }) : String(d.getDate()),
      value: (id ? state.entries[`${id}|${day}`]?.v ?? 0 : 0) * scale,
      hint: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      today: i === rangeDays.length - 1,
    };
  });

  const weeklyBuckets = (id: string | undefined) => {
    const out: { label: string; value: number; hint: string }[] = [];
    for (let start = 0; start < rangeDays.length; start += 7) {
      const slice = rangeDays.slice(start, start + 7);
      const sum = slice.reduce((a, day) => a + (id ? state.entries[`${id}|${day}`]?.v ?? 0 : 0), 0);
      const first = new Date(slice[0] + 'T12:00');
      out.push({ label: `W${out.length + 1}`, value: Math.round((sum / slice.length) * 10) / 10, hint: `Week of ${first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` });
    }
    return out;
  };

  const totalFor = (id: string | undefined) => rangeDays.reduce((a, day) => a + (id ? state.entries[`${id}|${day}`]?.v ?? 0 : 0), 0);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'habits', label: 'Habits' },
    { id: 'water', label: 'Water' },
    { id: 'sleep', label: 'Sleep' },
    { id: 'exercise', label: 'Exercise' },
  ];
  const rangeLabel = range === 'week' ? 'This week' : 'Last 30 days';

  return (
    <div className="pb-2">
      <TopBar title="Insights" icon={<span>📊</span>}
        sub={range === 'week' ? 'Your week at a glance' : 'Your month at a glance'} />
      <div className="space-y-4 px-4">
        <Segmented options={tabs} value={tab} onChange={v => setTab(v)} />

        {/* headline stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="nnh-card p-3 text-center">
            <p className="nnh-display text-[22px] font-extrabold" style={{ color: 'var(--nnh-violet)' }}>
              <CountUp value={completion.pct} />%
            </p>
            <p className="text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>Completion</p>
            <p className={`mt-0.5 flex items-center justify-center gap-0.5 text-[10px] font-bold ${delta >= 0 ? 'text-success' : 'text-accent-rose'}`}>
              {delta >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {delta >= 0 ? '+' : ''}{delta}%
            </p>
          </div>
          <div className="nnh-card p-3 text-center">
            <p className="nnh-display text-[22px] font-extrabold" style={{ color: 'var(--nnh-indigo)' }}>
              <CountUp value={completion.done} />
            </p>
            <p className="text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>Checks</p>
            <p className="mt-0.5 text-[10px] font-bold" style={{ color: 'var(--nnh-sub)' }}>of {completion.slots}</p>
          </div>
          <div className="nnh-card p-3 text-center">
            <p className="nnh-display text-[22px] font-extrabold" style={{ color: 'var(--nnh-orange)' }}>
              <CountUp value={best} /> <span className="text-[11px]">d</span>
            </p>
            <p className="text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>Best streak</p>
            <p className="mt-0.5 text-[10px] font-bold" style={{ color: 'var(--nnh-sub)' }}>all time</p>
          </div>
        </div>

        {/* range switch */}
        <div className="flex items-center justify-between">
          <span className="nnh-label">{rangeLabel}</span>
          <div className="flex rounded-full p-1" style={{ background: 'var(--nnh-card)' }}>
            {(['week', 'month'] as Range[]).map(r => (
              <button key={r} type="button" onClick={() => setRange(r)} aria-pressed={range === r}
                className="min-h-[34px] rounded-full px-3.5 py-1 text-[10px] font-extrabold capitalize"
                style={range === r ? { background: 'var(--nnh-lavender)', color: 'var(--nnh-violet)' } : { color: 'var(--nnh-sub)' }}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* completion chart */}
        <section className="nnh-card p-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[14px] font-extrabold">{range === 'week' ? 'Weekly Progress' : 'Monthly Progress'}</p>
            <span className="rounded-full px-2.5 py-1 text-[11px] font-extrabold text-white nnh-gradient-btn">{completion.pct}%</span>
          </div>
          <p className="mb-2 text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
            {range === 'week' ? 'Tap or hover a day for details' : 'Completion by week'}
          </p>
          <InteractiveBars
            data={range === 'week' ? perDay : weekBuckets}
            max={100}
            suffix="%"
            height={138}
            formatValue={v => `${Math.round(v)}%`}
          />
        </section>

        <motion.div key={tab + range} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {tab === 'habits' && (
            <>
              <section className="nnh-card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[14px] font-extrabold">This {range} by habit</p>
                  <span className="text-[10px] font-bold" style={{ color: 'var(--nnh-sub)' }}>{rangeLabel}</span>
                </div>
                <div className="space-y-2.5">
                  {activeHabits.map(h => {
                    const scheduledDays = rangeDays.filter(day => isScheduled(h.days, new Date(day + 'T12:00')));
                    const done = scheduledDays.filter(day => (state.entries[`${h.id}|${day}`]?.v ?? 0) >= h.target).length;
                    const pct = scheduledDays.length ? Math.round((done / scheduledDays.length) * 100) : 0;
                    return (
                      <button key={h.id} type="button" onClick={() => go({ name: 'detail', id: h.id })}
                        className="w-full text-left" aria-label={`${h.name}: ${done} of ${scheduledDays.length} days`}>
                        <span className="flex items-center gap-3">
                          <span className="grid h-9 w-9 place-items-center rounded-xl text-lg" style={{ background: `${h.color}22` }}>{h.icon}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex justify-between text-[12px] font-bold">
                              <span className="truncate">{h.name}</span>
                              <span style={{ color: h.color }}>{done}/{scheduledDays.length} days</span>
                            </span>
                            <span className="mt-1 block"><ProgressBar pct={pct} color={h.color} /></span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  {!activeHabits.length && <p className="py-3 text-center text-[12px]" style={{ color: 'var(--nnh-sub)' }}>Add habits to see your stats</p>}
                </div>
              </section>

              <section className="nnh-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[14px] font-extrabold">Habit Categories</p>
                  <span className="text-[10px] font-bold" style={{ color: 'var(--nnh-sub)' }}>{rangeLabel}</span>
                </div>
                <div className="space-y-2.5">
                  {categories.map(c => {
                    const meta = HABIT_CATEGORIES.find(x => x.id === c.category);
                    const tint = c.category === 'health' ? '#7C5F9E' : c.category === 'study' ? '#7C5F9E' : c.category === 'mind' ? '#A34054' : c.category === 'social' ? '#D9822F' : 'var(--nnh-purple)';
                    return (
                      <div key={c.category} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 truncate text-[11px] font-bold">
                          {meta?.icon} {meta?.label ?? c.category}
                        </span>
                        <span className="flex-1"><ProgressBar pct={c.pct} color={tint} /></span>
                        <span className="w-9 text-right text-[11px] font-extrabold tabular-nums" style={{ color: tint }}>{c.pct}%</span>
                      </div>
                    );
                  })}
                  {!categories.length && <p className="py-2 text-center text-[12px]" style={{ color: 'var(--nnh-sub)' }}>No scheduled habits yet</p>}
                </div>
              </section>

              <section className="nnh-card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[14px] font-extrabold">Completion trend</p>
                  <span className="text-[10px] font-bold" style={{ color: 'var(--nnh-sub)' }}>30 days</span>
                </div>
                <TrendLine points={trendPoints} label="Daily completion trend over the last 30 days" />
              </section>

              <section className="nnh-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[14px] font-extrabold">Consistency</p>
                  <span className="text-[10px] font-bold" style={{ color: 'var(--nnh-sub)' }}>Last 5 weeks</span>
                </div>
                <ConsistencyHeatmap days={heat} />
                <div className="mt-2 flex items-center justify-end gap-1.5 text-[9px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>
                  Less
                  {[0, 30, 65, 100].map(p => (
                    <span key={p} className="h-2.5 w-2.5 rounded-[3px]"
                      style={{ background: p === 0 ? 'var(--nnh-line)' : `color-mix(in srgb, var(--nnh-purple) ${p >= 100 ? 100 : p}%, var(--nnh-card))` }} />
                  ))}
                  More
                </div>
              </section>
            </>
          )}

          {tab === 'water' && (
            water ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <StatTile value={<><CountUp value={totalFor(water.id)} /> <span className="text-[11px]">glasses</span></>} label={rangeLabel} accent="#7C5F9E" icon={<Droplet size={14} />} />
                  <StatTile value={<><CountUp value={totalFor(water.id) / span} decimals={1} /> <span className="text-[11px]">per day</span></>} label="Daily average" accent="#5C3A6E" />
                </div>
                <section className="nnh-card p-4">
                  <p className="mb-2 text-[14px] font-extrabold">Glasses {range === 'week' ? 'per day' : 'per week (avg)'}</p>
                  <InteractiveBars data={range === 'week' ? valuesFor(water.id) : weeklyBuckets(water.id)}
                    max={water.target} from="#A688C9" to="#5C3A6E" height={138} formatValue={v => `${Math.round(v * 10) / 10} glasses`} />
                  <button type="button" onClick={() => go({ name: 'detail', id: water.id })}
                    className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl py-2.5 text-[12px] font-bold nnh-chip" style={{ color: '#0284c7' }}>
                    Open Water Intake <ChevronRight size={14} />
                  </button>
                </section>
              </>
            ) : <EmptyInsight text="Add a water habit to unlock hydration analytics" go={go} />
          )}

          {tab === 'sleep' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatTile value={<><CountUp value={totalFor(sleep?.id)} decimals={1} /> <span className="text-[11px]">hours</span></>} label={rangeLabel} accent="#7C5F9E" icon={<Moon size={14} />} />
                <StatTile value={<><CountUp value={totalFor(sleep?.id) / span} decimals={1} /> <span className="text-[11px]">h avg</span></>} label="Daily average" accent="#7C5F9E" />
              </div>
              <section className="nnh-card p-4">
                <p className="mb-2 text-[14px] font-extrabold">Sleep per night</p>
                <InteractiveBars data={range === 'week' ? valuesFor(sleep?.id) : weeklyBuckets(sleep?.id)}
                  max={10} from="#C0A6DE" to="#7C5F9E" height={138} suffix="h" formatValue={v => `${v} h`} />
                <button type="button" onClick={() => go({ name: 'sleep' })}
                  className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl py-2.5 text-[12px] font-bold nnh-chip" style={{ color: '#7C5F9E' }}>
                  Sleep details <ChevronRight size={14} />
                </button>
              </section>
            </>
          )}

          {tab === 'exercise' && (
            exercise ? (
              <>
                {(() => {
                  const mins = totalFor(exercise.id);
                  const s = exerciseStats(mins);
                  return (
                    <div className="grid grid-cols-3 gap-3">
                      <StatTile value={<><CountUp value={mins} /> <span className="text-[11px]">min</span></>} label={range === 'week' ? 'This week' : '30 days'} accent="#157F52" icon={<Dumbbell size={13} />} />
                      <StatTile value={<><CountUp value={s.kcal} /> <span className="text-[11px]">kcal</span></>} label="Burned" accent="#D9822F" />
                      <StatTile value={<><CountUp value={s.km} decimals={1} /> <span className="text-[11px]">km</span></>} label="Distance" accent="#7C5F9E" />
                    </div>
                  );
                })()}
                <section className="nnh-card p-4">
                  <p className="mb-2 text-[14px] font-extrabold">Minutes {range === 'week' ? 'per day' : 'per week (avg)'}</p>
                  <InteractiveBars data={range === 'week' ? valuesFor(exercise.id) : weeklyBuckets(exercise.id)}
                    max={Math.max(45, exercise.target)} from="#6FCF97" to="#157F52" height={138} suffix="m" formatValue={v => `${Math.round(v)} min`} />
                  <button type="button" onClick={() => go({ name: 'exercise' })}
                    className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl py-2.5 text-[12px] font-bold nnh-chip" style={{ color: '#157F52' }}>
                    Exercise details <ChevronRight size={14} />
                  </button>
                </section>
              </>
            ) : <EmptyInsight text="Add an exercise habit to track workouts" go={go} />
          )}
        </motion.div>
      </div>
    </div>
  );
}

function EmptyInsight({ text, go }: { text: string; go: (s: { name: string; id?: string }) => void }) {
  return (
    <div className="nnh-card px-6 py-8 text-center">
      <p className="text-3xl">🌱</p>
      <p className="mt-2 text-[13px] font-bold">{text}</p>
      <button type="button" onClick={() => go({ name: 'add' })}
        className="mt-3 rounded-full px-4 py-2 text-[12px] font-extrabold text-white nnh-gradient-btn">Create a habit</button>
    </div>
  );
}
