import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/components/desktop/DesktopShell', () => ({
  DesktopShell: ({ children }: { children: unknown }) => children,
}));

import PlaygroundPage from './Playground';
import { PLAYGROUND_STORAGE_KEY } from '@/lib/playground';

function renderPlayground() {
  return render(<MemoryRouter><PlaygroundPage /></MemoryRouter>);
}

beforeEach(() => {
  localStorage.clear();
  window.confirm = vi.fn(() => true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Playground interactions', () => {
  it('edits a piece, adds a checklist, marks a step done, and saves locally', async () => {
    renderPlayground();

    const textEditor = screen.getByRole('textbox', { name: 'Your words' });
    fireEvent.change(textEditor, { target: { value: 'A thought worth keeping' } });
    expect(textEditor).toHaveValue('A thought worth keeping');

    fireEvent.click(screen.getByRole('button', { name: /Checklist.*Little steps/ }));
    expect(screen.getByRole('textbox', { name: 'Your words' })).toHaveValue(
      'First little step\nAnother small thing\nCelebrate the done',
    );

    const firstStep = screen.getByRole('button', { name: 'Check First little step' });
    expect(fireEvent.keyDown(firstStep, { key: ' ' })).toBe(true);
    expect(fireEvent.keyDown(firstStep, { key: 'ArrowDown' })).toBe(true);
    fireEvent.click(firstStep);
    expect(screen.getByRole('button', { name: 'Uncheck First little step' })).toHaveAttribute('aria-pressed', 'true');

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(PLAYGROUND_STORAGE_KEY) || 'null');
      expect(saved.items).toHaveLength(5);
      expect(saved.items.find((item: { kind: string }) => item.kind === 'checklist').checked[0]).toBe(true);
    });
  });

  it('supports keyboard nudging and paper-theme changes', () => {
    renderPlayground();
    const note = screen.getByRole('group', { name: /Sticky note\. A tiny idea/ });
    expect(note).toHaveStyle({ left: '29%' });
    fireEvent.keyDown(note, { key: 'ArrowRight' });
    expect(note).toHaveStyle({ left: '30%' });

    fireEvent.click(screen.getByRole('button', { name: 'Blue grid paper' }));
    expect(screen.getByRole('button', { name: 'Blue grid paper' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('flushes pending edits when leaving before the save debounce completes', () => {
    const view = renderPlayground();
    fireEvent.change(screen.getByRole('textbox', { name: 'Your words' }), { target: { value: 'Saved before leaving' } });
    view.unmount();

    const saved = JSON.parse(localStorage.getItem(PLAYGROUND_STORAGE_KEY) || 'null');
    expect(saved.items[0].text).toBe('Saved before leaving');
  });

  it('respects the saved appearance animation toggle', () => {
    localStorage.setItem('niknote-mobile-appearance', JSON.stringify({ animations: false }));
    renderPlayground();
    expect(document.querySelector('.pg-page')).toHaveClass('pg-motion-off');
  });
});
