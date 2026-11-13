import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { upsertLocalNoteForOwner } from '@/lib/localNoteStore';
import { useNotebooks } from './useNotebooks';

const mocks = vi.hoisted(() => ({
  auth: { user: null as { id: string } | null, isGuest: false, loading: false },
  from: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function notebookQuery(response: Promise<unknown>) {
  type Query = {
    select: (...args: unknown[]) => Query;
    eq: (...args: unknown[]) => Query;
    order: (...args: unknown[]) => Promise<unknown>;
  };
  const query = {} as Query;
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.order = vi.fn(() => response);
  return query;
}

function cloudNotebook(id: string, userId: string) {
  return {
    id,
    user_id: userId,
    title: id,
    description: null,
    cover_color: '#2869d5',
    handwriting_model_id: null,
    page_style: 'ruled',
    page_size: 'a4',
    folder: null,
    tags: [],
    created_at: '2026-11-04T00:00:00.000Z',
    updated_at: '2026-11-04T00:00:00.000Z',
  };
}

describe('useNotebooks local-first refresh', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.auth.user = { id: 'account-notebook-test' };
    mocks.auth.isGuest = false;
    mocks.auth.loading = false;
    mocks.from.mockReset();
  });

  afterEach(cleanup);

  it('shows owner-scoped notes immediately and ignores an older cloud response', async () => {
    const ownerId = 'account-notebook-test';
    const firstResponse = deferred<{ data: unknown[]; error: null }>();
    const refreshResponse = deferred<{ data: unknown[]; error: null }>();
    const inFlightRefresh = deferred<{ data: unknown[]; error: null }>();
    const responses = [firstResponse, refreshResponse, inFlightRefresh];
    mocks.from.mockImplementation(() => notebookQuery(responses.shift()!.promise));

    upsertLocalNoteForOwner({ id: 'local-draft', title: 'Cached draft', content: 'Ready now' }, ownerId, {}, { notify: false });
    const { result } = renderHook(() => useNotebooks());

    await waitFor(() => expect(result.current.notebooks.map((note) => note.title)).toContain('Cached draft'));
    expect(result.current.loading).toBe(true);

    act(() => { void result.current.refetch(); });
    await act(async () => {
      refreshResponse.resolve({ data: [cloudNotebook('fresh-cloud-note', ownerId)], error: null });
      await refreshResponse.promise;
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.notebooks.map((note) => note.id)).toEqual(['fresh-cloud-note', 'local-draft']);

    act(() => { void result.current.refetch(); });
    expect(result.current.notebooks.map((note) => note.id)).toContain('fresh-cloud-note');
    await act(async () => {
      inFlightRefresh.resolve({ data: [cloudNotebook('latest-cloud-note', ownerId)], error: null });
      await inFlightRefresh.promise;
    });
    expect(result.current.notebooks.map((note) => note.id)).toEqual(['latest-cloud-note', 'local-draft']);

    await act(async () => {
      firstResponse.resolve({ data: [cloudNotebook('stale-cloud-note', ownerId)], error: null });
      await firstResponse.promise;
    });
    expect(result.current.notebooks.map((note) => note.id)).toEqual(['latest-cloud-note', 'local-draft']);
  });
});
