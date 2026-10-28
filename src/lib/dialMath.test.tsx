import { describe, it, expect } from 'vitest';
import {
  pointerAngleDeg, unwrapDialAngle, clampDialAngle, snap,
  minutesToAngle, angleToMinutes, clampDuration, DIAL_RANGE,
  pointOnDial, formatMinutesLabel,
} from './dialMath';

const CX = 100, CY = 100;

describe('pointerAngleDeg — clock-style angles', () => {
  it('maps cardinal points like a watch dial', () => {
    expect(pointerAngleDeg(CX, CY, CX, CY - 50)).toBeCloseTo(0);    // 12 o'clock
    expect(pointerAngleDeg(CX, CY, CX + 50, CY)).toBeCloseTo(90);   // 3 o'clock
    expect(pointerAngleDeg(CX, CY, CX, CY + 50)).toBeCloseTo(180);  // 6 o'clock
    expect(pointerAngleDeg(CX, CY, CX - 50, CY)).toBeCloseTo(270);  // 9 o'clock
  });
});

describe('unwrapDialAngle — 12 o’clock seam', () => {
  it('extends past 360 when dragging clockwise across the top', () => {
    const prev = 350;
    expect(unwrapDialAngle(prev, 10)).toBeCloseTo(370); // not 10!
  });
  it('extends below 0 when dragging counter-clockwise across the top', () => {
    const prev = 10;
    expect(unwrapDialAngle(prev, 350)).toBeCloseTo(-10); // not 350!
  });
  it('does not jump on ordinary drags', () => {
    expect(unwrapDialAngle(100, 101)).toBeCloseTo(101);
    expect(unwrapDialAngle(200, 198)).toBeCloseTo(198);
  });
  it('clamps to one full turn for duration mapping', () => {
    expect(clampDialAngle(370)).toBe(360);
    expect(clampDialAngle(-10)).toBe(0);
  });
});

describe('angle ↔ minutes mapping', () => {
  it('is a consistent round-trip', () => {
    for (const m of [5, 25, 45, 60, 90, 120]) {
      expect(angleToMinutes(minutesToAngle(m))).toBe(m);
    }
  });
  it('maps dial ends to the range ends', () => {
    expect(angleToMinutes(0)).toBe(DIAL_RANGE.min);
    expect(angleToMinutes(360)).toBe(DIAL_RANGE.max);
    expect(minutesToAngle(DIAL_RANGE.min)).toBe(0);
    expect(minutesToAngle(DIAL_RANGE.max)).toBe(360);
  });
  it('clamps out-of-range values', () => {
    expect(angleToMinutes(420)).toBe(DIAL_RANGE.max);
    expect(minutesToAngle(999)).toBe(360);
    expect(minutesToAngle(0)).toBe(0);
    expect(clampDuration(0)).toBe(DIAL_RANGE.min);
    expect(clampDuration(999)).toBe(DIAL_RANGE.max);
  });
  it('25 minutes sits well inside the dial (~69.6°)', () => {
    const a = minutesToAngle(25);
    expect(a).toBeGreaterThan(50);
    expect(a).toBeLessThan(80);
  });
});

describe('snap + labels + geometry', () => {
  it('snaps to the nearest step', () => {
    expect(snap(23.4, 5)).toBe(25);
    expect(snap(22.4, 5)).toBe(20);
    expect(snap(61, 1)).toBe(61);
  });
  it('formats minute labels', () => {
    expect(formatMinutesLabel(25)).toBe('25 min');
    expect(formatMinutesLabel(60)).toBe('1h');
    expect(formatMinutesLabel(75)).toBe('1h 15m');
  });
  it('pointOnDial puts angle 0 at the top', () => {
    const p = pointOnDial(0, 0, 10, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(-10);
    const q = pointOnDial(0, 0, 10, 90);
    expect(q.x).toBeCloseTo(10);
    expect(q.y).toBeCloseTo(0);
  });
});
