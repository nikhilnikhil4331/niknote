/// <reference types="bun" />
import { expect, test } from "bun:test";
import { waterProgress, dailyCashSeries } from "./trackers";

test("water: 3 of 8 glasses is 37.5% full and 5 glasses left", () => {
  const w = waterProgress(3, 8);
  expect(w.ratio).toBe(0.375);
  expect(w.left).toBe(5);
  expect(w.drunkMl).toBe(750);
  expect(w.goalMl).toBe(2000);
  expect(w.done).toBe(false);
});

test("water: drinking past the goal keeps the glass full and 0 left", () => {
  const w = waterProgress(10, 8);
  expect(w.ratio).toBe(1);
  expect(w.left).toBe(0);
  expect(w.done).toBe(true);
});

test("water: negative or broken values never go below empty", () => {
  expect(waterProgress(-2, 8).ratio).toBe(0);
  expect(waterProgress(2, 0).goal).toBe(1);
});

test("daily series fills empty days with zero and ignores transfers", () => {
  const s = dailyCashSeries([
    { kind: "income", amount: 1000, occurred_on: "2026-10-01" },
    { kind: "expense", amount: 200, occurred_on: "2026-10-03" },
    { kind: "transfer", amount: 500, occurred_on: "2026-10-03" },
  ], "2026-10-01", "2026-10-04");
  expect(s.map(r => r.expense)).toEqual([0, 0, 200, 0]);
  expect(s.map(r => r.net)).toEqual([1000, 1000, 800, 800]);
});
