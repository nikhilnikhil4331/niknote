import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayground } from '@/hooks/usePlayground';
import { createPlaygroundObject } from '@/lib/playground';

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
  beforeEach(() => localStorage.clear());

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
