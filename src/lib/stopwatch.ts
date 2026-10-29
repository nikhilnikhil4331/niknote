// ============================================================
// NikNote — stopwatch math (pure helpers, timestamp based).
// Same rule as the focus clock (AGENTS.md): elapsed time is always
// derived from absolute timestamps, never from counting ticks, so a
// throttled/backgrounded tab never loses or gains time.
// ============================================================

export interface StopwatchState {
  /** ms accumulated before the current running stretch. */
  baseMs: number;
  /** Absolute timestamp (ms) when the current stretch started, or null when paused. */
  startedAt: number | null;
}

export const stopped = (): StopwatchState => ({ baseMs: 0, startedAt: null });

export function startSw(state: StopwatchState, now: number): StopwatchState {
  if (state.startedAt != null) return state; // already running — never duplicate
  return { baseMs: state.baseMs, startedAt: now };
}

export function pauseSw(state: StopwatchState, now: number): StopwatchState {
  if (state.startedAt == null) return state;
  return { baseMs: elapsedSw(state, now), startedAt: null };
}

/** Elapsed milliseconds derived from timestamps. */
export function elapsedSw(state: StopwatchState, now: number): number {
  const run = state.startedAt == null ? 0 : Math.max(0, now - state.startedAt);
  return Math.max(0, state.baseMs + run);
}

export function isRunningSw(state: StopwatchState): boolean {
  return state.startedAt != null;
}

/** "mm:ss.cs" — centisecond precision for the stopwatch display. */
export function formatStopwatch(ms: number): string {
  const t = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(t / 60000);
  const seconds = Math.floor((t % 60000) / 1000);
  const centis = Math.floor((t % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

/** "hh:mm:ss" style for long stopwatch runs. */
export function formatStopwatchLong(ms: number): string {
  const t = Math.max(0, Math.floor(ms));
  const hours = Math.floor(t / 3600000);
  const rest = t % 3600000;
  const base = formatStopwatch(rest).slice(0, 5);
  return hours > 0 ? `${String(hours).padStart(2, '0')}:${base}` : base;
}

/**
 * Laps are stored as absolute elapsed times (ms) at the moment of each lap.
 * Per-lap duration = lap[i] − lap[i−1] (lap[0] measured from 0).
 */
export function lapDuration(laps: number[], index: number): number {
  if (index < 0 || index >= laps.length) return 0;
  return Math.max(0, laps[index] - (index > 0 ? laps[index - 1] : 0));
}

/** Fastest / slowest lap indexes (0-based); null when no laps. */
export function lapExtremes(laps: number[]): { fastest: number | null; slowest: number | null } {
  if (!laps.length) return { fastest: null, slowest: null };
  let fastest = 0;
  let slowest = 0;
  for (let i = 1; i < laps.length; i++) {
    if (lapDuration(laps, i) < lapDuration(laps, fastest)) fastest = i;
    if (lapDuration(laps, i) > lapDuration(laps, slowest)) slowest = i;
  }
  return { fastest, slowest };
}
