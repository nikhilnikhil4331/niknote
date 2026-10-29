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
import { createBlock, type Block } from '@/types/block';
import { blocksFromNoteText } from '@/lib/noteTemplates';
import { notifyLocalDataChanged } from '@/lib/cloudSyncEngine';

export const TRASH_FOLDER = '__trash__';
const LOCAL_KEY_A = 'niknote.mobile.notebooks.v1';
const LOCAL_KEY_B = 'niknote.notes.v1';

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
}

const COVER_PALETTE = ['#7C6CF0', '#3B82F6', '#F59E0B', '#EC4899', '#10B981', '#06B6D4', '#F26D8D', '#8B5CF6'];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COVER_PALETTE[h % COVER_PALETTE.length];
}

interface LocalDeviceNotebook {
  id: string;
  title?: string;
  blocks?: Block[];
  content?: string;
  page_style?: string;
  folder?: string | null;
  cover_color?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  updatedAt?: string;
  trashedAt?: string | null;
}

function readLocalList(key: string): LocalDeviceNotebook[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeLocalList(key: string, list: LocalDeviceNotebook[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function readLocalDeviceNotes(): LocalDeviceNotebook[] {
  const map = new Map<string, LocalDeviceNotebook>();
  for (const n of readLocalList(LOCAL_KEY_A)) if (n?.id) map.set(n.id, n);
  for (const n of readLocalList(LOCAL_KEY_B)) if (n?.id && !map.has(n.id)) map.set(n.id, n);
  return Array.from(map.values());
}

function patchLocalNote(id: string, patch: Partial<LocalDeviceNotebook>) {
  for (const key of [LOCAL_KEY_A, LOCAL_KEY_B]) {
    const list = readLocalList(key);
    if (list.some((x) => x.id === id)) {
      writeLocalList(key, list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    }
  }
  notifyLocalDataChanged();
}

function removeLocalNote(id: string) {
  for (const key of [LOCAL_KEY_A, LOCAL_KEY_B]) {
    writeLocalList(key, readLocalList(key).filter((x) => x.id !== id));
  }
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

    // Local device notes not already surfaced by useNotebooks
    // (cloud users may also have device-only notes created by mobile/AI).
    for (const ln of readLocalDeviceNotes()) {
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
      });
    }

    return out.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [notebooks, guest, localTick]);

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
            title: note.title,
            blocks: Array.isArray(content) && content.length ? content : [createBlock()],
            notebookId: note.id,
            style: note.style,
          }),
        );
        navigate(`/?editor=1&notebook=${note.id}`);
        return;
      }
      sessionStorage.setItem(
        'niknote-mobile-open',
        JSON.stringify({
          title: note.title,
          blocks: note.localBlocks?.length ? note.localBlocks : blocksFromNoteText(note.preview || ''),
          notebookId: note.id,
          style: note.style,
        }),
      );
      navigate(`/?editor=1&notebook=${note.id}`);
    },
    [navigate],
  );

  /** Open a brand-new editor draft (optionally seeded with template/sample text). */
  const openNew = useCallback(
    (opts?: { title?: string; text?: string; style?: string }) => {
      if (opts?.text !== undefined || opts?.title) {
        sessionStorage.setItem(
          'niknote-mobile-open',
          JSON.stringify({
            title: opts?.title || 'Untitled Note',
            blocks: blocksFromNoteText(opts?.text || ''),
            style: opts?.style,
          }),
        );
        navigate('/?editor=1');
      } else {
        navigate('/?editor=1&new=1');
      }
    },
    [navigate],
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
      };
      writeLocalList(LOCAL_KEY_A, [entry, ...readLocalList(LOCAL_KEY_A)]);
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
    [guest, createNotebook, refreshLocal, refetch],
  );

  const renameNote = useCallback(
    async (note: DNote, title: string) => {
      const clean = title.trim();
      if (!clean) return;
      if (note.isLocal) {
        patchLocalNote(note.id, { title: clean, updated_at: new Date().toISOString() });
        refreshLocal();
        await refetch();
      } else {
        await updateNotebook(note.id, { title: clean });
      }
      toast.success('Renamed');
    },
    [updateNotebook, refreshLocal, refetch],
  );

  const moveToSpace = useCallback(
    async (note: DNote, folder: string | null) => {
      if (note.isLocal) {
        patchLocalNote(note.id, { folder, updated_at: new Date().toISOString() });
        refreshLocal();
        await refetch();
      } else {
        await updateNotebook(note.id, { folder });
      }
    },
    [updateNotebook, refreshLocal, refetch],
  );

  const trashNote = useCallback(
    async (note: DNote) => {
      if (note.isLocal) {
        patchLocalNote(note.id, { trashedAt: new Date().toISOString() });
        refreshLocal();
        await refetch();
      } else {
        await updateNotebook(note.id, { folder: TRASH_FOLDER });
      }
      toast.success('Moved to Trash');
    },
    [updateNotebook, refreshLocal, refetch],
  );

  const restoreNote = useCallback(
    async (note: DNote, prevFolder: string | null) => {
      if (note.isLocal) {
        patchLocalNote(note.id, { trashedAt: null, folder: prevFolder });
        refreshLocal();
        await refetch();
      } else {
        await updateNotebook(note.id, { folder: prevFolder });
      }
      toast.success('Restored');
    },
    [updateNotebook, refreshLocal, refetch],
  );

  const deleteForever = useCallback(
    async (note: DNote) => {
      if (note.isLocal) {
        removeLocalNote(note.id);
        refreshLocal();
        await refetch();
        toast.success('Deleted forever');
      } else {
        await deleteNotebook(note.id);
      }
    },
    [deleteNotebook, refreshLocal, refetch],
  );

  return {
    user, guest, loading, notes, active, trashed,
    openNote, openNew, createNote, renameNote, moveToSpace, trashNote, restoreNote, deleteForever,
  };
}

// Starter samples shown when the workspace is empty (click opens the real editor).
export const SAMPLE_NOTES = [
  { id: 'sample-bio', title: 'Biology Class Notes', cover: '#10B981', tag: 'Biology', text: '# Photosynthesis\nProcess by which green plants make their own food using sunlight.\n## Equation\n6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂\n## Key Points\n• Requires sunlight\n• Occurs in chloroplasts\n• Produces glucose (food)\n• Releases oxygen' },
  { id: 'sample-ml', title: 'Machine Learning', cover: '#EC4899', tag: 'AI/ML', text: '# Machine Learning\nML helps computers learn patterns from data.\n• Supervised learning\n• Unsupervised learning\n• Reinforcement learning' },
  { id: 'sample-project', title: 'Project Plan', cover: '#3B82F6', tag: 'Work', text: '# Project Plan\n## The goal\nShip the first version by the end of the month.\n## Milestones\n[] Design final\n[] Build MVP\n[] Launch' },
  { id: 'sample-math', title: 'Math Formulas', cover: '#F59E0B', tag: 'Maths', text: '# Math Formulas\n## Algebra\n(a+b)² = a² + 2ab + b²\n(a−b)² = a² − 2ab + b²\n## Trigonometry\nsin²θ + cos²θ = 1' },
  { id: 'sample-travel', title: 'Travel Plan', cover: '#06B6D4', tag: 'Personal', text: '# Travel Plan\n## Places to visit\n• Mussoorie\n• Rishikesh\n• Haridwar\n## Packing\n[] Camera\n[] Notebook\n[] Snacks' },
  { id: 'sample-dream', title: 'Dream Ideas', cover: '#8B5CF6', tag: 'Ideas', text: '# Dream Ideas\nSmall ideas can become meaningful projects.\n• Capture one idea every day\n• Review on Sundays\n• Build the best one' },
];
