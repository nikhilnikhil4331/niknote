import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { NotebookPreview } from '@/components/NotebookPreview';
import { usePageStrokes } from '@/hooks/usePageStrokes';
import { DEFAULT_SETTINGS } from '@/types/notes';
import type { NoteLine } from '@/types/noteLine';

const lines: NoteLine[] = [
  { id: 'l1', text: 'Photosynthesis notes', blockType: 'heading1', color: 'navy' } as NoteLine,
];

const Harness = () => {
  const store = usePageStrokes();
  return (
    <>
      <NotebookPreview
        lines={lines}
        settings={DEFAULT_SETTINGS}
        realPenMode={false}
        pageNumber={1}
        totalPages={1}
        pageId="page-1"
        strokes={store.strokesFor('page-1')}
        drawing={{ enabled: true, tool: 'pen', color: '#1e2a78', width: 2.6 }}
        onStroke={store.addStroke}
        onEraseStroke={store.eraseAt}
      />
      <span data-testid="count">{store.strokesFor('page-1').length}</span>
    </>
  );
};

describe('drawing on a smart-notes page', () => {
  beforeEach(() => localStorage.clear());

  it('keeps strokes as structured points, not a screenshot', () => {
    render(<Harness />);
    const surface = document.querySelector('[data-drawing-surface="true"]') as SVGElement;
    expect(surface).toBeTruthy();

    // No layout box in jsdom, so pin it to a predictable 1000×1400 page.
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 1000, height: 1400, right: 1000, bottom: 1400, x: 0, y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.pointerDown(surface, { clientX: 110, clientY: 210, pointerType: 'touch' });
    fireEvent.pointerMove(surface, { clientX: 160, clientY: 250, pointerType: 'touch' });
    fireEvent.pointerUp(surface, { clientX: 200, clientY: 290, pointerType: 'touch' });

    expect(screen.getByTestId('count').textContent).toBe('1');
    // Ink is drawn as an SVG path inside the paper, so PDF export inherits it.
    const inkPaths = document.querySelectorAll('[data-page-ink="true"] path');
    expect(inkPaths.length).toBe(1);
    expect(inkPaths[0].getAttribute('stroke')).toBe('#1e2a78');
  });

  it('survives a reload through localStorage', async () => {
    const { unmount } = render(<Harness />);
    const surface = document.querySelector('[data-drawing-surface="true"]') as SVGElement;
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 1000, height: 1400, right: 1000, bottom: 1400, x: 0, y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    fireEvent.pointerDown(surface, { clientX: 10, clientY: 10, pointerType: 'touch' });
    fireEvent.pointerMove(surface, { clientX: 40, clientY: 40, pointerType: 'touch' });
    fireEvent.pointerUp(surface, { clientX: 60, clientY: 60, pointerType: 'touch' });

    // Persistence is debounced; let the timer fire before tearing down.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 600)); });
    const stored = JSON.parse(localStorage.getItem('niknote.page-strokes.v1') || '{}');
    expect(stored['page-1']).toHaveLength(1);
    expect(stored['page-1'][0].points.length).toBeGreaterThan(1);
    unmount();
  });
});
