import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createBlock, type Block } from '@/types/block';

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
  tags?: unknown;
  updated_at?: string | null;
};

type CloudPage = {
  notebook_id: string;
  title?: string | null;
  content?: unknown;
  page_number?: number;
  updated_at?: string | null;
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
  let moved = 0;
  const failures: string[] = [];

  const idMap = readJson<Record<string, string>>(NOTEBOOK_MAP_KEY, {});
  const mobileList = readJson<any[]>('niknote.mobile.notebooks.v1', []);
  const plainNotes = readJson<any[]>('niknote.notes.v1', []);

  // Merge any niknote.notes.v1 entries not yet in mobileList.
  const seenIds = new Set(mobileList.map((n) => String(n.id)));
  for (const note of plainNotes) {
    if (!note || note.trashedAt || seenIds.has(String(note.id))) continue;
    const blocks: Block[] = Array.isArray(note.blocks) && note.blocks.length
      ? note.blocks
      : String(note.content || '')
          .split('\n')
          .filter(Boolean)
          .map((line: string) => createBlock('text', line));
    mobileList.push({
      id: note.id,
      title: note.title || 'Untitled Note',
      blocks: blocks.length ? blocks : [createBlock('text', '')],
      page_style: 'ruled',
      tags: Array.isArray(note.tags) && note.tags.length ? note.tags : ['Notes'],
      updated_at: note.updatedAt || new Date().toISOString(),
    });
    seenIds.add(String(note.id));
  }

  let localMutated = false;
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

  for (let i = 0; i < mobileList.length; i++) {
    const item = mobileList[i];
    if (!item || item.trashedAt) continue;
    const rawId = String(item.id || '');
    // A UUID can be generated locally. Treat it as a cloud ID only when the
    // sync marker/map proves that it has been uploaded, or the owner-scoped
    // existence lookup below confirms it.
    let cloudId = idMap[rawId] || (item._syncedAt && UUID_RE.test(rawId) ? rawId : '');
    let cloudNotebook: CloudNotebook | null = null;

    // Already synced and unchanged; the pull phase still checks whether a
    // different device has made a newer cloud edit.
    if (cloudId && item._syncedAt && item._syncedAt === item.updated_at) {
      if (item.id !== cloudId) {
        mobileList[i] = { ...item, id: cloudId };
        localMutated = true;
      }
      continue;
    }

    if (!cloudId && UUID_RE.test(rawId)) {
      const { data, error } = await supabase
        .from('notebooks')
        .select('id, updated_at')
        .eq('id', rawId)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        failures.push(`Notebook lookup failed: ${errorText(error, 'cloud request failed')}`);
        continue;
      }
      if (data?.id) {
        cloudId = data.id;
        cloudNotebook = data;
      }
    }

    const hasCloudIdentity = Boolean(idMap[rawId] || item._syncedAt);
    if (cloudId && !cloudNotebook) {
      const { data, error } = await supabase
        .from('notebooks')
        .select('id, title, cover_color, page_style, page_size, tags, updated_at')
        .eq('id', cloudId)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        failures.push(`Notebook lookup failed: ${errorText(error, 'cloud request failed')}`);
        continue;
      }
      if (!data?.id) {
        failures.push('A previously synced notebook is not available to this account; local data was kept.');
        continue;
      }
      cloudNotebook = data;
    }

    if (!cloudId) {
      const { data: created, error } = await supabase
        .from('notebooks')
        .insert({
          user_id: userId,
          title: item.title || 'Untitled Note',
          cover_color: item.cover_color || '#8b5cf6',
          page_style: item.page_style || 'ruled',
          page_size: item.page_size || 'a4',
          tags: Array.isArray(item.tags) && item.tags.length ? item.tags : ['Notes'],
        })
        .select('id, title, cover_color, page_style, page_size, tags, updated_at')
        .single();

      if (error || !created?.id) {
        failures.push(`Notebook upload failed: ${errorText(error, 'cloud returned no notebook ID')}`);
        continue;
      }
      cloudId = created.id;
      cloudNotebook = created;
      if (rawId) {
        idMap[rawId] = cloudId;
        writeJson(NOTEBOOK_MAP_KEY, idMap);
        localMutated = true;
      }
    } else if (!hasCloudIdentity && !cloudNotebook) {
      // Defensive fallback; a mapped or verified cloud notebook always has a row.
      failures.push('Could not resolve the target notebook; local data was kept.');
      continue;
    }

    const { data: pageRows, error: pageReadError } = await supabase
      .from('pages')
      .select('id, title, content, page_number, updated_at')
      .eq('notebook_id', cloudId)
      .eq('user_id', userId)
      .order('page_number', { ascending: true })
      .limit(1);
    if (pageReadError) {
      failures.push(`Page lookup failed: ${errorText(pageReadError, 'cloud request failed')}`);
      continue;
    }
    const existingPage = Array.isArray(pageRows) ? pageRows[0] : null;

    // Do not silently overwrite a newer edit from another device. If this
    // device is clean, the pull below adopts the cloud version; if both sides
    // changed, keep this local copy and report a conflict for user resolution.
    const syncedAt = toMillis(item._syncedAt);
    const cloudUpdatedAt = Math.max(
      toMillis(cloudNotebook?.updated_at),
      toMillis(existingPage?.updated_at)
    );
    const cloudChanged = syncedAt > 0 && cloudUpdatedAt > syncedAt;
    const localChanged = Boolean(item._syncedAt && item._syncedAt !== item.updated_at);
    if (cloudChanged && !localChanged && existingPage) {
      const stamp = new Date(cloudUpdatedAt).toISOString();
      mobileList[i] = {
        ...item,
        title: cloudNotebook.title || existingPage.title || item.title || 'Untitled Note',
        blocks: Array.isArray(existingPage.content)
          ? existingPage.content
          : [createBlock('text', '')],
        cover_color: cloudNotebook.cover_color || item.cover_color || '#8b5cf6',
        page_style: cloudNotebook.page_style || item.page_style || 'ruled',
        page_size: cloudNotebook.page_size || item.page_size || 'a4',
        tags: Array.isArray(cloudNotebook.tags) ? cloudNotebook.tags : item.tags || ['Notes'],
        updated_at: stamp,
        _syncedAt: stamp,
      };
      localMutated = true;
      continue;
    }
    if (cloudChanged && localChanged) {
      failures.push('A note changed on this device and another device; local edits were kept instead of overwriting cloud data.');
      continue;
    }

    if (cloudNotebook?.id) {
      const { error } = await supabase
        .from('notebooks')
        .update({
          title: item.title || 'Untitled Note',
          cover_color: item.cover_color || '#8b5cf6',
          page_style: item.page_style || 'ruled',
          page_size: item.page_size || 'a4',
          tags: Array.isArray(item.tags) && item.tags.length ? item.tags : ['Notes'],
        })
        .eq('id', cloudId)
        .eq('user_id', userId);
      if (error) {
        failures.push(`Notebook update failed: ${errorText(error, 'cloud request failed')}`);
        continue;
      }
    }

    const blocks = Array.isArray(item.blocks) ? item.blocks : [];
    let pageWriteError: unknown = null;
    if (existingPage?.id) {
      const { error } = await supabase
        .from('pages')
        .update({
          title: item.title || 'Untitled Note',
          content: blocks as any,
        })
        .eq('id', existingPage.id)
        .eq('user_id', userId);
      pageWriteError = error;
    } else {
      const { error } = await supabase.from('pages').insert({
        notebook_id: cloudId,
        user_id: userId,
        page_number: 1,
        title: item.title || 'Untitled Note',
        content: blocks as any,
      });
      pageWriteError = error;
    }
    if (pageWriteError) {
      failures.push(`Page upload failed: ${errorText(pageWriteError, 'cloud request failed')}`);
      continue;
    }

    const stamp = new Date().toISOString();
    mobileList[i] = {
      ...item,
      id: cloudId,
      updated_at: stamp,
      _syncedAt: stamp,
    };
    localMutated = true;
    moved++;
  }

  // Pull all notebook rows in bounded pages. Page content remains one page per
  // local notebook until the editor's multi-page local model is implemented.
  if (opts.pullCloud !== false) {
    const cloudNotebooks: CloudNotebook[] = [];
    const batchSize = 200;
    const maximumRows = 5000;
    for (let offset = 0; offset < maximumRows; offset += batchSize) {
      const { data, error } = await supabase
        .from('notebooks')
        .select('id, title, cover_color, page_style, page_size, tags, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + batchSize - 1);
      if (error) {
        failures.push(`Notebook pull failed: ${errorText(error, 'cloud request failed')}`);
        break;
      }
      const rows = Array.isArray(data) ? data : [];
      cloudNotebooks.push(...rows);
      if (rows.length < batchSize) break;
      if (offset + batchSize >= maximumRows) {
        failures.push('Notebook pull reached the safe 5,000-row limit; remaining cloud notebooks were not loaded.');
      }
    }

    if (cloudNotebooks.length) {
      const pagesByNotebook = new Map<string, CloudPage>();
      const ids = cloudNotebooks.map((notebook) => notebook.id);
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
          if (!pagesByNotebook.has(page.notebook_id)) pagesByNotebook.set(page.notebook_id, page);
        }
      }

      const localByCloudId = new Map<string, { item: Record<string, unknown>; index: number }>();
      for (let index = 0; index < mobileList.length; index++) {
        const item = mobileList[index];
        if (!item) continue;
        const rawId = String(item.id || '');
        const cloudId = idMap[rawId] || (item._syncedAt && UUID_RE.test(rawId) ? rawId : '');
        if (cloudId) localByCloudId.set(cloudId, { item, index });
      }

      for (const notebook of cloudNotebooks) {
        const page = pagesByNotebook.get(notebook.id);
        const remoteMillis = Math.max(toMillis(notebook.updated_at), toMillis(page?.updated_at));
        const remoteStamp = remoteMillis ? new Date(remoteMillis).toISOString() : notebook.updated_at;
        const localEntry = localByCloudId.get(notebook.id);
        if (!localEntry) {
          const pulled = {
            id: notebook.id,
            title: notebook.title || page?.title || 'Untitled Note',
            blocks: Array.isArray(page?.content) ? page.content : [createBlock('text', '')],
            cover_color: notebook.cover_color || '#8b5cf6',
            page_style: notebook.page_style || 'ruled',
            page_size: notebook.page_size || 'a4',
            tags: notebook.tags || ['Notes'],
            updated_at: remoteStamp,
            _syncedAt: remoteStamp,
          };
          mobileList.push(pulled);
          localByCloudId.set(notebook.id, { item: pulled, index: mobileList.length - 1 });
          localMutated = true;
          continue;
        }

        const local = mobileList[localEntry.index];
        const localStamp = toMillis(local._syncedAt);
        const localClean = Boolean(local._syncedAt && local._syncedAt === local.updated_at);
        if (localClean && remoteMillis > localStamp && page) {
          mobileList[localEntry.index] = {
            ...local,
            id: notebook.id,
            title: notebook.title || page.title || local.title || 'Untitled Note',
            blocks: Array.isArray(page.content) ? page.content : [createBlock('text', '')],
            cover_color: notebook.cover_color || local.cover_color || '#8b5cf6',
            page_style: notebook.page_style || local.page_style || 'ruled',
            page_size: notebook.page_size || local.page_size || 'a4',
            tags: Array.isArray(notebook.tags) ? notebook.tags : local.tags || ['Notes'],
            updated_at: remoteStamp,
            _syncedAt: remoteStamp,
          };
          localMutated = true;
        }
      }
    }
  }

  if (localMutated) {
    writeJson(NOTEBOOK_MAP_KEY, idMap);
    writeJson('niknote.mobile.notebooks.v1', mobileList);
    // Keep canonical IDs/content aligned without erasing local note metadata or
    // silently deleting items that are only represented in the trash store.
    const plainByLocalId = new Map<string, Record<string, unknown>>();
    const plainByCloudId = new Map<string, Record<string, unknown>>();
    for (const note of plainNotes) {
      if (!note) continue;
      const localId = String(note.id || '');
      if (!localId) continue;
      plainByLocalId.set(localId, note);
      plainByCloudId.set(idMap[localId] || localId, note);
    }
    const now = new Date().toISOString();
    const updatedPlain = mobileList.filter((note) => note && !note.trashedAt).map((note) => {
      const id = String(note.id || '');
      const original = plainByCloudId.get(id) || plainByLocalId.get(id);
      const parentId = original?.parentId ?? note.parentId ?? null;
      return {
        ...original,
        id: id || original?.id,
        title: note.title || original?.title || 'Untitled Note',
        icon: original?.icon || note.icon || '📝',
        content: Array.isArray(note.blocks) ? note.blocks.map((block: any) => block?.content || '').join('\n') : '',
        starred: original?.starred ?? note.starred ?? false,
        tags: Array.isArray(note.tags) ? note.tags : original?.tags || ['Notes'],
        parentId: typeof parentId === 'string' ? idMap[parentId] || parentId : parentId,
        trashedAt: null,
        createdAt: original?.createdAt || note.createdAt || note.updated_at || now,
        updatedAt: note.updated_at || original?.updatedAt || now,
      };
    });
    const preservedTrash = new Set<string>();
    for (const note of plainNotes) {
      if (!note?.trashedAt) continue;
      const localId = String(note.id || '');
      const id = idMap[localId] || localId;
      if (!id || preservedTrash.has(id) || updatedPlain.some((active) => String(active.id) === id)) continue;
      const parentId = typeof note.parentId === 'string' ? idMap[note.parentId] || note.parentId : note.parentId;
      updatedPlain.push({ ...note, id, parentId });
      preservedTrash.add(id);
    }
    writeJson('niknote.notes.v1', updatedPlain);
  }

  if (failures.length) {
    throw new Error(`Notes sync incomplete (${failures.length} issue${failures.length === 1 ? '' : 's'}): ${failures[0]}`);
  }
  return moved;
}

// ── 2. Sync Money Tracker Local Queue -> Cloud ──
export async function syncLocalMoneyToCloud(userId: string): Promise<number> {
  if (!isCloudUserId(userId)) return 0;
  const local = readJson<{
    txs?: any[];
    goals?: any[];
    bills?: any[];
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
      } as any,
      { onConflict: 'user_id' } as any
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
    habits?: any[];
    checks?: { habit_id: string; day: string }[];
    todos?: any[];
    week?: Record<string, any>;
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
      checks.map((check) => ({ habit_id: check.habit_id, user_id: userId, day: check.day })) as any,
      { onConflict: 'habit_id,day' } as any
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
    const rows = weekEntries.map(([day, week]: [string, any]) => ({
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
      .upsert(rows as any, { onConflict: 'user_id,day' } as any);
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
  const localBoards = readJson<any[]>('niknote.boards.v1.local', []);
  if (!localBoards.length) return 0;

  const boardMap = readJson<Record<string, string>>(BOARD_MAP_KEY, {});
  let moved = 0;
  const failures: string[] = [];
  const remaining: any[] = [];
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
        .update({ title: board.title || 'Untitled board', data: board.data })
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
        data: board.data,
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
