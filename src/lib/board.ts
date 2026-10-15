// Pure board model + helpers (no React). Tested in board.test.ts.
export type Pattern = 'blank' | 'ruled' | 'grid' | 'dotted';
export type Tool = 'select' | 'text' | 'pen' | 'pencil' | 'highlighter' | 'eraser' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'lasso' | 'pan';
export type StrokeTool = 'pen' | 'pencil' | 'highlighter' | 'line' | 'arrow' | 'rect' | 'ellipse';

export interface Stroke { id: string; tool: StrokeTool; color: string; width: number; opacity: number; points: [number, number, number][] }
export interface BoardItem {
  id: string; kind: 'text' | 'image' | 'audio';
  x: number; y: number; w: number; h: number; rot: number; z: number;
  text?: string; fontSize?: number; lineHeight?: number; align?: 'left' | 'center' | 'right';
  path?: string; fit?: 'cover' | 'contain'; duration?: number;
}
export interface BoardPage { id: string; width: number; height: number; bg: string; pattern: Pattern; items: BoardItem[]; strokes: Stroke[] }
export interface BoardData { version: 1; pages: BoardPage[] }

export const PAGE_PRESETS: Record<string, { w: number; h: number; label: string }> = {
  a4: { w: 794, h: 1123, label: 'A4' },
  a5: { w: 559, h: 794, label: 'A5' },
  a3: { w: 1123, h: 1587, label: 'A3' },
  letter: { w: 816, h: 1056, label: 'Letter' },
};
export const PAPER_COLORS = [
  { label: 'White', value: '#ffffff' }, { label: 'Cream', value: '#fbf6e9' },
  { label: 'Mint', value: '#eef8f1' }, { label: 'Rose', value: '#fdf0f2' }, { label: 'Dark', value: '#1f2430' },
];
export const MARGIN = 56;

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function newPage(from?: Partial<BoardPage>): BoardPage {
  return { id: uid(), width: from?.width ?? 794, height: from?.height ?? 1123, bg: from?.bg ?? '#ffffff', pattern: from?.pattern ?? 'ruled', items: [], strokes: [] };
}
export function emptyBoard(): BoardData { return { version: 1, pages: [newPage()] }; }

export function normalizeBoard(raw: unknown): BoardData {
  const r = raw as Partial<BoardData> | null;
  const pages = Array.isArray(r?.pages) ? r!.pages.filter(p => p && typeof p.id === 'string').map(p => ({ ...newPage(p), ...p, items: Array.isArray(p.items) ? p.items : [], strokes: Array.isArray(p.strokes) ? p.strokes : [] })) : [];
  return { version: 1, pages: pages.length ? pages : [newPage()] };
}

export function orient(w: number, h: number, landscape: boolean) {
  const [a, b] = [Math.min(w, h), Math.max(w, h)];
  return landscape ? { width: b, height: a } : { width: a, height: b };
}

export function duplicatePage(p: BoardPage): BoardPage {
  return { ...p, id: uid(), items: p.items.map(i => ({ ...i, id: uid() })), strokes: p.strokes.map(s => ({ ...s, id: uid(), points: s.points.map(pt => [...pt] as [number, number, number]) })) };
}
export function movePage(pages: BoardPage[], from: number, to: number) {
  if (to < 0 || to >= pages.length || from === to) return pages;
  const next = [...pages]; const [p] = next.splice(from, 1); next.splice(to, 0, p); return next;
}

/** Word-wrap text into lines of at most `cols` characters, keeping blank lines and never dropping characters. */
export function wrapLines(text: string, cols: number): string[] {
  const out: string[] = [];
  for (const para of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (para === '') { out.push(''); continue; }
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      if (!word) continue;
      if ((line + word).length <= cols) { line += word; continue; }
      if (line.trim()) out.push(line.replace(/\s+$/, ''));
      line = word.replace(/^\s+/, '');
      while (line.length > cols) { out.push(line.slice(0, cols)); line = line.slice(cols); }
    }
    out.push(line.replace(/\s+$/, ''));
  }
  return out;
}

/** Split text into page-sized chunks. Joined chunks reproduce every word of the input. */
export function paginateText(text: string, cols: number, linesPerPage: number): string[] {
  const lines = wrapLines(text, Math.max(8, cols));
  const per = Math.max(1, linesPerPage);
  const pages: string[] = [];
  for (let i = 0; i < lines.length; i += per) pages.push(lines.slice(i, i + per).join('\n'));
  return pages.length ? pages : [''];
}

export function textCapacity(page: BoardPage, fontSize: number, lineHeight: number) {
  const cols = Math.floor((page.width - MARGIN * 2) / (fontSize * 0.62));
  const rows = Math.floor((page.height - MARGIN * 2) / (fontSize * lineHeight));
  return { cols, rows };
}

/** Eraser: drop strokes with any point within radius of (x,y). */
export function eraseAt(strokes: Stroke[], x: number, y: number, r: number) {
  const r2 = r * r;
  return strokes.filter(s => !s.points.some(([px, py], i) => {
    if ((px - x) ** 2 + (py - y) ** 2 <= r2) return true;
    const n = s.points[i + 1]; if (!n) return false;
    return distToSeg2(x, y, px, py, n[0], n[1]) <= r2;
  }));
}
function distToSeg2(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0;
  return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2;
}

export function pointInPolygon(x: number, y: number, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function strokesInLasso(strokes: Stroke[], poly: [number, number][]) {
  if (poly.length < 3) return [];
  return strokes.filter(s => s.points.length && s.points.filter(([x, y]) => pointInPolygon(x, y, poly)).length / s.points.length >= 0.5).map(s => s.id);
}

/** Bounded undo history. */
export class History<T> {
  private past: T[] = []; private future: T[] = [];
  constructor(private limit = 80) {}
  push(state: T) { this.past.push(state); if (this.past.length > this.limit) this.past.shift(); this.future = []; }
  undo(current: T): T | null { const p = this.past.pop(); if (p === undefined) return null; this.future.push(current); return p; }
  redo(current: T): T | null { const f = this.future.pop(); if (f === undefined) return null; this.past.push(current); return f; }
  get canUndo() { return this.past.length > 0; } get canRedo() { return this.future.length > 0; }
}

export const ALLOWED_IMAGE = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export function validateImage(file: { type: string; size: number }): string | null {
  if (!ALLOWED_IMAGE.includes(file.type)) return 'Only PNG, JPG, WEBP or GIF images are supported.';
  if (file.size > MAX_IMAGE_BYTES) return 'Image is larger than 10 MB.';
  return null;
}
