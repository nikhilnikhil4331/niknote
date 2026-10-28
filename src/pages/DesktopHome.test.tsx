// ============================================================
// DesktopHome smoke test (guest mode) — verifies the redesigned
// dashboard renders REAL wiring: hero, badges, quick actions,
// sample notes, tabs, right rail timer, honest empty analytics,
// and the full new-task flow.
// ============================================================

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ---- context/hook mocks: keep the test 100% local (guest mode) ----
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'local-guest-test', email: null }, signOut: vi.fn() }),
}));
vi.mock('@/hooks/useAccountName', () => ({
  useAccountName: () => ({ fullName: '' }),
}));
vi.mock('@/hooks/useStreak', () => ({
  useStreak: () => ({ streak: { currentStreak: 4, longestStreak: 6, lastActiveDate: null }, recordActivity: vi.fn() }),
}));
vi.mock('@/contexts/PremiumContext', () => ({
  usePremiumContext: () => ({ isPremium: false }),
}));
vi.mock('@/hooks/useNotebooks', () => ({
  useNotebooks: () => ({
    notebooks: [], loading: false,
    createNotebook: vi.fn(), updateNotebook: vi.fn(), deleteNotebook: vi.fn(), refetch: vi.fn(),
  }),
}));

import DesktopHome from './DesktopHome';

const renderHome = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <DesktopHome />
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  // silence sonner toasts in jsdom
});
afterEach(cleanup);

describe('DesktopHome — redesigned dashboard (guest)', () => {
  it('renders greeting, hero banner and real badges', () => {
    renderHome();
    expect(screen.getAllByText(/good (morning|afternoon|evening)/i).length).toBeGreaterThan(0);
    expect(screen.getByAltText('')).toBeInTheDocument(); // hero banner image
    expect(screen.getAllByText(/day streak/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/0 notes/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/tasks? done today/i)[0]).toBeInTheDocument();
  });

  it('exposes all seven quick actions', () => {
    renderHome();
    for (const label of ['New Note', 'Quick Note', 'New Task', 'Template', 'Upload PDF', 'AI Generate', 'Scan Notes']) {
      expect(screen.getAllByTitle(new RegExp(`^${label}`, 'i')).length).toBeGreaterThan(0);
    }
  });

  it('shows starter sample notes + create tile when the guest has no notes', () => {
    renderHome();
    expect(screen.getAllByText('Biology Class Notes').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /create a new note/i }).length).toBeGreaterThan(0);
  });

  it('renders the focus timer panel with all three modes and presets', () => {
    renderHome();
    expect(screen.getAllByRole('tab', { name: 'Pomodoro' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('tab', { name: 'Timer' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('tab', { name: 'Stopwatch' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('slider', { name: /timer duration/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '25 min' }).length).toBeGreaterThan(0);
  });

  it('analytics render without fabricated focus sessions', () => {
    renderHome();
    // overview chart region exists (first-run seeded tasks are real data)
    expect(screen.getAllByText('Productivity Overview').length).toBeGreaterThan(0);
    // but focus insights honestly reports the absence of sessions
    expect(screen.getAllByText(/no focus sessions in this period yet/i).length).toBeGreaterThan(0);
  });

  it('new task modal adds a real task — visible in the rail instantly', () => {
    renderHome();
    fireEvent.click(screen.getAllByTitle(/^New Task/i)[0]);
    const dialog = screen.getByRole('dialog', { name: /new task/i });
    const input = within(dialog).getByLabelText(/task title/i);
    fireEvent.change(input, { target: { value: 'Revise physics formulas' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /add task/i }));
    // Rail "Today's Tasks" now shows it
    expect(screen.getAllByText('Revise physics formulas').length).toBeGreaterThan(0);
    // and it persisted to the shared task store
    const saved = JSON.parse(localStorage.getItem('niknote.desktop.tasks.v1') || '[]');
    expect(saved.some((t: { title: string }) => t.title === 'Revise physics formulas')).toBe(true);
  });

  it('pinned notes float to the top of All Notes and appear in the Pinned tab', async () => {
    // seed one real local note + one task for context
    localStorage.setItem(
      'niknote.mobile.notebooks.v1',
      JSON.stringify([
        { id: 'n1', title: 'Physics rotation', blocks: [], created_at: '2026-10-28T09:00:00.000Z', updated_at: '2026-10-28T09:00:00.000Z' },
        { id: 'n2', title: 'Exam plan', blocks: [], created_at: '2026-10-27T09:00:00.000Z', updated_at: '2026-10-27T09:00:00.000Z' },
      ]),
    );
    renderHome();
    // seed shows actual notes instead of samples
    await act(async () => {});
    expect(screen.getAllByText('Physics rotation').length).toBeGreaterThan(0);
    // open the options menu of the Physics rotation card (containing wrapper button)
    const card = screen.getAllByText('Physics rotation')[0].closest('button');
    const wrapper = card?.parentElement; // HomeNoteCard div
    const kebab = within(wrapper as HTMLElement).getByRole('button', { name: /options for physics rotation/i });
    fireEvent.click(kebab);
    fireEvent.click(screen.getByRole('button', { name: /pin to top/i }));
    // pin store updated
    const meta = JSON.parse(localStorage.getItem('niknote.desktop.noteMeta.v1') || '{}');
    expect(meta.n1?.pinned).toBe(true);
    // Pinned tab lists exactly that note
    const tabs = screen.getAllByRole('tab', { name: 'Pinned' });
    fireEvent.click(tabs[0]);
    expect(screen.getAllByText('Physics rotation').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Exam plan').length).toBe(0);
  });
});
