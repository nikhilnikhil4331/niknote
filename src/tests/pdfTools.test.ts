import { describe, expect, test } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  addPageNumbers, addWatermark, countPdfPages, deletePages, detectImageType, extractPages,
  formatBytes, formatPageNumber, imagesToPdf, loadPdf, mergePdfs, outputName, pagesLabel,
  parsePageRanges, rotatePages, sanitizePdfText, splitPlan,
} from '@/lib/pdfTools';

// Smallest valid 1×1 PNG — used to prove image → PDF works.
const PNG_1PX = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0)
);

async function makePdf(pageCount: number, size: [number, number] = [300, 400]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) doc.addPage(size);
  return doc.save();
}

describe('page ranges', () => {
  test('plain lists, ranges and open ends', () => {
    expect(parsePageRanges('1-3, 7', 10)).toEqual([1, 2, 3, 7]);
    expect(parsePageRanges('9-', 10)).toEqual([9, 10]);
    expect(parsePageRanges('', 3)).toEqual([1, 2, 3]);
    expect(parsePageRanges('all', 2)).toEqual([1, 2]);
  });

  test('odd / even / last helpers', () => {
    expect(parsePageRanges('odd', 6)).toEqual([1, 3, 5]);
    expect(parsePageRanges('even', 6)).toEqual([2, 4, 6]);
    expect(parsePageRanges('last', 6)).toEqual([6]);
  });

  test('clamps junk and duplicates', () => {
    expect(parsePageRanges('2,2,2', 5)).toEqual([2]);
    expect(parsePageRanges('0, 1, 99', 5)).toEqual([1]);
    expect(parsePageRanges('x, y', 5)).toEqual([]);
    expect(parsePageRanges('1', 0)).toEqual([]);
  });

  test('labels collapse consecutive pages', () => {
    expect(pagesLabel([1, 2, 3, 7])).toBe('1-3, 7');
    expect(pagesLabel([4])).toBe('4');
    expect(pagesLabel([])).toBe('none');
  });
});

describe('split plans', () => {
  test('one file per page', () => {
    expect(splitPlan('each', 3)).toEqual([[1], [2], [3]]);
  });

  test('chunks of N pages, last chunk trimmed', () => {
    expect(splitPlan('chunks', 5, { chunkSize: 2 })).toEqual([[1, 2], [3, 4], [5]]);
  });

  test('custom ranges keep their order and drop empties', () => {
    expect(splitPlan('ranges', 10, { ranges: '1-2, 5, 99' })).toEqual([[1, 2], [5]]);
  });
});

describe('merge & page surgery', () => {
  test('merge keeps every page in order', async () => {
    const a = await makePdf(2);
    const b = await makePdf(3, [200, 200]);
    const merged = await mergePdfs([a, b]);
    expect(await countPdfPages(merged)).toBe(5);
  });

  test('merge needs at least one document', async () => {
    await expect(mergePdfs([])).rejects.toThrow();
  });

  test('extract keeps only the requested pages', async () => {
    const src = await makePdf(5);
    const out = await extractPages(src, [2, 4]);
    expect(await countPdfPages(out)).toBe(2);
    await expect(extractPages(src, [99])).rejects.toThrow();
  });

  test('delete removes pages but never all of them', async () => {
    const src = await makePdf(4);
    expect(await countPdfPages(await deletePages(src, [1, 4]))).toBe(2);
    await expect(deletePages(src, [1, 2, 3, 4])).rejects.toThrow();
  });

  test('rotate accumulates per page', async () => {
    const src = await makePdf(3);
    const rotated = await rotatePages(src, 90, [2]);
    const doc = await loadPdf(rotated);
    expect(doc.getPage(0).getRotation().angle).toBe(0);
    expect(doc.getPage(1).getRotation().angle).toBe(90);
  });
});

describe('watermark', () => {
  test('adds ink without changing the page count', async () => {
    const src = await makePdf(2);
    const marked = await addWatermark(src, { text: 'DRAFT', opacity: 0.2 });
    expect(await countPdfPages(marked)).toBe(2);
    expect(marked.byteLength).toBeGreaterThan(0);
  });

  test('tiled watermarks work too', async () => {
    const src = await makePdf(1);
    const marked = await addWatermark(src, { text: 'CONFIDENTIAL', position: 'tile' });
    expect(await countPdfPages(marked)).toBe(1);
  });

  test('Hindi/emoji text is sanitised instead of crashing', async () => {
    const src = await makePdf(1);
    const marked = await addWatermark(src, { text: 'नमस्ते ✅ NikNote', opacity: 0.3 });
    expect(await countPdfPages(marked)).toBe(1);
  });

  test('empty text is rejected', async () => {
    const src = await makePdf(1);
    await expect(addWatermark(src, { text: '   ' })).rejects.toThrow();
  });
});

describe('page numbers', () => {
  test('template rendering', () => {
    expect(formatPageNumber('Page {n} of {total}', 3, 10)).toBe('Page 3 of 10');
    expect(formatPageNumber('{n}', 7, 10)).toBe('7');
    expect(formatPageNumber('{page} / {total}', 2, 4)).toBe('2 / 4');
  });

  test('numbers every page except the cover when skipped', async () => {
    const src = await makePdf(3);
    const numbered = await addPageNumbers(src, { skipFirst: true, startAt: 1 });
    expect(await countPdfPages(numbered)).toBe(3);
  });
});

describe('images → PDF', () => {
  test('one image becomes one A4 page', async () => {
    const out = await imagesToPdf([{ bytes: PNG_1PX, type: 'png' }], { paper: 'a4' });
    const doc = await loadPdf(out);
    expect(doc.getPageCount()).toBe(1);
    expect(Math.round(doc.getPage(0).getSize().width)).toBe(595);
  });

  test('fit mode uses the image size plus margins', async () => {
    const out = await imagesToPdf([{ bytes: PNG_1PX, type: 'png' }], { paper: 'fit', margin: 10 });
    const doc = await loadPdf(out);
    expect(doc.getPage(0).getSize().width).toBe(21);
    expect(doc.getPage(0).getSize().height).toBe(21);
  });

  test('no images is an error', async () => {
    await expect(imagesToPdf([])).rejects.toThrow();
  });

  test('file signatures beat lying mime types', () => {
    expect(detectImageType(PNG_1PX)).toBe('png');
    expect(detectImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg');
    expect(detectImageType(Uint8Array.from([1, 2, 3, 4]))).toBeNull();
  });
});

describe('text + file helpers', () => {
  test('sanitize keeps PDF-safe characters only', () => {
    expect(sanitizePdfText('  नमस्ते   NikNote ✅ ')).toBe('NikNote');
    expect(sanitizePdfText('“Quotes” — dash')).toBe('"Quotes" - dash');
  });

  test('output names stay readable and safe', () => {
    expect(outputName('my notes.pdf', 'merged')).toBe('my notes-merged.pdf');
    expect(outputName('../../etc/passwd', 'clean')).toBe('passwd-clean.pdf');
    expect(outputName('', 'merged')).toBe('niknote-merged.pdf');
  });

  test('byte formatting', () => {
    expect(formatBytes(0)).toBe('0 KB');
    expect(formatBytes(900)).toBe('900 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
