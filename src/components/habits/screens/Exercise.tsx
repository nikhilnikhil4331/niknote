import { useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, Minus, Plus } from 'lucide-react';
import { useRoutine } from '@/components/habits/RoutineProvider';
import { CountUp, Ring, Segmented, StatTile, TopBar, WeekBars } from '@/components/habits/ui';
import { exerciseStats, toDay } from '@/lib/trackers';
import { haptic } from '@/hooks/useHaptics';
import { useState } from 'react';

type Range = 'day' | 'week' | 'month';

export function ExerciseScreen({ go }: { go: (s: { name: string; id?: string }) => void }) {
  const { state, today, bump } = useRoutine();
  const reduced = useReducedMotion();
  const [range, setRange] = useState<Range>('day');
  const ex = state.habits.find(h => h.type === 'minutes' && !h.archived && /exerc|gym|run|walk|yoga|workout/i.test(h.name))
    ?? state.habits.find(h => h.type === 'minutes' && !h.archived);
  const now = new Date();

  const todayVal = ex ? state.entries[`${ex.id}|${today}`]?.v ?? 0 : 0;
  const goal = ex?.target ?? 30;

  const bars = useMemo(() => {
    if (!ex) return [];
    if (range === 'day') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
        const day = toDay(d);
        return { label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), value: state.entries[`${ex.id}|${day}`]?.v ?? 0, today: i === 6 };
      });
    }
    if (range === 'week') {
      return Array.from({ length: 4 }, (_, i) => {
        const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i * 7));
        let sum = 0;
        for (let k = 0; k < 7; k++) {
          const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - k);
          sum += state.entries[`${ex.id}|${toDay(d)}`]?.v ?? 0;
        }
        return { label: `W${i + 1}`, value: Math.round(sum), today: i === 3 };
      });
    }
    return Array.from({ length: 12 }, (_, i) => {
      const base = new Date(now.getFullYear(), now.getMonth() - (11 - i), 15);
      let sum = 0, n = 0;
      for (let k = 0; k < 30; k++) {
        const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + k);
        if (d > now) break;
        sum += state.entries[`${ex.id}|${toDay(d)}`]?.v ?? 0;
        n++;
      }
      return { label: base.toLocaleDateString(undefined, { month: 'short' }).slice(0, 1), value: n ? Math.round(sum / n) : 0, today: i === 11 };
    });
  }, [range, state.entries, ex]);

  const recent = useMemo(() => {
    if (!ex) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      const day = toDay(d);
      const v = state.entries[`${ex.id}|${day}`]?.v ?? 0;
      if (v <= 0) return null;
      const s = exerciseStats(v);
      const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      return { day, v, kcal: s.kcal, km: s.km, label };
    }).filter(Boolean) as { day: string; v: number; kcal: number; km: number; label: string }[];
  }, [state.entries, ex]);

  if (!ex) {
    return (
      <div className="pb-2">
        <TopBar title="Exercise" onBack={() => go({ name: 'tab', id: 'insights' })} icon={<span>🏃</span>} />
        <p className="text-center text-[13px] mt-16 px-8" style={{ color: 'var(--nnh-sub)' }}>Add an exercise habit to track workouts 🏃</p>
      </div>
    );
  }

  const pct = Math.min(1, todayVal / goal);
  const wk = recent.slice(0, 7).reduce((a, b) => a + b.v, 0);
  const wkStats = exerciseStats(wk);

  return (
    <div className="pb-2">
      <TopBar title="Exercise" onBack={() => go({ name: 'tab', id: 'insights' })} icon={<span>🏃</span>} sub="Sweat today, shine tomorrow" />
      <div className="px-4 space-y-4">
        <Segmented options={[{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }] as { id: Range; label: string }[]} value={range} onChange={v => setRange(v)} />

        <section className="nnh-card p-5 flex items-center gap-4 relative overflow-hidden">
          <span className="absolute -right-8 -top-8 w-32 h-32 rounded-full" style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.16), transparent 70%)' }} aria-hidden="true" />
          <div className="flex-1">
            <p className="text-[34px] font-extrabold leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              <CountUp value={todayVal} /> <span className="text-[16px] font-bold" style={{ color: 'var(--nnh-sub)' }}>minutes</span>
            </p>
            <p className="text-[12px] font-semibold mt-1.5" style={{ color: 'var(--nnh-sub)' }}>Goal: {goal} min</p>
            <div className="flex gap-2 mt-3">
              <motion.button whileTap={reduced ? undefined : { scale: 0.88 }} type="button" onClick={() => bump(ex, -5)} aria-label="Fewer minutes"
                className="w-9 h-9 rounded-full grid place-items-center" style={{ background: 'var(--nnh-card-soft)' }}><Minus size={15} /></motion.button>
              {[10, 20, 30].map(m => (
                <motion.button key={m} whileTap={reduced ? undefined : { scale: 0.94 }} type="button" onClick={() => bump(ex, m)}
                  className="h-9 px-3.5 rounded-full text-white text-[12px] font-extrabold" style={{ background: 'linear-gradient(92deg, #157F52, #16a34a)' }}>
                  +{m}
                </motion.button>
              ))}
            </div>
          </div>
          <Ring size={84} stroke={9} pct={pct} from="#6FCF97" to="#16a34a">
            <span className="nnh-display text-[18px] font-extrabold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}><CountUp value={Math.round(pct * 100)} />%</span>
          </Ring>
        </section>

        <section className="nnh-card p-4">
          <p className="text-[14px] font-bold mb-3">Minutes {range === 'day' ? 'per day' : range === 'week' ? 'by week (total)' : 'by month (avg)'}</p>
          <WeekBars data={bars} colorFrom="#6FCF97" colorTo="#16a34a" max={Math.max(45, goal)} height={130} suffix="m" reduced={reduced} />
        </section>

        <div className="grid grid-cols-3 gap-3">
          <StatTile value={<CountUp value={recent.length} />} label="Workouts (7d)" accent="#157F52" />
          <StatTile value={<CountUp value={wkStats.kcal} />} label="Calories" accent="#D9822F" />
          <StatTile value={<><CountUp value={wkStats.km} decimals={1} /></>} label="Distance km" accent="#7C5F9E" />
        </div>

        <section className="nnh-card p-4">
          <p className="text-[14px] font-bold mb-2.5">Recent Activities</p>
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {recent.map((r, i) => (
                <motion.div key={r.day} layout initial={reduced ? false : { opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: 'var(--nnh-card-soft)' }}>
                  <span className="w-9 h-9 rounded-xl grid place-items-center text-lg" style={{ background: 'color-mix(in srgb, #157F52 18%, transparent)' }}>🏃</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold">Running</p>
                    <p className="text-[11px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>{r.v} min · {r.km} km · {r.kcal} kcal</p>
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: 'var(--nnh-sub)' }}>{r.label}</span>
                  <ChevronRight size={14} style={{ color: 'var(--nnh-sub)' }} />
                </motion.div>
              ))}
            </AnimatePresence>
            {!recent.length && <p className="text-[12px] text-center py-3" style={{ color: 'var(--nnh-sub)' }}>No workouts this week — you've got this 💪</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
