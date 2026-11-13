import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: mockSupabase }));

import { KnowledgeEngine } from './KnowledgeEngine';

type Query = {
  table: string;
  action: string;
  payload: unknown;
  filters: Array<[string, unknown]>;
};

type QueryBuilder = {
  upsert(payload: unknown): QueryBuilder;
  select(columns: string): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  order(column: string, options: unknown): QueryBuilder;
  range(start: number, end: number): QueryBuilder;
  then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown): Promise<unknown>;
};

type QueryHandler = (query: Query) => unknown | Promise<unknown>;

function installQueryHandler(handler: QueryHandler) {
  mockSupabase.from.mockImplementation((table: string) => {
    const query: Query = { table, action: 'select', payload: null, filters: [] };
    const builder = {} as QueryBuilder;
    Object.assign(builder, {
      upsert(payload: unknown) { query.action = 'upsert'; query.payload = payload; return builder; },
      select() { query.action = 'select'; return builder; },
      eq(column: string, value: unknown) { query.filters.push([column, value]); return builder; },
      order(column: string, value: unknown) { query.filters.push([`order:${column}`, value]); return builder; },
      range(start: number, end: number) { query.filters.push(['range', [start, end]]); return builder; },
      then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
        return Promise.resolve(handler(query)).then(resolve, reject);
      },
    });
    return builder;
  });
}

const USER_ID = '123e4567-e89b-42d3-a456-426614174000';

describe('KnowledgeEngine Supabase persistence', () => {
  beforeEach(() => mockSupabase.from.mockReset());

  it('stores and restores knowledge documents through the owner-scoped schema', async () => {
    const engine = new KnowledgeEngine();
    await engine.ingestDocument({
      id: 'doc-1',
      title: 'Newton’s laws',
      content: 'Newton laws describe motion and force.',
      type: 'note',
      source: 'writing-workspace',
    });

    const queries: Query[] = [];
    installQueryHandler((query) => {
      queries.push({ ...query, filters: [...query.filters] });
      return { data: null, error: null };
    });
    await engine.saveToSupabase(USER_ID);

    const saved = queries.find((query) => query.action === 'upsert');
    expect(saved?.table).toBe('knowledge_documents');
    expect(saved?.payload).toMatchObject({
      id: `${USER_ID}::doc-1`,
      user_id: USER_ID,
      title: 'Newton’s laws',
      content: 'Newton laws describe motion and force.',
      document_type: 'note',
      source: 'writing-workspace',
    });
    const savedMetadata = (saved?.payload as { metadata: Record<string, unknown> }).metadata;
    expect(savedMetadata.__niknote_document_id).toBe('doc-1');
    expect(queries.some((query) => query.table === 'notebook_pages')).toBe(false);

    const restored = new KnowledgeEngine();
    installQueryHandler((query) => ({
      data: query.table === 'knowledge_documents' && query.action === 'select'
        ? [saved?.payload]
        : null,
      error: null,
    }));
    await restored.loadFromSupabase(USER_ID);
    await restored.loadFromSupabase(USER_ID);

    const exported = JSON.parse(restored.exportAsJSON()) as { documents: Array<{ id: string; title: string; content: string }> };
    expect(exported.documents).toHaveLength(1);
    expect(exported.documents[0]).toMatchObject({
      id: 'doc-1',
      title: 'Newton’s laws',
      content: 'Newton laws describe motion and force.',
    });
    expect(restored.getKnowledgeGraph().nodes.filter((node) => node.id === 'doc-1')).toHaveLength(1);
  });

  it('does not try to persist local guest identities as cloud owners', async () => {
    const engine = new KnowledgeEngine();
    await engine.saveToSupabase('local-guest-device');
    await engine.loadFromSupabase('local-guest-device');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
