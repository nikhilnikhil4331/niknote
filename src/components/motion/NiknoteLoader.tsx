import { motion, useReducedMotion } from 'framer-motion';

/** Branded loading screen: the Niknote logo pops in, gets "written" left-to-right, sparkles twinkle. */
export function NiknoteLoader({ label = 'Loading your notes', fullScreen = true }: { label?: string; fullScreen?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <div role="status" aria-live="polite" className={`nn-loader ${fullScreen ? 'nn-loader-full' : ''}`}>
      <div className="nn-loader-glow" aria-hidden="true" />
      <motion.div
        className="nn-loader-logo"
        initial={reduced ? false : { scale: 0.55, opacity: 0, y: 14 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 15 }}
      >
        <motion.img
          src="/niknote-logo.png"
          alt="Niknote"
          draggable={false}
          initial={reduced ? false : { clipPath: 'inset(0 100% 0 0)' }}
          animate={{ clipPath: 'inset(0 0% 0 0)' }}
          transition={{ duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
        />
        {!reduced && [0, 1, 2].map(i => <span key={i} className={`nn-loader-spark nn-loader-spark-${i}`} aria-hidden="true" />)}
      </motion.div>
      <motion.div className="nn-loader-ink" aria-hidden="true" initial={reduced ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.7, delay: 0.8 }}>
        <span />
      </motion.div>
      <motion.p className="nn-loader-label" initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        {label}<span className="nn-loader-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
      </motion.p>
    </div>
  );
}
