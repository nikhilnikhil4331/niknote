// ============================================================
// NikNote PDF Editor — "Edit text" geometry
//
// Turns pdf.js text-content items into editable lines (runs)
// that keep the ORIGINAL position, size and font family class.
// The editor covers the old glyphs with the page background and
// draws the new text at the same baseline/size (see
// TextEditAnnotation) — visually an in-place edit.
//
// Calibrated against pdf.js 4.10 output: for a scale-1 viewport,
// Util.transform(viewport.transform, item.transform) gives
// tx[4] = x, tx[5] = baseline (from top), |tx[3]| = font size.
// Pure + framework-free; tests in src/test/pdfTextEdit.test.ts.
// ============================================================

import type { Point, TextAnnotation } from './pdfStudio';

export interface RawTextItem {
  str: string;
  fontName: string;
  transform: number[];
  width: number;
  height: number;
}

export interface RawTextStyle {
  fontFamily?: string;
  vertical?: boolean;
}

export interface TextRun {
  text: string;
  /** Normalized cover box (y = top), slightly padded around the glyphs. */
  rect: { x: number; y: number; w: number; h: number };
  /** Normalized baseline y — edited text is drawn back onto this exact line. */
  baseline: number;
  /** Original font size in PDF points. */
  fontSizePt: number;
  /** fontSizePt / min(pageW, pageH) — the unit TextEditAnnotation.size uses. */
  sizeNorm: number;
  font: TextAnnotation['font'];
  /** Human label for the UI, e.g. "Helvetica" or "Serif". */
  fontLabel: string;
  bold: boolean;
  italic: boolean;
}

/** pdf.js Util.transform(m1, m2) — matrix layout [a,b,c,d,e,f]. */
export function multiplyTransform(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

export interface MappedFont {
  font: TextAnnotation['font'];
  bold: boolean;
  italic: boolean;
  label: string;
}

/**
 * Maps a PDF font-family string to the closest editor stack.
 * Family CLASS (sans/serif/mono) is reliable; weight/style are only
 * detectable when the family name says so (pdf.js public styles do
 * not expose weight) — the UI therefore keeps a Bold toggle.
 */
export function mapPdfFont(family: string | undefined): MappedFont {
  const raw = (family || '').replace(/["']/g, '').trim();
  const s = raw.toLowerCase();
  const bold = /bold|semibold|demibold|black|heavy|extrabold/.test(s);
  const italic = /italic|oblique/.test(s);

  let font: TextAnnotation['font'] = 'sans';
  if (/courier|mono|consol|menlo|typewriter/.test(s)) font = 'mono';
  else if (/script|cursive|handwrit|comic|brush|segoe script|bradley/.test(s)) font = 'cursive';
  else if (/sans|helvetica|arial|Calibri|verdana|tahoma|roboto|inter|lato|open ?sans|noto sans|segoe|futura|gill/.test(s)) font = 'sans';
  else if (/times|roman|serif|georgia|garamond|palatino|cambria|book|charter|liberation serif|noto serif|devanagari/.test(s)) font = 'serif';

  const cleaned = raw.replace(/^[A-Z]{6}\+/, '').replace(/[-,_](regular|roman|book|mt|ps)$/i, '').trim();
  const generic = !cleaned || /^(sans-serif|serif|monospace|cursive|fantasy)$/i.test(cleaned);
  const label = generic
    ? font === 'serif' ? 'Serif' : font === 'mono' ? 'Monospace' : font === 'cursive' ? 'Handwriting' : 'Sans'
    : cleaned.split(',')[0].trim();

  return { font, bold, italic, label };
}

interface PlacedItem {
  text: string;
  fontName: string;
  x: number;
  baseline: number;
  w: number;
  fh: number; // font size in points
}

/**
 * Groups raw items into editable lines for one page.
 * `viewportTransform` must come from a scale-1 viewport whose
 * rotation matches the on-screen page; dispW/dispH are that
 * viewport's point size. Only horizontal text is editable (v1).
 */
export function buildTextRuns(
  items: RawTextItem[],
  styles: Record<string, RawTextStyle>,
  viewportTransform: number[],
  dispW: number,
  dispH: number
): TextRun[] {
  const minDim = Math.max(1, Math.min(dispW, dispH));
  const placed: PlacedItem[] = [];

  for (const item of items) {
    if (!item.str || !item.str.trim() || !Array.isArray(item.transform)) continue;
    if (styles[item.fontName]?.vertical) continue;
    const tx = multiplyTransform(viewportTransform, item.transform);
    const fh = Math.hypot(tx[2], tx[3]);
    if (!Number.isFinite(fh) || fh < 2) continue;
    const angle = Math.atan2(tx[1], tx[0]);
    if (Math.abs(angle) > 0.03 && Math.abs(Math.abs(angle) - Math.PI) > 0.03) continue; // horizontal only
    placed.push({
      text: item.str,
      fontName: item.fontName,
      x: tx[4],
      baseline: tx[5],
      w: Math.max(0, item.width),
      fh,
    });
  }

  placed.sort((a, b) => a.baseline - b.baseline || a.x - b.x);

  // Lines first (shared baseline), then runs inside a line.
  const lines: PlacedItem[][] = [];
  for (const it of placed) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(it.baseline - line[0].baseline) <= Math.max(1.2, 0.3 * it.fh)) line.push(it);
    else lines.push([it]);
  }

  const runs: TextRun[] = [];
  for (const line of lines) {
    line.sort((a, b) => a.x - b.x);
    let current: PlacedItem[] = [line[0]];
    const flush = () => {
      const first = current[0];
      const last = current[current.length - 1];
      const fh = first.fh;
      let text = first.text;
      for (let i = 1; i < current.length; i++) {
        const prev = current[i - 1];
        const gap = current[i].x - (prev.x + prev.w);
        const needsSpace = gap > 0.2 * fh && !/\s$/.test(text) && !/^\s/.test(current[i].text);
        text += (needsSpace ? ' ' : '') + current[i].text;
      }
      const mapped = mapPdfFont(styles[first.fontName]?.fontFamily);
      const padX = fh * 0.08;
      const x = first.x - padX;
      const top = first.baseline - fh * 1.02;
      const w = Math.max(last.x + last.w - first.x, fh * 0.5) + padX * 2;
      const h = fh * 1.32;
      runs.push({
        text: text.trim(),
        rect: {
          x: clamp01(x / dispW),
          y: clamp01(top / dispH),
          w: Math.min(1, w / dispW),
          h: Math.min(1, h / dispH),
        },
        baseline: clamp01(first.baseline / dispH),
        fontSizePt: fh,
        sizeNorm: fh / minDim,
        font: mapped.font,
        fontLabel: mapped.label,
        bold: mapped.bold,
        italic: mapped.italic,
      });
    };
    for (let i = 1; i < line.length; i++) {
      const prev = line[i - 1];
      const next = line[i];
      const gap = next.x - (prev.x + prev.w);
      const sameRun =
        gap <= 0.7 * prev.fh &&
        Math.abs(next.fh - prev.fh) <= Math.max(1, 0.25 * prev.fh) &&
        next.fontName === prev.fontName;
      if (sameRun) current.push(next);
      else {
        flush();
        current = [next];
      }
    }
    flush();
  }

  return runs.filter((r) => r.text.length > 0);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Index of the topmost run under a normalized page point, or -1. */
export function runAtPoint(runs: TextRun[], point: Point, tolerance = 0.004): number {
  for (let i = runs.length - 1; i >= 0; i--) {
    const r = runs[i].rect;
    if (
      point.x >= r.x - tolerance &&
      point.x <= r.x + r.w + tolerance &&
      point.y >= r.y - tolerance &&
      point.y <= r.y + r.h + tolerance
    ) {
      return i;
    }
  }
  return -1;
}
