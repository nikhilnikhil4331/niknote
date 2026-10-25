import { describe, expect, test } from 'vitest';
import {
  OCR_LANGUAGE_LABEL, OCR_QUALITY_SCALE, flattenOcrBlocks, hasDevanagari, ocrEstimateLabel,
  wordToPdfBox, type OcrWord,
} from '@/lib/pdfOcrMath';

const word = (text: string, x0: number, y0: number, x1: number, y1: number): OcrWord => ({
  text,
  confidence: 90,
  bbox: { x0, y0, x1, y1 },
});

describe('language helpers', () => {
  test('detects Devanagari, ignores Latin', () => {
    expect(hasDevanagari('नमस्ते')).toBe(true);
    expect(hasDevanagari('NikNote 2026')).toBe(false);
    expect(hasDevanagari('')).toBe(false);
  });

  test('labels and quality scale are wired', () => {
    expect(OCR_LANGUAGE_LABEL['eng']).toBe('English');
    expect(OCR_LANGUAGE_LABEL['eng+hin']).toContain('हिन्दी');
    expect(OCR_QUALITY_SCALE.fast).toBeLessThan(OCR_QUALITY_SCALE.best);
  });
});

describe('flattenOcrBlocks', () => {
  test('walks blocks → paragraphs → lines → words', () => {
    const blocks = [
      {
        paragraphs: [
          { lines: [{ words: [word('Hello', 0, 0, 40, 12), word('world', 45, 0, 90, 12)] }] },
          { lines: [{ words: [word('second', 0, 20, 50, 32)] }] },
        ],
      },
    ];
    expect(flattenOcrBlocks(blocks).map((w) => w.text)).toEqual(['Hello', 'world', 'second']);
  });

  test('skips empties, broken boxes and non-array input', () => {
    const blocks = [
      { lines: [{ words: [word('   ', 0, 0, 10, 10), word('ok', 5, 5, 5, 9), { text: 'no-bbox' }] }] },
    ];
    expect(flattenOcrBlocks(blocks).map((w) => w.text)).toEqual([]);
    expect(flattenOcrBlocks(null)).toEqual([]);
    expect(flattenOcrBlocks(undefined)).toEqual([]);
  });
});

describe('word placement', () => {
  test('maps image pixels to PDF points', () => {
    // 1000×2000 px image rendered at scale 2 from a 500×1000pt page
    const box = wordToPdfBox(word('Test', 100, 200, 300, 240), { width: 1000, height: 2000 }, { width: 500, height: 1000 });
    expect(box.x).toBeCloseTo(50, 5);
    expect(box.size).toBeCloseTo(0.92 * 20, 5);
    // baseline sits near the bottom edge of the box, above it in PDF space
    expect(box.y).toBeCloseTo(1000 - 120 + box.size * 0.2, 5);
  });

  test('never produces an unusable font size', () => {
    const tiny = wordToPdfBox(word('x', 0, 0, 1, 0.01), { width: 100, height: 100 }, { width: 100, height: 100 });
    expect(tiny.size).toBeGreaterThanOrEqual(2);
    const huge = wordToPdfBox(word('X', 0, 0, 10, 5000), { width: 100, height: 100 }, { width: 100, height: 100 });
    expect(huge.size).toBeLessThanOrEqual(72);
  });
});

describe('time estimate', () => {
  test('scales with pages and quality', () => {
    expect(ocrEstimateLabel(1, 'fast')).toMatch(/s$/);
    expect(ocrEstimateLabel(30, 'best')).toMatch(/min/);
  });
});
