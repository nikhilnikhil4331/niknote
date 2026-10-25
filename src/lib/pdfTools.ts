// ============================================================
// NikNote PDF Tools — the "everything else" half of PDF Studio
// Merge · split · extract · delete · rotate · watermark · page numbers · images → PDF
//
// Everything in this file is pure pdf-lib work: it runs on-device, never
// uploads a file, and is fully unit-testable in Node (no canvas needed).
// ============================================================

import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont } from 'pdf-lib';

export const A4: [number, number] = [595.28, 841.89];
export const LETTER: [number, number] = [612, 792];
export const LEGAL: [number, number] = [612, 1008];
export const A5: [number, number] = [419.53, 595.28];

export type PaperKey = 'fit' | 'a4' | 'letter' | 'legal' | 'a5';

export const PAPER_SIZES: Record<Exclude<PaperKey, 'fit'>, [number, number]> = {
  a4: A4,
  letter: LETTER,
  legal: LEGAL,
  a5: A5,
};

export const PAPER_LABELS: Record<PaperKey, string> = {
  fit: 'Image size',
  a4: 'A4',
  letter: 'Letter',
  legal: 'Legal',
  a5: 'A5',
};

// ── page-range parsing ───────────────────────────────────────

/**
 * Turns human input into a sorted list of 1-based page numbers.
 * Accepts `1-3, 7, 9-`, `all`, `odd`, `even`, `last` and clamps to the doc.
 */
export function parsePageRanges(input: string, total: number): number[] {
  if (!Number.isFinite(total) || total < 1) return [];
  const raw = String(input ?? '').trim().toLowerCase();
  if (!raw || raw === 'all' || raw === '*') {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const picked = new Set<number>();
  for (const rawToken of raw.split(/[,;]+/)) {
    const token = rawToken.trim();
    if (!token) continue;
    if (token === 'all' || token === '*') {
      for (let i = 1; i <= total; i += 1) picked.add(i);
      continue;
    }
    if (token === 'odd') {
      for (let i = 1; i <= total; i += 2) picked.add(i);
      continue;
    }
    if (token === 'even') {
      for (let i = 2; i <= total; i += 2) picked.add(i);
      continue;
    }
    if (token === 'last') {
      picked.add(total);
      continue;
    }

    const range = token.match(/^(\d+)?\s*(?:-|–|to)\s*(\d+)?$/);
    if (range) {
      const start = range[1] ? Number(range[1]) : 1;
      const end = range[2] ? Number(range[2]) : total;
      const from = Math.max(1, Math.min(start, end));
      const to = Math.min(total, Math.max(start, end));
      for (let i = from; i <= to; i += 1) picked.add(i);
      continue;
    }

    if (/^\d+$/.test(token)) {
      const n = Number(token);
      if (n >= 1 && n <= total) picked.add(n);
    }
  }

  return Array.from(picked).sort((a, b) => a - b);
}

/** `[1,2,3,7]` → `"1-3, 7"` — used for labels and file names. */
export function pagesLabel(pages: number[]): string {
  if (pages.length === 0) return 'none';
  const sorted = Array.from(new Set(pages)).sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i += 1) {
    const n = sorted[i];
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = n;
    prev = n;
  }
  return parts.join(', ');
}

export type SplitMode = 'each' | 'chunks' | 'ranges';

/**
 * Works out which pages go into which output file.
 * `each`   → one file per page
 * `chunks` → one file per N pages
 * `ranges` → every comma group becomes its own file ("1-3, 4-6")
 */
export function splitPlan(mode: SplitMode, total: number, opts: { chunkSize?: number; ranges?: string } = {}): number[][] {
  if (!Number.isFinite(total) || total < 1) return [];
  if (mode === 'each') {
    return Array.from({ length: total }, (_, i) => [i + 1]);
  }
  if (mode === 'chunks') {
    const size = Math.max(1, Math.floor(opts.chunkSize || 1));
    const plan: number[][] = [];
    for (let i = 1; i <= total; i += size) {
      plan.push(Array.from({ length: Math.min(size, total - i + 1) }, (_, k) => i + k));
    }
    return plan;
  }
  const groups = String(opts.ranges ?? '')
    .split(/[,;]+/)
    .map((g) => g.trim())
    .filter(Boolean);
  return groups.map((g) => parsePageRanges(g, total)).filter((pages) => pages.length > 0);
}

// ── small pdf-lib helpers ────────────────────────────────────

export async function loadPdf(bytes: Uint8Array | ArrayBuffer): Promise<PDFDocument> {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
}

/** Pages + whether the file is password-protected (readable without the password). */
export async function inspectPdf(
  bytes: Uint8Array | ArrayBuffer
): Promise<{ pages: number; encrypted: boolean }> {
  try {
    const doc = await loadPdf(bytes);
    return { pages: doc.getPageCount(), encrypted: Boolean((doc as any).isEncrypted) };
  } catch {
    // Encrypted files still expose the page tree — enough for the Unlock tool.
    const doc = await PDFDocument.load(toBytes(bytes), {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    return { pages: doc.getPageCount(), encrypted: true };
  }
}

export async function countPdfPages(bytes: Uint8Array | ArrayBuffer): Promise<number> {
  const { pages } = await inspectPdf(bytes);
  return pages;
}

export function toBytes(input: Uint8Array | ArrayBuffer): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

/** pdf-lib's standard fonts only speak WinAnsi — strip anything exotic. */
export function sanitizePdfText(text: string): string {
  return String(text ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2022]/g, '-')
    .replace(/[^\x20-\xFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = String(hex || '').replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const m = full.match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(m[1], 16) / 255,
    g: parseInt(m[2], 16) / 255,
    b: parseInt(m[3], 16) / 255,
  };
}

function colorOf(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return rgb(r, g, b);
}

async function standardFont(doc: PDFDocument, bold = false): Promise<PDFFont> {
  return doc.embedFont(bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica);
}

// ── merge / extract / delete / rotate ───────────────────────

export async function mergePdfs(docs: Array<Uint8Array | ArrayBuffer>): Promise<Uint8Array> {
  if (docs.length === 0) throw new Error('Add at least one PDF to merge');
  const out = await PDFDocument.create();
  for (const entry of docs) {
    const src = await loadPdf(entry);
    const indices = src.getPageIndices();
    const copied = await out.copyPages(src, indices);
    copied.forEach((page) => out.addPage(page));
  }
  out.setProducer('NikNote PDF Tools');
  out.setCreator('NikNote');
  return out.save();
}

export async function extractPages(bytes: Uint8Array | ArrayBuffer, pages: number[]): Promise<Uint8Array> {
  const src = await loadPdf(bytes);
  const total = src.getPageCount();
  const wanted = Array.from(new Set(pages)).filter((n) => n >= 1 && n <= total);
  if (wanted.length === 0) throw new Error(`Pick at least one page (1-${total})`);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, wanted.map((n) => n - 1));
  copied.forEach((page) => out.addPage(page));
  out.setProducer('NikNote PDF Tools');
  return out.save();
}

export async function deletePages(bytes: Uint8Array | ArrayBuffer, pages: number[]): Promise<Uint8Array> {
  const src = await loadPdf(bytes);
  const total = src.getPageCount();
  const remove = new Set(pages.filter((n) => n >= 1 && n <= total));
  if (remove.size >= total) throw new Error('Keep at least one page');
  const keep = src.getPageIndices().filter((i) => !remove.has(i + 1));
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, keep);
  copied.forEach((page) => out.addPage(page));
  return out.save();
}

export async function rotatePages(
  bytes: Uint8Array | ArrayBuffer,
  angle: 90 | 180 | 270,
  pages?: number[]
): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  const total = doc.getPageCount();
  const targets = pages && pages.length > 0 ? new Set(pages) : null;
  doc.getPages().forEach((page, index) => {
    if (targets && !targets.has(index + 1)) return;
    const current = page.getRotation().angle || 0;
    page.setRotation(degrees(((current + angle) % 360 + 360) % 360));
  });
  if (targets && Array.from(targets).every((n) => n < 1 || n > total)) {
    throw new Error(`Pick at least one page (1-${total})`);
  }
  return doc.save();
}

/** Fit a page's rotation so it reads upright (used after a scan). */
export async function normalizeRotation(bytes: Uint8Array | ArrayBuffer): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  doc.getPages().forEach((page) => page.setRotation(degrees(0)));
  return doc.save();
}

// ── watermark ───────────────────────────────────────────────

export type WatermarkPosition = 'center' | 'tile' | 'top' | 'bottom';

export type WatermarkOptions = {
  /** Watermark text — Hindi/emoji are stripped so the export never fails. */
  text: string;
  /** 0..1 */
  opacity?: number;
  /** degrees, counter-clockwise */
  angle?: number;
  /** points; 0 = auto-fit the page */
  size?: number;
  color?: string;
  position?: WatermarkPosition;
  bold?: boolean;
  /** limit to these 1-based pages (default: all) */
  pages?: number[];
};

export async function addWatermark(
  bytes: Uint8Array | ArrayBuffer,
  options: WatermarkOptions
): Promise<Uint8Array> {
  const text = sanitizePdfText(options.text || 'NikNote');
  if (!text) throw new Error('Watermark text is empty');
  const doc = await loadPdf(bytes);
  const font = await standardFont(doc, options.bold ?? false);
  const color = colorOf(options.color || '#ef4444');
  const opacity = Math.min(1, Math.max(0.02, options.opacity ?? 0.18));
  const angle = Number.isFinite(options.angle) ? Number(options.angle) : 45;
  const position = options.position || 'center';
  const only = options.pages && options.pages.length > 0 ? new Set(options.pages) : null;

  doc.getPages().forEach((page, index) => {
    if (only && !only.has(index + 1)) return;
    const { width, height } = page.getSize();
    const base = options.size && options.size > 0 ? options.size : Math.max(10, Math.min(width, height) * 0.12);
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const drawCentered = (cx: number, cy: number, size: number) => {
      const textWidth = font.widthOfTextAtSize(text, size);
      const x = cx - (textWidth / 2) * cos + (size * 0.36) * sin;
      const y = cy - (textWidth / 2) * sin - (size * 0.36) * cos;
      page.drawText(text, { x, y, size, font, color, opacity, rotate: degrees(angle) });
    };

    if (position === 'tile') {
      const step = base * (1 + text.length * 0.22);
      for (let y = step / 2; y < height + step; y += step) {
        for (let x = step / 2; x < width + step; x += step) {
          drawCentered(x, y, base * 0.7);
        }
      }
      return;
    }

    if (position === 'top' || position === 'bottom') {
      const y = position === 'top' ? height - base * 1.6 : base * 1.2;
      drawCentered(width / 2, y, base * 0.8);
      return;
    }

    // Auto-shrink so long text still fits across the diagonal.
    const diagonal = Math.hypot(width, height) * 0.86;
    let size = base;
    while (font.widthOfTextAtSize(text, size) > diagonal && size > 6) size -= 1;
    drawCentered(width / 2, height / 2, size);
  });

  return doc.save();
}

// ── page numbers ────────────────────────────────────────────

export type PageNumberPosition =
  | 'bottom-center' | 'bottom-right' | 'bottom-left'
  | 'top-center' | 'top-right' | 'top-left';

export type PageNumberOptions = {
  /** Supports {n}, {total} and {page} — default "Page {n} of {total}". */
  format?: string;
  position?: PageNumberPosition;
  startAt?: number;
  size?: number;
  color?: string;
  margin?: number;
  skipFirst?: boolean;
  bold?: boolean;
  pages?: number[];
};

export function formatPageNumber(template: string, n: number, total: number, offset = 0): string {
  return sanitizePdfText(
    String(template || 'Page {n} of {total}')
      .replace(/\{n\}/g, String(n))
      .replace(/\{page\}/g, String(n))
      .replace(/\{total\}/g, String(total))
  ) || `${n} / ${total}`;
}

export async function addPageNumbers(
  bytes: Uint8Array | ArrayBuffer,
  options: PageNumberOptions = {}
): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  const font = await standardFont(doc, options.bold ?? false);
  const color = colorOf(options.color || '#111827');
  const position = options.position || 'bottom-center';
  const size = options.size && options.size > 0 ? options.size : 11;
  const margin = options.margin && options.margin > 0 ? options.margin : size * 1.6;
  const startAt = Number.isFinite(options.startAt) ? Number(options.startAt) : 1;
  const only = options.pages && options.pages.length > 0 ? new Set(options.pages) : null;
  const total = doc.getPageCount();

  doc.getPages().forEach((page, index) => {
    const human = index + 1;
    if (options.skipFirst && human === 1) return;
    if (only && !only.has(human)) return;

    const label = formatPageNumber(options.format || 'Page {n} of {total}', startAt + index, total);
    if (!label) return;
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(label, size);
    const isTop = position.startsWith('top');
    const y = isTop ? height - margin : margin;
    let x = (width - textWidth) / 2;
    if (position.endsWith('left')) x = margin;
    if (position.endsWith('right')) x = width - margin - textWidth;

    page.drawText(label, { x, y, size, font, color, opacity: 1 });
  });

  return doc.save();
}

// ── images → PDF ────────────────────────────────────────────

export type PdfImage = { bytes: Uint8Array | ArrayBuffer; type: 'png' | 'jpg' };

export type ImagesToPdfOptions = {
  paper?: PaperKey;
  /** points */
  margin?: number;
  orientation?: 'auto' | 'portrait' | 'landscape';
  title?: string;
};

export async function imagesToPdf(
  images: PdfImage[],
  options: ImagesToPdfOptions = {}
): Promise<Uint8Array> {
  if (images.length === 0) throw new Error('Add at least one image');
  const out = await PDFDocument.create();
  const paper = options.paper || 'a4';
  const margin = Math.max(0, options.margin ?? 24);

  for (const item of images) {
    const data = toBytes(item.bytes);
    const embedded = item.type === 'png' ? await out.embedPng(data) : await out.embedJpg(data);

    if (paper === 'fit') {
      const page = out.addPage([embedded.width + margin * 2, embedded.height + margin * 2]);
      page.drawImage(embedded, { x: margin, y: margin, width: embedded.width, height: embedded.height });
      continue;
    }

    const [baseW, baseH] = PAPER_SIZES[paper];
    const orientation = options.orientation || 'auto';
    const landscape =
      orientation === 'landscape' || (orientation === 'auto' && embedded.width > embedded.height);
    const pageW = landscape ? baseH : baseW;
    const pageH = landscape ? baseW : baseH;

    const page = out.addPage([pageW, pageH]);
    const boxW = Math.max(1, pageW - margin * 2);
    const boxH = Math.max(1, pageH - margin * 2);
    const scale = Math.min(boxW / embedded.width, boxH / embedded.height);
    const drawW = embedded.width * scale;
    const drawH = embedded.height * scale;
    page.drawImage(embedded, {
      x: (pageW - drawW) / 2,
      y: (pageH - drawH) / 2,
      width: drawW,
      height: drawH,
    });
  }

  out.setTitle(options.title || 'NikNote images');
  out.setProducer('NikNote PDF Tools');
  return out.save();
}

// ── metadata / misc ─────────────────────────────────────────

export async function setPdfMetadata(
  bytes: Uint8Array | ArrayBuffer,
  meta: { title?: string; author?: string; subject?: string; keywords?: string[] }
): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  if (meta.title) doc.setTitle(meta.title);
  if (meta.author) doc.setAuthor(meta.author);
  if (meta.subject) doc.setSubject(meta.subject);
  if (meta.keywords && meta.keywords.length > 0) doc.setKeywords(meta.keywords);
  doc.setProducer('NikNote PDF Tools');
  doc.setModificationDate(new Date());
  return doc.save();
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** `notes.pdf` → `notes-merged.pdf` (keeps names readable after export). */
export function outputName(sourceName: string, suffix: string, ext = 'pdf'): string {
  const lastSegment = String(sourceName || '').replace(/[\\/]+/g, '/').split('/').pop() || '';
  const base = lastSegment
    .replace(/\.[a-z0-9]{1,5}$/i, '')
    .replace(/[^\w\-. ]+/g, '-')
    .replace(/^[.\-\s]+|[.\-\s]+$/g, '')
    .trim();
  return `${base || 'niknote'}-${suffix}.${ext}`;
}

/** Detects the real image type from the file signature (browsers lie about mime). */
export function detectImageType(bytes: Uint8Array): 'png' | 'jpg' | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'png';
  }
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  return null;
}
