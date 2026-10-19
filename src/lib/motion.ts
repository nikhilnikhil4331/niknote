// Niknote shared motion language. Reuse these instead of inventing per-page timings.
export const ease = {
  out: [0.22, 1, 0.36, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
};
export const duration = { tap: 0.12, fast: 0.18, base: 0.28, slow: 0.45 } as const;
export const spring = {
  gentle: { type: 'spring' as const, stiffness: 260, damping: 28 },
  snappy: { type: 'spring' as const, stiffness: 420, damping: 34 },
};
export const pressScale = 0.97;
export const revealDistance = 10;
/** Stagger first render only, capped so long lists never wait. */
export const staggerDelay = (index: number) => Math.min(index, 6) * 0.035;

/**
 * Niknote habit motion tokens (Section 5 of the redesign brief).
 * Timings are intentionally short: feedback must never delay an action.
 */
export const habitMotion = {
  micro: { duration: 0.12, ease: ease.out },
  press: { duration: 0.14, ease: ease.out },
  small: { duration: 0.2, ease: ease.out },
  card: { duration: 0.28, ease: ease.out },
  nav: { duration: 0.3, ease: ease.out },
  screen: { duration: 0.34, ease: ease.out },
} as const;

export const habitSpring = {
  soft: { type: 'spring' as const, stiffness: 210, damping: 26, mass: 0.9 },
  nav: { type: 'spring' as const, stiffness: 340, damping: 32 },
  pop: { type: 'spring' as const, stiffness: 420, damping: 26 },
} as const;

/** Reduced-motion aware transition helper: collapse to a quick fade. */
export const motionFor = (reduced: boolean | null, normal: Record<string, unknown>) =>
  reduced ? { duration: 0.01 } : normal;
