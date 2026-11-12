import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { useDesktopNotes } from '@/components/desktop/notes';
import { useNoteMeta } from '@/components/desktop/store';
import { upsertLocalNoteForOwner } from '@/lib/localNoteStore';
import { supabase } from '@/integrations/supabase/client';

const OWNER_ID = 'local-guest-desktop-trash-test';
const NOTE_ID = 'desktop-trash-restore-test';

function DesktopTrashHarness() {
  const { active, trashed, trashNote, restoreNote, openNote } = useDesktopNotes();
  const { meta } = useNoteMeta();
  const { pathname } = useLocation();
  const note = active.find((item) => item.id === NOTE_ID);
  const deleted = trashed.find((item) => item.id === NOTE_ID);

  return (
    <main>
      <button type="button" disabled={!note} onClick={() => note && void trashNote(note)}>Move note to Trash</button>
      <button type="button" disabled={!note} onClick={() => note && void openNote(note)}>Open note</button>
      <button
        type="button"
        disabled={!deleted}
        onClick={() => deleted && void restoreNote(deleted, meta[NOTE_ID]?.prevFolder ?? null)}
      >
        Restore note
      </button>
      <output data-testid="active-note">{note ? `${note.title}|${note.folder ?? ''}` : ''}</output>
      <output data-testid="trashed-note">{deleted ? deleted.title : ''}</output>
      <output data-testid="current-route">{pathname}</output>
    </main>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(supabase.auth, 'signInAnonymously').mockResolvedValue({
    data: { user: null, session: null },
    error: new Error('Anonymous auth is disabled in this test'),
  } as unknown as Awaited<ReturnType<typeof supabase.auth.signInAnonymously>>);
  localStorage.setItem('niknote.offline.guest.v1', JSON.stringify({
    id: OWNER_ID,
    is_anonymous: true,
    email: '',
    user_metadata: { is_guest: true, is_local_guest: true, full_name: 'Test Guest' },
  }));
  upsertLocalNoteForOwner({
    id: NOTE_ID,
    title: 'Folder recovery note',
    folder: 'Science',
    content: 'Keep this note in Science after restore.',
  }, OWNER_ID);
});

describe('desktop Trash previous-folder recovery', () => {
  it('stores the previous folder when Home moves a local note to Trash and restores it', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/home']}>
          <DesktopTrashHarness />
        </MemoryRouter>
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('active-note')).toHaveTextContent('Folder recovery note|Science'));
    fireEvent.click(screen.getByRole('button', { name: 'Move note to Trash' }));
    await waitFor(() => expect(screen.getByTestId('trashed-note')).toHaveTextContent('Folder recovery note'));

    fireEvent.click(screen.getByRole('button', { name: 'Restore note' }));
    await waitFor(() => expect(screen.getByTestId('active-note')).toHaveTextContent('Folder recovery note|Science'));
    expect(screen.getByTestId('trashed-note')).toBeEmptyDOMElement();

    fireEvent.click(screen.getByRole('button', { name: 'Open note' }));
    await waitFor(() => expect(screen.getByTestId('current-route')).toHaveTextContent(`/editor/${NOTE_ID}`));
    expect(JSON.parse(sessionStorage.getItem('niknote-mobile-open') || '{}')).toMatchObject({ notebookId: NOTE_ID, title: 'Folder recovery note' });
  });
});
