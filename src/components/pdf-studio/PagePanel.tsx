// ============================================================
// PagePanel — lazy page thumbnails + page management.
//
//  • Thumbnails render on visibility only, at retina width,
//    with at most 2 pdf.js renders in flight — a 500-page PDF
//    no longer pays 500 serial renders at open time.
//  • Rotation is honoured in the thumbnail viewport.
//  • Swipe DOWN on a thumbnail (or long-press, ⋯, right-click)
//    reveals page actions. This is the ONLY swipe-down delete
//    path — the document itself always just scrolls. Delete
//    still requires explicit confirmation in PdfStudio.
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown, ChevronUp, Copy, FilePlus2, Loader2, MoreHorizontal,
  RotateCw, Trash2, X,
} from 'lucide-react';
import type { PdfPageEntry } from '@/lib/pdfStudio';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { displayDims, isSwipeDown, thumbnailBackingWidth } from '@/lib/pdfEditor';

// ── Thumbnail cache + bounded render queue ───────────────────

const thumbCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string | null>>();
let running = 0;
const waiters: Array<() => void> = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= 2) await new Promise<void>((r) => waiters.push(r));
  running += 1;
  try {
    return await fn();
  } finally {
    running -= 1;
    waiters.shift()?.();
  }
}

export function clearThumbnailCache(exceptPrefix?: string) {
  for (const key of [...thumbCache.keys()]) {
    if (!exceptPrefix || !key.startsWith(exceptPrefix)) thumbCache.delete(key);
  }
}

function thumbKey(docKey: string, entry: PdfPageEntry): string {
  return `${docKey}:${entry.id}:${entry.rotation}`;
}

async function renderThumb(doc: PDFDocumentProxy | null, docKey: string, entry: PdfPageEntry): Promise<string | null> {
  const key = thumbKey(docKey, entry);
  const hit = thumbCache.get(key);
  if (hit) return hit;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const job = withSlot(async () => {
    try {
      const dims = displayDims(entry);
      const backingW = thumbnailBackingWidth(112, window.devicePixelRatio || 1);
      const scale = backingW / Math.max(1, dims.w);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return null;
      if (entry.kind === 'blank' || !doc) {
        canvas.width = backingW;
        canvas.height = Math.round((backingW * dims.h) / dims.w);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#d8dce6';
        ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
      } else {
        const src = await doc.getPage(entry.srcIndex + 1);
        const vp = src.getViewport({ scale, rotation: ((entry.rotation % 360) + 360) % 360 });
        canvas.width = Math.round(vp.width);
        canvas.height = Math.round(vp.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const params: Parameters<typeof src.render>[0] & { canvas: HTMLCanvasElement } = {
          canvasContext: ctx, viewport: vp, canvas,
        };
        await src.render(params).promise;
      }
      const url = canvas.toDataURL('image/jpeg', 0.82);
      if (thumbCache.size > 400) thumbCache.clear();
      thumbCache.set(key, url);
      return url;
    } catch {
      return null;
    } finally {
      inFlight.delete(key);
    }
  });
  inFlight.set(key, job);
  return job;
}

function ThumbImage({ doc, docKey, entry, label }: { doc: PDFDocumentProxy | null; docKey: string; entry: PdfPageEntry; label: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [url, setUrl] = useState<string | null>(() => thumbCache.get(thumbKey(docKey, entry)) || null);
  const dims = displayDims(entry);

  useEffect(() => {
    setUrl(thumbCache.get(thumbKey(docKey, entry)) || null);
    const host = hostRef.current;
    if (!host || thumbCache.has(thumbKey(docKey, entry))) return;
    let alive = true;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          renderThumb(doc, docKey, entry).then((u) => {
            if (alive && u) setUrl(u);
          });
        }
      },
      { rootMargin: '300px' }
    );
    io.observe(host);
    return () => {
      alive = false;
      io.disconnect();
    };
  }, [doc, docKey, entry]);

  return (
    <div ref={hostRef} style={{ aspectRatio: `${dims.w} / ${dims.h}`, background: '#fff' }}>
      {url ? (
        <img src={url} alt={label} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--pdfs-text-2)' }} />
        </div>
      )}
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────

export interface PagePanelActions {
  onNavigate: (index: number) => void;
  onRotate: (index: number) => void;
  onDuplicate: (index: number) => void;
  onInsertBlank: (index: number, size: 'same' | 'a4' | 'letter') => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onDeleteRequest: (index: number) => void;
}

interface Props extends PagePanelActions {
  open: boolean;
  onClose: () => void;
  doc: PDFDocumentProxy | null;
  docKey: string;
  pages: PdfPageEntry[];
  pageIndex: number;
}

export default function PagePanel({ open, onClose, doc, docKey, pages, pageIndex, ...actions }: Props) {
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const gestureRef = useRef<{ x: number; y: number; t: number; index: number } | null>(null);
  const longPressRef = useRef<number | null>(null);
  const activeThumbRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) activeThumbRef.current?.scrollIntoView({ block: 'nearest' });
  }, [open, pageIndex]);

  if (!open) return null;

  const clearLongPress = () => {
    if (longPressRef.current) window.clearTimeout(longPressRef.current);
    longPressRef.current = null;
  };

  const menuIndex = menuFor !== null && menuFor < pages.length ? menuFor : null;

  return (
    <>
      {/* Mobile backdrop (rail needs none on desktop) */}
      <button
        type="button"
        aria-label="Close pages"
        className="fixed inset-0 z-40 bg-black/35 lg:hidden"
        onClick={onClose}
      />
      <aside
        className="pdfs-rail fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col lg:static lg:z-auto lg:w-44 lg:shrink-0"
        style={{ background: 'var(--pdfs-surface)', borderRight: '1px solid var(--pdfs-border)' }}
        aria-label="Pages"
      >
        <div className="flex items-center gap-2 px-3 pb-1 pt-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
          <h2 className="text-[13px] font-bold">Pages</h2>
          <span className="text-[11px] font-medium" style={{ color: 'var(--pdfs-text-2)' }}>{pages.length}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pages panel"
            className="ml-auto grid h-9 w-9 place-items-center rounded-full hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="px-3 pb-2 text-[10.5px] leading-snug" style={{ color: 'var(--pdfs-text-2)' }}>
          Swipe a thumbnail down — or press ⋯ — for rotate, duplicate and delete.
        </p>

        <div className="pdfs-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-1">
            {pages.map((entry, i) => {
              const active = i === pageIndex;
              return (
                <div key={entry.id} ref={active ? activeThumbRef : undefined} className="relative">
                  <button
                    type="button"
                    aria-label={`Go to page ${i + 1}`}
                    aria-current={active ? 'page' : undefined}
                    className="block w-full overflow-hidden rounded-lg text-left transition-shadow"
                    style={{
                      border: `2px solid ${active ? 'var(--pdfs-accent)' : 'var(--pdfs-border)'}`,
                      boxShadow: active ? '0 4px 14px hsl(var(--primary) / 0.22)' : undefined,
                      touchAction: 'pan-y',
                    }}
                    onClick={() => actions.onNavigate(i)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenuFor(i);
                    }}
                    onPointerDown={(e) => {
                      gestureRef.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, index: i };
                      clearLongPress();
                      longPressRef.current = window.setTimeout(() => setMenuFor(i), 480);
                    }}
                    onPointerMove={(e) => {
                      const g = gestureRef.current;
                      if (g && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 10) clearLongPress();
                    }}
                    onPointerUp={(e) => {
                      clearLongPress();
                      const g = gestureRef.current;
                      gestureRef.current = null;
                      if (!g || g.index !== i) return;
                      if (isSwipeDown({ dx: e.clientX - g.x, dy: e.clientY - g.y, dtMs: e.timeStamp - g.t })) {
                        setMenuFor(i);
                      }
                    }}
                    onPointerCancel={() => {
                      clearLongPress();
                      gestureRef.current = null;
                    }}
                  >
                    <ThumbImage doc={doc} docKey={docKey} entry={entry} label={`Page ${i + 1} thumbnail`} />
                  </button>
                  <span
                    className="absolute bottom-1 left-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
                    style={{ background: 'hsl(222 47% 11% / 0.62)' }}
                  >
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    aria-label={`Actions for page ${i + 1}`}
                    onClick={() => setMenuFor(i)}
                    className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full text-white"
                    style={{ background: 'hsl(222 47% 11% / 0.5)' }}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => actions.onInsertBlank(pageIndex, 'same')}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed text-[12px] font-bold"
            style={{ borderColor: 'var(--pdfs-border)', color: 'var(--pdfs-accent)' }}
          >
            <FilePlus2 className="h-4 w-4" /> Add blank page
          </button>
        </div>
      </aside>

      {/* Page actions sheet */}
      {menuIndex !== null && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={`Page ${menuIndex + 1} actions`}>
          <button type="button" aria-label="Close page actions" className="absolute inset-0 bg-black/40" onClick={() => setMenuFor(null)} />
          <div className="pdfs-sheet pdfs-bar relative w-full max-w-sm rounded-t-3xl p-3 sm:rounded-3xl" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center px-2 pb-1 pt-1">
              <h3 className="text-sm font-bold">Page {menuIndex + 1} of {pages.length}</h3>
              <button type="button" aria-label="Close" onClick={() => setMenuFor(null)} className="ml-auto grid h-9 w-9 place-items-center rounded-full hover:bg-black/5">
                <X className="h-4 w-4" />
              </button>
            </div>
            {([
              { label: 'Rotate 90°', icon: RotateCw, run: () => actions.onRotate(menuIndex) },
              { label: 'Duplicate page', icon: Copy, run: () => actions.onDuplicate(menuIndex) },
              { label: 'Move earlier', icon: ChevronUp, run: () => actions.onMove(menuIndex, -1), disabled: menuIndex === 0 },
              { label: 'Move later', icon: ChevronDown, run: () => actions.onMove(menuIndex, 1), disabled: menuIndex === pages.length - 1 },
              { label: 'Insert blank page after', icon: FilePlus2, run: () => actions.onInsertBlank(menuIndex, 'same') },
            ] as Array<{ label: string; icon: React.FC<{ className?: string; style?: React.CSSProperties }>; run: () => void; disabled?: boolean }>).map((row) => {
              const Icon = row.icon;
              return (
                <button
                  key={row.label}
                  type="button"
                  disabled={row.disabled}
                  onClick={() => {
                    row.run();
                    setMenuFor(null);
                  }}
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-semibold hover:bg-black/5 disabled:opacity-40"
                >
                  <Icon className="h-[18px] w-[18px]" style={{ color: 'var(--pdfs-text-2)' }} />
                  {row.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                const idx = menuIndex;
                setMenuFor(null);
                actions.onDeleteRequest(idx);
              }}
              className="mt-1 flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-bold"
              style={{ color: 'var(--pdfs-danger)', background: 'var(--pdfs-danger-soft)' }}
            >
              <Trash2 className="h-[18px] w-[18px]" />
              Delete page…
            </button>
          </div>
        </div>
      )}
    </>
  );
}
