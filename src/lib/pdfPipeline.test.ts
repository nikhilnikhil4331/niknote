/// <reference types="bun" />
import { describe, expect, test, mock } from 'bun:test';
mock.module('pdfjs-dist', () => ({ GlobalWorkerOptions: {} }));
mock.module('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '' }));
const { classifyPage, isRetryable, runPool, assemble } = await import('./pdfPipeline');

describe('pdf pipeline rules', () => {
  test('pages with a text layer skip OCR', () => expect(classifyPage(120, 0.2)).toBe('digital'));
  test('empty pages are skipped', () => expect(classifyPage(0, 0.001)).toBe('blank'));
  test('image-only pages go to OCR', () => expect(classifyPage(3, 0.05)).toBe('scan'));
  test('only 429 and 5xx are retried', () => {
    expect(isRetryable(429)).toBe(true); expect(isRetryable(503)).toBe(true);
    expect(isRetryable(400)).toBe(false); expect(isRetryable(402)).toBe(false);
  });
  test('one failing page does not stop the others', async () => {
    const done: number[] = [];
    await runPool([1, 2, 3, 4], 2, async (n) => { if (n === 2) throw new Error('x'); done.push(n); });
    expect(done.sort()).toEqual([1, 3, 4]);
  });
  test('failed pages are left out of the assembled text', () => {
    expect(assemble([
      { index: 0, kind: 'digital', status: 'done', lines: ['a'] },
      { index: 1, kind: 'scan', status: 'failed', lines: [] },
      { index: 2, kind: 'scan', status: 'done', lines: ['c'] },
    ])).toEqual(['a', '', 'c']);
  });
});
