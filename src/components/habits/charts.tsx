import { useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type BarDatum = { label: string; value: number; hint?: string; today?: boolean; muted?: boolean };

/**
 * Interactive bar chart. Values come straight from the caller (never invented);
 * bars are focusable buttons so the tooltip is keyboard reachable too.
 */
export function InteractiveBars({ data, height = 132, suffix = '', max, from = '#7C5F9E', to = '#A34054', formatValue }: {
  data: BarDatum[];
  height?: number;
  suffix?: string;
  max?: number;
  from?: string;
  to?: string;
  formatValue?: (v: number) => string;
}) {
  const reduced = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const [active, setActive] = useState<number | null>(null);
  const top = max ?? Math.max(1, ...data.map(d => d.value));
  const fmt = formatValue ?? ((v: number) => `${Math.round(v * 10) / 10}${suffix}`);
  const selected = active != null ? data[active] : null;

  return (
    <div className="relative select-none" style={{ paddingTop: 22 }}>
      {/* tooltip */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
        <motion.span
          initial={false}
          animate={{ opacity: selected ? 1 : 0, y: selected ? 0 : 4 }}
          className="rounded-full px-2.5 py-1 text-[10px] font-extrabold text-white"
          style={{ background: 'var(--nnh-ink)' }}
          aria-live="polite"
        >
          {selected ? `${selected.hint ?? selected.label} · ${fmt(selected.value)}` : '—'}
        </motion.span>
      </div>

      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => {
          const h = Math.max(5, (d.value / top) * (height - 26));
          const isActive = active === i;
          return (
            <button
              key={`${d.label}-${i}`}
              type="button"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(a => (a === i ? null : a))}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(a => (a === i ? null : a))}
              onClick={() => setActive(i)}
              aria-label={`${d.hint ?? d.label}: ${fmt(d.value)}`}
              aria-pressed={isActive}
              className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-lg focus-visible:outline-none"
            >
              <span className="text-[9px] font-bold tabular-nums" style={{ color: isActive ? 'var(--nnh-violet)' : 'var(--nnh-sub)' }}>
                {d.value > 0 ? Math.round(d.value) : ''}
              </span>
              <motion.span
                initial={reduced ? false : { height: 0 }}
                animate={{ height: d.value > 0 ? h : 5, opacity: isActive ? 1 : 0.92 }}
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 150, damping: 22, delay: i * 0.03 }}
                className="w-full rounded-full"
                style={{
                  background: d.value > 0
                    ? `linear-gradient(180deg, ${from}, ${to})`
                    : 'var(--nnh-line)',
                  boxShadow: d.today ? `0 6px 16px -6px ${from}` : isActive ? `0 4px 12px -6px ${to}` : undefined,
                  maxWidth: 34,
                }}
              />
              <span className={cn('text-[9px] font-bold', d.today ? '' : '')}
                style={{ color: d.today ? 'var(--nnh-violet)' : 'var(--nnh-sub)' }}>
                {d.label}
              </span>
            </button>
          );
        })}
      </div>
      <span id={`bars-${uid}`} className="sr-only">
        {data.map(d => `${d.hint ?? d.label} ${fmt(d.value)}`).join(', ')}
      </span>
    </div>
  );
}

/** 35-day consistency grid; each cell's intensity is that day's real completion. */
export function ConsistencyHeatmap({ days }: { days: { day: string; pct: number; label: string }[] }) {
  const reduced = useReducedMotion();
  return (
    <div className="grid grid-cols-7 gap-1.5" role="img"
      aria-label={`Consistency: ${days.filter(d => d.pct > 0).length} active days out of ${days.length}`}>
      {days.map((d, i) => (
        <motion.div
          key={d.day}
          initial={reduced ? false : { opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: reduced ? 0 : Math.min(i, 30) * 0.008, duration: 0.22 }}
          title={`${d.label}: ${d.pct}%`}
          className="aspect-square rounded-[5px]"
          style={{
            background: d.pct === 0
              ? 'var(--nnh-line)'
              : d.pct < 50
                ? 'color-mix(in srgb, var(--nnh-purple) 28%, var(--nnh-card))'
                : d.pct < 100
                  ? 'color-mix(in srgb, var(--nnh-purple) 62%, var(--nnh-card))'
                  : 'var(--nnh-purple)',
          }}
        />
      ))}
    </div>
  );
}

export function ProgressBar({ pct, color = 'var(--nnh-purple)', height = 6 }: { pct: number; color?: string; height?: number }) {
  const reduced = useReducedMotion();
  return (
    <div className="overflow-hidden rounded-full nnh-track" style={{ height }} aria-hidden="true">
      <motion.div className="h-full rounded-full" initial={false}
        animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 90, damping: 20 }}
        style={{ background: color }} />
    </div>
  );
}

/** Animated SVG trend line. Points are real percentages; the draw-in never invents data. */
export function TrendLine({ points, height = 96, from = '#7C5F9E', to = '#A34054', label }: {
  points: { label: string; value: number }[];
  height?: number;
  from?: string;
  to?: string;
  label: string;
}) {
  const reduced = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const w = 300;
  const h = height;
  const pad = 8;
  const max = Math.max(100, ...points.map(p => p.value));
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const xy = points.map((p, i) => ({
    x: pad + i * step,
    y: h - pad - (Math.min(p.value, max) / max) * (h - pad * 2),
  }));
  const path = xy.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${path} L${(pad + (points.length - 1) * step).toFixed(1)} ${h - pad} L${pad} ${h - pad} Z`;
  const last = xy[xy.length - 1];

  return (
    <div role="img" aria-label={`${label}: ${points.map(p => `${p.label} ${p.value}%`).join(', ')}`}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`trend-line-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={from} /><stop offset="100%" stopColor={to} />
          </linearGradient>
          <linearGradient id={`trend-area-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={from} stopOpacity="0.22" /><stop offset="100%" stopColor={to} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1={pad} x2={w - pad} y1={h * f} y2={h * f} stroke="var(--nnh-line)" strokeWidth="1" strokeDasharray="2 4" />
        ))}
        <motion.path d={area} fill={`url(#trend-area-${uid})`} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} />
        <motion.path d={path} fill="none" stroke={`url(#trend-line-${uid})`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
          initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease: 'easeOut' }} />
        {last && <circle cx={last.x} cy={last.y} r="3.6" fill={to} stroke="var(--nnh-card)" strokeWidth="2" />}
      </svg>
      <div className="mt-1 flex justify-between text-[9px] font-bold" aria-hidden="true" style={{ color: 'var(--nnh-sub)' }}>
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}
