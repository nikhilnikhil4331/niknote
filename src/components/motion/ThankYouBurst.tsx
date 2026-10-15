import { motion, useReducedMotion } from 'framer-motion';
import { Heart } from 'lucide-react';

/** Heart pops in, little hearts fly outward, then "Thank you" letters bounce in one by one. */
export function ThankYouBurst({ title = 'Thank you!', subtitle }: { title?: string; subtitle?: string }) {
  const reduced = useReducedMotion();
  const hearts = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return { x: Math.cos(a) * 90, y: Math.sin(a) * 90, d: i * 0.03 };
  });
  return (
    <div className="nn-thanks" role="status" aria-live="polite">
      <div className="nn-thanks-stage">
        {!reduced && hearts.map((h, i) => (
          <motion.span key={i} className="nn-thanks-mini" aria-hidden="true"
            initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
            animate={{ x: h.x, y: h.y, scale: [0, 1.1, 0.6], opacity: [0, 1, 0] }}
            transition={{ duration: 1.2, delay: 0.35 + h.d, ease: 'easeOut' }}>
            <Heart size={14} fill="currentColor" />
          </motion.span>
        ))}
        <motion.div className="nn-thanks-heart"
          initial={reduced ? false : { scale: 0, rotate: -25 }}
          animate={reduced ? {} : { scale: [0, 1.25, 0.95, 1.05, 1], rotate: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}>
          <motion.span animate={reduced ? {} : { scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: 1.1, delay: 1 }}>
            <Heart size={46} fill="currentColor" />
          </motion.span>
        </motion.div>
      </div>
      <h1 className="nn-thanks-title" aria-label={title}>
        {title.split('').map((c, i) => (
          <motion.span key={i} aria-hidden="true" initial={reduced ? false : { y: 24, opacity: 0, scale: 0.6 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 0.6 + i * 0.05 }}>{c === ' ' ? '\u00a0' : c}</motion.span>
        ))}
      </h1>
      {subtitle && <motion.p className="nn-thanks-sub" initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>{subtitle}</motion.p>}
    </div>
  );
}
