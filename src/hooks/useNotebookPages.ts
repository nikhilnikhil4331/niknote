import { useState, useCallback, useEffect } from 'react';
import { NoteLine, LineInkColor, generateLineId } from '@/types/noteLine';
import { PC_ACTIVE_PAGES_KEY } from '@/lib/cloudSyncEngine';

export interface NotebookPage {
  id: string;
  lines: NoteLine[];
  createdAt: number;
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

function loadInitialPages(): NotebookPage[] {
  if (typeof window === 'undefined') return [createEmptyPage()];
  try {
    const raw = localStorage.getItem(PC_ACTIVE_PAGES_KEY);
    if (!raw) return [createEmptyPage()];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((p: any, idx: number) => ({
        id: p?.id || `page-restored-${idx}`,
        lines: ensureAtLeastOneLine(Array.isArray(p?.lines) ? p.lines : []),
        createdAt: typeof p?.createdAt === 'number' ? p.createdAt : Date.now(),
      }));
    }
  } catch {
    // ignore corrupt draft
  }
  return [createEmptyPage()];
}

export function useNotebookPages(): UseNotebookPagesReturn {
  const [pages, setPages] = useState<NotebookPage[]>(loadInitialPages);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // Instant zero-lag local persistence on every page/line change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(PC_ACTIVE_PAGES_KEY, JSON.stringify(pages));
    } catch {
      // ignore storage quota errors
    }
  }, [pages]);

  const currentPage = pages[currentPageIndex] || pages[0];
  const totalPages = pages.length;
  const canGoNext = currentPageIndex < totalPages - 1;
  const canGoPrev = currentPageIndex > 0;

  const goToPage = useCallback((index: number) => {
    if (index >= 0 && index < pages.length) {
      setCurrentPageIndex(index);
    }
  }, [pages.length]);

  const nextPage = useCallback(() => {
    if (canGoNext) {
      setCurrentPageIndex((prev) => prev + 1);
    }
  }, [canGoNext]);

  const prevPage = useCallback(() => {
    if (canGoPrev) {
      setCurrentPageIndex((prev) => prev - 1);
    }
  }, [canGoPrev]);

  const insertPageAfter = useCallback((index: number, page?: NotebookPage) => {
    setPages((prev) => {
      const newPages = [...prev];
      const newPage = page ?? createEmptyPage();
      newPages.splice(index + 1, 0, newPage);
      return newPages;
    });
  }, []);

  const addNewPage = useCallback(() => {
    const newPage = createEmptyPage();
    setPages((prev) => {
      const newPages = [...prev];
      newPages.splice(currentPageIndex + 1, 0, newPage);
      return newPages;
    });
    setCurrentPageIndex((prev) => prev + 1);
  }, [currentPageIndex]);

  const deletePage = useCallback((index: number) => {
    if (pages.length <= 1) return;
    setPages((prev) => prev.filter((_, i) => i !== index));
    setCurrentPageIndex((prev) => (prev >= index && prev > 0 ? prev - 1 : prev));
  }, [pages.length]);

  const updatePageLines = useCallback((index: number, lines: NoteLine[]) => {
    setPages((prev) =>
      prev.map((page, i) => (i === index ? { ...page, lines: ensureAtLeastOneLine(lines) } : page))
    );
  }, []);

  const updateCurrentPageLines = useCallback(
    (lines: NoteLine[]) => {
      setPages((prev) =>
        prev.map((page, i) =>
          i === currentPageIndex ? { ...page, lines: ensureAtLeastOneLine(lines) } : page
        )
      );
    },
    [currentPageIndex]
  );

  const replaceAllPages = useCallback((nextPages: NotebookPage[]) => {
    if (!Array.isArray(nextPages) || nextPages.length === 0) {
      setPages([createEmptyPage()]);
      setCurrentPageIndex(0);
      return;
    }
    setPages(
      nextPages.map((p, idx) => ({
        id: p.id || `page-${Date.now()}-${idx}`,
        lines: ensureAtLeastOneLine(p.lines || []),
        createdAt: p.createdAt || Date.now(),
      }))
    );
    setCurrentPageIndex(0);
  }, []);

  const flowOverflowFrom = useCallback((startPageIndex: number, linesPerPage: number) => {
    if (!Number.isFinite(linesPerPage) || linesPerPage <= 0) return;

    setPages((prev) => {
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
  }, []);

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
