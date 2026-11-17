import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useNotebookPages } from './useNotebookPages';

describe('useNotebookPages navigation', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('keeps rapid next and previous actions within the available page range', () => {
    const { result } = renderHook(() => useNotebookPages('owner-navigation-test', 'note-navigation-test'));

    act(() => {
      result.current.addNewPage();
      result.current.addNewPage();
    });
    expect(result.current.totalPages).toBe(3);
    expect(result.current.currentPageIndex).toBe(2);

    act(() => result.current.goToPage(0));
    act(() => {
      result.current.nextPage();
      result.current.nextPage();
      result.current.nextPage();
      result.current.nextPage();
    });
    expect(result.current.currentPageIndex).toBe(2);
    expect(result.current.canGoNext).toBe(false);

    act(() => {
      result.current.prevPage();
      result.current.prevPage();
      result.current.prevPage();
      result.current.prevPage();
    });
    expect(result.current.currentPageIndex).toBe(0);
    expect(result.current.canGoPrev).toBe(false);
  });

  it('clamps direct page selection and ignores non-finite indices', () => {
    const { result } = renderHook(() => useNotebookPages('owner-navigation-test', 'note-select-test'));

    act(() => {
      result.current.addNewPage();
      result.current.addNewPage();
    });
    act(() => result.current.goToPage(999));
    expect(result.current.currentPageIndex).toBe(2);
    act(() => result.current.goToPage(Number.NaN));
    expect(result.current.currentPageIndex).toBe(2);
    act(() => result.current.goToPage(-1));
    expect(result.current.currentPageIndex).toBe(0);
  });
});
