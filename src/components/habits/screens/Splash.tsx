import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { haptic } from '@/hooks/useHaptics';

/** A quiet, brand-led welcome screen; keeps the original Niknote wordmark untouched. */
export function Splash({ onEnter, isBack }: { onEnter: () => void; isBack: boolean }) {
  const reduced = useReducedMotion();
  const t = reduced ? { duration: 0 } : { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div className="absolute inset-0 z-40 overflow-hidden flex flex-col items-center justify-center px-8" style={{ background: 'linear-gradient(150deg, #f8f1f7 0%, #f4effa 52%, #edf4fa 100%)' }}>
      {/* Soft ambient colour keeps the logo vivid without adding visual noise. */}
      <div className="absolute -top-20 -right-24 w-80 h-80 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(235,190,222,0.46), transparent 70%)' }} aria-hidden="true" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(184,205,239,0.4), transparent 70%)' }} aria-hidden="true" />

      <div className="relative z-10 flex flex-col items-center text-center -mt-4">
        <motion.div
          initial={reduced ? false : { opacity: 0, scale: 0.94, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...t, delay: 0.08 }}
          className="w-full flex justify-center"
        >
          <img src="/niknote-logo.png" alt="Niknote" draggable={false} className="w-[250px] max-w-[74vw] h-auto object-contain select-none" />
        </motion.div>

        <motion.p
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...t, delay: 0.32 }}
          className="mt-3 text-[16px] font-medium tracking-[-0.02em] text-[#453653]"
        >
          Better habits, a brighter you.
        </motion.p>
        <motion.p
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...t, delay: 0.45 }}
          className="mt-2 text-[12px] font-medium text-[#82788e]"
        >
          A little progress, every day.
        </motion.p>

        <motion.button
          whileHover={reduced ? undefined : { y: -1 }}
          whileTap={reduced ? undefined : { scale: 0.97 }}
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...t, delay: 0.62 }}
          onClick={() => { haptic('success'); onEnter(); }}
          className="mt-8 min-w-44 px-7 py-3.5 rounded-full text-white text-[14px] font-semibold nnh-gradient-btn flex items-center justify-center gap-2"
        >
          {isBack ? 'Continue' : 'Get started'} <ArrowRight size={16} />
        </motion.button>

        <motion.p
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...t, delay: 0.8 }}
          className="mt-5 text-[11px] font-medium text-[#8d8298] flex items-center gap-1.5"
        >
          <Sparkles size={12} className="text-[#9d64b6]" /> Small habits. Big changes.
        </motion.p>
      </div>
    </div>
  );
}
