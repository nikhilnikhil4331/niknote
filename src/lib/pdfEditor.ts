// ============================================================
// NikNote PDF Editor 2.0 — pure rendering / navigation / gesture rules
// Framework-free on purpose: every rule that decides canvas size,
// page index or gesture intent is checkable without the UI.
// Companion tests: src/test/pdfEditor.test.ts
// ============================================================

import type { PdfPageEntry, PdfTool } from './pdfStudio';

/** Display (post-rotation) page size in points. Entry w/h are the unrotated box. */
export function displayDims(entry: Pick<PdfPageEntry, 'width' | 'height' | 'rotation'>): { w: number; h: number } {
  const r = ((entry.rotation % 360) + 360) % 360;
  const swapped = r === 90 || r === 270;
  return swapped ? { w: entry.height, h: entry.width } : { w: entry.width, h: entry.height };
}

export const SHAPE_TOOLS: PdfTool[] = ['rect', 'ellipse', 'line', 'arrow', 'check', 'cross', 'star'];

export const TOOL_LABELS: Record<PdfTool, string> = {
  select: 'Read',
  edittext: 'Edit text',
  pen: 'Pen',
  highlighter: 'Highlighter',
  eraser: 'Eraser',
  text: 'Text',
  rect: 'Rectangle',
  ellipse: 'Circle',
  line: 'Line',
  arrow: 'Arrow',
  check: 'Tick stamp',
  cross: 'Cross stamp',
  star: 'Star stamp',
  signature: 'Signature',
  image: 'Image',
};

// ── Zoom ─────────────────────────────────────────────────────

export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 4;

export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/** Multiplicative pinch → next committed zoom. */
export function pinchZoom(startZoom: number, startDistance: number, distance: number): number {
  if (startDistance <= 0 || distance <= 0) return clampZoom(startZoom);
  return clampZoom(startZoom * (distance / startDistance));
}

export function pointerDistance(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// ── Page navigation (single source of truth helpers) ─────────

export function clampPageIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.min(count - 1, Math.max(0, Math.trunc(index)));
}

export function nextPageIndex(index: number, count: number): number {
  return clampPageIndex(index + 1, count);
}

export function prevPageIndex(index: number, count: number): number {
  return clampPageIndex(index - 1, count);
}

/**
 * Index to display after the page at `deletedIndex` is removed.
 * Deleting a page before the current one shifts the view back by one;
 * deleting the current page shows whatever slid into its slot.
 */
export function pageAfterDelete(current: number, deletedIndex: number, countBefore: number): number {
  const countAfter = countBefore - 1;
  if (countAfter <= 0) return 0;
  if (deletedIndex < current) return clampPageIndex(current - 1, countAfter);
  return clampPageIndex(current, countAfter);
}

/** Index to display after a page is inserted at `insertedIndex` (we jump to it). */
export function pageAfterInsert(insertedIndex: number, countAfter: number): number {
  return clampPageIndex(insertedIndex, countAfter);
}

export function pageLabel(index: number, count: number): string {
  if (count <= 0) return '0 / 0';
  return `${clampPageIndex(index, count) + 1} / ${count}`;
}

/** Parses a go-to-page draft ("12") into a 0-based index, or null if invalid. */
export function parsePageInput(raw: string, count: number): number | null {
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || count <= 0) return null;
  if (n < 1 || n > count) return null;
  return n - 1;
}

// ── Render planning (the anti-blur core) ─────────────────────

/** Widest a page is ever laid out in CSS pixels at zoom = 1. */
export const MAX_FIT_CSS_WIDTH = 1024;
/** Backing-store ceiling per axis — high enough for DPR 3 phones at 200% zoom. */
export const MAX_BACKING_EDGE = 3200;
/** Total backing pixels per page (~12 MP) — keeps low-RAM devices alive. */
export const MAX_BACKING_PIXELS = 12_000_000;

export interface RenderPlanInput {
  /** Page size in PDF points, already swapped for 90°/270° display rotation. */
  pageW: number;
  pageH: number;
  /** CSS pixels available inside the scroll stage (padding excluded by caller). */
  containerW: number;
  zoom: number;
  devicePixelRatio: number;
}

export interface RenderPlan {
  /** CSS layout size of the page. */
  cssW: number;
  cssH: number;
  /** Canvas backing-store size (physical pixels). */
  backingW: number;
  backingH: number;
  /** Scale to hand to pdf.js `getViewport` so its viewport IS the backing size. */
  viewportScale: number;
  /** backing / css — 1 on standard displays, 2–3 on retina, capped for memory. */
  outputScale: number;
  /** True when the memory budget forced a lower resolution than the display wants. */
  capped: boolean;
}

/**
 * Decides CSS size vs canvas backing size independently — the fix for
 * blurry PDFs. pdf.js renders at `viewportScale` (physical pixels);
 * the browser displays the canvas at cssW/cssH, so text stays sharp
 * on high-DPI screens and at high zoom without double-applying DPR.
 */
export function planPageRender(input: RenderPlanInput): RenderPlan {
  const pageW = Math.max(1, input.pageW);
  const pageH = Math.max(1, input.pageH);
  const containerW = Math.max(120, input.containerW || MAX_FIT_CSS_WIDTH);
  const zoom = clampZoom(input.zoom);
  const dpr = Math.min(3, Math.max(1, input.devicePixelRatio || 1));

  const fitCssW = Math.min(containerW, MAX_FIT_CSS_WIDTH);
  const cssW = Math.max(80, Math.round(fitCssW * zoom));
  const cssH = Math.max(80, Math.round((cssW * pageH) / pageW));

  let backingW = Math.round(cssW * dpr);
  let backingH = Math.round(cssH * dpr);
  let capped = false;

  // Per-axis ceiling, preserving aspect ratio.
  const axisScale = Math.min(1, MAX_BACKING_EDGE / backingW, MAX_BACKING_EDGE / backingH);
  if (axisScale < 1) {
    capped = true;
    backingW = Math.round(backingW * axisScale);
    backingH = Math.round(backingH * axisScale);
  }
  // Total-pixel budget.
  const pixels = backingW * backingH;
  if (pixels > MAX_BACKING_PIXELS) {
    capped = true;
    const s = Math.sqrt(MAX_BACKING_PIXELS / pixels);
    backingW = Math.max(200, Math.round(backingW * s));
    backingH = Math.max(200, Math.round(backingH * s));
  }

  return {
    cssW,
    cssH,
    backingW,
    backingH,
    viewportScale: backingW / pageW,
    outputScale: backingW / cssW,
    capped,
  };
}

/** Zoom value (relative to fit-width) that makes the whole page fit the stage height. */
export function zoomForFitPage(input: {
  pageW: number;
  pageH: number;
  containerW: number;
  containerH: number;
}): number {
  const fitCssW = Math.min(Math.max(120, input.containerW), MAX_FIT_CSS_WIDTH);
  const byHeight = Math.max(120, input.containerH) * (input.pageW / Math.max(1, input.pageH));
  return clampZoom(Math.min(fitCssW, byHeight) / fitCssW);
}

/** Zoom value where 1 PDF point = 1 CSS pixel ("actual size"). */
export function zoomForActualSize(input: { pageW: number; containerW: number }): number {
  const fitCssW = Math.min(Math.max(120, input.containerW), MAX_FIT_CSS_WIDTH);
  return clampZoom(input.pageW / fitCssW);
}

/** What the header shows: CSS pixels per PDF point, as a percentage of actual size. */
export function displayZoomPercent(plan: Pick<RenderPlan, 'cssW'>, pageW: number): number {
  return Math.round((plan.cssW / Math.max(1, pageW)) * 100);
}

// ── Gestures ─────────────────────────────────────────────────

export const SWIPE_MIN_DISTANCE = 56; // px
export const SWIPE_MAX_DURATION = 700; // ms
export const SWIPE_AXIS_RATIO = 1.6; // |primary| must dominate the other axis

export type HorizontalSwipe = 'next' | 'prev' | null;

/**
 * Deliberate horizontal swipe → page turn (paginated mode only).
 * Tiny, slow or mostly-vertical movements are rejected so ordinary
 * reading scrolls never flip a page.
 */
export function classifyHorizontalSwipe(g: { dx: number; dy: number; dtMs: number }): HorizontalSwipe {
  if (g.dtMs <= 0 || g.dtMs > SWIPE_MAX_DURATION) return null;
  if (Math.abs(g.dx) < SWIPE_MIN_DISTANCE) return null;
  if (Math.abs(g.dx) < Math.abs(g.dy) * SWIPE_AXIS_RATIO) return null;
  return g.dx < 0 ? 'next' : 'prev';
}

/** Swipe-down on a page THUMBNAIL (never on the document) → reveal page actions. */
export function isSwipeDown(g: { dx: number; dy: number; dtMs: number }): boolean {
  if (g.dtMs <= 0 || g.dtMs > SWIPE_MAX_DURATION) return false;
  if (g.dy < 40) return false;
  return g.dy >= Math.abs(g.dx) * SWIPE_AXIS_RATIO;
}

// ── Load errors ──────────────────────────────────────────────

export type PdfLoadErrorKind = 'password' | 'invalid' | 'too-large' | 'unknown';

/** Maps pdf.js failures to honest, actionable UI states. */
export function classifyLoadError(err: unknown): PdfLoadErrorKind {
  const name = (err as { name?: string } | null)?.name || '';
  const message = (err as { message?: string } | null)?.message || '';
  if (name === 'PasswordException' || /password/i.test(message)) return 'password';
  if (name === 'InvalidPDFException' || /invalid pdf|damaged|corrupt/i.test(message)) return 'invalid';
  return 'unknown';
}

export function loadErrorMessage(kind: PdfLoadErrorKind): string {
  switch (kind) {
    case 'password':
      return 'This PDF is password-protected. Enter its password to open it.';
    case 'invalid':
      return 'This file could not be read as a PDF — it may be damaged or incomplete.';
    case 'too-large':
      return 'This PDF is larger than 80 MB. Try compressing it in PDF Tools first.';
    default:
      return 'This PDF could not be opened. Check the file and try again.';
  }
}

// ── Rendering window ─────────────────────────────────────────

/**
 * Pages worth keeping rendered around the visible one in continuous mode.
 * Everything outside the window collapses to a correctly-sized placeholder,
 * so a 500-page PDF never holds 500 canvases in memory.
 */
export function renderWindow(center: number, count: number, radius = 2): Set<number> {
  const out = new Set<number>();
  if (count <= 0) return out;
  const c = clampPageIndex(center, count);
  for (let i = Math.max(0, c - radius); i <= Math.min(count - 1, c + radius); i++) out.add(i);
  return out;
}

/** Thumbnail backing width: crisp on retina, cheap enough to lazy-render. */
export function thumbnailBackingWidth(cssW: number, devicePixelRatio: number): number {
  const dpr = Math.min(2, Math.max(1, devicePixelRatio || 1));
  return Math.min(340, Math.max(120, Math.round(cssW * dpr)));
}
