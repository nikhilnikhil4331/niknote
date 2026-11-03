import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { History } from '@/lib/board';
import { consumePlaygroundNoteImport } from '@/lib/playgroundNoteImport';
import {
  clonePlaygroundDocument,
  emptyPlayground,
  normalizePlayground,
  starterPlayground,
  type PlaygroundDocument,
  type PlaygroundIndexEntry,
  type PlaygroundObject,
  type PlaygroundViewport,
} from '@/lib/playground';

export type PlaygroundSaveState = 'loading' | 'saving' | 'synced' | 'local' | 'error';

const INDEX_PREFIX = 'niknote.playground.index.v1.';
const DOC_PREFIX = 'niknote.playground.doc.v1.';
const LAST_PREFIX = 'niknote.playground.last.v1.';
const isCloudId = (id?: string) => Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function sortedIndex(entries: PlaygroundIndexEntry[]) {
  return [...entries].sort((a, b) =>
    Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
    a.position - b.position ||
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

// Clone only the mutable model branches. Unlike JSON serialization this does
// not copy large image data URLs on every pointer move or text keystroke.
function objectDraft(object: PlaygroundObject): PlaygroundObject {
  return {
    ...object,
    items: object.items?.map((item) => ({ ...item })),
    rows: object.rows?.map((row) => [...row]),
    chartData: object.chartData?.map((datum) => ({ ...datum })),
    points: object.points?.map((point) => ({ ...point })),
  };
}

function documentDraft(previous: PlaygroundDocument): PlaygroundDocument {
  return {
    ...previous,
    viewport: { ...previous.viewport },
    objects: previous.objects.map(objectDraft),
    edges: previous.edges.map((edge) => ({ ...edge })),
  };
}

// Restore references for unchanged blocks so React.memo can skip them.
function sameBlockValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => sameBlockValue(value, b[index]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return sameBlock(a as Record<string, unknown>, b as Record<string, unknown>);
  }
  return false;
}

function sameBlock(a: Record<string, unknown>, b: Record<string, unknown>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if (!sameBlockValue(a[key], b[key])) return false;
  return true;
}

export function usePlayground() {
  const { user, loading: authLoading } = useAuth();
  const [params, setParams] = useSearchParams();
  const requestedId = params.get('id');
  const scope = user?.id || 'device';
  const cloudUserId = isCloudId(user?.id) ? user!.id : null;
  const indexKey = `${INDEX_PREFIX}${scope}`;
  const lastKey = `${LAST_PREFIX}${scope}`;

  const [index, setIndex] = useState<PlaygroundIndexEntry[]>([]);
  const indexRef = useRef<PlaygroundIndexEntry[]>([]);
  const [doc, setDoc] = useState<PlaygroundDocument>(() => emptyPlayground());
  const docRef = useRef(doc);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<PlaygroundSaveState>('loading');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const dirty = useRef(false);
  const loadGeneration = useRef(0);
  const history = useRef(new History<PlaygroundDocument>(100));
  const [, setHistoryVersion] = useState(0);

  const replaceIndex = useCallback((entries: PlaygroundIndexEntry[]) => {
    const sorted = sortedIndex(entries);
    indexRef.current = sorted;
    setIndex(sorted);
    try { writeJSON(indexKey, sorted); } catch { /* quota is reported by document save */ }
  }, [indexKey]);

  const setCurrentDocument = useCallback((next: PlaygroundDocument) => {
    docRef.current = next;
    setDoc(next);
  }, []);

  // Load the device copy immediately, then merge cloud rows for this same user.
  useEffect(() => {
    if (authLoading) return;
    const generation = ++loadGeneration.current;
    setReady(false);
    setSaveState('loading');
    setSyncMessage(null);
    dirty.current = false;
    history.current = new History<PlaygroundDocument>(100);

    let entries = readJSON<PlaygroundIndexEntry[]>(indexKey, []);
    let chosenId = requestedId || readJSON<string | null>(lastKey, null);
    if (chosenId && !entries.some((entry) => entry.id === chosenId)) chosenId = null;

    const imported = consumePlaygroundNoteImport();
    if (imported) {
      try { writeJSON(`${DOC_PREFIX}${scope}.${imported.id}`, imported); } catch { /* autosave will report storage failures */ }
      entries = [...entries, { id: imported.id, title: imported.title, updatedAt: imported.updatedAt, position: entries.length }];
      replaceIndex(entries);
      chosenId = imported.id;
    } else if (!entries.length) {
      const starter = starterPlayground();
      try {
        writeJSON(`${DOC_PREFIX}${scope}.${starter.id}`, starter);
        writeJSON(lastKey, starter.id);
      } catch { /* the editor still works in memory */ }
      entries = [{ id: starter.id, title: starter.title, updatedAt: starter.updatedAt, position: 0 }];
      replaceIndex(entries);
      chosenId = starter.id;
      if (requestedId !== starter.id) setParams({ id: starter.id }, { replace: true });
    }

    const activeId = chosenId || sortedIndex(entries)[0]?.id;
    if (!activeId) return;
    const raw = readJSON<unknown>(`${DOC_PREFIX}${scope}.${activeId}`, null);
    const localDoc = normalizePlayground(raw, activeId);
    localDoc.id = activeId;
    setCurrentDocument(localDoc);
    try { writeJSON(lastKey, activeId); } catch { /* optional */ }
    if (requestedId !== activeId) setParams({ id: activeId }, { replace: true });
    setReady(true);
    setSaveState(cloudUserId ? 'loading' : 'local');
    setHistoryVersion((v) => v + 1);

    if (!cloudUserId) return;
    let cancelled = false;
    void (async () => {
      const { data: rows, error } = await supabase
        .from('playgrounds')
        .select('id,title,data,updated_at')
        .order('updated_at', { ascending: false });
      if (cancelled || generation !== loadGeneration.current) return;
      if (error) {
        setSaveState('local');
        setSyncMessage('Cloud sync is unavailable. Your changes are still saved on this device.');
        return;
      }

      const remoteEntries: PlaygroundIndexEntry[] = [];
      let newestRemoteActive: PlaygroundDocument | null = null;
      for (const row of rows || []) {
        const remote = normalizePlayground(row.data, row.id);
        remote.id = row.id;
        remote.title = row.title || remote.title;
        remote.updatedAt = row.updated_at || remote.updatedAt;
        const localRaw = readJSON<unknown>(`${DOC_PREFIX}${scope}.${remote.id}`, null);
        const local = localRaw ? normalizePlayground(localRaw, remote.id) : null;
        // Never replace a newer, unsynced device draft with an older cloud row.
        const winning = local && local.updatedAt > remote.updatedAt ? local : remote;
        try { writeJSON(`${DOC_PREFIX}${scope}.${remote.id}`, winning); } catch { /* quota */ }
        const previous = indexRef.current.find((entry) => entry.id === remote.id);
        remoteEntries.push({
          id: remote.id,
          title: winning.title,
          updatedAt: winning.updatedAt,
          position: previous?.position ?? remoteEntries.length,
          favorite: previous?.favorite,
          pinned: previous?.pinned,
        });
        if (remote.id === activeId) newestRemoteActive = remote;
      }
      const merged = [...remoteEntries];
      for (const local of indexRef.current) {
        if (!merged.some((entry) => entry.id === local.id)) merged.push({ ...local, position: merged.length });
      }
      replaceIndex(merged);
      const remoteActive = newestRemoteActive as PlaygroundDocument | null;
      if (remoteActive && !dirty.current && remoteActive.updatedAt > docRef.current.updatedAt) {
        setCurrentDocument(remoteActive);
      }
      const shouldUploadActive = !remoteActive || docRef.current.updatedAt > remoteActive.updatedAt;
      if (shouldUploadActive && !dirty.current) {
        const value = clonePlaygroundDocument(docRef.current);
        const { error: uploadError } = await supabase.from('playgrounds').upsert({
          id: value.id,
          user_id: cloudUserId,
          title: value.title,
          data: value,
          updated_at: value.updatedAt,
        }, { onConflict: 'id' });
        if (cancelled || generation !== loadGeneration.current) return;
        if (uploadError) {
          setSaveState('local');
          setSyncMessage('Saved on this device. Cloud sync will retry after your next edit.');
          return;
        }
      }
      setSaveState(dirty.current ? 'saving' : 'synced');
      setSyncMessage(null);
    })();

    return () => { cancelled = true; };
  }, [authLoading, cloudUserId, indexKey, lastKey, replaceIndex, requestedId, scope, setCurrentDocument, setParams]);

  const persistLocal = useCallback((value: PlaygroundDocument) => {
    writeJSON(`${DOC_PREFIX}${scope}.${value.id}`, value);
    writeJSON(lastKey, value.id);
    const existing = indexRef.current.find((entry) => entry.id === value.id);
    const nextEntry: PlaygroundIndexEntry = {
      id: value.id,
      title: value.title,
      updatedAt: value.updatedAt,
      position: existing?.position ?? indexRef.current.length,
      favorite: existing?.favorite,
      pinned: existing?.pinned,
    };
    replaceIndex([...indexRef.current.filter((entry) => entry.id !== value.id), nextEntry]);
  }, [lastKey, replaceIndex, scope]);

  // Debounced device persistence is authoritative for offline use. Cloud success
  // is only reported after Supabase confirms the upsert.
  useEffect(() => {
    if (!ready || !dirty.current) return;
    setSaveState('saving');
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const value = clonePlaygroundDocument(docRef.current);
      try {
        persistLocal(value);
      } catch {
        dirty.current = false;
        setSaveState('error');
        setSyncMessage('Device storage is full or unavailable. Export your canvas before closing this tab.');
        return;
      }
      dirty.current = false;
      if (!cloudUserId) {
        setSaveState('local');
        return;
      }
      void (async () => {
        const { error } = await supabase.from('playgrounds').upsert({
          id: value.id,
          user_id: cloudUserId,
          title: value.title,
          data: value,
          updated_at: value.updatedAt,
        }, { onConflict: 'id' });
        if (cancelled) return;
        if (error) {
          setSaveState('local');
          setSyncMessage('Saved on this device. Cloud sync will retry after your next edit.');
        } else {
          setSaveState('synced');
          setSyncMessage(null);
        }
      })();
    }, 550);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cloudUserId, doc, persistLocal, ready]);

  useEffect(() => {
    const flush = () => {
      if (!dirty.current || !ready) return;
      try { persistLocal(docRef.current); dirty.current = false; } catch { /* cannot block unload */ }
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [persistLocal, ready]);

  // Pan/zoom only changes three numbers. Keep all object and edge references
  // intact so the canvas can update without cloning or reconciling its blocks.
  const updateViewport = useCallback((viewport: PlaygroundViewport) => {
    const previous = docRef.current;
    const current = previous.viewport;
    if (current.x === viewport.x && current.y === viewport.y && current.zoom === viewport.zoom) return;
    dirty.current = true;
    setCurrentDocument({ ...previous, viewport });
  }, [setCurrentDocument]);

  const apply = useCallback((
    recipe: (draft: PlaygroundDocument) => void,
    options: { record?: boolean; touch?: boolean } = {},
  ) => {
    const { record = true, touch = true } = options;
    const previous = docRef.current;
    if (record) history.current.push(clonePlaygroundDocument(previous));
    const next = documentDraft(previous);
    recipe(next);
    const previousObjects = new Map(previous.objects.map((object) => [object.id, object]));
    const previousEdges = new Map(previous.edges.map((edge) => [edge.id, edge]));
    next.objects = next.objects.map((object) => {
      const before = previousObjects.get(object.id);
      return before && sameBlock(before as unknown as Record<string, unknown>, object as unknown as Record<string, unknown>) ? before : object;
    });
    next.edges = next.edges.map((edge) => {
      const before = previousEdges.get(edge.id);
      return before && sameBlock(before as unknown as Record<string, unknown>, edge as unknown as Record<string, unknown>) ? before : edge;
    });
    if (touch) next.updatedAt = new Date().toISOString();
    dirty.current = true;
    setCurrentDocument(next);
    if (record) setHistoryVersion((v) => v + 1);
  }, [setCurrentDocument]);

  const beginTransaction = useCallback(() => {
    history.current.push(clonePlaygroundDocument(docRef.current));
    setHistoryVersion((v) => v + 1);
  }, []);

  const undo = useCallback(() => {
    const previous = history.current.undo(docRef.current);
    if (!previous) return false;
    dirty.current = true;
    setCurrentDocument(previous);
    setHistoryVersion((v) => v + 1);
    return true;
  }, [setCurrentDocument]);

  const redo = useCallback(() => {
    const next = history.current.redo(docRef.current);
    if (!next) return false;
    dirty.current = true;
    setCurrentDocument(next);
    setHistoryVersion((v) => v + 1);
    return true;
  }, [setCurrentDocument]);

  const openCanvas = useCallback((id: string) => {
    if (id === docRef.current.id) return;
    if (dirty.current) {
      try { persistLocal(docRef.current); dirty.current = false; } catch { /* save status remains visible */ }
    }
    setParams({ id });
  }, [persistLocal, setParams]);

  const installCanvas = useCallback((value: PlaygroundDocument) => {
    if (dirty.current) {
      try { persistLocal(docRef.current); dirty.current = false; } catch { /* the visible save status remains available */ }
    }
    try { writeJSON(`${DOC_PREFIX}${scope}.${value.id}`, value); } catch { /* handled on next autosave */ }
    const nextEntry = { id: value.id, title: value.title, updatedAt: value.updatedAt, position: indexRef.current.length };
    replaceIndex([...indexRef.current, nextEntry]);
    setParams({ id: value.id });
    return value.id;
  }, [persistLocal, replaceIndex, scope, setParams]);

  const createCanvas = useCallback((title = 'Untitled playground') => {
    const next = emptyPlayground(title);
    try {
      const preferred = localStorage.getItem('niknote.playground.canvasTheme');
      if (preferred === 'dark') next.theme = 'dark';
    } catch { /* default white playground */ }
    return installCanvas(next);
  }, [installCanvas]);

  const duplicateCanvas = useCallback((id: string) => {
    let source: PlaygroundDocument;
    if (id === docRef.current.id) source = clonePlaygroundDocument(docRef.current);
    else source = normalizePlayground(readJSON(`${DOC_PREFIX}${scope}.${id}`, null), id);
    const copy = clonePlaygroundDocument(source);
    const now = new Date().toISOString();
    copy.id = `${source.id}-copy-${Date.now().toString(36)}`;
    copy.title = `${source.title} copy`;
    copy.createdAt = now;
    copy.updatedAt = now;
    return installCanvas(copy);
  }, [installCanvas, scope]);

  const deleteCanvas = useCallback(async (id: string) => {
    try { localStorage.removeItem(`${DOC_PREFIX}${scope}.${id}`); } catch { /* optional */ }
    const remaining = indexRef.current.filter((entry) => entry.id !== id);
    replaceIndex(remaining);
    let cloudError = false;
    if (cloudUserId) {
      const { error } = await supabase.from('playgrounds').delete().eq('id', id);
      cloudError = Boolean(error);
    }
    if (id === docRef.current.id) {
      if (remaining[0]) setParams({ id: remaining[0].id });
      else createCanvas();
    }
    return { cloudError };
  }, [cloudUserId, createCanvas, replaceIndex, scope, setParams]);

  const renameCanvas = useCallback(async (id: string, title: string) => {
    const clean = title.trim() || 'Untitled playground';
    if (id === docRef.current.id) {
      apply((draft) => { draft.title = clean; });
      return { cloudError: false };
    }
    const value = normalizePlayground(readJSON(`${DOC_PREFIX}${scope}.${id}`, null), id);
    value.title = clean;
    value.updatedAt = new Date().toISOString();
    try { persistLocal(value); } catch { return { cloudError: true }; }
    if (!cloudUserId) return { cloudError: false };
    const { error } = await supabase.from('playgrounds').upsert({
      id: value.id,
      user_id: cloudUserId,
      title: value.title,
      data: value,
      updated_at: value.updatedAt,
    }, { onConflict: 'id' });
    return { cloudError: Boolean(error) };
  }, [apply, cloudUserId, persistLocal, scope]);

  const updateIndexEntry = useCallback((id: string, patch: Partial<PlaygroundIndexEntry>) => {
    replaceIndex(indexRef.current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  }, [replaceIndex]);

  const reorderCanvases = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const ordered = [...indexRef.current];
    const from = ordered.findIndex((entry) => entry.id === sourceId);
    const to = ordered.findIndex((entry) => entry.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    replaceIndex(ordered.map((entry, position) => ({ ...entry, position })));
  }, [replaceIndex]);

  /** Flush the latest draft before an in-app navigation cancels the debounce. */
  const flushLocal = useCallback(() => {
    if (!ready || !dirty.current) return true;
    try {
      persistLocal(docRef.current);
      dirty.current = false;
      return true;
    } catch {
      setSaveState('error');
      setSyncMessage('The latest canvas draft could not be saved on this device.');
      return false;
    }
  }, [persistLocal, ready]);

  return {
    doc,
    index,
    ready,
    saveState,
    syncMessage,
    isCloud: Boolean(cloudUserId),
    apply,
    updateViewport,
    flushLocal,
    beginTransaction,
    undo,
    redo,
    canUndo: history.current.canUndo,
    canRedo: history.current.canRedo,
    createCanvas,
    duplicateCanvas,
    deleteCanvas,
    openCanvas,
    renameCanvas,
    updateIndexEntry,
    reorderCanvases,
  };
}
