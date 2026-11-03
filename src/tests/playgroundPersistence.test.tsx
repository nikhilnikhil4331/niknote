import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayground } from '@/hooks/usePlayground';
import { createPlaygroundObject } from '@/lib/playground';
import { PLAYGROUND_NOTE_IMPORT_KEY } from '@/lib/playgroundNoteImport';
import { createBlock } from '@/types/block';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

function wrapper(route = '/playground') {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>;
  };
}

describe('playground history and persistence', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

  it('undoes and redoes complete document states', async () => {
    const { result } = renderHook(() => usePlayground(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.ready).toBe(true));
    const original = result.current.doc.title;

    act(() => result.current.apply((draft) => { draft.title = 'First revision'; }));
    act(() => result.current.apply((draft) => { draft.title = 'Second revision'; }));
    expect(result.current.canUndo).toBe(true);

    let undone = false;
    act(() => { undone = result.current.undo(); });
    expect(undone).toBe(true);
    expect(result.current.doc.title).toBe('First revision');

    act(() => { undone = result.current.redo(); });
    expect(result.current.doc.title).toBe('Second revision');
    expect(result.current.doc.title).not.toBe(original);
  });

  it('flushes the latest draft before Notes Taking navigation', async () => {
    const { result } = renderHook(() => usePlayground(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.ready).toBe(true));
    const id = result.current.doc.id;
    act(() => result.current.apply((draft) => { draft.title = 'Latest unsaved keystroke'; }));

    let flushed = false;
    act(() => { flushed = result.current.flushLocal(); });
    expect(flushed).toBe(true);
    expect(localStorage.getItem(`niknote.playground.doc.v1.device.${id}`)).toContain('Latest unsaved keystroke');
  });

  it('saves the current draft before creating another canvas', async () => {
    const { result } = renderHook(() => usePlayground(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.ready).toBe(true));
    const originalId = result.current.doc.id;
    act(() => result.current.apply((draft) => { draft.title = 'Draft before new canvas'; }));
    act(() => { result.current.createCanvas(); });
    expect(localStorage.getItem(`niknote.playground.doc.v1.device.${originalId}`)).toContain('Draft before new canvas');
  });

  it('imports Notes Taking as a new canvas without replacing existing work', async () => {
    const first = renderHook(() => usePlayground(), { wrapper: wrapper() });
    await waitFor(() => expect(first.result.current.ready).toBe(true));
    const originalId = first.result.current.doc.id;
    first.unmount();

    sessionStorage.setItem(PLAYGROUND_NOTE_IMPORT_KEY, JSON.stringify({
      title: 'Imported lesson',
      noteId: 'note-1',
      blocks: [createBlock('heading1', 'Chapter'), createBlock('text', 'Real imported writing')],
    }));
    const second = renderHook(() => usePlayground(), { wrapper: wrapper() });
    await waitFor(() => expect(second.result.current.ready).toBe(true));
    expect(second.result.current.doc.title).toBe('Imported lesson · Playground');
    expect(second.result.current.doc.id).not.toBe(originalId);
    expect(second.result.current.index).toHaveLength(2);
    expect(second.result.current.doc.objects.some((object) => object.text === 'Real imported writing')).toBe(true);
    expect(localStorage.getItem(`niknote.playground.doc.v1.device.${originalId}`)).toBeTruthy();
  });

  it('updates pan and zoom without cloning or reconciling canvas objects', async () => {
    const { result } = renderHook(() => usePlayground(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.apply((draft) => {
      draft.objects = [
        createPlaygroundObject('node', 20, 30, { id: 'smooth-from' }),
        createPlaygroundObject('node', 420, 160, { id: 'smooth-to' }),
      ];
      draft.edges = [{ id: 'smooth-edge', from: 'smooth-from', to: 'smooth-to' }];
    }));
    const before = result.current.doc;

    act(() => result.current.updateViewport({ x: -180, y: 95, zoom: 1.4 }));

    expect(result.current.doc.viewport).toEqual({ x: -180, y: 95, zoom: 1.4 });
    expect(result.current.doc.objects).toBe(before.objects);
    expect(result.current.doc.objects[0]).toBe(before.objects[0]);
    expect(result.current.doc.edges).toBe(before.edges);
    expect(result.current.doc.updatedAt).toBe(before.updatedAt);
  });

  it('keeps unchanged object references and protects nested history during fast edits', async () => {
    const { result } = renderHook(() => usePlayground(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.apply((draft) => {
      draft.objects = [
        createPlaygroundObject('drawing', 10, 20, { id: 'draft-drawing', points: [{ x: 1, y: 2 }] }),
        createPlaygroundObject('text', 300, 200, { id: 'unchanged-text', text: 'Keep my reference' }),
      ];
    }));
    const before = result.current.doc;
    act(() => result.current.beginTransaction());
    act(() => result.current.apply((draft) => {
      draft.objects[0].points![0].x = 99;
    }, { record: false }));

    expect(result.current.doc.objects[0].points![0].x).toBe(99);
    expect(result.current.doc.objects[1]).toBe(before.objects[1]);
    act(() => { result.current.undo(); });
    expect(result.current.doc.objects[0].points![0].x).toBe(1);
    expect(result.current.doc.objects[1].text).toBe('Keep my reference');
  });

  it('restores content, object geometry, connections and theme after a reload', async () => {
    const first = renderHook(() => usePlayground(), { wrapper: wrapper() });
    await waitFor(() => expect(first.result.current.ready).toBe(true));
    const id = first.result.current.doc.id;

    act(() => first.result.current.apply((draft) => {
      draft.title = 'Persistent research';
      draft.theme = 'dark';
      const from = createPlaygroundObject('node', 120, 180, { id: 'persist-from', width: 222, height: 111, rotation: 15 });
      const to = createPlaygroundObject('node', 500, 240, { id: 'persist-to' });
      draft.objects = [from, to];
      draft.edges = [{ id: 'persist-edge', from: from.id, to: to.id, label: 'feeds' }];
      draft.viewport = { x: -240, y: 90, zoom: 1.35 };
    }));

    await waitFor(() => {
      const raw = localStorage.getItem(`niknote.playground.doc.v1.device.${id}`);
      expect(raw).toBeTruthy();
      expect(raw).toContain('Persistent research');
    }, { timeout: 2500 });
    first.unmount();

    const second = renderHook(() => usePlayground(), { wrapper: wrapper(`/playground?id=${id}`) });
    await waitFor(() => expect(second.result.current.ready).toBe(true));
    expect(second.result.current.doc.title).toBe('Persistent research');
    expect(second.result.current.doc.theme).toBe('dark');
    expect(second.result.current.doc.objects[0]).toMatchObject({ id: 'persist-from', x: 120, y: 180, width: 222, height: 111, rotation: 15 });
    expect(second.result.current.doc.edges[0]).toMatchObject({ id: 'persist-edge', label: 'feeds' });
    expect(second.result.current.doc.viewport).toEqual({ x: -240, y: 90, zoom: 1.35 });
  });
});
