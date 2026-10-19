/**
 * Pure layout math for the radial quick-action menu.
 * Angles are measured from the vertical (0° = straight up), negative = left.
 * Returns `{ x, y }` offsets in pixels with y negative meaning "above the FAB".
 */
export type RadialPoint = { x: number; y: number; angle: number };

export function radialLayout(count: number, radius: number, span = 128): RadialPoint[] {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 0, y: -radius, angle: 0 }];
  const step = span / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    const angle = -span / 2 + i * step;
    const rad = (angle * Math.PI) / 180;
    return { x: Math.sin(rad) * radius, y: -Math.cos(rad) * radius, angle };
  });
}

/**
 * Tiny per-action debounce. Two activations of the same action inside `windowMs`
 * are treated as one (double taps, pointer+click duplicates, key repeat).
 */
export function createActionGate(windowMs = 320) {
  let last: { key: string; at: number } | null = null;
  return (key: string, now = Date.now()) => {
    if (last && last.key === key && now - last.at < windowMs) return false;
    last = { key, at: now };
    return true;
  };
}
