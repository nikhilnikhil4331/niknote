// ============================================================
// NikNote PDF Tools — OCR maths (pure, no worker / no canvas)
// Kept separate from pdfOcr.ts so it can be unit-tested in Node.
// ============================================================

export type OcrBbox = { x0: number; y0: number; x1: number; y1: number };

export type OcrWord = { text: string; confidence: number; bbox: OcrBbox };

export type Size = { width: number; height: number };

export type OcrQuality = 'fast' | 'balanced' | 'best';
export type OcrLanguage = 'eng' | 'eng+hin';

export const OCR_QUALITY_SCALE: Record<OcrQuality, number> = {
  fast: 1.5,
  balanced: 2,
  best: 2.5,
};

export const OCR_LANGUAGE_LABEL: Record<OcrLanguage, string> = {
  eng: 'English',
  'eng+hin': 'English + हिन्दी',
};

const DEVANAGARI = /[\u0900-\u097F]/;

export function hasDevanagari(text: string): boolean {
  return DEVANAGARI.test(String(text ?? ''));
}

/** Walks tesseract's block → paragraph → line → word tree into a flat list. */
export function flattenOcrBlocks(blocks: any[] | null | undefined): OcrWord[] {
  const words: OcrWord[] = [];
  if (!Array.isArray(blocks)) return words;

  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.words)) {
      for (const word of node.words) {
        const text = String(word?.text ?? '').trim();
        const bbox = word?.bbox;
        if (!text || !bbox) continue;
        const { x0, y0, x1, y1 } = bbox;
        if (![x0, y0, x1, y1].every((n) => Number.isFinite(n))) continue;
        if (x1 <= x0 || y1 <= y0) continue;
        words.push({ text, confidence: Number(word?.confidence ?? 0), bbox: { x0, y0, x1, y1 } });
      }
    }
    for (const key of ['paragraphs', 'lines']) {
      if (Array.isArray(node[key])) node[key].forEach(visit);
    }
  };

  blocks.forEach(visit);
  return words;
}

/**
 * Places one recognised word into the new PDF page.
 * Image pixels (top-down) → PDF points (bottom-up), keeping the baseline right.
 */
export function wordToPdfBox(
  word: OcrWord,
  image: Size,
  page: Size
): { text: string; x: number; y: number; size: number } {
  const safeImageWidth = image.width || 1;
  const safeImageHeight = image.height || 1;
  const sx = page.width / safeImageWidth;
  const sy = page.height / safeImageHeight;

  const boxHeight = (word.bbox.y1 - word.bbox.y0) * sy;
  const size = Math.max(2, Math.min(72, boxHeight * 0.92));
  const x = word.bbox.x0 * sx;
  const y = page.height - word.bbox.y1 * sy + size * 0.2;

  return { text: word.text, x, y, size };
}

export function ocrEstimateLabel(pageCount: number, quality: OcrQuality): string {
  const secondsPerPage = quality === 'fast' ? 3 : quality === 'best' ? 8 : 5;
  const total = Math.max(5, Math.round(pageCount * secondsPerPage + 8));
  return pageCount > 1 ? `~${Math.ceil(total / 60)} min` : `~${total}s`;
}
