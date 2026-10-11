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
