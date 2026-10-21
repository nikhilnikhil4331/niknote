import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DNA_PRESETS } from '@/components/handwriting-dna/HandwritingDNAEngine';
import { dnaFromMetrics, measureInkImage, type InkImage } from '@/lib/handwritingAnalysis';
import {
  dnaPreviewCSS,
  dnaPresetMeta,
  handwritingClassForDNA,
  noteSettingsForDNA,
  paginateStructured,
} from '@/lib/handwritingStyle';
import { HandwritingPage } from '@/components/handwriting-dna/HandwritingPage';
import { composePdfNotes, plainTextToMarkdown } from '@/lib/aiNotes';
import type { StructuredLine } from '@/lib/noteStructure';

/** Draw synthetic handwriting: N lines of slanted vertical strokes on white. */
function syntheticSample(options: {
  lines?: number;
  slantDeg?: number;
  strokeWidth?: number;
  lineHeight?: number;
  strokeHeight?: number;
  letterGap?: number;
} = {}): InkImage {
  const {
    lines = 4, slantDeg = 15, strokeWidth = 4, lineHeight = 70, strokeHeight = 30, letterGap = 14,
  } = options;
  const width = 420;
  const height = lines * lineHeight + 40;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const shift = Math.tan((slantDeg * Math.PI) / 180) * strokeHeight;

  for (let line = 0; line < lines; line++) {
    const baseline = 50 + line * lineHeight;
    for (let letter = 0; letter < 20; letter++) {
      const x0 = 30 + letter * letterGap;
      for (let t = 0; t <= strokeHeight; t++) {
        const y = baseline - t;
        const xAt = x0 + (t / strokeHeight) * shift;
        for (let w = 0; w < strokeWidth; w++) {
          const x = Math.round(xAt + w);
          if (x < 0 || x >= width || y < 0 || y >= height) continue;
          const p = (y * width + x) * 4;
          data[p] = 20; data[p + 1] = 24; data[p + 2] = 60; data[p + 3] = 255;
        }
      }
    }
  }
  return { data, width, height };
}

describe('handwriting analysis measures the ink, not the margins', () => {
  it('finds the real line count and slant of a sample', () => {
    const metrics = measureInkImage(syntheticSample({ lines: 4, slantDeg: 15 }));

    expect(metrics.lines).toBe(4);
    // Right-leaning strokes must read as a positive slant.
    expect(metrics.slant).toBeGreaterThan(8);
    expect(metrics.slant).toBeLessThan(22);
    expect(metrics.xHeight).toBeGreaterThan(10);
    expect(metrics.strokeWidth).toBeGreaterThan(1);
    expect(metrics.confidence).toBeGreaterThan(0.4);
  });

  it('reads a mirrored (left-leaning) sample with the opposite sign', () => {
    const metrics = measureInkImage(syntheticSample({ lines: 3, slantDeg: -14 }));
    expect(metrics.slant).toBeLessThan(-6);
  });

  it('refuses to invent numbers when the photo has no ink', () => {
    const blank: InkImage = { data: new Uint8ClampedArray(200 * 200 * 4).fill(255), width: 200, height: 200 };
    const metrics = measureInkImage(blank);
    expect(metrics.lines).toBe(0);
    expect(metrics.confidence).toBe(0);
  });

  it('fills the extended DNA fields the page renderer needs', () => {
    const dna = dnaFromMetrics(measureInkImage(syntheticSample()));
    expect(dna.closestFont).toBeTruthy();
    expect(dna.penPressure).toBeGreaterThan(0);
    expect(dna.penPressure).toBeLessThanOrEqual(1);
    expect(dna.strokeThickness).toBeGreaterThanOrEqual(0.75);
    expect(dna.letterSpacing).toBeGreaterThan(0);
    expect(dna.wordSpacing).toBeGreaterThanOrEqual(3);
    expect(dna.styleName.length).toBeGreaterThan(3);
    expect(dna.confidence).toBeGreaterThan(0.4);
  });
});

describe('DNA → page settings never stack lines on top of each other', () => {
  it('always leaves at least 1.38 × font size of leading for every preset', () => {
    for (const [key, preset] of Object.entries(DNA_PRESETS)) {
      const settings = noteSettingsForDNA(preset);
      expect(settings.lineSpacing, key).toBeGreaterThanOrEqual(Math.round(settings.fontSize * 1.38));
      expect(settings.fontSize).toBeGreaterThanOrEqual(16);
      expect(settings.fontSize).toBeLessThanOrEqual(30);
      expect(settings.font).toBeTruthy();
    }
  });

  it('gives every preset a real label instead of a raw key', () => {
    for (const key of Object.keys(DNA_PRESETS)) {
      const meta = dnaPresetMeta(key);
      expect(meta.label).not.toBe(key);
      expect(meta.description.length).toBeGreaterThan(6);
      expect(meta.emoji.length).toBeGreaterThan(0);
    }
  });

  it('keeps the inline preview leading unitless (the old 2.3px bug)', () => {
    const css = dnaPreviewCSS(DNA_PRESETS.neat_student);
    expect(typeof css.lineHeight).toBe('number');
    expect(css.lineHeight as number).toBeGreaterThanOrEqual(1.35);
  });
});

describe('a handwriting page renders like the notebook', () => {
  const lines: StructuredLine[] = [
    { text: 'Cell Structure', blockType: 'h1', color: 'black', indent: 0 },
    { text: 'The cell is the basic unit of life.', blockType: 'text', color: 'navy', indent: 0 },
    { text: 'Nucleus holds the DNA', blockType: 'bullet', color: 'navy', indent: 0 },
  ];

  it('uses the face chosen for the DNA and keeps every line on its own rule', () => {
    const dna = dnaFromMetrics(measureInkImage(syntheticSample()));
    const { container } = render(
      <HandwritingPage dna={dna} lines={lines} pageHeight={500} width={400} label="test page" />,
    );

    const page = container.querySelector('[data-handwriting-page="true"]') as HTMLElement;
    expect(page).toBeTruthy();
    const expectedClass = handwritingClassForDNA(dna);
    expect(page.querySelector(`.${expectedClass}`)).not.toBeNull();

    // Every rendered line box is at least as tall as the text it holds.
    const settings = noteSettingsForDNA(dna);
    // Each written line sits in a box at least as tall as its own text, so two
    // lines can never be printed on top of each other.
    const boxes = Array.from(page.querySelectorAll<HTMLElement>('div[style*="min-height"]'))
      .map(el => parseFloat(el.style.minHeight || '0'))
      .filter(value => value > 0);
    expect(boxes.length).toBeGreaterThanOrEqual(lines.length);
    expect(Math.min(...boxes)).toBeGreaterThanOrEqual(settings.fontSize * 1.3);
  });

  it('shows the heading as a real heading, not flat prose', () => {
    const dna = dnaFromMetrics(measureInkImage(syntheticSample()));
    const { container } = render(<HandwritingPage dna={dna} lines={lines} pageHeight={500} width={400} />);
    // Words are rendered as separate spans (one per word), so compare textContent.
    const text = (container.textContent || '').replace(/\s+/g, ' ');
    expect(text).toContain('Cell Structure');
    expect(text).toContain('Nucleus holds the DNA');
    // The heading is underlined like a written title, body lines are not.
    expect(container.querySelector('[style*="underline"]')).not.toBeNull();
  });
});

describe('PDF → proper notes in that handwriting', () => {
  const pdfText = [
    'UNIT 3 — PHOTOSYNTHESIS',
    'Photosynthesis is the process by which green plants convert light energy into chemical energy.',
    'Key steps:',
    '- Light absorption by chlorophyll',
    '- Water splitting and oxygen release',
    '- Carbon dioxide fixation into glucose',
    'Equation: 6CO2 + 6H2O -> C6H12O6 + 6O2',
  ].join('\n');

  it('infers structure from plain PDF text (no markdown present)', () => {
    const markdown = plainTextToMarkdown(pdfText);
    expect(markdown).toMatch(/^## /m);      // ALL CAPS title became a heading
    expect(markdown).toMatch(/^- /m);       // list items stayed lists
    expect(markdown).toContain('$$');       // the equation was preserved as math
  });

  it('keeps headings, bullets and the equation from the source text', () => {
    const composed = composePdfNotes(pdfText, { fallbackTitle: 'Biology', maxLineChars: 66 });
    expect(composed.headings.length).toBeGreaterThan(0);
    const kinds = new Set(composed.lines.map(line => line.blockType));
    expect(kinds.has('bullet')).toBe(true);
    expect(composed.lines.some(line => /6CO2/.test(line.text))).toBe(true);
    // No assistant chatter, no markdown noise left behind.
    expect(composed.lines.every(line => !line.text.includes('**'))).toBe(true);
  });

  it('paginates without stranding a heading at the bottom of a page', () => {
    const lines: StructuredLine[] = [
      ...Array.from({ length: 3 }, (_, i) => ({ text: `body ${i}`, blockType: 'text' as const, color: 'navy' as const, indent: 0 })),
      { text: 'Next Section', blockType: 'h2' as const, color: 'black' as const, indent: 0 },
      { text: 'after', blockType: 'text' as const, color: 'navy' as const, indent: 0 },
    ];

    const pages = paginateStructured(lines, 4);
    expect(pages.length).toBeGreaterThan(1);
    const lastOnFirstPage = pages[0][pages[0].length - 1];
    expect(lastOnFirstPage.blockType).not.toBe('h2');
  });
});
