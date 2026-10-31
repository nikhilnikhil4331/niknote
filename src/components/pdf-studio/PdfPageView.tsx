// ============================================================
// PdfPageView — one PDF page: hi-DPI canvas + annotation overlay.
//
// Rendering rules (see src/lib/pdfEditor.ts for the math):
//  • pdf.js renders at backing-store resolution (CSS × DPR,
//    memory-capped). CSS size and canvas size are independent,
//    which is what keeps text sharp on phones/retina displays.
//  • Only pages inside the render window hold a bitmap; the rest
//    are correctly-sized placeholders (layout never jumps).
//  • Every render is token-guarded and the previous task is
//    cancelled first, so rapid zoom/page changes can never paint
//    two viewports into the same canvas.
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import {
  type Annotation, type PdfPageEntry, type PdfTool,
  annotationBounds, drawAnnotations, toPagePoint,
} from '@/lib/pdfStudio';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { displayDims, planPageRender, type RenderPlan } from '@/lib/pdfEditor';

type RenderTask = ReturnType<PDFPageProxy['render']>;

export type PointerKind = 'down' | 'move' | 'up' | 'cancel';
export interface PagePointerMeta {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
  timeStamp: number;
}

const DRAWING_TOOLS: PdfTool[] = [
  'pen', 'highlighter', 'eraser', 'text', 'edittext', 'rect', 'ellipse', 'line', 'arrow',
  'check', 'cross', 'star', 'signature', 'image',
];

interface Props {
  doc: PDFDocumentProxy | null;
  entry: PdfPageEntry;
  index: number;
  active: boolean;
  containerW: number;
  zoom: number;
  dpr: number;
  annotations: Annotation[];
  draft: Annotation | null;
  /** Normalized boxes of editable text lines (Edit-text tool highlights). */
  editBoxes?: Array<{ x: number; y: number; w: number; h: number }>;
  selectedId: string | null;
  imageTick: number;
  tool: PdfTool;
  viewMode: 'scroll' | 'page';
  turnClass?: string;
  registerRef: (index: number, el: HTMLDivElement | null) => void;
  onPointer: (kind: PointerKind, pageId: string, point: { x: number; y: number }, meta: PagePointerMeta) => void;
  children?: (plan: RenderPlan) => React.ReactNode;
}

export default function PdfPageView({
  doc, entry, index, active, containerW, zoom, dpr, annotations, draft, editBoxes,
  selectedId, imageTick, tool, viewMode, turnClass, registerRef, onPointer, children,
}: Props) {
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const taskRef = useRef<RenderTask | null>(null);
  const tokenRef = useRef(0);
  const [status, setStatus] = useState<'rendering' | 'ready' | 'error'>('rendering');
  const [retryTick, setRetryTick] = useState(0);
  const [renderTick, setRenderTick] = useState(0);

  const dims = displayDims(entry);
  const plan = useMemo(
    () => planPageRender({ pageW: dims.w, pageH: dims.h, containerW, zoom, devicePixelRatio: dpr }),
    [dims.w, dims.h, containerW, zoom, dpr]
  );

  // ── Bitmap render ──────────────────────────────────────────
  useEffect(() => {
    if (!active) return;
    const token = ++tokenRef.current;
    let cancelled = false;
    setStatus((s) => (s === 'ready' ? s : 'rendering'));

    (async () => {
      // Serialize: never start a second paint into the same canvas.
      const prev = taskRef.current;
      if (prev) {
        try { prev.cancel?.(); } catch { /* already done */ }
        await prev.promise.catch(() => undefined);
        taskRef.current = null;
      }
      if (cancelled || token !== tokenRef.current) return;
      const canvas = baseRef.current;
      if (!canvas) return;

      const paintBlank = () => {
        canvas.width = plan.backingW;
        canvas.height = plan.backingH;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      };

      try {
        if (entry.kind === 'blank' || !doc) {
          paintBlank();
          setStatus('ready');
          setRenderTick((t) => t + 1);
          return;
        }
        const src = await doc.getPage(entry.srcIndex + 1);
        if (cancelled || token !== tokenRef.current) return;
        const rotation = ((entry.rotation % 360) + 360) % 360;
        const viewport = src.getViewport({ scale: plan.viewportScale, rotation });
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // pdf.js 4.10 types omit the runtime-supported `canvas` hint.
        const params: Parameters<typeof src.render>[0] & { canvas: HTMLCanvasElement } = {
          canvasContext: ctx, viewport, canvas,
        };
        const task = src.render(params);
        taskRef.current = task;
        await task.promise;
        if (cancelled || token !== tokenRef.current) return;
        taskRef.current = null;
        setStatus('ready');
        setRenderTick((t) => t + 1);
      } catch (err: unknown) {
        if ((err as { name?: string } | null)?.name === 'RenderingCancelledException' || cancelled) return;
        console.warn('PDF page render failed', err);
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      tokenRef.current += 1;
      try { taskRef.current?.cancel?.(); } catch { /* noop */ }
      taskRef.current = null;
    };
    // plan.viewportScale changes identity via backing dims; entry identity covers srcIndex/rotation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, doc, entry.id, entry.srcIndex, entry.kind, entry.rotation, plan.backingW, plan.backingH, retryTick]);

  // ── Annotation overlay (synchronous — no async interleave flicker) ──
  useEffect(() => {
    if (!active) return;
    const overlay = overlayRef.current;
    const base = baseRef.current;
    if (!overlay || !base) return;
    const w = base.width || plan.backingW;
    const h = base.height || plan.backingH;
    if (overlay.width !== w) overlay.width = w;
    if (overlay.height !== h) overlay.height = h;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    const list = draft && draft.page === entry.id ? [...annotations, draft] : annotations;
    drawAnnotations(ctx, list, w, h);
    if (editBoxes && editBoxes.length > 0) {
      ctx.save();
      ctx.strokeStyle = 'hsl(221 83% 53%)';
      ctx.fillStyle = 'hsl(221 83% 53% / 0.08)';
      ctx.setLineDash([5 * plan.outputScale, 4 * plan.outputScale]);
      ctx.lineWidth = Math.max(1.2, plan.outputScale);
      for (const b of editBoxes) {
        ctx.fillRect(b.x * w, b.y * h, b.w * w, b.h * h);
        ctx.strokeRect(b.x * w, b.y * h, b.w * w, b.h * h);
      }
      ctx.restore();
    }
    const selected = list.find((a) => a.id === selectedId);
    if (selected) {
      const b = annotationBounds(selected);
      ctx.save();
      ctx.strokeStyle = '#5C3A6E';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = Math.max(1.5, plan.outputScale);
      const pad = 5 * plan.outputScale;
      ctx.strokeRect(b.x1 * w - pad, b.y1 * h - pad, (b.x2 - b.x1) * w + pad * 2, (b.y2 - b.y1) * h + pad * 2);
      ctx.restore();
    }
  }, [active, annotations, draft, editBoxes, selectedId, renderTick, imageTick, entry.id, plan.backingW, plan.backingH, plan.outputScale]);

  const emit = (kind: PointerKind) => (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = overlayRef.current;
    if (!el) return;
    if (kind === 'down') {
      // Drawing keeps the gesture; reading touches are left free to scroll/swipe.
      if (DRAWING_TOOLS.includes(tool) || e.pointerType !== 'touch' || viewMode === 'page') {
        try { el.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      }
    }
    const rect = el.getBoundingClientRect();
    onPointer(kind, entry.id, toPagePoint(rect, e.clientX, e.clientY), {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      clientX: e.clientX,
      clientY: e.clientY,
      timeStamp: e.timeStamp,
    });
  };

  const touchAction = DRAWING_TOOLS.includes(tool)
    ? 'none'
    : viewMode === 'page'
      ? 'none' // paginated reading: custom swipe + pan (stage scroll is wheel/button driven)
      : 'auto'; // continuous reading: native, momentum scrolling

  return (
    <div
      ref={(el) => registerRef(index, el)}
      data-page-index={index}
      className={`pdfs-page relative mx-auto shrink-0 ${turnClass || ''}`}
      style={{ width: plan.cssW, height: plan.cssH }}
      role="img"
      aria-label={`Page ${index + 1}`}
    >
      {active ? (
        <>
          <canvas ref={baseRef} style={{ width: plan.cssW, height: plan.cssH }} />
          <canvas
            ref={overlayRef}
            className="absolute inset-0"
            style={{
              width: plan.cssW,
              height: plan.cssH,
              touchAction,
              cursor: tool === 'select' ? 'default' : tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair',
            }}
            onPointerDown={emit('down')}
            onPointerMove={emit('move')}
            onPointerUp={emit('up')}
            onPointerCancel={emit('cancel')}
          />
          {status === 'rendering' && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--pdfs-text-2)' }} />
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 grid place-items-center px-6 text-center">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--pdfs-text)' }}>
                  Page {index + 1} could not be rendered
                </p>
                <button
                  type="button"
                  onClick={() => setRetryTick((t) => t + 1)}
                  className="pdfs-bar mt-3 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold"
                >
                  <RefreshCw className="h-4 w-4" /> Retry page
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="pdfs-page-placeholder absolute inset-0" aria-hidden>
          <span className="text-xs font-semibold">{index + 1}</span>
        </div>
      )}
      {children?.(plan)}
    </div>
  );
}
