/// <reference types="bun" />
import { expect, test } from "bun:test";
import {
  bestHabitStreakEver, bestStreakHistory, completionForDay, rangeCompletion,
  categoryBreakdown, milestoneProgress,
} from "./trackers";
import { endAtFor, secondsLeft, remainingOnPause, formatClock, clockParts, phaseComplete } from "./focusClock";

const habit = { id: "h", target: 1, days: [0, 1, 2, 3, 4, 5, 6] };
const entries = {
  "h|2026-10-10": { v: 1 }, "h|2026-10-11": { v: 1 }, "h|2026-10-12": { v: 1 },
  "h|2026-10-13": { v: 0 }, "h|2026-10-14": { v: 1 }, "h|2026-10-15": { v: 1 },
  "w|2026-10-15": { v: 8 },
};
const today = new Date(2026, 9, 15);

test("best streak is the longest historic run, not only the current one", () => {
  expect(bestHabitStreakEver(entries, habit, today)).toBe(3);
  expect(bestStreakHistory(entries, [habit], today)).toBe(3);
});

test("completion helpers never double count a habit/day slot", () => {
  expect(completionForDay(entries, [habit], today)).toMatchObject({ total: 1, done: 1, pct: 100 });
  expect(rangeCompletion(entries, [habit], ["2026-10-14", "2026-10-15"])).toEqual({ slots: 2, done: 2, pct: 100 });
});

test("category breakdown aggregates scheduled slots", () => {
  const cats = categoryBreakdown(entries, [
    { id: "h", category: "health", target: 1, days: [0, 1, 2, 3, 4, 5, 6] },
    { id: "w", category: "health", target: 8, days: [0, 1, 2, 3, 4, 5, 6] },
  ], today, 1);
  expect(cats).toEqual([{ category: "health", total: 2, done: 2, pct: 100 }]);
});

test("milestones derive from the best streak", () => {
  expect(milestoneProgress(8).map(m => [m.days, m.reached])).toEqual([[3, true], [7, true], [30, false]]);
});

test("focus clock derives remaining time from timestamps", () => {
  const now = 1_000_000;
  const endAt = endAtFor(1500, now);
  expect(secondsLeft(endAt, now)).toBe(1500);
  expect(secondsLeft(endAt, now + 2_100)).toBe(1498);
  expect(secondsLeft(endAt, now + 2_000_000)).toBe(0);
  expect(remainingOnPause(endAt, now + 60_000)).toBe(1440);
  expect(formatClock(1498)).toBe("24:58");
  expect(clockParts(3661)).toEqual({ minutes: 61, seconds: 1, label: "61:01" });
  expect(phaseComplete(0)).toBe(true);
  expect(phaseComplete(1)).toBe(false);
});
