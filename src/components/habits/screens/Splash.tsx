import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { haptic } from '@/hooks/useHaptics';

/** Onboarding welcome: pastel lake scene, real Niknote wordmark, one clear action. */
export function Splash({ onEnter, isBack }: { onEnter: () => void; isBack: boolean }) {
  const reduced = useReducedMotion();
  const t = reduced ? { duration: 0 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div className="absolute inset-0 z-40 flex flex-col overflow-hidden">
      {/* sky */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #fbcfe8 0%, #e9d5ff 32%, #c7d2fe 60%, #a5b4fc 100%)' }} />
      <div className="pointer-events-none absolute -left-20 top-24 h-64 w-64 rounded-full nnh-anim-aurora" aria-hidden="true"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.5), transparent 70%)' }} />
      {/* sun */}
      <div className="absolute right-8 top-16 h-20 w-20 rounded-full nnh-anim-pulse" aria-hidden="true"
        style={{ background: 'radial-gradient(circle, #fef3c7 0%, #fcd34d 55%, transparent 72%)', filter: 'blur(2px)' }} />
      {/* clouds */}
      <div className="absolute left-4 top-10 nnh-anim-float-x" style={{ animationDelay: '-2s' }} aria-hidden="true">
        <Cloud w={92} o={0.9} />
      </div>
      <div className="absolute right-10 top-36 nnh-anim-float-x" style={{ animationDelay: '-5s' }} aria-hidden="true">
        <Cloud w={64} o={0.65} />
      </div>
      {/* birds */}
      <svg className="absolute left-1/3 top-24 w-24 nnh-anim-birds" viewBox="0 0 96 24" fill="none" stroke="#7c6ba8" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M4 12 q5 -7 10 0 q5 -7 10 0" /><path d="M48 8 q4 -6 8 0 q4 -6 8 0" /><path d="M72 18 q4 -6 8 0 q4 -6 8 0" />
      </svg>

      {/* mountains + lake + pines */}
      <div className="absolute inset-x-0 bottom-0">
        <svg viewBox="0 0 390 260" className="w-full" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <path d="M0 150 L70 62 L128 140 L190 48 L258 150 L320 84 L390 150 V260 H0 Z" fill="#a78bfa" opacity="0.55" />
          <path d="M0 178 L60 110 L118 176 L185 92 L262 180 L330 118 L390 178 V260 H0 Z" fill="#8b5cf6" opacity="0.65" />
          <rect x="0" y="196" width="390" height="64" fill="#93c5fd" />
          <rect x="0" y="196" width="390" height="64" fill="url(#lakesheen)" />
          <defs>
            <linearGradient id="lakesheen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" /><stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g stroke="#ffffff" strokeLinecap="round" opacity="0.55">
            <path d="M40 212 h46" strokeWidth="3" /><path d="M120 224 h64" strokeWidth="3" /><path d="M230 210 h40" strokeWidth="3" />
            <path d="M74 236 h52" strokeWidth="3" /><path d="M270 232 h58" strokeWidth="3" />
          </g>
          <Pine x={26} y={196} s={1} o={0.95} /><Pine x={72} y={196} s={0.7} o={0.8} />
          <Pine x={332} y={196} s={1} o={0.95} /><Pine x={372} y={196} s={0.72} o={0.8} />
        </svg>
      </div>

      {/* content */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-8 pb-20">
        <span className="absolute left-1/2 top-[12%] -translate-x-[150%] text-2xl nnh-anim-twinkle" aria-hidden="true">✨</span>
        <span className="absolute left-1/2 top-[25%] translate-x-[92%] text-base nnh-anim-twinkle" style={{ animationDelay: '-1s' }} aria-hidden="true">✦</span>
        <span className="absolute left-1/2 top-[8%] translate-x-[130%] text-lg nnh-anim-twinkle" style={{ animationDelay: '-1.8s' }} aria-hidden="true">🌟</span>

        <motion.div initial={reduced ? false : { opacity: 0, scale: 0.9, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...t, delay: 0.1 }} className="drop-shadow-[0_14px_34px_rgba(124,58,237,0.28)]">
          <img src="/niknote-logo.png" alt="Niknote" draggable={false}
            className="h-auto w-[248px] max-w-[72vw] select-none object-contain" />
        </motion.div>

        <motion.p initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...t, delay: 0.3 }}
          className="mt-3 text-center text-[16px] font-semibold leading-relaxed text-[#5b4a86]">
          Better Habits,<br />A Brighter You
        </motion.p>

        <motion.div initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : 0.42 }}
          className="mt-3 flex items-center gap-1.5" aria-hidden="true">
          {[0, 1, 2].map(i => (
            <span key={i} className="h-1.5 rounded-full" style={{ width: i === 0 ? 18 : 6, background: i === 0 ? '#7c3aed' : 'rgba(124,58,237,0.28)' }} />
          ))}
        </motion.div>

        <motion.button
          whileHover={reduced ? undefined : { scale: 1.03 }} whileTap={reduced ? undefined : { scale: 0.96 }}
          initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...t, delay: 0.5 }}
          onClick={() => { haptic('success'); onEnter(); }}
          className="nnh-gradient-btn relative mt-7 flex items-center gap-2 overflow-hidden rounded-full px-9 py-3.5 text-[15px] font-bold text-white"
        >
          <span className="nnh-shimmer absolute inset-0" aria-hidden="true" />
          <span className="relative flex items-center gap-2">
            {isBack ? 'Continue' : 'Get Started'} <ArrowRight size={17} />
          </span>
        </motion.button>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : 0.7 }}
          className="mt-4 flex items-center gap-1 text-[12px] font-medium text-[#7c6ba8]">
          <Sparkles size={12} /> Small habits. Big changes.
        </motion.p>
      </div>
    </div>
  );
}

function Cloud({ w, o }: { w: number; o: number }) {
  return (
    <svg width={w} height={w * 0.42} viewBox="0 0 100 42" fill="#ffffff" opacity={o} aria-hidden="true">
      <ellipse cx="30" cy="28" rx="26" ry="13" /><ellipse cx="55" cy="20" rx="24" ry="15" /><ellipse cx="76" cy="29" rx="20" ry="11" />
    </svg>
  );
}

function Pine({ x, y, s, o }: { x: number; y: number; s: number; o: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o} aria-hidden="true">
      <rect x="-3" y="-8" width="6" height="12" fill="#6d4c2f" />
      <path d="M0 -64 L20 -26 L-20 -26 Z" fill="#166534" />
      <path d="M0 -46 L24 -8 L-24 -8 Z" fill="#15803d" />
    </g>
  );
}
