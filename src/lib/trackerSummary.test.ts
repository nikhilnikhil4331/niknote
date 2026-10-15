/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { monthSummary } from './trackers';

test('month summary counts only this month and splits income/expense', () => {
  const today = new Date(2026, 9, 15);
  const s = monthSummary([
    { kind: 'expense', amount: '120.5', occurred_on: '2026-10-01' },
    { kind: 'expense', amount: 80, occurred_on: '2026-10-15' },
    { kind: 'income', amount: 1000, occurred_on: '2026-10-03' },
    { kind: 'expense', amount: 999, occurred_on: '2026-09-30' },
  ], today);
  expect(s).toEqual({ spent: 200.5, income: 1000, balance: 799.5 });
});
