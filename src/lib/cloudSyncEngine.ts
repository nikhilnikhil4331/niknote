import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createBlock, type Block } from '@/types/block';
import type { Json } from '@/integrations/supabase/types';
import type { NoteSettings } from '@/types/notes';
import { readLocalNotesForOwner, removeLocalNoteForOwner, upsertLocalNoteForOwner, type LocalNoteRecord } from '@/lib/localNoteStore';
import { blocksFromNotebookCloudPages, orderNotebookCloudPages, partitionNotebookBlocks, type NotebookCloudPage } from '@/lib/notebookCloudPages';

export type CloudSyncState = 'synced' | 'syncing' | 'local' | 'offline' | 'error';

export interface SyncSnapshot {
  state: CloudSyncState;
  lastSyncedAt: string | null;
  syncedCount: number;
  errorMessage: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOTEBOOK_MAP_KEY = 'niknote.sync.notebook_map.v1';
const BOARD_MAP_KEY = 'niknote.sync.board_map.v1';
const LAST_SYNC_KEY = 'niknote.sync.last_at.v1';
export const PC_ACTIVE_PAGES_KEY = 'niknote.pc.active_pages.v1';
export const PC_ACTIVE_META_KEY = 'niknote.pc.active_meta.v1';

type CloudNotebook = {
  id: string;
  title?: string | null;
  cover_color?: string | null;
  page_style?: string | null;
  page_size?: string | null;
  settings?: unknown;
  tags?: unknown;
  folder?: string | null;
  updated_at?: string | null;
};

type CloudPage = NotebookCloudPage & {
  notebook_id: string;
};

type LocalMoneyTransaction = {
  id: string;
  kind?: string;
  amount: number | string;
  category?: string;
  note?: string;
  occurred_on?: string;
  account?: string;
  to_account?: string | null;
};

type LocalMoneyGoal = {
  id: string;
  name: string;
  target: number | string;
  saved?: number | string;
};

type LocalMoneyBill = {
  id: string;
  name: string;
  amount: number | string;
  due_day: number | string;
  last_paid_month?: string | null;
};

type LocalHabit = {
  id: string;
  name: string;
  emoji?: string;
  block?: string;
  days?: number[];
  archived?: boolean;
};

type LocalRoutineTodo = {
  id: string;
  title: string;
  done?: boolean;
  priority?: string;
  position?: number;
};

type LocalWellnessDay = {
  water?: number | string;
  sleep_hours?: number | string;
  exercise_minutes?: number | string;
  mood?: string;
  pomodoros?: number | string;
};

type LocalBoard = {
  id: string;
  title?: string;
  data?: Json;
};

export function isCloudUserId(uid?: string | null): uid is string {
  return Boolean(uid && UUID_RE.test(uid));
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

// ── Reactive Sync Snapshot Store ──
let currentSnapshot: SyncSnapshot = {
  state: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'local',
  lastSyncedAt: typeof window !== 'undefined' ? localStorage.getItem(LAST_SYNC_KEY) : null,
  syncedCount: 0,
  errorMessage: null,
};

const listeners = new Set<(snap: SyncSnapshot) => void>();

export const CLOUD_SYNC_EVENT = 'niknote:local-data-changed';

export function notifyLocalDataChanged() {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(CLOUD_SYNC_EVENT));
  } catch {
    // ignore in non-DOM test environments
  }
}

export function updateSyncSnapshot(patch: Partial<SyncSnapshot>) {
  currentSnapshot = { ...currentSnapshot, ...patch };
  if (patch.lastSyncedAt && typeof window !== 'undefined') {
    try {
      localStorage.setItem(LAST_SYNC_KEY, patch.lastSyncedAt);
    } catch {
      // ignore
    }
  }
  listeners.forEach((fn) => fn(currentSnapshot));
}

export function getSyncSnapshot(): SyncSnapshot {
  return currentSnapshot;
}

export function useCloudSyncStatus(userId?: string | null) {
  const [snap, setSnap] = useState<SyncSnapshot>(() => ({
    ...currentSnapshot,
    state:
      typeof navigator !== 'undefined' && navigator.onLine === false
        ? 'offline'
        : isCloudUserId(userId) && currentSnapshot.lastSyncedAt
          ? 'synced'
          : currentSnapshot.state,
  }));

  useEffect(() => {
    const onChange = (next: SyncSnapshot) => setSnap(next);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      if (isCloudUserId(userId)) {
        void syncAllLocalDataToCloud(userId);
      } else {
        updateSyncSnapshot({ state: 'local', errorMessage: null });
      }
    };
    const handleOffline = () => {
      updateSyncSnapshot({ state: 'offline' });
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [userId]);

  const syncNow = useCallback(async () => {
    if (!isCloudUserId(userId)) {
      return { synced: 0, ok: false, error: 'Waiting for cloud session' };
    }
    return syncAllLocalDataToCloud(userId, { pullCloud: true });
  }, [userId]);

  return { ...snap, syncNow };
}

// ── 1. Sync Mobile & Smart Notes <-> public.notebooks + public.pages ──
export async function syncLocalNotesWithCloud(
  userId: string,
  opts: { pullCloud?: boolean } = {}
): Promise<number> {
  if (!isCloudUserId(userId)) return 0;

  const mapKey = `${NOTEBOOK_MAP_KEY}:${userId}`;
  const idMap = {
    ...readJson<Record<string, string>>(NOTEBOOK_MAP_KEY, {}),
    ...readJson<Record<string, string>>(mapKey, {}),
  };
  let localNotes = readLocalNotesForOwner(userId);
  let moved = 0;
  let localMutated = false;
  const failures: string[] = [];

  const errorText = (error: unknown, fallback: string) => {
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) {
      return error.message;
    }
    return fallback;
  };
  const toMillis = (value: unknown) => {
    const millis = typeof value === 'string' ? Date.parse(value) : NaN;
    return Number.isFinite(millis) ? millis : 0;
  };
  const blocksFor = (note: LocalNoteRecord): Block[] => {
    if (Array.isArray(note.blocks)) return note.blocks;
    const text = String(note.content || '');
    return text.split('\n').filter(Boolean).map((line) => createBlock('text', line));
  };
  const ownedNotebook = async (id: string) => {
    const { data, error } = await supabase
      .from('notebooks')
      .select('id, title, cover_color, page_style, page_size, settings, folder, tags, updated_at')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    return { data: (data || null) as CloudNotebook | null, error };
  };
  const storeOwnedNote = (note: LocalNoteRecord, oldId?: string) => {
    if (oldId && oldId !== note.id) {
      removeLocalNoteForOwner(oldId, userId, { notify: false });
      idMap[oldId] = note.id;
    }
    upsertLocalNoteForOwner({
      ...note,
      cloud_id: note.cloud_id || note.id,
      ...(oldId && oldId !== note.id ? { source_id: oldId } : {}),
      _ownerId: userId,
      user_id: userId,
    }, userId, {}, { notify: false });
    const index = localNotes.findIndex((row) => row.id === (oldId || note.id));
    if (index >= 0) {
      localNotes = localNotes.filter((_, rowIndex) => rowIndex !== index);
    }
    localNotes = [
      { ...note, _ownerId: userId, user_id: userId },
      ...localNotes.filter((row) => row.id !== note.id),
    ];
    localMutated = true;
  };

  // Upload only notes explicitly tagged to this owner. Unmarked legacy notes
  // are never swept into an arbitrary signed-in account by the sync engine.
  for (const original of [...localNotes]) {
    if (!original.id || original.trashedAt) continue;
    const rawId = String(original.id);
    const mappedId = idMap[rawId];
    const linkedCloudId = typeof original.cloud_id === 'string' ? original.cloud_id : null;
    const candidateIds = [...new Set([mappedId, linkedCloudId, isCloudUserId(rawId) ? rawId : null].filter((id): id is string => Boolean(id)))];
    let cloudId: string | null = null;
    let notebook: CloudNotebook | null = null;
    let lookupFailed = false;

    for (const candidate of candidateIds) {
      const lookup = await ownedNotebook(candidate);
      if (lookup.error) {
        failures.push(`Notebook lookup failed: ${errorText(lookup.error, 'cloud request failed')}`);
        lookupFailed = true;
        cloudId = null;
        notebook = null;
        break;
      }
      if (lookup.data?.id) {
        cloudId = lookup.data.id;
        notebook = lookup.data;
        break;
      }
      // A stale map or UUID from another account is not ownership evidence.
      if (mappedId === candidate) delete idMap[rawId];
    }
    if (lookupFailed) continue;

    if (!cloudId) {
      if (original._syncedAt) {
        failures.push('A previously synced notebook is not available to this account; the local copy was kept.');
        continue;
      }
      const { data: created, error } = await supabase
        .from('notebooks')
        .insert({
          user_id: userId,
          title: original.title || 'Untitled Note',
          cover_color: original.cover_color || '#8b5cf6',
          page_style: original.page_style || 'ruled',
          page_size: original.page_size || 'a4',
          ...(original.settings && typeof original.settings === 'object' ? { settings: original.settings as unknown as Json } : {}),
          folder: original.folder ?? (original.trashedAt ? '__trash__' : null),
          tags: Array.isArray(original.tags) ? original.tags : ['Notes'],
        })
        .select('id, title, cover_color, page_style, page_size, settings, folder, tags, updated_at')
        .single();
      if (error || !created?.id) {
        failures.push(`Notebook upload failed: ${errorText(error, 'cloud returned no notebook ID')}`);
        continue;
      }
      cloudId = String(created.id);
      notebook = created as CloudNotebook;
      idMap[rawId] = cloudId;
    }

    const { data: pageRows, error: pageReadError } = await supabase
      .from('pages')
      .select('id, title, content, page_number, updated_at')
      .eq('notebook_id', cloudId)
      .eq('user_id', userId)
      .order('page_number', { ascending: true })
      .order('id', { ascending: true });
    if (pageReadError) {
      failures.push(`Page lookup failed: ${errorText(pageReadError, 'cloud request failed')}`);
      continue;
    }
    const existingPages = orderNotebookCloudPages(Array.isArray(pageRows) ? pageRows as CloudPage[] : []);
    const existingPage = existingPages[0];
    const syncedAt = toMillis(original._syncedAt);
    const remoteUpdatedAt = Math.max(
      toMillis(notebook?.updated_at),
      ...existingPages.map((page) => toMillis(page.updated_at)),
    );
    const localChanged = Boolean(original._syncedAt && original._syncedAt !== original.updated_at);
    const remoteChanged = syncedAt > 0 && remoteUpdatedAt > syncedAt;
    const remoteBlocks = blocksFromNotebookCloudPages(existingPages);

    if (remoteChanged && !localChanged && existingPage) {
      const stamp = new Date(remoteUpdatedAt).toISOString();
      storeOwnedNote({
        ...original,
        id: cloudId,
        title: notebook?.title || existingPage.title || original.title || 'Untitled Note',
        blocks: remoteBlocks.length ? remoteBlocks : [createBlock('text', '')],
        cover_color: notebook?.cover_color || original.cover_color,
        page_style: notebook?.page_style || original.page_style,
        page_size: notebook?.page_size || original.page_size,
        ...(notebook?.settings && typeof notebook.settings === 'object' ? { settings: notebook.settings as Partial<NoteSettings> } : {}),
        folder: notebook?.folder ?? original.folder ?? null,
        tags: Array.isArray(notebook?.tags) ? notebook.tags as string[] : original.tags,
        updated_at: stamp,
        _syncedAt: stamp,
      }, rawId !== cloudId ? rawId : undefined);
      continue;
    }
    if (remoteChanged && localChanged) {
      failures.push('A note changed on this device and another device; local edits were kept instead of overwriting cloud data.');
      continue;
    }
    if (original._syncedAt && !localChanged && !remoteChanged) {
      if (rawId !== cloudId) {
        storeOwnedNote({ ...original, id: cloudId, _syncedAt: original._syncedAt }, rawId);
      }
      continue;
    }

    const cloudFields = {
      title: original.title || 'Untitled Note',
      cover_color: original.cover_color || '#8b5cf6',
      page_style: original.page_style || 'ruled',
      page_size: original.page_size || 'a4',
      ...(original.settings && typeof original.settings === 'object' ? { settings: original.settings as unknown as Json } : {}),
      folder: original.folder ?? (original.trashedAt ? '__trash__' : null),
      tags: Array.isArray(original.tags) ? original.tags : ['Notes'],
    };
    if (notebook?.id) {
      const { error } = await supabase
        .from('notebooks')
        .update(cloudFields)
        .eq('id', cloudId)
        .eq('user_id', userId);
      if (error) {
        failures.push(`Notebook update failed: ${errorText(error, 'cloud request failed')}`);
        continue;
      }
    }

    const blocks = blocksFor(original);
    const stamp = new Date().toISOString();
    let pageWriteError: unknown = null;
    if (existingPages.length) {
      const pageContents = partitionNotebookBlocks(blocks, existingPages);
      for (let index = 0; index < existingPages.length; index++) {
        const page = existingPages[index];
        if (!page.id) {
          pageWriteError = new Error('Cloud page is missing its ID.');
          break;
        }
        const result = await supabase
          .from('pages')
          .update({ title: cloudFields.title, content: pageContents[index] as unknown as Json, updated_at: stamp })
          .eq('id', page.id)
          .eq('notebook_id', cloudId)
          .eq('user_id', userId)
          .select('id')
          .maybeSingle();
        if (result.error || !result.data?.id) {
          pageWriteError = result.error || new Error('Cloud page is no longer available to this account.');
          break;
        }
      }
    } else {
      const result = await supabase.from('pages').insert({
        notebook_id: cloudId,
        user_id: userId,
        page_number: 1,
        title: cloudFields.title,
        content: blocks as unknown as Json,
        updated_at: stamp,
      }).select('id').single();
      pageWriteError = result.error || (!result.data?.id ? new Error('Cloud returned no page ID.') : null);
    }
    if (pageWriteError) {
      failures.push(`Page upload failed: ${errorText(pageWriteError, 'cloud request failed')}`);
      continue;
    }

    storeOwnedNote({
      ...original,
      ...cloudFields,
      settings: original.settings,
      id: cloudId,
      user_id: userId,
      _ownerId: userId,
      updated_at: stamp,
      _syncedAt: stamp,
    }, rawId !== cloudId ? rawId : undefined);
    idMap[rawId] = cloudId;
    moved++;
  }

  // Pull only rows belonging to the active owner and merge them into that
  // owner's local cache. Existing local drafts for every other owner stay put.
  if (opts.pullCloud !== false) {
    const cloudNotebooks: CloudNotebook[] = [];
    const batchSize = 200;
    const maximumRows = 5000;
    for (let offset = 0; offset < maximumRows; offset += batchSize) {
      const { data, error } = await supabase
        .from('notebooks')
        .select('id, title, cover_color, page_style, page_size, settings, folder, tags, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + batchSize - 1);
      if (error) {
        failures.push(`Notebook pull failed: ${errorText(error, 'cloud request failed')}`);
        break;
      }
      const rows = Array.isArray(data) ? data as CloudNotebook[] : [];
      cloudNotebooks.push(...rows);
      if (rows.length < batchSize) break;
      if (offset + batchSize >= maximumRows) {
        failures.push('Notebook pull reached the safe 5,000-row limit; remaining cloud notebooks were not loaded.');
      }
    }

    const pagesByNotebook = new Map<string, CloudPage[]>();
    const ids = cloudNotebooks.map((notebook) => notebook.id).filter(Boolean);
    for (let offset = 0; offset < ids.length; offset += 100) {
      const pageIds = ids.slice(offset, offset + 100);
      const { data: cloudPages, error } = await supabase
        .from('pages')
        .select('notebook_id, title, content, page_number, updated_at')
        .in('notebook_id', pageIds)
        .eq('user_id', userId)
        .order('page_number', { ascending: true });
      if (error) {
        failures.push(`Page pull failed: ${errorText(error, 'cloud request failed')}`);
        continue;
      }
      for (const page of cloudPages || []) {
        const rows = pagesByNotebook.get(page.notebook_id) || [];
        rows.push(page as CloudPage);
        pagesByNotebook.set(page.notebook_id, rows);
      }
    }

    for (const notebook of cloudNotebooks) {
      const cloudId = notebook.id;
      if (!cloudId) continue;
      const remotePages = orderNotebookCloudPages(pagesByNotebook.get(cloudId) || []);
      const page = remotePages[0];
      const remoteMillis = Math.max(
        toMillis(notebook.updated_at),
        ...remotePages.map((remotePage) => toMillis(remotePage.updated_at)),
      );
      const remoteStamp = remoteMillis ? new Date(remoteMillis).toISOString() : notebook.updated_at || new Date().toISOString();
      const mappedLocalId = Object.keys(idMap).find((localId) => idMap[localId] === cloudId);
      const existing = localNotes.find((note) => note.id === cloudId || note.id === mappedLocalId);
      const loadedBlocks = blocksFromNotebookCloudPages(remotePages);
      const remoteBlocks = loadedBlocks.length ? loadedBlocks : [createBlock('text', '')];

      if (!existing) {
        storeOwnedNote({
          id: cloudId,
          user_id: userId,
          _ownerId: userId,
          title: notebook.title || page?.title || 'Untitled Note',
          blocks: remoteBlocks,
          content: remoteBlocks.map((block) => block.content || '').join('\n'),
          cover_color: notebook.cover_color || '#8b5cf6',
          page_style: notebook.page_style || 'ruled',
          page_size: notebook.page_size || 'a4',
          ...(notebook.settings && typeof notebook.settings === 'object' ? { settings: notebook.settings as Partial<NoteSettings> } : {}),
          folder: notebook.folder ?? null,
          tags: Array.isArray(notebook.tags) ? notebook.tags as string[] : ['Notes'],
          updated_at: remoteStamp,
          _syncedAt: remoteStamp,
        });
        continue;
      }

      const localStamp = toMillis(existing._syncedAt);
      const clean = Boolean(existing._syncedAt && existing._syncedAt === existing.updated_at);
      if (clean && remoteMillis > localStamp && page) {
        storeOwnedNote({
          ...existing,
          id: cloudId,
          user_id: userId,
          _ownerId: userId,
          title: notebook.title || page.title || existing.title || 'Untitled Note',
          blocks: remoteBlocks,
          content: remoteBlocks.map((block) => block.content || '').join('\n'),
          cover_color: notebook.cover_color || existing.cover_color,
          page_style: notebook.page_style || existing.page_style || 'ruled',
          page_size: notebook.page_size || existing.page_size || 'a4',
          ...(notebook.settings && typeof notebook.settings === 'object' ? { settings: notebook.settings as Partial<NoteSettings> } : {}),
          folder: notebook.folder ?? existing.folder ?? null,
          tags: Array.isArray(notebook.tags) ? notebook.tags as string[] : existing.tags || ['Notes'],
          updated_at: remoteStamp,
          _syncedAt: remoteStamp,
        }, existing.id !== cloudId ? existing.id : undefined);
      }
    }
  }

  writeJson(mapKey, idMap);
  if (localMutated) notifyLocalDataChanged();
  if (failures.length) {
    throw new Error(`Notes sync incomplete (${failures.length} issue${failures.length === 1 ? '' : 's'}): ${failures[0]}`);
  }
  return moved;
}

// ── 2. Sync Money Tracker Local Queue -> Cloud ──
export async function syncLocalMoneyToCloud(userId: string): Promise<number> {
  if (!isCloudUserId(userId)) return 0;
  const local = readJson<{
    txs?: LocalMoneyTransaction[];
    goals?: LocalMoneyGoal[];
    bills?: LocalMoneyBill[];
    currency?: string;
    budget?: number;
  }>('niknote.money.v1.local', {});

  let moved = 0;
  const failures: string[] = [];
  const pendingTxs = (local.txs || []).filter((t) => String(t?.id || '').startsWith('local_'));
  const pendingGoals = (local.goals || []).filter((g) => String(g?.id || '').startsWith('local_'));
  const pendingBills = (local.bills || []).filter((b) => String(b?.id || '').startsWith('local_'));
  const hasSettings = local.currency !== undefined || local.budget !== undefined;

  if (!pendingTxs.length && !pendingGoals.length && !pendingBills.length && !hasSettings) return 0;

  const errorText = (error: unknown, fallback: string) => {
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) {
      return error.message;
    }
    return fallback;
  };
  const remainingTxs = [...(local.txs || [])];
  for (const tx of pendingTxs) {
    const { data, error } = await supabase
      .from('money_transactions')
      .insert({
        user_id: userId,
        kind: tx.kind,
        amount: Number(tx.amount),
        category: tx.category || 'Other',
        note: tx.note || '',
        occurred_on: tx.occurred_on,
        account: tx.account || 'Cash',
        to_account: tx.to_account || null,
      })
      .select()
      .single();
    if (!error && data) {
      const idx = remainingTxs.findIndex((row) => row.id === tx.id);
      if (idx >= 0) remainingTxs[idx] = { ...data, amount: Number(data.amount) };
      moved++;
    } else {
      failures.push(`Transaction upload failed: ${errorText(error, 'cloud returned no transaction')}`);
    }
  }

  const remainingGoals = [...(local.goals || [])];
  for (const goal of pendingGoals) {
    const { data, error } = await supabase
      .from('money_goals')
      .insert({
        user_id: userId,
        name: goal.name,
        target: Number(goal.target),
        saved: Number(goal.saved) || 0,
      })
      .select()
      .single();
    if (!error && data) {
      const idx = remainingGoals.findIndex((row) => row.id === goal.id);
      if (idx >= 0) remainingGoals[idx] = { ...data, target: Number(data.target), saved: Number(data.saved) };
      moved++;
    } else {
      failures.push(`Goal upload failed: ${errorText(error, 'cloud returned no goal')}`);
    }
  }

  const remainingBills = [...(local.bills || [])];
  for (const bill of pendingBills) {
    const { data, error } = await supabase
      .from('bill_reminders')
      .insert({
        user_id: userId,
        name: bill.name,
        amount: Number(bill.amount) || 0,
        due_day: Number(bill.due_day) || 1,
        last_paid_month: bill.last_paid_month || null,
      })
      .select()
      .single();
    if (!error && data) {
      const idx = remainingBills.findIndex((row) => row.id === bill.id);
      if (idx >= 0) remainingBills[idx] = { ...data, amount: Number(data.amount) };
      moved++;
    } else {
      failures.push(`Bill upload failed: ${errorText(error, 'cloud returned no bill')}`);
    }
  }

  let settingsSynced = !hasSettings;
  if (hasSettings) {
    const { error } = await supabase.from('tracker_settings').upsert(
      {
        user_id: userId,
        currency: local.currency || 'INR',
        monthly_budget: Number(local.budget) || 0,
      },
      { onConflict: 'user_id' }
    );
    settingsSynced = !error;
    if (error) failures.push(`Money settings upload failed: ${errorText(error, 'cloud request failed')}`);
  }

  // Successful records are removed from the local queue; failed records and
  // failed settings remain intact for a later retry.
  writeJson('niknote.money.v1.local', {
    txs: remainingTxs.filter((row) => String(row?.id || '').startsWith('local_')),
    goals: remainingGoals.filter((row) => String(row?.id || '').startsWith('local_')),
    bills: remainingBills.filter((row) => String(row?.id || '').startsWith('local_')),
    currency: hasSettings ? local.currency || 'INR' : local.currency,
    budget: hasSettings && settingsSynced ? 0 : local.budget,
  });

  if (failures.length) {
    throw new Error(`Money sync incomplete (${failures.length} issue${failures.length === 1 ? '' : 's'}): ${failures[0]}`);
  }
  return moved;
}

// ── 3. Sync Routine Tracker Local Queue -> Cloud ──
export async function syncLocalRoutineToCloud(userId: string): Promise<number> {
  if (!isCloudUserId(userId)) return 0;
  const local = readJson<{
    habits?: LocalHabit[];
    checks?: { habit_id: string; day: string }[];
    todos?: LocalRoutineTodo[];
    week?: Record<string, LocalWellnessDay>;
    waterGoal?: number;
    _synced?: boolean;
  }>('niknote.routine.v1.local', {});

  const habits = local.habits || [];
  const checks = local.checks || [];
  const todos = local.todos || [];
  const weekEntries = Object.entries(local.week || {});
  if (!habits.length && !checks.length && !todos.length && !weekEntries.length) return 0;

  let moved = 0;
  const failures: string[] = [];
  let remainingHabits = [...habits];
  let remainingChecks = [...checks];
  let remainingTodos = [...todos];
  let remainingWeek: Record<string, unknown> = { ...(local.week || {}) };
  const errorText = (error: unknown, fallback: string) => {
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) {
      return error.message;
    }
    return fallback;
  };

  if (habits.length) {
    const { error } = await supabase.from('habits').upsert(
      habits.map((h) => ({
        id: h.id,
        user_id: userId,
        name: h.name,
        emoji: h.emoji || '✅',
        block: h.block || 'morning',
        days: Array.isArray(h.days) && h.days.length ? h.days : [0, 1, 2, 3, 4, 5, 6],
        archived: Boolean(h.archived),
      })),
      { onConflict: 'id' }
    );
    if (!error) {
      moved += habits.length;
      remainingHabits = [];
    } else {
      failures.push(`Habit upload failed: ${errorText(error, 'cloud request failed')}`);
    }
  }

  if (checks.length) {
    const { error } = await supabase.from('habit_checks').upsert(
      checks.map((check) => ({ habit_id: check.habit_id, user_id: userId, day: check.day })),
      { onConflict: 'habit_id,day' }
    );
    if (!error) {
      moved += checks.length;
      remainingChecks = [];
    } else {
      failures.push(`Habit check upload failed: ${errorText(error, 'cloud request failed')}`);
    }
  }

  if (todos.length) {
    const { error } = await supabase.from('todos').upsert(
      todos.map((todo, index) => ({
        id: todo.id,
        user_id: userId,
        title: todo.title,
        done: Boolean(todo.done),
        priority: todo.priority || 'medium',
        position: typeof todo.position === 'number' ? todo.position : index,
      })),
      { onConflict: 'id' }
    );
    if (!error) {
      moved += todos.length;
      remainingTodos = [];
    } else {
      failures.push(`Todo upload failed: ${errorText(error, 'cloud request failed')}`);
    }
  }

  if (weekEntries.length) {
    const rows = weekEntries.map(([day, week]) => ({
      user_id: userId,
      day,
      water: Number(week?.water) || 0,
      sleep_hours: Number(week?.sleep_hours) || 0,
      exercise_minutes: Number(week?.exercise_minutes) || 0,
      mood: String(week?.mood || ''),
      pomodoros: Number(week?.pomodoros) || 0,
    }));
    const { error } = await supabase
      .from('daily_wellness')
      .upsert(rows, { onConflict: 'user_id,day' });
    if (!error) {
      moved += rows.length;
      remainingWeek = {};
    } else {
      failures.push(`Wellness upload failed: ${errorText(error, 'cloud request failed')}`);
    }
  }

  writeJson('niknote.routine.v1.local', {
    habits: remainingHabits,
    checks: remainingChecks,
    todos: remainingTodos,
    week: remainingWeek,
    waterGoal: local.waterGoal || 8,
    _synced: failures.length === 0,
  });

  if (failures.length) {
    throw new Error(`Routine sync incomplete (${failures.length} issue${failures.length === 1 ? '' : 's'}): ${failures[0]}`);
  }
  return moved;
}

// ── 4. Sync Whiteboards Local Queue -> Cloud ──
export async function syncLocalBoardsToCloud(userId: string): Promise<number> {
  if (!isCloudUserId(userId)) return 0;
  const localBoards = readJson<LocalBoard[]>('niknote.boards.v1.local', []);
  if (!localBoards.length) return 0;

  const boardMap = readJson<Record<string, string>>(BOARD_MAP_KEY, {});
  let moved = 0;
  const failures: string[] = [];
  const remaining: LocalBoard[] = [];
  const errorText = (error: unknown, fallback: string) => {
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) {
      return error.message;
    }
    return fallback;
  };

  for (const board of localBoards) {
    if (!board) continue;
    const mapped = boardMap[board.id];
    if (mapped) {
      const { data, error } = await supabase
        .from('boards')
        .update({ title: board.title || 'Untitled board', data: board.data ?? {} })
        .eq('id', mapped)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle();
      if (!error && data?.id) {
        moved++;
      } else {
        remaining.push(board);
        failures.push(`Board update failed: ${errorText(error, 'cloud returned no board')}`);
      }
      continue;
    }

    const { data: inserted, error } = await supabase
      .from('boards')
      .insert({
        user_id: userId,
        title: board.title || 'Untitled board',
        data: board.data ?? {},
      })
      .select('id')
      .single();

    if (!error && inserted?.id) {
      boardMap[board.id] = inserted.id;
      moved++;
    } else {
      remaining.push(board);
      failures.push(`Board upload failed: ${errorText(error, 'cloud returned no board ID')}`);
    }
  }

  writeJson(BOARD_MAP_KEY, boardMap);
  writeJson('niknote.boards.v1.local', remaining);
  if (failures.length) {
    throw new Error(`Board sync incomplete (${failures.length} issue${failures.length === 1 ? '' : 's'}): ${failures[0]}`);
  }
  return moved;
}

// ── Master Idempotent Sync Orchestrator (Per-User Single-Flight Deduped) ──
const activeSyncPromisesByUser = new Map<string, Promise<{ synced: number; ok: boolean; error?: string }>>();

export function syncAllLocalDataToCloud(
  userId?: string | null,
  opts: { pullCloud?: boolean } = {}
): Promise<{ synced: number; ok: boolean; error?: string }> {
  if (!isCloudUserId(userId)) {
    updateSyncSnapshot({
      state: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'local',
    });
    return Promise.resolve({ synced: 0, ok: false, error: 'Device mode active' });
  }

  const existing = activeSyncPromisesByUser.get(userId);
  if (existing) return existing;

  const task = (async () => {
    updateSyncSnapshot({ state: 'syncing', errorMessage: null });
    try {
      const results = await Promise.allSettled([
        syncLocalNotesWithCloud(userId, opts),
        syncLocalMoneyToCloud(userId),
        syncLocalRoutineToCloud(userId),
        syncLocalBoardsToCloud(userId),
      ]);
      const synced = results.reduce(
        (total, result) => total + (result.status === 'fulfilled' ? result.value : 0),
        0
      );
      const errors = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => result.reason instanceof Error ? result.reason.message : 'Cloud sync failed');

      if (errors.length) {
        const message = `${errors.length} sync area${errors.length === 1 ? '' : 's'} need attention: ${errors[0]}`;
        updateSyncSnapshot({
          state: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error',
          syncedCount: synced,
          errorMessage: message,
        });
        return { synced, ok: false, error: message };
      }

      const nowIso = new Date().toISOString();
      updateSyncSnapshot({
        state: 'synced',
        lastSyncedAt: nowIso,
        syncedCount: synced,
        errorMessage: null,
      });
      return { synced, ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cloud sync error';
      updateSyncSnapshot({
        state: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error',
        errorMessage: msg,
      });
      return { synced: 0, ok: false, error: msg };
    } finally {
      activeSyncPromisesByUser.delete(userId);
    }
  })();

  activeSyncPromisesByUser.set(userId, task);
  return task;
}
