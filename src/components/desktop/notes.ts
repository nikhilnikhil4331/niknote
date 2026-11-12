// ============================================================
// NikNote Desktop — unified notes data layer
// Merges cloud notebooks (Supabase via useNotebooks) with local
// device notes (same storage keys the mobile experience uses),
// so desktop shows exactly the same notes and opens the editor
// through the exact same, production-proven handoff.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNotebooks, type Notebook } from '@/hooks/useNotebooks';
import { useNoteMeta } from '@/components/desktop/store';
import { createBlock, type Block } from '@/types/block';
import { blocksFromNoteText } from '@/lib/noteTemplates';
import type { HandwritingFont, InkColor } from '@/types/notes';
import { notifyLocalDataChanged } from '@/lib/cloudSyncEngine';
import {
  findLocalNoteForOwner,
  readLocalNotesForOwner,
  removeLocalNoteForOwner,
  upsertLocalNoteForOwner,
  type LocalNoteRecord,
} from '@/lib/localNoteStore';

export const TRASH_FOLDER = '__trash__';

export interface DNote {
  id: string;
  title: string;
  folder: string | null;
  tags: string[];
  cover: string;
  style: string;
  updatedAt: string;
  createdAt: string;
  isLocal: boolean;
  trashed: boolean;
  preview: string; // first bit of text for paper previews (local notes)
  raw: Notebook | null;
  localBlocks?: Block[];
  font?: HandwritingFont;
  inkColor?: InkColor;
}

const COVER_PALETTE = ['#d4b128', '#67804e', '#b98237', '#bc6e54', '#8b7950', '#79908a', '#a87555', '#a58b43'];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COVER_PALETTE[h % COVER_PALETTE.length];
}

type LocalDeviceNotebook = LocalNoteRecord & {
  blocks?: Block[];
  font?: HandwritingFont;
  ink_color?: InkColor;
};

function readLocalDeviceNotes(ownerId: string | null | undefined, allowLegacyClaim = false): LocalDeviceNotebook[] {
  return readLocalNotesForOwner(ownerId, { allowLegacyClaim }) as LocalDeviceNotebook[];
}

function patchLocalNote(id: string, ownerId: string | null | undefined, patch: Partial<LocalDeviceNotebook>) {
  const current = findLocalNoteForOwner(id, ownerId);
  if (!current || !ownerId) return;
  upsertLocalNoteForOwner({ ...current, ...patch }, ownerId);
  notifyLocalDataChanged();
}

function removeLocalNote(id: string, ownerId: string | null | undefined) {
  removeLocalNoteForOwner(id, ownerId);
  notifyLocalDataChanged();
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export function isGuestUser(user: { id?: string } | null | undefined): boolean {
  return !user || String(user.id || '').startsWith('local-guest-');
}

export function useDesktopNotes() {
  const { user } = useAuth();
  const { setPrevFolder } = useNoteMeta();
  const ownerId = user?.id || null;
  const localOwnerId = ownerId || 'local-device-guest';
  const guest = isGuestUser(user);
  const navigate = useNavigate();
  const {
    notebooks,
    loading,
    createNotebook,
    updateNotebook,
    deleteNotebook,
    refetch,
  } = useNotebooks();

  const [localTick, setLocalTick] = useState(0);
  const refreshLocal = useCallback(() => setLocalTick((t) => t + 1), []);

  useEffect(() => {
    const onStorage = () => refreshLocal();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshLocal]);

  const notes: DNote[] = useMemo(() => {
    void localTick;
    const out: DNote[] = [];
    const seen = new Set<string>();

    for (const nb of notebooks as Notebook[]) {
      if (!nb?.id || seen.has(nb.id)) continue;
      seen.add(nb.id);
      out.push({
        id: nb.id,
        title: nb.title || 'Untitled Note',
        folder: nb.folder ?? null,
        tags: Array.isArray(nb.tags) ? nb.tags : [],
        cover: nb.cover_color || colorFor(nb.id),
        style: nb.page_style || 'ruled',
        updatedAt: nb.updated_at,
        createdAt: nb.created_at,
        isLocal: guest, // useNotebooks already serves local rows for guests
        trashed: nb.folder === TRASH_FOLDER || !!(nb as { trashedAt?: string | null }).trashedAt,
        preview: nb.description || '',
        raw: nb,
      });
    }

    // Local-first/offline records are always filtered by the active workspace owner.
    for (const ln of readLocalDeviceNotes(ownerId, guest)) {
      if (!ln.id || seen.has(ln.id)) continue;
      seen.add(ln.id);
      const blocks = Array.isArray(ln.blocks) ? ln.blocks : undefined;
      out.push({
        id: ln.id,
        title: ln.title || 'Untitled Note',
        folder: ln.folder ?? null,
        tags: Array.isArray(ln.tags) ? ln.tags : [],
        cover: ln.cover_color || colorFor(ln.id),
        style: ln.page_style || 'ruled',
        updatedAt: ln.updated_at || ln.updatedAt || new Date().toISOString(),
        createdAt: ln.created_at || ln.updated_at || new Date().toISOString(),
        isLocal: true,
        trashed: !!ln.trashedAt || ln.folder === TRASH_FOLDER,
        preview: ln.content || (blocks ? blocks.map((b) => b.content).filter(Boolean).join('\n') : ''),
        raw: null,
        localBlocks: blocks,
        font: ln.font,
        inkColor: ln.ink_color,
      });
    }

    return out.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [notebooks, guest, ownerId, localTick]);

  const active = useMemo(() => notes.filter((n) => !n.trashed), [notes]);
  const trashed = useMemo(() => notes.filter((n) => n.trashed), [notes]);

  // ---- Open in editor (same handoff as MobileExperience) ----
  const openNote = useCallback(
    async (note: DNote) => {
      if (!note.isLocal && note.raw) {
        const { data, error } = await supabase
          .from('pages')
          .select('content')
          .eq('notebook_id', note.id)
          .eq('user_id', user?.id || '')
          .order('page_number')
          .limit(1);
        if (error) {
          toast.error('Could not open note');
          return;
        }
        const content = data?.[0]?.content;
        sessionStorage.setItem(
          'niknote-mobile-open',
          JSON.stringify({
            ownerId: user?.id,
            title: note.title,
            blocks: Array.isArray(content) && content.length ? content : [createBlock()],
            notebookId: note.id,
            style: note.style,
          }),
        );
        navigate(`/editor/${encodeURIComponent(note.id)}`);
        return;
      }
      sessionStorage.setItem(
        'niknote-mobile-open',
        JSON.stringify({
          ownerId: user?.id,
          title: note.title,
          blocks: note.localBlocks?.length ? note.localBlocks : blocksFromNoteText(note.preview || ''),
          notebookId: note.id,
          style: note.style,
          font: note.font,
          inkColor: note.inkColor,
        }),
      );
      navigate(`/editor/${encodeURIComponent(note.id)}`);
    },
    [navigate, user?.id],
  );

  /** Open a brand-new editor draft (optionally seeded with template/sample text). */
  const openNew = useCallback(
    (opts?: { title?: string; text?: string; style?: string; font?: HandwritingFont; inkColor?: InkColor }) => {
      if (opts?.text !== undefined || opts?.title) {
        sessionStorage.setItem(
          'niknote-mobile-open',
          JSON.stringify({
            ownerId: user?.id,
            title: opts?.title || 'Untitled Note',
            blocks: blocksFromNoteText(opts?.text || ''),
            style: opts?.style,
            font: opts?.font,
            inkColor: opts?.inkColor,
          }),
        );
        navigate('/editor/new');
      } else {
        navigate('/editor/new');
      }
    },
    [navigate, user?.id],
  );

  // ---- Create (persists immediately, then caller may open) ----
  const createNote = useCallback(
    async (input: { title: string; folder?: string | null; tags?: string[]; cover?: string; style?: string }): Promise<DNote | null> => {
      const cover = input.cover || COVER_PALETTE[Math.floor(Math.random() * COVER_PALETTE.length)];
      if (!guest) {
        const nb = await createNotebook({
          title: input.title || 'Untitled Note',
          folder: input.folder || null,
          tags: input.tags || [],
          cover_color: cover,
          page_style: input.style || 'ruled',
        });
        if (!nb) return null;
        return {
          id: nb.id, title: nb.title, folder: nb.folder ?? null, tags: nb.tags || [],
          cover: nb.cover_color || cover, style: nb.page_style || 'ruled',
          updatedAt: nb.updated_at, createdAt: nb.created_at,
          isLocal: false, trashed: false, preview: '', raw: nb,
        };
      }
      const now = new Date().toISOString();
      const entry: LocalDeviceNotebook = {
        id: newId(),
        title: input.title || 'Untitled Note',
        blocks: [createBlock()],
        page_style: input.style || 'ruled',
        folder: input.folder || null,
        cover_color: cover,
        tags: input.tags || [],
        created_at: now,
        updated_at: now,
        _ownerId: localOwnerId,
      };
      upsertLocalNoteForOwner(entry, localOwnerId);
      notifyLocalDataChanged();
      refreshLocal();
      await refetch();
      toast.success('Note created');
      return {
        id: entry.id, title: entry.title!, folder: entry.folder ?? null, tags: entry.tags || [],
        cover, style: entry.page_style!, updatedAt: now, createdAt: now,
        isLocal: true, trashed: false, preview: '', raw: null, localBlocks: entry.blocks,
      };
    },
    [guest, localOwnerId, createNotebook, refreshLocal, refetch],
  );

  const renameNote = useCallback(
    async (note: DNote, title: string) => {
      const clean = title.trim();
      if (!clean) return;
      if (note.isLocal) {
        patchLocalNote(note.id, localOwnerId, { title: clean, updated_at: new Date().toISOString() });
        refreshLocal();
        await refetch();
      } else {
        await updateNotebook(note.id, { title: clean });
      }
      toast.success('Renamed');
    },
    [updateNotebook, refreshLocal, refetch, localOwnerId],
  );

  const moveToSpace = useCallback(
    async (note: DNote, folder: string | null) => {
      if (note.isLocal) {
        patchLocalNote(note.id, localOwnerId, { folder, updated_at: new Date().toISOString() });
        refreshLocal();
        await refetch();
      } else {
        await updateNotebook(note.id, { folder });
      }
    },
    [updateNotebook, refreshLocal, refetch, localOwnerId],
  );

  const trashNote = useCallback(
    async (note: DNote) => {
      if (note.trashed) return;
      setPrevFolder(note.id, note.folder);
      if (note.isLocal) {
        patchLocalNote(note.id, localOwnerId, { trashedAt: new Date().toISOString() });
        refreshLocal();
        await refetch();
      } else {
        await updateNotebook(note.id, { folder: TRASH_FOLDER });
      }
      toast.success('Moved to Trash');
    },
    [updateNotebook, refreshLocal, refetch, localOwnerId, setPrevFolder],
  );

  const restoreNote = useCallback(
    async (note: DNote, prevFolder: string | null) => {
      if (note.isLocal) {
        patchLocalNote(note.id, localOwnerId, { trashedAt: null, folder: prevFolder });
        refreshLocal();
        await refetch();
      } else {
        await updateNotebook(note.id, { folder: prevFolder });
      }
      toast.success('Restored');
    },
    [updateNotebook, refreshLocal, refetch, localOwnerId],
  );

  const deleteForever = useCallback(
    async (note: DNote) => {
      if (note.isLocal) {
        removeLocalNote(note.id, localOwnerId);
        refreshLocal();
        await refetch();
        toast.success('Deleted forever');
      } else {
        await deleteNotebook(note.id);
      }
    },
    [deleteNotebook, refreshLocal, refetch, localOwnerId],
  );

  return {
    user, guest, loading, notes, active, trashed,
    openNote, openNew, createNote, renameNote, moveToSpace, trashNote, restoreNote, deleteForever,
  };
}
