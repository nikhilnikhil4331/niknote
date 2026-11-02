import { describe, expect, it } from 'vitest';
import {
  alignPlaygroundObject,
  connectionPath,
  createPlaygroundObject,
  duplicatePlaygroundObjects,
  emptyPlayground,
  fitViewport,
  normalizedRect,
  normalizePlayground,
  objectBounds,
  objectsInRect,
  playgroundId,
  playgroundToNoteText,
  screenToWorld,
  starterPlayground,
  zoomAt,
} from '@/lib/playground';

describe('infinite playground model', () => {
  it('creates an editable starter template without fake execution results', () => {
    const doc = starterPlayground();
    expect(doc.objects.length).toBeGreaterThanOrEqual(6);
    expect(doc.edges).toHaveLength(2);
    expect(doc.objects.every((object) => !('status' in object))).toBe(true);
    expect(doc.objects.filter((object) => object.kind === 'node').every((node) => node.subtitle?.includes('not executed') || node.subtitle?.includes('connect') || node.subtitle?.includes('criteria'))).toBe(true);
  });

  it('normalises damaged persisted data and drops orphan connections', () => {
    const valid = createPlaygroundObject('text', 10, 20, { id: 'valid', width: -40, height: Number.NaN });
    const doc = normalizePlayground({
      id: 'doc-1',
      title: 'Recovered',
      objects: [valid, { id: 'broken' }, null],
      edges: [
        { id: 'kept', from: 'valid', to: 'valid' },
        { id: 'orphan', from: 'valid', to: 'missing' },
      ],
      viewport: { x: Number.NaN, y: 20, zoom: 900 },
    });
    expect(doc.id).toBe('doc-1');
    expect(doc.objects).toHaveLength(1);
    expect(doc.objects[0].width).toBe(12);
    expect(doc.objects[0].height).toBe(120);
    expect(doc.edges.map((edge) => edge.id)).toEqual(['kept']);
    expect(doc.viewport.zoom).toBe(2.5);
    expect(Number.isFinite(doc.viewport.x)).toBe(true);
  });

  it('keeps the pointer anchored while zooming', () => {
    const viewport = { x: 80, y: 40, zoom: 0.8 };
    const before = screenToWorld(viewport, 400, 300);
    const zoomed = zoomAt(viewport, 400, 300, 1.25);
    const after = screenToWorld(zoomed, 400, 300);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(zoomed.zoom).toBe(1.25);
  });

  it('fits all objects inside the available viewport', () => {
    const bounds = objectBounds([
      createPlaygroundObject('text', 0, 0, { width: 400, height: 200 }),
      createPlaygroundObject('sticky', 500, 300, { width: 200, height: 150 }),
    ]);
    const viewport = fitViewport(bounds, 800, 600, 50);
    expect(viewport.zoom).toBeLessThanOrEqual(1);
    expect(viewport.x).toBeGreaterThanOrEqual(0);
    expect(viewport.y).toBeGreaterThanOrEqual(0);
  });

  it('duplicates groups with fresh object and edge IDs', () => {
    const doc = emptyPlayground();
    const a = createPlaygroundObject('node', 0, 0);
    const b = createPlaygroundObject('node', 300, 0);
    doc.objects = [a, b];
    doc.edges = [{ id: playgroundId('edge'), from: a.id, to: b.id }];
    const result = duplicatePlaygroundObjects(doc, [a.id, b.id]);
    expect(result.copies).toHaveLength(2);
    expect(result.ids.some((id) => id === a.id || id === b.id)).toBe(false);
    expect(result.edges[0].from).toBe(result.copies[0].id);
    expect(result.edges[0].to).toBe(result.copies[1].id);
    expect(result.copies[0].x).toBe(a.x + 28);
    expect(result.copies[0]).not.toBe(a);
  });

  it('uses rectangle intersection for multi-selection', () => {
    const inside = createPlaygroundObject('text', 20, 20, { width: 80, height: 50 });
    const outside = createPlaygroundObject('text', 400, 400);
    const rect = normalizedRect({ x: 150, y: 120 }, { x: 0, y: 0 });
    expect(objectsInRect([inside, outside], rect)).toEqual([inside.id]);
  });

  it('snaps to nearby centres and returns an alignment guide', () => {
    const fixed = createPlaygroundObject('node', 100, 100, { width: 200, height: 100 });
    const moving = createPlaygroundObject('node', 302, 300, { width: 200, height: 100 });
    const aligned = alignPlaygroundObject(moving, [fixed, moving]);
    expect(aligned.x).toBe(300);
    expect(aligned.vertical).toBe(300);
  });

  it('builds a real SVG path between node ports', () => {
    const from = createPlaygroundObject('node', 0, 0, { width: 200, height: 100 });
    const to = createPlaygroundObject('node', 400, 0, { width: 200, height: 100 });
    const path = connectionPath({ from: from.id, to: to.id }, [from, to]);
    expect(path).toContain('M 200 50');
    expect(path).toContain('400 50');
  });

  it('hands real canvas content to Notes Taking in reading order', () => {
    const doc = emptyPlayground('Research');
    const later = createPlaygroundObject('todo', 0, 300, {
      text: 'Tasks',
      items: [{ id: 'task-1', text: 'Review evidence', done: true }],
    });
    const first = createPlaygroundObject('heading', 0, 0, { text: 'Study plan' });
    const middle = createPlaygroundObject('text', 0, 120, { text: 'Actual canvas writing' });
    doc.objects = [later, middle, first];
    const handoff = playgroundToNoteText(doc, 'https://niknote.test/playground?id=canvas-1');
    expect(handoff.indexOf('## Study plan')).toBeLessThan(handoff.indexOf('Actual canvas writing'));
    expect(handoff.indexOf('Actual canvas writing')).toBeLessThan(handoff.indexOf('### Tasks'));
    expect(handoff).toContain('[x] Review evidence');
    expect(handoff).toContain('Canvas reference: https://niknote.test/playground?id=canvas-1');
  });
});
