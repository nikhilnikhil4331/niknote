import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ownerId: '123e4567-e89b-42d3-a456-426614174000',
  cloudId: '323e4567-e89b-42d3-a456-426614174002',
  isMobile: false,
  cloudNotebookReads: 0,
  from: vi.fn(),
  refetchNotebooks: vi.fn().mockResolvedValue(undefined),
  updateNotebook: vi.fn().mockResolvedValue(null),
  noop: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: mocks.ownerId }, loading: false }),
  isGuestUser: () => false,
}));

vi.mock('@/contexts/HandwritingDNAContext', () => ({
  useHandwritingDNA: () => ({ dna: {}, updateDNA: mocks.noop }),
}));

vi.mock('@/hooks/useDarkMode', () => ({
  useDarkMode: () => ({ isDark: false, toggle: mocks.noop }),
}));

vi.mock('@/hooks/useNotebooks', () => ({
  useNotebooks: () => ({
    notebooks: [],
    loading: false,
    refetch: mocks.refetchNotebooks,
    updateNotebook: mocks.updateNotebook,
  }),
}));

vi.mock('@/lib/cloudSyncEngine', () => ({
  PC_ACTIVE_META_KEY: 'niknote.pc.active.v1',
  PC_ACTIVE_PAGES_KEY: 'niknote.pc.pages.v1',
  isCloudUserId: (id?: string | null) => Boolean(id && /^[0-9a-f-]{36}$/i.test(id)),
  notifyLocalDataChanged: mocks.noop,
  useCloudSyncStatus: () => ({ state: 'local', isSyncing: false, lastSyncedAt: null }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mocks.from },
}));

vi.mock('@/lib/localNoteStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/localNoteStore')>();
  return {
    ...actual,
    // Simulate a device where the cache cannot be read after a successful
    // cloud save. Promoting a draft must not need a second server read.
    findLocalNoteForOwner: vi.fn(() => null),
  };
});

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => mocks.isMobile }));
vi.mock('@/hooks/useHaptics', () => ({ useHaptics: () => ({ triggerHaptic: mocks.noop }) }));
vi.mock('@/hooks/useSoundEffects', () => ({ useSoundEffects: () => ({ playSuccess: mocks.noop }) }));
vi.mock('@/hooks/useSpeechDictation', () => ({
  useSpeechDictation: () => ({ isSupported: false, isListening: false, start: mocks.noop, stop: mocks.noop }),
}));
vi.mock('@/hooks/usePremium', () => ({ usePremium: () => ({ isPremium: true, loading: false }) }));
vi.mock('@/hooks/useDiagrams', () => ({
  useDiagrams: () => ({ diagrams: [], addDiagram: mocks.noop, removeDiagram: mocks.noop, updateDiagram: mocks.noop, clearDiagrams: mocks.noop }),
}));
vi.mock('@/hooks/useTableData', () => ({ useTableData: () => ({ tableData: [], updateTableData: mocks.noop, resetTableData: mocks.noop }) }));

vi.mock('@/components/workspace/DirectWritingWorkspace', () => ({
  DirectWritingWorkspace: ({ blocks, onBlocksChange, onColorChange, isMobile, saveStatus }: {
    blocks: Array<{ id: string; content: string; color?: string }>;
    onBlocksChange: (blocks: Array<{ id: string; content: string; color?: string }>) => void;
    onColorChange: (color: 'blue') => void;
    isMobile: boolean;
    saveStatus: string;
  }) => {
    const firstBlock = blocks[0];
    return (
      <section>
        <output data-testid="device-mode">{isMobile ? 'mobile' : 'desktop'}</output>
        <textarea
          aria-label="Note content"
          value={firstBlock?.content || ''}
          onChange={(event) => onBlocksChange(blocks.map((block, index) =>
            index === 0 ? { ...block, content: event.target.value } : block,
          ))}
        />
        <button
          type="button"
          onClick={() => {
            onBlocksChange(blocks.map((block, index) => index === 0 ? { ...block, color: 'blue' } : block));
            onColorChange('blue');
          }}
        >
          Change ink to blue
        </button>
        <output data-testid="save-status">{saveStatus}</output>
      </section>
    );
  },
}));

vi.mock('@/components/SlidePanel', () => ({ SlidePanel: () => null }));
vi.mock('@/components/premium/PaywallModal', () => ({ PaywallModal: () => null }));
vi.mock('@/components/ai-workspace/AIWorkspacePanel', () => ({ AIWorkspacePanel: () => null }));
vi.mock('@/components/command-palette/CommandPalette', () => ({ CommandPalette: () => null }));

import Index from '@/pages/Index';
import { notebookPagesStorageKey } from '@/hooks/useNotebookPages';
import { readLocalNotesForOwner } from '@/lib/localNoteStore';

function RoutedEditor() {
  const { documentId = 'new' } = useParams();
  return <Index routeDocumentId={documentId} />;
}

function CurrentPath() {
  const location = useLocation();
  return <output data-testid="current-path">{location.pathname}</output>;
}

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={['/editor/new']}>
      <CurrentPath />
      <Routes>
        <Route path="/editor/:documentId" element={<RoutedEditor />} />
      </Routes>
    </MemoryRouter>,
  );
}

type MockSupabaseQuery = {
  select: (columns?: string) => MockSupabaseQuery;
  eq: (column: string, value: unknown) => MockSupabaseQuery;
  order: (column: string, options?: unknown) => MockSupabaseQuery;
  insert: (value: unknown) => MockSupabaseQuery;
  update: (value: unknown) => MockSupabaseQuery;
  maybeSingle: () => Promise<{ data: { id: string; updated_at: string } | null; error: null }>;
  single: () => Promise<{ data: { id: string; updated_at: string }; error: null }>;
  then: (
    resolve: (value: { data: unknown[]; error: null }) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

beforeEach(() => {
  localStorage.clear();
  mocks.isMobile = false;
  mocks.cloudNotebookReads = 0;
  mocks.refetchNotebooks.mockClear();
  mocks.updateNotebook.mockClear();
  mocks.noop.mockClear();
  mocks.from.mockReset();
  mocks.from.mockImplementation((table: string) => {
    let selectedColumns = '';
    const query = {} as MockSupabaseQuery;
    Object.assign(query, {
      select: vi.fn((columns = '') => {
        selectedColumns = columns;
        if (table === 'notebooks' && columns === '*') mocks.cloudNotebookReads += 1;
        return query;
      }),
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      insert: vi.fn(() => query),
      update: vi.fn(() => query),
      maybeSingle: vi.fn(() => {
        if (table === 'notebooks' && selectedColumns === '*') {
          return new Promise<{ data: { id: string; updated_at: string } | null; error: null }>(() => {});
        }
        return Promise.resolve({ data: { id: mocks.cloudId, updated_at: new Date().toISOString() }, error: null });
      }),
      single: vi.fn(() => Promise.resolve({
        data: { id: table === 'notebooks' ? mocks.cloudId : '323e4567-e89b-42d3-a456-426614174003', updated_at: new Date().toISOString() },
        error: null,
      })),
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve, reject),
    });
    return query;
  });
});

describe('editor draft-to-cloud promotion', () => {
  it.each([
    { device: 'desktop', isMobile: false },
    { device: 'mobile', isMobile: true },
  ])('keeps edited text open after changing ink on $device', async ({ isMobile }) => {
    mocks.isMobile = isMobile;
    renderEditor();

    const content = 'My note stays open after changing color';
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Note content' })).toBeInTheDocument());
    fireEvent.change(screen.getByRole('textbox', { name: 'Note content' }), { target: { value: content } });
    fireEvent.click(screen.getByRole('button', { name: 'Change ink to blue' }));

    await waitFor(() => {
      expect(screen.getByTestId('current-path')).toHaveTextContent(`/editor/${mocks.cloudId}`);
      expect(screen.getByRole('textbox', { name: 'Note content' })).toHaveValue(content);
    }, { timeout: 5000 });

    expect(screen.getByTestId('device-mode')).toHaveTextContent(isMobile ? 'mobile' : 'desktop');
    expect(screen.queryByText('Opening your note…')).not.toBeInTheDocument();
    expect(mocks.cloudNotebookReads).toBe(0);

    const savedNote = readLocalNotesForOwner(mocks.ownerId).find((note) => note.id === mocks.cloudId);
    expect(savedNote?.blocks?.[0]).toMatchObject({ content, color: 'blue' });
    expect(localStorage.getItem(notebookPagesStorageKey(mocks.ownerId, mocks.cloudId))).not.toBeNull();
  });
});
