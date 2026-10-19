import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const GLASS = 'M18 12 L142 12 L130 196 Q129 206 118 206 L42 206 Q31 206 30 196 Z';
const WAVE = 'M0 10 Q10 2 20 10 T40 10 T60 10 T80 10 T100 10 T120 10 T140 10 T160 10 T180 10 T200 10 T220 10 T240 10 V240 H0 Z';

/** Large animated glass: two travelling wave layers, rising level, bubbles, splash on add. */
export function BigWaterGlass({ glasses, goal, onAdd, onRemove }: {
  glasses: number; goal: number; onAdd: () => void; onRemove: () => void;
}) {
  const reduced = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const p = Math.max(0, Math.min(1, glasses / goal));
  const TOP = 22, BOTTOM = 196;
  const level = TOP + (1 - p) * (BOTTOM - TOP) - 10;
  const [splash, setSplash] = useState(0);
  const prevDone = useRef(p >= 1);

  useEffect(() => {
    if (p >= 1 && !prevDone.current) {
      if (!reduced) confettiMini();
      prevDone.current = true;
    } else if (p < 1) prevDone.current = false;
  }, [p, reduced]);

  const add = () => { setSplash(x => x + 1); onAdd(); };

  return (
    <div className="relative mx-auto" style={{ width: 210 }}>
      <svg viewBox="0 0 160 220" className="w-full drop-shadow-xl" role="img" aria-label={`${glasses} of ${goal} glasses`}>
        <defs>
          <clipPath id={`nnh-glass-clip-${uid}`}><path d={GLASS} /></clipPath>
          <linearGradient id={`nnh-water-grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        <path d={GLASS} fill="#7dd3fc" opacity="0.14" />
        <g clipPath={`url(#nnh-glass-clip-${uid})`}>
          <motion.g initial={false} animate={{ y: level }} transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 55, damping: 12 }}>
            <g className={reduced ? '' : 'nnh-anim-wave-back'}><path d={WAVE} fill="#7dd3fc" opacity="0.45" /></g>
            <g className={reduced ? '' : 'nnh-anim-wave'}><path d={WAVE} fill="url(#nnh-water-grad-${uid})" /></g>
            <path d={WAVE} fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2" className={reduced ? '' : 'nnh-anim-wave'} />
          </motion.g>
          {!reduced && glasses > 0 && [42, 66, 92, 114].map((x, i) => (
            <circle key={x} cx={x} cy={198} r={i % 2 ? 2.5 : 3.5} fill="#ffffff" opacity="0.6" className="nnh-bubble" style={{ animationDelay: `${i * 0.8}s` }} />
          ))}
          <AnimatePresence>
            {!reduced && splash > 0 && (
              <motion.circle key={splash} cx={80} cy={level + 12} r={5} fill="#ffffff"
                initial={{ r: 5, opacity: 0.8 }} animate={{ r: 48, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.7 }} />
            )}
          </AnimatePresence>
        </g>
        <path d={GLASS} fill="none" stroke="#bae6fd" strokeWidth="4" strokeLinejoin="round" />
        <path d="M30 30 L40 180" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity="0.35" />
        <motion.g initial={false} animate={reduced ? {} : { opacity: [0.35, 1, 0.35] }} transition={{ duration: 2.4, repeat: Infinity }}>
          <path d="M146 44 q10 -8 4 -16 q-2 10 -4 8" fill="none" stroke="#7dd3fc" strokeWidth="3" strokeLinecap="round" />
        </motion.g>
      </svg>

      {/* center readout */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: 26 }}>
        <motion.strong key={Math.round(p * 100)} initial={reduced ? false : { scale: 1.25 }} animate={{ scale: 1 }}
          className="text-4xl font-extrabold text-white drop-shadow-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {Math.round(p * 100)}%
        </motion.strong>
      </div>

      {/* droplet falling on add */}
      <AnimatePresence>
        {!reduced && splash > 0 && (
          <motion.span key={`drop-${splash}`} initial={{ y: -46, opacity: 0, scale: 0.5 }} animate={{ y: 14, opacity: [0, 1, 0], scale: 1 }}
            transition={{ duration: 0.55 }} style={{ x: '-50%' }} className="absolute left-1/2 top-0 text-2xl" aria-hidden="true">💧</motion.span>
        )}
      </AnimatePresence>

      {/* tap to drink */}
      <motion.button whileTap={reduced ? undefined : { scale: 0.92 }} type="button" onClick={add} aria-label="Drink a glass"
        className="absolute -right-1 bottom-6 w-12 h-12 rounded-full bg-white shadow-lg grid place-items-center text-xl">
        💧
      </motion.button>
      <motion.button whileTap={reduced ? undefined : { scale: 0.92 }} type="button" onClick={onRemove} aria-label="Remove a glass"
        disabled={glasses <= 0} className="absolute -left-1 bottom-6 w-10 h-10 rounded-full bg-white shadow grid place-items-center text-lg disabled:opacity-40">
        −
      </motion.button>
    </div>
  );
}

function confettiMini() {
  import('canvas-confetti').then(m => m.default({ particleCount: 70, spread: 70, origin: { y: 0.6 }, colors: ['#38bdf8', '#2563eb', '#ffffff'] })).catch(() => {});
}
