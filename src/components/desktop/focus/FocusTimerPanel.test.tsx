// ============================================================
// FocusTimerPanel + CircularDial behavioural tests
// Verifies the mockup's riskiest promises:
//  - dragging the ring changes the SAME duration as presets/keys
//  - crossing 12 o'clock never teleports the duration
//  - countdown is timestamp-based and records sessions once
//  - stopwatch start/lap/pause/save flow
// ============================================================

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { FocusTimerPanel } from './FocusTimerPanel';
import type { NikTask } from '../store';

const SESSIONS_KEY = 'niknote.desktop.focusSessions.v1';
const TIMER_STATE_KEY = 'niknote.desktop.timerState.v1';

const readSessions = () => {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]') as { kind: string; durationSec: number; category: string }[];
  } catch {
    return [];
  }
};

function mockDialRect(container: HTMLElement) {
  const svg = container.querySelector('.nd-dial svg');
  if (svg) {
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, toJSON: () => ({}),
    } as DOMRect);
  }
}

/** Fire a pointer event at viewBox coords (x, y) on the dial wrapper. */
function dialPointer(container: HTMLElement, type: 'pointerdown' | 'pointermove' | 'pointerup', x: number, y: number) {
  const dial = container.querySelector('.nd-dial') as HTMLElement;
  fireEvent(dial, new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }) as unknown as Event);
}

const slider = () => screen.getByRole('slider', { name: /timer duration/i });

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 29, 10, 0, 0));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('dial + presets share one duration state', () => {
  it('keyboard arrows adjust the duration (and aria state follows)', () => {
    const { container } = render(<FocusTimerPanel tasks={[]} />);
    mockDialRect(container);
    // default pomodoro 25
    expect(slider()).toHaveAttribute('aria-valuenow', '25');
    fireEvent.keyDown(slider(), { key: 'ArrowRight' });
    expect(slider()).toHaveAttribute('aria-valuenow', '26');
    fireEvent.keyDown(slider(), { key: 'ArrowRight', shiftKey: true });
    expect(slider()).toHaveAttribute('aria-valuenow', '31');
    fireEvent.keyDown(slider(), { key: 'Home' });
    expect(slider()).toHaveAttribute('aria-valuenow', '5');
    fireEvent.keyDown(slider(), { key: 'End' });
    expect(slider()).toHaveAttribute('aria-valuenow', '120');
  });

  it('preset chips set the same state the dial displays', () => {
    const { container } = render(<FocusTimerPanel tasks={[]} />);
    mockDialRect(container);
    fireEvent.click(screen.getByRole('button', { name: '45 min' }));
    expect(slider()).toHaveAttribute('aria-valuenow', '45');
    expect(screen.getByText('45:00')).toBeDefined();
  });

  it('pointer drag on the ring sets the duration (3 o’clock → 30 min, bottom → 60 min)', () => {
    const { container } = render(<FocusTimerPanel tasks={[]} />);
    mockDialRect(container);
    // viewBox 200x200, centre (100,100); ring radius 78 — drag along ring
    dialPointer(container, 'pointerdown', 178, 100); // 3 o'clock = 90°
    expect(slider()).toHaveAttribute('aria-valuenow', '30');
    dialPointer(container, 'pointermove', 100, 178); // 6 o'clock = 180°
    expect(slider()).toHaveAttribute('aria-valuenow', '60');
    dialPointer(container, 'pointerup', 100, 178);
  });

  it('crossing 12 o’clock clamps to max instead of teleporting to min', () => {
    const { container } = render(<FocusTimerPanel tasks={[]} />);
    mockDialRect(container);
    // start near top-right (≈10°, ~3°/min)
    dialPointer(container, 'pointerdown', 100 + 78 * Math.sin((340 * Math.PI) / 180), 100 - 78 * Math.cos((340 * Math.PI) / 180)); // ≈ 113.3 min
    const near = parseInt(slider().getAttribute('aria-valuenow') || '0', 10);
    expect(near).toBeGreaterThan(105);
    // drag across the top to +10° — must clamp to 120, never drop to ~5
    dialPointer(container, 'pointermove', 100 + 78 * Math.sin((10 * Math.PI) / 180), 100 - 78 * Math.cos((10 * Math.PI) / 180));
    expect(slider()).toHaveAttribute('aria-valuenow', '120');
    dialPointer(container, 'pointerup', 100, 22);
  });
});

describe('countdown behaviour (timestamp-based)', () => {
  it('start → pause → resume → reset, and completion records ONE session', () => {
    const { container } = render(<FocusTimerPanel tasks={[]} />);
    mockDialRect(container);

    // timer mode, 5 minutes
    fireEvent.click(screen.getByRole('tab', { name: 'Timer' }));
    fireEvent.click(screen.getByRole('button', { name: '5 min' }));
    expect(screen.getByText('05:00')).toBeDefined();

    const startBtn = screen.getByRole('button', { name: 'Start' });
    fireEvent.click(startBtn);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDefined();

    // 2 minutes pass (throttled tab would jump exactly the same way)
    act(() => { vi.advanceTimersByTime(2 * 60 * 1000); });
    expect(screen.getByText('03:00')).toBeDefined();

    // pause freezes
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => { vi.advanceTimersByTime(60 * 1000); });
    expect(screen.getByText('03:00')).toBeDefined();

    // resume and run out the remaining 3 minutes — fire-and-forget tab switch included
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => { vi.advanceTimersByTime(3 * 60 * 1000 + 800); });

    // completed: back at 05:00 idle display and exactly one recorded session
    expect(screen.getByText('05:00')).toBeDefined();
    const sessions = readSessions();
    expect(sessions.filter((s) => s.kind === 'timer')).toHaveLength(1);
    expect(sessions[0].durationSec).toBe(300);
    expect(sessions[0].category).toBe('Study');
  });

  it('pomodoro completion moves into a break and records focus time', () => {
    const { container } = render(<FocusTimerPanel tasks={[]} />);
    mockDialRect(container);
    // shorten focus to 5 min via Home key on the dial
    fireEvent.keyDown(slider(), { key: 'Home' });
    expect(slider()).toHaveAttribute('aria-valuenow', '5');
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => { vi.advanceTimersByTime(5 * 60 * 1000 + 800); });
    // now in short break 05:00, one pomodoro session recorded
    const sessions = readSessions();
    expect(sessions.filter((s) => s.kind === 'pomodoro')).toHaveLength(1);
    expect(screen.getByText(/short break/i)).toBeDefined();
  });

  it('blocks switching modes while a session is live', () => {
    const { container } = render(<FocusTimerPanel tasks={[]} />);
    mockDialRect(container);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Stopwatch' }));
    // still on pomodoro (toast shown), timer untouched
    expect(screen.getByRole('tab', { name: 'Pomodoro' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('stopwatch', () => {
  it('start / lap / pause / save records a real session', () => {
    const { container } = render(<FocusTimerPanel tasks={[]} />);
    mockDialRect(container);
    fireEvent.click(screen.getByRole('tab', { name: 'Stopwatch' }));

    fireEvent.click(screen.getByRole('button', { name: /start stopwatch/i }));
    act(() => { vi.advanceTimersByTime(12000); });
    fireEvent.click(screen.getByRole('button', { name: 'Record lap' }));
    act(() => { vi.advanceTimersByTime(8000); });
    fireEvent.click(screen.getByRole('button', { name: 'Record lap' }));
    fireEvent.click(screen.getByRole('button', { name: /pause stopwatch/i }));

    // two laps listed
    expect(screen.getByText('#1')).toBeDefined();
    expect(screen.getByText('#2')).toBeDefined();

    // save & reset writes one stopwatch session of ~20s
    fireEvent.click(screen.getByRole('button', { name: /save session/i }));
    const sessions = readSessions();
    expect(sessions.filter((s) => s.kind === 'stopwatch')).toHaveLength(1);
    expect(sessions[0].durationSec).toBeGreaterThanOrEqual(19);
    expect(sessions[0].durationSec).toBeLessThanOrEqual(21);
  });
});

describe('task linking', () => {
  it('links the session to a chosen open task', () => {
    const tasks: NikTask[] = [
      { id: 't1', title: 'Study physics', status: 'todo', createdAt: new Date().toISOString() },
    ];
    const { container } = render(<FocusTimerPanel tasks={tasks} />);
    mockDialRect(container);
    fireEvent.keyDown(slider(), { key: 'Home' }); // 5 min
    const select = screen.getByLabelText(/link session to a task/i);
    fireEvent.change(select, { target: { value: 't1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => { vi.advanceTimersByTime(5 * 60 * 1000 + 800); });
    const sessions = readSessions() as { taskId?: string }[];
    expect(sessions[0].taskId).toBe('t1');
  });
});
