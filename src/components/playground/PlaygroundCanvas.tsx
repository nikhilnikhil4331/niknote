import React, {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from 'react';
import {
  ArrowDownToLine, ArrowUpToLine, Check, ChevronDown, Code2, Copy, Download,
  Expand, FileJson, Grid3X3, Group, Hand, Image as ImageIcon, Layers,
  Lock, Map, Maximize2, Minus, MousePointer2, Plus, Redo2, RotateCw,
  Shapes, StickyNote, Table2, Trash2, Type, Undo2, Unlock, Workflow, X,
  PenLine, MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  PLAYGROUND_GRID,
  alignPlaygroundObject,
  clampZoom,
  connectionPath,
  createPlaygroundObject,
  duplicatePlaygroundObjects,
  fitViewport,
  normalizedRect,
  objectBounds,
  objectsInRect,
  playgroundId,
  screenToWorld,
  temporaryConnectionPath,
  zoomAt,
  type PlaygroundBlockKind,
  type PlaygroundDocument,
  type PlaygroundEdge,
  type PlaygroundObject,
  type PlaygroundPoint,
  type PlaygroundTool,
  type PlaygroundViewport,
  type Rect,
} from '@/lib/playground';
import { PlaygroundObjectView } from './PlaygroundObjectView';
import { ContextToolbar } from './ContextToolbar';
import { Minimap } from './Minimap';

export interface PlaygroundCanvasHandle {
  addBlock: (kind: PlaygroundBlockKind, overrides?: Partial<PlaygroundObject>) => void;
  writeText: (overrides?: Partial<PlaygroundObject>) => void;
  openImagePicker: () => void;
  setTool: (tool: PlaygroundTool) => void;
  focusObject: (id: string) => void;
  fit: () => void;
}

interface Props {
  doc: PlaygroundDocument;
  apply: (recipe: (draft: PlaygroundDocument) => void, options?: { record?: boolean; touch?: boolean }) => void;
  beginTransaction: () => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: boolean;
  canRedo: boolean;
  libraryOpen: boolean;
  onToggleLibrary: () => void;
  onPresentation: () => void;
  onOpenDocument: (object: PlaygroundObject) => void;
}

interface GestureBase {
  pointerId: number;
  startClientX: number;
  startClientY: number;
}

type Gesture = GestureBase & (
  | { type: 'pan'; viewport: PlaygroundViewport }
  | { type: 'move'; originals: PlaygroundObject[]; primaryId: string }
  | { type: 'resize'; original: PlaygroundObject; corner: string }
  | { type: 'rotate'; original: PlaygroundObject }
  | { type: 'select'; start: { x: number; y: number }; initialSelection: string[] }
  | { type: 'draw'; id: string; points: PlaygroundPoint[] }
  | { type: 'connect'; from: string }
);

interface ContextMenuState { x: number; y: number; id: string }
interface ClipboardState { objects: PlaygroundObject[]; edges: PlaygroundEdge[] }

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));

export const PlaygroundCanvas = forwardRef<PlaygroundCanvasHandle, Props>(function PlaygroundCanvas({
  doc, apply, beginTransaction, undo, redo, canUndo, canRedo, libraryOpen, onToggleLibrary, onPresentation, onOpenDocument,
}, ref) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docStateRef = useRef(doc);
  const viewportRef = useRef(doc.viewport);
  const sizeRef = useRef({ width: 800, height: 600 });
  const gesture = useRef<Gesture | null>(null);
  const clipboard = useRef<ClipboardState | null>(null);
  const spacePressed = useRef(false);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tool, setToolState] = useState<PlaygroundTool>('select');
  const [selectionRect, setSelectionRect] = useState<Rect | null>(null);
  const [guides, setGuides] = useState<{ vertical?: number; horizontal?: number }>({});
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [connectionPoint, setConnectionPoint] = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [spaceActive, setSpaceActive] = useState(false);
  docStateRef.current = doc;
  viewportRef.current = doc.viewport;
  sizeRef.current = size;

  const selectedObjects = useMemo(() => doc.objects.filter((object) => selectedIds.includes(object.id)), [doc.objects, selectedIds]);
  const selectedEdge = doc.edges.find((edge) => edge.id === selectedEdgeId) || null;
  const orderedObjects = useMemo(() => [...doc.objects].sort((a, b) => a.z - b.z), [doc.objects]);

  useEffect(() => {
    setSelectedIds([]);
    setSelectedEdgeId(null);
    setEditingId(null);
    setConnectingFrom(null);
    setContextMenu(null);
  }, [doc.id]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      const next = { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
      sizeRef.current = next;
      setSize(next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const localPoint = useCallback((event: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

  const worldPoint = useCallback((event: { clientX: number; clientY: number }) => {
    const point = localPoint(event);
    return screenToWorld(viewportRef.current, point.x, point.y);
  }, [localPoint]);

  const updateViewport = useCallback((viewport: PlaygroundViewport) => {
    viewportRef.current = viewport;
    apply((draft) => { draft.viewport = viewport; }, { record: false, touch: false });
  }, [apply]);

  const fit = useCallback(() => {
    const viewport = fitViewport(objectBounds(doc.objects), sizeRef.current.width, sizeRef.current.height);
    updateViewport(viewport);
  }, [doc.objects, updateViewport]);

  const setZoom = useCallback((requested: number) => {
    const current = viewportRef.current;
    updateViewport(zoomAt(current, sizeRef.current.width / 2, sizeRef.current.height / 2, requested));
  }, [updateViewport]);

  // Read the ref for every step so rapid clicks never reuse a stale rendered zoom.
  const zoomBy = useCallback((factor: number) => {
    const current = viewportRef.current;
    updateViewport(zoomAt(
      current,
      sizeRef.current.width / 2,
      sizeRef.current.height / 2,
      current.zoom * factor,
    ));
  }, [updateViewport]);

  const focusObject = useCallback((id: string) => {
    const object = doc.objects.find((candidate) => candidate.id === id);
    if (!object) return;
    setSelectedIds([id]);
    setSelectedEdgeId(null);
    const zoom = Math.max(0.65, viewportRef.current.zoom);
    updateViewport({
      zoom,
      x: sizeRef.current.width / 2 - (object.x + object.width / 2) * zoom,
      y: sizeRef.current.height / 2 - (object.y + object.height / 2) * zoom,
    });
  }, [doc.objects, updateViewport]);

  const addBlock = useCallback((kind: PlaygroundBlockKind, overrides: Partial<PlaygroundObject> = {}, at?: { x: number; y: number }) => {
    const centre = at || screenToWorld(viewportRef.current, sizeRef.current.width / 2, sizeRef.current.height / 2);
    const object = createPlaygroundObject(kind, 0, 0, overrides);
    const offset = at ? 0 : (doc.objects.length % 5) * 18;
    object.x = centre.x - object.width / 2 + offset;
    object.y = centre.y - object.height / 2 + offset;
    if (doc.snap) {
      object.x = Math.round(object.x / PLAYGROUND_GRID) * PLAYGROUND_GRID;
      object.y = Math.round(object.y / PLAYGROUND_GRID) * PLAYGROUND_GRID;
    }
    apply((draft) => { draft.objects.push(object); });
    setSelectedIds([object.id]);
    setSelectedEdgeId(null);
    setToolState('select');
    return object.id;
  }, [apply, doc.objects.length, doc.snap]);

  const startEditing = useCallback((id: string | null) => {
    if (id && id !== editingId) beginTransaction();
    setEditingId(id);
  }, [beginTransaction, editingId]);

  const writeText = useCallback((overrides: Partial<PlaygroundObject> = {}, at?: { x: number; y: number }) => {
    const id = addBlock('text', { text: '', ...overrides }, at);
    startEditing(id);
  }, [addBlock, startEditing]);

  useImperativeHandle(ref, () => ({
    addBlock: (kind, overrides) => { addBlock(kind, overrides); },
    writeText: (overrides) => { writeText(overrides); },
    openImagePicker: () => imageInputRef.current?.click(),
    setTool: (next) => setToolState(next),
    focusObject,
    fit,
  }), [addBlock, writeText, focusObject, fit]);

  const patchObject = useCallback((id: string, patch: Partial<PlaygroundObject>, record = true) => {
    apply((draft) => {
      const object = draft.objects.find((candidate) => candidate.id === id);
      if (object && !object.locked) Object.assign(object, patch);
    }, { record });
  }, [apply]);

  const patchEdge = useCallback((id: string, patch: Partial<PlaygroundEdge>) => {
    apply((draft) => {
      const edge = draft.edges.find((candidate) => candidate.id === id);
      if (edge) Object.assign(edge, patch);
    });
  }, [apply]);

  const deleteSelection = useCallback(() => {
    if (selectedEdgeId) {
      apply((draft) => { draft.edges = draft.edges.filter((edge) => edge.id !== selectedEdgeId); });
      setSelectedEdgeId(null);
      return;
    }
    if (!selectedIds.length) return;
    apply((draft) => {
      draft.objects = draft.objects.filter((object) => !selectedIds.includes(object.id));
      draft.edges = draft.edges.filter((edge) => !selectedIds.includes(edge.from) && !selectedIds.includes(edge.to));
    });
    setSelectedIds([]);
    setContextMenu(null);
  }, [apply, selectedEdgeId, selectedIds]);

  const duplicateSelection = useCallback(() => {
    if (!selectedIds.length) return;
    const { copies, edges, ids } = duplicatePlaygroundObjects(doc, selectedIds);
    apply((draft) => { draft.objects.push(...copies); draft.edges.push(...edges); });
    setSelectedIds(ids);
    setContextMenu(null);
  }, [apply, doc, selectedIds]);

  const copySelection = useCallback(() => {
    if (!selectedIds.length) return;
    clipboard.current = {
      objects: doc.objects.filter((object) => selectedIds.includes(object.id)),
      edges: doc.edges.filter((edge) => selectedIds.includes(edge.from) && selectedIds.includes(edge.to)),
    };
    try { localStorage.setItem('niknote.playground.clipboard', JSON.stringify(clipboard.current)); } catch { /* in-memory copy still works */ }
    toast.success(`${selectedIds.length} object${selectedIds.length === 1 ? '' : 's'} copied`);
  }, [doc.edges, doc.objects, selectedIds]);

  const pasteSelection = useCallback(() => {
    if (!clipboard.current) {
      try { clipboard.current = JSON.parse(localStorage.getItem('niknote.playground.clipboard') || 'null'); } catch { clipboard.current = null; }
    }
    if (!clipboard.current?.objects.length) return;
    const snippet: PlaygroundDocument = { ...doc, objects: clipboard.current.objects, edges: clipboard.current.edges };
    const { copies, edges, ids } = duplicatePlaygroundObjects(snippet, snippet.objects.map((object) => object.id));
    apply((draft) => { draft.objects.push(...copies); draft.edges.push(...edges); });
    setSelectedIds(ids);
  }, [apply, clipboard, doc]);

  const lockSelection = useCallback(() => {
    if (!selectedIds.length) return;
    const shouldLock = !selectedObjects.every((object) => object.locked);
    apply((draft) => draft.objects.forEach((object) => { if (selectedIds.includes(object.id)) object.locked = shouldLock; }));
  }, [apply, selectedIds, selectedObjects]);

  const layerSelection = useCallback((direction: 'front' | 'back') => {
    if (!selectedIds.length) return;
    const z = direction === 'front' ? Math.max(...doc.objects.map((object) => object.z), 0) + 1 : Math.min(...doc.objects.map((object) => object.z), 0) - 1;
    apply((draft) => draft.objects.forEach((object) => { if (selectedIds.includes(object.id)) object.z = z; }));
  }, [apply, doc.objects, selectedIds]);

  const groupSelection = useCallback(() => {
    if (!selectedIds.length) return;
    const groupId = selectedObjects.length > 1 && !selectedObjects.every((object) => object.groupId && object.groupId === selectedObjects[0].groupId)
      ? playgroundId('group')
      : undefined;
    apply((draft) => draft.objects.forEach((object) => { if (selectedIds.includes(object.id)) object.groupId = groupId; }));
  }, [apply, selectedIds, selectedObjects]);

  const rotateSelection = useCallback((delta: number) => {
    apply((draft) => draft.objects.forEach((object) => {
      if (selectedIds.includes(object.id) && !object.locked) object.rotation = (object.rotation + delta) % 360;
    }));
  }, [apply, selectedIds]);

  const connect = useCallback((from: string, to: string) => {
    if (from === to) return;
    if (docStateRef.current.edges.some((edge) => edge.from === from && edge.to === to)) {
      setConnectingFrom(null);
      toast.info('These nodes are already connected');
      return;
    }
    const edge: PlaygroundEdge = { id: playgroundId('edge'), from, to, color: '#A02AA4', width: 2, arrow: 'end', style: 'solid' };
    apply((draft) => { draft.edges.push(edge); });
    setConnectingFrom(null);
    setConnectionPoint(null);
    setSelectedEdgeId(edge.id);
    setSelectedIds([]);
  }, [apply]);

  const onPortDown = useCallback((event: React.PointerEvent, id: string, side: 'input' | 'output') => {
    event.preventDefault();
    event.stopPropagation();
    if (side === 'input') {
      if (connectingFrom && connectingFrom !== id) connect(connectingFrom, id);
      return;
    }
    if (connectingFrom === id && !gesture.current) {
      setConnectingFrom(null);
      setConnectionPoint(null);
      return;
    }
    setConnectingFrom(id);
    setSelectedIds([id]);
    setSelectedEdgeId(null);
    setConnectionPoint(worldPoint(event));
    gesture.current = { type: 'connect', from: id, pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY };
    canvasRef.current?.setPointerCapture(event.pointerId);
  }, [connect, connectingFrom, worldPoint]);

  const startHandle = useCallback((event: React.PointerEvent, id: string, mode: 'resize' | 'rotate', corner = 'se') => {
    event.preventDefault();
    event.stopPropagation();
    const original = docStateRef.current.objects.find((object) => object.id === id);
    if (!original || original.locked) return;
    beginTransaction();
    gesture.current = { type: mode, original, corner, pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY } as Gesture;
    canvasRef.current?.setPointerCapture(event.pointerId);
  }, [beginTransaction]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    const target = event.target as Element;
    if (target.closest('.pg-canvas-ui') || target.closest('input,textarea,select,a,button')) return;
    const objectElement = target.closest('[data-object-id]');
    const id = objectElement?.getAttribute('data-object-id');
    setContextMenu(null);
    setExportOpen(false);

    if (id) {
      const object = doc.objects.find((candidate) => candidate.id === id);
      if (!object || editingId === id) return;
      event.preventDefault();
      setSelectedEdgeId(null);
      let nextSelection: string[];
      const grouped = object.groupId ? doc.objects.filter((candidate) => candidate.groupId === object.groupId).map((candidate) => candidate.id) : [id];
      if (event.shiftKey) {
        nextSelection = selectedIds.includes(id) ? selectedIds.filter((selected) => !grouped.includes(selected)) : [...new Set([...selectedIds, ...grouped])];
      } else if (selectedIds.includes(id)) {
        nextSelection = selectedIds;
      } else {
        nextSelection = grouped;
      }
      setSelectedIds(nextSelection);
      if (object.locked || tool === 'connect' || spacePressed.current || tool === 'pan') return;
      beginTransaction();
      const originals = doc.objects.filter((candidate) => nextSelection.includes(candidate.id));
      gesture.current = { type: 'move', pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, originals, primaryId: id };
      canvasRef.current?.setPointerCapture(event.pointerId);
      return;
    }

    if (connectingFrom) {
      setConnectingFrom(null);
      setConnectionPoint(null);
    }
    setSelectedEdgeId(null);
    if (event.button === 1 || spacePressed.current || tool === 'pan') {
      event.preventDefault();
      gesture.current = { type: 'pan', pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, viewport: viewportRef.current };
    } else if (tool === 'text') {
      writeText({}, worldPoint(event));
    } else if (tool === 'pen') {
      event.preventDefault();
      beginTransaction();
      const point = worldPoint(event);
      const pressure = event.pointerType === 'pen' && event.pressure > 0 ? event.pressure : 0.5;
      const object = createPlaygroundObject('drawing', point.x, point.y, {
        width: 4,
        height: 4,
        points: [{ x: 0, y: 0, pressure }],
        color: doc.theme === 'dark' ? '#ED808E' : '#8020A2',
        strokeWidth: 3,
      });
      apply((draft) => { draft.objects.push(object); }, { record: false });
      gesture.current = { type: 'draw', id: object.id, points: [{ x: point.x, y: point.y, pressure }], pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY };
      setSelectedIds([object.id]);
    } else {
      const start = worldPoint(event);
      gesture.current = { type: 'select', pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, start, initialSelection: event.shiftKey ? selectedIds : [] };
      if (!event.shiftKey) setSelectedIds([]);
      setSelectionRect({ x: start.x, y: start.y, width: 0, height: 0 });
    }
    if (gesture.current) canvasRef.current?.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = gesture.current;
    if (connectingFrom) setConnectionPoint(worldPoint(event));
    if (!active || active.pointerId !== event.pointerId) return;
    const current = active;
    const zoom = viewportRef.current.zoom;
    const dx = (event.clientX - current.startClientX) / zoom;
    const dy = (event.clientY - current.startClientY) / zoom;

    if (current.type === 'pan') {
      updateViewport({ ...current.viewport, x: current.viewport.x + event.clientX - current.startClientX, y: current.viewport.y + event.clientY - current.startClientY });
      return;
    }
    if (current.type === 'select') {
      const point = worldPoint(event);
      setSelectionRect(normalizedRect(current.start, point));
      return;
    }
    if (current.type === 'connect') {
      setConnectionPoint(worldPoint(event));
      return;
    }
    if (current.type === 'draw') {
      const point = worldPoint(event);
      const pressure = event.pointerType === 'pen' && event.pressure > 0 ? event.pressure : 0.5;
      current.points.push({ x: point.x, y: point.y, pressure });
      const minX = Math.min(...current.points.map((p) => p.x));
      const minY = Math.min(...current.points.map((p) => p.y));
      const maxX = Math.max(...current.points.map((p) => p.x));
      const maxY = Math.max(...current.points.map((p) => p.y));
      const points = current.points.map((p) => ({ x: p.x - minX, y: p.y - minY, pressure: p.pressure }));
      patchObject(current.id, { x: minX, y: minY, width: Math.max(4, maxX - minX), height: Math.max(4, maxY - minY), points }, false);
      return;
    }
    if (current.type === 'move') {
      const primary = current.originals.find((object) => object.id === current.primaryId);
      if (!primary) return;
      let adjustedDx = dx;
      let adjustedDy = dy;
      if (doc.snap) {
        adjustedDx = Math.round((primary.x + dx) / PLAYGROUND_GRID) * PLAYGROUND_GRID - primary.x;
        adjustedDy = Math.round((primary.y + dy) / PLAYGROUND_GRID) * PLAYGROUND_GRID - primary.y;
      }
      if (current.originals.length === 1 && !primary.locked) {
        const aligned = alignPlaygroundObject({ ...primary, x: primary.x + adjustedDx, y: primary.y + adjustedDy }, doc.objects, 7 / zoom);
        adjustedDx = aligned.x - primary.x;
        adjustedDy = aligned.y - primary.y;
        setGuides({ vertical: aligned.vertical, horizontal: aligned.horizontal });
      }
      apply((draft) => {
        for (const original of current.originals) {
          const object = draft.objects.find((candidate) => candidate.id === original.id);
          if (object && !object.locked) {
            object.x = original.x + adjustedDx;
            object.y = original.y + adjustedDy;
          }
        }
      }, { record: false });
      return;
    }
    if (current.type === 'resize') {
      const o = current.original;
      let x = o.x;
      let y = o.y;
      let width = o.width;
      let height = o.height;
      if (current.corner.includes('e')) width = Math.max(30, o.width + dx);
      if (current.corner.includes('s')) height = Math.max(24, o.height + dy);
      if (current.corner.includes('w')) { width = Math.max(30, o.width - dx); x = o.x + o.width - width; }
      if (current.corner.includes('n')) { height = Math.max(24, o.height - dy); y = o.y + o.height - height; }
      if (event.shiftKey && o.kind === 'image') {
        const ratio = o.width / o.height;
        height = width / ratio;
        if (current.corner.includes('n')) y = o.y + o.height - height;
      }
      if (doc.snap) { width = Math.round(width / 12) * 12; height = Math.round(height / 12) * 12; }
      patchObject(o.id, { x, y, width, height }, false);
      return;
    }
    if (current.type === 'rotate') {
      const point = worldPoint(event);
      const o = current.original;
      let rotation = Math.atan2(point.y - (o.y + o.height / 2), point.x - (o.x + o.width / 2)) * 180 / Math.PI + 90;
      if (event.shiftKey) rotation = Math.round(rotation / 15) * 15;
      patchObject(o.id, { rotation }, false);
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (active.type === 'select' && selectionRect) {
      const ids = selectionRect.width + selectionRect.height > 5 ? objectsInRect(doc.objects, selectionRect) : active.initialSelection;
      setSelectedIds([...new Set([...active.initialSelection, ...ids])]);
    }
    if (active.type === 'connect') {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-object-id]');
      const targetId = target?.getAttribute('data-object-id');
      const targetObject = doc.objects.find((object) => object.id === targetId);
      if (targetObject?.kind === 'node' && targetId !== active.from) connect(active.from, targetId!);
    }
    if (active.type === 'draw') setToolState('select');
    gesture.current = null;
    setSelectionRect(null);
    setGuides({});
    if (canvasRef.current?.hasPointerCapture(event.pointerId)) canvasRef.current.releasePointerCapture(event.pointerId);
  };

  const onContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = (event.target as Element).closest('[data-object-id]');
    const id = target?.getAttribute('data-object-id');
    if (!id) return;
    event.preventDefault();
    if (!selectedIds.includes(id)) setSelectedIds([id]);
    setSelectedEdgeId(null);
    const point = localPoint(event);
    setContextMenu({ x: point.x, y: point.y, id });
  };

  // Native non-passive wheel listener: zoom remains centred under the pointer.
  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const current = viewportRef.current;
      if (event.shiftKey && !event.ctrlKey && !event.metaKey) {
        updateViewport({ ...current, x: current.x - event.deltaY, y: current.y - event.deltaX });
        return;
      }
      const factor = Math.exp(-event.deltaY * (event.ctrlKey || event.metaKey ? 0.012 : 0.0015));
      updateViewport(zoomAt(current, event.clientX - rect.left, event.clientY - rect.top, current.zoom * factor));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [updateViewport]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isTypingTarget(event.target)) {
        event.preventDefault();
        spacePressed.current = true;
        setSpaceActive(true);
      }
      if (isTypingTarget(event.target)) return;
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }
      if (command && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
      if (command && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicateSelection(); return; }
      if (command && event.key.toLowerCase() === 'c') { event.preventDefault(); copySelection(); return; }
      if (command && event.key.toLowerCase() === 'v') { event.preventDefault(); pasteSelection(); return; }
      if (command && event.key.toLowerCase() === 'g') { event.preventDefault(); groupSelection(); return; }
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelection(); return; }
      if (event.key === 'Escape') {
        setSelectedIds([]); setSelectedEdgeId(null); setEditingId(null); setConnectingFrom(null); setContextMenu(null); setToolState('select');
      }
      if (event.key === '0') { event.preventDefault(); fit(); }
      if (event.key === '1') { event.preventDefault(); setZoom(1); }
      const tools: Record<string, PlaygroundTool> = { v: 'select', h: 'pan', t: 'text', p: 'pen', c: 'connect' };
      if (tools[event.key.toLowerCase()] && !command) { event.preventDefault(); setToolState(tools[event.key.toLowerCase()]); }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') { spacePressed.current = false; setSpaceActive(false); }
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    return () => { window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); };
  }, [copySelection, deleteSelection, duplicateSelection, fit, groupSelection, pasteSelection, redo, setZoom, undo]);

  const processImage = async (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) return toast.error('Choose a PNG, JPG, WEBP or GIF image.');
    if (file.size > 8 * 1024 * 1024) return toast.error('Image is larger than 8 MB.');
    try {
      const source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read image'));
        reader.readAsDataURL(file);
      });
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('Could not decode image'));
        element.src = source;
      });
      let src = source;
      if (file.type !== 'image/gif' && (file.size > 900_000 || image.naturalWidth > 1600)) {
        const scale = Math.min(1, 1600 / image.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        src = canvas.toDataURL('image/jpeg', 0.84);
      }
      const centre = screenToWorld(viewportRef.current, sizeRef.current.width / 2, sizeRef.current.height / 2);
      addBlock('image', {
        src,
        alt: file.name.replace(/\.[^.]+$/, ''),
        width: Math.min(440, image.naturalWidth),
        height: Math.min(440, image.naturalWidth) * image.naturalHeight / image.naturalWidth,
      }, centre);
      toast.success('Image added to the canvas');
    } catch {
      toast.error('This image could not be added. Try a different file.');
    } finally {
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const exportJSON = () => {
    downloadBlob(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), `${safeFilename(doc.title)}.playground.json`);
    setExportOpen(false);
  };

  const exportSVG = () => {
    const bounds = objectBounds(doc.objects) || { x: 0, y: 0, width: 800, height: 600 };
    const padding = 32;
    const esc = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!);
    const body = [
      ...doc.edges.map((edge) => `<path d="${connectionPath(edge, doc.objects)}" fill="none" stroke="${edge.color || '#A02AA4'}" stroke-width="${edge.width || 2}" ${edge.style === 'dashed' ? 'stroke-dasharray="8 6"' : ''}/>`),
      ...orderedObjects.map((object) => {
        const common = `transform="rotate(${object.rotation} ${object.x + object.width / 2} ${object.y + object.height / 2})" opacity="${object.opacity ?? 1}"`;
        if (object.kind === 'image' && object.src) return `<image href="${object.src}" x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" preserveAspectRatio="xMidYMid slice" ${common}/>`;
        if (object.kind === 'shape') return `<rect x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" rx="${object.shape === 'circle' ? object.width / 2 : object.radius || 4}" fill="${object.background || '#EEE7F5'}" stroke="${object.borderColor || '#8020A2'}" ${common}/>`;
        if (object.kind === 'drawing') return `<path d="${(object.points || []).map((point, index) => `${index ? 'L' : 'M'} ${object.x + point.x} ${object.y + point.y}`).join(' ')}" fill="none" stroke="${object.color || '#8020A2'}" stroke-width="${object.strokeWidth || 3}" stroke-linecap="round" stroke-linejoin="round"/>`;
        if (object.kind === 'divider') return `<line x1="${object.x}" y1="${object.y + object.height / 2}" x2="${object.x + object.width}" y2="${object.y + object.height / 2}" stroke="#B8AEBD"/>`;
        const lines = object.kind === 'todo' ? [object.text || 'Checklist', ...(object.items || []).map((item) => `${item.done ? '✓' : '○'} ${item.text}`)] : object.kind === 'table' ? (object.rows || []).map((row) => row.join('  |  ')) : [object.text || '', object.subtitle || ''];
        const fill = object.kind === 'code' ? '#17131B' : object.background || (object.kind === 'node' || object.kind === 'todo' ? '#FFFFFF' : 'none');
        const textColor = object.color || (doc.theme === 'dark' && !object.background ? '#F8F5FA' : '#17131B');
        return `<g ${common}><rect x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" rx="${object.kind === 'node' ? 16 : 5}" fill="${fill}" stroke="${object.kind === 'node' ? '#B9A4C2' : 'none'}"/>${lines.filter(Boolean).map((line, index) => `<text x="${object.x + 16}" y="${object.y + 28 + index * (object.fontSize || 16) * 1.35}" fill="${textColor}" font-family="${object.fontFamily || 'Inter, sans-serif'}" font-size="${index === 0 ? object.fontSize || 16 : Math.min(14, object.fontSize || 14)}" font-weight="${index === 0 ? object.fontWeight || 500 : 400}">${esc(line)}</text>`).join('')}</g>`;
      }),
    ].join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width + padding * 2}" height="${bounds.height + padding * 2}" viewBox="${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}"><rect x="${bounds.x - padding}" y="${bounds.y - padding}" width="${bounds.width + padding * 2}" height="${bounds.height + padding * 2}" fill="${doc.theme === 'dark' ? '#09090D' : '#FFFFFF'}"/>${body}</svg>`;
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${safeFilename(doc.title)}.svg`);
    setExportOpen(false);
  };

  const bounds = objectBounds(selectedObjects);
  const toolbarPosition = bounds ? {
    left: Math.max(150, Math.min(size.width - 150, doc.viewport.x + (bounds.x + bounds.width / 2) * doc.viewport.zoom)),
    top: doc.viewport.y + bounds.y * doc.viewport.zoom - 12,
  } : null;
  const toolbarBelow = Boolean(toolbarPosition && toolbarPosition.top < 72);
  if (toolbarPosition && toolbarBelow && bounds) toolbarPosition.top = doc.viewport.y + (bounds.y + bounds.height) * doc.viewport.zoom + 38;
  const connectingObject = doc.objects.find((object) => object.id === connectingFrom);

  return (
    <div
      ref={canvasRef}
      className={`pg-canvas${spaceActive || tool === 'pan' ? ' is-panning' : ''}${tool === 'text' ? ' is-text-tool' : ''}${tool === 'pen' ? ' is-drawing-tool' : ''}`}
      data-canvas-theme={doc.theme}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={onContextMenu}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
      onDrop={(event) => {
        event.preventDefault();
        const raw = event.dataTransfer.getData('application/x-niknote-block');
        if (!raw) return;
        try {
          const spec = JSON.parse(raw) as { kind: PlaygroundBlockKind; overrides?: Partial<PlaygroundObject> };
          addBlock(spec.kind, spec.overrides, worldPoint(event));
        } catch { /* external drag data is ignored */ }
      }}
      style={{
        backgroundImage: doc.grid ? undefined : 'none',
        backgroundPosition: `${doc.viewport.x}px ${doc.viewport.y}px`,
        backgroundSize: `${PLAYGROUND_GRID * doc.viewport.zoom}px ${PLAYGROUND_GRID * doc.viewport.zoom}px`,
      }}
      aria-label="Infinite playground canvas"
    >
      <div className="pg-world" style={{ transform: `translate(${doc.viewport.x}px, ${doc.viewport.y}px) scale(${doc.viewport.zoom})` }}>
        <svg className="pg-connections" width="1" height="1" overflow="visible">
          <defs>
            <marker id="pg-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" /></marker>
          </defs>
          {doc.edges.map((edge) => {
            const path = connectionPath(edge, doc.objects);
            return (
              <g key={edge.id} className={selectedEdgeId === edge.id ? 'is-selected' : ''}>
                <path d={path} className="pg-edge-hit" onPointerDown={(event) => { event.stopPropagation(); setSelectedEdgeId(edge.id); setSelectedIds([]); }} />
                <path d={path} className="pg-edge" stroke={edge.color || '#A02AA4'} strokeWidth={edge.width || 2} strokeDasharray={edge.style === 'dashed' ? '8 6' : undefined} markerEnd={edge.arrow !== 'none' ? 'url(#pg-arrow)' : undefined} markerStart={edge.arrow === 'both' ? 'url(#pg-arrow)' : undefined} pointerEvents="none" />
                {edge.label && <EdgeLabel edge={edge} objects={doc.objects} />}
              </g>
            );
          })}
          {connectingObject && connectionPoint && <path d={temporaryConnectionPath(connectingObject, connectionPoint)} className="pg-edge-temp" />}
          {guides.vertical !== undefined && <line x1={guides.vertical} y1={-100000} x2={guides.vertical} y2={100000} className="pg-align-guide" />}
          {guides.horizontal !== undefined && <line x1={-100000} y1={guides.horizontal} x2={100000} y2={guides.horizontal} className="pg-align-guide" />}
        </svg>
        {orderedObjects.map((object, layer) => (
          <PlaygroundObjectView
            key={object.id}
            object={object}
            layer={layer}
            selected={selectedIds.includes(object.id)}
            editing={editingId === object.id}
            onPatch={patchObject}
            onBeginTransaction={beginTransaction}
            onEdit={startEditing}
            onPortDown={onPortDown}
            onHandleDown={startHandle}
          />
        ))}
        {selectionRect && <div className="pg-selection-rect" style={{ left: selectionRect.x, top: selectionRect.y, width: selectionRect.width, height: selectionRect.height }} />}
      </div>

      {!doc.objects.length && (
        <div className="pg-canvas-empty pg-canvas-ui">
          <span><Layers size={25} /></span>
          <h2>A clear space for your next idea</h2>
          <p>Write, connect, draw or drop a block anywhere.</p>
          <div><button onClick={() => writeText()}><Type size={14} /> Start writing</button><button onClick={() => addBlock('sticky')}><StickyNote size={14} /> Add sticky note</button></div>
        </div>
      )}

      <div className="pg-tool-rail pg-canvas-ui">
        <ToolButton label="Select (V)" active={tool === 'select'} onClick={() => setToolState('select')}><MousePointer2 size={17} /></ToolButton>
        <ToolButton label="Pan (H or Space)" active={tool === 'pan'} onClick={() => setToolState('pan')}><Hand size={17} /></ToolButton>
        <ToolButton label="Text (T)" active={tool === 'text'} onClick={() => setToolState('text')}><Type size={17} /></ToolButton>
        <ToolButton label="Connect nodes (C)" active={tool === 'connect' || Boolean(connectingFrom)} onClick={() => setToolState(tool === 'connect' ? 'select' : 'connect')}><Workflow size={17} /></ToolButton>
        <ToolButton label="Draw (P)" active={tool === 'pen'} onClick={() => setToolState('pen')}><PenLine size={17} /></ToolButton>
        <span />
        <ToolButton label={doc.grid ? 'Hide grid' : 'Show grid'} active={doc.grid} onClick={() => apply((draft) => { draft.grid = !draft.grid; }, { touch: false })}><Grid3X3 size={17} /></ToolButton>
        <ToolButton label={doc.snap ? 'Disable snap' : 'Enable snap'} active={doc.snap} onClick={() => apply((draft) => { draft.snap = !draft.snap; }, { touch: false })}><Expand size={17} /></ToolButton>
      </div>

      {connectingFrom && <div className="pg-connect-hint pg-canvas-ui"><Workflow size={13} /> Choose another node to connect <button onClick={() => setConnectingFrom(null)}><X size={12} /></button></div>}

      {(toolbarPosition || selectedEdge) && !editingId && (
        <div
          className={`pg-context-position pg-canvas-ui${toolbarBelow ? ' is-below' : ''}${selectedEdge ? ' is-edge' : ''}`}
          style={selectedEdge ? { left: '50%', top: 18 } : { left: toolbarPosition!.left, top: toolbarPosition!.top }}
        >
          <ContextToolbar
            objects={selectedObjects}
            edge={selectedEdge}
            onPatch={patchObject}
            onPatchEdge={patchEdge}
            onDuplicate={duplicateSelection}
            onDelete={deleteSelection}
            onDeleteEdge={deleteSelection}
            onLock={lockSelection}
            onLayer={layerSelection}
            onGroup={groupSelection}
            onRotate={rotateSelection}
            onReplaceImage={() => imageInputRef.current?.click()}
            onOpenDocument={() => { if (selectedObjects[0]) onOpenDocument(selectedObjects[0]); }}
          />
        </div>
      )}

      {contextMenu && (
        <div className="pg-context-menu pg-canvas-ui" style={{ left: Math.min(contextMenu.x, size.width - 190), top: Math.min(contextMenu.y, size.height - 250) }}>
          <button onClick={copySelection}><Copy size={13} /> Copy <kbd>Ctrl C</kbd></button>
          <button onClick={duplicateSelection}><Copy size={13} /> Duplicate <kbd>Ctrl D</kbd></button>
          <button onClick={() => { rotateSelection(15); setContextMenu(null); }}><RotateCw size={13} /> Rotate 15°</button>
          <button onClick={() => { layerSelection('front'); setContextMenu(null); }}><ArrowUpToLine size={13} /> Bring to front</button>
          <button onClick={() => { layerSelection('back'); setContextMenu(null); }}><ArrowDownToLine size={13} /> Send to back</button>
          <button onClick={() => { lockSelection(); setContextMenu(null); }}>{doc.objects.find((object) => object.id === contextMenu.id)?.locked ? <Unlock size={13} /> : <Lock size={13} />} Lock / unlock</button>
          <button className="is-danger" onClick={deleteSelection}><Trash2 size={13} /> Delete</button>
        </div>
      )}

      <div className="pg-quick-bar pg-canvas-ui">
        <button className="pg-quick-add" onClick={onToggleLibrary} title="Add a block"><Plus size={18} /></button>
        <button onClick={() => writeText()} title="Text"><Type size={16} /></button>
        <button onClick={() => imageInputRef.current?.click()} title="Image"><ImageIcon size={16} /></button>
        <button onClick={() => addBlock('code')} title="Code"><Code2 size={16} /></button>
        <button onClick={() => addBlock('table')} title="Table"><Table2 size={16} /></button>
        <button onClick={() => addBlock('node')} title="Workflow node"><Workflow size={16} /></button>
        <button onClick={() => addBlock('sticky')} title="Sticky note"><StickyNote size={16} /></button>
        <button onClick={() => setToolState('pen')} title="Draw"><PenLine size={16} /></button>
        <button onClick={onToggleLibrary} className={libraryOpen ? 'is-active' : ''} title="More blocks"><MoreHorizontal size={17} /></button>
      </div>

      <div className="pg-canvas-bottom-left pg-canvas-ui">
        <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl Z)"><Undo2 size={15} /></button>
        <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl Shift Z)"><Redo2 size={15} /></button>
        <span>Space + drag to pan · Wheel to zoom</span>
      </div>

      <div className="pg-zoom-bar pg-canvas-ui">
        <button onClick={() => zoomBy(1 / 1.15)} aria-label="Zoom out"><Minus size={15} /></button>
        <button className="pg-zoom-value" onClick={() => setZoom(1)} title="Reset to 100%">{Math.round(doc.viewport.zoom * 100)}%</button>
        <button onClick={() => zoomBy(1.15)} aria-label="Zoom in"><Plus size={15} /></button>
        <button onClick={fit} title="Fit to screen (0)"><Maximize2 size={15} /></button>
        <button className={showMinimap ? 'is-active' : ''} onClick={() => setShowMinimap((value) => !value)} title="Toggle minimap"><Map size={15} /></button>
        <button onClick={onPresentation} title="Presentation mode"><Expand size={15} /></button>
        <div className="pg-export-control">
          <button onClick={() => setExportOpen((value) => !value)} title="Export canvas"><Download size={15} /></button>
          {exportOpen && <div className="pg-export-menu"><button onClick={exportJSON}><FileJson size={13} /> Backup JSON</button><button onClick={exportSVG}><Shapes size={13} /> Export SVG</button></div>}
        </div>
      </div>

      {showMinimap && doc.objects.length > 0 && <div className="pg-minimap-wrap pg-canvas-ui"><Minimap doc={doc} width={size.width} height={size.height} onNavigate={updateViewport} /></div>}
      <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(event) => void processImage(event.target.files?.[0])} />
    </div>
  );
});

function ToolButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={active ? 'is-active' : ''} onClick={onClick} title={label} aria-label={label}>{children}</button>;
}

function EdgeLabel({ edge, objects }: { edge: PlaygroundEdge; objects: PlaygroundObject[] }) {
  const from = objects.find((object) => object.id === edge.from);
  const to = objects.find((object) => object.id === edge.to);
  if (!from || !to) return null;
  const x = (from.x + from.width + to.x) / 2;
  const y = (from.y + from.height / 2 + to.y + to.height / 2) / 2 - 10;
  return <text x={x} y={y} className="pg-edge-label" textAnchor="middle">{edge.label}</text>;
}

function safeFilename(title: string) {
  return title.trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'niknote-playground';
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
