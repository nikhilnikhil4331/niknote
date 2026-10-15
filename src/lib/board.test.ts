/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { History, eraseAt, movePage, newPage, normalizeBoard, orient, paginateText, strokesInLasso, validateImage, wrapLines } from './board';

describe('board pagination', () => {
  test('long paste splits into pages without losing words', () => {
    const words = Array.from({ length: 3000 }, (_, i) => `w${i}`);
    const pages = paginateText(words.join(' '), 40, 30);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.join(' ').split(/\s+/).filter(Boolean)).toEqual(words);
    pages.forEach(p => expect(p.split('\n').length).toBeLessThanOrEqual(30));
  });
  test('keeps blank lines and splits very long words', () => {
    expect(wrapLines('a\n\nb', 10)).toEqual(['a', '', 'b']);
    expect(wrapLines('x'.repeat(25), 10)).toEqual(['x'.repeat(10), 'x'.repeat(10), 'x'.repeat(5)]);
  });
});

describe('pages', () => {
  test('reorder moves a page', () => {
    const [a, b, c] = [newPage(), newPage(), newPage()];
    expect(movePage([a, b, c], 0, 2).map(p => p.id)).toEqual([b.id, c.id, a.id]);
    expect(movePage([a, b], 0, 5)).toEqual([a, b]);
  });
  test('landscape swaps sides', () => {
    expect(orient(794, 1123, true)).toEqual({ width: 1123, height: 794 });
    expect(orient(1123, 794, false)).toEqual({ width: 794, height: 1123 });
  });
  test('normalize repairs empty data', () => {
    expect(normalizeBoard(null).pages.length).toBe(1);
  });
});

describe('drawing', () => {
  const s = (id: string, pts: [number, number][]) => ({ id, tool: 'pen' as const, color: '#000', width: 2, opacity: 1, points: pts.map(([x, y]) => [x, y, 0.5] as [number, number, number]) });
  test('eraser removes touched stroke only', () => {
    const out = eraseAt([s('a', [[0, 0], [100, 0]]), s('b', [[0, 200], [100, 200]])], 50, 3, 5);
    expect(out.map(x => x.id)).toEqual(['b']);
  });
  test('lasso selects enclosed strokes', () => {
    const ids = strokesInLasso([s('in', [[10, 10], [20, 20]]), s('out', [[200, 200], [210, 210]])], [[0, 0], [50, 0], [50, 50], [0, 50]]);
    expect(ids).toEqual(['in']);
  });
  test('undo/redo', () => {
    const h = new History<number>(); h.push(1); h.push(2);
    expect(h.undo(3)).toBe(2); expect(h.redo(2)).toBe(3); expect(h.undo(3)).toBe(2); expect(h.undo(2)).toBe(1); expect(h.undo(1)).toBeNull();
  });
});

test('image validation', () => {
  expect(validateImage({ type: 'image/png', size: 1000 })).toBeNull();
  expect(validateImage({ type: 'image/svg+xml', size: 1000 })).not.toBeNull();
  expect(validateImage({ type: 'image/png', size: 11 * 1024 * 1024 })).not.toBeNull();
});
