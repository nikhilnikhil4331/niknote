// ============================================================
// usePageStrokes — device-persisted freehand marks per paper page.
//
// Data is structured (points + colour + width + tool), so a page can be
// resized, re-rendered or exported without flattening a canvas bitmap.
// Undo/redo keeps whole-map snapshots; nothing here touches the network.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PageStroke, StrokePoint } from '@/types/noteLine';

const STORAGE_KEY = 'niknote.page-strokes.v1';
const HISTORY_LIMIT = 40;

type StrokeMap = Record<string, PageStroke[]>;
type Snapshot = StrokeMap;

function readStrokes(): StrokeMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: StrokeMap = {};
    for (const [pageId, strokes] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(strokes)) continue;
      out[pageId] = (strokes as PageStroke[]).filter(s =>
        s && typeof s.id === 'string' && Array.isArray(s.points) && s.points.length > 0);
    }
    return out;
  } catch {
    return {};
  }
}

const newId = () => `stroke-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function usePageStrokes() {
  const [map, setMap] = useState<StrokeMap>(readStrokes);
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const [revision, setRevision] = useState(0); // lets canUndo/canRedo re-render

  // Debounced persistence — drawing never blocks on storage.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
      } catch {
        /* quota — strokes stay in memory for this session */
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [map]);

  const addStroke = useCallback((
    pageId: string,
    input: { points: StrokePoint[]; color: string; width: number; tool: 'pen' | 'highlighter' },
  ) => {
    if (!input.points.length) return;
    setMap(prev => {
      const next: StrokeMap = {
        ...prev,
        [pageId]: [...(prev[pageId] ?? []), { id: newId(), ...input }],
      };
      past.current = [...past.current.slice(-(HISTORY_LIMIT - 1)), prev];
      future.current = [];
      return next;
    });
    setRevision(r => r + 1);
  }, []);

  const eraseAt = useCallback((pageId: string, point: StrokePoint, radius = 14) => {
    setMap(prev => {
      const strokes = prev[pageId] ?? [];
      if (!strokes.length) return prev;
      let best: { id: string; distance: number } | null = null;
      for (const stroke of strokes) {
        const threshold = Math.max(radius, stroke.width * 1.8);
        for (const p of stroke.points) {
          const distance = Math.hypot(p.x - point.x, p.y - point.y);
          if (distance <= threshold && (!best || distance < best.distance)) best = { id: stroke.id, distance };
        }
      }
      if (!best) return prev;
      const next = { ...prev, [pageId]: strokes.filter(s => s.id !== best!.id) };
      past.current = [...past.current.slice(-(HISTORY_LIMIT - 1)), prev];
      future.current = [];
      return next;
    });
    setRevision(r => r + 1);
  }, []);

  const clearPage = useCallback((pageId: string) => {
    setMap(prev => {
      if (!prev[pageId]?.length) return prev;
      return { ...prev, [pageId]: [] };
    });
    setRevision(r => r + 1);
  }, []);

  const undo = useCallback(() => {
    const snapshot = past.current.pop();
    if (!snapshot) return;
    setMap(prev => {
      future.current = [prev, ...future.current].slice(0, HISTORY_LIMIT);
      return snapshot;
    });
    setRevision(r => r + 1);
  }, []);

  const redo = useCallback(() => {
    const [snapshot, ...rest] = future.current;
    if (!snapshot) return;
    future.current = rest;
    setMap(prev => {
      past.current = [...past.current.slice(-(HISTORY_LIMIT - 1)), prev];
      return snapshot;
    });
    setRevision(r => r + 1);
  }, []);

  const canUndo = useMemo(() => { void revision; return past.current.length > 0; }, [revision]);
  const canRedo = useMemo(() => { void revision; return future.current.length > 0; }, [revision]);

  const strokesFor = useCallback((pageId?: string) => (pageId ? map[pageId] ?? [] : []), [map]);

  return { strokesByPage: map, strokesFor, addStroke, eraseAt, clearPage, undo, redo, canUndo, canRedo };
}
