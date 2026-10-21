// ============================================================
// dialGeometry — pure, viewport-aware layout for the NikNote
// semi-circular quick-nav dial.
//
// The old dial fanned items symmetrically around the centre button
// (±75°), so a button anchored near an edge pushed half the fan off
// screen. Here the arc is chosen on the *inner* side of the anchor,
// its radius is derived from the space that actually exists, and the
// whole group is nudged so no bubble can ever leave the viewport.
//
// Pure math only: no DOM access, so the rules stay unit-testable.
// ============================================================

export type DialAlign = 'left' | 'right' | 'center';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface DialGeometryOptions {
  /** Number of action bubbles to place. */
  count: number;
  /** Centre of the centre button, in viewport pixels (origin top-left). */
  anchor: { x: number; y: number };
  viewport: { width: number; height: number };
  /** Which edge the button hugs — biases the arc away from that edge. */
  align?: DialAlign;
  /** Bubble diameter in px. */
  bubble?: number;
  /** Reserved ring around a bubble (ink shadow / focus ring). */
  labelPad?: number;
  /** Minimum distance from any viewport edge. */
  padding?: number;
  /** Device safe-area insets (notches, home indicator). */
  safe?: Partial<Insets>;
  minRadius?: number;
  maxRadius?: number;
  /** Preferred clearance between two neighbouring bubbles. */
  gap?: number;
}

export interface DialPoint {
  /** Offset from the anchor centre, y negative = above. */
  x: number;
  y: number;
  /** Angle from "straight up", negative = left. */
  angle: number;
}

export interface DialGeometry {
  points: DialPoint[];
  radius: number;
  bubble: number;
  spacing: number;
  /** Group translation (px) applied after layout so every bubble fits. */
  offset: { x: number; y: number };
  /** True when no circular arrangement can fit — caller should use a list. */
  compact: boolean;
  /** Reason the compact fallback was chosen (useful for tests/debug). */
  reason?: 'count' | 'space';
}

const DEG = Math.PI / 180;

/**
 * Candidate arcs, ordered by preference: first the fan that hugs the
 * inner side of the button, then progressively flatter arcs and finally
 * mirrored/mostly-upward fans for buttons parked in a bottom corner.
 * Each entry is [from, to, radiusCap] in degrees from straight up.
 */
const RIGHT_SECTORS: Array<[number, number, number]> = [
  [-112, -8, 200],
  [-126, -10, 200],
  [-142, -12, 200],
  [-158, -14, 200],
  [-176, -16, 200],
  [-88, -4, 210],
  [-70, 70, 210],
  [4, 88, 210],
  [4, 104, 210],
  [8, 120, 210],
];

const MIRRORED: Array<[number, number, number]> = RIGHT_SECTORS.map(([from, to, cap]) => [-to, -from, cap]);

const SECTORS: Record<DialAlign, Array<[number, number, number]>> = {
  // Right-anchored: everything lives to the left of the button, tilted up.
  right: RIGHT_SECTORS,
  // Left-anchored: the mirror image.
  left: MIRRORED,
  // Centred: a calm fan, widening only if the spacing needs it.
  center: [
    [-58, 58, 210],
    [-70, 70, 210],
    [-82, 82, 210],
    [-96, 96, 210],
    [-112, 112, 210],
    [-132, 132, 220],
  ],
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Largest radius that keeps the arc inside the given box.
 * x = sin(angle) * r, y = -cos(angle) * r
 */
function radiusLimitForSector(
  from: number,
  to: number,
  room: { left: number; right: number; up: number; down: number },
  inner: number,
): number {
  let minSin = 0;
  let maxSin = 0;
  let minCos = Infinity;
  let maxCos = -Infinity;
  // Sample the sector — cheap, and correct for arcs larger than 90°.
  const steps = 36;
  for (let i = 0; i <= steps; i++) {
    const a = (from + ((to - from) * i) / steps) * DEG;
    const s = Math.sin(a);
    const c = Math.cos(a);
    minSin = Math.min(minSin, s);
    maxSin = Math.max(maxSin, s);
    minCos = Math.min(minCos, c);
    maxCos = Math.max(maxCos, c);
  }

  let limit = Infinity;
  // Need room for the bubble itself: bubbles are centred on the arc.
  if (minSin < -1e-6) limit = Math.min(limit, (room.left - inner) / -minSin);
  if (maxSin > 1e-6) limit = Math.min(limit, (room.right - inner) / maxSin);
  if (maxCos > 1e-6) limit = Math.min(limit, (room.up - inner) / maxCos);
  if (minCos < -1e-6) limit = Math.min(limit, (room.down - inner) / -minCos);
  return Math.max(0, limit);
}

/**
 * Layout the dial bubbles.
 *
 * Guarantees (checked by tests):
 *  - every bubble centre is inside the viewport minus padding and safe insets
 *  - bubbles never overlap (spacing >= bubble)
 *  - the dial falls back to `compact` instead of clipping
 */
export function computeDialGeometry(options: DialGeometryOptions): DialGeometry {
  const {
    count,
    anchor,
    viewport,
    align = 'right',
    padding = 12,
    minRadius = 72,
    maxRadius = 200,
    gap = 6,
  } = options;

  const safe: Insets = {
    top: options.safe?.top ?? 0,
    right: options.safe?.right ?? 0,
    bottom: options.safe?.bottom ?? 0,
    left: options.safe?.left ?? 0,
  };

  // Adapt bubble size to narrow screens instead of clipping it.
  const bubble = options.bubble ?? (viewport.width < 360 ? 40 : viewport.width < 480 ? 44 : 48);
  const inner = bubble / 2 + (options.labelPad ?? 4);

  const room = {
    left: anchor.x - padding - safe.left,
    right: viewport.width - anchor.x - padding - safe.right,
    up: anchor.y - padding - safe.top,
    down: viewport.height - anchor.y - padding - safe.bottom,
  };

  if (count <= 0) {
    return { points: [], radius: 0, bubble, spacing: 0, offset: { x: 0, y: 0 }, compact: false, reason: 'count' };
  }

  const minSpacing = bubble + 1;
  const preferredSpacing = bubble + Math.max(2, gap);
  const bounds = {
    minX: padding + safe.left,
    maxX: viewport.width - padding - safe.right,
    minY: padding + safe.top,
    maxY: viewport.height - padding - safe.bottom,
  };

  let best: DialGeometry | null = null;

  for (const [from, to, cap] of SECTORS[align]) {
    const span = Math.abs(to - from);
    if (span < 8) continue;
    const spanRad = span * DEG;
    const needed = count > 1 ? (minSpacing * (count - 1)) / spanRad : 0;
    const preferred = count > 1 ? (preferredSpacing * (count - 1)) / spanRad : 0;
    const limit = radiusLimitForSector(from, to, room, inner);
    if (limit < minRadius) continue;

    const radius = Math.min(maxRadius, cap, limit, Math.max(preferred, minRadius));
    const spacing = count > 1 ? (radius * spanRad) / (count - 1) : radius;
    if (spacing < minSpacing - 0.5) continue;

    const step = count > 1 ? span / (count - 1) : 0;
    const points: DialPoint[] = Array.from({ length: count }, (_, i) => {
      const angle = from + i * step;
      const rad = angle * DEG;
      return { x: Math.sin(rad) * radius, y: -Math.cos(rad) * radius, angle };
    });

    // Nudge the group only as far as needed to stay inside the viewport.
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, anchor.x + p.x - inner);
      maxX = Math.max(maxX, anchor.x + p.x + inner);
      minY = Math.min(minY, anchor.y + p.y - inner);
      maxY = Math.max(maxY, anchor.y + p.y + inner);
    }

    let offsetX = 0;
    let offsetY = 0;
    if (minX < bounds.minX) offsetX = bounds.minX - minX;
    if (maxX + offsetX > bounds.maxX) offsetX = Math.min(offsetX, bounds.maxX - maxX);
    if (minY < bounds.minY) offsetY = bounds.minY - minY;
    if (maxY + offsetY > bounds.maxY) offsetY = Math.min(offsetY, bounds.maxY - maxY);

    const fitsX = maxX - minX <= bounds.maxX - bounds.minX && minX + offsetX >= bounds.minX - 0.5 && maxX + offsetX <= bounds.maxX + 0.5;
    const fitsY = maxY - minY <= bounds.maxY - bounds.minY && minY + offsetY >= bounds.minY - 0.5 && maxY + offsetY <= bounds.maxY + 0.5;
    // A small nudge is invisible; a big one would detach the fan from the button.
    const nudgeOk = Math.abs(offsetX) <= 28 && Math.abs(offsetY) <= 28;

    const candidate: DialGeometry = {
      points,
      radius,
      bubble,
      spacing,
      offset: { x: offsetX, y: offsetY },
      compact: false,
    };

    if (fitsX && fitsY && nudgeOk) return candidate;
    if (!best || (spacing > best.spacing && fitsX && fitsY)) best = candidate;
  }

  // Nothing fits with usable spacing (very short viewport / landscape phone).
  if (best && Math.abs(best.offset.x) <= 48 && Math.abs(best.offset.y) <= 48) {
    return { ...best, spacing: Math.min(best.spacing, best.bubble) };
  }
  return { points: [], radius: 0, bubble, spacing: 0, offset: { x: 0, y: 0 }, compact: true, reason: 'space' };
}

/** True when the fan can scroll-free fit as a circle. */
export function dialFits(geometry: DialGeometry): boolean {
  return !geometry.compact && geometry.points.length > 0;
}
