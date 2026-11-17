import { useState, useCallback, useEffect, useMemo } from 'react';
import { NoteLine, LineInkColor, generateLineId } from '@/types/noteLine';
import { PC_ACTIVE_META_KEY, PC_ACTIVE_PAGES_KEY } from '@/lib/cloudSyncEngine';

export interface NotebookPage {
  id: string;
  lines: NoteLine[];
  createdAt: number;
}

export function notebookPagesStorageKey(ownerId?: string, documentId?: string) {
  return `${PC_ACTIVE_PAGES_KEY}:owner:${ownerId || 'device'}:document:${documentId || 'workspace'}`;
}

interface UseNotebookPagesReturn {
  pages: NotebookPage[];
  currentPageIndex: number;
  currentPage: NotebookPage;
  totalPages: number;
  goToPage: (index: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  addNewPage: () => void;
  insertPageAfter: (index: number, page?: NotebookPage) => void;
  deletePage: (index: number) => void;
  updateCurrentPageLines: (lines: NoteLine[]) => void;
  updatePageLines: (index: number, lines: NoteLine[]) => void;
  replaceAllPages: (nextPages: NotebookPage[]) => void;
  flowOverflowFrom: (startPageIndex: number, linesPerPage: number) => void;
  canGoNext: boolean;
  canGoPrev: boolean;
}

const createEmptyPage = (): NotebookPage => ({
  id: `page-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  lines: [{ id: generateLineId(), text: '', color: 'black' as LineInkColor, timestamp: Date.now() }],
  createdAt: Date.now(),
});

const ensureAtLeastOneLine = (lines: NoteLine[]): NoteLine[] => {
  if (lines.length > 0) return lines;
  return [{ id: generateLineId(), text: '', color: 'black' as LineInkColor, timestamp: Date.now() }];
};

function normalizePages(parsed: unknown): NotebookPage[] | null {
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  return parsed.map((item: unknown, index) => {
    const page = item && typeof item === 'object' && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {};
    const lines = Array.isArray(page.lines) ? page.lines as NoteLine[] : [];
    return {
      id: typeof page.id === 'string' ? page.id : `page-restored-${index}`,
      lines: ensureAtLeastOneLine(lines),
      createdAt: typeof page.createdAt === 'number' ? page.createdAt : Date.now(),
    };
  });
}

function loadInitialPages(storageKey: string, ownerId?: string, documentId?: string): NotebookPage[] {
  if (typeof window === 'undefined') return [createEmptyPage()];
  try {
    const scoped = localStorage.getItem(storageKey);
    if (scoped) {
      const normalized = normalizePages(JSON.parse(scoped));
      if (normalized) return normalized;
    }
  } catch {
    // Ignore a corrupt scoped draft and keep the editor usable.
  }

  // Migrate old unscoped handwriting pages only when the stored owner marker
  // matches this account (or it was an unclaimed device-guest draft). Keep the
  // legacy key intact so this migration is non-destructive.
  try {
    const legacy = localStorage.getItem(PC_ACTIVE_PAGES_KEY);
    const metaKey = ownerId ? `${PC_ACTIVE_META_KEY}:${ownerId}` : PC_ACTIVE_META_KEY;
    const scopedMeta = localStorage.getItem(metaKey);
    const rawMeta = scopedMeta || localStorage.getItem(PC_ACTIVE_META_KEY) || '{}';
    const meta = JSON.parse(rawMeta);
    const sameOwner = Boolean(ownerId && meta?.userId === ownerId && (!documentId || meta?.notebookId === documentId));
    const unclaimedGuest = Boolean(ownerId && ownerId.startsWith('local-guest-') && !meta?.userId);
    if (legacy && (sameOwner || unclaimedGuest)) {
      const normalized = normalizePages(JSON.parse(legacy));
      if (normalized) {
        localStorage.setItem(storageKey, JSON.stringify(normalized));
        return normalized;
      }
    }
  } catch {
    // A first-run user simply receives a clean page.
  }
  return [createEmptyPage()];
}

export function useNotebookPages(ownerId?: string, documentId?: string): UseNotebookPagesReturn {
  const storageKey = notebookPagesStorageKey(ownerId, documentId);
  const initialPages = useMemo(() => loadInitialPages(storageKey, ownerId, documentId), [storageKey, ownerId, documentId]);
  const [pageState, setPageState] = useState<{ storageKey: string; pages: NotebookPage[] }>(() => ({
    storageKey,
    pages: initialPages,
  }));
  const pages = pageState.storageKey === storageKey ? pageState.pages : initialPages;
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const updatePages = useCallback((updater: (current: NotebookPage[]) => NotebookPage[]) => {
    setPageState((previous) => {
      const current = previous.storageKey === storageKey ? previous.pages : loadInitialPages(storageKey, ownerId, documentId);
      return { storageKey, pages: updater(current) };
    });
  }, [storageKey, ownerId, documentId]);

  useEffect(() => {
    if (pageState.storageKey !== storageKey) {
      setPageState({ storageKey, pages: initialPages });
      setCurrentPageIndex(0);
    }
  }, [storageKey, ownerId, documentId, initialPages, pageState.storageKey]);

  // Persist only the state that belongs to the currently selected owner.
  useEffect(() => {
    if (typeof window === 'undefined' || pageState.storageKey !== storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(pageState.pages));
    } catch {
      // ignore storage quota errors
    }
  }, [pageState, storageKey]);

  const currentPage = pages[currentPageIndex] || pages[0];
  const totalPages = pages.length;
  const canGoNext = currentPageIndex < totalPages - 1;
  const canGoPrev = currentPageIndex > 0;

  const goToPage = useCallback((index: number) => {
    if (!Number.isFinite(index)) return;
    const targetIndex = Math.trunc(index);
    setCurrentPageIndex(Math.max(0, Math.min(targetIndex, pages.length - 1)));
  }, [pages.length]);

  const nextPage = useCallback(() => {
    setCurrentPageIndex((currentIndex) => Math.min(currentIndex + 1, pages.length - 1));
  }, [pages.length]);

  const prevPage = useCallback(() => {
    setCurrentPageIndex((currentIndex) => Math.max(currentIndex - 1, 0));
  }, []);

  const insertPageAfter = useCallback((index: number, page?: NotebookPage) => {
    updatePages((prev) => {
      const newPages = [...prev];
      const newPage = page ?? createEmptyPage();
      newPages.splice(index + 1, 0, newPage);
      return newPages;
    });
  }, [updatePages]);

  const addNewPage = useCallback(() => {
    const newPage = createEmptyPage();
    updatePages((prev) => {
      const newPages = [...prev];
      newPages.splice(currentPageIndex + 1, 0, newPage);
      return newPages;
    });
    setCurrentPageIndex((prev) => prev + 1);
  }, [currentPageIndex, updatePages]);

  const deletePage = useCallback((index: number) => {
    if (pages.length <= 1) return;
    updatePages((prev) => prev.filter((_, i) => i !== index));
    setCurrentPageIndex((prev) => (prev >= index && prev > 0 ? prev - 1 : prev));
  }, [pages.length, updatePages]);

  const updatePageLines = useCallback((index: number, lines: NoteLine[]) => {
    updatePages((prev) =>
      prev.map((page, i) => (i === index ? { ...page, lines: ensureAtLeastOneLine(lines) } : page))
    );
  }, [updatePages]);

  const updateCurrentPageLines = useCallback(
    (lines: NoteLine[]) => {
      updatePages((prev) =>
        prev.map((page, i) =>
          i === currentPageIndex ? { ...page, lines: ensureAtLeastOneLine(lines) } : page
        )
      );
    },
    [currentPageIndex, updatePages]
  );

  const replaceAllPages = useCallback((nextPages: NotebookPage[]) => {
    if (!Array.isArray(nextPages) || nextPages.length === 0) {
      updatePages(() => [createEmptyPage()]);
      setCurrentPageIndex(0);
      return;
    }
    updatePages(
      () => nextPages.map((p, idx) => ({
        id: p.id || `page-${Date.now()}-${idx}`,
        lines: ensureAtLeastOneLine(p.lines || []),
        createdAt: p.createdAt || Date.now(),
      }))
    );
    setCurrentPageIndex(0);
  }, [updatePages]);

  const flowOverflowFrom = useCallback((startPageIndex: number, linesPerPage: number) => {
    if (!Number.isFinite(linesPerPage) || linesPerPage <= 0) return;

    updatePages((prev) => {
      const newPages = [...prev];
      let i = Math.max(0, Math.min(startPageIndex, newPages.length - 1));

      for (let guard = 0; guard < 500; guard++) {
        if (i >= newPages.length) break;

        const page = newPages[i];
        const pageLines = ensureAtLeastOneLine(page.lines ?? []);

        if (pageLines.length <= linesPerPage) break;

        const keep = ensureAtLeastOneLine(pageLines.slice(0, linesPerPage));
        const overflow = pageLines.slice(linesPerPage);

        newPages[i] = { ...page, lines: keep };

        if (overflow.length > 0) {
          if (i + 1 >= newPages.length) {
            newPages.splice(i + 1, 0, createEmptyPage());
          }

          const next = newPages[i + 1];
          const nextLinesRaw = ensureAtLeastOneLine(next.lines ?? []);
          const nextLines =
            nextLinesRaw.length === 1 && nextLinesRaw[0]?.text === '' ? [] : nextLinesRaw;

          newPages[i + 1] = {
            ...next,
            lines: ensureAtLeastOneLine([...overflow, ...nextLines]),
          };

          i = i + 1;
          continue;
        }

        break;
      }

      return newPages;
    });
  }, [updatePages]);

  return {
    pages,
    currentPageIndex,
    currentPage,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    addNewPage,
    insertPageAfter,
    deletePage,
    updateCurrentPageLines,
    updatePageLines,
    replaceAllPages,
    flowOverflowFrom,
    canGoNext,
    canGoPrev,
  };
}
