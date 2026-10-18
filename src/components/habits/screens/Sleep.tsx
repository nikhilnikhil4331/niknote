import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BedDouble, Minus, Plus, Sun } from 'lucide-react';
import { useRoutine } from '@/components/habits/RoutineProvider';
import { CountUp, Ring, Segmented, TopBar, WeekBars } from '@/components/habits/ui';
import { sleepMinutes, toDay } from '@/lib/trackers';
import { haptic } from '@/hooks/useHaptics';

type Range = 'day' | 'week' | 'month';

export function SleepScreen({ go }: { go: (s: { name: string; id?: string }) => void }) {
  const { state, today, setEntry, setSleepTime, bump } = useRoutine();
  const reduced = useReducedMotion();
  const [range, setRange] = useState<Range>('day');
  const sleep = state.habits.find(h => h.type === 'sleep' && !h.archived);
  const now = new Date();

  const todayVal = sleep ? state.entries[`${sleep.id}|${today}`]?.v ?? 0 : 0;
  const goal = sleep?.target ?? 8;
  const times = state.sleepTimes[today] ?? {};
  const computed = sleepMinutes(times.bed ?? '', times.wake ?? '');
  const shown = times.bed && times.wake && computed != null ? Math.round((computed / 60) * 10) / 10 : todayVal;

  const bars = useMemo(() => {
    if (!sleep) return [];
    if (range === 'day') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
        const day = toDay(d);
        return { label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), value: state.entries[`${sleep.id}|${day}`]?.v ?? 0, today: i === 6 };
      });
    }
    if (range === 'week') {
      return Array.from({ length: 4 }, (_, i) => {
        const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i * 7));
        let sum = 0;
        for (let k = 0; k < 7; k++) {
          const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - k);
          sum += state.entries[`${sleep.id}|${toDay(d)}`]?.v ?? 0;
        }
        return { label: `W${i + 1}`, value: Math.round(sum / 7 * 10) / 10, today: i === 3 };
      });
    }
    return Array.from({ length: 12 }, (_, i) => {
      const base = new Date(now.getFullYear(), now.getMonth() - (11 - i), 15);
      let sum = 0, n = 0;
      for (let k = 0; k < 30; k++) {
        const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + k);
        if (d > now) break;
        sum += state.entries[`${sleep.id}|${toDay(d)}`]?.v ?? 0;
        n++;
      }
      return { label: base.toLocaleDateString(undefined, { month: 'short' }).slice(0, 1), value: n ? Math.round((sum / n) * 10) / 10 : 0, today: i === 11 };
    });
  }, [range, state.entries, sleep]);

  if (!sleep) {
    return (
      <div className="pb-32">
        <TopBar title="Sleep" onBack={() => go({ name: 'tab', id: 'insights' })} icon={<span>🌙</span>} />
        <p className="text-center text-[13px] mt-16 px-8" style={{ color: 'var(--nnh-sub)' }}>Add a Sleep habit to track your nights 🌙</p>
      </div>
    );
  }

  const pct = Math.min(1, shown / goal);
  const fmtHM = (m: number | null) => m == null ? '—' : `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim();

  return (
    <div className="pb-10">
      <TopBar title="Sleep" onBack={() => go({ name: 'tab', id: 'insights' })} icon={<span>🌙</span>}
        sub="Rest is productivity too" />
      <div className="px-4 space-y-4">
        <Segmented options={[{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }] as { id: Range; label: string }[]} value={range} onChange={v => setRange(v)} />

        <section className="nnh-card p-5 flex items-center gap-4 relative overflow-hidden">
          <span className="absolute -right-8 -top-8 w-32 h-32 rounded-full" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.18), transparent 70%)' }} aria-hidden="true" />
          <div className="flex-1">
            <p className="text-[34px] font-extrabold leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              <CountUp value={shown} decimals={1} /> <span className="text-[16px] font-bold" style={{ color: 'var(--nnh-sub)' }}>hours</span>
            </p>
            <p className="text-[12px] font-semibold mt-1.5" style={{ color: 'var(--nnh-sub)' }}>Goal: {goal}h</p>
            <div className="flex gap-2 mt-3">
              <motion.button whileTap={reduced ? undefined : { scale: 0.88 }} type="button" onClick={() => bump(sleep, -0.5)} aria-label="Less sleep"
                className="w-9 h-9 rounded-full grid place-items-center" style={{ background: 'var(--nnh-card-soft)' }}><Minus size={15} /></motion.button>
              <motion.button whileTap={reduced ? undefined : { scale: 0.94 }} type="button" onClick={() => bump(sleep, 0.5)}
                className="h-9 px-4 rounded-full nnh-gradient-btn text-white text-[12px] font-bold flex items-center gap-1"><Plus size={14} /> 30 min</motion.button>
            </div>
          </div>
          <Ring size={84} stroke={9} pct={pct} from="#a78bfa" to="#6366f1">
            <span className="text-[18px] font-extrabold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}><CountUp value={Math.round(pct * 100)} />%</span>
          </Ring>
        </section>

        <section className="nnh-card p-4">
          <p className="text-[14px] font-bold mb-3">Sleep {range === 'day' ? 'per night' : range === 'week' ? 'by week (avg)' : 'by month (avg)'}</p>
          <WeekBars data={bars} colorFrom="#a78bfa" colorTo="#6366f1" max={10} height={130} suffix="h" reduced={reduced} />
        </section>

        {/* summary */}
        <section className="nnh-card p-4">
          <p className="text-[14px] font-bold mb-3">Sleep Summary</p>
          <div className="grid grid-cols-3 gap-2">
            <label className="rounded-2xl p-3 text-center" style={{ background: 'var(--nnh-card-soft)' }}>
              <BedDouble size={16} className="mx-auto" style={{ color: '#8b5cf6' }} />
              <input type="time" value={times.bed ?? ''} onChange={e => { haptic('light'); setSleepTime(today, 'bed', e.target.value); }}
                className="mt-2 w-full bg-transparent text-center text-[15px] font-extrabold outline-none" style={{ color: 'var(--nnh-ink)', fontFamily: "'Space Grotesk', sans-serif" }} aria-label="Bed time" />
              <span className="text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>Bed time</span>
            </label>
            <label className="rounded-2xl p-3 text-center" style={{ background: 'var(--nnh-card-soft)' }}>
              <Sun size={16} className="mx-auto" style={{ color: '#f59e0b' }} />
              <input type="time" value={times.wake ?? ''} onChange={e => { haptic('light'); setSleepTime(today, 'wake', e.target.value); }}
                className="mt-2 w-full bg-transparent text-center text-[15px] font-extrabold outline-none" style={{ color: 'var(--nnh-ink)', fontFamily: "'Space Grotesk', sans-serif" }} aria-label="Wake time" />
              <span className="text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>Wake up</span>
            </label>
            <div className="rounded-2xl p-3 text-center" style={{ background: 'linear-gradient(160deg, #ede9fe, #fce7f3)' }}>
              <MoonIcon />
              <p className="mt-2 text-[15px] font-extrabold" style={{ color: '#6d28d9', fontFamily: "'Space Grotesk', sans-serif" }}>{fmtHM(computed) || `${shown} h`}</p>
              <span className="text-[10px] font-semibold" style={{ color: 'var(--nnh-sub)' }}>Total sleep</span>
            </div>
          </div>
          <p className="text-[11px] font-medium mt-3 text-center" style={{ color: 'var(--nnh-sub)' }}>
            {shown >= goal ? 'Fully recharged — well rested ⚡' : `Add ${Math.max(0, goal - shown).toFixed(1).replace('.0', '')}h to hit your goal 🌙`}
          </p>
        </section>
      </div>
    </div>
  );
}

function MoonIcon() {
  return <span className="text-[16px]">🌙</span>;
}
