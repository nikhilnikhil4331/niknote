import { describe, it, expect } from 'vitest';
import {
  lastNDays, lastNMonths, monthKeyOf, dayKeyOf,
  focusMinutesByDay, focusMinutesByMonth, tasksCompletedByDay, tasksCompletedByMonth,
  notesCreatedByDay, notesCreatedByMonth,
  habitScorePct, deltaPct, focusDistribution, formatMinutesAsHours,
  overdueCount, doneTodayCount,
} from './productivity';

const TODAY = new Date(2026, 9, 29); // 29 Oct 2026 (local)
const days = lastNDays(7, TODAY);
const at = (dayIdx: number, h = 10) =>
  new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - (6 - dayIdx), h).toISOString();

describe('lastNDays', () => {
  it('returns n keys ending today, oldest first', () => {
    const ks = lastNDays(3, new Date(2026, 9, 29));
    expect(ks).toEqual(['2026-10-27', '2026-10-28', '2026-10-29']);
  });
});

describe('focusMinutesByDay', () => {
  it('aggregates real recorded sessions per day', () => {
    const sessions = [
      { startedAt: at(6, 9), durationSec: 1500, category: 'Study' },  // 25m today
      { startedAt: at(6, 12), durationSec: 1500, category: 'Work' },  // 25m today
      { startedAt: at(4, 12), durationSec: 2700, category: 'Study' }, // 45m, 2 days ago
    ];
    const out = focusMinutesByDay(sessions, days);
    expect(out[6]).toBe(50);
    expect(out[4]).toBe(45);
    expect(out.reduce((a, b) => a + b, 0)).toBe(95);
  });
  it('ignores malformed timestamps and empty input', () => {
    expect(focusMinutesByDay([{ startedAt: 'junk', durationSec: 10 }], days)).toEqual(Array(7).fill(0));
    expect(focusMinutesByDay([], days)).toEqual(Array(7).fill(0));
  });
});

describe('tasksCompletedByDay', () => {
  it('counts only done tasks on their doneAt day', () => {
    const tasks = [
      { status: 'done', doneAt: at(6) },
      { status: 'done', doneAt: at(6) },
      { status: 'todo', doneAt: undefined },
      { status: 'done', doneAt: at(2) },
    ];
    const out = tasksCompletedByDay(tasks, days);
    expect(out[6]).toBe(2);
    expect(out[2]).toBe(1);
    expect(out.reduce((a, b) => a + b, 0)).toBe(3);
  });
});

describe('notesCreatedByDay', () => {
  it('counts creations on created day only (edits never counted as new)', () => {
    const notes = [
      { createdAt: at(6), updatedAt: at(6) },
      { createdAt: at(5) },
      { createdAt: 'bad-date' },
    ];
    const out = notesCreatedByDay(notes, days);
    expect(out[6]).toBe(1);
    expect(out[5]).toBe(1);
  });
});

describe('habitScorePct', () => {
  it('caps each habit at its target; 0–100', () => {
    expect(habitScorePct([
      { target: 4, periodTotal: 3 },
      { target: 3, periodTotal: 2 },
      { target: 1, periodTotal: 3 }, // over-achieved — capped at 1
    ])).toBe(Math.round(((3 + 2 + 1) / 8) * 100));
    expect(habitScorePct([])).toBe(0);
  });
});

describe('deltaPct — honest comparisons', () => {
  it('returns null with no valid baseline', () => {
    expect(deltaPct(10, 0)).toBeNull();
  });
  it('computes real percent change', () => {
    expect(deltaPct(18, 14)).toBe(29);
    expect(deltaPct(10, 20)).toBe(-50);
  });
});

describe('focusDistribution', () => {
  it('shares percentages across present categories only', () => {
    const dist = focusDistribution([
      { startedAt: at(6), durationSec: 2700, category: 'Study' },
      { startedAt: at(6), durationSec: 1800, category: 'Work' },
      { startedAt: at(5), durationSec: 900 }, // missing category → Other
    ]);
    expect(dist.map((d) => d.category)).toEqual(['Study', 'Work', 'Other']);
    expect(dist[0].pct).toBe(50); // 2700 / 5400
    expect(dist[1].pct).toBe(33); // 1800 / 5400
    expect(dist.reduce((a, b) => a + b.pct, 0)).toBe(100);
  });
  it('empty when no sessions (no fabricated categories)', () => {
    expect(focusDistribution([])).toEqual([]);
  });
});

describe('month aggregations', () => {
  it('lastNMonths includes current month, oldest first', () => {
    const ms = lastNMonths(3, new Date(2026, 9, 29));
    expect(ms).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(monthKeyOf(new Date(2026, 9, 29))).toBe('2026-10');
  });
  it('groups sessions and records per month', () => {
    const months = lastNMonths(2, TODAY);
    const fm = focusMinutesByMonth(
      [{ startedAt: at(6), durationSec: 1800 }, { startedAt: '2026-09-10T08:00:00.000Z', durationSec: 3600 }],
      months,
    );
    // at() uses local TZ; the older session is UTC — both must land in a bucket we recognise
    expect(fm[0] + fm[1]).toBe(90);
    // previous month contains the older session for UTC-consistent zones
    expect(fm).toContain(60);
  });
  it('groups tasks and notes per month without double counting', () => {
    const months = lastNMonths(1, TODAY);
    expect(notesCreatedByMonth([{ createdAt: at(6) }, { createdAt: at(6) }], months)).toEqual([2]);
    expect(
      tasksCompletedByMonth(
        [
          { status: 'done', doneAt: at(6) },
          { status: 'todo', doneAt: undefined },
        ],
        months,
      ),
    ).toEqual([1]);
  });
});

describe('misc', () => {
  it('formatMinutesAsHours', () => {
    expect(formatMinutesAsHours(765)).toBe('12h 45m');
    expect(formatMinutesAsHours(45)).toBe('45m');
    expect(formatMinutesAsHours(120)).toBe('2h');
  });
  it('overdue / done-today helpers', () => {
    const tasks = [
      { status: 'todo', due: '2026-10-28' },
      { status: 'done', due: '2026-10-28', doneAt: at(6) },
      { status: 'todo', due: '2026-10-30' },
      { status: 'done', doneAt: at(6) },
    ];
    expect(overdueCount(tasks as never, TODAY)).toBe(1);
    expect(doneTodayCount(tasks as never, TODAY)).toBe(2);
    expect(dayKeyOf(TODAY)).toBe('2026-10-29');
  });
});
