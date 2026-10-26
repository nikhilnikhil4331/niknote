import { describe, it, expect } from 'vitest';
import {
  buildTextRuns,
  mapPdfFont,
  multiplyTransform,
  runAtPoint,
  type RawTextItem,
} from '@/lib/pdfTextEdit';
import {
  annotationBounds,
  hitTest,
  translateAnnotation,
  type TextEditAnnotation,
} from '@/lib/pdfStudio';

// Scale-1 viewport transform for a 595x842 page (pdf.js rotation 0).
const VP = [1, 0, 0, -1, 0, 842];

function item(str: string, x: number, baselineFromBottom: number, size: number, width: number, fontName = 'f1'): RawTextItem {
  // PDF space: origin bottom-left, transform = [size,0,0,size,x,y]
  return { str, fontName, transform: [size, 0, 0, size, x, baselineFromBottom], width, height: size };
}

const styles = {
  f1: { fontFamily: 'sans-serif' },
  f2: { fontFamily: 'Times New Roman' },
  f3: { fontFamily: 'Courier New' },
};

describe('multiplyTransform (pdf.js Util.transform parity)', () => {
  it('maps PDF space to top-left canvas space like the calibrated sample', () => {
    // Headline drawn at x=48, baseline 790 from bottom, size 22 -> baseline 52 from top
    const tx = multiplyTransform(VP, [22, 0, 0, 22, 48, 790]);
    expect(tx[4]).toBeCloseTo(48);
    expect(tx[5]).toBeCloseTo(52);
    expect(Math.hypot(tx[2], tx[3])).toBeCloseTo(22);
  });
});

describe('buildTextRuns', () => {
  it('builds a run with the original baseline, size and position', () => {
    const runs = buildTextRuns([item('Chapter 1 - Life Processes', 48, 700, 16, 201)], styles, VP, 595, 842);
    expect(runs).toHaveLength(1);
    const r = runs[0];
    expect(r.text).toBe('Chapter 1 - Life Processes');
    expect(r.fontSizePt).toBeCloseTo(16);
    expect(r.baseline).toBeCloseTo((842 - 700) / 842, 3);
    expect(r.rect.x).toBeCloseTo(48 / 595, 2);
    expect(r.rect.w).toBeGreaterThan(201 / 595);
    expect(r.sizeNorm).toBeCloseTo(16 / 595, 4);
    expect(r.font).toBe('sans');
  });

  it('merges same-line fragments with a space, splits different lines and fonts', () => {
    const runs = buildTextRuns(
      [
        item('Photosynthesis is', 48, 678, 12, 120),
        item('the process', 176, 678, 12, 90), // 8pt gap -> joined with space
        item('Second line', 48, 656, 12, 90), // new baseline -> new run
        item('Serif note', 48, 634, 12, 80, 'f2'),
        item('mono()', 48, 612, 12, 50, 'f3'),
        item('', 0, 0, 12, 0), // empty artifact ignored
        item('   ', 0, 0, 12, 10), // whitespace ignored
      ],
      styles,
      VP,
      595,
      842
    );
    expect(runs.map((r) => r.text)).toEqual(['Photosynthesis is the process', 'Second line', 'Serif note', 'mono()']);
    expect(runs[2].font).toBe('serif');
    expect(runs[3].font).toBe('mono');
  });

  it('does not merge across a wide gap (columns stay separate)', () => {
    const runs = buildTextRuns(
      [item('Left col', 48, 700, 12, 60), item('Right col', 380, 700, 12, 70)],
      styles,
      VP,
      595,
      842
    );
    expect(runs.map((r) => r.text)).toEqual(['Left col', 'Right col']);
  });

  it('skips rotated text (v1 edits horizontal lines only)', () => {
    const rotated: RawTextItem = { str: 'sideways', fontName: 'f1', transform: [0, 12, -12, 0, 100, 100], width: 60, height: 12 };
    expect(buildTextRuns([rotated], styles, VP, 595, 842)).toHaveLength(0);
  });
});

describe('mapPdfFont', () => {
  it('maps family classes and detects weight/style from names', () => {
    expect(mapPdfFont('sans-serif').font).toBe('sans');
    expect(mapPdfFont('Helvetica-Bold')).toMatchObject({ font: 'sans', bold: true });
    expect(mapPdfFont('TimesNewRomanPS-ItalicMT')).toMatchObject({ font: 'serif', italic: true });
    expect(mapPdfFont('Courier New').font).toBe('mono');
    expect(mapPdfFont('Comic Sans MS').font).toBe('cursive');
    expect(mapPdfFont('ABCDEF+Calibri').label).toBe('Calibri');
    expect(mapPdfFont(undefined)).toMatchObject({ font: 'sans', bold: false });
    // 'sans-serif' must NOT be read as serif
    expect(mapPdfFont('Noto Sans Devanagari').font).toBe('sans');
  });
});

describe('runAtPoint + TextEditAnnotation model', () => {
  const runs = buildTextRuns([item('Hello world', 100, 700, 14, 100)], styles, VP, 595, 842);

  it('hit-tests taps against highlighted lines', () => {
    const r = runs[0];
    expect(runAtPoint(runs, { x: r.rect.x + 0.01, y: r.baseline - 0.005 })).toBe(0);
    expect(runAtPoint(runs, { x: 0.95, y: 0.95 })).toBe(-1);
  });

  it('bounds, hit-tests and moves like other annotations', () => {
    const ann: TextEditAnnotation = {
      id: 't1', type: 'textedit', page: 'src-0',
      rect: { x: 0.1, y: 0.1, w: 0.3, h: 0.03 }, baseline: 0.12,
      text: 'Edited line', color: '#111827', size: 0.02, font: 'sans', bold: false, bg: '#ffffff',
    };
    const b = annotationBounds(ann);
    expect(b.x1).toBeCloseTo(0.1);
    expect(b.x2).toBeCloseTo(0.4); // cover box is wider than the short replacement text
    const longer = annotationBounds({ ...ann, text: 'A much longer replacement line that overflows the original box width' });
    expect(longer.x2).toBeGreaterThan(0.4); // bounds grow with the new text
    expect(hitTest(ann, { x: 0.2, y: 0.11 })).toBe(true);
    const moved = translateAnnotation(ann, 0.05, 0.02) as TextEditAnnotation;
    expect(moved.rect.x).toBeCloseTo(0.15);
    expect(moved.baseline).toBeCloseTo(0.14);
  });
});
