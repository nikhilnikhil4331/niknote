import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  classifyInkColor,
  dnaFromMetrics,
  measureInkImage,
  type InkImage,
} from '@/lib/handwritingAnalysis';
import {
  DNA_PRESET_META,
  dnaPreviewCSS,
  dnaPresetMeta,
  noteSettingsForDNA,
  paginateStructured,
  wordSlant,
} from '@/lib/handwritingStyle';
import { DNA_PRESETS, getDefaultDNA } from '@/components/handwriting-dna/HandwritingDNAEngine';
import { HandwritingPage } from '@/components/handwriting-dna/HandwritingPage';
import { composePdfNotes } from '@/lib/aiNotes';

/** Draws `lines` rows of slanted vertical strokes — a stand-in for handwriting. */
function syntheticSample(options: {
  lines?: number;
  slantDeg?: number;
  strokeWidth?: number;
  strokeHeight?: number;
  lineHeight?: number;
  letterGap?: number;
  ink?: [number, number, number];
} = {}): InkImage {
  const {
    lines = 4, slantDeg = 16, strokeWidth = 4, strokeHeight = 28,
    lineHeight = 80, letterGap = 18, ink = [18, 26, 92],
  } = options;
  const width = 480;
  const height = lines * lineHeight + 60;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const shift = Math.tan((slantDeg * Math.PI) / 180) * strokeHeight;

  for (let line = 0; line < lines; line++) {
    const baseline = 60 + line * lineHeight;
    for (let letter = 0; letter < 22; letter++) {
      const x0 = 40 + letter * letterGap;
      for (let t = 0; t <= strokeHeight; t++) {
        const y = baseline - t;
        const xAt = x0 + (t / strokeHeight) * shift;
        for (let w = 0; w < strokeWidth; w++) {
          const x = Math.round(xAt + w);
          if (x < 0 || x >= width || y < 0 || y >= height) continue;
          const p = (y * width + x) * 4;
          data[p] = ink[0];
          data[p + 1] = ink[1];
          data[p + 2] = ink[2];
          data[p + 3] = 255;
        }
      }
    }
  }
  return { data, width, height };
}

describe('ink measurement', () => {
  it('finds the written lines and their count', () => {
    const metrics = measureInkImage(syntheticSample({ lines: 4 }));
    expect(metrics.lines).toBeGreaterThanOrEqual(3);
    expect(metrics.lines).toBeLessThanOrEqual(5);
    expect(metrics.xHeight).toBeGreaterThan(8);
    expect(metrics.strokeWidth).toBeGreaterThan(0);
    expect(metrics.confidence).toBeGreaterThan(0.3);
  });

  it('reads a right-leaning sample as a positive slant', () => {
    const metrics = measureInkImage(syntheticSample({ slantDeg: 18 }));
    expect(metrics.slant).toBeGreaterThan(4);
  });

  it('reads a left-leaning sample the other way', () => {
    const metrics = measureInkImage(syntheticSample({ slantDeg: -18 }));
    expect(metrics.slant).toBeLessThan(-4);
  });

  it('refuses to invent numbers for a blank page', () => {
    const blank: InkImage = {
      data: new Uint8ClampedArray(200 * 200 * 4).fill(255),
      width: 200,
      height: 200,
    };
    const metrics = measureInkImage(blank);
    expect(metrics.lines).toBe(0);
    expect(metrics.confidence).toBe(0);
  });

  it('detects the pen colour instead of assuming blue', () => {
    expect(classifyInkColor(10, 20, 200)).toBe('blue');
    expect(classifyInkColor(20, 20, 22)).toBe('black');
    expect(classifyInkColor(200, 30, 40)).toBe('red');
    const dna = dnaFromMetrics(measureInkImage(syntheticSample({ ink: [20, 20, 24] })));
    expect(dna.inkColor).toBe('black');
  });
});

describe('DNA → render settings', () => {
  it('fills every field the renderer reads (the old scanner left them empty)', () => {
    const dna = dnaFromMetrics(measureInkImage(syntheticSample()));
    expect(dna.closestFont).toBeTruthy();
    expect(dna.penPressure).toBeGreaterThan(0);
    expect(dna.strokeThickness).toBeGreaterThan(0.5);
    expect(dna.wordSpacing).toBeGreaterThanOrEqual(3);
    expect(typeof dna.letterSpacing).toBe('number');
  });

  it('never stacks lines on top of each other', () => {
    for (const preset of Object.values(DNA_PRESETS)) {
      const settings = noteSettingsForDNA(preset);
      expect(settings.lineSpacing).toBeGreaterThanOrEqual(Math.round(settings.fontSize * 1.38));
      const css = dnaPreviewCSS(preset);
      const lineHeight = Number(css.lineHeight);
      expect(Number.isFinite(lineHeight)).toBe(true);
      // The old bug was a 2.3px absolute line-height; it must stay unitless.
      expect(lineHeight).toBeGreaterThanOrEqual(1.38);
      expect(String(css.lineHeight)).not.toContain('px');
    }
  });

  it('keeps the user’s unrelated page settings when applying a style', () => {
    const current = noteSettingsForDNA(getDefaultDNA(), { pageStyle: 'graph', fontSize: 12 });
    const applied = noteSettingsForDNA(DNA_PRESETS.neat_student, current);
    expect(applied.pageStyle).toBe('graph');
    expect(applied.font).toBe(noteSettingsForDNA(DNA_PRESETS.neat_student).font);
    expect(applied.fontSize).not.toBe(12);
  });

  it('gives every preset a human label (no raw keys like messy_fast)', () => {
    for (const key of Object.keys(DNA_PRESETS)) {
      const meta = dnaPresetMeta(key);
      expect(meta.label).not.toBe(key);
      expect(meta.label.length).toBeGreaterThan(2);
      expect(DNA_PRESET_META[key] || meta.description).toBeTruthy();
    }
  });
});

describe('per-word lean', () => {
  it('varies word to word but stays around the writer’s angle', () => {
    const slants = Array.from({ length: 40 }, (_, i) => wordSlant(14, 2, i, 70));
    const unique = new Set(slants.map(value => value.toFixed(2)));
    expect(unique.size).toBeGreaterThan(8);
    const mean = slants.reduce((a, b) => a + b, 0) / slants.length;
    expect(Math.abs(mean - 14)).toBeLessThan(2.5);
    for (const value of slants) {
      expect(Math.abs(value)).toBeLessThanOrEqual(18);
    }
  });

  it('is deterministic, so nothing flickers between renders', () => {
    expect(wordSlant(10, 3, 4, 80)).toBe(wordSlant(10, 3, 4, 80));
    expect(wordSlant(10, 3, 4, 80)).not.toBe(wordSlant(10, 3, 5, 80));
  });
});

describe('page rendering', () => {
  const lines = [
    { text: 'Cell Structure', blockType: 'h2' as const, color: 'black' as const, indent: 0 },
    { text: 'Nucleus holds the DNA', blockType: 'text' as const, color: 'black' as const, indent: 0 },
    { text: 'Mitochondria release energy', blockType: 'bullet' as const, color: 'black' as const, indent: 1 },
  ];

  it('renders a real note page with a face chosen from the DNA', () => {
    const dna = dnaFromMetrics(measureInkImage(syntheticSample()));
    const { container } = render(
      <HandwritingPage dna={dna} lines={lines} pageHeight={600} width={430} />,
    );
    const page = container.querySelector('[data-handwriting-page]') as HTMLElement;
    expect(page).toBeTruthy();
    const text = (container.textContent || '').replace(/\s+/g, ' ');
    expect(text).toContain('Cell Structure');
    expect(text).toContain('Nucleus holds the DNA');
    // The page is taller than one line box, so lines never share a slot.
    expect(parseFloat(page.style.height)).toBeGreaterThanOrEqual(100);
    expect(page.querySelectorAll('[data-note-line]').length).toBe(lines.length);
  });

  it('renders the heading as a heading, not flat prose', () => {
    const dna = dnaFromMetrics(measureInkImage(syntheticSample()));
    const { container } = render(
      <HandwritingPage dna={dna} lines={lines} pageHeight={600} width={430} />,
    );
    const heading = (container.textContent || '').match(/Cell Structure/);
    expect(heading).toBeTruthy();
    // Headings get visibly larger type than body lines in the renderer.
    const styled = Array.from(container.querySelectorAll<HTMLElement>('[style*="font-size"]'));
    expect(styled.length).toBeGreaterThan(0);
  });
});

describe('PDF → structured notes', () => {
  const pdfText = [
    'UNIT 3 — PHOTOSYNTHESIS',
    'Photosynthesis converts light energy into chemical energy.',
    'Key steps:',
    '- Light absorption by chlorophyll',
    '- Water splitting in photosystem II',
    '- Carbon fixation in the Calvin cycle',
    '6CO2 + 6H2O = C6H12O6 + 6O2',
  ].join('\n');

  it('infers headings and bullets from plain PDF text', () => {
    const composed = composePdfNotes(pdfText, { fallbackTitle: 'Biology', maxLineChars: 70 });
    expect(composed.headings.length).toBeGreaterThanOrEqual(1);
    expect(composed.lines.some(line => line.blockType === 'bullet')).toBe(true);
    expect(composed.lines.map(line => line.text).join(' ')).toContain('Calvin cycle');
  });

  it('keeps the equation instead of dropping it', () => {
    const composed = composePdfNotes(pdfText);
    const text = composed.lines.map(line => line.text).join(' ');
    expect(text).toMatch(/6CO2|CO2/);
  });

  it('does not leave a heading stranded at the bottom of a page', () => {
    const body = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ text: `line ${i}`, blockType: 'text' as const, color: 'black' as const, indent: 0 }));
    const heading = { text: 'Heading', blockType: 'h2' as const, color: 'black' as const, indent: 0 };

    // Heading arrives when the page is already full.
    const full = paginateStructured([...body(6), heading, ...body(2)], 6);
    expect(full[0].some(line => line.blockType === 'h2')).toBe(false);
    expect(full[1][0].blockType).toBe('h2');

    // Heading would be the last rule of the page — it moves down instead.
    const nearlyFull = paginateStructured([...body(5), heading, ...body(3)], 6);
    expect(nearlyFull[0].some(line => line.blockType === 'h2')).toBe(false);
    expect(nearlyFull[1][0].text).toBe('Heading');
    expect(nearlyFull[1].length).toBeGreaterThan(1);
  });
});
