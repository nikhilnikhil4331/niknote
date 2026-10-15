/// <reference types="bun" />
import { expect, test } from "bun:test";
import { accountBalances, cashflow, scheduledStreak, monthSummary } from "./trackers";
const rows = [
  { kind: "income", amount: 1000, account: "Bank" },
  { kind: "expense", amount: 200, account: "Cash" },
  { kind: "transfer", amount: 300, account: "Bank", to_account: "Cash" },
];
test("transfer moves money between accounts", () => { expect(accountBalances(rows)).toEqual({ Bank: 700, Cash: 100 }); });
test("transfer is not income or expense", () => { expect(cashflow(rows)).toEqual({ income: 1000, expense: 200, net: 800 }); });
test("month summary ignores transfers", () => {
  expect(monthSummary([{ kind: "transfer", amount: 50, occurred_on: "2026-10-02" }], new Date(2026, 9, 5)).spent).toBe(0);
});
test("deleting a row updates balances", () => { expect(accountBalances(rows.slice(0, 2))).toEqual({ Bank: 1000, Cash: -200 }); });
// 2026-10-12 is a Monday. Habit on Mon/Wed/Fri.
test("rest days do not break a weekday streak", () => {
  expect(scheduledStreak(["2026-10-07", "2026-10-09", "2026-10-12"], [1, 3, 5], new Date(2026, 9, 12))).toBe(3);
});
test("missing a scheduled day breaks the streak", () => {
  expect(scheduledStreak(["2026-10-05", "2026-10-09", "2026-10-12"], [1, 3, 5], new Date(2026, 9, 12))).toBe(2);
});
test("today not done yet keeps the streak", () => {
  expect(scheduledStreak(["2026-10-09"], [1, 3, 5], new Date(2026, 9, 12))).toBe(1);
});
