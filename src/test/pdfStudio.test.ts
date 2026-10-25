import { describe, it, expect } from 'vitest';
import { PDFDocument, degrees } from 'pdf-lib';
import {
  PAGE_SIZES,
  annotationBounds,
  baseName,
  clamp01,
  exportAnnotatedPdf,
  hitTest,
  toPagePoint,
  translateAnnotation,
  type Annotation,
  type PdfPageEntry,
} from '@/lib/pdfStudio';

const ink: Annotation = {
  id: 'a1',
  type: 'ink',
  page: 'src-0',
  points: [
    { x: 0.1, y: 0.1 },
    { x: 0.3, y: 0.25 },
  ],
  color: '#ef4444',
  width: 0.003,
  opacity: 1,
};

const text: Annotation = {
  id: 'a2',
  type: 'text',
  page: 'src-0',
  at: { x: 0.5, y: 0.5 },
  text: 'Signed by Nikhil',
  color: '#111827',
  size: 0.03,
  font: 'cursive',
  bold: true,
};

const shape: Annotation = {
  id: 'a3',
  type: 'shape',
  page: 'src-0',
  shape: 'arrow',
  from: { x: 0.2, y: 0.6 },
  to: { x: 0.6, y: 0.8 },
  color: '#2563eb',
  width: 0.004,
  opacity: 1,
};

describe('PDF Studio annotation model', () => {
  it('normalises pointer positions and clamps them to the page', () => {
    const rect = { left: 100, top: 50, width: 200, height: 400 } as DOMRect;
    expect(toPagePoint(rect, 200, 250)).toEqual({ x: 0.5, y: 0.5 });
    expect(toPagePoint(rect, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(toPagePoint(rect, 999, 999)).toEqual({ x: 1, y: 1 });
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(4)).toBe(1);
  });

  it('hit-tests and moves every annotation type', () => {
    expect(hitTest(ink, { x: 0.2, y: 0.18 })).toBe(true);
    expect(hitTest(ink, { x: 0.9, y: 0.9 })).toBe(false);
    expect(hitTest(text, { x: 0.52, y: 0.52 })).toBe(true);
    expect(hitTest(shape, { x: 0.4, y: 0.7 })).toBe(true);

    const moved = translateAnnotation(text, 0.1, 0.05);
    expect((moved as any).at).toEqual({ x: 0.6, y: 0.55 });

    const b = annotationBounds(text);
    expect(b.x1).toBeCloseTo(0.5);
    expect(b.y2).toBeGreaterThan(b.y1);
  });

  it('cleans up file names', () => {
    expect(baseName('My Thesis.pdf')).toBe('My Thesis');
    expect(baseName('report.PDF')).toBe('report');
    expect(baseName('')).toBe('document');
  });
});

describe('PDF Studio export', () => {
  it('writes every page (rotated, blank, duplicated) into a valid new PDF', async () => {
    const source = await PDFDocument.create();
    source.addPage([595, 842]);
    const rotated = source.addPage([595, 842]);
    rotated.setRotation(degrees(90));
    const bytes = await source.save();

    const pages: PdfPageEntry[] = [
      { id: 'src-0', kind: 'original', srcIndex: 0, rotation: 0, width: 595, height: 842 },
      { id: 'src-1', kind: 'original', srcIndex: 1, rotation: 90, width: 842, height: 595 },
      { id: 'blank-1', kind: 'blank', srcIndex: -1, rotation: 0, width: 595, height: 842 },
      { id: 'dup-1', kind: 'original', srcIndex: 0, rotation: 0, width: 595, height: 842 },
    ];

    const out = await exportAnnotatedPdf({
      bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      pages,
      annotations: [ink, text, shape],
    });

    expect(out).toBeInstanceOf(Uint8Array);
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(4);
    expect(reloaded.getPage(1).getRotation().angle).toBe(90);
    expect(reloaded.getPage(2).getSize()).toEqual({ width: 595, height: 842 });
    expect(reloaded.getTitle()).toBeUndefined();
  });

  it('reports progress for every page and supports standard blank page sizes', async () => {
    const source = await PDFDocument.create();
    source.addPage([595, 842]);
    const bytes = await source.save();

    const pages: PdfPageEntry[] = [
      { id: 'src-0', kind: 'original', srcIndex: 0, rotation: 0, width: 595, height: 842 },
      { id: 'a4', kind: 'blank', srcIndex: -1, rotation: 0, ...PAGE_SIZES.a4 },
      { id: 'letter', kind: 'blank', srcIndex: -1, rotation: 0, ...PAGE_SIZES.letter },
    ];

    const seen: string[] = [];
    const out = await exportAnnotatedPdf({
      bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      pages,
      annotations: [ink],
      onProgress: (done, total) => seen.push(`${done}/${total}`),
    });

    expect(seen).toEqual(['1/3', '2/3', '3/3']);
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(3);
    expect(Math.round(reloaded.getPage(1).getSize().width)).toBe(595);
    expect(Math.round(reloaded.getPage(2).getSize().width)).toBe(612);
    expect(Math.round(reloaded.getPage(2).getSize().height)).toBe(792);
  });
});
