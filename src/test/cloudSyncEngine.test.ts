import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: mockSupabase }));

import { ownerScopedStorageKey } from '@/lib/ownerScopedStorage';
import {
  getSyncSnapshot,
  updateSyncSnapshot,
  useCloudSyncStatus,
  syncAllLocalDataToCloud,
  syncLocalMoneyToCloud,
  syncLocalNotesWithCloud,
  syncLocalRoutineToCloud,
} from '@/lib/cloudSyncEngine';

type Query = {
  table: string;
  action: string;
  payload: unknown;
  filters: Array<[string, unknown]>;
};

type QueryHandler = (query: Query) => unknown | Promise<unknown>;
type QueryBuilder = {
  insert(payload: unknown): QueryBuilder;
  update(payload: unknown): QueryBuilder;
  upsert(payload: unknown): QueryBuilder;
  delete(): QueryBuilder;
  select(): QueryBuilder;
  single(): QueryBuilder;
  maybeSingle(): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  in(column: string, value: unknown): QueryBuilder;
  order(column: string, value: unknown): QueryBuilder;
  limit(value: unknown): QueryBuilder;
  range(start: number, end: number): QueryBuilder;
  then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown): Promise<unknown>;
};

function installQueryHandler(handler: QueryHandler) {
  mockSupabase.from.mockImplementation((table: string) => {
    const query: Query = { table, action: 'select', payload: null, filters: [] };
    const builder = {} as QueryBuilder;
    Object.assign(builder, {
      insert(payload: unknown) { query.action = 'insert'; query.payload = payload; return builder; },
      update(payload: unknown) { query.action = 'update'; query.payload = payload; return builder; },
      upsert(payload: unknown) { query.action = 'upsert'; query.payload = payload; return builder; },
      delete() { query.action = 'delete'; return builder; },
      select() { return builder; },
      single() { return builder; },
      maybeSingle() { return builder; },
      eq(column: string, value: unknown) { query.filters.push([column, value]); return builder; },
      in(column: string, value: unknown) { query.filters.push([column, value]); return builder; },
      order(column: string, value: unknown) { query.filters.push([`order:${column}`, value]); return builder; },
      limit(value: unknown) { query.filters.push(['limit', value]); return builder; },
      range(start: number, end: number) { query.filters.push(['range', [start, end]]); return builder; },
      then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
        return Promise.resolve(handler(query)).then(resolve, reject);
      },
    });
    return builder;
  });
}

const USER_ID = '123e4567-e89b-42d3-a456-426614174000';
const CLOUD_NOTE_ID = '223e4567-e89b-42d3-a456-426614174001';
const LOCAL_UUID = '323e4567-e89b-42d3-a456-426614174002';
const cloudNotebook = (id = CLOUD_NOTE_ID) => ({
  id,
  title: 'Local note',
  cover_color: '#8b5cf6',
  page_style: 'ruled',
  page_size: 'a4',
  tags: ['Notes'],
  updated_at: '2026-11-07T10:00:00.000Z',
});

function save(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function saved<T>(key: string): T {
  return JSON.parse(localStorage.getItem(key) || 'null') as T;
}

describe('cloud sync safety and retry behavior', () => {
  beforeEach(() => {
    localStorage.clear();
    mockSupabase.from.mockReset();
    const emptyStatus = { state: 'local' as const, lastSyncedAt: null, syncedCount: 0, errorMessage: null };
    updateSyncSnapshot(emptyStatus, USER_ID);
    updateSyncSnapshot(emptyStatus, '223e4567-e89b-42d3-a456-426614174099');
    updateSyncSnapshot(emptyStatus);
  });

  it('keeps sync snapshots, listeners, and last-sync timestamps isolated by account', () => {
    const otherUserId = '223e4567-e89b-42d3-a456-426614174099';
    const ownerAStamp = '2026-11-07T10:00:00.000Z';
    const ownerBStamp = '2026-11-08T10:00:00.000Z';
    const { result, rerender } = renderHook(({ ownerId }) => useCloudSyncStatus(ownerId), {
      initialProps: { ownerId: USER_ID as string | null },
    });

    act(() => updateSyncSnapshot({ state: 'synced', lastSyncedAt: ownerAStamp, syncedCount: 4 }, USER_ID));
    expect(result.current).toMatchObject({ state: 'synced', lastSyncedAt: ownerAStamp, syncedCount: 4 });

    act(() => updateSyncSnapshot({ state: 'error', lastSyncedAt: ownerBStamp, errorMessage: 'owner B issue' }, otherUserId));
    expect(result.current).toMatchObject({ state: 'synced', lastSyncedAt: ownerAStamp, errorMessage: null });
    expect(getSyncSnapshot(otherUserId)).toMatchObject({ state: 'error', lastSyncedAt: ownerBStamp, errorMessage: 'owner B issue' });

    rerender({ ownerId: otherUserId });
    expect(result.current).toMatchObject({ state: 'error', lastSyncedAt: ownerBStamp, errorMessage: 'owner B issue' });
    expect(localStorage.getItem(ownerScopedStorageKey('niknote.sync.last_at.v1', USER_ID))).toBe(ownerAStamp);
    expect(localStorage.getItem(ownerScopedStorageKey('niknote.sync.last_at.v1', otherUserId))).toBe(ownerBStamp);
    expect(localStorage.getItem('niknote.sync.last_at.v1')).toBeNull();
  });

  it('does not mark a note synced after a page write fails, and retries that upload', async () => {
    save('niknote.mobile.notebooks.v1', [{
      id: 'local-note-1',
      _ownerId: USER_ID,
      title: 'Local note',
      blocks: [{ id: 'b1', type: 'text', content: 'keep me' }],
      updated_at: '2026-11-07T10:00:00.000Z',
    }]);
    let pageInsertAttempts = 0;
    installQueryHandler(({ table, action }) => {
      if (table === 'notebooks' && action === 'insert') return { data: cloudNotebook(), error: null };
      if (table === 'notebooks' && action === 'select') return { data: cloudNotebook(), error: null };
      if (table === 'pages' && action === 'select') return { data: [], error: null };
      if (table === 'pages' && action === 'insert') {
        pageInsertAttempts++;
        return pageInsertAttempts === 1
          ? { data: null, error: { message: 'temporary page failure' } }
          : { data: { id: 'page-1' }, error: null };
      }
      return { data: null, error: null };
    });

    await expect(syncLocalNotesWithCloud(USER_ID, { pullCloud: false })).rejects.toThrow('Page upload failed');
    const afterFailure = saved<Array<Record<string, unknown>>>('niknote.mobile.notebooks.v1')[0];
    expect(afterFailure._syncedAt).toBeUndefined();
    expect(afterFailure.id).toBe('local-note-1');
    expect(saved<Record<string, string>>(ownerScopedStorageKey('niknote.sync.notebook_map.v1', USER_ID))['local-note-1']).toBe(CLOUD_NOTE_ID);

    const moved = await syncLocalNotesWithCloud(USER_ID, { pullCloud: false });
    expect(moved).toBe(1);
    expect(pageInsertAttempts).toBe(2);
    const afterRetry = saved<Array<Record<string, unknown>>>('niknote.mobile.notebooks.v1')[0];
    expect(afterRetry.id).toBe(CLOUD_NOTE_ID);
    expect(afterRetry._syncedAt).toBeTruthy();
  });

  it('never uploads an unowned legacy note into the signed-in account', async () => {
    save('niknote.mobile.notebooks.v1', [{
      id: 'legacy-unowned-note',
      title: 'Unclaimed device note',
      blocks: [{ id: 'b1', type: 'text', content: 'keep private' }],
    }]);
    const calls: Query[] = [];
    installQueryHandler((query) => {
      calls.push({ ...query, filters: [...query.filters] });
      return { data: null, error: null };
    });

    await expect(syncLocalNotesWithCloud(USER_ID, { pullCloud: false })).resolves.toBe(0);
    expect(calls.filter((query) => query.table === 'notebooks' && query.action === 'insert')).toHaveLength(0);
    expect(saved<Array<Record<string, unknown>>>('niknote.mobile.notebooks.v1')[0]._ownerId).toBeUndefined();
  });

  it('treats a locally generated UUID as a new note unless cloud ownership is confirmed', async () => {
    save('niknote.mobile.notebooks.v1', [{
      id: LOCAL_UUID,
      _ownerId: USER_ID,
      title: 'UUID local note',
      blocks: [{ id: 'b1', type: 'text', content: 'new' }],
      updated_at: '2026-11-07T10:00:00.000Z',
    }]);
    const notebookCalls: Query[] = [];
    installQueryHandler((query) => {
      if (query.table === 'notebooks') {
        notebookCalls.push({ ...query, filters: [...query.filters] });
        if (query.action === 'select') return { data: null, error: null };
        if (query.action === 'insert') return { data: cloudNotebook(), error: null };
      }
      if (query.table === 'pages' && query.action === 'select') return { data: [], error: null };
      if (query.table === 'pages' && query.action === 'insert') return { data: { id: 'page-1' }, error: null };
      return { data: null, error: null };
    });

    await expect(syncLocalNotesWithCloud(USER_ID, { pullCloud: false })).resolves.toBe(1);
    expect(notebookCalls.some((query) => query.action === 'insert')).toBe(true);
    expect(notebookCalls.some((query) => query.action === 'update')).toBe(true);
    expect(saved<Array<Record<string, unknown>>>('niknote.mobile.notebooks.v1')[0].id).toBe(CLOUD_NOTE_ID);
  });

  it('preserves star, parent, creation-time, and trashed-note metadata while syncing content', async () => {
    const createdAt = '2025-02-03T04:05:06.000Z';
    save('niknote.notes.v1', [
      {
        id: 'source-note-1', _ownerId: USER_ID, title: 'Keep metadata', content: 'local text', starred: true,
        tags: ['Exam'], parentId: 'local-folder-1', trashedAt: null, createdAt, updatedAt: createdAt,
      },
      {
        id: 'trash-note-1', _ownerId: USER_ID, title: 'In trash', content: 'restore later', starred: false,
        tags: ['Old'], parentId: null, trashedAt: createdAt, createdAt, updatedAt: createdAt,
      },
    ]);
    save('niknote.mobile.notebooks.v1', []);
    installQueryHandler(({ table, action }) => {
      if (table === 'notebooks' && action === 'insert') return { data: cloudNotebook(), error: null };
      if (table === 'pages' && action === 'select') return { data: [], error: null };
      if (table === 'pages' && action === 'insert') return { data: { id: 'page-1' }, error: null };
      return { data: null, error: null };
    });

    await syncLocalNotesWithCloud(USER_ID, { pullCloud: false });
    const notes = saved<Array<Record<string, unknown>>>('niknote.notes.v1');
    const active = notes.find((note) => note.id === CLOUD_NOTE_ID);
    const trashed = notes.find((note) => note.id === 'trash-note-1');
    expect(active).toMatchObject({ starred: true, parentId: 'local-folder-1', createdAt, tags: ['Exam'] });
    expect(trashed).toMatchObject({ trashedAt: createdAt, content: 'restore later', createdAt });
    expect(notes).toHaveLength(2);
  });

  it('pulls a newer cloud page into a clean local mirror instead of retaining stale content', async () => {
    const lastSync = '2026-11-06T10:00:00.000Z';
    save('niknote.mobile.notebooks.v1', [{
      id: CLOUD_NOTE_ID,
      title: 'Old title',
      blocks: [{ id: 'old', type: 'text', content: 'stale' }],
      updated_at: lastSync,
      _syncedAt: lastSync,
    }]);
    installQueryHandler(({ table, action }) => {
      if (table === 'notebooks' && action === 'select') {
        return { data: [cloudNotebook()], error: null };
      }
      if (table === 'pages' && action === 'select') {
        return { data: [{
          notebook_id: CLOUD_NOTE_ID,
          title: 'Remote title',
          content: [{ id: 'remote', type: 'text', content: 'fresh from cloud' }],
          page_number: 1,
          updated_at: '2026-11-07T10:00:03.000Z',
        }], error: null };
      }
      return { data: null, error: null };
    });

    await syncLocalNotesWithCloud(USER_ID, { pullCloud: true });
    const local = saved<Array<Record<string, unknown>>>('niknote.mobile.notebooks.v1')[0];
    expect(local.title).toBe('Local note');
    expect(local.blocks[0].content).toBe('fresh from cloud');
    expect(local._syncedAt).toBe('2026-11-07T10:00:03.000Z');
  });

  it('uploads edited content across every owned cloud page without deleting page rows', async () => {
    save('niknote.mobile.notebooks.v1', [{
      id: CLOUD_NOTE_ID,
      _ownerId: USER_ID,
      title: 'Multi-page note',
      blocks: [
        { id: 'new-1', type: 'text', content: 'one' },
        { id: 'new-2', type: 'text', content: 'two' },
        { id: 'new-3', type: 'text', content: 'three' },
      ],
      updated_at: '2026-11-07T10:00:00.000Z',
    }]);
    const pageRows = [
      { id: 'page-2', notebook_id: CLOUD_NOTE_ID, page_number: 2, content: [{ id: 'old-2', type: 'text', content: 'old two' }, { id: 'old-3', type: 'text', content: 'old three' }], updated_at: '2026-11-06T10:00:00.000Z' },
      { id: 'page-1', notebook_id: CLOUD_NOTE_ID, page_number: 1, content: [{ id: 'old-1', type: 'text', content: 'old one' }], updated_at: '2026-11-06T10:00:00.000Z' },
    ];
    const pageUpdates: Array<{ id: string; content: Array<{ id: string }> }> = [];
    const nonUpdatePageActions: string[] = [];
    installQueryHandler((query) => {
      if (query.table === 'notebooks' && query.action === 'select') return { data: cloudNotebook(), error: null };
      if (query.table === 'pages' && query.action === 'select') return { data: pageRows, error: null };
      if (query.table === 'pages' && query.action === 'update') {
        const id = query.filters.find(([column]) => column === 'id')?.[1] as string;
        pageUpdates.push({ id, content: (query.payload as { content: Array<{ id: string }> }).content });
        return { data: { id }, error: null };
      }
      if (query.table === 'pages') nonUpdatePageActions.push(query.action);
      return { data: null, error: null };
    });

    await expect(syncLocalNotesWithCloud(USER_ID, { pullCloud: false })).resolves.toBe(1);
    expect(pageUpdates.map((page) => [page.id, page.content.map((item) => item.id)])).toEqual([
      ['page-1', ['new-1']],
      ['page-2', ['new-2', 'new-3']],
    ]);
    expect(nonUpdatePageActions).toEqual([]);
  });

  it('combines every remote page when pulling a newer cloud note', async () => {
    const lastSync = '2026-11-06T10:00:00.000Z';
    const pageRows = [
      { id: 'page-1', notebook_id: CLOUD_NOTE_ID, title: 'Remote title', content: [{ id: 'remote-1', type: 'text', content: 'first page' }], page_number: 1, updated_at: '2026-11-07T10:00:02.000Z' },
      { id: 'page-2', notebook_id: CLOUD_NOTE_ID, title: 'Remote title', content: [{ id: 'remote-2', type: 'text', content: 'second page' }], page_number: 2, updated_at: '2026-11-07T10:00:03.000Z' },
    ];
    save('niknote.mobile.notebooks.v1', [{
      id: CLOUD_NOTE_ID,
      _ownerId: USER_ID,
      title: 'Old title',
      blocks: [{ id: 'old', type: 'text', content: 'stale' }],
      updated_at: lastSync,
      _syncedAt: lastSync,
    }]);
    installQueryHandler((query) => {
      if (query.table === 'notebooks' && query.action === 'select') {
        const isOwnedLookup = query.filters.some(([column]) => column === 'id');
        return { data: isOwnedLookup ? cloudNotebook() : [cloudNotebook()], error: null };
      }
      if (query.table === 'pages' && query.action === 'select') return { data: pageRows, error: null };
      return { data: null, error: null };
    });

    await syncLocalNotesWithCloud(USER_ID, { pullCloud: true });
    const local = saved<Array<Record<string, unknown>>>('niknote.mobile.notebooks.v1')[0];
    const blocks = local.blocks as Array<{ id: string }>;
    expect(blocks.map((item) => item.id)).toEqual(['remote-1', 'remote-2']);
    expect(local._syncedAt).toBe('2026-11-07T10:00:03.000Z');
  });

  it('keeps currency and budget settings queued when the settings upsert fails', async () => {
    const moneyKey = ownerScopedStorageKey('niknote.money.v1.local', USER_ID);
    save(moneyKey, { currency: 'EUR', budget: 250, txs: [], goals: [], bills: [] });
    installQueryHandler(({ table, action }) =>
      table === 'tracker_settings' && action === 'upsert'
        ? { data: null, error: { message: 'settings unavailable' } }
        : { data: null, error: null }
    );

    await expect(syncLocalMoneyToCloud(USER_ID)).rejects.toThrow('Money settings upload failed');
    expect(saved<Record<string, unknown>>(moneyKey)).toMatchObject({ currency: 'EUR', budget: 250 });
  });

  it('clears only successful routine categories and preserves the failed queue', async () => {
    const routineKey = ownerScopedStorageKey('niknote.routine.v1.local', USER_ID);
    save(routineKey, {
      habits: [{ id: 'habit-1', name: 'Read' }],
      checks: [{ habit_id: 'habit-1', day: '2026-11-07' }],
      todos: [{ id: 'todo-1', title: 'Review', done: false }],
      week: { '2026-11-07': { water: 4, sleep_hours: 7 } },
      waterGoal: 9,
    });
    installQueryHandler(({ table, action }) =>
      table === 'habit_checks' && action === 'upsert'
        ? { data: null, error: { message: 'check upsert failed' } }
        : { data: null, error: null }
    );

    await expect(syncLocalRoutineToCloud(USER_ID)).rejects.toThrow('Habit check upload failed');
    expect(saved<Record<string, unknown>>(routineKey)).toMatchObject({
      habits: [],
      checks: [{ habit_id: 'habit-1', day: '2026-11-07' }],
      todos: [],
      week: {},
      waterGoal: 9,
      _synced: false,
    });
  });

  it('reports partial sync failure instead of setting the global status to synced', async () => {
    save('niknote.mobile.notebooks.v1', []);
    save('niknote.notes.v1', []);
    save('niknote.money.v1.local', {});
    save('niknote.routine.v1.local', {});
    save('niknote.boards.v1.local', []);
    installQueryHandler(({ table, action }) =>
      table === 'notebooks' && action === 'select'
        ? { data: null, error: { message: 'cloud unavailable' } }
        : { data: null, error: null }
    );

    const result = await syncAllLocalDataToCloud(USER_ID, { pullCloud: true });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('cloud unavailable');
    expect(getSyncSnapshot(USER_ID).state).toBe('error');
    expect(getSyncSnapshot(USER_ID).lastSyncedAt).toBeNull();
  });
});
