// ============================================================
// growth/store — persistence for the growth workspace.
//
// Everything here is operational data (prospects we researched, approvals
// pending review, experiment logs) and it is kept on the operator's device.
// No user note content, no customer data and no credentials are stored.
// A shared team deployment would move this to a server table with RLS; the
// shape is deliberately simple so it can be exported and imported as JSON.
// ============================================================

import type { ApprovalItem } from './approvals';
import { defaultRisk } from './approvals';
import type { Prospect } from './prospects';
import { dedupeProspects } from './prospects';

export const PROSPECTS_KEY = 'niknote.growth.prospects.v1';
export const APPROVALS_KEY = 'niknote.growth.approvals.v1';
export const EXPERIMENTS_KEY = 'niknote.growth.experiments.v1';
export const BUDGET_KEY = 'niknote.growth.budget.v1';

/** Default monthly ceiling for external spend, in paise. Zero = no spending. */
export const DEFAULT_BUDGET_MINOR = 0;

function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota / private mode */ }
}

export function loadProspects(): Prospect[] {
  const raw = readJson<Prospect[]>(PROSPECTS_KEY, []);
  return Array.isArray(raw) ? dedupeProspects(raw) : [];
}

export function saveProspects(prospects: Prospect[]): Prospect[] {
  const deduped = dedupeProspects(prospects);
  writeJson(PROSPECTS_KEY, deduped);
  return deduped;
}

export function loadApprovals(): ApprovalItem[] {
  const raw = readJson<ApprovalItem[]>(APPROVALS_KEY, []);
  if (!Array.isArray(raw)) return [];
  // Defensive: never trust a stored item to bypass the human gate.
  return raw.map(item => ({
    ...item,
    risk: item.risk ?? defaultRisk(item.kind),
  }));
}

export function saveApprovals(items: ApprovalItem[]): ApprovalItem[] {
  writeJson(APPROVALS_KEY, items);
  return items;
}

export function loadBudgetMinor(): number {
  const value = readJson<number>(BUDGET_KEY, DEFAULT_BUDGET_MINOR);
  return typeof value === 'number' && value >= 0 ? value : DEFAULT_BUDGET_MINOR;
}

export function saveBudgetMinor(value: number): void {
  writeJson(BUDGET_KEY, Math.max(0, Math.round(value)));
}

export interface GrowthExport {
  version: 1;
  exportedAt: string;
  prospects: Prospect[];
  approvals: ApprovalItem[];
  budgetMinor: number;
}

export function exportGrowthData(): GrowthExport {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    prospects: loadProspects(),
    approvals: loadApprovals(),
    budgetMinor: loadBudgetMinor(),
  };
}

/** Import validates shape and forces every approval back to a reviewed state. */
export function importGrowthData(payload: unknown): { prospects: number; approvals: number } {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid growth export file.');
  const data = payload as Partial<GrowthExport>;
  const prospects = Array.isArray(data.prospects) ? saveProspects(data.prospects) : loadProspects();
  const approvals = Array.isArray(data.approvals)
    ? saveApprovals(
        data.approvals.map(item => ({
          ...item,
          status: item.status === 'executed' ? 'executed' : 'draft',
        })),
      )
    : loadApprovals();
  return { prospects: prospects.length, approvals: approvals.length };
}
