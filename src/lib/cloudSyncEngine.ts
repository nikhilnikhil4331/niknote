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

  const idMap = readJson<Record<string, string>>(NOTEBOOK_MAP_KEY, {});
  const mobileList = readJson<any[]>('niknote.mobile.notebooks.v1', []);
  const plainNotes = readJson<any[]>('niknote.notes.v1', []);

  // Merge any niknote.notes.v1 entries not yet in mobileList
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

  for (let i = 0; i < mobileList.length; i++) {
    const item = mobileList[i];
    if (!item) continue;
    const rawId = String(item.id || '');
    const mappedCloudId = UUID_RE.test(rawId) ? rawId : idMap[rawId] || '';

    // Already synced and unchanged since last sync stamp
    if (mappedCloudId && item._syncedAt && item._syncedAt === item.updated_at) {
      if (item.id !== mappedCloudId) {
        mobileList[i] = { ...item, id: mappedCloudId };
        localMutated = true;
      }
      continue;
    }

    let cloudId = mappedCloudId;
    if (!cloudId) {
      const { data: created, error: createErr } = await supabase
        .from('notebooks')
        .insert({
          user_id: userId,
          title: item.title || 'Untitled Note',
          cover_color: item.cover_color || '#8b5cf6',
          page_style: item.page_style || 'ruled',
          page_size: item.page_size || 'a4',
          tags: Array.isArray(item.tags) && item.tags.length ? item.tags : ['Notes'],
        })
        .select('id, updated_at')
        .single();

      if (createErr || !created?.id) continue;
      cloudId = created.id;
      if (rawId) idMap[rawId] = cloudId;
    } else {
      await supabase
        .from('notebooks')
        .update({
          title: item.title || 'Untitled Note',
          page_style: item.page_style || 'ruled',
          tags: Array.isArray(item.tags) && item.tags.length ? item.tags : ['Notes'],
        })
        .eq('id', cloudId);
    }

    const blocks = Array.isArray(item.blocks) ? item.blocks : [];
    const { data: existingPage } = await supabase
      .from('pages')
      .select('id')
      .eq('notebook_id', cloudId)
      .order('page_number', { ascending: true })
      .limit(1);

    const stamp = new Date().toISOString();
    if (existingPage && existingPage[0]?.id) {
      await supabase
        .from('pages')
        .update({
          title: item.title || 'Untitled Note',
          content: blocks as any,
        })
        .eq('id', existingPage[0].id);
    } else {
      await supabase.from('pages').insert({
        notebook_id: cloudId,
        user_id: userId,
        page_number: 1,
        title: item.title || 'Untitled Note',
        content: blocks as any,
      });
    }

    mobileList[i] = {
      ...item,
      id: cloudId,
      updated_at: stamp,
      _syncedAt: stamp,
    };
    localMutated = true;
    moved++;
  }

  // Pull cloud notebooks down into local mirror so cross-tab / cross-device stays 100% consistent
  if (opts.pullCloud !== false) {
    const { data: cloudNotebooks } = await supabase
      .from('notebooks')
      .select('id, title, cover_color, page_style, page_size, tags, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(60);

    if (Array.isArray(cloudNotebooks) && cloudNotebooks.length) {
      const ids = cloudNotebooks.map((n: any) => n.id);
      const { data: cloudPages } = await supabase
        .from('pages')
        .select('notebook_id, content, page_number')
        .in('notebook_id', ids)
        .order('page_number', { ascending: true });

      const pagesByNotebook = new Map<string, any[]>();
      for (const p of cloudPages || []) {
        if (!pagesByNotebook.has(p.notebook_id) && Array.isArray(p.content)) {
          pagesByNotebook.set(p.notebook_id, p.content);
        }
      }

      const localById = new Map(mobileList.map((n) => [String(n.id), n]));
      for (const cn of cloudNotebooks) {
        if (!localById.has(cn.id)) {
          mobileList.push({
            id: cn.id,
            title: cn.title || 'Untitled Note',
            blocks: pagesByNotebook.get(cn.id) || [createBlock('text', '')],
            cover_color: cn.cover_color || '#8b5cf6',
            page_style: cn.page_style || 'ruled',
            page_size: cn.page_size || 'a4',
            tags: cn.tags || ['Notes'],
            updated_at: cn.updated_at,
            _syncedAt: cn.updated_at,
          });
          localMutated = true;
        }
      }
    }
  }

  if (localMutated) {
    writeJson(NOTEBOOK_MAP_KEY, idMap);
    writeJson('niknote.mobile.notebooks.v1', mobileList);
    // Keep niknote.notes.v1 aligned with canonical IDs
    const updatedPlain = mobileList.map((n) => ({
      id: n.id,
      title: n.title || 'Untitled Note',
      icon: '📝',
      content: Array.isArray(n.blocks) ? n.blocks.map((b: any) => b?.content || '').join('\n') : '',
      starred: false,
      tags: Array.isArray(n.tags) ? n.tags : ['Notes'],
      parentId: null,
      trashedAt: null,
      createdAt: n.updated_at || new Date().toISOString(),
      updatedAt: n.updated_at || new Date().toISOString(),
    }));
    writeJson('niknote.notes.v1', updatedPlain);
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
  const pendingTxs = (local.txs || []).filter((t) => String(t?.id || '').startsWith('local_'));
  const pendingGoals = (local.goals || []).filter((g) => String(g?.id || '').startsWith('local_'));
  const pendingBills = (local.bills || []).filter((b) => String(b?.id || '').startsWith('local_'));

  if (!pendingTxs.length && !pendingGoals.length && !pendingBills.length && !local.budget) {
    return 0;
  }

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
      const idx = remainingTxs.findIndex((r) => r.id === tx.id);
      if (idx >= 0) remainingTxs[idx] = { ...data, amount: Number(data.amount) };
      moved++;
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
      const idx = remainingGoals.findIndex((r) => r.id === goal.id);
      if (idx >= 0) remainingGoals[idx] = { ...data, target: Number(data.target), saved: Number(data.saved) };
      moved++;
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
      const idx = remainingBills.findIndex((r) => r.id === bill.id);
      if (idx >= 0) remainingBills[idx] = { ...data, amount: Number(data.amount) };
      moved++;
    }
  }

  if (local.currency || local.budget) {
    await supabase.from('tracker_settings').upsert(
      {
        user_id: userId,
        currency: local.currency || 'INR',
        monthly_budget: Number(local.budget) || 0,
      } as any,
      { onConflict: 'user_id' } as any
    );
  }

  writeJson('niknote.money.v1.local', {
    txs: remainingTxs.filter((t) => String(t?.id || '').startsWith('local_')),
    goals: remainingGoals.filter((g) => String(g?.id || '').startsWith('local_')),
    bills: remainingBills.filter((b) => String(b?.id || '').startsWith('local_')),
    currency: local.currency || 'INR',
    budget: 0,
  });

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

  if (!habits.length && !checks.length && !todos.length && !weekEntries.length) {
    return 0;
  }

  let moved = 0;
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
    if (!error) moved += habits.length;
  }

  if (checks.length) {
    const { error } = await supabase.from('habit_checks').upsert(
      checks.map((c) => ({ habit_id: c.habit_id, user_id: userId, day: c.day })) as any,
      { onConflict: 'habit_id,day' } as any
    );
    if (!error) moved += checks.length;
  }

  if (todos.length) {
    const { error } = await supabase.from('todos').upsert(
      todos.map((t, idx) => ({
        id: t.id,
        user_id: userId,
        title: t.title,
        done: Boolean(t.done),
        priority: t.priority || 'medium',
        position: typeof t.position === 'number' ? t.position : idx,
      })),
      { onConflict: 'id' }
    );
    if (!error) moved += todos.length;
  }

  if (weekEntries.length) {
    const rows = weekEntries.map(([day, w]: [string, any]) => ({
      user_id: userId,
      day,
      water: Number(w?.water) || 0,
      sleep_hours: Number(w?.sleep_hours) || 0,
      exercise_minutes: Number(w?.exercise_minutes) || 0,
      mood: String(w?.mood || ''),
      pomodoros: Number(w?.pomodoros) || 0,
    }));
    const { error } = await supabase
      .from('daily_wellness')
      .upsert(rows as any, { onConflict: 'user_id,day' } as any);
    if (!error) moved += rows.length;
  }

  if (moved > 0) {
    writeJson('niknote.routine.v1.local', {
      habits: [],
      checks: [],
      todos: [],
      week: {},
      waterGoal: local.waterGoal || 8,
      _synced: true,
    });
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
  const remaining: any[] = [];

  for (const b of localBoards) {
    if (!b) continue;
    const mapped = boardMap[b.id];
    if (mapped) {
      const { error } = await supabase
        .from('boards')
        .update({ title: b.title || 'Untitled board', data: b.data })
        .eq('id', mapped);
      if (!error) moved++;
      else remaining.push(b);
      continue;
    }

    const { data: inserted, error } = await supabase
      .from('boards')
      .insert({
        user_id: userId,
        title: b.title || 'Untitled board',
        data: b.data,
      })
      .select('id')
      .single();

    if (!error && inserted?.id) {
      boardMap[b.id] = inserted.id;
      moved++;
    } else {
      remaining.push(b);
    }
  }

  writeJson(BOARD_MAP_KEY, boardMap);
  writeJson('niknote.boards.v1.local', remaining);
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
      const [notesCount, moneyCount, routineCount, boardsCount] = await Promise.all([
        syncLocalNotesWithCloud(userId, opts),
        syncLocalMoneyToCloud(userId),
        syncLocalRoutineToCloud(userId),
        syncLocalBoardsToCloud(userId),
      ]);
      const total = notesCount + moneyCount + routineCount + boardsCount;
      const nowIso = new Date().toISOString();
      updateSyncSnapshot({
        state: 'synced',
        lastSyncedAt: nowIso,
        syncedCount: total,
        errorMessage: null,
      });
      return { synced: total, ok: true };
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
