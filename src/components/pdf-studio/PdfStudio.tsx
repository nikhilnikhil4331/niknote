// ============================================================
// NikNote PDF Editor 2.0
// Read-first, mobile-first PDF workspace:
//   open → read (sharp, lazy, scroll or paginated) → annotate
//   from the circular tool launcher → manage pages → export.
// Everything runs on-device; the original PDF bytes are kept
// intact and annotations export through pdf-lib (no rasterizing).
//
// Rendering/navigation rules live in src/lib/pdfEditor.ts,
// the annotation model + exporter in src/lib/pdfStudio.ts.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  ArrowLeft, ArrowUpRight, Check, ChevronLeft, ChevronRight, Circle, Combine,
  Download, Eraser, FileText, GalleryVertical, Highlighter, Image as ImageIcon,
  Loader2, Lock, Minus, MoreVertical, PanelLeft, PenLine, PenTool, Redo2,
  Search, Share2, Square, Star, Trash2, TriangleAlert, Type, Undo2, Upload, X,
  ZoomIn, ZoomOut,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  type Annotation, type PdfPageEntry, type PdfTool, type Point, type TextAnnotation, type TextEditAnnotation,
  FONT_STACKS, HIGHLIGHT_COLORS, INK_COLORS, PAGE_SIZES, baseName, createId,
  exportAnnotatedPdf, hitTest, isImageReady, loadImage, translateAnnotation,
} from '@/lib/pdfStudio';
import {
  classifyHorizontalSwipe, classifyLoadError, clampPageIndex, clampZoom,
  displayZoomPercent, loadErrorMessage, nextPageIndex, pageAfterDelete,
  pageLabel, parsePageInput, pinchZoom, planPageRender, pointerDistance,
  prevPageIndex, renderWindow, zoomForActualSize, zoomForFitPage,
  SHAPE_TOOLS, TOOL_LABELS, displayDims,
  type PdfLoadErrorKind,
} from '@/lib/pdfEditor';
import { isNativeApp, openFileInNewTab, saveFile } from '@/lib/saveFile';
import { buildTextRuns, runAtPoint, type RawTextItem, type TextRun } from '@/lib/pdfTextEdit';
import PdfPageView, { type PagePointerMeta, type PointerKind } from './PdfPageView';
import RadialTools, { type FanChoice } from './RadialTools';
import PagePanel, { clearThumbnailCache } from './PagePanel';
import './pdf-studio.css';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const SIGNATURES_KEY = 'niknote.pdf.signatures.v1';
const SESSION_KEY = 'niknote.pdfsession.v2';
const MAX_FILE_BYTES = 80 * 1024 * 1024;

type ViewMode = 'scroll' | 'page';

function readSignatures(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SIGNATURES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function writeSignatures(list: string[]) {
  try {
    localStorage.setItem(SIGNATURES_KEY, JSON.stringify(list.slice(0, 8)));
  } catch { /* signatures stay in memory */ }
}

interface SavedSession {
  docKey: string;
  pages: PdfPageEntry[];
  annotations: Annotation[];
}

function readSession(docKey: string): SavedSession | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (parsed && parsed.docKey === docKey && Array.isArray(parsed.pages) && Array.isArray(parsed.annotations)) {
      return parsed as SavedSession;
    }
  } catch { /* ignore */ }
  return null;
}

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function PdfStudio() {
  // ── Document ──
  const [fileName, setFileName] = useState('');
  const [sourceBytes, setSourceBytes] = useState<ArrayBuffer | null>(null);
  const [pdf, setPdf] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [docKey, setDocKey] = useState('');
  const [pages, setPages] = useState<PdfPageEntry[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error' | 'password'>('idle');
  const [loadError, setLoadError] = useState<PdfLoadErrorKind>('unknown');
  const [passwordWrong, setPasswordWrong] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pendingReplace, setPendingReplace] = useState<File | null>(null);

  // ── Annotations & tools (Read is the default — nothing draws until chosen) ──
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [past, setPast] = useState<Annotation[][]>([]);
  const [future, setFuture] = useState<Annotation[][]>([]);
  const [tool, setTool] = useState<PdfTool>('select');
  const [lastShape, setLastShape] = useState<PdfTool>('rect');
  const [inkColor, setInkColor] = useState(INK_COLORS[1]);
  const [hlColor, setHlColor] = useState(HIGHLIGHT_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(0.0035);
  const [opacity, setOpacity] = useState(1);
  const [textSize, setTextSize] = useState(0.026);
  const [font, setFont] = useState<TextAnnotation['font']>('sans');
  const [bold, setBold] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftAnn, setDraftAnn] = useState<Annotation | null>(null);
  const [textDraft, setTextDraft] = useState<{ pageId: string; at: Point; value: string } | null>(null);
  const [textRuns, setTextRuns] = useState<Record<string, TextRun[]>>({});
  const [runsStatus, setRunsStatus] = useState<Record<string, 'loading' | 'done'>>({});
  const [editDraft, setEditDraft] = useState<{ pageId: string; run: TextRun; value: string } | null>(null);
  const [imageTick, setImageTick] = useState(0);
  const [signatures, setSignatures] = useState<string[]>(() => readSignatures());
  const [activeSignature, setActiveSignature] = useState<string | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);

  // ── View ──
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('scroll');
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [dpr, setDpr] = useState(() => (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1));
  const [nearSet, setNearSet] = useState<Set<number>>(new Set());
  const [turn, setTurn] = useState<{ dir: 'next' | 'prev'; key: number } | null>(null);
  const [preview, setPreview] = useState<{ factor: number; ox: number; oy: number } | null>(null);
  const [panelOpen, setPanelOpen] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [goToOpen, setGoToOpen] = useState(false);
  const [zoomMenu, setZoomMenu] = useState<null | 'cluster' | 'floating'>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // ── Export / search ──
  const [busy, setBusy] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastExport, setLastExport] = useState<{ bytes: Uint8Array; name: string; at: Date } | null>(null);
  const [exportedSeq, setExportedSeq] = useState(0);
  const [editSeq, setEditSeq] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchHits, setSearchHits] = useState<number[]>([]);
  const [searchCursor, setSearchCursor] = useState(0);
  const [searched, setSearched] = useState(false);

  // ── Refs (handlers always read fresh values — no stale closures) ──
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pageElsRef = useRef(new Map<number, HTMLDivElement>());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFileRef = useRef<File | null>(null);
  const pendingImageRef = useRef<{ pageId: string; at: Point } | null>(null);
  const pdfRef = useRef<pdfjs.PDFDocumentProxy | null>(null);
  const pagesRef = useRef<PdfPageEntry[]>([]);
  const pageIndexRef = useRef(0);
  const annotationsRef = useRef<Annotation[]>([]);
  const draftRef = useRef<Annotation | null>(null);
  const draftRafRef = useRef(0);
  const drawingRef = useRef(false);
  const movingRef = useRef<{ id: string; last: Point; snapshot: Annotation[]; moved: boolean } | null>(null);
  const eraseSnapshotRef = useRef<Annotation[] | null>(null);
  const swipeRef = useRef<{ x: number; y: number; t: number; pointerId: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const lastTapRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);
  const programmaticScrollRef = useRef(0);
  const textCacheRef = useRef(new Map<number, string>());
  const textRunsRef = useRef<Record<string, TextRun[]>>({});
  const runsKeyRef = useRef(new Map<string, number>());
  const loadTokenRef = useRef(0);

  pagesRef.current = pages;
  pageIndexRef.current = pageIndex;
  annotationsRef.current = annotations;
  pdfRef.current = pdf;
  textRunsRef.current = textRuns;

  const page = pages[pageIndex] as PdfPageEntry | undefined;
  const dirty = editSeq > exportedSeq;
  const annotationsByPage = useMemo(() => {
    const map = new Map<string, Annotation[]>();
    for (const a of annotations) {
      const list = map.get(a.page);
      if (list) list.push(a);
      else map.set(a.page, [a]);
    }
    return map;
  }, [annotations]);
  const selected = useMemo(
    () => annotations.find((a) => a.id === selectedId) || null,
    [annotations, selectedId]
  );

  const bumpEdit = useCallback(() => setEditSeq((s) => s + 1), []);

  // ── History ──
  const commitAnnotations = useCallback((next: Annotation[]) => {
    setPast((p) => [...p.slice(-49), annotationsRef.current]);
    setFuture([]);
    setAnnotations(next);
    bumpEdit();
  }, [bumpEdit]);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      setFuture((f) => [annotationsRef.current, ...f].slice(0, 50));
      setAnnotations(p[p.length - 1]);
      return p.slice(0, -1);
    });
    setSelectedId(null);
    bumpEdit();
  }, [bumpEdit]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      setPast((p) => [...p.slice(-49), annotationsRef.current]);
      setAnnotations(f[0]);
      return f.slice(1);
    });
    setSelectedId(null);
    bumpEdit();
  }, [bumpEdit]);

  // ── Stage measurement + DPR tracking ──
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      setStageSize({ w: el.clientWidth, h: el.clientHeight });
      setDpr(window.devicePixelRatio || 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pdf]);

  const stagePadX = stageSize.w >= 640 ? 48 : 24;
  const containerW = Math.max(200, stageSize.w - stagePadX);

  // ── Navigation controller (single source of truth) ──
  const registerPageEl = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) pageElsRef.current.set(index, el);
    else pageElsRef.current.delete(index);
  }, []);

  const goToPage = useCallback((rawIndex: number, opts?: { dir?: 'next' | 'prev' }) => {
    const count = pagesRef.current.length;
    if (count === 0) return;
    const target = clampPageIndex(rawIndex, count);
    const current = pageIndexRef.current;
    if (target === current && viewMode === 'page') return;
    setPageIndex(target);
    setSelectedId(null);
    setTextDraft(null);
    setEditDraft(null);
    if (viewMode === 'page') {
      setTurn({ dir: opts?.dir || (target > current ? 'next' : 'prev'), key: Date.now() });
      stageRef.current?.scrollTo({ top: 0, left: 0 });
    } else {
      programmaticScrollRef.current = Date.now();
      requestAnimationFrame(() => {
        pageElsRef.current.get(target)?.scrollIntoView({
          block: 'start',
          behavior: reducedMotion() ? 'auto' : 'smooth',
        });
      });
    }
  }, [viewMode]);

  const goNext = useCallback(() => goToPage(nextPageIndex(pageIndexRef.current, pagesRef.current.length), { dir: 'next' }), [goToPage]);
  const goPrev = useCallback(() => goToPage(prevPageIndex(pageIndexRef.current, pagesRef.current.length), { dir: 'prev' }), [goToPage]);

  // Scroll-spy + lazy render window (continuous mode)
  useEffect(() => {
    if (!pdf || viewMode !== 'scroll' || pages.length === 0) return;
    const stage = stageRef.current;
    if (!stage) return;
    const ratios = new Map<number, number>();
    const spy = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const idx = Number((e.target as HTMLElement).dataset.pageIndex);
          if (Number.isFinite(idx)) ratios.set(idx, e.isIntersecting ? e.intersectionRatio : 0);
        }
        if (Date.now() - programmaticScrollRef.current < 700) return;
        let best = -1;
        let bestRatio = 0;
        ratios.forEach((r, i) => {
          if (r > bestRatio) { bestRatio = r; best = i; }
        });
        if (best >= 0 && best !== pageIndexRef.current) setPageIndex(best);
      },
      { root: stage, threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    const near = new IntersectionObserver(
      (entries) => {
        setNearSet((prev) => {
          const next = new Set(prev);
          for (const e of entries) {
            const idx = Number((e.target as HTMLElement).dataset.pageIndex);
            if (!Number.isFinite(idx)) continue;
            if (e.isIntersecting) next.add(idx);
            else next.delete(idx);
          }
          return next;
        });
      },
      { root: stage, rootMargin: '900px 0px' }
    );
    pageElsRef.current.forEach((el) => { spy.observe(el); near.observe(el); });
    return () => { spy.disconnect(); near.disconnect(); };
  }, [pdf, viewMode, pages]);

  const activeSet = useMemo(() => {
    if (viewMode === 'page') return new Set([pageIndex]);
    const win = renderWindow(pageIndex, pages.length, 2);
    nearSet.forEach((i) => win.add(i));
    return win;
  }, [viewMode, pageIndex, pages.length, nearSet]);

  // ── Edit-text runs (original text lines, lazily extracted) ──
  const ensureRuns = useCallback(async (entry: PdfPageEntry) => {
    const doc = pdfRef.current;
    if (!doc || entry.kind !== 'original') return;
    if (runsKeyRef.current.get(entry.id) === entry.rotation) return;
    runsKeyRef.current.set(entry.id, entry.rotation);
    setRunsStatus((prev) => ({ ...prev, [entry.id]: 'loading' }));
    try {
      const pg = await doc.getPage(entry.srcIndex + 1);
      const rotation = ((entry.rotation % 360) + 360) % 360;
      const vp = pg.getViewport({ scale: 1, rotation });
      const tc = await pg.getTextContent();
      const dims = displayDims(entry);
      const runs = buildTextRuns(
        tc.items as unknown as RawTextItem[],
        tc.styles as Record<string, { fontFamily?: string; vertical?: boolean }>,
        vp.transform,
        dims.w,
        dims.h
      );
      setTextRuns((prev) => ({ ...prev, [entry.id]: runs }));
    } catch {
      setTextRuns((prev) => ({ ...prev, [entry.id]: [] }));
    } finally {
      setRunsStatus((prev) => ({ ...prev, [entry.id]: 'done' }));
    }
  }, []);

  useEffect(() => {
    if (tool !== 'edittext' || !pdf) return;
    activeSet.forEach((idx) => {
      const entry = pages[idx];
      if (entry) void ensureRuns(entry);
    });
  }, [tool, pdf, pages, activeSet, ensureRuns]);

  const editBoxesByPage = useMemo(() => {
    if (tool !== 'edittext') return null;
    const map = new Map<string, Array<{ x: number; y: number; w: number; h: number }>>();
    for (const [pageId, runs] of Object.entries(textRuns)) map.set(pageId, runs.map((r) => r.rect));
    return map;
  }, [tool, textRuns]);

  // ── Loading ──
  const openFile = useCallback(async (file: File, password?: string) => {
    if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      toast.error('Please choose a PDF file');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setLoadError('too-large');
      setLoadState('error');
      return;
    }
    pendingFileRef.current = file;
    const token = ++loadTokenRef.current;
    setLoadState('loading');
    setPasswordWrong(false);
    try {
      const bytes = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)), password }).promise;
      if (token !== loadTokenRef.current) { doc.destroy?.(); return; }

      const key = `${file.name}:${file.size}:${doc.numPages}`;
      const first = await doc.getPage(1);
      const firstVp = first.getViewport({ scale: 1, rotation: 0 });
      const firstRotation = ((first.rotate % 360) + 360) % 360;
      const entries: PdfPageEntry[] = Array.from({ length: doc.numPages }, (_, i) => ({
        id: `src-${i}`,
        kind: 'original',
        srcIndex: i,
        rotation: i === 0 ? firstRotation : 0,
        width: firstVp.width,
        height: firstVp.height,
      }));

      // Restore a previous session for the exact same file, if one exists.
      let restored: SavedSession | null = readSession(key);
      if (restored && restored.pages.some((p) => p.kind === 'original' && p.srcIndex >= doc.numPages)) {
        restored = null;
      }

      // Commit point: the old session is replaced only after a successful parse.
      const oldDoc = pdfRef.current;
      if (oldDoc && oldDoc !== doc) oldDoc.destroy?.();
      textCacheRef.current.clear();
      clearThumbnailCache();
      pageElsRef.current.clear();
      setFileName(file.name);
      setSourceBytes(bytes);
      setPdf(doc);
      setDocKey(key);
      setPages(restored ? restored.pages : entries);
      setAnnotations(restored ? restored.annotations : []);
      setPast([]);
      setFuture([]);
      setPageIndex(0);
      setZoom(1);
      setTool('select');
      setSelectedId(null);
      setTextDraft(null);
      setEditDraft(null);
      setTextRuns({});
      setRunsStatus({});
      runsKeyRef.current.clear();
      setDraftAnn(null);
      setSearchHits([]);
      setSearched(false);
      setLastExport(null);
      setExportedSeq(0);
      setEditSeq(0);
      setLoadState('idle');
      stageRef.current?.scrollTo({ top: 0 });
      toast.success(
        restored
          ? `Opened ${file.name} — your earlier edits were restored`
          : `Opened ${file.name} · ${doc.numPages} page${doc.numPages > 1 ? 's' : ''}`
      );

      // Correct per-page sizes/rotations in the background (mixed-size PDFs).
      if (!restored && doc.numPages > 1) {
        (async () => {
          for (let startIdx = 1; startIdx < doc.numPages; startIdx += 8) {
            if (token !== loadTokenRef.current) return;
            const batch = await Promise.all(
              Array.from({ length: Math.min(8, doc.numPages - startIdx) }, async (_, k) => {
                const i = startIdx + k;
                try {
                  const pg = await doc.getPage(i + 1);
                  const vp = pg.getViewport({ scale: 1, rotation: 0 });
                  return { i, rotation: ((pg.rotate % 360) + 360) % 360, width: vp.width, height: vp.height };
                } catch {
                  return null;
                }
              })
            );
            if (token !== loadTokenRef.current) return;
            setPages((prev) => {
              let changed = false;
              const next = prev.map((entry) => {
                if (entry.kind !== 'original') return entry;
                const fix = batch.find((b) => b && b.i === entry.srcIndex);
                if (!fix) return entry;
                if (
                  Math.abs(fix.width - entry.width) < 0.6 &&
                  Math.abs(fix.height - entry.height) < 0.6 &&
                  fix.rotation === entry.rotation
                ) return entry;
                changed = true;
                return { ...entry, width: fix.width, height: fix.height, rotation: fix.rotation };
              });
              return changed ? next : prev;
            });
          }
        })();
      }
    } catch (err: unknown) {
      if (token !== loadTokenRef.current) return;
      const kind = classifyLoadError(err);
      if (kind === 'password') {
        setPasswordWrong(Boolean(password));
        setLoadState('password');
      } else {
        console.error(err);
        setLoadError(kind);
        setLoadState('error');
      }
    }
  }, []);

  const requestOpen = useCallback((file: File) => {
    if (pdfRef.current && annotationsRef.current.length > 0 && editSeq > exportedSeq) {
      setPendingReplace(file);
      return;
    }
    void openFile(file);
  }, [openFile, editSeq, exportedSeq]);

  const openSample = useCallback(async () => {
    try {
      const res = await fetch('/sample.pdf');
      if (!res.ok) throw new Error('sample missing');
      const blob = await res.blob();
      await openFile(new File([blob], 'niknote-sample.pdf', { type: 'application/pdf' }));
    } catch {
      toast.error('Sample PDF unavailable — open any PDF from your device');
    }
  }, [openFile]);

  // Destroy pdf.js document on unmount
  useEffect(() => () => { pdfRef.current?.destroy?.(); }, []);

  // Dropping a PDF anywhere must feed the editor, never navigate away from it.
  useEffect(() => {
    const onDragOverDoc = (e: DragEvent) => e.preventDefault();
    const onDropDoc = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (pdfRef.current) requestOpen(file);
      else void openFile(file);
    };
    window.addEventListener('dragover', onDragOverDoc);
    window.addEventListener('drop', onDropDoc);
    return () => {
      window.removeEventListener('dragover', onDragOverDoc);
      window.removeEventListener('drop', onDropDoc);
    };
  }, [openFile, requestOpen]);

  // Session autosave (annotations + page order, keyed to the exact file)
  useEffect(() => {
    if (!pdf || !docKey) return;
    const t = window.setTimeout(() => {
      try {
        const payload = JSON.stringify({ docKey, pages, annotations });
        if (payload.length < 1_500_000) localStorage.setItem(SESSION_KEY, payload);
      } catch { /* storage full — session stays in memory */ }
    }, 600);
    return () => window.clearTimeout(t);
  }, [pdf, docKey, pages, annotations]);

  // Preload embedded images so overlay paints stay synchronous
  useEffect(() => {
    const missing = annotations.filter(
      (a): a is Extract<Annotation, { type: 'image' }> => a.type === 'image' && !isImageReady(a.dataUrl)
    );
    if (missing.length === 0) return;
    let alive = true;
    Promise.all(missing.map((a) => loadImage(a.dataUrl).catch(() => null))).then(() => {
      if (alive) setImageTick((t) => t + 1);
    });
    return () => { alive = false; };
  }, [annotations]);

  // ── Annotation helpers ──
  const stampFor = (t: PdfTool): 'check' | 'cross' | 'star' | null =>
    t === 'check' ? 'check' : t === 'cross' ? 'cross' : t === 'star' ? 'star' : null;

  const effectiveColor = tool === 'highlighter' ? hlColor : inkColor;

  const placeSignature = useCallback((dataUrl: string, pageId: string, at: Point) => {
    const entry = pagesRef.current.find((p) => p.id === pageId);
    if (!entry) return;
    const dims = displayDims(entry);
    const w = 0.3;
    const ann: Annotation = {
      id: createId(), type: 'image', page: pageId,
      at: { x: Math.min(1 - w, Math.max(0, at.x - w / 2)), y: Math.min(0.95, Math.max(0, at.y - 0.03)) },
      w, h: Math.min(0.9, (w * dims.w * 0.32) / Math.max(1, dims.h)), dataUrl, label: 'signature',
    };
    commitAnnotations([...annotationsRef.current, ann]);
    setSelectedId(ann.id);
    setTool('select');
  }, [commitAnnotations]);

  const eraseAt = useCallback((pageId: string, p: Point) => {
    const doomed = annotationsRef.current.filter((a) => a.page === pageId && hitTest(a, p, 0.01));
    if (doomed.length === 0) return;
    if (!eraseSnapshotRef.current) eraseSnapshotRef.current = annotationsRef.current;
    const ids = new Set(doomed.map((a) => a.id));
    setAnnotations((prev) => prev.filter((a) => !ids.has(a.id)));
    bumpEdit();
  }, [bumpEdit]);

  const flushDraft = useCallback(() => {
    if (draftRafRef.current) return;
    draftRafRef.current = requestAnimationFrame(() => {
      draftRafRef.current = 0;
      setDraftAnn(draftRef.current ? ({ ...draftRef.current } as Annotation) : null);
    });
  }, []);

  const commitTextDraft = useCallback(() => {
    if (!textDraft) return;
    const value = textDraft.value.trim();
    const { pageId, at } = textDraft;
    setTextDraft(null);
    if (!value) return;
    const ann: Annotation = {
      id: createId(), type: 'text', page: pageId, at,
      text: value, color: inkColor, size: textSize, font, bold,
    };
    commitAnnotations([...annotationsRef.current, ann]);
    setSelectedId(ann.id);
    setTool('select');
  }, [textDraft, inkColor, textSize, font, bold, commitAnnotations]);

  const commitEditDraft = useCallback(() => {
    if (!editDraft) return;
    const { pageId, run, value } = editDraft;
    setEditDraft(null);
    const ann: TextEditAnnotation = {
      id: createId(), type: 'textedit', page: pageId,
      rect: { ...run.rect, h: Math.max(run.rect.h, run.rect.h + (value.split('\n').length - 1) * run.sizeNorm * 1.25) },
      baseline: run.baseline,
      text: value.replace(/\s+$/, ''),
      color: inkColor, size: run.sizeNorm, font: run.font, bold, bg: '#ffffff',
    };
    commitAnnotations([...annotationsRef.current, ann]);
    toast.success(value.trim() ? 'Text replaced in the same style — Save PDF to bake it in' : 'Text covered (white-out)');
  }, [editDraft, inkColor, bold, commitAnnotations]);

  // ── Pointer orchestration ──
  const handlePagePointer = useCallback((kind: PointerKind, pageId: string, point: Point, meta: PagePointerMeta) => {
    const entry = pagesRef.current.find((p) => p.id === pageId);
    if (!entry) return;
    const pageAnns = annotationsRef.current.filter((a) => a.page === pageId);

    if (kind === 'down') {
      if (tool === 'select') {
        const hit = [...pageAnns].reverse().find((a) => hitTest(a, point));
        setSelectedId(hit?.id || null);
        if (hit) {
          movingRef.current = { id: hit.id, last: point, snapshot: annotationsRef.current, moved: false };
        }
        if (meta.pointerType === 'touch') {
          // Double-tap → toggle zoom (only on empty document area)
          const last = lastTapRef.current;
          if (!hit && last && meta.timeStamp - last.t < 320 && Math.hypot(meta.clientX - last.x, meta.clientY - last.y) < 28) {
            lastTapRef.current = null;
            setZoom((z) => (z > 1.05 ? 1 : 1.8));
            return;
          }
          lastTapRef.current = { x: meta.clientX, y: meta.clientY, t: meta.timeStamp };
          if (viewMode === 'page') {
            swipeRef.current = { x: meta.clientX, y: meta.clientY, t: meta.timeStamp, pointerId: meta.pointerId };
            if (!hit) panRef.current = { x: meta.clientX, y: meta.clientY, pointerId: meta.pointerId };
          }
        }
        return;
      }

      if (tool === 'edittext') {
        const runs = textRunsRef.current[pageId];
        if (!runs) {
          void ensureRuns(entry);
          toast.info('Reading page text…');
          return;
        }
        const idx = runAtPoint(runs, point);
        if (idx >= 0) {
          const run = runs[idx];
          setEditDraft({ pageId, run, value: run.text });
          setBold(run.bold);
          setSelectedId(null);
        } else if (runs.length === 0) {
          toast.info('No editable text layer on this page — scanned PDFs need OCR first (PDF Tools)');
        } else {
          toast.info('Tap a highlighted line to edit it');
        }
        return;
      }

      if (tool === 'eraser') {
        drawingRef.current = true;
        eraseSnapshotRef.current = null;
        eraseAt(pageId, point);
        return;
      }
      if (tool === 'text') {
        setTextDraft({ pageId, at: point, value: '' });
        return;
      }
      if (tool === 'signature') {
        const sig = activeSignature || signatures[0];
        if (!sig) {
          setSignatureOpen(true);
          toast.info('Draw your signature once — then tap the page to place it');
        } else {
          placeSignature(sig, pageId, point);
        }
        return;
      }
      if (tool === 'image') {
        pendingImageRef.current = { pageId, at: point };
        imageInputRef.current?.click();
        return;
      }
      const stamp = stampFor(tool);
      if (stamp) {
        commitAnnotations([...annotationsRef.current, {
          id: createId(), type: 'stamp', page: pageId, stamp, at: point,
          size: Math.max(0.02, strokeWidth * 12), color: effectiveColor,
        }]);
        return;
      }

      drawingRef.current = true;
      if (tool === 'pen' || tool === 'highlighter') {
        draftRef.current = {
          id: createId(), type: 'ink', page: pageId, points: [point],
          color: effectiveColor,
          width: tool === 'highlighter' ? strokeWidth * 2.2 : strokeWidth,
          opacity: tool === 'highlighter' ? 0.45 : opacity,
          highlighter: tool === 'highlighter',
        };
      } else if (['rect', 'ellipse', 'line', 'arrow'].includes(tool)) {
        draftRef.current = {
          id: createId(), type: 'shape', page: pageId,
          shape: tool as 'rect' | 'ellipse' | 'line' | 'arrow',
          from: point, to: point, color: effectiveColor, width: strokeWidth * 1.6, opacity,
        };
      }
      flushDraft();
      return;
    }

    if (kind === 'move') {
      if (movingRef.current) {
        const m = movingRef.current;
        const dx = point.x - m.last.x;
        const dy = point.y - m.last.y;
        if (dx !== 0 || dy !== 0) {
          m.moved = true;
          m.last = point;
          setAnnotations((prev) => prev.map((a) => (a.id === m.id ? translateAnnotation(a, dx, dy) : a)));
        }
        return;
      }
      if (panRef.current && panRef.current.pointerId === meta.pointerId && stageRef.current) {
        stageRef.current.scrollBy(panRef.current.x - meta.clientX, panRef.current.y - meta.clientY);
        panRef.current = { x: meta.clientX, y: meta.clientY, pointerId: meta.pointerId };
        return;
      }
      if (tool === 'eraser' && drawingRef.current) {
        eraseAt(pageId, point);
        return;
      }
      if (!drawingRef.current || !draftRef.current) return;
      const draft = draftRef.current;
      if (draft.type === 'ink') {
        const lastPt = draft.points[draft.points.length - 1];
        if (!lastPt || Math.hypot(point.x - lastPt.x, point.y - lastPt.y) > 0.0009) {
          draft.points = [...draft.points, point];
        }
      }
      if (draft.type === 'shape') draft.to = point;
      flushDraft();
      return;
    }

    if (kind === 'cancel') {
      movingRef.current = null;
      panRef.current = null;
      swipeRef.current = null;
      if (drawingRef.current && tool !== 'eraser') {
        drawingRef.current = false;
        draftRef.current = null;
        setDraftAnn(null);
      }
      if (tool === 'eraser') drawingRef.current = false;
      return;
    }

    // up
    if (movingRef.current) {
      const m = movingRef.current;
      movingRef.current = null;
      if (m.moved) {
        setPast((p) => [...p.slice(-49), m.snapshot]);
        setFuture([]);
        bumpEdit();
      }
    }
    if (tool === 'eraser') {
      drawingRef.current = false;
      if (eraseSnapshotRef.current) {
        setPast((p) => [...p.slice(-49), eraseSnapshotRef.current as Annotation[]]);
        setFuture([]);
        eraseSnapshotRef.current = null;
      }
      return;
    }
    if (tool === 'select') {
      const swipe = swipeRef.current;
      swipeRef.current = null;
      panRef.current = null;
      if (swipe && swipe.pointerId === meta.pointerId && viewMode === 'page') {
        const dir = classifyHorizontalSwipe({
          dx: meta.clientX - swipe.x,
          dy: meta.clientY - swipe.y,
          dtMs: meta.timeStamp - swipe.t,
        });
        if (dir === 'next') goNext();
        else if (dir === 'prev') goPrev();
      }
      return;
    }
    if (!drawingRef.current || !draftRef.current) return;
    drawingRef.current = false;
    const draft = draftRef.current;
    draftRef.current = null;
    setDraftAnn(null);
    const isTiny =
      draft.type === 'ink'
        ? draft.points.length < 2
        : draft.type === 'shape' && Math.abs(draft.to.x - draft.from.x) + Math.abs(draft.to.y - draft.from.y) < 0.008;
    if (!isTiny) commitAnnotations([...annotationsRef.current, draft]);
  }, [tool, viewMode, activeSignature, signatures, effectiveColor, strokeWidth, opacity, commitAnnotations, eraseAt, flushDraft, placeSignature, goNext, goPrev, bumpEdit, ensureRuns]);

  // ── Pinch + ctrl-wheel zoom (preview transform → sharp re-render on commit) ──
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !pdf) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = {
          startDist: pointerDistance(
            { x: e.touches[0].clientX, y: e.touches[0].clientY },
            { x: e.touches[1].clientX, y: e.touches[1].clientY }
          ),
          startZoom: zoom,
        };
        // A pinch aborts any in-progress stroke — two fingers never draw.
        drawingRef.current = false;
        draftRef.current = null;
        setDraftAnn(null);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const dist = pointerDistance(
          { x: e.touches[0].clientX, y: e.touches[0].clientY },
          { x: e.touches[1].clientX, y: e.touches[1].clientY }
        );
        const target = pinchZoom(pinchRef.current.startZoom, pinchRef.current.startDist, dist);
        const rect = stage.getBoundingClientRect();
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left + stage.scrollLeft;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top + stage.scrollTop;
        setPreview({ factor: target / zoom, ox: cx, oy: cy });
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (pinchRef.current && e.touches.length < 2) {
        const start = pinchRef.current;
        pinchRef.current = null;
        setPreview((prev) => {
          if (prev) setZoom(clampZoom(start.startZoom * prev.factor));
          return null;
        });
      }
    };
    let wheelTimer = 0;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0016);
      const rect = stage.getBoundingClientRect();
      setPreview((prev) => ({
        factor: clampZoom(zoom * (prev?.factor || 1) * factor) / zoom,
        ox: e.clientX - rect.left + stage.scrollLeft,
        oy: e.clientY - rect.top + stage.scrollTop,
      }));
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        setPreview((prev) => {
          if (prev) setZoom(clampZoom(zoom * prev.factor));
          return null;
        });
      }, 140);
    };

    stage.addEventListener('touchstart', onTouchStart, { passive: true });
    stage.addEventListener('touchmove', onTouchMove, { passive: false });
    stage.addEventListener('touchend', onTouchEnd);
    stage.addEventListener('touchcancel', onTouchEnd);
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      stage.removeEventListener('touchstart', onTouchStart);
      stage.removeEventListener('touchmove', onTouchMove);
      stage.removeEventListener('touchend', onTouchEnd);
      stage.removeEventListener('touchcancel', onTouchEnd);
      stage.removeEventListener('wheel', onWheel);
      window.clearTimeout(wheelTimer);
    };
  }, [pdf, zoom]);

  // ── Page operations (index-based, functional updates only) ──
  const rotateAt = useCallback((index: number) => {
    const id = pagesRef.current[index]?.id;
    setPages((prev) => prev.map((p, i) => (i === index ? { ...p, rotation: (p.rotation + 90) % 360 } : p)));
    if (id) {
      runsKeyRef.current.delete(id);
      setTextRuns((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    bumpEdit();
  }, [bumpEdit]);

  const insertBlankAfter = useCallback((index: number, size: 'same' | 'a4' | 'letter') => {
    const list = pagesRef.current;
    const anchor = list[clampPageIndex(index, list.length)];
    if (!anchor) return;
    const dims = size === 'same' ? { width: anchor.width, height: anchor.height } : PAGE_SIZES[size];
    const blank: PdfPageEntry = {
      id: `blank-${createId()}`, kind: 'blank', srcIndex: -1,
      rotation: 0, width: dims.width, height: dims.height,
    };
    setPages((prev) => [...prev.slice(0, index + 1), blank, ...prev.slice(index + 1)]);
    bumpEdit();
    requestAnimationFrame(() => goToPage(index + 1));
  }, [bumpEdit, goToPage]);

  const duplicateAt = useCallback((index: number) => {
    const src = pagesRef.current[index];
    if (!src) return;
    const copy: PdfPageEntry = { ...src, id: `dup-${createId()}` };
    const copyAnns = annotationsRef.current
      .filter((a) => a.page === src.id)
      .map((a) => ({ ...a, id: createId(), page: copy.id }));
    setPages((prev) => [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)]);
    if (copyAnns.length) setAnnotations((prev) => [...prev, ...copyAnns]);
    bumpEdit();
    requestAnimationFrame(() => goToPage(index + 1));
  }, [bumpEdit, goToPage]);

  const moveAt = useCallback((index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= pagesRef.current.length) return;
    setPages((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    bumpEdit();
    requestAnimationFrame(() => goToPage(target));
  }, [bumpEdit, goToPage]);

  const deleteAt = useCallback((index: number) => {
    const list = pagesRef.current;
    const victim = list[index];
    if (!victim) return;
    if (list.length === 1) {
      toast.error('A PDF needs at least one page');
      return;
    }
    const snapshot = {
      pages: list,
      annotations: annotationsRef.current,
      pageIndex: pageIndexRef.current,
    };
    setPages((prev) => prev.filter((_, i) => i !== index));
    setAnnotations((prev) => prev.filter((a) => a.page !== victim.id));
    setPageIndex(pageAfterDelete(snapshot.pageIndex, index, list.length));
    setSelectedId(null);
    bumpEdit();
    toast.success(`Page ${index + 1} deleted`, {
      action: {
        label: 'Undo',
        onClick: () => {
          setPages(snapshot.pages);
          setAnnotations(snapshot.annotations);
          setPageIndex(snapshot.pageIndex);
          bumpEdit();
        },
      },
    });
  }, [bumpEdit]);

  // ── Image placement ──
  const onImagePicked = async (file: File | null) => {
    const pending = pendingImageRef.current;
    pendingImageRef.current = null;
    if (!file || !pending) return;
    const entry = pagesRef.current.find((p) => p.id === pending.pageId);
    if (!entry) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }).catch(() => '');
    if (!dataUrl) { toast.error('Could not read that image'); return; }
    const img = await loadImage(dataUrl).catch(() => null);
    if (!img) { toast.error('Could not read that image'); return; }
    const dims = displayDims(entry);
    const w = 0.45;
    const h = Math.min(0.9, ((w * dims.w) / dims.h) * (img.height / Math.max(1, img.width)));
    const ann: Annotation = {
      id: createId(), type: 'image', page: entry.id,
      at: {
        x: Math.min(1 - w, Math.max(0, pending.at.x - w / 2)),
        y: Math.min(1 - h, Math.max(0, pending.at.y - h / 2)),
      },
      w, h, dataUrl,
    };
    commitAnnotations([...annotationsRef.current, ann]);
    setSelectedId(ann.id);
    setTool('select');
  };

  // ── Export / share ──
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
      setLastExport({ bytes, name: outName, at: new Date() });
      setExportedSeq(editSeq);
      const result = await saveFile(bytes, outName, 'application/pdf');
      if (result === 'shared') toast.success('PDF ready — choose where to save it');
      else if (result === 'downloaded') {
        toast.success(isNativeApp() ? `Saved to Documents › ${outName}` : `Downloaded ${outName} (${pages.length} pages)`);
      } else toast.info('Save cancelled — tap Save PDF again');
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as { message?: string } | null)?.message || 'Could not export this PDF', {
        action: { label: 'Retry', onClick: () => { void exportPdf(); } },
      });
    } finally {
      setBusy(false);
      setExportProgress(null);
    }
  };

  const sharePdf = async () => {
    if (!lastExport || dirty) {
      toast.info(dirty && lastExport ? 'Save again first — you have newer edits' : 'Pehle Save PDF dabao — phir share kar sakte ho');
      return;
    }
    if (isNativeApp() || 'share' in navigator) {
      try {
        await saveFile(lastExport.bytes, lastExport.name, 'application/pdf');
        return;
      } catch { /* fall through */ }
    }
    if (!openFileInNewTab(lastExport.bytes)) toast.error('Sharing is not available in this browser');
  };

  // ── Text search (page-level find on the PDF text layer) ──
  const runSearch = useCallback(async () => {
    const q = searchQuery.trim().toLowerCase();
    const doc = pdfRef.current;
    if (!q || !doc) return;
    setSearchBusy(true);
    setSearched(true);
    try {
      const hits: number[] = [];
      const list = pagesRef.current;
      for (let i = 0; i < list.length; i++) {
        const entry = list[i];
        if (entry.kind !== 'original') continue;
        let text = textCacheRef.current.get(entry.srcIndex);
        if (text === undefined) {
          try {
            const pg = await doc.getPage(entry.srcIndex + 1);
            const tc = await pg.getTextContent();
            text = tc.items.map((item) => ('str' in item ? item.str : '')).join(' ').toLowerCase();
          } catch {
            text = '';
          }
          textCacheRef.current.set(entry.srcIndex, text);
        }
        if (text.includes(q)) hits.push(i);
      }
      setSearchHits(hits);
      setSearchCursor(0);
      if (hits.length > 0) goToPage(hits[0]);
    } finally {
      setSearchBusy(false);
    }
  }, [searchQuery, goToPage]);

  const stepSearch = (dir: 1 | -1) => {
    if (searchHits.length === 0) return;
    const next = (searchCursor + dir + searchHits.length) % searchHits.length;
    setSearchCursor(next);
    goToPage(searchHits[next]);
  };

  // ── Tool selection ──
  const selectTool = (next: PdfTool) => {
    setTool(next);
    if (SHAPE_TOOLS.includes(next)) setLastShape(next);
    if (next !== 'select') setSelectedId(null);
    if (next !== 'text') setTextDraft(null);
    if (next !== 'edittext') setEditDraft(null);
  };

  const onFanSelect = (choice: FanChoice) => {
    if (choice === 'shapes') selectTool(lastShape);
    else selectTool(choice);
    if (choice === 'signature' && signatures.length === 0) setSignatureOpen(true);
  };

  // ── Keyboard ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (mod && key === 'y') { e.preventDefault(); redo(); }
      else if (mod && key === 's') { e.preventDefault(); void exportPdf(); }
      else if (mod && key === 'f') { e.preventDefault(); setSearchOpen(true); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        commitAnnotations(annotationsRef.current.filter((a) => a.id !== selectedId));
        setSelectedId(null);
      }
      else if (e.key === 'Escape') {
        setSelectedId(null);
        setTextDraft(null);
        setEditDraft(null);
        setMenuOpen(false);
        setZoomMenu(null);
        setGoToOpen(false);
        if (tool !== 'select') setTool('select');
      }
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goPrev(); }
      else if (e.key === 'Home') { e.preventDefault(); goToPage(0); }
      else if (e.key === 'End') { e.preventDefault(); goToPage(pagesRef.current.length - 1); }
      else if (!mod && (e.key === '+' || e.key === '=')) setZoom((z) => clampZoom(z * 1.2));
      else if (!mod && e.key === '-') setZoom((z) => clampZoom(z / 1.2));
      else if (!mod && e.key === '0') setZoom(1);
      else if (!mod && key === 'v') selectTool('select');
      else if (!mod && key === 'p') selectTool('pen');
      else if (!mod && key === 'h') selectTool('highlighter');
      else if (!mod && key === 'e') selectTool('edittext');
      else if (!mod && key === 'x') selectTool('eraser');
      else if (!mod && key === 't') selectTool('text');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, goNext, goPrev, goToPage, selectedId, tool, commitAnnotations, sourceBytes, pages, annotations, fileName, editSeq]);

  // ── Derived view data ──
  const currentPlan = page
    ? planPageRender({
        pageW: displayDims(page).w,
        pageH: displayDims(page).h,
        containerW,
        zoom,
        devicePixelRatio: dpr,
      })
    : null;
  const zoomPercent = currentPlan && page ? displayZoomPercent(currentPlan, displayDims(page).w) : 100;
  const visibleIndexes = viewMode === 'page' ? (page ? [pageIndex] : []) : pages.map((_, i) => i);

  const applyZoomPreset = (preset: 'fit-width' | 'fit-page' | 'actual' | number) => {
    setZoomMenu(null);
    if (!page) return;
    const dims = displayDims(page);
    if (preset === 'fit-width') setZoom(1);
    else if (preset === 'fit-page') {
      setZoom(zoomForFitPage({ pageW: dims.w, pageH: dims.h, containerW, containerH: Math.max(200, stageSize.h - 32) }));
      if (viewMode !== 'page') setViewMode('page');
    } else if (preset === 'actual') setZoom(zoomForActualSize({ pageW: dims.w, containerW }));
    else setZoom(clampZoom(preset));
  };

  const statusLine = busy && exportProgress
    ? `Saving page ${exportProgress.done}/${exportProgress.total}…`
    : lastExport && !dirty
      ? `Saved ${lastExport.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · on this device`
      : dirty
        ? 'Unsaved edits · export to keep them'
        : 'On this device · nothing is uploaded';

  // ── Empty / loading / error states ──
  if (!pdf) {
    return (
      <div
        className="pdfs-root flex min-h-dvh flex-col"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void openFile(f);
        }}
      >
        <header className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: '1px solid var(--pdfs-border)', background: 'var(--pdfs-surface)' }}>
          <Link to="/hub" aria-label="Back to documents" className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-hover">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold">PDF Editor</p>
            <p className="text-[11px]" style={{ color: 'var(--pdfs-text-2)' }}>Read, annotate & sign — on your device</p>
          </div>
          <Link to="/pdf-tools" className="ml-auto flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold" style={{ borderColor: 'var(--pdfs-border)' }}>
            <Combine className="h-4 w-4" /> PDF Tools
          </Link>
        </header>

        <main className="pdfs-workspace grid flex-1 place-items-center px-4 py-10">
          <div
            className="pdfs-bar w-full max-w-md rounded-3xl p-6 text-center"
            style={dragOver ? { outline: '2px dashed var(--pdfs-accent)', outlineOffset: -8 } : undefined}
          >
            {loadState === 'error' ? (
              <>
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl" style={{ background: 'var(--pdfs-danger-soft)', color: 'var(--pdfs-danger)' }}>
                  <TriangleAlert className="h-7 w-7" />
                </div>
                <h1 className="text-lg font-bold">Could not open that PDF</h1>
                <p className="mt-2 text-sm" style={{ color: 'var(--pdfs-text-2)' }}>{loadErrorMessage(loadError)}</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button onClick={() => fileInputRef.current?.click()} className="min-h-11 rounded-full px-5 font-semibold">
                    Choose another PDF
                  </Button>
                  <Button variant="outline" onClick={() => setLoadState('idle')} className="min-h-11 rounded-full px-5 font-semibold">
                    Back
                  </Button>
                </div>
              </>
            ) : loadState === 'password' ? (
              <PasswordPrompt
                fileName={pendingFileRef.current?.name || 'PDF'}
                wrong={passwordWrong}
                busy={false}
                onCancel={() => setLoadState('idle')}
                onSubmit={(pw) => pendingFileRef.current && void openFile(pendingFileRef.current, pw)}
              />
            ) : (
              <>
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl" style={{ background: 'var(--pdfs-accent-soft)', color: 'var(--pdfs-accent)' }}>
                  <FileText className="h-7 w-7" />
                </div>
                <h1 className="text-lg font-bold">Open a PDF to begin</h1>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--pdfs-text-2)' }}>
                  It opens in clean reading mode first. Pen, highlighter, text, shapes and signatures
                  stay one tap away — nothing draws until you choose a tool.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button onClick={() => fileInputRef.current?.click()} disabled={loadState === 'loading'} className="min-h-11 rounded-full px-6 font-semibold">
                    {loadState === 'loading' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    {loadState === 'loading' ? 'Opening…' : 'Open a PDF'}
                  </Button>
                  <Button variant="outline" onClick={() => void openSample()} disabled={loadState === 'loading'} className="min-h-11 rounded-full px-5 font-semibold">
                    Try the sample
                  </Button>
                </div>
                <p className="mt-3 text-[11px]" style={{ color: 'var(--pdfs-text-2)' }}>
                  or drag & drop a PDF anywhere here · up to 80 MB · never uploaded
                </p>
                <div className="mt-5 grid grid-cols-3 gap-2 text-[11px] font-medium" style={{ color: 'var(--pdfs-text-2)' }}>
                  {['Sharp retina rendering', 'Pen & highlighter', 'Signatures', 'Text & shapes', 'Reorder pages', 'Clean export'].map((f) => (
                    <div key={f} className="rounded-xl px-2 py-2" style={{ background: 'var(--pdfs-accent-soft)' }}>{f}</div>
                  ))}
                </div>
              </>
            )}
          </div>
        </main>

        <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" aria-hidden tabIndex={-1}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void openFile(f); }} />
      </div>
    );
  }

  // ── Editor ──
  return (
    <div className="pdfs-root flex h-dvh flex-col overflow-hidden">
      {/* Header */}
      <header className="z-40 shrink-0" style={{ borderBottom: '1px solid var(--pdfs-border)', background: 'var(--pdfs-surface)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-1 px-2 py-1.5 sm:px-3">
          <Link to="/hub" aria-label="Back to documents" className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-surface-hover">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <button type="button" onClick={() => setPanelOpen((v) => !v)} aria-label="Toggle pages panel" aria-pressed={panelOpen}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-surface-hover"
            style={panelOpen ? { color: 'var(--pdfs-accent)' } : undefined}>
            <PanelLeft className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1 px-1">
            <p className="truncate text-[13.5px] font-bold leading-tight" title={fileName}>{fileName || 'Document'}</p>
            <p className="truncate text-[10.5px] leading-tight" style={{ color: dirty ? '#b45309' : 'var(--pdfs-text-2)' }}>{statusLine}</p>
          </div>

          <button type="button" onClick={undo} disabled={past.length === 0} aria-label="Undo" title="Undo (Ctrl+Z)"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-surface-hover disabled:opacity-35">
            <Undo2 className="h-[18px] w-[18px]" />
          </button>
          <button type="button" onClick={redo} disabled={future.length === 0} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-surface-hover disabled:opacity-35">
            <Redo2 className="h-[18px] w-[18px]" />
          </button>
          <button type="button" onClick={() => setSearchOpen((v) => !v)} aria-label="Search in document" aria-pressed={searchOpen}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-surface-hover"
            style={searchOpen ? { color: 'var(--pdfs-accent)' } : undefined}>
            <Search className="h-[18px] w-[18px]" />
          </button>

          {/* Zoom cluster */}
          <div className="relative hidden shrink-0 items-center rounded-full border sm:flex" style={{ borderColor: 'var(--pdfs-border)' }}>
            <button type="button" onClick={() => setZoom((z) => clampZoom(z / 1.25))} aria-label="Zoom out" className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-hover">
              <ZoomOut className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setZoomMenu((v) => (v === 'cluster' ? null : 'cluster'))} aria-haspopup="menu" aria-expanded={zoomMenu === 'cluster'}
              className="min-h-9 w-[52px] text-center text-[12px] font-bold" aria-label={`Zoom ${zoomPercent} percent — open zoom menu`}>
              {zoomPercent}%
            </button>
            <button type="button" onClick={() => setZoom((z) => clampZoom(z * 1.25))} aria-label="Zoom in" className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-hover">
              <ZoomIn className="h-4 w-4" />
            </button>
            {zoomMenu === 'cluster' && (
              <ZoomMenu onClose={() => setZoomMenu(null)} onPreset={applyZoomPreset} />
            )}
          </div>

          {/* View mode */}
          <div className="hidden shrink-0 items-center rounded-full border p-0.5 md:flex" style={{ borderColor: 'var(--pdfs-border)' }} role="group" aria-label="View mode">
            <button type="button" onClick={() => setViewMode('scroll')} aria-pressed={viewMode === 'scroll'} title="Continuous scroll"
              className="grid h-8 w-9 place-items-center rounded-full"
              style={viewMode === 'scroll' ? { background: 'var(--pdfs-accent-soft)', color: 'var(--pdfs-accent)' } : undefined}>
              <GalleryVertical className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setViewMode('page')} aria-pressed={viewMode === 'page'} title="Single page (swipe to turn)"
              className="grid h-8 w-9 place-items-center rounded-full"
              style={viewMode === 'page' ? { background: 'var(--pdfs-accent-soft)', color: 'var(--pdfs-accent)' } : undefined}>
              <Square className="h-4 w-4" />
            </button>
          </div>

          <button type="button" onClick={() => void exportPdf()} disabled={busy}
            className="ml-1 flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-bold text-white disabled:opacity-60 sm:px-4"
            style={{ background: 'var(--pdfs-accent)' }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="hidden sm:inline">{busy ? 'Saving…' : 'Save PDF'}</span>
          </button>

          <div className="relative shrink-0">
            <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-label="More actions" aria-haspopup="menu" aria-expanded={menuOpen}
              className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-hover">
              <MoreVertical className="h-5 w-5" />
            </button>
            {menuOpen && (
              <>
                <button type="button" aria-label="Close menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} />
                <div role="menu" className="pdfs-bar pdfs-fade-in absolute right-0 top-12 z-50 w-60 rounded-2xl p-1.5">
                  <MenuRow label="Open another PDF…" icon={Upload} onClick={() => { setMenuOpen(false); fileInputRef.current?.click(); }} />
                  <MenuRow label={viewMode === 'scroll' ? 'Single-page view' : 'Continuous scroll'} icon={GalleryVertical}
                    onClick={() => { setMenuOpen(false); setViewMode((m) => (m === 'scroll' ? 'page' : 'scroll')); }} />
                  <MenuRow label="Zoom…" icon={ZoomIn} onClick={() => { setMenuOpen(false); setZoomMenu('floating'); }} />
                  <MenuRow label="Share saved PDF" icon={Share2} onClick={() => { setMenuOpen(false); void sharePdf(); }} />
                  <MenuRow label="PDF Tools (merge, split…)" icon={Combine} onClick={() => { setMenuOpen(false); }} href="/pdf-tools" />
                </div>
              </>
            )}
            {zoomMenu === 'floating' && <ZoomMenu floating onClose={() => setZoomMenu(null)} onPreset={applyZoomPreset} />}
          </div>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <form
            className="flex items-center gap-2 px-3 pb-2"
            onSubmit={(e) => { e.preventDefault(); void runSearch(); }}
          >
            <div className="flex min-h-10 flex-1 items-center gap-2 rounded-full border px-3" style={{ borderColor: 'var(--pdfs-border)' }}>
              <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--pdfs-text-2)' }} />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearched(false); }}
                placeholder="Find text in this PDF…"
                aria-label="Search text"
                className="w-full bg-transparent text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:hsl(var(--focus-ring-hsl))]"
              />
              {searchBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            <span className="shrink-0 text-[11px] font-semibold" style={{ color: 'var(--pdfs-text-2)' }} role="status">
              {searched && !searchBusy
                ? searchHits.length === 0
                  ? 'No matches (scanned PDFs have no text layer)'
                  : `${searchCursor + 1} of ${searchHits.length} pages`
                : ''}
            </span>
            <button type="button" onClick={() => stepSearch(-1)} disabled={searchHits.length === 0} aria-label="Previous match"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border disabled:opacity-35" style={{ borderColor: 'var(--pdfs-border)' }}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => stepSearch(1)} disabled={searchHits.length === 0} aria-label="Next match"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border disabled:opacity-35" style={{ borderColor: 'var(--pdfs-border)' }}>
              <ChevronRight className="h-4 w-4" />
            </button>
            <button type="submit" className="min-h-10 shrink-0 rounded-full px-4 text-[12.5px] font-bold text-white" style={{ background: 'var(--pdfs-accent)' }}>
              Find
            </button>
          </form>
        )}
      </header>

      {/* Body */}
      <div className="relative flex min-h-0 flex-1">
        <PagePanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          doc={pdf}
          docKey={docKey}
          pages={pages}
          pageIndex={pageIndex}
          onNavigate={(i) => { goToPage(i); if (window.innerWidth < 1024) setPanelOpen(false); }}
          onRotate={rotateAt}
          onDuplicate={duplicateAt}
          onInsertBlank={insertBlankAfter}
          onMove={moveAt}
          onDeleteRequest={(i) => setConfirmDelete(i)}
        />

        <div className="relative min-w-0 flex-1">
          <div
            ref={stageRef}
            className="pdfs-workspace pdfs-scroll absolute inset-0 overflow-auto"
            aria-label="Document workspace"
          >
            <div
              className="flex w-max min-w-full flex-col items-center gap-4 px-3 py-4 sm:px-6 sm:py-5"
              style={
                preview
                  ? { transform: `scale(${preview.factor})`, transformOrigin: `${preview.ox}px ${preview.oy}px` }
                  : undefined
              }
            >
              {visibleIndexes.map((i) => {
                const entry = pages[i];
                if (!entry) return null;
                return (
                  <PdfPageView
                    key={entry.id}
                    doc={pdf}
                    entry={entry}
                    index={i}
                    active={activeSet.has(i)}
                    containerW={containerW}
                    zoom={zoom}
                    dpr={dpr}
                    annotations={annotationsByPage.get(entry.id) || []}
                    draft={draftAnn}
                    editBoxes={editBoxesByPage?.get(entry.id)}
                    selectedId={selectedId}
                    imageTick={imageTick}
                    tool={tool}
                    viewMode={viewMode}
                    turnClass={viewMode === 'page' && turn ? (turn.dir === 'next' ? 'pdfs-turn-next' : 'pdfs-turn-prev') : undefined}
                    registerRef={registerPageEl}
                    onPointer={handlePagePointer}
                  >
                    {(plan) => (
                      <>
                        {textDraft && textDraft.pageId === entry.id ? (
                        <div className="absolute z-20" style={{ left: `${textDraft.at.x * 100}%`, top: `${textDraft.at.y * 100}%`, maxWidth: '75%' }}>
                          <textarea
                            autoFocus
                            value={textDraft.value}
                            onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitTextDraft(); }
                              if (e.key === 'Escape') setTextDraft(null);
                            }}
                            placeholder="Type here…"
                            aria-label="Text annotation"
                            className="min-h-[40px] min-w-[180px] rounded-lg border-2 bg-white/95 px-2 py-1 shadow-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:hsl(var(--focus-ring-hsl))]"
                            style={{
                              borderColor: 'var(--pdfs-accent)',
                              color: inkColor,
                              fontSize: Math.max(13, Math.round(textSize * plan.cssH)),
                              fontFamily: FONT_STACKS[font],
                              fontWeight: bold ? 700 : 500,
                            }}
                          />
                          <div className="mt-1 flex gap-1.5">
                            <button type="button" onClick={commitTextDraft} className="min-h-9 rounded-full px-3 text-[11.5px] font-bold text-white" style={{ background: 'var(--pdfs-accent)' }}>
                              Add text
                            </button>
                            <button type="button" onClick={() => setTextDraft(null)} className="pdfs-bar min-h-9 rounded-full px-3 text-[11.5px] font-semibold">
                              Cancel
                            </button>
                          </div>
                        </div>
                        ) : null}
                        {editDraft && editDraft.pageId === entry.id ? (
                          <div className="absolute z-20" style={{ left: `${editDraft.run.rect.x * 100}%`, top: `${editDraft.run.rect.y * 100}%`, maxWidth: '85%' }}>
                            <div className="pdfs-bar mb-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold" style={{ color: 'var(--pdfs-accent)' }}>
                              {editDraft.run.fontLabel} · {Math.round(editDraft.run.fontSizePt)}pt
                              <span style={{ color: 'var(--pdfs-text-2)' }}>same style</span>
                            </div>
                            <textarea
                              autoFocus
                              rows={Math.min(4, editDraft.value.split('\n').length + 0)}
                              value={editDraft.value}
                              onChange={(e) => setEditDraft({ ...editDraft, value: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEditDraft(); }
                                if (e.key === 'Escape') setEditDraft(null);
                              }}
                              aria-label="Edit PDF text"
                              className="rounded-lg border-2 bg-white/95 px-1.5 py-0.5 shadow-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:hsl(var(--focus-ring-hsl))]"
                              style={{
                                borderColor: 'var(--pdfs-accent)',
                                color: inkColor,
                                width: Math.max(210, Math.round(editDraft.run.rect.w * plan.cssW) + 24),
                                fontSize: Math.max(13, Math.round(editDraft.run.fontSizePt * (plan.cssW / Math.max(1, displayDims(entry).w)))),
                                fontFamily: FONT_STACKS[editDraft.run.font],
                                fontWeight: bold ? 700 : 500,
                                lineHeight: 1.25,
                              }}
                            />
                            <div className="mt-1 flex gap-1.5">
                              <button type="button" onClick={commitEditDraft} className="min-h-9 rounded-full px-3 text-[11.5px] font-bold text-white" style={{ background: 'var(--pdfs-accent)' }}>
                                Replace text
                              </button>
                              <button type="button" onClick={() => setBold((b) => !b)} aria-pressed={bold}
                                className="grid h-9 w-9 place-items-center rounded-full border text-[12px] font-black"
                                style={bold ? { background: 'var(--pdfs-accent)', color: '#fff', borderColor: 'var(--pdfs-accent)' } : { borderColor: 'var(--pdfs-border)', background: 'var(--pdfs-surface)' }}>
                                B
                              </button>
                              <button type="button" onClick={() => setEditDraft(null)} className="pdfs-bar min-h-9 rounded-full px-3 text-[11.5px] font-semibold">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </PdfPageView>
                );
              })}
              {viewMode === 'scroll' && pages.length > 0 && (
                <p className="pb-24 text-[11px] font-medium" style={{ color: 'var(--pdfs-text-2)' }}>
                  End of document · {pages.length} pages
                </p>
              )}
            </div>
          </div>

          {/* Page pill */}
          <div className={`absolute z-20 ${tool !== 'select' || selected ? 'max-sm:hidden' : ''}`} style={{ left: 14, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
            <div className="pdfs-bar flex items-center gap-0.5 rounded-full py-1 pl-1 pr-1">
              <button type="button" onClick={goPrev} disabled={pageIndex === 0} aria-label="Previous page"
                className="grid h-10 w-9 place-items-center rounded-full hover:bg-surface-hover disabled:opacity-35">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setGoToOpen(true)} aria-label="Go to page"
                className="min-h-10 min-w-[58px] px-1 text-center text-[12.5px] font-bold tabular-nums">
                {pageLabel(pageIndex, pages.length)}
              </button>
              <button type="button" onClick={goNext} disabled={pageIndex >= pages.length - 1} aria-label="Next page"
                className="grid h-10 w-9 place-items-center rounded-full hover:bg-surface-hover disabled:opacity-35">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Contextual tool settings */}
          {(tool !== 'select' || selected) && (
            <ToolContextBar
              tool={tool}
              selected={selected}
              inkColor={inkColor}
              hlColor={hlColor}
              onInkColor={setInkColor}
              onHlColor={setHlColor}
              strokeWidth={strokeWidth}
              onStrokeWidth={setStrokeWidth}
              opacity={opacity}
              onOpacity={setOpacity}
              textSize={textSize}
              onTextSize={setTextSize}
              font={font}
              onFont={setFont}
              bold={bold}
              onBold={() => setBold((b) => !b)}
              signatures={signatures}
              activeSignature={activeSignature}
              onPickSignature={setActiveSignature}
              onNewSignature={() => setSignatureOpen(true)}
              onShape={selectTool}
              editInfo={
                !page
                  ? undefined
                  : runsStatus[page.id] === 'loading' || textRuns[page.id] === undefined
                    ? 'Reading page text…'
                    : textRuns[page.id].length === 0
                      ? 'No editable text layer on this page — scanned page. Use PDF Tools → OCR, or Add text.'
                      : `${textRuns[page.id].length} editable lines on this page — tap one (same font & size)`
              }
              onDeleteSelected={() => {
                if (!selected) return;
                commitAnnotations(annotationsRef.current.filter((a) => a.id !== selected.id));
                setSelectedId(null);
              }}
              onClearPage={() => {
                if (!page) return;
                commitAnnotations(annotationsRef.current.filter((a) => a.page !== page.id));
                toast.success('Page marks cleared — Undo can bring them back');
              }}
              onDone={() => { setTool('select'); setSelectedId(null); }}
            />
          )}

          <RadialTools tool={tool} onSelect={onFanSelect} />

          <span className="sr-only" role="status" aria-live="polite">
            Page {pageIndex + 1} of {pages.length}
          </span>
        </div>
      </div>

      {/* Go-to-page sheet */}
      {goToOpen && (
        <GoToPageSheet
          count={pages.length}
          current={pageIndex}
          onClose={() => setGoToOpen(false)}
          onGo={(i) => { setGoToOpen(false); goToPage(i); }}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete !== null && pages[confirmDelete] && (
        <ConfirmSheet
          title={`Delete page ${confirmDelete + 1}?`}
          body={
            (annotationsByPage.get(pages[confirmDelete].id)?.length || 0) > 0
              ? `This page has ${annotationsByPage.get(pages[confirmDelete].id)?.length} mark(s) on it — they will be removed too. You can Undo right after.`
              : 'You can Undo right after deleting.'
          }
          confirmLabel="Delete page"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            const idx = confirmDelete;
            setConfirmDelete(null);
            deleteAt(idx);
          }}
        />
      )}

      {/* Replace-document confirmation */}
      {pendingReplace && (
        <ConfirmSheet
          title="Open another PDF?"
          body="Your current edits have not been exported yet. Opening a different file will discard them in this session."
          confirmLabel="Discard & open"
          onCancel={() => setPendingReplace(null)}
          onConfirm={() => {
            const f = pendingReplace;
            setPendingReplace(null);
            void openFile(f);
          }}
        />
      )}

      {/* Password prompt while a doc is already open */}
      {loadState === 'password' && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button type="button" aria-label="Cancel" className="absolute inset-0 bg-[color:var(--nk-scrim)]" onClick={() => setLoadState('idle')} />
          <div className="pdfs-bar pdfs-sheet relative w-full max-w-sm rounded-3xl p-5">
            <PasswordPrompt
              fileName={pendingFileRef.current?.name || 'PDF'}
              wrong={passwordWrong}
              busy={false}
              onCancel={() => setLoadState('idle')}
              onSubmit={(pw) => pendingFileRef.current && void openFile(pendingFileRef.current, pw)}
            />
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" aria-hidden tabIndex={-1}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) requestOpen(f); }} />
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" aria-hidden tabIndex={-1}
        onChange={(e) => { void onImagePicked(e.target.files?.[0] || null); e.target.value = ''; }} />

      {signatureOpen && (
        <SignatureModal
          onClose={() => setSignatureOpen(false)}
          onChange={(list) => { setSignatures(list); writeSignatures(list); }}
          onSaved={(dataUrl) => {
            setSignatureOpen(false);
            setActiveSignature(dataUrl);
            setTool('signature');
          }}
        />
      )}
    </div>
  );
}

// ── Small building blocks ────────────────────────────────────

function MenuRow({ label, icon: Icon, onClick, href }: {
  label: string;
  icon: React.FC<{ className?: string }>;
  onClick: () => void;
  href?: string;
}) {
  const cls = 'flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-[13px] font-semibold hover:bg-surface-hover';
  if (href) {
    return (
      <Link to={href} className={cls} role="menuitem" onClick={onClick}>
        <Icon className="h-4 w-4" /> {label}
      </Link>
    );
  }
  return (
    <button type="button" role="menuitem" className={cls} onClick={onClick}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function ZoomMenu({ onClose, onPreset, floating }: {
  onClose: () => void;
  onPreset: (p: 'fit-width' | 'fit-page' | 'actual' | number) => void;
  floating?: boolean;
}) {
  const rows: Array<{ label: string; value: 'fit-width' | 'fit-page' | 'actual' | number }> = [
    { label: 'Fit width', value: 'fit-width' },
    { label: 'Fit page', value: 'fit-page' },
    { label: 'Actual size (100%)', value: 'actual' },
    { label: '75%', value: 0.75 },
    { label: '125%', value: 1.25 },
    { label: '150%', value: 1.5 },
    { label: '200%', value: 2 },
    { label: '300%', value: 3 },
  ];
  return (
    <>
      <button type="button" aria-label="Close zoom menu" className="fixed inset-0 z-40 cursor-default" onClick={onClose} />
      <div role="menu" aria-label="Zoom"
        className={`pdfs-bar pdfs-fade-in z-50 w-52 rounded-2xl p-1.5 ${floating ? 'fixed right-3 top-16' : 'absolute right-0 top-12'}`}>
        {rows.map((r) => (
          <button key={r.label} type="button" role="menuitem" onClick={() => onPreset(r.value)}
            className="flex min-h-10 w-full items-center rounded-xl px-2.5 text-left text-[13px] font-semibold hover:bg-surface-hover">
            {r.label}
          </button>
        ))}
      </div>
    </>
  );
}

function PasswordPrompt({ fileName, wrong, busy, onSubmit, onCancel }: {
  fileName: string;
  wrong: boolean;
  busy: boolean;
  onSubmit: (pw: string) => void;
  onCancel: () => void;
}) {
  const [pw, setPw] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (pw) onSubmit(pw); }}>
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl" style={{ background: 'var(--pdfs-accent-soft)', color: 'var(--pdfs-accent)' }}>
        <Lock className="h-6 w-6" />
      </div>
      <h2 className="text-center text-base font-bold">Password needed</h2>
      <p className="mt-1 text-center text-[12.5px]" style={{ color: 'var(--pdfs-text-2)' }}>
        {fileName} is protected. The password never leaves this device.
      </p>
      {wrong && <p className="mt-2 text-center text-[12px] font-semibold" style={{ color: 'var(--pdfs-danger)' }}>That password was incorrect — try again.</p>}
      <input
        type="password"
        autoFocus
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="PDF password"
        aria-label="PDF password"
        className="mt-3 min-h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:hsl(var(--focus-ring-hsl))]"
        style={{ borderColor: 'var(--pdfs-border)', background: 'var(--pdfs-surface)' }}
      />
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onCancel} className="min-h-11 flex-1 rounded-full border text-sm font-semibold" style={{ borderColor: 'var(--pdfs-border)' }}>
          Cancel
        </button>
        <button type="submit" disabled={!pw || busy} className="min-h-11 flex-1 rounded-full text-sm font-bold text-white disabled:opacity-50" style={{ background: 'var(--pdfs-accent)' }}>
          Unlock
        </button>
      </div>
    </form>
  );
}

function GoToPageSheet({ count, current, onClose, onGo }: {
  count: number;
  current: number;
  onClose: () => void;
  onGo: (index: number) => void;
}) {
  const [draft, setDraft] = useState(String(current + 1));
  const parsed = parsePageInput(draft, count);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Go to page">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-[color:var(--nk-scrim)]" onClick={onClose} />
      <form
        className="pdfs-bar pdfs-sheet relative w-full max-w-xs rounded-t-3xl p-4 sm:rounded-3xl"
        onSubmit={(e) => { e.preventDefault(); if (parsed !== null) onGo(parsed); }}
      >
        <h3 className="text-sm font-bold">Go to page</h3>
        <div className="mt-3 flex items-center gap-2">
          <input
            autoFocus
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
            aria-label="Page number"
            className="min-h-11 w-20 rounded-xl border px-3 text-center text-base font-bold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:hsl(var(--focus-ring-hsl))]"
            style={{ borderColor: 'var(--pdfs-border)', background: 'var(--pdfs-surface)' }}
          />
          <span className="text-sm font-medium" style={{ color: 'var(--pdfs-text-2)' }}>of {count}</span>
          <button type="submit" disabled={parsed === null} className="ml-auto min-h-11 rounded-full px-5 text-sm font-bold text-white disabled:opacity-50" style={{ background: 'var(--pdfs-accent)' }}>
            Go
          </button>
        </div>
        {draft && parsed === null && (
          <p className="mt-2 text-[11.5px] font-medium" style={{ color: 'var(--pdfs-danger)' }}>Enter a page between 1 and {count}.</p>
        )}
      </form>
    </div>
  );
}

function ConfirmSheet({ title, body, confirmLabel, onCancel, onConfirm }: {
  title: string;
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="alertdialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Cancel" className="absolute inset-0 bg-[color:var(--nk-scrim)]" onClick={onCancel} />
      <div className="pdfs-bar pdfs-sheet relative w-full max-w-sm rounded-t-3xl p-4 sm:rounded-3xl" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <h3 className="text-[15px] font-bold">{title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: 'var(--pdfs-text-2)' }}>{body}</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel} autoFocus className="min-h-11 flex-1 rounded-full border text-sm font-semibold" style={{ borderColor: 'var(--pdfs-border)' }}>
            Keep it
          </button>
          <button type="button" onClick={onConfirm} className="min-h-11 flex-1 rounded-full text-sm font-bold text-white" style={{ background: 'var(--pdfs-danger)' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Contextual settings for the active tool ──────────────────

function ToolContextBar(props: {
  tool: PdfTool;
  selected: Annotation | null;
  inkColor: string;
  hlColor: string;
  onInkColor: (c: string) => void;
  onHlColor: (c: string) => void;
  strokeWidth: number;
  onStrokeWidth: (n: number) => void;
  opacity: number;
  onOpacity: (n: number) => void;
  textSize: number;
  onTextSize: (n: number) => void;
  font: TextAnnotation['font'];
  onFont: (f: TextAnnotation['font']) => void;
  bold: boolean;
  onBold: () => void;
  signatures: string[];
  activeSignature: string | null;
  onPickSignature: (s: string) => void;
  onNewSignature: () => void;
  onShape: (t: PdfTool) => void;
  editInfo?: string;
  onDeleteSelected: () => void;
  onClearPage: () => void;
  onDone: () => void;
}) {
  const { tool } = props;
  const isShapeGroup = SHAPE_TOOLS.includes(tool);
  const showInkColors = ['pen', 'text', 'edittext', ...SHAPE_TOOLS].includes(tool);
  const shapeButtons: Array<{ id: PdfTool; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'rect', label: 'Rectangle', icon: Square },
    { id: 'ellipse', label: 'Circle', icon: Circle },
    { id: 'line', label: 'Line', icon: Minus },
    { id: 'arrow', label: 'Arrow', icon: ArrowUpRight },
    { id: 'check', label: 'Tick', icon: Check },
    { id: 'cross', label: 'Cross', icon: X },
    { id: 'star', label: 'Star', icon: Star },
  ];

  return (
    <div
      className="pdfs-context-bar absolute left-3 right-[84px] z-20 sm:left-1/2 sm:right-auto sm:w-max sm:max-w-[calc(100vw-220px)] sm:-translate-x-1/2 sm:[--pdfs-rise-x:-50%]"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      role="toolbar"
      aria-label={`${TOOL_LABELS[tool]} settings`}
    >
      <div className="pdfs-bar flex items-center gap-2 overflow-x-auto rounded-full py-1.5 pl-3 pr-1.5">
        <span className="pdfs-tool-pill shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold">
          {tool === 'select' ? 'Selected' : TOOL_LABELS[tool]}
        </span>

        {tool === 'select' && props.selected && (
          <button type="button" onClick={props.onDeleteSelected}
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold"
            style={{ color: 'var(--pdfs-danger)', background: 'var(--pdfs-danger-soft)' }}>
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        )}

        {isShapeGroup && shapeButtons.map((s) => {
          const Icon = s.icon;
          const active = tool === s.id;
          return (
            <button key={s.id} type="button" onClick={() => props.onShape(s.id)} aria-label={s.label} aria-pressed={active}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
              style={active ? { background: 'var(--pdfs-accent)', color: '#fff' } : undefined}>
              <Icon className="h-[18px] w-[18px]" />
            </button>
          );
        })}

        {showInkColors && (
          <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Colour">
            {INK_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => props.onInkColor(c)} aria-label={`Colour ${c}`} aria-pressed={props.inkColor === c}
                className="h-7 w-7 rounded-full border-2 transition-transform"
                style={{ background: c, borderColor: props.inkColor === c ? 'var(--pdfs-accent)' : 'rgba(0,0,0,0.12)', transform: props.inkColor === c ? 'scale(1.12)' : undefined }} />
            ))}
          </div>
        )}

        {tool === 'highlighter' && (
          <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Highlighter colour">
            {HIGHLIGHT_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => props.onHlColor(c)} aria-label={`Colour ${c}`} aria-pressed={props.hlColor === c}
                className="h-7 w-7 rounded-full border-2 transition-transform"
                style={{ background: c, borderColor: props.hlColor === c ? 'var(--pdfs-accent)' : 'rgba(0,0,0,0.12)', transform: props.hlColor === c ? 'scale(1.12)' : undefined }} />
            ))}
          </div>
        )}

        {['pen', 'highlighter', ...SHAPE_TOOLS].includes(tool) && (
          <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'var(--pdfs-text-2)' }}>
            Size
            <input type="range" min={1} max={12} step={1} aria-label="Stroke size"
              value={Math.round(props.strokeWidth * 1000)}
              onChange={(e) => props.onStrokeWidth(Number(e.target.value) / 1000)} className="w-[72px]" />
          </label>
        )}

        {['pen', 'rect', 'ellipse', 'line', 'arrow'].includes(tool) && (
          <label className="hidden shrink-0 items-center gap-1.5 text-[11px] font-semibold sm:flex" style={{ color: 'var(--pdfs-text-2)' }}>
            Opacity
            <input type="range" min={10} max={100} aria-label="Opacity"
              value={Math.round(props.opacity * 100)}
              onChange={(e) => props.onOpacity(Number(e.target.value) / 100)} className="w-14" />
          </label>
        )}

        {tool === 'text' && (
          <>
            <select value={props.font} onChange={(e) => props.onFont(e.target.value as TextAnnotation['font'])} aria-label="Font"
              className="min-h-9 shrink-0 rounded-full border px-2 text-[12px] font-semibold" style={{ borderColor: 'var(--pdfs-border)', background: 'var(--pdfs-surface)' }}>
              <option value="sans">Sans</option>
              <option value="serif">Serif</option>
              <option value="cursive">Handwriting</option>
              <option value="mono">Mono</option>
            </select>
            <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'var(--pdfs-text-2)' }}>
              Size
              <input type="range" min={10} max={60} aria-label="Text size"
                value={Math.round(props.textSize * 1000)}
                onChange={(e) => props.onTextSize(Number(e.target.value) / 1000)} className="w-[72px]" />
            </label>
            <button type="button" onClick={props.onBold} aria-pressed={props.bold} aria-label="Bold"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border text-[13px] font-black"
              style={props.bold ? { background: 'var(--pdfs-accent)', color: '#fff', borderColor: 'var(--pdfs-accent)' } : { borderColor: 'var(--pdfs-border)' }}>
              B
            </button>
            <span className="hidden shrink-0 text-[11px] font-medium md:inline" style={{ color: 'var(--pdfs-text-2)' }}>Tap the page, then type</span>
          </>
        )}

        {tool === 'edittext' && (
          <>
            <button type="button" onClick={props.onBold} aria-pressed={props.bold} aria-label="Bold"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border text-[13px] font-black"
              style={props.bold ? { background: 'var(--pdfs-accent)', color: '#fff', borderColor: 'var(--pdfs-accent)' } : { borderColor: 'var(--pdfs-border)' }}>
              B
            </button>
            <span className="max-w-[220px] shrink-0 text-[11px] font-medium leading-tight sm:max-w-[300px]" style={{ color: 'var(--pdfs-text-2)' }} role="status">
              {props.editInfo || 'Tap a highlighted line — new text keeps its font & size'}
            </span>
          </>
        )}

        {tool === 'eraser' && (
          <>
            <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] font-medium" style={{ color: 'var(--pdfs-text-2)' }}>
              <Eraser className="h-4 w-4" /> Drag across marks to erase
            </span>
            <button type="button" onClick={props.onClearPage} className="min-h-9 shrink-0 rounded-full px-3 text-[11.5px] font-bold"
              style={{ color: 'var(--pdfs-danger)', background: 'var(--pdfs-danger-soft)' }}>
              Clear page
            </button>
          </>
        )}

        {tool === 'signature' && (
          <>
            {props.signatures.map((s, i) => (
              <button key={i} type="button" onClick={() => props.onPickSignature(s)} aria-label={`Signature ${i + 1}`} aria-pressed={props.activeSignature === s}
                className="h-10 w-16 shrink-0 overflow-hidden rounded-lg border bg-white p-0.5"
                style={{ borderColor: props.activeSignature === s ? 'var(--pdfs-accent)' : 'var(--pdfs-border)' }}>
                <img src={s} alt="" className="h-full w-full object-contain" />
              </button>
            ))}
            <button type="button" onClick={props.onNewSignature} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold"
              style={{ background: 'var(--pdfs-accent-soft)', color: 'var(--pdfs-accent)' }}>
              <PenTool className="h-4 w-4" /> New
            </button>
          </>
        )}

        {tool === 'image' && (
          <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] font-medium" style={{ color: 'var(--pdfs-text-2)' }}>
            <ImageIcon className="h-4 w-4" /> Tap the page where the photo should go
          </span>
        )}

        {(tool === 'pen' || tool === 'highlighter') && (
          <span className="hidden shrink-0 text-[11px] font-medium lg:inline" style={{ color: 'var(--pdfs-text-2)' }}>
            {tool === 'pen' ? <span className="flex items-center gap-1"><PenLine className="h-3.5 w-3.5" /> Draw on the page</span>
              : <span className="flex items-center gap-1"><Highlighter className="h-3.5 w-3.5" /> Drag over text</span>}
          </span>
        )}

        <button type="button" onClick={props.onDone} aria-label="Done — back to reading"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white" style={{ background: 'var(--pdfs-accent)' }}>
          <Check className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// ── Signature capture ────────────────────────────────────────

function SignatureModal({ onClose, onSaved, onChange }: {
  onClose: () => void;
  onSaved: (dataUrl: string) => void;
  onChange: (list: string[]) => void;
}) {
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
    onChange([dataUrl, ...readSignatures()].slice(0, 8));
    onSaved(dataUrl);
    toast.success('Signature saved — tap the page to place it');
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Your signature">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-[color:var(--nk-scrim)]" onClick={onClose} />
      <div className="pdfs-bar pdfs-sheet relative w-full max-w-lg rounded-3xl p-5">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold"><Type className="h-4 w-4" style={{ color: 'var(--pdfs-accent)' }} /> Your signature</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-hover">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-[12px]" style={{ color: 'var(--pdfs-text-2)' }}>Draw with your finger or mouse. It stays stored only on this device.</p>
        <canvas
          ref={canvasRef}
          width={640}
          height={240}
          className="w-full rounded-2xl border-2 border-dashed bg-white"
          style={{ touchAction: 'none', borderColor: 'var(--pdfs-border)' }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={() => { drawing.current = false; }}
          onPointerLeave={() => { drawing.current = false; }}
        />
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={clear} className="min-h-11 rounded-full border px-4 text-[13px] font-semibold" style={{ borderColor: 'var(--pdfs-border)' }}>
            Clear
          </button>
          <button type="button" onClick={save} disabled={!hasInk}
            className="ml-auto flex min-h-11 items-center gap-1.5 rounded-full px-5 text-[13px] font-bold text-white disabled:opacity-50"
            style={{ background: 'var(--pdfs-accent)' }}>
            <PenTool className="h-4 w-4" /> Save signature
          </button>
        </div>
      </div>
    </div>
  );
}
