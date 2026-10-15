import { motion, useReducedMotion } from 'framer-motion';
import { Check, CreditCard, Crown, Moon, Sun, Wallet } from 'lucide-react';

/** Small looping illustrations that match each feature's job. All pause under reduced motion. */

export function MoneyArt() {
  const r = useReducedMotion();
  return (
    <div className="nn-art nn-art-money" aria-hidden="true">
      {[0, 1, 2].map(i => (
        <motion.span key={i} className="nn-art-coin" style={{ left: `${30 + i * 16}%` }}
          initial={false}
          animate={r ? { y: 18, opacity: 1 } : { y: [-26, 22, 22], opacity: [0, 1, 0], rotateY: [0, 360, 360] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.55, ease: 'easeIn', times: [0, 0.7, 1] }}>₹</motion.span>
      ))}
      <motion.span className="nn-art-wallet" animate={r ? {} : { scale: [1, 1.06, 1] }} transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1.2 }}><Wallet size={30} /></motion.span>
    </div>
  );
}

export function RoutineArt({ progress = 0 }: { progress?: number }) {
  const r = useReducedMotion();
  const night = new Date().getHours() >= 19 || new Date().getHours() < 6;
  return (
    <div className="nn-art nn-art-routine" aria-hidden="true">
      <svg viewBox="0 0 100 60" className="nn-art-arc"><path d="M8 54 A42 42 0 0 1 92 54" /></svg>
      <motion.span className="nn-art-sun" initial={false}
        animate={r ? { rotate: 0 } : { rotate: [-70, 70] }}
        transition={{ duration: 6, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}>
        <span>{night ? <Moon size={18} /> : <Sun size={18} />}</span>
      </motion.span>
      <motion.span className="nn-art-check" animate={r ? {} : { scale: [0.9, 1.1, 0.9] }} transition={{ duration: 1.6, repeat: Infinity }}>
        <Check size={14} strokeWidth={3} /> {Math.round(progress)}%
      </motion.span>
    </div>
  );
}

export function PlanArt() {
  const r = useReducedMotion();
  return (
    <div className="nn-art nn-art-plan" aria-hidden="true">
      {[0, 1, 2, 3, 4].map(i => (
        <motion.span key={i} className="nn-art-orbit" style={{ rotate: i * 72 }}
          animate={r ? {} : { rotate: [i * 72, i * 72 + 360] }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}>
          <i>{i % 2 ? '✦' : '₹'}</i>
        </motion.span>
      ))}
      <motion.span className="nn-art-crown" animate={r ? {} : { y: [0, -8, 0], rotate: [-4, 4, -4] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}><Crown size={34} /></motion.span>
    </div>
  );
}

/** Card slides into a terminal, ripple confirms — for "processing payment". */
export function PaymentArt() {
  const r = useReducedMotion();
  return (
    <div className="nn-art nn-art-pay" aria-hidden="true">
      <span className="nn-art-terminal" />
      <motion.span className="nn-art-card" animate={r ? {} : { x: [-46, 0, 0, -46], opacity: [0, 1, 1, 0] }} transition={{ duration: 2.2, repeat: Infinity, times: [0, 0.35, 0.75, 1] }}><CreditCard size={28} /></motion.span>
      {!r && <motion.span className="nn-art-ripple" animate={{ scale: [0.4, 1.6], opacity: [0.6, 0] }} transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 1.1, delay: 0.8 }} />}
    </div>
  );
}
