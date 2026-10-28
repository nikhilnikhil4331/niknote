// ============================================================
// NikNote — Focus Insights (category donut from real sessions)
// ============================================================

import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import { useFocusSessions, FOCUS_CATEGORIES } from '../store';
import { focusDistribution, formatMinutesAsHours, lastNDays } from '@/lib/productivity';
import { cn } from '@/lib/utils';

const PERIODS = [
  { id: '7', label: '7 days', days: 7 },
  { id: '30', label: '30 days', days: 30 },
  { id: 'all', label: 'All time', days: 0 },
] as const;

const colorFor = (cat: string, i: number) =>
  FOCUS_CATEGORIES.find((c) => c.name === cat)?.color ?? ['#8B5CF6', '#06B6D4', '#F26D9B'][i % 3];

export const FocusInsights: React.FC = () => {
  const { sessions } = useFocusSessions();
  const reduced = useReducedMotion();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('7');

  const dist = useMemo(() => {
    const p = PERIODS.find((x) => x.id === period)!;
    if (p.days === 0) return focusDistribution(sessions);
    const allowed = new Set(lastNDays(p.days));
    return focusDistribution(
      sessions.filter((s) => {
        const d = new Date(s.startedAt);
        if (Number.isNaN(d.getTime())) return false;
        return allowed.has(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        );
      }),
    );
  }, [sessions, period]);

  const totalMin = dist.reduce((a, b) => a + b.minutes, 0);

  return (
    <div className="nd-card p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[13.5px] font-bold" style={{ color: 'var(--nd-ink)' }}>Focus Insights</h3>
        <div className="nd-vtabs !p-[2px]">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              className={cn('!py-1 !px-2 !text-[10.5px]', period === p.id && 'nd-on')}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {dist.length === 0 ? (
        <div className="text-center py-6">
          <div className="text-[26px]" aria-hidden>🍅</div>
          <p className="text-[12px] font-semibold mt-1.5" style={{ color: 'var(--nd-ink-2)' }}>
            No focus sessions in this period yet.
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--nd-text-3)' }}>
            Completed timer sessions will chart here.
          </p>
        </div>
      ) : (
        <>
          <div style={{ width: '100%', height: 168, position: 'relative' }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={dist}
                  dataKey="minutes"
                  nameKey="category"
                  innerRadius="68%"
                  outerRadius="96%"
                  paddingAngle={3}
                  strokeWidth={0}
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive={!reduced}
                  animationDuration={600}
                >
                  {dist.map((d, i) => (
                    <Cell key={d.category} fill={colorFor(d.category, i)} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as (typeof dist)[number];
                    return (
                      <div className="nd-chart-tip">
                        <b style={{ color: colorFor(d.category, 0) }}>{d.category}</b>
                        <div style={{ color: 'var(--nd-ink-2)' }}>
                          {formatMinutesAsHours(d.minutes)} · {d.pct}%
                        </div>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div
              className="absolute inset-0 grid place-items-center pointer-events-none"
              aria-hidden="true"
            >
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--nd-text-3)' }}>Total</div>
                <div className="text-[19px] font-extrabold" style={{ color: 'var(--nd-ink)' }}>
                  {formatMinutesAsHours(totalMin)}
                </div>
              </div>
            </div>
          </div>
          <ul className="mt-1 space-y-1">
            {dist.map((d, i) => (
              <li key={d.category} className="flex items-center gap-2 text-[12px]">
                <span className="rounded-full flex-none" style={{ width: 8, height: 8, background: colorFor(d.category, i) }} />
                <span className="font-semibold flex-1 truncate" style={{ color: 'var(--nd-ink-2)' }}>{d.category}</span>
                <span className="font-bold tabular-nums" style={{ color: 'var(--nd-ink)' }}>{d.pct}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default FocusInsights;
