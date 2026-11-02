// Pure, serialisable model for the NikNote infinite playground.
// React, pointer gestures and persistence deliberately live outside this file.

export type PlaygroundTheme = 'light' | 'dark';
export type PlaygroundTool = 'select' | 'pan' | 'text' | 'pen' | 'connect';
export type PlaygroundBlockKind =
  | 'text'
  | 'heading'
  | 'sticky'
  | 'todo'
  | 'shape'
  | 'image'
  | 'node'
  | 'code'
  | 'table'
  | 'divider'
  | 'drawing'
  | 'link';

export interface PlaygroundPoint {
  x: number;
  y: number;
  pressure?: number;
}

export interface PlaygroundTodo {
  id: string;
  text: string;
  done: boolean;
}

export interface PlaygroundObject {
  id: string;
  kind: PlaygroundBlockKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z: number;
  locked?: boolean;
  groupId?: string;
  text?: string;
  subtitle?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  align?: 'left' | 'center' | 'right';
  color?: string;
  background?: string;
  borderColor?: string;
  opacity?: number;
  radius?: number;
  shape?: 'rectangle' | 'circle' | 'triangle' | 'arrow';
  src?: string;
  alt?: string;
  href?: string;
  items?: PlaygroundTodo[];
  rows?: string[][];
  points?: PlaygroundPoint[];
  strokeWidth?: number;
  nodeCategory?: 'Input' | 'Data' | 'AI' | 'Logic' | 'Processing' | 'Output' | 'Integration';
}

export interface PlaygroundEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  color?: string;
  style?: 'solid' | 'dashed';
  width?: number;
  arrow?: 'none' | 'end' | 'both';
}

export interface PlaygroundViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface PlaygroundDocument {
  version: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  theme: PlaygroundTheme;
  objects: PlaygroundObject[];
  edges: PlaygroundEdge[];
  viewport: PlaygroundViewport;
  grid: boolean;
  snap: boolean;
}

export interface PlaygroundIndexEntry {
  id: string;
  title: string;
  updatedAt: string;
  favorite?: boolean;
  pinned?: boolean;
  position: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PLAYGROUND_GRID = 24;
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 2.5;

export const playgroundId = (prefix = 'pg') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const clampZoom = (zoom: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number.isFinite(zoom) ? zoom : 1));

export function clonePlaygroundDocument(doc: PlaygroundDocument): PlaygroundDocument {
  return JSON.parse(JSON.stringify(doc)) as PlaygroundDocument;
}

export function emptyPlayground(title = 'Untitled playground'): PlaygroundDocument {
  const now = new Date().toISOString();
  return {
    version: 1,
    id: playgroundId(),
    title,
    createdAt: now,
    updatedAt: now,
    theme: 'light',
    objects: [],
    edges: [],
    viewport: { x: 56, y: 44, zoom: 1 },
    grid: true,
    snap: true,
  };
}

const DEFAULT_SIZES: Partial<Record<PlaygroundBlockKind, [number, number]>> = {
  text: [280, 96],
  heading: [560, 74],
  sticky: [240, 190],
  todo: [280, 220],
  shape: [190, 150],
  image: [360, 240],
  node: [210, 124],
  code: [380, 210],
  table: [420, 190],
  divider: [360, 24],
  drawing: [180, 140],
  link: [300, 110],
};

export function createPlaygroundObject(
  kind: PlaygroundBlockKind,
  x: number,
  y: number,
  overrides: Partial<PlaygroundObject> = {},
): PlaygroundObject {
  const [width, height] = DEFAULT_SIZES[kind] ?? [260, 140];
  const base: PlaygroundObject = {
    id: playgroundId('obj'),
    kind,
    x,
    y,
    width,
    height,
    rotation: 0,
    z: Date.now(),
    text: '',
    fontSize: kind === 'heading' ? 38 : kind === 'code' ? 14 : 16,
    fontFamily: kind === 'code' ? 'monospace' : 'Inter, sans-serif',
    fontWeight: kind === 'heading' ? 750 : 450,
    fontStyle: 'normal',
    textDecoration: 'none',
    align: 'left',
    opacity: 1,
  };

  if (kind === 'text') base.text = 'Write something…';
  if (kind === 'heading') base.text = 'Untitled idea';
  if (kind === 'sticky') {
    base.text = 'Capture an idea…';
    base.background = '#F3EDFF';
    base.color = '#2B2035';
  }
  if (kind === 'todo') {
    base.text = 'Checklist';
    base.items = [
      { id: playgroundId('task'), text: 'First task', done: false },
      { id: playgroundId('task'), text: 'Second task', done: false },
    ];
    base.background = '#F7F3FF';
  }
  if (kind === 'shape') {
    base.shape = 'rectangle';
    base.background = '#EEE7F5';
    base.borderColor = '#8020A2';
    base.strokeWidth = 2;
  }
  if (kind === 'node') {
    base.text = 'New node';
    base.subtitle = 'Visual node · not executed';
    base.nodeCategory = 'Processing';
  }
  if (kind === 'code') {
    base.text = '// Write code or notes here\n';
    base.background = '#17131B';
    base.color = '#F8F5FA';
  }
  if (kind === 'table') {
    base.text = 'Table';
    base.rows = [
      ['Name', 'Owner', 'Status'],
      ['Research', '', 'Not started'],
      ['Prototype', '', 'Not started'],
    ];
  }
  if (kind === 'link') {
    base.text = 'Useful link';
    base.href = 'https://www.niknote.online';
  }
  return { ...base, ...overrides };
}

/** A clearly editable starter template, not fabricated user activity or run results. */
export function starterPlayground(): PlaygroundDocument {
  const doc = emptyPlayground('Model Design');
  const heading = createPlaygroundObject('heading', 64, 52, {
    text: 'Model Design Playground',
    width: 680,
    height: 70,
  });
  const subtitle = createPlaygroundObject('text', 70, 126, {
    text: 'Design · Plan · Build · Experiment',
    width: 520,
    height: 42,
    color: '#777784',
    fontSize: 16,
  });
  const dataset = createPlaygroundObject('node', 62, 264, {
    text: 'Dataset',
    subtitle: 'Input · connect your idea',
    nodeCategory: 'Input',
    width: 190,
  });
  const model = createPlaygroundObject('node', 348, 230, {
    text: 'AI Model',
    subtitle: 'Visual plan · not executed',
    nodeCategory: 'AI',
    width: 224,
    height: 142,
  });
  const evaluation = createPlaygroundObject('node', 674, 264, {
    text: 'Evaluation',
    subtitle: 'Output · add your criteria',
    nodeCategory: 'Output',
    width: 200,
  });
  const checklist = createPlaygroundObject('todo', 594, 480, {
    text: 'Ideas',
    items: [
      { id: playgroundId('task'), text: 'Try with a larger dataset', done: false },
      { id: playgroundId('task'), text: 'Compare with a baseline', done: false },
      { id: playgroundId('task'), text: 'Add evaluation criteria', done: false },
    ],
    width: 286,
    height: 206,
  });
  const note = createPlaygroundObject('sticky', 82, 478, {
    text: 'Double-click any object to edit.\nDrag from a node’s right port to connect ideas.',
    width: 300,
    height: 150,
  });
  doc.objects = [heading, subtitle, dataset, model, evaluation, checklist, note];
  doc.edges = [
    { id: playgroundId('edge'), from: dataset.id, to: model.id, color: '#A02AA4', width: 2, arrow: 'end' },
    { id: playgroundId('edge'), from: model.id, to: evaluation.id, color: '#CB289D', width: 2, arrow: 'end' },
  ];
  return doc;
}

function finite(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function normalizePlayground(raw: unknown, fallbackId?: string): PlaygroundDocument {
  if (!raw || typeof raw !== 'object') return emptyPlayground();
  const value = raw as Partial<PlaygroundDocument>;
  const fallback = emptyPlayground(typeof value.title === 'string' ? value.title : 'Untitled playground');
  const objects = Array.isArray(value.objects)
    ? value.objects.filter((o): o is PlaygroundObject => Boolean(o && typeof o.id === 'string' && typeof o.kind === 'string')).map((o, index) => ({
        ...o,
        x: finite(o.x, 0),
        y: finite(o.y, 0),
        width: Math.max(12, finite(o.width, 240)),
        height: Math.max(8, finite(o.height, 120)),
        rotation: finite(o.rotation, 0),
        z: finite(o.z, index + 1),
      }))
    : [];
  const objectIds = new Set(objects.map((o) => o.id));
  const edges = Array.isArray(value.edges)
    ? value.edges.filter((e): e is PlaygroundEdge => Boolean(e && typeof e.id === 'string' && objectIds.has(e.from) && objectIds.has(e.to)))
    : [];
  return {
    ...fallback,
    id: typeof value.id === 'string' ? value.id : fallbackId || fallback.id,
    title: typeof value.title === 'string' ? value.title : fallback.title,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : fallback.createdAt,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : fallback.updatedAt,
    theme: value.theme === 'dark' ? 'dark' : 'light',
    objects,
    edges,
    viewport: {
      x: finite(value.viewport?.x, fallback.viewport.x),
      y: finite(value.viewport?.y, fallback.viewport.y),
      zoom: clampZoom(finite(value.viewport?.zoom, 1)),
    },
    grid: value.grid !== false,
    snap: value.snap !== false,
  };
}

export function objectBounds(objects: PlaygroundObject[]): Rect | null {
  if (!objects.length) return null;
  const left = Math.min(...objects.map((o) => o.x));
  const top = Math.min(...objects.map((o) => o.y));
  const right = Math.max(...objects.map((o) => o.x + o.width));
  const bottom = Math.max(...objects.map((o) => o.y + o.height));
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

export function fitViewport(
  bounds: Rect | null,
  containerWidth: number,
  containerHeight: number,
  padding = 88,
): PlaygroundViewport {
  if (!bounds || containerWidth <= 0 || containerHeight <= 0) return { x: 48, y: 40, zoom: 1 };
  const usableWidth = Math.max(80, containerWidth - padding * 2);
  const usableHeight = Math.max(80, containerHeight - padding * 2);
  const zoom = clampZoom(Math.min(1.15, usableWidth / bounds.width, usableHeight / bounds.height));
  return {
    zoom,
    x: (containerWidth - bounds.width * zoom) / 2 - bounds.x * zoom,
    y: (containerHeight - bounds.height * zoom) / 2 - bounds.y * zoom,
  };
}

export function zoomAt(viewport: PlaygroundViewport, screenX: number, screenY: number, requestedZoom: number): PlaygroundViewport {
  const zoom = clampZoom(requestedZoom);
  const worldX = (screenX - viewport.x) / viewport.zoom;
  const worldY = (screenY - viewport.y) / viewport.zoom;
  return { zoom, x: screenX - worldX * zoom, y: screenY - worldY * zoom };
}

export function screenToWorld(viewport: PlaygroundViewport, screenX: number, screenY: number) {
  return { x: (screenX - viewport.x) / viewport.zoom, y: (screenY - viewport.y) / viewport.zoom };
}

export function normalizedRect(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export function objectsInRect(objects: PlaygroundObject[], rect: Rect) {
  return objects.filter((o) =>
    o.x < rect.x + rect.width &&
    o.x + o.width > rect.x &&
    o.y < rect.y + rect.height &&
    o.y + o.height > rect.y,
  ).map((o) => o.id);
}

export function duplicatePlaygroundObjects(doc: PlaygroundDocument, ids: string[]) {
  const selected = new Set(ids);
  const idMap = new Map<string, string>();
  const copies = doc.objects.filter((o) => selected.has(o.id)).map((o) => {
    const id = playgroundId('obj');
    idMap.set(o.id, id);
    return {
      ...JSON.parse(JSON.stringify(o)) as PlaygroundObject,
      id,
      x: o.x + 28,
      y: o.y + 28,
      z: Date.now() + idMap.size,
      groupId: undefined,
    };
  });
  const edges = doc.edges.filter((e) => selected.has(e.from) && selected.has(e.to)).map((e) => ({
    ...e,
    id: playgroundId('edge'),
    from: idMap.get(e.from)!,
    to: idMap.get(e.to)!,
  }));
  return { copies, edges, ids: copies.map((o) => o.id) };
}

export interface AlignmentResult {
  x: number;
  y: number;
  vertical?: number;
  horizontal?: number;
}

/** Snap a single moving object to nearby edges/centres and return visible guides. */
export function alignPlaygroundObject(moving: PlaygroundObject, others: PlaygroundObject[], threshold = 7): AlignmentResult {
  let bestX: { distance: number; delta: number; guide: number } | null = null;
  let bestY: { distance: number; delta: number; guide: number } | null = null;
  const movingX = [moving.x, moving.x + moving.width / 2, moving.x + moving.width];
  const movingY = [moving.y, moving.y + moving.height / 2, moving.y + moving.height];
  for (const other of others) {
    if (other.id === moving.id) continue;
    const otherX = [other.x, other.x + other.width / 2, other.x + other.width];
    const otherY = [other.y, other.y + other.height / 2, other.y + other.height];
    movingX.forEach((value, i) => otherX.forEach((target) => {
      const distance = Math.abs(value - target);
      if (distance <= threshold && (!bestX || distance < bestX.distance)) bestX = { distance, delta: target - value, guide: target };
      void i;
    }));
    movingY.forEach((value) => otherY.forEach((target) => {
      const distance = Math.abs(value - target);
      if (distance <= threshold && (!bestY || distance < bestY.distance)) bestY = { distance, delta: target - value, guide: target };
    }));
  }
  const xResult = bestX as { delta: number; guide: number } | null;
  const yResult = bestY as { delta: number; guide: number } | null;
  return {
    x: moving.x + (xResult?.delta ?? 0),
    y: moving.y + (yResult?.delta ?? 0),
    vertical: xResult?.guide,
    horizontal: yResult?.guide,
  };
}

export function portPosition(object: PlaygroundObject, side: 'input' | 'output') {
  return {
    x: object.x + (side === 'output' ? object.width : 0),
    y: object.y + object.height / 2,
  };
}

export function connectionPath(edge: Pick<PlaygroundEdge, 'from' | 'to'>, objects: PlaygroundObject[]) {
  const from = objects.find((o) => o.id === edge.from);
  const to = objects.find((o) => o.id === edge.to);
  if (!from || !to) return '';
  const a = portPosition(from, 'output');
  const b = portPosition(to, 'input');
  const bend = Math.max(56, Math.abs(b.x - a.x) * 0.45);
  return `M ${a.x} ${a.y} C ${a.x + bend} ${a.y}, ${b.x - bend} ${b.y}, ${b.x} ${b.y}`;
}

export function temporaryConnectionPath(from: PlaygroundObject, point: { x: number; y: number }) {
  const a = portPosition(from, 'output');
  const bend = Math.max(56, Math.abs(point.x - a.x) * 0.45);
  return `M ${a.x} ${a.y} C ${a.x + bend} ${a.y}, ${point.x - bend} ${point.y}, ${point.x} ${point.y}`;
}
