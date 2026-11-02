import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlaygroundPage from '@/pages/Playground';

const mocks = vi.hoisted(() => ({ openNew: vi.fn() }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));
vi.mock('@/components/desktop/DesktopShell', () => ({
  DesktopShell: ({ children }: { children: React.ReactNode }) => <div className="nik-desktop">{children}</div>,
}));
vi.mock('@/components/desktop/notes', () => ({
  useDesktopNotes: () => ({ active: [], openNew: mocks.openNew }),
}));

describe('composed playground page', () => {
  beforeEach(() => {
    mocks.openNew.mockReset();
    localStorage.clear();
    document.documentElement.className = '';
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
  });

  it('creates a new canvas and keeps app and playground themes independent', async () => {
    const { container, unmount } = render(<MemoryRouter initialEntries={['/playground']}><PlaygroundPage /></MemoryRouter>);
    const canvas = await screen.findByLabelText('Infinite playground canvas');
    expect(canvas).toHaveAttribute('data-canvas-theme', 'light');

    fireEvent.click(screen.getByTitle('Theme settings'));
    fireEvent.click(screen.getByRole('button', { name: 'Black' }));
    expect(canvas).toHaveAttribute('data-canvas-theme', 'dark');
    expect(document.documentElement.classList.contains('pg-app-dark')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /^Dark$/ }));
    expect(document.documentElement.classList.contains('pg-app-dark')).toBe(true);
    await waitFor(() => expect(localStorage.getItem('niknote.playground.canvasTheme')).toBe('dark'));
    expect(localStorage.getItem('niknote.playground.appTheme')).toBe('dark');

    fireEvent.click(screen.getByRole('button', { name: 'Create new canvas' }));
    expect(await screen.findByText('A clear space for your next idea')).toBeInTheDocument();
    expect(screen.getByLabelText('Playground title')).toHaveValue('Untitled playground');
    expect(container.querySelectorAll('[data-object-id]')).toHaveLength(0);
    unmount();
    expect(document.documentElement.classList.contains('pg-app-dark')).toBe(false);
  });

  it('previews real canvas notes and opens them in the existing Notes Taking editor', async () => {
    render(<MemoryRouter initialEntries={['/playground']}><PlaygroundPage /></MemoryRouter>);
    await screen.findByLabelText('Infinite playground canvas');
    fireEvent.click(screen.getByRole('button', { name: 'Notes preview' }));

    expect(screen.getByRole('region', { name: 'Canvas notes preview' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Model Design Playground' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Infinite playground canvas')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit in Notes Taking' }));

    expect(mocks.openNew).toHaveBeenCalledOnce();
    const handoff = mocks.openNew.mock.calls[0][0];
    expect(handoff.title).toBe('Model Design');
    expect(handoff.canvasId).toBeTruthy();
    expect(handoff.text).toContain('## Model Design Playground');
    expect(handoff.text).toContain('Dataset');
    expect(handoff.text).toContain(`Canvas reference: ${window.location.origin}/playground?id=${handoff.canvasId}`);

    fireEvent.click(screen.getByRole('button', { name: 'Back to canvas' }));
    expect(await screen.findByLabelText('Infinite playground canvas')).toBeInTheDocument();
  });

  it('uses the same workspace controls without a separate mobile UI at 390px', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    render(<MemoryRouter initialEntries={['/playground']}><PlaygroundPage /></MemoryRouter>);
    await screen.findByLabelText('Infinite playground canvas');
    expect(screen.queryByRole('navigation', { name: 'Playground navigation' })).not.toBeInTheDocument();

    const canvasListToggle = screen.getByRole('button', { name: 'Toggle canvas list' });
    expect(canvasListToggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(canvasListToggle);
    expect(canvasListToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Study Hub', { selector: 'strong' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close workspace panel' }));

    fireEvent.click(screen.getByTitle('Add a block'));
    expect(screen.getByRole('complementary', { name: 'Block library' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close block library' }));
    expect(screen.queryByRole('complementary', { name: 'Block library' })).not.toBeInTheDocument();
  });
});
