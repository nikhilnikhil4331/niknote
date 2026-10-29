import { describe, it, expect } from 'vitest';
import {
  stopped, startSw, pauseSw, elapsedSw, isRunningSw,
  formatStopwatch, lapDuration, lapExtremes,
} from './stopwatch';

describe('stopwatch state machine (timestamp based)', () => {
  it('accumulates elapsed time across runs', () => {
    let sw = stopped();                       // t=0 idle
    sw = startSw(sw, 1000);                   // start at 1s
    expect(elapsedSw(sw, 4000)).toBe(3000);   // ran 3s
    sw = pauseSw(sw, 4000);                   // pause at 4s
    expect(isRunningSw(sw)).toBe(false);
    expect(elapsedSw(sw, 9000)).toBe(3000);   // pauses freeze
    sw = startSw(sw, 10000);                  // resume at 10s
    expect(elapsedSw(sw, 11500)).toBe(4500);  // 3000 + 1500
  });

  it('start is idempotent — never double-counts a running stretch', () => {
    let sw = startSw(stopped(), 1000);
    sw = startSw(sw, 5000); // second start ignored
    expect(elapsedSw(sw, 6000)).toBe(5000);
  });

  it('pausing an idle stopwatch is a no-op', () => {
    const sw = pauseSw(stopped(), 1234);
    expect(sw.startedAt).toBeNull();
    expect(sw.baseMs).toBe(0);
  });

  it('a backgrounded tab (big time jump) keeps true elapsed time', () => {
    const sw = startSw(stopped(), 0);
    // throttled for 10 minutes without a single tick:
    expect(elapsedSw(sw, 600000)).toBe(600000);
  });
});

describe('formatting', () => {
  it('formats mm:ss.cs', () => {
    expect(formatStopwatch(0)).toBe('00:00.00');
    expect(formatStopwatch(65432)).toBe('01:05.43');
    expect(formatStopwatch(3600000 + 62050)).toBe('61:02.05'); // 61min 2.05s
  });
});

describe('laps', () => {
  const laps = [10000, 25000, 40000]; // 10s, 15s, 15s
  it('per-lap durations are deltas', () => {
    expect(lapDuration(laps, 0)).toBe(10000);
    expect(lapDuration(laps, 1)).toBe(15000);
    expect(lapDuration(laps, 2)).toBe(15000);
  });
  it('finds fastest/slowest', () => {
    const { fastest, slowest } = lapExtremes([10000, 30000, 33000]);
    expect(fastest).toBe(2); // 3s lap
    expect(slowest).toBe(1); // 20s lap
  });
  it('handles no laps', () => {
    expect(lapExtremes([])).toEqual({ fastest: null, slowest: null });
  });
});
