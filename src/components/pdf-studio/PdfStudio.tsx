// ============================================================
// NikNote PDF Studio — full PDF editor
// Open → annotate (pen, highlighter, text, shapes, signatures,
// images, stamps) → rotate / reorder / add / delete pages → export.
// Works fully on-device: no upload, no server needed.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Circle, Download, Eraser, FilePlus2, FileText,
  Highlighter, Image as ImageIcon, Loader2, MousePointer2, PenLine, Redo2, RotateCw,
  Square, Stamp, Trash2, Type, Undo2, Upload, ZoomIn, ZoomOut, Check, X, Star, Minus,
  Copy, ChevronUp, ChevronDown, Save, Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  type Annotation, type PdfPageEntry, type PdfTool, type Point, type TextAnnotation,
  FONT_STACKS, HIGHLIGHT_COLORS, INK_COLORS, PAGE_SIZES, baseName, createId,
  annotationBounds, drawAnnotations, exportAnnotatedPdf, hitTest, loadImage, toPagePoint,
  translateAnnotation,
} from '@/lib/pdfStudio';
import { isNativeApp, openFileInNewTab, saveFile } from '@/lib/saveFile';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const SIGNATURES_KEY = 'niknote.pdf.signatures.v1';

type ToolDef = { id: PdfTool; label: string; icon: React.FC<{ className?: string }> };

const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'pen', label: 'Pen', icon: PenLine },
  { id: 'highlighter', label: 'Highlight', icon: Highlighter },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'signature', label: 'Sign', icon: Save },
  { id: 'rect', label: 'Box', icon: Square },
  { id: 'ellipse', label: 'Circle', icon: Circle },
  { id: 'line', label: 'Line', icon: Minus },
  { id: 'arrow', label: 'Arrow', icon: ArrowUpRight },
  { id: 'check', label: 'Tick', icon: Check },
  { id: 'cross', label: 'Cross', icon: X },
  { id: 'star', label: 'Star', icon: Star },
  { id: 'image', label: 'Image', icon: ImageIcon },
  { id: 'eraser', label: 'Erase', icon: Eraser },
];

function readSignatures(): string[] {
  try {
    const raw = localStorage.getItem(SIGNATURES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function writeSignatures(list: string[]) {
  try {
    localStorage.setItem(SIGNATURES_KEY, JSON.stringify(list.slice(0, 8)));
  } catch {
    /* storage full — signatures stay in memory */
  }
}

export default function PdfStudio() {
  const [fileName, setFileName] = useState<string>('');
  const [sourceBytes, setSourceBytes] = useState<ArrayBuffer | null>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [pages, setPages] = useState<PdfPageEntry[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [past, setPast] = useState<Annotation[][]>([]);
  const [future, setFuture] = useState<Annotation[][]>([]);
  const [tool, setTool] = useState<PdfTool>('pen');
  const [color, setColor] = useState(INK_COLORS[1]);
  const [strokeWidth, setStrokeWidth] = useState(0.0035);
  const [opacity, setOpacity] = useState(1);
  const [textSize, setTextSize] = useState(0.026);
  const [font, setFont] = useState<TextAnnotation['font']>('sans');
  const [bold, setBold] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastExport, setLastExport] = useState<{ bytes: Uint8Array; name: string } | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState<{ at: Point; value: string } | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [signatures, setSignatures] = useState<string[]>(() => readSignatures());
  const [dragSignature, setDragSignature] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [pageSize, setPageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const draftRef = useRef<Annotation | null>(null);
  const drawingRef = useRef(false);
  const startRef = useRef<Point | null>(null);
  const movingRef = useRef<{ id: string; last: Point } | null>(null);
  const renderTaskRef = useRef<any>(null);

  const page = pages[pageIndex];
  const pageAnnotations = useMemo(
    () => annotations.filter((a) => a.page === page?.id),
    [annotations, page?.id]
  );
  const selected = pageAnnotations.find((a) => a.id === selectedId) || null;

  // ── history helpers ──
  const commit = useCallback((next: Annotation[]) => {
    setPast((p) => [...p.slice(-49), annotations]);
    setFuture([]);
    setAnnotations(next);
  }, [annotations]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    setAnnotations(past[past.length - 1]);
    setPast(past.slice(0, -1));
    setFuture([annotations, ...future].slice(0, 50));
    setSelectedId(null);
  }, [annotations, future, past]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    setAnnotations(future[0]);
    setFuture(future.slice(1));
    setPast([...past, annotations].slice(-50));
    setSelectedId(null);
  }, [annotations, future, past]);

  // ── PDF loading ──
  const loadFile = useCallback(async (file: File) => {
    if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      toast.error('Please choose a PDF file');
      return;
    }
    if (file.size > 80 * 1024 * 1024) {
      toast.error('PDF must be under 80 MB');
      return;
    }
    setLoadingDoc(true);
    setThumbs({});
    setAnnotations([]);
    setPast([]);
    setFuture([]);
    setSelectedId(null);
    try {
      const bytes = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
      const entries: PdfPageEntry[] = [];
      for (let i = 0; i < doc.numPages; i++) {
        const p = await doc.getPage(i + 1);
        const vp = p.getViewport({ scale: 1 });
        entries.push({
          id: `src-${i}`,
          kind: 'original',
          srcIndex: i,
          rotation: ((p.rotate % 360) + 360) % 360,
          width: vp.width,
          height: vp.height,
        });
      }
      setFileName(file.name);
      setSourceBytes(bytes);
      setPdf(doc);
      setPages(entries);
      setPageIndex(0);
      setZoom(1);
      toast.success(`Opened ${file.name} · ${entries.length} page${entries.length > 1 ? 's' : ''}`);
    } catch (err: any) {
      console.error(err);
      toast.error('This PDF could not be opened (it may be password-protected or damaged)');
    } finally {
      setLoadingDoc(false);
    }
  }, []);

  // ── Canvas page render ──
  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!pdf || !page || !canvasRef.current) return;
      const srcPageIndex = page.kind === 'original' ? page.srcIndex : -1;
      try {
        renderTaskRef.current?.cancel?.();
        if (srcPageIndex < 0) {
          // blank page (respects the rotate button)
          const swapped = page.rotation === 90 || page.rotation === 270;
          const targetW = (swapped ? page.height : page.width) * zoom;
          const targetH = (swapped ? page.width : page.height) * zoom;
          const canvas = canvasRef.current;
          canvas.width = Math.round(targetW);
          canvas.height = Math.round(targetH);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          setPageSize({ w: Math.round(targetW), h: Math.round(targetH) });
          return;
        }
        const src = await pdf.getPage(srcPageIndex + 1);
        if (cancelled) return;
        // Fit to the stage width on small screens, honour zoom on desktop.
        const available = Math.min(
          stageRef.current?.clientWidth || 900,
          980
        ) - 24;
        const rotation = ((page.rotation % 360) + 360) % 360;
        const fitViewport = src.getViewport({ scale: 1, rotation });
        const fitScale = available / fitViewport.width;
        // Keep the canvas inside a sane memory budget even at 300% zoom.
        const maxScale = 2400 / fitViewport.width;
        const scale = Math.max(0.2, Math.min(fitScale * zoom, Math.max(fitScale, maxScale)));
        const viewport = src.getViewport({ scale, rotation });
        const canvas = canvasRef.current;
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const task = src.render({ canvasContext: ctx, viewport, canvas } as any);
        renderTaskRef.current = task;
        await task.promise;
        if (cancelled) return;
        setPageSize({ w: canvas.width, h: canvas.height });
      } catch {
        /* cancelled render — ignore */
      }
    };
    render();
    return () => {
      cancelled = true;
    };
  }, [pdf, page, zoom, pageIndex]);

  // ── Thumbnails ──
  useEffect(() => {
    if (!pdf || pages.length === 0) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const entry of pages) {
        if (thumbs[entry.id]) {
          next[entry.id] = thumbs[entry.id];
          continue;
        }
        try {
          if (entry.kind === 'blank') {
            const c = document.createElement('canvas');
            c.width = 80;
            c.height = Math.round((80 * entry.height) / entry.width);
            const ctx = c.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#fff';
              ctx.fillRect(0, 0, c.width, c.height);
              ctx.strokeStyle = '#d7d2ee';
              ctx.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
            }
            next[entry.id] = c.toDataURL('image/png');
            continue;
          }
          const src = await pdf.getPage(entry.srcIndex + 1);
          const base = src.getViewport({ scale: 1 });
          const vp = src.getViewport({ scale: 90 / base.width });
          const c = document.createElement('canvas');
          c.width = Math.round(vp.width);
          c.height = Math.round(vp.height);
          const ctx = c.getContext('2d');
          if (!ctx) continue;
          await src.render({ canvasContext: ctx, viewport: vp, canvas: c } as any).promise;
          next[entry.id] = c.toDataURL('image/png');
        } catch {
          /* skip broken thumbnail */
        }
      }
      if (!cancelled) setThumbs((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, pages]);

  // ── Overlay redraw ──
  const redrawOverlay = useCallback(async () => {
    const overlay = overlayRef.current;
    if (!overlay || !page) return;
    const base = canvasRef.current;
    const w = base?.width || 800;
    const h = base?.height || 1100;
    if (overlay.width !== w) overlay.width = w;
    if (overlay.height !== h) overlay.height = h;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    // make sure embedded images are decoded before painting
    await Promise.all(
      pageAnnotations
        .filter((a): a is Extract<Annotation, { type: 'image' }> => a.type === 'image')
        .map((a) => loadImage(a.dataUrl).catch(() => null))
    );

    const list = draftRef.current ? [...pageAnnotations, draftRef.current] : pageAnnotations;
    drawAnnotations(ctx, list, w, h);

    if (selected) {
      const { x1, y1, x2, y2 } = annotationBounds(selected);
      ctx.save();
      ctx.strokeStyle = '#7c3aed';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x1 * w - 4, y1 * h - 4, (x2 - x1) * w + 8, (y2 - y1) * h + 8);
      ctx.restore();
    }
  }, [page, pageAnnotations, selected]);

  useEffect(() => {
    redrawOverlay();
  }, [redrawOverlay, pageSize]);

  // ── Tool interactions ──
  const stampFor = (t: PdfTool): 'check' | 'cross' | 'star' | null =>
    t === 'check' ? 'check' : t === 'cross' ? 'cross' : t === 'star' ? 'star' : null;

  const pointerDown = async (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!page || !overlayRef.current) return;
    const overlay = overlayRef.current;
    overlay.setPointerCapture(e.pointerId);
    const rect = overlay.getBoundingClientRect();
    const p = toPagePoint(rect, e.clientX, e.clientY);
    startRef.current = p;

    if (tool === 'select') {
      const hit = [...pageAnnotations].reverse().find((a) => hitTest(a, p));
      setSelectedId(hit?.id || null);
      if (hit) movingRef.current = { id: hit.id, last: p };
      return;
    }

    if (tool === 'eraser') {
      drawingRef.current = true;
      eraseAt(p);
      return;
    }

    if (tool === 'text') {
      setTextDraft({ at: p, value: '' });
      return;
    }

    if (tool === 'signature') {
      if (signatures.length === 0) {
        setSignatureOpen(true);
        toast.info('Draw your signature once — then tap anywhere to place it');
      } else {
        placeSignature(dragSignature || signatures[0], p);
      }
      return;
    }

    if (tool === 'image') {
      imageInputRef.current?.click();
      return;
    }

    const stamp = stampFor(tool);
    if (stamp) {
      const ann: Annotation = {
        id: createId(), type: 'stamp', page: page.id, stamp, at: p,
        size: Math.max(0.02, strokeWidth * 12), color,
      };
      commit([...annotations, ann]);
      return;
    }

    drawingRef.current = true;
    if (tool === 'pen' || tool === 'highlighter') {
      draftRef.current = {
        id: createId(), type: 'ink', page: page.id, points: [p],
        color: tool === 'highlighter' ? highlightColor(color) : color,
        width: tool === 'highlighter' ? strokeWidth * 2.2 : strokeWidth,
        opacity: tool === 'highlighter' ? 0.45 : opacity,
        highlighter: tool === 'highlighter',
      };
    } else if (['rect', 'ellipse', 'line', 'arrow'].includes(tool)) {
      draftRef.current = {
        id: createId(), type: 'shape', page: page.id,
        shape: tool as 'rect' | 'ellipse' | 'line' | 'arrow',
        from: p, to: p, color, width: strokeWidth * 1.6, opacity,
      };
    }
    redrawOverlay();
  };

  const pointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!page || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const p = toPagePoint(rect, e.clientX, e.clientY);

    if (movingRef.current) {
      const { id, last } = movingRef.current;
      const dx = p.x - last.x;
      const dy = p.y - last.y;
      movingRef.current = { id, last: p };
      setAnnotations((prev) => prev.map((a) => (a.id === id ? translateAnnotation(a, dx, dy) : a)));
      return;
    }

    if (tool === 'eraser' && drawingRef.current) {
      eraseAt(p);
      return;
    }

    if (!drawingRef.current || !draftRef.current) return;
    const draft = draftRef.current;
    if (draft.type === 'ink') draft.points = [...draft.points, p];
    if (draft.type === 'shape') draft.to = p;
    draftRef.current = { ...draft } as Annotation;
    redrawOverlay();
  };

  const pointerUp = () => {
    movingRef.current = null;
    if (tool === 'eraser') {
      drawingRef.current = false;
      return;
    }
    if (!drawingRef.current || !draftRef.current) return;
    drawingRef.current = false;
    const draft = draftRef.current;
    draftRef.current = null;
    const isTiny =
      draft.type === 'ink'
        ? draft.points.length < 2
        : draft.type === 'shape' && Math.abs(draft.to.x - draft.from.x) + Math.abs(draft.to.y - draft.from.y) < 0.008;
    if (isTiny) {
      redrawOverlay();
      return;
    }
    commit([...annotations, draft]);
  };

  const eraseAt = (p: Point) => {
    const doomed = pageAnnotations.filter((a) => hitTest(a, p, 0.008));
    if (doomed.length === 0) return;
    const ids = new Set(doomed.map((a) => a.id));
    setPast((prev) => [...prev.slice(-49), annotations]);
    setFuture([]);
    setAnnotations((prev) => prev.filter((a) => !ids.has(a.id)));
  };

  const highlightColor = (c: string) =>
    HIGHLIGHT_COLORS.includes(c) ? c : HIGHLIGHT_COLORS[0];

  const placeSignature = (dataUrl: string, at: Point) => {
    if (!page) return;
    const ann: Annotation = {
      id: createId(), type: 'image', page: page.id,
      at: { x: Math.min(0.98, at.x), y: Math.min(0.98, at.y) },
      w: 0.3, h: 0.1, dataUrl, label: 'signature',
    };
    commit([...annotations, ann]);
    setSelectedId(ann.id);
  };

  const commitText = () => {
    if (!page || !textDraft) return;
    const value = textDraft.value.trim();
    setTextDraft(null);
    if (!value) return;
    const ann: Annotation = {
      id: createId(), type: 'text', page: page.id, at: textDraft.at,
      text: value, color, size: textSize, font, bold,
    };
    commit([...annotations, ann]);
    setSelectedId(ann.id);
  };

  const onImagePicked = async (file: File | null) => {
    if (!file || !page) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const img = await loadImage(dataUrl).catch(() => null);
    if (!img) {
      toast.error('Could not read that image');
      return;
    }
    const maxW = 0.55;
    const ratio = img.height / img.width;
    const w = Math.min(maxW, 0.55);
    const ann: Annotation = {
      id: createId(), type: 'image', page: page.id,
      at: { x: 0.2, y: 0.2 }, w, h: Math.min(0.9, (w * ratio * page.width) / page.height), dataUrl,
    };
    commit([...annotations, ann]);
    setSelectedId(ann.id);
    setTool('select');
  };

  // ── Page operations ──
  const rotatePage = () => {
    if (!page) return;
    setPages((prev) =>
      prev.map((p) => (p.id === page.id ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    );
  };

  const addPage = (size: 'same' | 'a4' | 'letter' = 'same') => {
    if (!page) return;
    const dims = size === 'same' ? { width: page.width, height: page.height } : PAGE_SIZES[size];
    const blank: PdfPageEntry = {
      id: `blank-${createId()}`, kind: 'blank', srcIndex: -1,
      rotation: 0, width: dims.width, height: dims.height,
    };
    // insert right after the current page, then jump to it
    setPages((prev) => [...prev.slice(0, pageIndex + 1), blank, ...prev.slice(pageIndex + 1)]);
    setPageIndex(pageIndex + 1);
  };

  const duplicatePage = () => {
    if (!page) return;
    const copy: PdfPageEntry = {
      ...page,
      id: `dup-${createId()}`,
      kind: page.kind,
      srcIndex: page.srcIndex,
    };
    const copyAnns = pageAnnotations.map((a) => ({ ...a, id: createId(), page: copy.id }));
    setPages((prev) => [...prev.slice(0, pageIndex + 1), copy, ...prev.slice(pageIndex + 1)]);
    setAnnotations((prev) => [...prev, ...copyAnns]);
    setPageIndex(pageIndex + 1);
  };

  const deletePage = () => {
    if (!page) return;
    if (pages.length === 1) {
      toast.error('A PDF needs at least one page');
      return;
    }
    const id = page.id;
    setPages((prev) => prev.filter((p) => p.id !== id));
    setAnnotations((prev) => prev.filter((a) => a.page !== id));
    setPageIndex((i) => Math.max(0, Math.min(i, pages.length - 2)));
  };

  const movePage = (dir: -1 | 1) => {
    const target = pageIndex + dir;
    if (!page || target < 0 || target >= pages.length) return;
    setPages((prev) => {
      const next = [...prev];
      [next[pageIndex], next[target]] = [next[target], next[pageIndex]];
      return next;
    });
    setPageIndex(target);
  };

  const exportPdf = async () => {
    if (!sourceBytes || pages.length === 0) return;
    setBusy(true);
    setExportProgress({ done: 0, total: pages.length });
    try {
      const bytes = await exportAnnotatedPdf({
        bytes: sourceBytes,
        pages,
        annotations,
        scale: 2,
        onProgress: (done, total) => setExportProgress({ done, total }),
      });
      const outName = `${baseName(fileName || 'document')}-niknote.pdf`;
      setLastExport({ bytes, name: outName });

      const result = await saveFile(bytes, outName, 'application/pdf');
      if (result === 'shared') {
        toast.success('PDF ready — choose where to save it');
      } else if (result === 'downloaded') {
        toast.success(
          isNativeApp()
            ? `Saved to Documents › ${outName} (${pages.length} pages)`
            : `Downloaded ${outName} (${pages.length} pages)`
        );
      } else {
        toast.info('Save cancelled — tap Save PDF again');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Could not export this PDF', {
        action: {
          label: 'Retry',
          onClick: () => {
            void exportPdf();
          },
        },
      });
    } finally {
      setBusy(false);
      setExportProgress(null);
    }
  };

  const sharePdf = async () => {
    if (!lastExport) {
      toast.info('Pehle Save PDF dabao — phir share kar sakte ho');
      return;
    }
    if (isNativeApp() || (navigator as any)?.share) {
      try {
        await saveFile(lastExport.bytes, lastExport.name, 'application/pdf');
        return;
      } catch {
        /* fall through */
      }
    }
    if (!openFileInNewTab(lastExport.bytes)) {
      toast.error('Sharing is not available in this browser');
    }
  };

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        commit(annotations.filter((a) => a.id !== selectedId));
        setSelectedId(null);
      } else if (e.key === 'Escape') {
        setSelectedId(null);
        setTextDraft(null);
      } else if (e.key === 'ArrowRight' && !mod) {
        setPageIndex((i) => Math.min(pages.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft' && !mod) {
        setPageIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [annotations, commit, pages.length, redo, selectedId, undo]);

  const activeToolLabel = TOOLS.find((t) => t.id === tool)?.label || 'Pen';
  const showColors = ['pen', 'highlighter', 'text', 'rect', 'ellipse', 'line', 'arrow', 'check', 'cross', 'star'].includes(tool);

  // ── Empty state ──
  if (!pdf) {
    return (
      <div className="min-h-screen bg-[#F7F5FD] flex flex-col">
        <TopBar fileName="" onOpen={() => fileInputRef.current?.click()} />
        <div className="flex-1 flex items-center justify-center px-5 py-10">
          <div className="w-full max-w-xl rounded-3xl bg-white border border-[#ECEAF6] shadow-[0_10px_40px_rgba(30,20,70,0.06)] p-7 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FDE68A] to-[#F87171] flex items-center justify-center mb-4">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-extrabold text-[#231F39]">PDF Studio — edit any PDF</h1>
            <p className="mt-2 text-sm text-[#6B6685]">
              Type, write, highlight, draw shapes, add signatures & photos, rotate or reorder pages — everything
              happens on your device. Your file is never uploaded.
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={loadingDoc}
              className="mt-5 h-11 px-6 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold"
            >
              {loadingDoc ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {loadingDoc ? 'Opening…' : 'Open a PDF'}
            </Button>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11.5px] text-[#5B4E89]">
              {['Pen & highlighter', 'Text anywhere', 'Signatures', 'Shapes & arrows', 'Ticks & stamps', 'Images', 'Rotate & reorder', 'Add blank pages', 'Flattened export'].map((f) => (
                <div key={f} className="rounded-xl bg-[#F8F6FE] border border-[#F1EFF9] px-2.5 py-2 font-medium">{f}</div>
              ))}
            </div>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F5FD] flex flex-col">
      <TopBar
        fileName={fileName}
        onOpen={() => fileInputRef.current?.click()}
        onExport={exportPdf}
        onShare={sharePdf}
        busy={busy}
        progress={exportProgress}
        pageLabel={`${pageIndex + 1} / ${pages.length}`}
        onPrevPage={() => setPageIndex((i) => Math.max(0, i - 1))}
        onNextPage={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
        onUndo={undo}
        onRedo={redo}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        zoom={zoom}
        onZoom={(z) => setZoom(Math.min(3, Math.max(0.4, z)))}
        annotationCount={annotations.length}
      />

      {/* Mobile page strip — always visible so multi-page PDFs are easy to move around */}
      <div className="lg:hidden flex items-center gap-2 overflow-x-auto border-b border-[#ECEAF6] bg-white/80 px-2 py-1.5">
        {pages.map((p, i) => (
          <button
            key={`m-${p.id}`}
            onClick={() => setPageIndex(i)}
            aria-label={`Page ${i + 1}`}
            className={`relative shrink-0 h-16 w-12 rounded-lg overflow-hidden border-2 bg-white ${
              i === pageIndex ? 'border-[#7C3AED]' : 'border-[#ECEAF6]'
            }`}
          >
            {thumbs[p.id] ? <img src={thumbs[p.id]} alt="" className="h-full w-full object-cover" /> : null}
            <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[9px] font-bold text-center">
              {i + 1}
            </span>
          </button>
        ))}
        <button
          onClick={() => addPage('same')}
          className="shrink-0 h-16 w-12 rounded-lg border-2 border-dashed border-[#C4B5FD] text-[#7C3AED] flex flex-col items-center justify-center text-[9px] font-bold"
        >
          <FilePlus2 className="w-3.5 h-3.5" />
          Page
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Page rail */}
        <aside className="hidden lg:flex w-[132px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-[#ECEAF6] bg-white/70 p-2.5">
          {pages.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setPageIndex(i)}
              className={`group relative rounded-xl overflow-hidden border-2 transition-all ${
                i === pageIndex ? 'border-[#7C3AED] shadow-md' : 'border-transparent hover:border-[#DDD6FE]'
              }`}
            >
              {thumbs[p.id] ? (
                <img src={thumbs[p.id]} alt={`Page ${i + 1}`} className="w-full bg-white" />
              ) : (
                <div className="w-full aspect-[3/4] bg-[#F3F0FB] flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-[#9A93B8]" />
                </div>
              )}
              <span className="absolute bottom-1 left-1 rounded-md bg-black/60 text-white text-[10px] px-1.5 py-0.5 font-semibold">
                {i + 1}
              </span>
            </button>
          ))}
        </aside>

        {/* Stage */}
        <div ref={stageRef} className="flex-1 min-w-0 overflow-auto px-2 sm:px-4 py-3">
          <div className="mx-auto w-fit">
            <div className="relative rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(30,20,70,0.12)] bg-white">
              <canvas ref={canvasRef} className="block" />
              <canvas
                ref={overlayRef}
                className={`absolute inset-0 w-full h-full ${
                  tool === 'select' ? 'cursor-default' : tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'
                }`}
                style={{ touchAction: 'none' }}
                onPointerDown={pointerDown}
                onPointerMove={pointerMove}
                onPointerUp={pointerUp}
                onPointerLeave={pointerUp}
                onPointerCancel={pointerUp}
              />
              {textDraft && (
                <div
                  className="absolute z-20"
                  style={{ left: `${textDraft.at.x * 100}%`, top: `${textDraft.at.y * 100}%`, maxWidth: '70%' }}
                >
                  <textarea
                    autoFocus
                    value={textDraft.value}
                    onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        commitText();
                      }
                      if (e.key === 'Escape') setTextDraft(null);
                    }}
                    placeholder="Type here…"
                    className="min-w-[180px] min-h-[38px] rounded-lg border-2 border-[#7C3AED] bg-white/95 px-2 py-1 shadow-lg outline-none"
                    style={{
                      color,
                      fontSize: `${Math.round(textSize * (pageSize.h || 900))}px`,
                      fontFamily: FONT_STACKS[font],
                      fontWeight: bold ? 700 : 500,
                    }}
                  />
                  <div className="mt-1 flex gap-1.5">
                    <button onClick={commitText} className="rounded-md bg-[#7C3AED] text-white text-[11px] px-2 py-1 font-semibold">
                      Add text
                    </button>
                    <button onClick={() => setTextDraft(null)} className="rounded-md bg-white border text-[11px] px-2 py-1 font-semibold">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="sticky bottom-0 z-30 border-t border-[#ECEAF6] bg-white/95 backdrop-blur px-2 py-2">
        <div className="mx-auto max-w-4xl flex flex-col gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {TOOLS.map((t) => {
              const Icon = t.icon;
              const active = tool === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setTool(t.id);
                    setSelectedId(null);
                    if (t.id === 'highlighter') setColor(HIGHLIGHT_COLORS[0]);
                    else if (!HIGHLIGHT_COLORS.includes(color) || t.id === 'pen') setColor(INK_COLORS[1]);
                  }}
                  title={t.label}
                  className={`shrink-0 h-10 min-w-10 px-2.5 rounded-xl border flex items-center gap-1.5 text-[12px] font-semibold transition-all ${
                    active
                      ? 'bg-[#7C3AED] border-[#7C3AED] text-white shadow'
                      : 'bg-white border-[#ECEAF6] text-[#4B4568] hover:border-[#C4B5FD]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              );
            })}
            <div className="mx-1 h-8 w-px bg-[#ECEAF6] shrink-0" />
            <ToolbarIcon label="Rotate page" icon={RotateCw} onClick={rotatePage} />
            <ToolbarIcon label="Add blank page (same size)" icon={FilePlus2} onClick={() => addPage('same')} />
            <button
              onClick={() => addPage('a4')}
              title="Add A4 blank page"
              className="shrink-0 h-10 px-2 rounded-xl border border-[#ECEAF6] bg-white text-[11px] font-bold text-[#4B4568] hover:border-[#C4B5FD]"
            >
              + A4
            </button>
            <button
              onClick={() => addPage('letter')}
              title="Add Letter blank page"
              className="shrink-0 h-10 px-2 rounded-xl border border-[#ECEAF6] bg-white text-[11px] font-bold text-[#4B4568] hover:border-[#C4B5FD]"
            >
              + Letter
            </button>
            <ToolbarIcon label="Duplicate page" icon={Copy} onClick={duplicatePage} />
            <ToolbarIcon label="Move page up" icon={ChevronUp} onClick={() => movePage(-1)} />
            <ToolbarIcon label="Move page down" icon={ChevronDown} onClick={() => movePage(1)} />
            <ToolbarIcon label="Delete page" icon={Trash2} onClick={deletePage} danger />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            {showColors && (
              <div className="flex items-center gap-1 shrink-0">
                {(tool === 'highlighter' ? HIGHLIGHT_COLORS : INK_COLORS).map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    aria-label={c}
                    className={`h-6 w-6 rounded-full border-2 transition-transform ${
                      color === c ? 'border-[#7C3AED] scale-110' : 'border-white shadow'
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            )}
            <label className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold text-[#6B6685]">
              Size
              <input
                type="range"
                min={1}
                max={12}
                step={1}
                value={Math.round(strokeWidth * 1000)}
                onChange={(e) => setStrokeWidth(Number(e.target.value) / 1000)}
                className="w-20 accent-[#7C3AED]"
              />
            </label>
            {(tool === 'text') && (
              <>
                <label className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold text-[#6B6685]">
                  Font
                  <select
                    value={font}
                    onChange={(e) => setFont(e.target.value as TextAnnotation['font'])}
                    className="rounded-md border border-[#ECEAF6] px-1.5 py-1 text-[11px]"
                  >
                    <option value="sans">Sans</option>
                    <option value="serif">Serif</option>
                    <option value="cursive">Handwriting</option>
                    <option value="mono">Mono</option>
                  </select>
                </label>
                <label className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold text-[#6B6685]">
                  Text size
                  <input
                    type="range"
                    min={10}
                    max={60}
                    value={Math.round(textSize * 1000)}
                    onChange={(e) => setTextSize(Number(e.target.value) / 1000)}
                    className="w-20 accent-[#7C3AED]"
                  />
                </label>
                <button
                  onClick={() => setBold((b) => !b)}
                  className={`shrink-0 h-7 px-2 rounded-md border text-[11px] font-bold ${
                    bold ? 'bg-[#7C3AED] text-white border-[#7C3AED]' : 'bg-white text-[#4B4568] border-[#ECEAF6]'
                  }`}
                >
                  B
                </button>
              </>
            )}
            {['pen', 'rect', 'ellipse', 'line', 'arrow'].includes(tool) && (
              <label className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold text-[#6B6685]">
                Opacity
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={Math.round(opacity * 100)}
                  onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                  className="w-16 accent-[#7C3AED]"
                />
              </label>
            )}
            {tool === 'signature' && (
              <button
                onClick={() => setSignatureOpen(true)}
                className="shrink-0 h-7 px-2.5 rounded-md bg-[#F3ECFF] text-[#5B21B6] text-[11px] font-bold"
              >
                New signature
              </button>
            )}
            {signatures.length > 0 && tool === 'signature' && (
              <div className="flex items-center gap-1">
                {signatures.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setDragSignature(s)}
                    className={`h-8 w-14 rounded-md border bg-white p-0.5 ${
                      dragSignature === s ? 'border-[#7C3AED]' : 'border-[#ECEAF6]'
                    }`}
                    title="Tap a page position after choosing"
                  >
                    <img src={s} alt={`signature ${i + 1}`} className="h-full w-full object-contain" />
                  </button>
                ))}
              </div>
            )}
            {selected && (
              <div className="shrink-0 ml-auto flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[#7C3AED]">Selected</span>
                <button
                  onClick={() => {
                    commit(annotations.filter((a) => a.id !== selected.id));
                    setSelectedId(null);
                  }}
                  className="h-7 px-2 rounded-md bg-[#FEE2E2] text-[#B91C1C] text-[11px] font-bold flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            )}
            <div className="shrink-0 ml-auto flex items-center gap-1.5">
              <button
                onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                disabled={pageIndex === 0}
                aria-label="Previous page"
                className="h-7 w-7 rounded-md border border-[#ECEAF6] bg-white flex items-center justify-center disabled:opacity-40"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min={1}
                max={pages.length}
                value={pageIndex + 1}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) setPageIndex(Math.min(pages.length - 1, Math.max(0, n - 1)));
                }}
                aria-label="Page number"
                className="h-7 w-11 rounded-md border border-[#ECEAF6] bg-white text-center text-[11px] font-bold text-[#4B4568]"
              />
              <span className="text-[10.5px] font-semibold text-[#8A84A6]">/ {pages.length}</span>
              <button
                onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
                disabled={pageIndex === pages.length - 1}
                aria-label="Next page"
                className="h-7 w-7 rounded-md border border-[#ECEAF6] bg-white flex items-center justify-center disabled:opacity-40"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <span className="hidden sm:inline text-[11px] font-semibold text-[#8A84A6]">
                {activeToolLabel} · {pageAnnotations.length} marks
              </span>
            </div>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onImagePicked(e.target.files?.[0] || null);
          e.target.value = '';
        }}
      />

      {signatureOpen && (
        <SignatureModal
          onChange={(list) => {
            setSignatures(list);
            writeSignatures(list);
          }}
          onClose={() => setSignatureOpen(false)}
          onSaved={(dataUrl) => {
            setSignatureOpen(false);
            setTool('signature');
            if (dragSignature) setDragSignature(dataUrl);
          }}
        />
      )}
    </div>
  );
}

function TopBar({
  fileName, onOpen, onExport, onShare, busy, onUndo, onRedo, canUndo, canRedo, zoom, onZoom,
  annotationCount, progress, pageLabel, onPrevPage, onNextPage,
}: {
  fileName: string;
  onOpen: () => void;
  onExport?: () => void;
  onShare?: () => void;
  busy?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  zoom?: number;
  onZoom?: (z: number) => void;
  annotationCount?: number;
  progress?: { done: number; total: number } | null;
  pageLabel?: string;
  onPrevPage?: () => void;
  onNextPage?: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#ECEAF6] bg-white/95 backdrop-blur px-2.5 py-2">
      <div className="mx-auto max-w-6xl flex items-center gap-2">
        <Link to="/hub" className="shrink-0 h-9 w-9 rounded-xl border border-[#ECEAF6] bg-white flex items-center justify-center text-[#5B4E89]">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span className="text-[13px] font-extrabold text-[#231F39] truncate">
              {fileName || 'PDF Studio'}
            </span>
          </div>
          <p className="text-[10.5px] text-[#8A84A6] font-medium">
            {busy && progress
              ? `Saving page ${progress.done}/${progress.total}…`
              : fileName
                ? `${annotationCount || 0} edits${pageLabel ? ` · page ${pageLabel}` : ''} · on your device`
                : 'Edit PDFs on your device'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {pageLabel && (
            <div className="sm:hidden flex items-center gap-1 rounded-xl border border-[#ECEAF6] bg-white px-1">
              <button onClick={onPrevPage} aria-label="Previous page" className="h-8 w-7 flex items-center justify-center">
                <ArrowLeft className="w-3.5 h-3.5 text-[#4B4568]" />
              </button>
              <span className="text-[11px] font-bold text-[#4B4568]">{pageLabel}</span>
              <button onClick={onNextPage} aria-label="Next page" className="h-8 w-7 flex items-center justify-center">
                <ArrowRight className="w-3.5 h-3.5 text-[#4B4568]" />
              </button>
            </div>
          )}
          {onUndo && (
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="h-9 w-9 rounded-xl border border-[#ECEAF6] bg-white flex items-center justify-center disabled:opacity-40"
            >
              <Undo2 className="w-4 h-4 text-[#4B4568]" />
            </button>
          )}
          {onRedo && (
            <button
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              className="h-9 w-9 rounded-xl border border-[#ECEAF6] bg-white flex items-center justify-center disabled:opacity-40"
            >
              <Redo2 className="w-4 h-4 text-[#4B4568]" />
            </button>
          )}
          {onZoom && (
            <div className="hidden sm:flex items-center gap-1 rounded-xl border border-[#ECEAF6] bg-white px-1">
              <button onClick={() => onZoom((zoom || 1) - 0.2)} className="h-8 w-7 flex items-center justify-center">
                <ZoomOut className="w-3.5 h-3.5 text-[#4B4568]" />
              </button>
              <span className="text-[11px] font-bold text-[#4B4568] w-9 text-center">{Math.round((zoom || 1) * 100)}%</span>
              <button onClick={() => onZoom((zoom || 1) + 0.2)} className="h-8 w-7 flex items-center justify-center">
                <ZoomIn className="w-3.5 h-3.5 text-[#4B4568]" />
              </button>
            </div>
          )}
          <button
            onClick={onOpen}
            className="h-9 px-3 rounded-xl border border-[#ECEAF6] bg-white text-[12px] font-bold text-[#4B4568] flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Open</span>
          </button>
          {onShare && (
            <button
              onClick={onShare}
              className="h-9 px-3 rounded-xl border border-[#ECEAF6] bg-white text-[12px] font-bold text-[#4B4568] flex items-center gap-1.5"
              title="Share the saved PDF"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onExport && (
            <button
              onClick={onExport}
              disabled={busy}
              className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white text-[12px] font-bold flex items-center gap-1.5 shadow disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{busy ? 'Saving…' : 'Save PDF'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function ToolbarIcon({
  label, icon: Icon, onClick, danger,
}: { label: string; icon: React.FC<{ className?: string }>; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`shrink-0 h-10 w-10 rounded-xl border flex items-center justify-center ${
        danger ? 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]' : 'bg-white border-[#ECEAF6] text-[#4B4568] hover:border-[#C4B5FD]'
      }`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function SignatureModal({
  onClose, onSaved, onChange,
}: { onClose: () => void; onSaved: (dataUrl: string) => void; onChange: (list: string[]) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setHasInk(true);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  const save = () => {
    const canvas = canvasRef.current!;
    // trim white margins so the signature places tightly on the page
    const ctx = canvas.getContext('2d')!;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        if (data.data[i] < 240 || data.data[i + 1] < 240 || data.data[i + 2] < 240) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX <= minX || maxY <= minY) {
      toast.error('Draw your signature first');
      return;
    }
    const pad = 8;
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const octx = out.getContext('2d')!;
    octx.drawImage(canvas, minX - pad, minY - pad, w, h, 0, 0, w, h);
    const dataUrl = out.toDataURL('image/png');
    const list = [dataUrl, ...readSignatures()].slice(0, 8);
    onChange(list);
    onSaved(dataUrl);
    toast.success('Signature saved');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-extrabold text-[#231F39]">Your signature</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-lg border flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11.5px] text-[#7A7495] mb-2">Draw with your finger or mouse. It stays stored on this device.</p>
        <canvas
          ref={canvasRef}
          width={640}
          height={240}
          className="w-full rounded-2xl border-2 border-dashed border-[#DDD6FE] bg-white"
          style={{ touchAction: 'none' }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={() => { drawing.current = false; }}
          onPointerLeave={() => { drawing.current = false; }}
        />
        <div className="mt-3 flex items-center gap-2">
          <button onClick={clear} className="h-10 px-3 rounded-xl border text-[12px] font-bold text-[#4B4568]">
            Clear
          </button>
          <button
            onClick={save}
            disabled={!hasInk}
            className="ml-auto h-10 px-4 rounded-xl bg-[#7C3AED] text-white text-[12px] font-bold disabled:opacity-50 flex items-center gap-1.5"
          >
            <Stamp className="w-4 h-4" /> Save signature
          </button>
        </div>
      </div>
    </div>
  );
}
