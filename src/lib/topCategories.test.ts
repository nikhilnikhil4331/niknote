import { describe, expect, it } from 'bun:test';
import { topCategories } from './trackers';
describe('topCategories', () => {
  it('ranks expense categories, ignoring income and transfers', () => {
    const r = topCategories([
      { kind: 'expense', amount: 300, category: 'Food' }, { kind: 'expense', amount: 100, category: 'Transport' },
      { kind: 'expense', amount: 100, category: 'Food' }, { kind: 'income', amount: 5000, category: 'Salary' },
      { kind: 'transfer', amount: 999, category: 'Transfer' },
    ]);
    expect(r).toEqual([{ category: 'Food', amount: 400, pct: 80 }, { category: 'Transport', amount: 100, pct: 20 }]);
  });
  it('limits to the top N', () => {
    expect(topCategories([{ kind: 'expense', amount: 1, category: 'A' }, { kind: 'expense', amount: 2, category: 'B' }], 1)).toEqual([{ category: 'B', amount: 2, pct: 67 }]);
  });
});
