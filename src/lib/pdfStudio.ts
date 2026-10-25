// ============================================================
// NikNote PDF Studio — annotation model, canvas renderer & exporter
// Annotations are stored in normalised page coordinates (0..1) so
// they render identically at any zoom level and in the exported PDF.
// ============================================================

import { PDFDocument, degrees, type PDFPage } from 'pdf-lib';

export type Point = { x: number; y: number };

export type PdfTool =
  | 'select'
  | 'edittext'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'text'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'check'
  | 'cross'
  | 'star'
  | 'signature'
  | 'image';

export type StrokeAnnotation = {
  id: string;
  type: 'ink';
  page: string;
  points: Point[];
  color: string;
  width: number;
  opacity: number;
  highlighter?: boolean;
};

export type ShapeAnnotation = {
  id: string;
  type: 'shape';
  page: string;
  shape: 'rect' | 'ellipse' | 'line' | 'arrow';
  from: Point;
  to: Point;
  color: string;
  width: number;
  opacity: number;
  filled?: boolean;
};

export type TextAnnotation = {
  id: string;
  type: 'text';
  page: string;
  at: Point;
  text: string;
  color: string;
  size: number;
  font: 'sans' | 'serif' | 'cursive' | 'mono';
  bold: boolean;
};

export type ImageAnnotation = {
  id: string;
  type: 'image';
  page: string;
  at: Point;
  /** width & height as a fraction of the page width / height */
  w: number;
  h: number;
  dataUrl: string;
  label?: string;
};

export type StampAnnotation = {
  id: string;
  type: 'stamp';
  page: string;
  stamp: 'check' | 'cross' | 'star';
  at: Point;
  size: number;
  color: string;
};

export type TextEditAnnotation = {
  id: string;
  type: 'textedit';
  page: string;
  /** Normalized cover box (y = top) painted with `bg` over the original glyphs. */
  rect: { x: number; y: number; w: number; h: number };
  /** Normalized baseline the replacement text sits on (matches the original line). */
  baseline: number;
  text: string;
  color: string;
  /** fraction of min(page width, height) — same unit as TextAnnotation.size */
  size: number;
  font: 'sans' | 'serif' | 'cursive' | 'mono';
  bold: boolean;
  /** cover colour, usually the page background */
  bg: string;
};

export type Annotation =
  | StrokeAnnotation
  | ShapeAnnotation
  | TextAnnotation
  | TextEditAnnotation
  | ImageAnnotation
  | StampAnnotation;

export type PdfPageEntry = {
  id: string;
  kind: 'original' | 'blank';
  /** index in the source PDF for `original` pages */
  srcIndex: number;
  rotation: number;
  width: number;
  height: number;
};

export const FONT_STACKS: Record<TextAnnotation['font'], string> = {
  sans: 'Inter, "Segoe UI", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  cursive: '"Segoe Script", "Bradley Hand", "Comic Sans MS", cursive',
  mono: '"JetBrains Mono", "Courier New", monospace',
};

export const INK_COLORS = ['#111827', '#ef4444', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#ec4899', '#ffffff'];
export const HIGHLIGHT_COLORS = ['#fde047', '#86efac', '#93c5fd', '#f9a8d4', '#fdba74'];

export const createId = (): string =>
  `an-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Pointer position → normalised page coordinates. */
export function toPagePoint(rect: DOMRect, clientX: number, clientY: number): Point {
  return {
    x: clamp01((clientX - rect.left) / Math.max(1, rect.width)),
    y: clamp01((clientY - rect.top) / Math.max(1, rect.height)),
  };
}

// ── Rendering ───────────────────────────────────────────────────────────────

function drawArrowHead(ctx: CanvasRenderingContext2D, from: Point, to: Point, size: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(angle - Math.PI / 7), to.y - size * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(to.x - size * Math.cos(angle + Math.PI / 7), to.y - size * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fill();
}

const imageStore = new Map<string, CanvasImageSource>();

/** Decodes (and caches) a data-URL image so overlays and exports can paint it. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageStore.get(src);
  if (cached) return Promise.resolve(cached as HTMLImageElement);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageStore.set(src, img);
      // Make sure the bitmap is decoded before the first canvas paint — otherwise
      // a fast export can draw an empty (white) rectangle for a photo/signature.
      Promise.resolve(img.decode?.())
        .then(() => resolve(img))
        .catch(() => resolve(img));
    };
    img.onerror = reject;
    img.src = src;
  });
}

export function isImageReady(src: string): boolean {
  return imageStore.has(src);
}

const STAMP_GLYPHS: Record<StampAnnotation['stamp'], string> = {
  check: '✓',
  cross: '✗',
  star: '★',
};

/**
 * Draws annotations onto a canvas context.
 * `width`/`height` are the pixel dimensions of the target page image.
 */
export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  width: number,
  height: number
) {
  const scale = Math.min(width, height) / 1000;
  for (const ann of annotations) {
    ctx.save();
    if (ann.type === 'ink') {
      if (ann.points.length === 0) { ctx.restore(); continue; }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = ann.color;
      ctx.globalAlpha = ann.opacity;
      ctx.lineWidth = Math.max(0.6, ann.width * Math.min(width, height));
      if (ann.highlighter) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.lineWidth = Math.max(6, ann.width * Math.min(width, height) * 5);
      }
      ctx.beginPath();
      const p0 = ann.points[0];
      ctx.moveTo(p0.x * width, p0.y * height);
      if (ann.points.length === 1) {
        ctx.lineTo(p0.x * width + 0.1, p0.y * height + 0.1);
      } else {
        for (let i = 1; i < ann.points.length; i++) {
          const p = ann.points[i];
          ctx.lineTo(p.x * width, p.y * height);
        }
      }
      ctx.stroke();
    } else if (ann.type === 'shape') {
      const x1 = ann.from.x * width;
      const y1 = ann.from.y * height;
      const x2 = ann.to.x * width;
      const y2 = ann.to.y * height;
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.globalAlpha = ann.opacity;
      ctx.lineWidth = Math.max(1, ann.width * Math.min(width, height));
      if (ann.shape === 'rect') {
        if (ann.filled) ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        else ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      } else if (ann.shape === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
        if (ann.filled) ctx.fill();
        else ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        if (ann.shape === 'arrow') drawArrowHead(ctx, { x: x1, y: y1 }, { x: x2, y: y2 }, 10 * scale + 8);
      }
    } else if (ann.type === 'text') {
      const size = Math.max(6, ann.size * Math.min(width, height));
      ctx.fillStyle = ann.color;
      ctx.textBaseline = 'top';
      ctx.font = `${ann.bold ? '700' : '500'} ${size}px ${FONT_STACKS[ann.font]}`;
      ann.text.split('\n').forEach((line, i) => {
        ctx.fillText(line, ann.at.x * width, ann.at.y * height + i * size * 1.28);
      });
    } else if (ann.type === 'textedit') {
      ctx.fillStyle = ann.bg;
      ctx.fillRect(ann.rect.x * width, ann.rect.y * height, ann.rect.w * width, ann.rect.h * height);
      if (ann.text) {
        const size = Math.max(6, ann.size * Math.min(width, height));
        ctx.fillStyle = ann.color;
        ctx.textBaseline = 'alphabetic';
        ctx.font = `${ann.bold ? '700' : '500'} ${size}px ${FONT_STACKS[ann.font]}`;
        ann.text.split('\n').forEach((line, i) => {
          ctx.fillText(line, ann.rect.x * width, ann.baseline * height + i * size * 1.25);
        });
      }
    } else if (ann.type === 'image') {
      const img = imageStore.get(ann.dataUrl);
      if (img) {
        ctx.globalAlpha = 1;
        ctx.drawImage(img, ann.at.x * width, ann.at.y * height, ann.w * width, ann.h * height);
      }
    } else if (ann.type === 'stamp') {
      const size = Math.max(10, ann.size * Math.min(width, height));
      ctx.fillStyle = ann.color;
      ctx.font = `700 ${size}px ${FONT_STACKS.sans}`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(STAMP_GLYPHS[ann.stamp], ann.at.x * width, ann.at.y * height);
    }
    ctx.restore();
  }
}

// ── Hit testing / bounds (used by the select, move & eraser tools) ──────────

export function annotationBounds(ann: Annotation): { x1: number; y1: number; x2: number; y2: number } {
  if (ann.type === 'ink') {
    const xs = ann.points.map((p) => p.x);
    const ys = ann.points.map((p) => p.y);
    return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  }
  if (ann.type === 'shape') {
    return {
      x1: Math.min(ann.from.x, ann.to.x),
      y1: Math.min(ann.from.y, ann.to.y),
      x2: Math.max(ann.from.x, ann.to.x),
      y2: Math.max(ann.from.y, ann.to.y),
    };
  }
  if (ann.type === 'text') {
    const lines = ann.text.split('\n');
    const longest = lines.reduce((m, l) => Math.max(m, l.length), 1);
    return { x1: ann.at.x, y1: ann.at.y, x2: ann.at.x + longest * ann.size * 0.58, y2: ann.at.y + lines.length * ann.size * 1.4 };
  }
  if (ann.type === 'image') {
    return { x1: ann.at.x, y1: ann.at.y, x2: ann.at.x + ann.w, y2: ann.at.y + ann.h };
  }
  if (ann.type === 'textedit') {
    const lines = ann.text.split('\n');
    const longest = lines.reduce((m, l) => Math.max(m, l.length), 1);
    return {
      x1: ann.rect.x,
      y1: ann.rect.y,
      x2: Math.max(ann.rect.x + ann.rect.w, ann.rect.x + longest * ann.size * 0.52),
      y2: Math.max(ann.rect.y + ann.rect.h, ann.baseline + ann.size * 0.4 + (lines.length - 1) * ann.size * 1.25),
    };
  }
  return { x1: ann.at.x - ann.size / 2, y1: ann.at.y - ann.size / 2, x2: ann.at.x + ann.size / 2, y2: ann.at.y + ann.size / 2 };
}

export function hitTest(ann: Annotation, point: Point, tolerance = 0.012): boolean {
  const b = annotationBounds(ann);
  return (
    point.x >= b.x1 - tolerance &&
    point.x <= b.x2 + tolerance &&
    point.y >= b.y1 - tolerance &&
    point.y <= b.y2 + tolerance
  );
}

export function translateAnnotation(ann: Annotation, dx: number, dy: number): Annotation {
  if (ann.type === 'ink') return { ...ann, points: ann.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  if (ann.type === 'shape') {
    return {
      ...ann,
      from: { x: ann.from.x + dx, y: ann.from.y + dy },
      to: { x: ann.to.x + dx, y: ann.to.y + dy },
    };
  }
  if (ann.type === 'textedit') {
    return { ...ann, rect: { ...ann.rect, x: ann.rect.x + dx, y: ann.rect.y + dy }, baseline: ann.baseline + dy };
  }
  return { ...ann, at: { x: ann.at.x + dx, y: ann.at.y + dy } } as Annotation;
}

// ── Export ─────────────────────────────────────────────────────────────────

async function renderAnnotationLayer(
  annotations: Annotation[],
  width: number,
  height: number,
  rotation: number
): Promise<string | null> {
  if (annotations.length === 0) return null;
  // Render in the visible (rotated) orientation first…
  const visible = document.createElement('canvas');
  visible.width = Math.round(width);
  visible.height = Math.round(height);
  const vctx = visible.getContext('2d');
  if (!vctx) return null;
  drawAnnotations(vctx, annotations, visible.width, visible.height);

  const normalised = ((rotation % 360) + 360) % 360;
  if (normalised === 0) return visible.toDataURL('image/png');

  // …then rotate the layer back so it lines up with the un-rotated PDF page.
  const swap = normalised === 90 || normalised === 270;
  const out = document.createElement('canvas');
  out.width = swap ? visible.height : visible.width;
  out.height = swap ? visible.width : visible.height;
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((-normalised * Math.PI) / 180);
  ctx.drawImage(visible, -visible.width / 2, -visible.height / 2);
  return out.toDataURL('image/png');
}

export interface ExportOptions {
  bytes: ArrayBuffer;
  pages: PdfPageEntry[];
  annotations: Annotation[];
  /** render scale for the annotation layer (2 = 2× page points, crisp) */
  scale?: number;
  /** called after every page is flattened — powers the "Saving 3/12" UI */
  onProgress?: (done: number, total: number) => void;
}

/** Flattens every annotation into a brand new PDF and returns its bytes. */
export async function exportAnnotatedPdf({
  bytes,
  pages,
  annotations,
  scale = 2,
  onProgress,
}: ExportOptions): Promise<Uint8Array> {
  // Embedded photos / signatures must be decoded before the flatten pass,
  // otherwise they would silently be dropped from the exported file.
  await Promise.all(
    annotations
      .filter((a): a is Extract<Annotation, { type: 'image' }> => a.type === 'image')
      .map((a) => loadImage(a.dataUrl).catch(() => null))
  );

  const source = await PDFDocument.load(bytes.slice(0), { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const sourcePages = source.getPages();

  let done = 0;
  for (const page of pages) {
    let target: PDFPage;
    if (page.kind === 'original' && sourcePages[page.srcIndex]) {
      const [copied] = await out.copyPages(source, [page.srcIndex]);
      target = out.addPage(copied);
    } else {
      target = out.addPage([page.width, page.height]);
    }
    if (page.rotation) target.setRotation(degrees(page.rotation));

    const pageAnnotations = annotations.filter((a) => a.page === page.id);
    if (pageAnnotations.length === 0) {
      done += 1;
      onProgress?.(done, pages.length);
      continue;
    }

    const { width, height } = target.getSize();
    const swap = ((page.rotation % 360) + 360) % 360 === 90 || ((page.rotation % 360) + 360) % 360 === 270;
    const visibleW = swap ? height : width;
    const visibleH = swap ? width : height;
    const layer = await renderAnnotationLayer(
      pageAnnotations,
      Math.min(3200, Math.max(800, visibleW * scale)),
      Math.min(3200, Math.max(800, visibleH * scale)),
      page.rotation
    );
    if (layer) {
      const png = await out.embedPng(layer);
      target.drawImage(png, { x: 0, y: 0, width, height });
    }
    done += 1;
    onProgress?.(done, pages.length);
  }

  out.setProducer('NikNote PDF Studio');
  out.setCreator('NikNote — niknote.online');
  return out.save();
}

export function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const PAGE_SIZES: Record<'a4' | 'letter' | 'legal', { width: number; height: number }> = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
  legal: { width: 612, height: 1008 },
};

export function baseName(name: string): string {
  return name.replace(/\.pdf$/i, '') || 'document';
}
