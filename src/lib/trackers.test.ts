// @ts-nocheck — run with `bun test`
import { expect, test } from "bun:test";
import { computeStreak, splitBill } from "./trackers";
test("streak counts consecutive days to today", () => {
  expect(computeStreak(["2026-10-09","2026-10-10","2026-10-11"], new Date(2026,9,11))).toBe(3);
});
test("streak survives when today not yet done", () => {
  expect(computeStreak(["2026-10-09","2026-10-10"], new Date(2026,9,11))).toBe(2);
});
test("split keeps total exact", () => {
  expect(splitBill(100, 3)).toEqual([33.34, 33.33, 33.33]);
});
import { billStatus } from "./trackers";
test("bill due within 3 days is 'soon'", () => {
  expect(billStatus({ due_day: 14, last_paid_month: null }, new Date(2026, 9, 11))).toBe("soon");
});
test("bill past due day is 'overdue'", () => {
  expect(billStatus({ due_day: 5, last_paid_month: null }, new Date(2026, 9, 11))).toBe("overdue");
});
test("bill paid this month is 'paid'", () => {
  expect(billStatus({ due_day: 5, last_paid_month: "2026-10" }, new Date(2026, 9, 11))).toBe("paid");
});
test("day 31 bill in a 30-day month is due on the 30th", () => {
  expect(billStatus({ due_day: 31, last_paid_month: null }, new Date(2026, 10, 28))).toBe("soon");
});
// ── Niknote Habit routine ──
import {
  greetingFor, sleepMinutes, exerciseStats, focusDurations,
  weekCompletion, habitStreak, bestStreakAcross, entryValue,
  ACHIEVEMENTS, unlockedAchievements, fmtHabitValue,
} from "./trackers";

test("greeting changes with hour", () => {
  expect(greetingFor(7)).toBe("Good Morning");
  expect(greetingFor(14)).toBe("Good Afternoon");
  expect(greetingFor(21)).toBe("Good Evening");
});
test("sleep minutes wrap past midnight", () => {
  expect(sleepMinutes("22:30", "06:00")).toBe(7 * 60 + 30);
  expect(sleepMinutes("06:00", "06:30")).toBe(30);
  expect(sleepMinutes("bad", "06:00")).toBeNull();
});
test("exercise stats scale with minutes", () => {
  expect(exerciseStats(30)).toEqual({ kcal: 120, km: 2.3 });
  expect(exerciseStats(-5)).toEqual({ kcal: 0, km: 0 });
});
test("focus durations per mode", () => {
  expect(focusDurations("pomodoro")).toEqual({ focus: 1500, break: 300 });
  expect(focusDurations("deep")).toEqual({ focus: 3000, break: 600 });
  expect(focusDurations("custom", 90, 3)).toEqual({ focus: 5400, break: 180 });
  expect(focusDurations("custom", -5, 0).focus).toBe(60);
});
test("weekCompletion counts scheduled slots only", () => {
  const today = new Date(2026, 9, 15); // Thursday
  const habits = [
    { id: "a", target: 1, days: [0, 1, 2, 3, 4, 5, 6] },
    { id: "b", target: 1, days: [1, 3, 5] }, // Mon/Wed/Fri
  ];
  // 15 Oct 2026 is a Thursday: last 7 days = Fri..Thu. b runs Mon(12)/Wed(14)/Fri(9) -> 3 slots, a -> 7.
  const entries: Record<string, { v: number }> = { "a|2026-10-15": { v: 1 }, "b|2026-10-14": { v: 1 } };
  const w = weekCompletion(entries, habits, today);
  expect(w.slots).toBe(10);
  expect(w.pct).toBe(20);
  expect(w.perDay[6].day).toBe("2026-10-15");
  expect(w.perDay[6].done).toBe(2);
});
test("habitStreak respects schedule and target", () => {
  const entries: Record<string, { v: number }> = {
    "h|2026-10-14": { v: 10 }, "h|2026-10-12": { v: 10 }, "h|2026-10-11": { v: 10 },
    "h|2026-10-10": { v: 9 },
  };
  const habit = { id: "h", target: 10, days: [0, 1, 2, 3, 4, 5, 6] };
  expect(habitStreak(entries, habit, new Date(2026, 9, 15))).toBe(2); // today(15) not done yet -> counts 14,12? 13 missing
});
test("habitStreak skips unscheduled days", () => {
  // days [3,5,0] = Wed/Fri/Sun; today Thu 15 (not scheduled, not done yet)
  const entries: Record<string, { v: number }> = {
    "h|2026-10-14": { v: 5 }, "h|2026-10-11": { v: 5 },
  };
  expect(habitStreak(entries, { id: "h", target: 5, days: [3, 5, 0] }, new Date(2026, 9, 15))).toBe(2);
});
test("bestStreakAcross picks max", () => {
  const entries: Record<string, { v: number }> = {
    "a|2026-10-15": { v: 1 }, "a|2026-10-14": { v: 1 },
    "b|2026-10-15": { v: 1 }, "b|2026-10-14": { v: 1 }, "b|2026-10-13": { v: 1 }, "b|2026-10-12": { v: 1 },
  };
  const habits = [{ id: "a", target: 1, days: [0, 1, 2, 3, 4, 5, 6] }, { id: "b", target: 1, days: [0, 1, 2, 3, 4, 5, 6] }];
  expect(bestStreakAcross(entries, habits, new Date(2026, 9, 15))).toBe(4);
});
test("entryValue is zero for missing", () => {
  expect(entryValue({}, "x", "2026-10-15")).toBe(0);
  expect(fmtHabitValue(7.5, "sleep")).toBe("7.5 h");
  expect(fmtHabitValue(5.4, "water")).toBe("5.4");
});
test("achievements evaluate", () => {
  const base = {
    habits: [{ id: "w", name: "Water", type: "water", target: 8, days: [0, 1, 2, 3, 4, 5, 6] }],
    entries: { "w|2026-10-15": { v: 8, at: "2026-10-15T07:30:00" } },
    focus: { "2026-10-15": 4 },
    today: "2026-10-15",
  };
  const ids = unlockedAchievements(base).map(a => a.id);
  expect(ids).toContain("first-step");
  expect(ids).toContain("hydration-hero");
  expect(ids).toContain("early-bird");
  expect(ids).toContain("focus-4");
  expect(ids).not.toContain("streak-3");
  expect(ACHIEVEMENTS.length).toBe(8);
});
