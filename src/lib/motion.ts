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
