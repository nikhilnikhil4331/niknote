import { ReactNode, useEffect, useRef, useState, useId } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { spring } from '@/lib/motion';

/* ── Animated progress ring ── */
export function Ring({ size = 64, stroke = 7, pct, from = '#8b5cf6', to = '#ec4899', track, children, className }: {
  size?: number; stroke?: number; pct: number; from?: string; to?: string; track?: string; children?: ReactNode; className?: string;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return (
    <div className={cn('relative grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} /><stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track || 'var(--nnh-line)'} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={C}
          initial={false}
          animate={{ strokeDashoffset: C * (1 - p) }}
          transition={reduced ? { duration: 0 } : spring.gentle}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/* ── Counting number ── */
export function CountUp({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const reduced = useReducedMotion();
  const [disp, setDisp] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (reduced || prev.current === value) { prev.current = value; setDisp(value); return; }
    const from = prev.current; const start = performance.now(); const dur = 650;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setDisp(from + (value - from) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    prev.current = value;
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);
  return <span className={cn('tabular-nums', className)}>{disp.toFixed(decimals)}</span>;
}

/* ── Segmented control with sliding pill ── */
export function Segmented<T extends string>({ options, value, onChange, className }: {
  options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; className?: string;
}) {
  const layoutId = useId();
  return (
    <div className={cn('flex p-1 rounded-full', className)} style={{ background: 'var(--nnh-card-soft)' }}>
      {options.map(o => {
        const on = o.id === value;
        return (
          <button key={o.id} type="button" onClick={() => onChange(o.id)} aria-pressed={on}
            className={cn('relative min-h-[40px] flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors', on ? 'text-white' : 'text-[var(--nnh-sub)]')}>
            {on && <motion.span className="absolute inset-0 rounded-full nnh-gradient-btn" layoutId={layoutId} initial={false} transition={spring.snappy} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Screen header ── */
export function TopBar({ title, icon, onBack, right, sub }: { title: string; icon?: ReactNode; onBack?: () => void; right?: ReactNode; sub?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-4 pb-2">
      {onBack && (
        <motion.button whileTap={{ scale: 0.88 }} type="button" onClick={onBack} aria-label="Go back"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full nnh-card">
          <ArrowLeft size={18} />
        </motion.button>
      )}
      <div className="flex-1 min-w-0 text-center">
        <h1 className="truncate text-[17px] font-extrabold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {icon} {title}
        </h1>
        {sub && <p className="text-[11px] truncate" style={{ color: 'var(--nnh-sub)' }}>{sub}</p>}
      </div>
      {right ?? (onBack ? <div className="w-11 shrink-0" aria-hidden="true" /> : null)}
    </div>
  );
}

/* ── Navigation types (shared with FloatingNav) ── */
export type TabId = 'home' | 'habits' | 'insights' | 'profile';

/* ── Weekly bar row (gradient bars, staggered grow-in) ── */
export function WeekBars({ data, colorFrom, colorTo, height = 96, max, suffix = '', reduced }: {
  data: { label: string; value: number; hint?: string; today?: boolean }[];
  colorFrom: string; colorTo: string; height?: number; max?: number; suffix?: string; reduced?: boolean;
}) {
  const m = max ?? Math.max(1, ...data.map(d => d.value));
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.max(6, (d.value / m) * (height - 22));
        return (
          <div key={d.label + i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className="text-[9px] font-bold tabular-nums" style={{ color: 'var(--nnh-sub)' }}>{d.value > 0 ? `${Math.round(d.value)}${suffix}` : ''}</span>
            <motion.div
              initial={reduced ? false : { height: 0 }}
              animate={{ height: d.value > 0 ? h : 5 }}
              transition={{ delay: reduced ? 0 : i * 0.05, ...spring.gentle }}
              className="w-full rounded-full"
              style={{
                background: d.value > 0 ? `linear-gradient(180deg, ${colorFrom}, ${colorTo})` : 'var(--nnh-line)',
                boxShadow: d.today && d.value > 0 ? `0 4px 14px -4px ${colorFrom}` : undefined,
              }}
            />
            <span className={cn('text-[9px] font-semibold', d.today ? 'text-[var(--nnh-purple)]' : '')} style={d.today ? undefined : { color: 'var(--nnh-sub)' }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Bottom sheet ── */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="absolute inset-0 z-40 bg-black/35" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="absolute inset-x-2 z-50 max-h-[78%] overflow-y-auto rounded-[1.6rem] p-4 nnh-card nnh-scroll"
            style={{ bottom: 'calc(8px + env(safe-area-inset-bottom, 0px))', background: 'var(--nnh-card)' }}
            initial={{ y: '110%' }} animate={{ y: 0 }} exit={{ y: '110%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            role="dialog" aria-modal="true" aria-label={title}
          >
            <div className="w-10 h-1.5 rounded-full mx-auto mb-3" style={{ background: 'var(--nnh-line)' }} />
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-[15px]">{title}</h2>
              <button type="button" onClick={onClose} className="min-h-[36px] rounded-full px-3.5 py-1.5 text-xs font-semibold" style={{ background: 'var(--nnh-card-soft)', color: 'var(--nnh-sub)' }}>Close</button>
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Toggle switch ── */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={cn('w-11 rounded-full p-0.5 transition-colors flex items-center', on ? 'nnh-gradient-btn justify-end' : 'justify-start')}
      style={{ height: 26, background: on ? undefined : 'var(--nnh-line)', width: 46 }}>
      <motion.span layout className="block rounded-full bg-white shadow" style={{ width: 22, height: 22 }} transition={spring.snappy} />
    </button>
  );
}

/* ── Mini water glass for the home card ── */
export function MiniGlass({ pct, color = '#0ea5e9', size = 44 }: { pct: number; color?: string; size?: number }) {
  const p = Math.max(0, Math.min(1, pct));
  const top = 8, bottom = 56;
  const level = top + (1 - p) * (bottom - top) - 4;
  return (
    <svg viewBox="0 0 40 60" width={size} height={size * 1.5} aria-hidden="true">
      <defs>
        <clipPath id={`mg-${color.replace('#', '')}`}><path d="M8 6 H32 L28.5 52 Q28 56 24 56 H16 Q12 56 11.5 52 Z" /></clipPath>
        <linearGradient id={`mgg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.75" /><stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>
      <path d="M8 6 H32 L28.5 52 Q28 56 24 56 H16 Q12 56 11.5 52 Z" fill={color} opacity="0.12" />
      <g clipPath={`url(#mg-${color.replace('#', '')})`}>
        <motion.g initial={false} animate={{ y: level }} transition={{ type: 'spring', stiffness: 60, damping: 13 }}>
          <rect x="0" y="0" width="40" height="80" fill={`url(#mgg-${color.replace('#', '')})`} />
          <path d="M0 0 Q5 -3 10 0 T20 0 T30 0 T40 0 V-4 H0 Z" fill="#ffffff" opacity="0.5" />
        </motion.g>
      </g>
      <path d="M8 6 H32 L28.5 52 Q28 56 24 56 H16 Q12 56 11.5 52 Z" fill="none" stroke={color} strokeWidth="2" opacity="0.8" />
    </svg>
  );
}

/* ── Stat tile ── */
export function StatTile({ value, label, accent, icon }: { value: ReactNode; label: string; accent: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl p-3 text-center" style={{ background: 'var(--nnh-card-soft)' }}>
      <div className="text-lg font-extrabold tabular-nums flex items-center justify-center gap-1" style={{ color: accent, fontFamily: "'Space Grotesk', sans-serif" }}>
        {icon}{value}
      </div>
      <div className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--nnh-sub)' }}>{label}</div>
    </div>
  );
}
