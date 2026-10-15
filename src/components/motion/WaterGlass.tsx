import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import { waterProgress } from '@/lib/trackers';

const TOP = 10, BOTTOM = 152;
const GLASS = 'M14 10 L106 10 L95 146 Q94 152 87 152 L33 152 Q26 152 25 146 Z';
// Two periods of a sine wave so translating by one period loops seamlessly.
const WAVE = 'M0 8 Q15 0 30 8 T60 8 T90 8 T120 8 T150 8 T180 8 T210 8 T240 8 V200 H0 Z';

/** Animated glass of water: level rises with each glass, waves keep moving, bubbles float up. */
export function WaterGlass({ glasses, goal, onChange }: { glasses: number; goal: number; onChange: (next: number) => void }) {
  const reduced = useReducedMotion();
  const p = waterProgress(glasses, goal);
  const level = TOP + (1 - p.ratio) * (BOTTOM - TOP) - 8;
  const [splash, setSplash] = useState(0);
  const prevDone = useRef(p.done);
  const [cheer, setCheer] = useState(false);

  useEffect(() => {
    if (p.done && !prevDone.current) { setCheer(true); const t = window.setTimeout(() => setCheer(false), 2200); prevDone.current = p.done; return () => window.clearTimeout(t); }
    prevDone.current = p.done;
  }, [p.done]);

  const add = (d: number) => { if (d > 0) setSplash(s => s + 1); onChange(Math.max(0, glasses + d)); };

  return (
    <div className="nn-water">
      <div className="nn-water-stage">
        <svg viewBox="0 0 120 160" className="nn-water-svg" role="img" aria-label={`${p.drunk} of ${p.goal} glasses of water`}>
          <defs>
            <clipPath id="nn-glass-clip"><path d={GLASS} /></clipPath>
            <linearGradient id="nn-water-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="nn-water-stop-top" />
              <stop offset="100%" className="nn-water-stop-bottom" />
            </linearGradient>
          </defs>
          <path d={GLASS} className="nn-water-glass-bg" />
          <g clipPath="url(#nn-glass-clip)">
            <motion.g initial={false} animate={{ y: level }} transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 60, damping: 12 }}>
              <g className="nn-wave nn-wave-back"><path d={WAVE} className="nn-water-back" /></g>
              <g className="nn-wave nn-wave-front"><path d={WAVE} fill="url(#nn-water-grad)" /></g>
            </motion.g>
            {!reduced && p.drunk > 0 && [18, 46, 72, 92].map((x, i) => (
              <circle key={x} cx={x + 6} cy={150} r={i % 2 ? 2 : 3} className="nn-bubble" style={{ animationDelay: `${i * 0.7}s` }} />
            ))}
            <AnimatePresence>
              {!reduced && splash > 0 && (
                <motion.circle key={splash} cx={60} cy={level + 8} r={4} className="nn-splash" initial={{ r: 4, opacity: 0.8 }} animate={{ r: 40, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} />
              )}
            </AnimatePresence>
          </g>
          <path d={GLASS} className="nn-water-glass" />
          <path d="M22 22 L30 136" className="nn-water-shine" />
        </svg>
        <AnimatePresence>
          {!reduced && splash > 0 && (
            <motion.span key={`drop-${splash}`} className="nn-drop" initial={{ y: -36, opacity: 0, scale: 0.6 }} animate={{ y: 30, opacity: [0, 1, 0], scale: 1 }} transition={{ duration: 0.6 }} aria-hidden="true" />
          )}
        </AnimatePresence>
        <div className="nn-water-readout">
          <motion.strong key={p.drunk} initial={reduced ? false : { scale: 1.35 }} animate={{ scale: 1 }}>{Math.round(p.ratio * 100)}%</motion.strong>
        </div>
      </div>
      <div className="nn-water-info">
        <p className="nn-water-big"><b>{p.drunk}</b> / {p.goal} glasses</p>
        <p className="nn-water-small">{(p.drunkMl / 1000).toFixed(2)} L drunk · {p.done ? 'Goal reached! 🎉' : `${p.left} more to go (${((p.goalMl - p.drunkMl) / 1000).toFixed(2)} L)`}</p>
        <div className="nn-water-btns">
          <button type="button" onClick={() => add(-1)} disabled={p.drunk === 0} aria-label="Remove a glass"><Minus size={16} /></button>
          <motion.button type="button" whileTap={reduced ? undefined : { scale: 0.9 }} onClick={() => add(1)} className="nn-water-add" aria-label="Drink a glass"><Plus size={16} /> 1 glass</motion.button>
        </div>
      </div>
      <AnimatePresence>
        {cheer && (
          <motion.div className="nn-water-cheer" initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} role="status">
            💧 Well done — you hit today's water goal!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
