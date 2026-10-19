// Focus timer clock — timestamp based so suspend/throttle never loses time,
// and so a phase can only ever be recorded once.
export type FocusPhase = 'focus' | 'break';

/** Seconds still to run; rounds up so "0" only shows when the phase is truly over. */
export function secondsLeft(endAt: number, now: number) {
  if (!Number.isFinite(endAt)) return 0;
  return Math.max(0, Math.ceil((endAt - now) / 1000));
}

/** Absolute end timestamp for a duration in seconds. */
export function endAtFor(seconds: number, now: number) {
  return now + Math.max(0, seconds) * 1000;
}

/** Remaining seconds when a running timer is paused. */
export function remainingOnPause(endAt: number, now: number) {
  return secondsLeft(endAt, now);
}

/** mm:ss display value. */
export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function clockParts(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return { minutes: Math.floor(s / 60), seconds: s % 60, label: formatClock(s) };
}

/** A phase is complete only at (or past) zero. */
export const phaseComplete = (remaining: number) => remaining <= 0;
