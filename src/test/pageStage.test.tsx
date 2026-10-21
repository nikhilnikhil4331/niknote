import React, { useEffect, useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { PageStage, type PageStageHandle } from '@/components/notes/PageStage';

function Sheet({ onMount, label }: { onMount: () => void; label: string }) {
  useEffect(() => { onMount(); }, [onMount]);
  return <div data-testid="sheet-body">{label}</div>;
}

describe('PageStage', () => {
  it('commits the page change without remounting the editor', async () => {
    const onMount = vi.fn();
    const commit = vi.fn();
    const Harness = () => {
      const ref = useRef<PageStageHandle>(null);
      const [page, setPage] = useState(1);
      return (
        <PageStage ref={ref} onTurn={() => {}} keyboard={false}>
          <button type="button" onClick={() => { void ref.current?.turn('next', () => { commit(); setPage(2); }); }}>
            turn
          </button>
          <Sheet onMount={onMount} label={`page ${page}`} />
        </PageStage>
      );
    };

    render(<Harness />);
    expect(screen.getByTestId('sheet-body').textContent).toBe('page 1');
    expect(onMount).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByText('turn'));
      await new Promise(resolve => setTimeout(resolve, 240));
    });

    // commit happens at the midpoint, then the new content settles in place
    expect(commit).toHaveBeenCalledTimes(1);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 700)); });
    expect(screen.getByTestId('sheet-body').textContent).toBe('page 2');
    // the sheet container is never torn down by the animation
    expect(onMount).toHaveBeenCalledTimes(1);
  });

  it('unfolds a newly created page without losing the previous content', async () => {
    const commit = vi.fn();
    const Harness = () => {
      const ref = useRef<PageStageHandle>(null);
      const [pages, setPages] = useState(['page 1']);
      return (
        <PageStage ref={ref} onTurn={() => {}} keyboard={false}>
          <button
            type="button"
            onClick={() => {
              void ref.current?.unfold(() => {
                commit();
                setPages(prev => [...prev, `page ${prev.length + 1}`]);
              });
            }}
          >
            add
          </button>
          {pages.map((label, i) => <div key={i} data-testid={`page-${i}`}>{label}</div>)}
        </PageStage>
      );
    };

    render(<Harness />);
    await act(async () => {
      fireEvent.click(screen.getByText('add'));
      await new Promise(resolve => setTimeout(resolve, 40));
    });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('page-0').textContent).toBe('page 1');
    expect(screen.getByTestId('page-1').textContent).toBe('page 2');
  });

  it('turns by swipe but never while the writer is selecting text', async () => {
    const onTurn = vi.fn();
    render(
      <PageStage onTurn={onTurn} keyboard={false}>
        <textarea aria-label="note body" defaultValue="some words" />
        <p>plain area</p>
      </PageStage>,
    );

    const textarea = screen.getByLabelText('note body');
    fireEvent.pointerDown(textarea, { clientX: 200, clientY: 200, pointerType: 'touch' });
    fireEvent.pointerUp(textarea, { clientX: 60, clientY: 205, pointerType: 'touch' });
    expect(onTurn).not.toHaveBeenCalled();

    const area = screen.getByText('plain area');
    fireEvent.pointerDown(area, { clientX: 300, clientY: 300, pointerType: 'touch' });
    fireEvent.pointerMove(area, { clientX: 220, clientY: 302, pointerType: 'touch' });
    fireEvent.pointerMove(area, { clientX: 120, clientY: 303, pointerType: 'touch' });
    fireEvent.pointerUp(area, { clientX: 120, clientY: 303, pointerType: 'touch' });
    expect(onTurn).toHaveBeenCalledWith('next');
  });

  it('ignores clearly vertical drags so normal scrolling is untouched', async () => {
    const onTurn = vi.fn();
    render(
      <PageStage onTurn={onTurn} keyboard={false}>
        <p>scroll area</p>
      </PageStage>,
    );
    const area = screen.getByText('scroll area');
    fireEvent.pointerDown(area, { clientX: 200, clientY: 400, pointerType: 'touch' });
    fireEvent.pointerMove(area, { clientX: 198, clientY: 300, pointerType: 'touch' });
    fireEvent.pointerUp(area, { clientX: 198, clientY: 300, pointerType: 'touch' });
    expect(onTurn).not.toHaveBeenCalled();
  });
});

describe('PageStage unfold visuals', () => {
  it('folds the fresh sheet before opening it, so the animation really plays', async () => {
    const Harness = () => {
      const ref = useRef<PageStageHandle>(null);
      const [page, setPage] = useState(1);
      return (
        <PageStage ref={ref} onTurn={() => {}} keyboard={false}>
          <button type="button" onClick={() => { void ref.current?.unfold(() => setPage(p => p + 1)); }}>new page</button>
          <div data-testid="body">page {page}</div>
        </PageStage>
      );
    };

    render(<Harness />);
    const sheet = document.querySelector('[data-page-sheet="true"]') as HTMLElement;

    await act(async () => { fireEvent.click(screen.getByText('new page')); });

    // The page exists immediately (never gated behind the animation)…
    expect(screen.getByTestId('body').textContent).toBe('page 2');
    // …and the sheet is already folded along its top edge when it appears.
    expect(sheet.style.transform).toMatch(/rotateX/);

    await act(async () => { await new Promise(r => setTimeout(r, 900)); });
    // …then settles flat (no residual rotation, whatever else framer keeps).
    expect(sheet.style.transform).not.toMatch(/rotateX/);
  });
});
