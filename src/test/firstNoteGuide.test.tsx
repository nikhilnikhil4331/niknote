import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FirstNoteGuide } from '@/components/onboarding/FirstNoteGuide';

const DISMISS_KEY = 'niknote.onboarding.firstNote.v1';

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe('first note guide', () => {
  it('shows three steps and ticks the first one when the editor has text', () => {
    const { rerender } = render(<FirstNoteGuide hasContent={false} onOpenStyle={() => {}} />);
    expect(screen.getByTestId('first-note-guide')).toBeTruthy();
    expect(screen.getByText('0/3 done · nothing is blocked')).toBeTruthy();

    rerender(<FirstNoteGuide hasContent onOpenStyle={() => {}} />);
    expect(screen.getByText('1/3 done · nothing is blocked')).toBeTruthy();
  });

  it('opens the style panel and marks the step done', () => {
    const onOpenStyle = vi.fn();
    const { rerender } = render(<FirstNoteGuide hasContent onOpenStyle={onOpenStyle} />);

    fireEvent.click(screen.getByRole('button', { name: /choose paper & pen/i }));
    expect(onOpenStyle).toHaveBeenCalledTimes(1);

    rerender(<FirstNoteGuide hasContent onOpenStyle={onOpenStyle} />);
    expect(screen.getByText('2/3 done · nothing is blocked')).toBeTruthy();
  });

  it('disappears once a note exists — no onboarding over real work', () => {
    localStorage.setItem('niknote.notes.v1', JSON.stringify([
      { id: 'n1', title: 'Biology', content: 'cells', trashedAt: null },
    ]));
    render(<FirstNoteGuide hasContent onOpenStyle={() => {}} />);
    expect(screen.queryByTestId('first-note-guide')).toBeNull();
  });

  it('can be dismissed and stays dismissed', () => {
    const { unmount } = render(<FirstNoteGuide hasContent={false} onOpenStyle={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(localStorage.getItem(DISMISS_KEY)).toBe('dismissed');
    unmount();

    render(<FirstNoteGuide hasContent={false} onOpenStyle={() => {}} />);
    expect(screen.queryByTestId('first-note-guide')).toBeNull();
  });
});
