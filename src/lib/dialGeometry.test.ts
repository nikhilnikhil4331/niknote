import { describe, expect, it } from 'vitest';
import { computeDialGeometry, dialFits, type DialGeometryOptions } from './dialGeometry';

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
];

/** A right-anchored FAB, like the Money Tracker dial. */
function rightAnchor(viewport: { width: number; height: number }, inset = 12) {
  return { x: viewport.width - inset - 28, y: viewport.height - 160 };
}

function leftAnchor(viewport: { width: number; height: number }, inset = 16) {
  return { x: inset + 28, y: viewport.height - 56 };
}

function assertInside(geometry: ReturnType<typeof computeDialGeometry>, options: DialGeometryOptions) {
  const { anchor, viewport } = options;
  const padding = options.padding ?? 12;
  for (const p of geometry.points) {
    const cx = anchor.x + p.x + geometry.offset.x;
    const cy = anchor.y + p.y + geometry.offset.y;
    const r = geometry.bubble / 2;
    expect(cx - r).toBeGreaterThanOrEqual(padding - 0.6);
    expect(cx + r).toBeLessThanOrEqual(viewport.width - padding + 0.6);
    expect(cy - r).toBeGreaterThanOrEqual(padding - 0.6);
    expect(cy + r).toBeLessThanOrEqual(viewport.height - padding + 0.6);
  }
}

describe('computeDialGeometry', () => {
  it('keeps every right-anchored bubble on screen at all common viewports', () => {
    for (const viewport of VIEWPORTS) {
      const options: DialGeometryOptions = {
        count: 7,
        anchor: rightAnchor(viewport),
        viewport,
        align: 'right',
      };
      const geometry = computeDialGeometry(options);
      expect(geometry.compact).toBe(false);
      expect(geometry.points).toHaveLength(7);
      assertInside(geometry, options);
    }
  });

  it('keeps every left-anchored bubble on screen', () => {
    for (const viewport of VIEWPORTS) {
      const options: DialGeometryOptions = {
        count: 7,
        anchor: leftAnchor(viewport),
        viewport,
        align: 'left',
      };
      const geometry = computeDialGeometry(options);
      expect(geometry.points).toHaveLength(7);
      assertInside(geometry, options);
    }
  });

  it('mirrors the fan: right-aligned bubbles stay left of their button', () => {
    const viewport = { width: 390, height: 844 };
    const anchor = rightAnchor(viewport);
    const geometry = computeDialGeometry({ count: 7, anchor, viewport, align: 'right' });
    const farthestRight = Math.max(...geometry.points.map(p => p.x)) + geometry.offset.x;
    expect(anchor.x + farthestRight + geometry.bubble / 2).toBeLessThan(viewport.width);
    // and the fan has real width (not collapsed onto the button)
    expect(Math.min(...geometry.points.map(p => p.x))).toBeLessThan(-60);
  });

  it('never overlaps neighbouring bubbles when it reports a circular layout', () => {
    for (const viewport of VIEWPORTS) {
      const options: DialGeometryOptions = {
        count: 7,
        anchor: rightAnchor(viewport),
        viewport,
        align: 'right',
      };
      const geometry = computeDialGeometry(options);
      if (geometry.compact) continue;
      expect(geometry.spacing).toBeGreaterThanOrEqual(geometry.bubble - 0.5);
    }
  });

  it('falls back to compact instead of clipping on a tiny landscape viewport', () => {
    const viewport = { width: 320, height: 260 };
    const geometry = computeDialGeometry({
      count: 7,
      anchor: { x: 320 - 40, y: 130 },
      viewport,
      align: 'right',
    });
    expect(geometry.compact || dialFits(geometry)).toBe(true);
    if (!geometry.compact) {
      assertInside(geometry, { count: 7, anchor: { x: 280, y: 130 }, viewport, align: 'right' });
    }
  });

  it('respects safe-area insets', () => {
    const viewport = { width: 390, height: 844 };
    const options: DialGeometryOptions = {
      count: 7,
      anchor: { x: 350, y: 680 },
      viewport,
      align: 'right',
      safe: { top: 44, right: 0, bottom: 34, left: 0 },
    };
    const geometry = computeDialGeometry(options);
    expect(geometry.compact).toBe(false);
    for (const p of geometry.points) {
      const cy = 680 + p.y + geometry.offset.y;
      expect(cy + geometry.bubble / 2).toBeLessThanOrEqual(viewport.height - 34 + 0.6);
    }
  });

  it('handles a single item and a huge count without NaN', () => {
    const one = computeDialGeometry({ count: 1, anchor: { x: 350, y: 500 }, viewport: { width: 390, height: 844 } });
    expect(one.points).toHaveLength(1);
    expect(Number.isFinite(one.points[0].x)).toBe(true);

    const many = computeDialGeometry({ count: 14, anchor: { x: 350, y: 500 }, viewport: { width: 390, height: 844 } });
    expect(many.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    expect(many.compact || many.spacing > 0).toBe(true);
  });

  it('is deterministic for identical input', () => {
    const input: DialGeometryOptions = { count: 7, anchor: { x: 350, y: 500 }, viewport: { width: 390, height: 844 } };
    expect(computeDialGeometry(input)).toEqual(computeDialGeometry(input));
  });
});
