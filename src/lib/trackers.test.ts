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
