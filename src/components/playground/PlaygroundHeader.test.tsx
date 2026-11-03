import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PlaygroundHeader } from './PlaygroundHeader';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/components/desktop/NikoBuddy', () => ({
  NikoBuddy: ({ state, label }: { state: string; label: string }) => (
    <div data-testid="niko" data-state={state}>{label}</div>
  ),
}));

const baseProps: React.ComponentProps<typeof PlaygroundHeader> = {
  title: 'Research canvas',
  entries: [],
  tabs: [],
  activeId: 'canvas-1',
  objects: [],
  saveState: 'local',
  syncMessage: null,
  appMode: 'light',
  canvasTheme: 'light',
  documentsOpen: true,
  notesPreview: false,
  onToggleDocuments: vi.fn(),
  onToggleNotesPreview: vi.fn(),
  onTitle: vi.fn(),
  onOpen: vi.fn(),
  onCloseTab: vi.fn(),
  onCreate: vi.fn(),
  onSelectObject: vi.fn(),
  onAppMode: vi.fn(),
  onCanvasTheme: vi.fn(),
};

const renderHeader = (props = baseProps) => render(
  <MemoryRouter><PlaygroundHeader {...props} /></MemoryRouter>,
);

afterEach(cleanup);

describe('PlaygroundHeader — Niko save reactions', () => {
  it('does not celebrate initial loading, then follows real saving, success and failure states', () => {
    const view = renderHeader({ ...baseProps, saveState: 'loading' });
    expect(screen.getByTestId('niko')).toHaveAttribute('data-state', 'working');

    view.rerender(<MemoryRouter><PlaygroundHeader {...baseProps} saveState="synced" /></MemoryRouter>);
    expect(screen.getByTestId('niko')).toHaveAttribute('data-state', 'idle');

    view.rerender(<MemoryRouter><PlaygroundHeader {...baseProps} saveState="saving" /></MemoryRouter>);
    expect(screen.getByTestId('niko')).toHaveAttribute('data-state', 'working');

    view.rerender(<MemoryRouter><PlaygroundHeader {...baseProps} saveState="synced" /></MemoryRouter>);
    expect(screen.getByTestId('niko')).toHaveAttribute('data-state', 'celebrating');

    view.rerender(<MemoryRouter><PlaygroundHeader {...baseProps} saveState="error" /></MemoryRouter>);
    expect(screen.getByTestId('niko')).toHaveAttribute('data-state', 'error');
  });
});
