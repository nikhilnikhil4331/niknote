// Page-by-page PDF pipeline: classify each page, use the text layer when present (no AI call),
// send only scanned pages to OCR, run a few pages in parallel, cache results, and let single pages fail.
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type PageKind = 'digital' | 'scan' | 'blank';
export type PageStatus = 'queued' | 'processing' | 'done' | 'failed' | 'skipped';
export interface PageResult { index: number; kind: PageKind; status: PageStatus; lines: string[]; error?: string; cached?: boolean }

export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export const MAX_PAGES = 50;
export const OCR_CONCURRENCY = 3;

/** Decide how a page should be handled from its text layer and ink coverage (0..1). */
export function classifyPage(textChars: number, inkRatio: number): PageKind {
  if (textChars >= 20) return 'digital';
  if (inkRatio < 0.004) return 'blank';
  return 'scan';
}

/** Only rate limits and server errors are worth retrying. */
export function isRetryable(status?: number): boolean {
  return status === 429 || (status !== undefined && status >= 500);
}

export function backoffMs(attempt: number): number {
  return Math.min(8000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 300);
}

/** Run tasks with a fixed number in flight; one failure never stops the rest. */
export async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const item = items[next++]; try { await worker(item); } catch { /* recorded by worker */ } }
  });
  await Promise.all(lanes);
}

export function validatePdf(file: File): string | null {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return 'Please choose a PDF file';
  if (file.size > MAX_PDF_BYTES) return 'PDF must be under 25MB';
  return null;
}

function groupLines(items: any[]): string[] {
  const rows = new Map<number, { x: number; s: string }[]>();
  for (const it of items) {
    if (!it.str) continue;
    const y = Math.round(it.transform[5] / 3) * 3;
    const row = rows.get(y) ?? []; row.push({ x: it.transform[4], s: it.str }); rows.set(y, row);
  }
  return [...rows.entries()].sort((a, b) => b[0] - a[0])
    .map(([, r]) => r.sort((a, b) => a.x - b.x).map(t => t.s).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Grayscale + contrast stretch + size cap: smaller upload, clearer text for OCR. */
function preprocess(src: HTMLCanvasElement): { dataUrl: string; inkRatio: number } {
  const maxSide = 1700;
  const s = Math.min(1, maxSide / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * s); c.height = Math.round(src.height * s);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height); const d = img.data;
  let min = 255, max = 0;
  for (let i = 0; i < d.length; i += 16) { const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; if (g < min) min = g; if (g > max) max = g; }
  const range = Math.max(1, max - min); let ink = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = ((0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) - min) * 255 / range;
    d[i] = d[i + 1] = d[i + 2] = g; if (g < 140) ink++;
  }
  ctx.putImageData(img, 0, 0);
  return { dataUrl: c.toDataURL('image/jpeg', 0.8), inkRatio: ink / (d.length / 4) };
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const CACHE_PREFIX = 'nn-ocr:';
function readCache(key: string): string[] | null { try { const v = localStorage.getItem(CACHE_PREFIX + key); return v ? JSON.parse(v) : null; } catch { return null; } }
function writeCache(key: string, lines: string[]) { try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(lines)); } catch { /* storage full */ } }

export interface OcrError extends Error { status?: number }
export type OcrFn = (imageBase64: string) => Promise<string[]>;

export interface PipelineHandle {
  pageCount: number;
  firstPageImage: string;
  run: (onUpdate: (p: PageResult) => void) => Promise<PageResult[]>;
  retryPage: (index: number, onUpdate: (p: PageResult) => void) => Promise<PageResult>;
}

export async function openPdfPipeline(file: File, ocr: OcrFn): Promise<PipelineHandle> {
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pageCount = Math.min(doc.numPages, MAX_PAGES);
  const images = new Map<number, string>();
  let firstPageImage = '';

  const render = async (n: number, scale: number) => {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas'); canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
    return canvas;
  };

  const ocrWithRetry = async (img: string): Promise<{ lines: string[]; cached: boolean }> => {
    const key = await sha256(img);
    const hit = readCache(key); if (hit) return { lines: hit, cached: true };
    for (let attempt = 0; ; attempt++) {
      try { const lines = await ocr(img); writeCache(key, lines); return { lines, cached: false }; }
      catch (e) {
        const status = (e as OcrError).status;
        if (!isRetryable(status) || attempt >= 2) throw e;
        await new Promise(r => setTimeout(r, backoffMs(attempt)));
      }
    }
  };

  const ocrPage = async (index: number, onUpdate: (p: PageResult) => void): Promise<PageResult> => {
    onUpdate({ index, kind: 'scan', status: 'processing', lines: [] });
    try {
      const { lines, cached } = await ocrWithRetry(images.get(index)!);
      const r: PageResult = { index, kind: 'scan', status: 'done', lines, cached }; onUpdate(r); return r;
    } catch (e) {
      const r: PageResult = { index, kind: 'scan', status: 'failed', lines: [], error: (e as Error).message || 'Could not read page' };
      onUpdate(r); return r;
    }
  };

  // Fast pass: text layers are free and instant; only scans are queued for OCR.
  const results: PageResult[] = [];
  const scanQueue: number[] = [];
  for (let n = 1; n <= pageCount; n++) {
    const page = await doc.getPage(n);
    const lines = groupLines((await page.getTextContent()).items as any[]);
    const chars = lines.join('').length;
    if (n === 1) firstPageImage = (await render(1, 0.8)).toDataURL('image/jpeg', 0.7);
    if (chars >= 20) { results[n - 1] = { index: n - 1, kind: 'digital', status: 'done', lines }; continue; }
    const { dataUrl, inkRatio } = preprocess(await render(n, 2));
    const kind = classifyPage(chars, inkRatio);
    if (kind === 'blank') { results[n - 1] = { index: n - 1, kind, status: 'skipped', lines: [] }; continue; }
    images.set(n - 1, dataUrl); scanQueue.push(n - 1);
    results[n - 1] = { index: n - 1, kind: 'scan', status: 'queued', lines: [] };
  }

  return {
    pageCount, firstPageImage,
    run: async (onUpdate) => {
      results.forEach(onUpdate);
      await runPool(scanQueue, OCR_CONCURRENCY, async (i) => { results[i] = await ocrPage(i, onUpdate); });
      return results;
    },
    retryPage: async (i, onUpdate) => (results[i] = await ocrPage(i, onUpdate)),
  };
}

export function assemble(results: PageResult[]): string[] {
  const out: string[] = [];
  for (const r of results) { if (!r?.lines.length) continue; if (out.length) out.push(''); out.push(...r.lines); }
  return out;
}
