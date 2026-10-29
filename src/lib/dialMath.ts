// ============================================================
// NikNote — circular timer dial geometry (pure helpers)
// The draggable focus-timer dial derives everything from these
// functions so pointer drag, keyboard adjustments, presets and
// the digital display can never disagree. Zero DOM access here,
// which keeps the rules unit-testable (see dialMath.test.ts).
// ============================================================

export interface DialRange {
  /** Minutes represented by angle 0° (top of the dial). */
  min: number;
  /** Minutes represented by angle 360° (full turn, top again). */
  max: number;
}

/** Default desktop dial: 5 … 120 minutes. */
export const DIAL_RANGE: DialRange = { min: 5, max: 120 };

export const DIAL_PRESETS = [5, 10, 15, 25, 45, 60] as const;

/**
 * Angle (degrees, clockwise from 12 o'clock, range [0, 360)) of the
 * point (x, y) relative to the dial centre (cx, cy).
 * DOM y grows downward, so atan2(dx, -dy) directly yields the
 * clock-style angle with 0° at the top.
 */
export function pointerAngleDeg(cx: number, cy: number, x: number, y: number): number {
  const rad = Math.atan2(x - cx, -(y - cy));
  const deg = (rad * 180) / Math.PI;
  return (deg + 360) % 360;
}

/**
 * Resolve a raw [0, 360) reading to the continuous angle nearest to
 * `prev`. This is what makes crossing the 12 o'clock seam smooth:
 * dragging across the top yields 350° → 370° instead of 350° → 10°,
 * so the selected duration never teleports from max to min.
 * Result is NOT clamped — clamp with clampDialAngle afterwards.
 */
export function unwrapDialAngle(prev: number, raw: number): number {
  const delta = (((raw - (prev % 360)) % 360) + 540) % 360 - 180;
  return prev + delta;
}

/** Clamp a continuous angle to the single-turn [0, 360] domain. */
export function clampDialAngle(angle: number): number {
  if (angle < 0) return 0;
  if (angle > 360) return 360;
  return angle;
}

/** Snap a value to the nearest multiple of `step` (≥ 1). */
export function snap(value: number, step = 1): number {
  if (!Number.isFinite(value)) return 0;
  const s = Math.max(1, Math.round(step));
  return Math.round(value / s) * s;
}

/** Minutes → dial angle. Clamped to the configured range. */
export function minutesToAngle(minutes: number, range: DialRange = DIAL_RANGE): number {
  const min = Math.min(range.min, range.max);
  const max = Math.max(range.min, range.max);
  const span = max - min || 1;
  const t = Math.min(1, Math.max(0, (minutes - min) / span));
  return t * 360;
}

/** Dial angle → whole minutes, snapped to `snapStep`. */
export function angleToMinutes(angle: number, range: DialRange = DIAL_RANGE, snapStep = 1): number {
  const a = clampDialAngle(angle);
  const min = Math.min(range.min, range.max);
  const max = Math.max(range.min, range.max);
  const span = max - min;
  const raw = min + (a / 360) * span;
  return Math.min(max, Math.max(min, snap(raw, snapStep)));
}

/** Euclidean distance — used to ignore pointer presses far from the ring. */
export function pointDistance(cx: number, cy: number, x: number, y: number): number {
  return Math.hypot(x - cx, y - cy);
}

/** Point on a circle for an angle (0° = top, clockwise), handy for handles. */
export function pointOnDial(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + radius * Math.sin(rad), y: cy - radius * Math.cos(rad) };
}

/** Keyboard step for the dial — arrow keys move minutes by this. */
export const DIAL_KEY_STEP = 1;
export const DIAL_KEY_STEP_LARGE = 5;

/** Full circle geometry of the desktop dial: 0…120 min over 360° (linear). */
export const DIAL_GEOMETRY_RANGE: DialRange = { min: 0, max: 120 };

/** Selectable bounds for the desktop dial (5-minute floor). */
export const DIAL_SELECT_RANGE: DialRange = { min: 5, max: 120 };

export function clampDuration(minutes: number, range: DialRange = DIAL_RANGE): number {
  if (!Number.isFinite(minutes)) return range.min;
  return Math.min(range.max, Math.max(range.min, Math.round(minutes)));
}

/** "75" → "1h 15m" · "25" → "25 min" */
export function formatMinutesLabel(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}
